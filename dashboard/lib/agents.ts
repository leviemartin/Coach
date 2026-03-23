import Anthropic from '@anthropic-ai/sdk';
import { readAgentPersona, readAthleteProfile, readTrainingHistory, readCeilings, readPeriodization, readDecisionsLog, readDexaScans } from './state';
import { buildTieredHistory } from './tiered-history';
import { SPECIALIST_IDS, AGENT_LABELS, DEFAULT_MODEL, OPUS_MODEL } from './constants';
import type { GarminData, CheckInFormData, CheckinSubjectiveData, AgentOutput } from './types';
import { formatHevySummary, parseHevyCsv } from './parse-hevy';
import { computeWeekSummary, getDayAbbrev, formatWeekSummaryForAgents } from './daily-log';
import { getTrainingWeek } from './week';
import { getDailyLogsByWeek, getWeekNotes } from './db';
import type { DailyLog, DailyNote } from './db';
import { getWeekSessions } from './session-db';
import { isBedtimeCompliant, fromBedtimeStorage } from './daily-log';
import type { TriageAnswer } from './triage-agent';

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to dashboard/.env.local');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

type ModelChoice = 'sonnet' | 'opus' | 'mixed';

function resolveModel(model: ModelChoice, isHeadCoach = false): string {
  if (model === 'opus') return OPUS_MODEL;
  if (model === 'mixed') return isHeadCoach ? OPUS_MODEL : DEFAULT_MODEL;
  return DEFAULT_MODEL;
}

// ── Legacy overload for backward compatibility ──────────────────────────────
export function buildSharedContext(
  garminData: GarminData | null,
  formData: CheckInFormData
): string;
// ── New structured overload ─────────────────────────────────────────────────
export function buildSharedContext(
  garminData: GarminData | null,
  subjectiveData: CheckinSubjectiveData,
  triageClarifications?: TriageAnswer[],
  annotation?: string
): string;
// ── Implementation ──────────────────────────────────────────────────────────
export function buildSharedContext(
  garminData: GarminData | null,
  dataArg: CheckInFormData | CheckinSubjectiveData,
  triageClarifications?: TriageAnswer[],
  annotation?: string
): string {
  // Detect legacy vs new format: CheckInFormData has 'hevyCsv'; use shared type guard on wrapped form
  const isLegacy = 'hevyCsv' in dataArg;
  if (isLegacy) {
    return buildSharedContextLegacy(garminData, dataArg as CheckInFormData);
  }
  return buildSharedContextStructured(garminData, dataArg as CheckinSubjectiveData, triageClarifications, annotation);
}

