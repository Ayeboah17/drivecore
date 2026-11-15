import { proxy } from "@/lib/server/backend-proxy";
import { proxyConfig } from "@/lib/server/backend-config";
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  let config;
  try {
    config = proxyConfig();
  } catch {
    return Response.json(
      { message: "API configuration unavailable.", errors: {} },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return proxy(request, (await context.params).path.join("/"), config);
}
export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
  handle as OPTIONS,
};
