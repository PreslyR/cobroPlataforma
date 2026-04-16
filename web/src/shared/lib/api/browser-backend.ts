"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export async function fetchBackendFromBrowser(path: string, init: RequestInit = {}) {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No active session was found.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
}

export function getBrowserBackendBaseUrl() {
  return API_BASE_URL;
}