// ── Legacy path (unchanged logic from before) ───────────────────────────────
function buildSharedContextLegacy(
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

  context += buildCombinedReadinessSection(formData.perceivedReadiness, garminData);

  context += `## Hevy Training Log\n${hevySummary}\n\n`;

  // Daily Log Summary
  const currentWeek = getTrainingWeek();
  const weekSummary = computeWeekSummary(currentWeek);
  if (weekSummary.days_logged > 0) {
    context += formatWeekSummaryForAgents(weekSummary) + '\n';
  } else {
    context += '## Daily Log Summary\nNo daily logs recorded this week.\n\n';
  }

  if (formData.hevyCsv.trim()) {
    context += `### Raw Hevy CSV\n\`\`\`csv\n${formData.hevyCsv}\n\`\`\`\n\n`;
  }

  context += buildDexaSection(garminData);

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

// ── New structured path ─────────────────────────────────────────────────────
function buildSharedContextStructured(
  garminData: GarminData | null,
  subjectiveData: CheckinSubjectiveData,
  triageClarifications?: TriageAnswer[],
  annotation?: string
): string {
  const profile = readAthleteProfile();
  const ceilings = readCeilings();
  const periodization = readPeriodization();
  const decisions = readDecisionsLog();
  const currentWeek = getTrainingWeek();
  const tieredHistory = buildTieredHistory(currentWeek);

  let context = `# Weekly Check-In Data\n\n`;

  // ── Athlete Plan Feedback ─────────────────────────────────────────────────
  context += `## Athlete Plan Feedback (PRIORITY — Read First)\n`;
  context += `- Plan satisfaction: ${subjectiveData.planSatisfaction}/5 (1=too light, 3=right, 5=too much)\n`;
  context += `- Reflection: ${subjectiveData.weekReflection || 'None provided'}\n`;
  context += `**Instruction:** The athlete's subjective experience of last week's plan is a primary input. If satisfaction <=2 (too light), do not reduce volume further unless injury or combined readiness <35 demands it. If satisfaction >=4 (too much), consider reducing. If combined readiness <35 triggered a deload and feedback says "too light," the deload is working as designed — maintain it. Address this feedback explicitly in your assessment.\n\n`;

  // ── Reference Data ────────────────────────────────────────────────────────
  context += `## Athlete Profile\n${profile}\n\n`;
  context += `## Current Phase & Periodization\n${periodization}\n\n`;
  context += `## Active Decisions & Gates\n${decisions}\n\n`;
  context += `## Current Working Ceilings\n\`\`\`json\n${JSON.stringify(ceilings, null, 2)}\n\`\`\`\n\n`;
  context += `## Historical Context\n${tieredHistory.format()}\n`;

  // ── Garmin Data ───────────────────────────────────────────────────────────
  if (garminData) {
    context += `## Garmin Data Export\n\`\`\`json\n${JSON.stringify(garminData, null, 2)}\n\`\`\`\n\n`;
  } else {
    context += `## Garmin Data\nNo Garmin data available this week.\n\n`;
  }

  // ── Combined Readiness ────────────────────────────────────────────────────
  context += buildCombinedReadinessSection(subjectiveData.perceivedReadiness, garminData);

  // ── This Week's Data (structured tables) ──────────────────────────────────
  context += `## This Week's Data (Week ${currentWeek})\n\n`;

  // Daily Logs table
  const dailyLogs = getDailyLogsByWeek(currentWeek);
  context += buildDailyLogsTable(dailyLogs, currentWeek);

  // Session Details
  const sessions = getWeekSessions(currentWeek);
  context += buildSessionDetailsSection(sessions);

  // Tagged Notes
  const weekNotes = getWeekNotes(currentWeek);
  context += buildTaggedNotesSection(weekNotes, dailyLogs);

  // Triage Clarifications
  if (triageClarifications && triageClarifications.length > 0) {
    context += buildTriageClarificationsSection(triageClarifications);
  }

  // ── Subjective Inputs ─────────────────────────────────────────────────────
  context += `### Subjective Inputs\n`;
  context += `- Perceived readiness: ${subjectiveData.perceivedReadiness}/5\n`;
  context += `- Plan satisfaction: ${subjectiveData.planSatisfaction}/5\n`;
  context += `- Reflection: ${subjectiveData.weekReflection || 'None provided'}\n`;
  context += `- Next week conflicts: ${subjectiveData.nextWeekConflicts || 'None'}\n`;
  context += `- Questions: ${subjectiveData.questionsForCoaches || 'None'}\n`;
  if (annotation && annotation.length > 0) {
    context += `- Annotation: "${annotation}"\n`;
  }
  context += `\n`;

  // ── DEXA Data ─────────────────────────────────────────────────────────────
  context += buildDexaSection(garminData);

  return context;
}

// ── Shared helper: Combined Readiness Section ───────────────────────────────
function buildCombinedReadinessSection(
  perceivedReadiness: number,
  garminData: GarminData | null
): string {
  let section = `## Combined Readiness Score (USE THIS FOR WEEKLY PLANNING)\n`;
  const perceivedNormalized = (perceivedReadiness / 5) * 100;
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
    section += `- Athlete perceived readiness: ${perceivedReadiness}/5 (normalized: ${Math.round(perceivedNormalized)})\n`;
    section += `- Garmin weekly avg readiness: ${garminAvgReadiness} (from ${garminData!.performance_stats.training_readiness!.daily.length} days)\n`;
    section += `- **Combined score: ${combined}** (60% subjective + 40% Garmin)\n`;
    section += `**Decision matrix (use combined score, NOT single-day minimums):**\n`;
    section += `- >50: Train as programmed\n`;
    section += `- 35-50: Reduce volume 20%, maintain intensity (THIS IS THE DAD BASELINE — expected for a parent of 2 with baby #3 incoming)\n`;
    section += `- <35: Deload — Zone 2 flush + mobility only\n`;
    section += `- <20: Rest day. No negotiation.\n`;
    section += `**CRITICAL:** Use the WEEKLY AVERAGE for weekly plan design. Individual daily scores (including outlier lows) are for same-day session adjustments ONLY — they do not drive the entire week's programming.\n`;
  } else {
    section += `- Athlete perceived readiness: ${perceivedReadiness}/5\n`;
    section += `- Garmin readiness: No data available\n`;
    section += `- Using perceived readiness only. Scale: 1-2 = deload, 3 = normal, 4-5 = push.\n`;
  }
  return section + `\n`;
}

