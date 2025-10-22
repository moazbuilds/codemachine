/**
 * Format duration in seconds to HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format runtime since start (auto-updates if no endTime provided)
 */
export function formatRuntime(startTime: number, endTime?: number): string {
  const now = endTime ?? Date.now();
  const elapsed = Math.floor((now - startTime) / 1000);
  return formatDuration(elapsed);
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format tokens as "XXX,XXXin/YYY,YYYout"
 */
export function formatTokens(tokensIn: number, tokensOut: number): string {
  return `${formatNumber(tokensIn)}in/${formatNumber(tokensOut)}out`;
}

/**
 * Format cost as "$X.XXXX"
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

/**
 * Format timestamp to time string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Truncate long strings with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
