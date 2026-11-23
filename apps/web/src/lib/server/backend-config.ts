import "server-only";
import type { ProxyConfig } from "./backend-proxy";
const local = (url: URL) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
function validateOrigin(raw: string): string {
  const url = new URL(raw);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && local(url)))
  )
    throw new Error("Invalid origin configuration");
  return url.origin;
}
export function proxyConfig(): ProxyConfig {
  const backend = validateOrigin(process.env.DRIVECORE_API_ORIGIN ?? "");
  const rawApps = (process.env.DRIVECORE_APP_ORIGIN ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!rawApps.length) throw new Error("Invalid origin configuration");
  const apps = [...new Set(rawApps.map(validateOrigin))];
  const cookie = process.env.DRIVECORE_SESSION_COOKIE_NAME ?? "";
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(cookie) || cookie === "XSRF-TOKEN")
    throw new Error("Invalid cookie configuration");
  const timeout = Number(process.env.DRIVECORE_API_TIMEOUT_MS ?? "15000");
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30000)
    throw new Error("Invalid timeout configuration");
  return { backend, app: apps[0], apps, cookie, timeout };
}
