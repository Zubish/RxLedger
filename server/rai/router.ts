import type { HandlerRequest, HandlerResponse } from '../_shared.js';

type RoutedRequest = HandlerRequest & { query?: Record<string, string | string[] | undefined> };
type Handler = (req: HandlerRequest, res: HandlerResponse) => unknown;

export function createRaiRouter(handlers: { snapshot: Handler; connection: Handler }) {
  return (req: RoutedRequest, res: HandlerResponse) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.query?.route === 'analytics-snapshot') return handlers.snapshot(req, res);
    if (req.query?.route === 'connection') return handlers.connection(req, res);
    return res.status(404).json({ error: 'Rai endpoint not found.' });
  };
}
