"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type PendingNavigation = {
  from: string;
  startedAt: number;
  to: string;
};

const WEB_CLIENT_PERF_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_WEB_PERF_LOGS === "true";

function getCurrentLocation() {
  return `${window.location.pathname}${window.location.search}`;
}

function logClientPerf(
  event: string,
  meta: Record<string, boolean | number | string | null | undefined>,
) {
  if (!WEB_CLIENT_PERF_ENABLED) {
    return;
  }

  console.log(
    JSON.stringify({
      level: "info",
      scope: "web-client",
      event,
      ...Object.fromEntries(
        Object.entries(meta).filter(([, value]) => value !== undefined),
      ),
    }),
  );
}

export function NavigationPerfTracker() {
  const pathname = usePathname();
  const currentRouteRef = useRef<string | null>(null);
  const pendingNavigationRef = useRef<PendingNavigation | null>(null);

  useEffect(() => {
    if (!WEB_CLIENT_PERF_ENABLED) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;

      if (!target || (target.target && target.target !== "_self")) {
        return;
      }

      const url = new URL(target.href, window.location.href);

      if (url.origin !== window.location.origin) {
        return;
      }

      pendingNavigationRef.current = {
        from: getCurrentLocation(),
        startedAt: performance.now(),
        to: `${url.pathname}${url.search}`,
      };

      logClientPerf("navigation_start", pendingNavigationRef.current);
    };

    window.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("click", handleClick, true);
    };
  }, []);

  useEffect(() => {
    if (!WEB_CLIENT_PERF_ENABLED) {
      return;
    }

    const route = getCurrentLocation();

    if (currentRouteRef.current === null) {
      currentRouteRef.current = route;
      logClientPerf("route_ready", { route, initial: true });
      return;
    }

    if (currentRouteRef.current === route) {
      return;
    }

    const pendingNavigation = pendingNavigationRef.current;
    currentRouteRef.current = route;

    if (!pendingNavigation) {
      logClientPerf("route_ready", { route, initial: false });
      return;
    }

    pendingNavigationRef.current = null;
    logClientPerf("navigation_done", {
      from: pendingNavigation.from,
      to: pendingNavigation.to,
      route,
      ms: Number((performance.now() - pendingNavigation.startedAt).toFixed(1)),
    });
  }, [pathname]);

  return null;
}
