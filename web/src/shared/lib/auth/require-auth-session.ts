import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { measureServerPerf } from "@/shared/lib/perf/server-perf";

export async function requireAuthSession() {
  const supabase = await measureServerPerf(
    "auth.create_supabase_server_client",
    () => createSupabaseServerClient(),
  );

  const userResult = await measureServerPerf("auth.supabase_get_user", () =>
    supabase.auth.getUser(),
  );
  const sessionResult = await measureServerPerf("auth.supabase_get_session", () =>
    supabase.auth.getSession(),
  );

  const user = userResult.data.user;
  const session = sessionResult.data.session;

  if (!user || !session?.access_token) {
    redirect("/login");
  }

  return {
    user,
    session,
    supabase,
  };
}
