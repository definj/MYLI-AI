const PUBLIC_ROUTE_PREFIXES = ['/auth'];
const PUBLIC_ROUTES = ['/', '/onboarding'];

export function isPublicPath(pathname: string) {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isOnboardingPath(pathname: string) {
  return pathname === '/onboarding';
}

export function isDashboardPath(pathname: string) {
  return pathname.startsWith('/dashboard');
}
