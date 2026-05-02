import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isSessionInactive,
  isSupabaseAuthCookieName,
  parseActivityTimestamp,
  SESSION_ACTIVITY_COOKIE_MAX_AGE_SECONDS,
  SESSION_ACTIVITY_COOKIE_NAME,
  SESSION_EXPIRED_REASON,
  SESSION_REASON_QUERY_PARAM,
} from "@/shared/lib/auth/session-inactivity";

function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  return value;
}

function getSupabaseAnonKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");
  }

  return value;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname);

  if (isPublicAsset) {
    return NextResponse.next({
      request,
    });
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = pathname === "/login";
  const lastActivityAt = parseActivityTimestamp(
    request.cookies.get(SESSION_ACTIVITY_COOKIE_NAME)?.value,
  );

  if (user && lastActivityAt && isSessionInactive(lastActivityAt)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = new URLSearchParams({
      [SESSION_REASON_QUERY_PARAM]: SESSION_EXPIRED_REASON,
    }).toString();

    const redirectResponse = NextResponse.redirect(loginUrl);

    request.cookies.getAll().forEach(({ name }) => {
      if (
        name === SESSION_ACTIVITY_COOKIE_NAME ||
        isSupabaseAuthCookieName(name)
      ) {
        redirectResponse.cookies.delete(name);
      }
    });

    return redirectResponse;
  }

  if (user && !lastActivityAt) {
    response.cookies.set(SESSION_ACTIVITY_COOKIE_NAME, String(Date.now()), {
      path: "/",
      maxAge: SESSION_ACTIVITY_COOKIE_MAX_AGE_SECONDS,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }

  if (!user) {
    response.cookies.delete(SESSION_ACTIVITY_COOKIE_NAME);
  }

  if (!user && !isLoginRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginRoute) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
