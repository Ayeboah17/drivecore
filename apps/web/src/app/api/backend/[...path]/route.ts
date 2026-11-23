import { proxy } from "@/lib/server/backend-proxy";
import { proxyConfig } from "@/lib/server/backend-config";
import { isLiveDemoMode, proxyLiveDemo } from "@/lib/server/vercel-live-demo";

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = (await context.params).path.join("/");
  if (isLiveDemoMode()) {
    return proxyLiveDemo(request, path);
  }
  let config;
  try {
    config = proxyConfig();
  } catch {
    return Response.json(
      { message: "API configuration unavailable.", errors: {} },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return proxy(request, path, config);
}
export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
  handle as OPTIONS,
};
