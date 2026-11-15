import "server-only";
import type { ProxyConfig } from "./backend-proxy";
const local = (url: URL) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
export function proxyConfig(): ProxyConfig {
  const backend = new URL(process.env.DRIVECORE_API_ORIGIN ?? "");
  const app = new URL(process.env.DRIVECORE_APP_ORIGIN ?? "");
  for (const url of [backend, app]) {
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && local(url)))
    )
      throw new Error("Invalid origin configuration");
  }
  const cookie = process.env.DRIVECORE_SESSION_COOKIE_NAME ?? "";
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(cookie) || cookie === "XSRF-TOKEN")
    throw new Error("Invalid cookie configuration");
  const timeout = Number(process.env.DRIVECORE_API_TIMEOUT_MS ?? "15000");
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30000)
    throw new Error("Invalid timeout configuration");
  return { backend: backend.origin, app: app.origin, cookie, timeout };
}
