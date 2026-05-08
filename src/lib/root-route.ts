export type RootRouteSession = { user?: { id?: string } } | null | undefined;

export function shouldRedirectRootToDashboard(
  session: RootRouteSession,
): boolean {
  return Boolean(session?.user?.id);
}
