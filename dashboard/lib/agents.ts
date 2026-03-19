import Anthropic from '@anthropic-ai/sdk';
import { readAgentPersona, readAthleteProfile, readTrainingHistory, readCeilings, readPeriodization, readDecisionsLog, readDexaScans } from './state';
import { SPECIALIST_IDS, AGENT_LABELS, DEFAULT_MODEL, OPUS_MODEL } from './constants';
import type { GarminData, CheckInFormData, AgentOutput } from './types';
import { formatHevySummary, parseHevyCsv } from './parse-hevy';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to dashboard/.env.local');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

function resolveModel(model: CheckInFormData['model'], isHeadCoach = false): string {
  if (model === 'opus') return OPUS_MODEL;
  if (model === 'mixed') return isHeadCoach ? OPUS_MODEL : DEFAULT_MODEL;
  return DEFAULT_MODEL;
}

export function buildSharedContext(
  garminData: GarminData | null,
  formData: CheckInFormData
): string {
  const profile = readAthleteProfile();
  const history = readTrainingHistory(4);
  const ceilings = readCeilings();
  const periodization = readPeriodization();
  const decisions = readDecisionsLog();

  const hevyExercises = parseHevyCsv(formData.hevyCsv);
  const hevySummary = formatHevySummary(hevyExercises.data);

  let context = `# Weekly Check-In Data\n\n`;

  context += `## Athlete Plan Feedback (PRIORITY — Read First)\n`;
  context += `- Plan satisfaction: ${formData.planSatisfaction}/5 (1=too light, 3=right, 5=too much)\n`;
  context += `- Feedback: ${formData.planFeedback || 'None provided'}\n`;
  context += `**Instruction:** The athlete's subjective experience of last week's plan is a primary input. If satisfaction ≤2 (too light), do not reduce volume further unless injury or combined readiness <35 demands it. If satisfaction ≥4 (too much), consider reducing. If combined readiness <35 triggered a deload and feedback says "too light," the deload is working as designed — maintain it. If the athlete consistently reports extreme values that contradict objective data, flag the discrepancy rather than blindly adjusting. Address this feedback explicitly in your assessment.\n\n`;

  context += `## Athlete Profile\n${profile}\n\n`;
  context += `## Current Phase & Periodization\n${periodization}\n\n`;
  context += `## Active Decisions & Gates\n${decisions}\n\n`;
  context += `## Current Working Ceilings\n\`\`\`json\n${JSON.stringify(ceilings, null, 2)}\n\`\`\`\n\n`;
  context += `## Training History (Last 4 Weeks)\n${history}\n\n`;

  if (garminData) {
    context += `## Garmin Data Export\n\`\`\`json\n${JSON.stringify(garminData, null, 2)}\n\`\`\`\n\n`;
  } else {
    context += `## Garmin Data\nNo Garmin data available this week.\n\n`;
  }

  // Compute Combined Readiness Score (60% subjective, 40% Garmin weekly avg)
  let combinedReadinessSection = `## Combined Readiness Score (USE THIS FOR WEEKLY PLANNING)\n`;
  const perceivedNormalized = (formData.perceivedReadiness / 5) * 100; // Scale 1-5 → 20-100
  let garminAvgReadiness: number | null = null;
  if (garminData?.performance_stats?.training_readiness?.daily) {
    const scores = garminData.performance_stats.training_readiness.daily
      .map((d: { score?: number }) => d.score)
      .filter((s): s is number => s != null);
    if (scores.length > 0) {
      garminAvgReadiness = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
    }
  }
  if (garminAvgReadiness !== null) {
    const combined = Math.round(perceivedNormalized * 0.6 + garminAvgReadiness * 0.4);
    combinedReadinessSection += `- Athlete perceived readiness: ${formData.perceivedReadiness}/5 (normalized: ${Math.round(perceivedNormalized)})\n`;
    combinedReadinessSection += `- Garmin weekly avg readiness: ${garminAvgReadiness} (from ${garminData!.performance_stats.training_readiness!.daily.length} days)\n`;
    combinedReadinessSection += `- **Combined score: ${combined}** (60% subjective + 40% Garmin)\n`;
    combinedReadinessSection += `**Decision matrix (use combined score, NOT single-day minimums):**\n`;
    combinedReadinessSection += `- >50: Train as programmed\n`;
    combinedReadinessSection += `- 35-50: Reduce volume 20%, maintain intensity (THIS IS THE DAD BASELINE — expected for a parent of 2 with baby #3 incoming)\n`;
    combinedReadinessSection += `- <35: Deload — Zone 2 flush + mobility only\n`;
    combinedReadinessSection += `- <20: Rest day. No negotiation.\n`;
    combinedReadinessSection += `**CRITICAL:** Use the WEEKLY AVERAGE for weekly plan design. Individual daily scores (including outlier lows) are for same-day session adjustments ONLY — they do not drive the entire week's programming.\n`;
  } else {
    combinedReadinessSection += `- Athlete perceived readiness: ${formData.perceivedReadiness}/5\n`;
    combinedReadinessSection += `- Garmin readiness: No data available\n`;
    combinedReadinessSection += `- Using perceived readiness only. Scale: 1-2 = deload, 3 = normal, 4-5 = push.\n`;
  }
  context += combinedReadinessSection + `\n`;

  context += `## Hevy Training Log\n${hevySummary}\n\n`;

  if (formData.hevyCsv.trim()) {
    context += `### Raw Hevy CSV\n\`\`\`csv\n${formData.hevyCsv}\n\`\`\`\n\n`;
  }

  // DEXA Scan Data & Garmin Calibration
  const dexaData = readDexaScans();
  if (dexaData.scans.length > 0) {
    context += `## DEXA Scan Data & Garmin Calibration\n`;
    const latest = dexaData.scans[dexaData.scans.length - 1];
    context += `**Latest scan:** #${latest.scanNumber} on ${latest.date} (${latest.phase})\n`;
    context += `- DEXA body fat: ${latest.totalBodyFatPct}% | Lean mass: ${latest.totalLeanMassKg}kg | Fat mass: ${latest.fatMassKg}kg\n`;
    context += `- Bone mineral density: ${latest.boneMineralDensityGcm2} g/cm² | Bone mass: ${latest.boneMassKg}kg\n`;
    context += `- Weight at scan: ${latest.weightAtScanKg}kg\n`;
    if (latest.garminBodyFatPct != null) {
      context += `- Garmin nearest reading (${latest.garminReadingDate}): BF ${latest.garminBodyFatPct}%, muscle ${latest.garminMuscleMassKg}kg, weight ${latest.garminWeightKg}kg\n`;
    }
    if (latest.garminBodyFatPct != null) {
      context += `- **Calibration offsets:** Garmin BF ${latest.calibration.bodyFatOffsetPct > 0 ? 'underreads' : 'overreads'} by ${Math.abs(latest.calibration.bodyFatOffsetPct).toFixed(1)}% | Lean mass delta: ${latest.calibration.leanMassOffsetKg > 0 ? '+' : ''}${latest.calibration.leanMassOffsetKg.toFixed(1)}kg\n`;
    } else {
      context += `- **Calibration:** No Garmin body composition reading available near scan date — offsets not calculated\n`;
    }

    // DEXA-corrected current-week Garmin BF%
    if (garminData?.health_stats_7d?.body_composition?.daily) {
      const latestGarminBF = garminData.health_stats_7d.body_composition.daily
        .filter((d) => d.body_fat_pct != null && d.body_fat_pct > 0)
        .pop();
      if (latestGarminBF?.body_fat_pct) {
        const corrected = Math.round((latestGarminBF.body_fat_pct + latest.calibration.bodyFatOffsetPct) * 10) / 10;
        context += `- **DEXA-corrected current Garmin BF%:** ${corrected}% (Garmin raw: ${latestGarminBF.body_fat_pct}% + offset ${latest.calibration.bodyFatOffsetPct > 0 ? '+' : ''}${latest.calibration.bodyFatOffsetPct}%)\n`;
      }
    }

    // Scan history
    if (dexaData.scans.length > 1) {
      context += `- Scan history: ${dexaData.scans.map((s) => `#${s.scanNumber} (${s.date}): BF ${s.totalBodyFatPct}%, lean ${s.totalLeanMassKg}kg`).join(' | ')}\n`;
    }

    // Next scan reminder
    const scanCount = dexaData.scans.length;
    if (scanCount < 3) {
      const nextDates = ['November 2026', 'May 2027'];
      context += `- **Next DEXA scan:** #${scanCount + 1} planned for ${nextDates[scanCount - 1] || 'TBD'}\n`;
    }
    context += `\n`;
  }

  context += `## Subjective Check-In\n`;
  context += `- Baker's Cyst pain: ${formData.bakerCystPain}/10\n`;
  context += `- Lower back fatigue: ${formData.lowerBackFatigue}/10\n`;
  context += `- Perceived readiness: ${formData.perceivedReadiness}/5 (1=wrecked, 3=normal, 5=peaked)\n`;
  context += `- Sessions completed: ${formData.sessionsCompleted} / ${formData.sessionsPlanned} planned\n`;
  context += `- Missed sessions: ${formData.missedSessions || 'None reported'}\n`;
  context += `- Strength wins: ${formData.strengthWins || 'None reported'}\n`;
  context += `- Struggles: ${formData.struggles || 'None reported'}\n`;
  context += `- Bedtime compliance (nights before 23:00): ${formData.bedtimeCompliance}/7\n`;
  context += `- Rug Protocol days: ${formData.rugProtocolDays}/7\n`;
  context += `- Hydration tracked: ${formData.hydrationTracked ? 'Yes' : 'No'}\n`;
  context += `- Upcoming conflicts: ${formData.upcomingConflicts || 'None'}\n`;
  context += `- Focus for next week: ${formData.focusNextWeek || 'Not specified'}\n`;
  context += `- Questions for coaches: ${formData.questionsForCoaches || 'None'}\n`;

  return context;
}

