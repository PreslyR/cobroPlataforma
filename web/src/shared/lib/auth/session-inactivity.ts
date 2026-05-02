export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_ACTIVITY_SYNC_THROTTLE_MS = 60 * 1000;
export const SESSION_ACTIVITY_COOKIE_NAME = "cobro_last_activity_at";
export const SESSION_ACTIVITY_STORAGE_KEY = "cobro:last-activity-at";
export const SESSION_ACTIVITY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_EXPIRED_REASON = "inactive";
export const SESSION_REASON_QUERY_PARAM = "reason";

export function parseActivityTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function isSessionInactive(lastActivityAt: number, now = Date.now()) {
  return now - lastActivityAt >= SESSION_INACTIVITY_TIMEOUT_MS;
}

export function buildInactiveSessionLocation() {
  const params = new URLSearchParams({
    [SESSION_REASON_QUERY_PARAM]: SESSION_EXPIRED_REASON,
  });

  return `/login?${params.toString()}`;
}

export function isSupabaseAuthCookieName(name: string) {
  return (
    name.startsWith("sb-") ||
    name.startsWith("__Secure-sb-") ||
    name.startsWith("__Host-sb-")
  );
}
