import snapshot from "../server/rai/analytics-snapshot.js";
import connection from "../server/rai/connection.js";
import { createRaiRouter } from "../server/rai/router.js";
import platform from "../server/platform/handler.js";
import platformAuth from "../server/platform/auth-handler.js";
import telemetry from "../server/platform/telemetry-handler.js";
import type { HandlerRequest, HandlerResponse } from "../server/_shared.js";
const rai = createRaiRouter({ snapshot, connection });
export default function handler(
  req: HandlerRequest & {
    query?: Record<string, string | string[] | undefined>;
  },
  res: HandlerResponse,
) {
  const query = Object.fromEntries(
    Object.entries(req.query || {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const routed = { method: req.method, headers: req.headers, body: req.body, query };
  if (query.route === "platform") return platform(routed, res);
  if (query.route === "platform-auth") return platformAuth(routed, res);
  if (query.route === "telemetry") return telemetry(routed, res);
  return rai(req, res);
}
