import { NextResponse } from 'next/server';
import { readGarminData, extractExtendedSummary } from '@/lib/garmin';
import { buildSharedContext, runSpecialistsSequentially } from '@/lib/agents';
import { streamSynthesis } from '@/lib/synthesis-coach';
import { runPlanBuilder } from '@/lib/plan-builder';
import { validatePlanRules, formatViolationsForFix } from '@/lib/plan-validator';
import { persistWeekPlan } from '@/lib/plan-db';
import { writeWeeklyLog, appendTrainingHistory, readCeilings, writeCeilings } from '@/lib/state';
import { getPlanWeekNumber, getTrainingWeek } from '@/lib/week';
import { computeWeekSummary } from '@/lib/daily-log';
import {
  upsertWeeklyMetrics,
  insertCeilingHistory,
  deletePlanItems,
  getDailyLogsByWeek,
} from '@/lib/db';
import { getWeekSessionIds, getExerciseFeedback } from '@/lib/session-db';
import type { CheckInFormData, CheckinSubjectiveData, WeeklyMetrics, CeilingEntry } from '@/lib/types';
import { isNewFormatPayload } from '@/lib/types';
import type { TriageAnswer } from '@/lib/triage-agent';
import type { PlanViolation } from '@/lib/plan-validator';

// New-format payload from the stepper flow
interface CheckinPayload {
  subjectiveData: CheckinSubjectiveData;
  triageClarifications: TriageAnswer[];
  annotation: string;
  [key: string]: unknown;
}

