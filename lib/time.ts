export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return "방금 전";
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}분 전`;
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `${diffHour}시간 전`;
  }
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

export function isWithinTenMinutes(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return diffMs >= 0 && diffMs <= 10 * 60 * 1000;
}
