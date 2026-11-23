import "server-only";
import { proxy } from "./backend-proxy";
import { startDemoApiServer } from "./demo-api-core.mjs";

interface DemoServerHandle {
  url: string;
  port: number;
}

const globalForDemo = globalThis as typeof globalThis & {
  __drivecoreDemoServerPromise?: Promise<DemoServerHandle>;
};

export function isLiveDemoMode(): boolean {
  return (
    process.env.DRIVECORE_MODE === "live-demo" ||
    process.env.DRIVECORE_LIVE_DEMO === "1"
  );
}

function getDemoServer(): Promise<DemoServerHandle> {
  if (!globalForDemo.__drivecoreDemoServerPromise) {
    globalForDemo.__drivecoreDemoServerPromise = startDemoApiServer({
      port: 0,
      seed: true,
    });
  }
  return globalForDemo.__drivecoreDemoServerPromise;
}

export async function proxyLiveDemo(
  request: Request,
  path: string,
): Promise<Response> {
  const { url: backend } = await getDemoServer();
  const reqOrigin = new URL(request.url).origin;
  const vercelOrigin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null;
  const apps = [
    ...new Set([reqOrigin, ...(vercelOrigin ? [vercelOrigin] : [])]),
  ];
  return proxy(request, path, {
    backend,
    app: reqOrigin,
    apps,
    cookie: "drivecore_test",
    timeout: 15000,
  });
}
