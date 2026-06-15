import type { Context } from "hono";
import { getSignedCookie, setSignedCookie, deleteCookie } from "hono/cookie";
import { config } from "../config.ts";

const COOKIE = "rs_session";

export async function setUser(c: Context, login: string): Promise<void> {
  await setSignedCookie(c, COOKIE, login, config.sessionSecret, {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getUser(c: Context): Promise<string | null> {
  const v = await getSignedCookie(c, config.sessionSecret, COOKIE);
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function clearUser(c: Context): void {
  deleteCookie(c, COOKIE, { path: "/" });
}