export async function runSpecialist(
  agentId: string,
  sharedContext: string,
  model: string
): Promise<AgentOutput> {
  const client = getClient();
  const persona = readAgentPersona(agentId);
  const label = AGENT_LABELS[agentId] || agentId;

  if (!persona) {
    return {
      agentId,
      label,
      content: '',
      model,
      error: `Persona file not found for agent: ${agentId}`,
    };
  }

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: persona,
      messages: [
        {
          role: 'user',
          content: `Analyze this weekly check-in data from your domain expertise. Provide your specialist assessment, flag any concerns, and make specific recommendations for next week's plan.\n\n${sharedContext}`,
        },
      ],
    });

    const content = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.type === 'text' ? b.text : '')
      .join('\n');

    return {
      agentId,
      label,
      content,
      model,
      tokensUsed: response.usage?.output_tokens,
    };
  } catch (error) {
    return {
      agentId,
      label,
      content: '',
      model,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run specialists sequentially to avoid rate limits on Claude Pro accounts.
 * Yields each result as it completes so the UI can show real-time progress.
 */
export async function* runSpecialistsSequentially(
  sharedContext: string,
  model: CheckInFormData['model']
): AsyncGenerator<AgentOutput> {
  getClient();
  const resolvedModel = resolveModel(model, false);

  for (const id of SPECIALIST_IDS) {
    yield await runSpecialist(id, sharedContext, resolvedModel);
  }
}

export function buildSynthesisPrompt(
  specialistOutputs: AgentOutput[],
  sharedContext: string
): string {
  let prompt = `# Head Coach Synthesis\n\n`;
  prompt += `You have received analyses from all 7 specialist agents. Review their assessments, resolve any conflicts using the priority hierarchy, and produce the unified weekly plan.\n\n`;

  for (const output of specialistOutputs) {
    prompt += `## ${output.label} Assessment\n`;
    if (output.error) {
      prompt += `**ERROR:** ${output.error} — This agent failed. Note the gap in analysis.\n\n`;
    } else {
      prompt += `${output.content}\n\n`;
    }
  }

  prompt += `## Original Check-In Data\n${sharedContext}\n\n`;

  prompt += `## Athlete Plan Feedback (Reminder)\n`;
  prompt += `- Satisfaction: ${specialistOutputs.length > 0 ? 'See shared context above' : 'N/A'}\n`;
  prompt += `When athlete feedback conflicts with specialist recommendations, apply the priority hierarchy. Athlete feedback ranks at #3 — above race-specific preparation but below recovery (#2) and injury prevention (#1). Show the debate.\n\n`;

  prompt += `## Required Output Format\n`;
  prompt += `1. Start with your synthesis — resolve conflicts between agents with transparency\n`;
  prompt += `2. Show the inter-agent debate where relevant (quote which agents disagree and why)\n`;
  prompt += `3. Address the athlete's plan feedback directly. If satisfaction was ≤2 or ≥4, explain what changes you're making in response and why. Never ignore this input.\n`;
  prompt += `4. End with the weekly schedule as a pipe-separated Markdown table:\n\n`;
  prompt += `| Done? | Day | Session Type | Focus | Est. Starting Weight (Hevy) | Detailed Workout Plan | Coach's Cues & Mobility | My Notes |\n`;
  prompt += `|-------|-----|-------------|-------|----------------------------|----------------------|------------------------|----------|\n\n`;
  prompt += `5. Include all 7 days. Mark rest days and Family Day.\n`;
  prompt += `6. End with your mandated closing phrase.\n`;

  prompt += `\n### Workout Plan Cell Format (CRITICAL)\n`;
  prompt += `Use standard gym notation with letter-number labels:\n`;
  prompt += `- Same letter = done together (superset/tri-set), different letter = sequential\n`;
  prompt += `- Standalone exercises use letter + 1 (e.g., C1:)\n`;
  prompt += `- Exercise format: [Label]: [Exercise]: [weight] x[reps]\n`;
  prompt += `- Round/rest info in square brackets on own line after the group: [3 rounds, 90s rest]\n`;
  prompt += `- Warm-up and cool-down: section headers with dash-prefix exercises\n`;
  prompt += `- Cardio finishers: use a section header (e.g., Finisher:) with dash-prefix lines\n`;
  prompt += `- One exercise per line. No free-form section headers.\n`;
  prompt += `- Do NOT use "Superset A (3 rounds, 90s rest):" or "Pull-Up Bar Block:" headers\n`;
  prompt += `- Do NOT use **bold** markdown or • bullets\n`;
  prompt += `- Do NOT use period-separated lists on a single line\n\n`;
  prompt += `### Equipment Rules (TrainMore — Busy Commercial Gym)\n`;
  prompt += `Supersets: athlete holds ONE machine at a time. Pair machine + portable/bodyweight. Never pair two machines.\n`;
  prompt += `- INVALID: Lat Pulldown + Cable Row, Chest Press + Seated Row, Leg Press + Hamstring Curl\n`;
  prompt += `- Pull-Up Bar Zone: pull-up bar is in the barbell/free weight area, NOT near cable machines. NEVER superset pull-up bar exercises with cable machines (e.g., Lat Pulldown + Pull-ups is INVALID).\n`;
  prompt += `- Circuits: only exercise #1 may use a stationary machine. All others portable/bodyweight. Cable machines never mid-circuit.\n`;
  prompt += `- No "or" between exercises. Pick ONE variation. Conditionals go on separate IF line.\n`;
  prompt += `- Every loaded exercise shows weight. No exceptions.\n\n`;
  prompt += `### Session Design Rules\n`;
  prompt += `- Session duration: 50-60 minutes max (excluding warm-up and mobility). If over, cut accessory sets first — NEVER cut core stability or pull-up progression.\n`;
  prompt += `- Each exercise appears ONCE per session. If it serves multiple goals, combine volume in one block. Do not repeat exercises across warm-up and main work.\n`;
  prompt += `- Weekend rule: Sunday is the default TRAINING day. Saturday is FAMILY DAY (no gym). Only the athlete can swap this.\n`;
  prompt += `- Sunday ruck: outdoor only (woods, parks, trails) with Vizsla. No gym visits, no gym equipment, no monkey bars or dead hangs. Gym-dependent exercises go on weekday sessions.\n\n`;
  prompt += `Example cell:\n`;
  prompt += `Warm-up:\n- 5min bike Zone 2\n\nA1: Goblet Squat: 28kg x10\nA2: Hamstring Curl: 45kg x12\n[3 rounds, 90s rest]\n\nB1: Lat Pulldown: 45kg x12\nB2: Band Pull-aparts: x20\n[3 rounds, 90s rest]\n\nC1: Cable Row: 50kg x12\n[3 sets, 90s rest]\n\nFinisher:\n- 20min StairMaster Zone 4 intervals\n\n`;

  return prompt;
}

export async function* streamHeadCoachSynthesis(
  specialistOutputs: AgentOutput[],
  sharedContext: string,
  model: CheckInFormData['model']
): AsyncGenerator<string> {
  const client = getClient();
  const persona = readAgentPersona('head_coach');
  const resolvedModel = resolveModel(model, true);
  const synthesisPrompt = buildSynthesisPrompt(specialistOutputs, sharedContext);

  const stream = client.messages.stream({
    model: resolvedModel,
    max_tokens: 4000,
    system: persona || undefined,
    messages: [
      {
        role: 'user',
        content: synthesisPrompt,
      },
    ],
  });

  // Use the SDK's text event handler via async iteration
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      'delta' in event &&
      event.delta.type === 'text_delta' &&
      'text' in event.delta
    ) {
      yield event.delta.text;
    }
  }
}
