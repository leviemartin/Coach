/** Format seconds for display: ≥60s shows as minutes, <60s shows as seconds */
export function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.round(seconds / 60);
    return `${mins}min`;
  }
  return `${seconds}s`;
}
