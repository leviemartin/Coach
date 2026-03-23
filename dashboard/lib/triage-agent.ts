import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_MODEL } from './constants';
import type { WeeklyReviewData } from '@/app/api/checkin/review/route';
import type { CheckinSubjectiveData } from './types';

export interface TriageQuestion {
  topic: string;
  question: string;
}

export interface TriageAnswer {
  topic: string;
  status: string;
  context: string;
  routing_hint: 'injury' | 'recovery' | 'training' | 'compliance' | 'nutrition' | 'general';
}

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

const SYSTEM_PROMPT = `You are the Triage Agent for a Spartan OCR athlete's weekly check-in system.

Your job is to scan this week's data and surface 3–5 targeted clarification questions that will help the coaching team give better advice. You are NOT providing coaching analysis yet — you are doing pre-flight data quality checks.

Scan for:
1. Missing log entries (e.g. "You completed N sessions but only logged X of 7 days")
2. Ambiguous notes (e.g. "Wednesday note says 'shoulder felt off' — is this still an issue?")
3. Contradictions (e.g. "Pain level reported but heavy session completed — intentional?")
4. Unusual patterns (e.g. "Energy was 1–2 for three consecutive days — anything specific going on?")
5. Protocol compliance gaps (e.g. bedtime compliance of 0/7 — what happened?)
6. Missing context that would change coaching decisions

Rules:
- Generate between 3 and 5 questions. Never more, never fewer.
- Each question must be specific to the data, not generic.
- Questions should be short, direct, and conversational.
- Do not ask about things that are clearly explained already.
- Do not ask overlapping questions — each should cover a distinct topic.

Respond ONLY with a JSON array. No preamble, no explanation, no markdown fencing. Raw JSON only.

Format:
[
  { "topic": "short_topic_slug", "question": "The question to ask the athlete." },
  ...
]

Valid topic slugs: missing_logs, injury_pain, sleep_compliance, training_load, nutrition, hydration, energy_pattern, protocol_compliance, contradiction, other`;

export function buildTriagePrompt(
  reviewData: WeeklyReviewData,
  subjectiveData: CheckinSubjectiveData
): string {
  const lines: string[] = [];

  lines.push(`## Weekly Data Summary — Week ${reviewData.weekNumber}`);
  lines.push('');

  // Daily logs
  const { compliance } = reviewData;
  lines.push(`### Daily Logs`);
  lines.push(`Days logged: ${compliance.days_logged} / 7`);
  if (compliance.days_logged > 0 && compliance.energy_levels.length > 0) {
    const energyAvg =
      compliance.energy_levels.reduce((s, e) => s + e.level, 0) / compliance.energy_levels.length;
    lines.push(`Average energy: ${energyAvg.toFixed(1)} / 5`);
  }
  if (compliance.sick_days > 0) {
    lines.push(`Sick days: ${compliance.sick_days}`);
  }
  if (compliance.pain_days.length > 0) {
    lines.push(`Pain days: ${compliance.pain_days.length} (${compliance.pain_days.map((p) => `${p.date} level ${p.level}${p.area ? ' [' + p.area + ']' : ''}`).join(', ')})`);
  }
  lines.push('');

  // Daily log detail
  if (reviewData.dailyLogs.length > 0) {
    lines.push('### Daily Log Detail');
    for (const log of reviewData.dailyLogs) {
      const energyStr = log.energy_level != null ? `energy ${log.energy_level}/5` : 'energy N/A';
      const painStr = log.pain_level != null ? ` | pain ${log.pain_level}/10${log.pain_area ? ' [' + log.pain_area + ']' : ''}` : '';
      const noteStr = log.notes ? ` | note: "${log.notes}"` : '';
      const bedtimeStr = log.vampire_bedtime ? ` | bed ${log.vampire_bedtime}` : '';
      lines.push(`- ${log.date}: ${energyStr}${painStr}${bedtimeStr}${noteStr}`);
    }
    lines.push('');
  } else {
    lines.push('### Daily Log Detail');
    lines.push('No daily logs recorded this week.');
    lines.push('');
  }

  // Sessions
  lines.push('### Completed Sessions');
  if (reviewData.sessions.length > 0) {
    for (const s of reviewData.sessions) {
      const compPct = s.compliancePct != null ? ` (${s.compliancePct}% compliance)` : '';
      lines.push(`- ${s.date}: ${s.sessionTitle} [${s.sessionType}]${compPct}`);
    }
  } else {
    lines.push('No sessions logged.');
  }
  lines.push('');

  // Garmin freshness
  lines.push('### Garmin Data');
  lines.push(
    `Status: ${reviewData.garmin.status} | Age: ${reviewData.garmin.ageHours}h | Has data: ${reviewData.garmin.hasData}`
  );
  lines.push('');

  // Subjective inputs
  lines.push('### Athlete Subjective Inputs');
  lines.push(
    `Perceived readiness: ${subjectiveData.perceivedReadiness}/5 (0=not set, 1=wrecked, 3=normal, 5=peaked)`
  );
  lines.push(
    `Plan satisfaction: ${subjectiveData.planSatisfaction}/5 (0=not set, 1=too light, 3=just right, 5=too much)`
  );
  if (subjectiveData.weekReflection) {
    lines.push(`Week reflection: "${subjectiveData.weekReflection}"`);
  }
  if (subjectiveData.nextWeekConflicts) {
    lines.push(`Next week conflicts: "${subjectiveData.nextWeekConflicts}"`);
  }
  if (subjectiveData.questionsForCoaches) {
    lines.push(`Questions for coaches: "${subjectiveData.questionsForCoaches}"`);
  }

  return lines.join('\n');
}

export async function generateTriageQuestions(
  reviewData: WeeklyReviewData,
  subjectiveData: CheckinSubjectiveData
): Promise<TriageQuestion[]> {
  const client = getClient();
  const userPrompt = buildTriagePrompt(reviewData, subjectiveData);

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('');

  // Strip any accidental markdown fencing
  const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  const parsed = JSON.parse(cleaned) as TriageQuestion[];

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Triage agent returned an empty or invalid question list');
  }

  const valid = parsed.filter(
    (q): q is TriageQuestion =>
      typeof q === 'object' && q !== null &&
      typeof q.topic === 'string' &&
      typeof q.question === 'string'
  );
  if (valid.length === 0) {
    throw new Error('Triage agent returned questions with invalid structure');
  }
  return valid.slice(0, 5);
}
