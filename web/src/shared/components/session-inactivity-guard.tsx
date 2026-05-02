"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  clearSessionActivityTracking,
  readSessionActivityTimestamp,
  writeSessionActivityTimestamp,
} from "@/shared/lib/auth/session-activity.client";
import {
  buildInactiveSessionLocation,
  isSessionInactive,
  parseActivityTimestamp,
  SESSION_ACTIVITY_STORAGE_KEY,
  SESSION_ACTIVITY_SYNC_THROTTLE_MS,
  SESSION_INACTIVITY_TIMEOUT_MS,
} from "@/shared/lib/auth/session-inactivity";

export function SessionInactivityGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const timeoutRef = useRef<number | null>(null);
  const isSigningOutRef = useRef(false);

  useEffect(() => {
    if (pathname === "/login") {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const clearPendingTimeout = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const redirectToLogin = (href: string) => {
      router.replace(href);
      router.refresh();
    };

    const signOutForInactivity = async () => {
      if (isSigningOutRef.current) {
        return;
      }

      isSigningOutRef.current = true;
      clearPendingTimeout();
      clearSessionActivityTracking();

      try {
        await supabase.auth.signOut();
      } finally {
        redirectToLogin(buildInactiveSessionLocation());
      }
    };

    const scheduleExpirationCheck = (lastActivityAt: number) => {
      clearPendingTimeout();

      const remainingMs =
        SESSION_INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAt);

      if (remainingMs <= 0) {
        void signOutForInactivity();
        return;
      }

      timeoutRef.current = window.setTimeout(() => {
        void signOutForInactivity();
      }, remainingMs);
    };

    const recordActivity = (force = false) => {
      if (document.visibilityState === "hidden") {
        return;
      }

      const now = Date.now();
      const lastActivityAt = readSessionActivityTimestamp();

      if (
        !force &&
        lastActivityAt &&
        now - lastActivityAt < SESSION_ACTIVITY_SYNC_THROTTLE_MS
      ) {
        scheduleExpirationCheck(lastActivityAt);
        return;
      }

      const nextActivityAt = writeSessionActivityTimestamp(now);
      scheduleExpirationCheck(nextActivityAt);
    };

    const ensureActiveSession = () => {
      const lastActivityAt = readSessionActivityTimestamp();

      if (!lastActivityAt) {
        recordActivity(true);
        return;
      }

      if (isSessionInactive(lastActivityAt)) {
        void signOutForInactivity();
        return;
      }

      scheduleExpirationCheck(lastActivityAt);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const lastActivityAt = readSessionActivityTimestamp();

        if (lastActivityAt && isSessionInactive(lastActivityAt)) {
          void signOutForInactivity();
          return;
        }

        recordActivity(true);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_ACTIVITY_STORAGE_KEY) {
        return;
      }

      const lastActivityAt = parseActivityTimestamp(event.newValue);

      if (!lastActivityAt) {
        return;
      }

      if (isSessionInactive(lastActivityAt)) {
        void signOutForInactivity();
        return;
      }

      scheduleExpirationCheck(lastActivityAt);
    };

    const handleActivity = () => {
      recordActivity();
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        return;
      }

      clearPendingTimeout();
      clearSessionActivityTracking();

      if (!isSigningOutRef.current) {
        redirectToLogin("/login");
      }
    });

    const passiveEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "touchstart",
      "scroll",
    ];
    const activeEvents: Array<keyof WindowEventMap> = ["keydown", "focus"];
    const passiveOptions = { passive: true } as const;

    ensureActiveSession();

    passiveEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, passiveOptions);
    });
    activeEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity);
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      clearPendingTimeout();
      passiveEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      activeEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", handleStorage);
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  return null;
}
