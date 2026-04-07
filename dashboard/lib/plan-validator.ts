import type { WeekPlan, SessionPlan, ExerciseItem } from './plan-schema';

// ── Types ─────────────────────────────────────────────────────────────────

export interface PlanViolation {
  rule: string;
  sessionIndex: number;
  sessionFocus: string;
  message: string;
}

// ── Exercise classification sets ──────────────────────────────────────────

const MACHINE_EXERCISES = new Set([
  'lat pulldown', 'cable row', 'seated row', 'chest press', 'chest fly machine',
  'leg press', 'hamstring curl', 'leg extension', 'leg curl', 'smith machine',
  'cable crossover', 'cable fly', 'cable lateral raise', 'cable curl',
  'cable tricep pushdown', 'cable tricep extension', 'cable face pull',
  'hip abduction', 'hip adduction', 'calf raise machine', 'hack squat',
  'pec deck', 'shoulder press machine', 'assisted dip machine', 'assisted pull-up machine',
]);

const PULLUP_BAR_EXERCISES = new Set([
  'pull-up', 'pull-ups', 'chin-up', 'chin-ups',
  'negative pull-up', 'negative pull-ups',
  'dead hang', 'hanging knee raise', 'hanging leg raise', 'toes to bar',
]);

const PULLUP_VARIANTS = new Set([
  'pull-up', 'pull-ups', 'chin-up', 'chin-ups',
  'negative pull-up', 'negative pull-ups',
  'assisted pull-up', 'band-assisted pull-up', 'band-assisted pull-ups',
  'lat pulldown',
]);

const CORE_EXERCISES = new Set([
  'pallof press', 'dead bug', 'bird dog', 'plank', 'side plank',
  'ab rollout', 'farmer carry', "farmer's carry", "farmer's walk",
  'suitcase carry', 'hanging knee raise', 'hanging leg raise',
  'cable woodchop', 'anti-rotation press', 'copenhagen plank',
]);

const BODYWEIGHT_EXERCISES = new Set([
  'pull-up', 'pull-ups', 'chin-up', 'chin-ups', 'push-up', 'push-ups',
  'dip', 'dips', 'negative pull-up', 'negative pull-ups', 'dead hang',
  'plank', 'side plank', 'dead bug', 'bird dog', 'burpee', 'burpees',
  'mountain climber', 'mountain climbers', 'box jump', 'broad jump',
  'hanging knee raise', 'hanging leg raise', 'toes to bar',
  'band pull-apart', 'band pull-aparts', 'face pull', 'ruck walk', 'walking',
]);

// ── Helpers ───────────────────────────────────────────────────────────────

function norm(name: string): string {
  return name.toLowerCase().trim();
}

function isMachine(name: string): boolean {
  return MACHINE_EXERCISES.has(norm(name));
}

function isPullupBar(name: string): boolean {
  return PULLUP_BAR_EXERCISES.has(norm(name));
}

function isPullupVariant(name: string): boolean {
  return PULLUP_VARIANTS.has(norm(name));
}

function isCoreExercise(name: string): boolean {
  return CORE_EXERCISES.has(norm(name));
}

function isBodyweight(name: string): boolean {
  return BODYWEIGHT_EXERCISES.has(norm(name));
}

function isCableExercise(name: string): boolean {
  const n = norm(name);
  return n.startsWith('cable') || n === 'lat pulldown';
}

function isUpperSession(session: SessionPlan): boolean {
  return session.sessionType.includes('upper') || session.sessionType === 'full_body';
}

function allExercises(session: SessionPlan): ExerciseItem[] {
  return session.sections.flatMap(s => s.exercises);
}

// ── Rule checkers ─────────────────────────────────────────────────────────

function checkSaturdayFamilyDay(
  sessions: SessionPlan[],
  violations: PlanViolation[],
): void {
  sessions.forEach((session, idx) => {
    if (
      session.suggestedDay === 'Saturday' &&
      session.sessionType !== 'family_day' &&
      session.sessionType !== 'rest'
    ) {
      violations.push({
        rule: 'saturday_family_day',
        sessionIndex: idx,
        sessionFocus: session.focus,
        message: `Session "${session.focus}" is scheduled on Saturday. Saturday is family day — must be family_day or rest.`,
      });
    }
  });
}

