"use client";

import {
  SESSION_ACTIVITY_COOKIE_MAX_AGE_SECONDS,
  SESSION_ACTIVITY_COOKIE_NAME,
  SESSION_ACTIVITY_STORAGE_KEY,
  parseActivityTimestamp,
} from "@/shared/lib/auth/session-inactivity";

function readCookieValue(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return match ? match.slice(prefix.length) : null;
}

function buildCookieAttributes(maxAgeSeconds: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function readSessionActivityTimestamp() {
  let storageValue: number | null = null;

  if (typeof window !== "undefined") {
    try {
      storageValue = parseActivityTimestamp(
        window.localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY),
      );
    } catch {
      storageValue = null;
    }
  }

  const cookieValue = parseActivityTimestamp(
    readCookieValue(SESSION_ACTIVITY_COOKIE_NAME),
  );

  if (storageValue && cookieValue) {
    return Math.max(storageValue, cookieValue);
  }

  return storageValue ?? cookieValue;
}

export function writeSessionActivityTimestamp(timestamp = Date.now()) {
  const serialized = String(Math.trunc(timestamp));

  try {
    window.localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, serialized);
  } catch {
    // Ignore storage write failures and keep the cookie as the fallback source.
  }

  document.cookie = `${SESSION_ACTIVITY_COOKIE_NAME}=${serialized}; ${buildCookieAttributes(
    SESSION_ACTIVITY_COOKIE_MAX_AGE_SECONDS,
  )}`;

  return timestamp;
}

export function clearSessionActivityTracking() {
  try {
    window.localStorage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures and still expire the cookie.
  }

  document.cookie = `${SESSION_ACTIVITY_COOKIE_NAME}=; ${buildCookieAttributes(0)}`;
}
