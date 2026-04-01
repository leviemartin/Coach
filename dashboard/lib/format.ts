/** Format seconds for display: ≥60s shows as minutes, <60s shows as seconds */
export function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.round(seconds / 60);
    return `${mins}min`;
  }
  return `${seconds}s`;
}

/** Format weight for display. Returns "BW" for null/0, otherwise "{n}kg" */
export function formatWeight(kg: number | null): string {
  if (kg == null || kg === 0) return 'BW';
  return `${kg}kg`;
}

/** Format a reps display string with sets count. "4×8-10", "3×30s", "3×MAX TIME" */
export function formatRx(sets: number | null, repsDisplay: string | null, durationS: number | null, laterality?: string): string {
  const parts: string[] = [];
  if (sets != null && sets > 0) {
    if (repsDisplay) {
      parts.push(`${sets}×${repsDisplay}`);
    } else if (durationS != null) {
      parts.push(`${sets}×${formatDuration(durationS)}`);
    } else {
      parts.push(`${sets} sets`);
    }
  } else if (durationS != null) {
    parts.push(formatDuration(durationS));
  } else if (repsDisplay) {
    parts.push(repsDisplay);
  }
  if (laterality === 'unilateral_each') parts.push('/side');
  if (laterality === 'alternating') parts.push('alt');
  return parts.join(' ');
}