function checkSundayOutdoorOnly(
  sessions: SessionPlan[],
  violations: PlanViolation[],
): void {
  sessions.forEach((session, idx) => {
    if (session.suggestedDay !== 'Sunday') return;
    if (session.sessionType === 'ruck' || session.sessionType === 'active_recovery') return;

    // Check if any exercise uses gym equipment (machines or weighted strength exercises)
    const exercises = allExercises(session);
    const hasGymEquipment = exercises.some(e => isMachine(e.exerciseName));

    if (hasGymEquipment || (session.sessionType !== 'rest' && session.sessionType !== 'family_day')) {
      violations.push({
        rule: 'sunday_outdoor_only',
        sessionIndex: idx,
        sessionFocus: session.focus,
        message: `Session "${session.focus}" on Sunday must be ruck or active_recovery. Sunday is outdoor-only — no gym equipment.`,
      });
    }
  });
}

function checkNoMachineMachineSuperset(
  sessions: SessionPlan[],
  violations: PlanViolation[],
): void {
  sessions.forEach((session, idx) => {
    const exercises = allExercises(session);

    // Group by superset group
    const groups = new Map<string, ExerciseItem[]>();
    for (const ex of exercises) {
      if (!ex.supersetGroup) continue;
      const group = groups.get(ex.supersetGroup) ?? [];
      group.push(ex);
      groups.set(ex.supersetGroup, group);
    }

    for (const [group, groupExercises] of groups) {
      const machineCount = groupExercises.filter(e => isMachine(e.exerciseName)).length;
      if (machineCount >= 2) {
        violations.push({
          rule: 'no_machine_machine_superset',
          sessionIndex: idx,
          sessionFocus: session.focus,
          message: `Superset group "${group}" in "${session.focus}" has ${machineCount} machine exercises. Machine-machine supersets are not allowed — pair machines with free-weight or bodyweight movements.`,
        });
      }
    }
  });
}

function checkNoPullupCableSuperset(
  sessions: SessionPlan[],
  violations: PlanViolation[],
): void {
  sessions.forEach((session, idx) => {
    const exercises = allExercises(session);

    const groups = new Map<string, ExerciseItem[]>();
    for (const ex of exercises) {
      if (!ex.supersetGroup) continue;
      const group = groups.get(ex.supersetGroup) ?? [];
      group.push(ex);
      groups.set(ex.supersetGroup, group);
    }

    for (const [group, groupExercises] of groups) {
      const hasPullupBar = groupExercises.some(e => isPullupBar(e.exerciseName));
      const hasCable = groupExercises.some(e => isCableExercise(e.exerciseName));
      if (hasPullupBar && hasCable) {
        violations.push({
          rule: 'no_pullup_cable_superset',
          sessionIndex: idx,
          sessionFocus: session.focus,
          message: `Superset group "${group}" in "${session.focus}" combines a pull-up bar exercise with a cable exercise. These share the same equipment cluster — separate them.`,
        });
      }
    }
  });
}

function checkPullupsInUpper(
  sessions: SessionPlan[],
  violations: PlanViolation[],
): void {
  sessions.forEach((session, idx) => {
    if (!isUpperSession(session)) return;

    const exercises = allExercises(session);
    const hasPullupVariant = exercises.some(e => isPullupVariant(e.exerciseName));

    if (!hasPullupVariant) {
      violations.push({
        rule: 'pullups_in_upper',
        sessionIndex: idx,
        sessionFocus: session.focus,
        message: `Upper body session "${session.focus}" is missing a pull-up variant. Pull-up progression is race-critical — include pull-up, chin-up, negative pull-up, assisted pull-up, or lat pulldown.`,
      });
    }
  });
}

function checkLoadedExerciseNeedsWeight(
  sessions: SessionPlan[],
  violations: PlanViolation[],
): void {
  sessions.forEach((session, idx) => {
    const exercises = allExercises(session);

    for (const ex of exercises) {
      if (ex.type !== 'strength') continue;
      if (isBodyweight(ex.exerciseName)) continue;
      if (ex.weightKg !== null && ex.weightKg !== undefined) continue;

      violations.push({
        rule: 'loaded_exercise_needs_weight',
        sessionIndex: idx,
        sessionFocus: session.focus,
        message: `Exercise "${ex.exerciseName}" in "${session.focus}" is a strength exercise but has no weightKg. Provide a starting weight or mark it as bodyweight.`,
      });
    }
  });
}

