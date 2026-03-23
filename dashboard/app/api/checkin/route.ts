import { NextResponse } from 'next/server';
import { readGarminData, extractExtendedSummary } from '@/lib/garmin';
import { buildSharedContext, runSpecialistsSequentially, streamHeadCoachSynthesis } from '@/lib/agents';
import { writeWeeklyLog, appendTrainingHistory, readCeilings, writeCeilings } from '@/lib/state';
import { getPlanWeekNumber, getTrainingWeek } from '@/lib/week';
import { parseScheduleTable } from '@/lib/parse-schedule';
import { computeWeekSummary } from '@/lib/daily-log';
import {
  upsertWeeklyMetrics,
  insertPlanItems,
  insertCeilingHistory,
  deletePlanItems,
} from '@/lib/db';
import type { CheckInFormData, CheckinSubjectiveData, WeeklyMetrics, CeilingEntry } from '@/lib/types';
import { isNewFormatPayload } from '@/lib/types';
import type { TriageAnswer } from '@/lib/triage-agent';

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

        send('status', { phase: 'synthesis', message: 'Head Coach synthesizing...' });

        // Phase 2: Stream Head Coach synthesis
        let fullSynthesis = '';
        for await (const chunk of streamHeadCoachSynthesis(
          specialistOutputs,
          sharedContext,
          model
        )) {
          fullSynthesis += chunk;
          send('synthesis_chunk', { text: chunk });
        }

        // Phase 3: Persist everything
        send('status', { phase: 'saving', message: 'Saving state...' });

        const today = new Date().toISOString().split('T')[0];
        const ceilings = readCeilings();
        const weekNumber = getPlanWeekNumber();

        // Build weekly log content
        const specialistSection = specialistOutputs
          .map((o) => `## ${o.label}\n${o.error ? `**ERROR:** ${o.error}` : o.content}`)
          .join('\n\n');
        const logContent = `# Week ${weekNumber} Check-In — ${today}\n\n${specialistSection}\n\n## Head Coach Synthesis\n${fullSynthesis}`;

        // Write weekly log file
        writeWeeklyLog(weekNumber, today, logContent);

        // Append to training history
        appendTrainingHistory(`## Week ${weekNumber} — ${today}\n\nCheck-in completed. See weekly_logs/ for full details.`);

        // Parse schedule table and save plan items
        const planItems = parseScheduleTable(fullSynthesis, weekNumber);
        if (planItems.length > 0) {
          deletePlanItems(weekNumber); // Clear any existing items for this week
          insertPlanItems(planItems);
        }

        // Extract Garmin summary for metrics
        const garminSummary = garmin.data ? extractExtendedSummary(garmin.data) : null;

        // Build weekly metrics — auto-calculate from daily logs when possible
        const currentWeek = getTrainingWeek();
        const weekSummary = computeWeekSummary(currentWeek);
        const hasLogData = weekSummary.days_logged > 0;

        const modelName = model === 'opus' ? 'opus' : model === 'mixed' ? 'mixed' : 'sonnet';

        // Resolve subjective fields from whichever format was used
        const perceivedReadiness = subjectiveData?.perceivedReadiness
          ?? legacyFormData?.perceivedReadiness ?? null;
        const planSatisfaction = subjectiveData?.planSatisfaction
          ?? legacyFormData?.planSatisfaction ?? null;

        const metrics: WeeklyMetrics = {
          weekNumber,
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
          bakerCystPain: legacyFormData?.bakerCystPain ?? null,
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
        };
        upsertWeeklyMetrics(metrics);

        // Save ceiling history
        const ceilingEntries: CeilingEntry[] = Object.entries(ceilings.ceilings)
          .filter(([, v]) => typeof v === 'number')
          .map(([exercise, weight]) => ({
            weekNumber,
            date: today,
            exercise,
            weightKg: weight as number,
          }));
        if (ceilingEntries.length > 0) {
          insertCeilingHistory(ceilingEntries);
        }

        // Keep ceilings.json week in sync for external tools
        ceilings.week = weekNumber;
        ceilings.last_updated = today;
        writeCeilings(ceilings);

        send('synthesis_complete', {
          fullText: fullSynthesis,
          weekNumber,
          planItemCount: planItems.length,
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
