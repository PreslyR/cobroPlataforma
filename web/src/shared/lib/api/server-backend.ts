import "server-only";

import { requireAuthSession } from "@/shared/lib/auth/require-auth-session";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000/api";

type ServerBackendFetchOptions = {
  revalidate?: number;
  init?: RequestInit;
};

export async function fetchBackendFromServer(
  path: string,
  options: ServerBackendFetchOptions = {},
) {
  const { session } = await requireAuthSession();
  const headers = new Headers(options.init?.headers);

  headers.set("Authorization", `Bearer ${session.access_token}`);

  return fetch(`${API_BASE_URL}${path}`, {
    ...options.init,
    headers,
    ...(options.revalidate !== undefined
      ? { next: { revalidate: options.revalidate } }
      : {}),
  });
}

export function getBackendBaseUrl() {
  return API_BASE_URL;
}

