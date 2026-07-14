// The paths this app can actually match — the single source of truth.
//
// `router.tsx` builds its route table from these constants, and
// `lib/notifications/deepLink.ts` validates every inbound deep link (in-app
// notification tap AND native `push.opened`) against them. Because both sides
// read the same list, a backend that emits a route the field app does not have
// can never silently fall through the `*` catch-all and dump the rep on Today.
//
// Adding a screen: add the pattern here, then wire it in `router.tsx`.

export const ROUTE = {
  login: '/login',
  privacy: '/privacy',
  today: '/today',
  outlets: '/outlets',
  outletOnboard: '/outlets/onboard',
  outletDetail: '/outlets/:id',
  outletCheckIn: '/outlets/:id/check-in',
  routeView: '/route',
  visitPitch: '/visit/pitch',
  visitCatalog: '/visit/catalog',
  visitOrder: '/visit/order',
  visitPayment: '/visit/payment',
  visitOutcome: '/visit/outcome',
  orders: '/orders',
  orderDetail: '/orders/:id',
  notifications: '/notifications',
  sync: '/sync',
} as const;

export type AppRoutePattern = (typeof ROUTE)[keyof typeof ROUTE];

// Every matchable pattern. Deliberately excludes the `*` catch-all and the `/`
// index redirect — neither is a legitimate deep-link destination.
export const APP_ROUTE_PATTERNS: readonly AppRoutePattern[] = Object.values(
  ROUTE,
) as AppRoutePattern[];