// ── Shared helper: Daily Logs Table ─────────────────────────────────────────
function buildDailyLogsTable(logs: DailyLog[], weekNumber: number): string {
  if (logs.length === 0) {
    return `### Daily Logs (7-day detail)\nNo daily logs recorded for week ${weekNumber}.\n\n`;
  }

  let table = `### Daily Logs (7-day detail)\n`;
  table += `| Day | Energy | Pain | Pain Area | Sleep Disruption | Bedtime | Compliant | Kitchen | Core | Mobility | Hydration | Session |\n`;
  table += `|-----|--------|------|-----------|-----------------|---------|-----------|---------|------|----------|-----------|---------|\n`;

  for (const log of logs) {
    const dayAbbr = getDayAbbrev(log.date);
    const energy = log.energy_level != null ? String(log.energy_level) : '-';
    const pain = log.pain_level != null ? String(log.pain_level) : '0';
    const painArea = log.pain_area || '-';
    const sleepDisrupt = log.sleep_disruption || '-';
    const bedtime = log.vampire_bedtime ? fromBedtimeStorage(log.vampire_bedtime) : '-';
    const compliant = log.vampire_bedtime ? (isBedtimeCompliant(log.vampire_bedtime) ? 'Y' : 'N') : '-';
    const kitchen = log.kitchen_cutoff_hit ? 'Y' : 'N';
    const core = log.core_work_done ? 'Y' : 'N';
    const rug = log.rug_protocol_done ? 'Y' : 'N';
    const hydration = log.hydration_tracked ? 'Y' : 'N';
    const session = log.session_summary || (log.workout_completed ? 'Completed' : '-');

    table += `| ${dayAbbr} | ${energy} | ${pain} | ${painArea} | ${sleepDisrupt} | ${bedtime} | ${compliant} | ${kitchen} | ${core} | ${rug} | ${hydration} | ${session} |\n`;
  }

  return table + `\n`;
}

// ── Shared helper: Session Details ──────────────────────────────────────────
function buildSessionDetailsSection(sessions: ReturnType<typeof getWeekSessions>): string {
  if (sessions.length === 0) {
    return `### Session Details\nNo completed sessions recorded this week.\n\n`;
  }

  let section = `### Session Details\n`;
  for (const s of sessions) {
    const complianceStr = s.compliancePct != null ? `${s.compliancePct}%` : 'N/A';
    section += `**${getDayAbbrev(s.date)} — ${s.sessionTitle}** (${s.sessionType}, compliance: ${complianceStr})\n`;

    // Summarize sets: group by exercise
    if (s.sets.length > 0) {
      const byExercise = new Map<string, typeof s.sets>();
      for (const set of s.sets) {
        const existing = byExercise.get(set.exerciseName) || [];
        existing.push(set);
        byExercise.set(set.exerciseName, existing);
      }
      for (const [name, sets] of byExercise) {
        const completedSets = sets.filter(st => st.completed);
        const totalSets = sets.length;
        const weightStr = sets[0].actualWeightKg != null
          ? `${sets[0].actualWeightKg}kg`
          : sets[0].prescribedWeightKg != null
            ? `${sets[0].prescribedWeightKg}kg (prescribed)`
            : 'BW';
        const modified = sets.some(st => st.isModified) ? ' [modified]' : '';
        section += `- ${name}: ${completedSets.length}/${totalSets} sets @ ${weightStr}${modified}\n`;
      }
    }

    // Summarize cardio
    if (s.cardio.length > 0) {
      for (const c of s.cardio) {
        const doneStr = c.completed ? 'done' : `${c.completedRounds}/${c.prescribedRounds ?? '?'} rounds`;
        section += `- ${c.exerciseName}: ${doneStr}\n`;
      }
    }
    section += `\n`;
  }

  return section;
}

