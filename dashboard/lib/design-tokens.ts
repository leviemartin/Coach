// dashboard/lib/design-tokens.ts

/** Semantic colors — every color maps to a coaching concept */
export const semanticColors = {
  recovery: {
    good: '#22c55e',      // Recovery >50, Sleep >75
    caution: '#f59e0b',   // Dad baseline, Sleep 60-75
    problem: '#ef4444',   // Recovery <35, Sleep <60
  },
  body: '#3b82f6',        // Weight, HRV, metrics
  protocols: '#8b5cf6',   // Vampire, Rug, compliance
  cardioSteady: '#14b8a6', // Zone 2, recovery sessions
  cardioIntervals: '#f97316', // Rower sprints, StairMaster intervals
} as const;

/** Map a value to a semantic color using thresholds */
export function getSemanticColor(
  value: number,
  greenThreshold: number,
  yellowThreshold: number,
  invert = false,
): string {
  if (invert) {
    if (value <= greenThreshold) return semanticColors.recovery.good;
    if (value <= yellowThreshold) return semanticColors.recovery.caution;
    return semanticColors.recovery.problem;
  }
  if (value >= greenThreshold) return semanticColors.recovery.good;
  if (value >= yellowThreshold) return semanticColors.recovery.caution;
  return semanticColors.recovery.problem;
}

/** Card accent border styles keyed by semantic purpose */
export const cardAccents = {
  recovery: semanticColors.recovery.good,
  body: semanticColors.body,
  sleep: semanticColors.recovery.caution,
  protocols: semanticColors.protocols,
} as const;

/** Brutalist border tokens */
export const borders = {
  hard: '#18181b',
  soft: '#e4e4e0',
  input: '#d4d4d0',
  inputFocus: '#18181b',
} as const;

/** Typography sizes for the card hierarchy — all numeric data in JetBrains Mono */
export const typography = {
  heroNumber: { fontFamily: '"JetBrains Mono", monospace', fontSize: '2.625rem', fontWeight: 800 },   // 42px
  primaryMetric: { fontFamily: '"JetBrains Mono", monospace', fontSize: '2rem', fontWeight: 800 },     // 32px
  metricValue: { fontFamily: '"JetBrains Mono", monospace', fontSize: '1.5rem', fontWeight: 700 },     // 24px
  sectionTitle: {
    fontFamily: '"Libre Franklin", sans-serif',
    fontSize: '1.25rem',
    fontWeight: 900,
    textTransform: 'uppercase' as const,
    letterSpacing: '-0.3px',
  },   // 20px
  categoryLabel: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '0.5625rem',  // 9px
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
    color: '#71717a',  // text.secondary
  },
} as const;

/** Hero card style (Tier 1) — 3px hard border + left accent */
export function heroCardSx(accentColor: string) {
  return {
    borderRadius: 0,
    border: `3px solid ${borders.hard}`,
    borderLeft: `4px solid ${accentColor}`,
    boxShadow: 'none',
  };
}

/** Metric card style (Tier 3) — 3px hard border, no accent */
export const metricCardSx = {
  borderRadius: 0,
  border: `3px solid ${borders.hard}`,
  boxShadow: 'none',
} as const;

/** Section accent colors for the brutalist design language */
export const sectionColors: Record<string, string> = {
  warm_up: '#b45309',
  activation: '#7c3aed',
  main_work: '#18181b',
  accessory: '#2563eb',
  finisher: '#dc2626',
  cool_down: '#0d9488',
} as const;

/** Superset group colors */
export const supersetColors: Record<string, { border: string; bg: string }> = {
  A: { border: '#7c3aed', bg: '#7c3aed15' },
  B: { border: '#7c3aed', bg: '#7c3aed15' },
  C: { border: '#ea580c', bg: '#ea580c15' },
  D: { border: '#b45309', bg: '#b4530915' },
} as const;

/** Status badge colors */
export const statusColors = {
  published: { border: '#22c55e40', color: '#16a34a', bg: '#22c55e18' },
  draft: { border: '#f59e0b40', color: '#d97706', bg: '#f59e0b18' },
  completed: { border: '#3b82f640', color: '#2563eb', bg: '#3b82f618' },
  skipped: { border: '#a1a1aa40', color: '#71717a', bg: '#a1a1aa18' },
} as const;
