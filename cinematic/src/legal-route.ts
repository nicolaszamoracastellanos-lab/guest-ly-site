/* Which legal page, if any, the address asks for. Kept apart from the page
   itself (src/ui/LegalPage.tsx) so main.tsx and App.tsx can tell without
   pulling the legal pages' chunk into the home page's first load. */

export type LegalKind = 'privacy' | 'terms' | 'refunds';

const LEGAL_ROUTES: Record<string, LegalKind> = {
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/refunds': 'refunds',
};

export function legalRoute(): LegalKind | null {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return LEGAL_ROUTES[path] ?? null;
}
