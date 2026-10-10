import { pageIds } from "./platform/contracts";
export { pageIds };
export type NavigationView = typeof pageIds[number];
export const continuityStatuses = ['active', 'open', 'matched', 'contacted', 'transferred', 'fulfilled', 'cancelled', 'all'] as const;
export type NavigationFilter = typeof continuityStatuses[number];

export function readNavigation(hash = window.location.hash): { view: NavigationView; filter: NavigationFilter } {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const view = pageIds.find(page => page === path) ?? 'dashboard';
  const status = new URLSearchParams(query).get('status');
  const filter = continuityStatuses.find(value => value === status) ?? 'active';
  return { view, filter };
}

export function writeNavigation(view: NavigationView, filter: NavigationFilter, replace = false) {
  const hash = `#/${view}${view === 'continuity' ? `?status=${filter}` : ''}`;
  if (window.location.hash === hash) return;
  // Preserve workspace paths and unrelated query parameters (including RAI consent).
  window.history[replace ? 'replaceState' : 'pushState'](null, '', `${window.location.pathname}${window.location.search}${hash}`);
}
