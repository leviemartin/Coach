import type { PlanItem } from './types';

export interface SequencingResult {
  allowed: true; // Always true — never blocks
  warning?: string;
}

/**
 * Check if placing a session on a target date violates sequencing constraints.
 * Adjacent = consecutive calendar days (Mon-Tue, not Mon-Wed).
 * Sessions in the same sequence_group should not be on adjacent days.
 * NEVER blocks — returns warning only.
 */
export function checkSequencingConstraints(
  planItems: PlanItem[],
  sessionId: number,
  targetDate: string
): SequencingResult {
  const targetSession = planItems.find(p => p.id === sessionId);
  if (!targetSession?.sequenceGroup) return { allowed: true };

  const targetDateObj = new Date(targetDate);

  for (const item of planItems) {
    if (item.id === sessionId) continue;
    if (item.sequenceGroup !== targetSession.sequenceGroup) continue;
    if (!item.assignedDate) continue;

    const itemDate = new Date(item.assignedDate);
    const diffMs = Math.abs(targetDateObj.getTime() - itemDate.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays <= 1) {
      // Same-day or adjacent — generate warning
      const notes = targetSession.sequenceNotes || item.sequenceNotes;
      const warning = notes
        ? `Coach recommends: ${notes}`
        : `Sessions in "${targetSession.sequenceGroup}" group should not be on adjacent days`;
      return { allowed: true, warning };
    }
  }

  return { allowed: true };
}
