import {
  clearSessionCookie,
  deleteSession,
  fail,
  getSessionToken,
  requireMethod,
} from "../_shared.js";
import type { HandlerRequest, HandlerResponse } from "../_shared.js";

export default async function handler(
  req: HandlerRequest,
  res: HandlerResponse,
) {
  if (!requireMethod(req, res, ["POST"])) return;
  try {
    const token = getSessionToken(req);
    if (token) await deleteSession(token);
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(
      res,
      500,
      error instanceof Error ? error.message : "Unable to log out",
    );
  }
}