// ── Shared helper: Tagged Notes ─────────────────────────────────────────────
function buildTaggedNotesSection(notes: (DailyNote & { date: string })[], _logs: DailyLog[]): string {
  // Only show tagged notes — legacy free-text notes have been migrated to tagged notes
  if (notes.length === 0) {
    return '';
  }

  let section = `### Tagged Notes\n`;
  for (const n of notes) {
    section += `${getDayAbbrev(n.date)} (${n.category}): "${n.text}"\n`;
  }
  return section + `\n`;
}

// ── Shared helper: Triage Clarifications ────────────────────────────────────
function buildTriageClarificationsSection(clarifications: TriageAnswer[]): string {
  let section = `### Triage Clarifications\n`;
  for (let i = 0; i < clarifications.length; i++) {
    const c = clarifications[i];
    section += `${i + 1}. Topic: ${c.topic} — Status: ${c.status} — Context: ${c.context} [${c.routing_hint}]\n`;
  }
  return section + `\n`;
}

// ── Shared helper: DEXA Section ─────────────────────────────────────────────
function buildDexaSection(garminData: GarminData | null): string {
  const dexaData = readDexaScans();
  if (dexaData.scans.length === 0) return '';

  let section = `## DEXA Scan Data & Garmin Calibration\n`;
  const latest = dexaData.scans[dexaData.scans.length - 1];
  section += `**Latest scan:** #${latest.scanNumber} on ${latest.date} (${latest.phase})\n`;
  section += `- DEXA body fat: ${latest.totalBodyFatPct}% | Lean mass: ${latest.totalLeanMassKg}kg | Fat mass: ${latest.fatMassKg}kg\n`;
  section += `- Bone mineral density: ${latest.boneMineralDensityGcm2} g/cm2 | Bone mass: ${latest.boneMassKg}kg\n`;
  section += `- Weight at scan: ${latest.weightAtScanKg}kg\n`;
  if (latest.garminBodyFatPct != null) {
    section += `- Garmin nearest reading (${latest.garminReadingDate}): BF ${latest.garminBodyFatPct}%, muscle ${latest.garminMuscleMassKg}kg, weight ${latest.garminWeightKg}kg\n`;
    section += `- **Calibration offsets:** Garmin BF ${latest.calibration.bodyFatOffsetPct > 0 ? 'underreads' : 'overreads'} by ${Math.abs(latest.calibration.bodyFatOffsetPct).toFixed(1)}% | Lean mass delta: ${latest.calibration.leanMassOffsetKg > 0 ? '+' : ''}${latest.calibration.leanMassOffsetKg.toFixed(1)}kg\n`;
  } else {
    section += `- **Calibration:** No Garmin body composition reading available near scan date — offsets not calculated\n`;
  }

  if (garminData?.health_stats_7d?.body_composition?.daily) {
    const latestGarminBF = garminData.health_stats_7d.body_composition.daily
      .filter((d) => d.body_fat_pct != null && d.body_fat_pct > 0)
      .pop();
    if (latestGarminBF?.body_fat_pct) {
      const corrected = Math.round((latestGarminBF.body_fat_pct + latest.calibration.bodyFatOffsetPct) * 10) / 10;
      section += `- **DEXA-corrected current Garmin BF%:** ${corrected}% (Garmin raw: ${latestGarminBF.body_fat_pct}% + offset ${latest.calibration.bodyFatOffsetPct > 0 ? '+' : ''}${latest.calibration.bodyFatOffsetPct}%)\n`;
    }
  }

  if (dexaData.scans.length > 1) {
    section += `- Scan history: ${dexaData.scans.map((s) => `#${s.scanNumber} (${s.date}): BF ${s.totalBodyFatPct}%, lean ${s.totalLeanMassKg}kg`).join(' | ')}\n`;
  }

  const scanCount = dexaData.scans.length;
  if (scanCount < 3) {
    const nextDates = ['November 2026', 'May 2027'];
    section += `- **Next DEXA scan:** #${scanCount + 1} planned for ${nextDates[scanCount - 1] || 'TBD'}\n`;
  }
  return section + `\n`;
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
  model: ModelChoice
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
  model: ModelChoice
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
