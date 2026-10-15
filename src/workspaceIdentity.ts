// Public demo branding is independent of its permanent tenant identity/code.
export const DEMO_TENANT_SLUG = "totalenergies-pharmacy";
export function tenantWorkspaceSlug(slug: string) {
  return slug.toLowerCase() === "demo" ? DEMO_TENANT_SLUG : slug;
}
export function publicWorkspaceSlug(slug: string) {
  return slug === DEMO_TENANT_SLUG ? "demo" : slug;
}
