import { NextResponse } from 'next/server';
import { readGarminData, extractGarminSummary } from '@/lib/garmin';
import { buildSharedContext, runSpecialistsSequentially, streamHeadCoachSynthesis } from '@/lib/agents';
import { writeWeeklyLog, appendTrainingHistory, readCeilings } from '@/lib/state';
import { parseScheduleTable } from '@/lib/parse-schedule';
import {
  upsertWeeklyMetrics,
  insertPlanItems,
  insertCeilingHistory,
  deletePlanItems,
} from '@/lib/db';
import type { CheckInFormData, WeeklyMetrics, CeilingEntry } from '@/lib/types';

export const maxDuration = 300; // 5 minutes for full agent pipeline

export async function POST(request: Request) {
  // Validate API key early
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set. Add it to dashboard/.env.local' },
      { status: 500 }
    );
  }

  let formData: CheckInFormData;
  try {
    formData = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const garmin = readGarminData();
  const sharedContext = buildSharedContext(garmin.data, formData);

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

      try {
        // Phase 1: Run 7 specialists sequentially (avoids rate limits on Pro accounts)
        send('status', { phase: 'specialists', message: 'Running specialist analyses...' });

        const specialistOutputs = [];
        for await (const output of runSpecialistsSequentially(sharedContext, formData.model)) {
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
          formData.model
        )) {
          fullSynthesis += chunk;
          send('synthesis_chunk', { text: chunk });
        }

        // Phase 3: Persist everything
        send('status', { phase: 'saving', message: 'Saving state...' });

        const today = new Date().toISOString().split('T')[0];
        const ceilings = readCeilings();
        const weekNumber = ceilings.week || 10;

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
        const garminSummary = garmin.data ? extractGarminSummary(garmin.data) : null;

        // Save weekly metrics to SQLite
        const modelName = formData.model === 'opus' ? 'opus' : formData.model === 'mixed' ? 'mixed' : 'sonnet';
        const metrics: WeeklyMetrics = {
          weekNumber,
          checkInDate: today,
          weightKg: garminSummary?.weight ?? null,
          bodyFatPct: garminSummary?.bodyFat ?? null,
          muscleMassKg: garminSummary?.muscleMass ?? null,
          avgSleepScore: garminSummary?.avgSleep ?? null,
          avgTrainingReadiness: garminSummary?.avgReadiness ?? null,
          avgRhr: garminSummary?.avgRhr ?? null,
          avgHrv: null, // Not extracted in current summary
          caloriesAvg: null, // Would need nutrition data parsing
          proteinAvg: null,
          hydrationTracked: formData.hydrationTracked,
          vampireCompliancePct: (formData.bedtimeCompliance / 7) * 100,
          rugProtocolDays: formData.rugProtocolDays,
          sessionsPlanned: formData.sessionsPlanned,
          sessionsCompleted: formData.sessionsCompleted,
          bakerCystPain: formData.bakerCystPain,
          pullupCount: null, // Extracted from Hevy data if available
          modelUsed: modelName,
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