export async function POST(request: Request) {
  // Validate API key early
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set. Add it to dashboard/.env.local' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const garmin = readGarminData();

  // Determine format and build context + model accordingly
  let sharedContext: string;
  let model: 'sonnet' | 'opus' | 'mixed';
  let subjectiveData: CheckinSubjectiveData | null = null;
  let legacyFormData: CheckInFormData | null = null;

  if (isNewFormatPayload(body)) {
    // New stepper flow
    const payload = body as CheckinPayload;
    subjectiveData = payload.subjectiveData;
    const triageClarifications = payload.triageClarifications || [];
    const annotation = typeof payload.annotation === 'string' ? payload.annotation.trim() : '';
    model = subjectiveData.model;
    sharedContext = buildSharedContext(garmin.data, subjectiveData, triageClarifications, annotation);
  } else {
    // Legacy form flow
    legacyFormData = body as CheckInFormData;
    model = legacyFormData.model;
    sharedContext = buildSharedContext(garmin.data, legacyFormData);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Controller may be closed if client disconnected
        }
      }

      // Heartbeat every 30s to prevent Railway proxy idle timeout
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      try {
        // Phase 1: Run 7 specialists sequentially (avoids rate limits on Pro accounts)
        send('status', { phase: 'specialists', message: 'Running specialist analyses...' });

        const specialistOutputs = [];
        for await (const output of runSpecialistsSequentially(sharedContext, model)) {
          specialistOutputs.push(output);
          send('specialist', {
            agentId: output.agentId,
            label: output.label,
            content: output.content,
            error: output.error || null,
          });
        }

        // Phase 2: Stream Synthesis Coach (trimmed decision log)
        send('status', { phase: 'synthesis', message: 'Synthesis Coach analyzing...' });

        let fullSynthesis = '';
        for await (const chunk of streamSynthesis(specialistOutputs, sharedContext)) {
          fullSynthesis += chunk;
          send('synthesis_chunk', { text: chunk });
        }

        // Notify frontend that synthesis is done — Discuss button can activate now
        send('synthesis_done', { fullText: fullSynthesis });

        // Phase 3: Plan Builder + Validator
        send('status', { phase: 'plan_builder', message: 'Building structured training plan...' });

        const weekNumber = getPlanWeekNumber();
        const MAX_RETRIES = 2;
        send('status', { phase: 'plan_builder', message: 'AI is generating your week plan — this takes 1-2 minutes...' });
        let planResult = await runPlanBuilder(fullSynthesis, sharedContext, weekNumber);
        let violations: PlanViolation[] = [];

        if (planResult.success) {
          violations = validatePlanRules(planResult.data);
          let retries = 0;
          while (violations.length > 0 && retries < MAX_RETRIES) {
            retries++;
            send('status', { phase: 'plan_builder', message: `Fixing ${violations.length} plan violation${violations.length > 1 ? 's' : ''} (attempt ${retries + 1})...` });
            const fixInstructions = formatViolationsForFix(violations);
            planResult = await runPlanBuilder(fullSynthesis, sharedContext, weekNumber, fixInstructions);
            if (planResult.success) {
              violations = validatePlanRules(planResult.data);
            } else {
              break;
            }
          }
        }

        if (!planResult.success) {
          send('error', { message: `Plan Builder failed: ${planResult.error}` });
          // Still continue to save synthesis and metrics
        }

        // Phase 4: Persist everything
        send('status', { phase: 'saving', message: 'Saving state...' });

        const today = new Date().toISOString().split('T')[0];
        const ceilings = readCeilings();
        const currentWeek = getTrainingWeek();

        // Build weekly log content
        const specialistSection = specialistOutputs
          .map((o) => `## ${o.label}\n${o.error ? `**ERROR:** ${o.error}` : o.content}`)
          .join('\n\n');
        const logContent = `# Week ${currentWeek} Check-In — ${today}\n\n${specialistSection}\n\n## Synthesis Coach\n${fullSynthesis}`;

        // Write weekly log file (belongs to the training week being reviewed)
        writeWeeklyLog(currentWeek, today, logContent);

        // Append to training history
        appendTrainingHistory(`## Week ${currentWeek} — ${today}\n\nCheck-in completed. See weekly_logs/ for full details.`);

        // Persist structured plan
        let planItemCount = 0;
        if (planResult.success) {
          deletePlanItems(weekNumber);
          const { planItemIds } = persistWeekPlan(planResult.data);
          planItemCount = planItemIds.length;
        }

        // Extract Garmin summary for metrics
        const garminSummary = garmin.data ? extractExtendedSummary(garmin.data) : null;

        // Build weekly metrics — auto-calculate from daily logs when possible
        const weekSummary = computeWeekSummary(currentWeek);
        const hasLogData = weekSummary.days_logged > 0;

        const modelName = model === 'opus' ? 'opus' : model === 'mixed' ? 'mixed' : 'sonnet';

        // Resolve subjective fields from whichever format was used
        const perceivedReadiness = subjectiveData?.perceivedReadiness
          ?? legacyFormData?.perceivedReadiness ?? null;
        const planSatisfaction = subjectiveData?.planSatisfaction
          ?? legacyFormData?.planSatisfaction ?? null;

        // Compute RPE aggregates from session feedback
        const sessionIds = getWeekSessionIds(currentWeek);
        let totalRpe = 0;
        let rpeCount = 0;
        let hardCount = 0;
        for (const sessionId of sessionIds) {
          const feedback = getExerciseFeedback(sessionId);
          for (const f of feedback) {
            totalRpe += f.rpe;
            rpeCount++;
            if (f.rpe >= 4) hardCount++;
          }
        }
        const avgRpe = rpeCount > 0 ? Math.round((totalRpe / rpeCount) * 10) / 10 : null;

        // Compute pain areas summary from daily logs
        const dailyLogsForAgg = getDailyLogsByWeek(currentWeek);
        let painAreasSummary: string | null = null;
        if (hasLogData) {
          const areaMap = new Map<string, { days: number; maxLevel: number }>();
          for (const log of dailyLogsForAgg) {
            if (log.pain_level != null && log.pain_level > 0 && log.pain_area) {
              const existing = areaMap.get(log.pain_area) ?? { days: 0, maxLevel: 0 };
              existing.days++;
              existing.maxLevel = Math.max(existing.maxLevel, log.pain_level);
              areaMap.set(log.pain_area, existing);
            }
          }
          if (areaMap.size > 0) {
            painAreasSummary = JSON.stringify(
              Array.from(areaMap.entries()).map(([area, { days, maxLevel }]) => ({ area, days, maxLevel }))
            );
          }
        }

        // Compute sleep disruption breakdown
        let sleepDisruptionBreakdown: string | null = null;
        if (hasLogData) {
          const causeCounts: Record<string, number> = {};
          for (const log of dailyLogsForAgg) {
            if (log.sleep_disruption) {
              causeCounts[log.sleep_disruption] = (causeCounts[log.sleep_disruption] ?? 0) + 1;
            }
          }
          if (Object.keys(causeCounts).length > 0) {
            sleepDisruptionBreakdown = JSON.stringify(causeCounts);
          }
        }

        // Compute sick days
        const sickDayCount = hasLogData
          ? dailyLogsForAgg.filter(l => l.is_sick_day).length
          : null;

        const metrics: WeeklyMetrics = {
          weekNumber: currentWeek,
          checkInDate: today,
          weightKg: garminSummary?.weight ?? null,
          bodyFatPct: garminSummary?.bodyFat ?? null,
          muscleMassKg: garminSummary?.muscleMass ?? null,
          avgSleepScore: garminSummary?.avgSleep ?? null,
          avgTrainingReadiness: garminSummary?.avgReadiness ?? null,
          avgRhr: garminSummary?.avgRhr ?? null,
          avgHrv: garminSummary?.avgHrv ?? null,
          caloriesAvg: garminSummary?.caloriesAvg ?? null,
          proteinAvg: garminSummary?.proteinAvg ?? null,
          // Auto-calculate from daily logs when available, fallback to legacy form data
          hydrationTracked: hasLogData
            ? weekSummary.hydration.tracked > 0
            : (legacyFormData?.hydrationTracked ?? false),
          vampireCompliancePct: hasLogData && weekSummary.vampire.daily.length > 0
            ? (weekSummary.vampire.compliant / weekSummary.vampire.daily.length) * 100
            : legacyFormData ? (legacyFormData.bedtimeCompliance / 7) * 100 : null,
          rugProtocolDays: hasLogData
            ? weekSummary.rug_protocol.done
            : (legacyFormData?.rugProtocolDays ?? null),
          sessionsPlanned: hasLogData
            ? weekSummary.workouts.planned
            : (legacyFormData?.sessionsPlanned ?? null),
          sessionsCompleted: hasLogData
            ? weekSummary.workouts.completed
            : (legacyFormData?.sessionsCompleted ?? null),
          pullupCount: null,
          perceivedReadiness,
          planSatisfaction,
          modelUsed: modelName,
          // New daily-log-derived fields
          kitchenCutoffCompliance: hasLogData ? weekSummary.kitchen_cutoff.hit : null,
          avgEnergy: hasLogData && weekSummary.energy_levels.length > 0
            ? Math.round(
                (weekSummary.energy_levels.reduce((s, e) => s + e.level, 0) /
                  weekSummary.energy_levels.length) * 10
              ) / 10
            : null,
          painDays: hasLogData ? weekSummary.pain_days.length : null,
          sleepDisruptionCount: hasLogData ? weekSummary.sleep_disruptions.length : null,
          avgRpe,
          hardExerciseCount: rpeCount > 0 ? hardCount : null,
          weekReflection: subjectiveData?.weekReflection ?? null,
          nextWeekConflicts: subjectiveData?.nextWeekConflicts ?? null,
          questionsForCoaches: subjectiveData?.questionsForCoaches ?? null,
          sickDays: sickDayCount,
          painAreasSummary,
          sleepDisruptionBreakdown,
        };
        upsertWeeklyMetrics(metrics);

        // Save ceiling history (snapshot belongs to the current training week)
        const ceilingEntries: CeilingEntry[] = Object.entries(ceilings.ceilings)
          .filter(([, v]) => typeof v === 'number')
          .map(([exercise, weight]) => ({
            weekNumber: currentWeek,
            date: today,
            exercise,
            weightKg: weight as number,
          }));
        if (ceilingEntries.length > 0) {
          insertCeilingHistory(ceilingEntries);
        }

        // Keep ceilings.json week in sync for external tools
        ceilings.week = currentWeek;
        ceilings.last_updated = today;
        writeCeilings(ceilings);

        send('synthesis_complete', {
          fullText: fullSynthesis,
          weekNumber: currentWeek,
          planItemCount,
          violations: violations.map(v => ({ rule: v.rule, session: v.sessionFocus, message: v.message })),
        });
        send('status', { phase: 'done', message: 'Check-in complete' });
      } catch (error) {
        send('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
