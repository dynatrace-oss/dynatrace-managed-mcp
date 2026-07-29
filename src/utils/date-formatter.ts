/**
 * Safe date formatting utility to handle invalid timestamps
 */
export function formatTimestamp(timestamp: number | string | Date): string {
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return `Invalid timestamp: ${timestamp}`;
    }
    return date.toISOString().replace('T', ' ').slice(0, 19);
  } catch (error) {
    return `Invalid timestamp: ${timestamp} ${error instanceof Error ? error.message : ''}`;
  }
}