function checkNoDuplicateExercise(
  sessions: SessionPlan[],
  violations: PlanViolation[],
): void {
  sessions.forEach((session, idx) => {
    const exercises = allExercises(session);
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const ex of exercises) {
      const name = norm(ex.exerciseName);
      if (seen.has(name)) {
        duplicates.add(name);
      }
      seen.add(name);
    }

    for (const name of duplicates) {
      violations.push({
        rule: 'no_duplicate_exercise',
        sessionIndex: idx,
        sessionFocus: session.focus,
        message: `Exercise "${name}" appears more than once in session "${session.focus}". Remove the duplicate.`,
      });
    }
  });
}

function checkCore3xWeek(
  sessions: SessionPlan[],
  violations: PlanViolation[],
): void {
  const sessionsWithCore = sessions.filter(session => {
    const exercises = allExercises(session);
    return exercises.some(e => isCoreExercise(e.exerciseName));
  });

  if (sessionsWithCore.length < 3) {
    violations.push({
      rule: 'core_3x_week',
      sessionIndex: -1,
      sessionFocus: 'Week Plan',
      message: `Only ${sessionsWithCore.length} session(s) contain a core exercise. Minimum is 3x/week. Add core work (pallof press, dead bug, plank, bird dog, etc.) to more sessions.`,
    });
  }
}

function checkCardioIntervalsComplete(
  sessions: SessionPlan[],
  violations: PlanViolation[],
): void {
  sessions.forEach((session, idx) => {
    const exercises = allExercises(session);
    for (const ex of exercises) {
      if (ex.type === 'cardio_intervals') {
        const missing: string[] = [];
        if (ex.rounds == null) missing.push('rounds');
        if (ex.intervalWorkSeconds == null) missing.push('intervalWorkSeconds');
        if (ex.intervalRestSeconds == null) missing.push('intervalRestSeconds');
        if (missing.length > 0) {
          violations.push({
            rule: 'cardio_intervals_complete',
            sessionIndex: idx,
            sessionFocus: session.focus,
            message: `Cardio intervals exercise "${ex.exerciseName}" in "${session.focus}" is missing required fields: ${missing.join(', ')}. All interval exercises must have rounds, intervalWorkSeconds, and intervalRestSeconds set — do not put this info in coachCue.`,
          });
        }
      }
      if (ex.type === 'cardio_steady') {
        if (ex.durationSeconds == null) {
          violations.push({
            rule: 'cardio_steady_duration',
            sessionIndex: idx,
            sessionFocus: session.focus,
            message: `Cardio steady exercise "${ex.exerciseName}" in "${session.focus}" is missing durationSeconds. Steady-state cardio must have a duration.`,
          });
        }
      }
    }
  });
}

// ── Main validator ────────────────────────────────────────────────────────

export function validatePlanRules(plan: WeekPlan): PlanViolation[] {
  const violations: PlanViolation[] = [];
  const { sessions } = plan;

  checkSaturdayFamilyDay(sessions, violations);
  checkSundayOutdoorOnly(sessions, violations);
  checkNoMachineMachineSuperset(sessions, violations);
  checkNoPullupCableSuperset(sessions, violations);
  checkPullupsInUpper(sessions, violations);
  checkLoadedExerciseNeedsWeight(sessions, violations);
  checkNoDuplicateExercise(sessions, violations);
  checkCardioIntervalsComplete(sessions, violations);

  return violations;
}

// ── Formatter for Plan Builder retry ─────────────────────────────────────

export function formatViolationsForFix(violations: PlanViolation[]): string {
  if (violations.length === 0) return 'No violations found.';

  const lines = [
    `The plan has ${violations.length} violation(s) that must be fixed before it can be saved:`,
    '',
  ];

  violations.forEach((v, i) => {
    const sessionLabel = v.sessionIndex >= 0
      ? `Session ${v.sessionIndex + 1} ("${v.sessionFocus}")`
      : v.sessionFocus;
    lines.push(`${i + 1}. [${v.rule}] ${sessionLabel}: ${v.message}`);
  });

  lines.push('');
  lines.push('Please revise the plan to fix all violations and resubmit.');

  return lines.join('\n');
}
