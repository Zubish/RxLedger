import healthpass, { rawBody } from "../server/healthpass/handler.js";
import snapshot from "../server/rai/analytics-snapshot.js";
import connection from "../server/rai/connection.js";
import { createRaiRouter } from "../server/rai/router.js";
import platform from "../server/platform/handler.js";
import platformAuth from "../server/platform/auth-handler.js";
import telemetry from "../server/platform/telemetry-handler.js";
import type { HandlerRequest, HandlerResponse } from "../server/_shared.js";
const rai = createRaiRouter({ snapshot, connection });
export const config = { api: { bodyParser: false } };
export default async function handler(
  req: HandlerRequest & AsyncIterable<Uint8Array> & {
    query?: Record<string, string | string[] | undefined>;
  },
  res: HandlerResponse,
) {
  const query = Object.fromEntries(
    Object.entries(req.query || {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  if (query.route === "healthpass") return healthpass(req, res);
  if (req.method !== "GET" && req.method !== "HEAD" && (req.body === undefined || typeof req.body === "string")) {
    try {
      const raw = await rawBody(req, 1048576);
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      res.status(400).json({ error: "Invalid JSON request body" });
      return;
    }
  }
  const routed = { method: req.method, headers: req.headers, body: req.body, query };
  if (query.route === "platform") return platform(routed, res);
  if (query.route === "platform-auth") return platformAuth(routed, res);
  if (query.route === "telemetry") return telemetry(routed, res);
  return rai(req, res);
}
