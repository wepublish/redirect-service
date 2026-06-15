import type { Context, Next } from "hono";
import { getUser } from "./session.ts";

export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const user = await getUser(c);
  if (!user) return c.redirect("/login");
  c.set("user", user);
  await next();
}
