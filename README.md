# Organikaly Field App

Offline-first, mobile-first field-sales app for Organikaly's door-to-door reps.
Runs identically in a plain browser and inside the Expo WebView shell. Built to
the cross-repo `CONTRACT.md` (API shapes, enums, brand tokens, sync protocol).

Stack: **Vite + React 18 + TypeScript + Tailwind**, TanStack Query (server
state), Zustand (session / active-visit / toasts), React Router. Offline: a
custom **service worker** (precaches the shell) + **IndexedDB** (`idb`) holding
an **outbound mutation queue** + queued photo blobs. Mutations get
client-generated UUIDs + idempotency keys, are applied optimistically, and
replay against `POST /sync/batch` on reconnect.

## Run

```bash
cp .env.example .env        # set VITE_API_BASE to the backend (default :8000/api/v1)
npm install
npm run dev                 # http://localhost:5173
```

Demo login (from the backend seed): `rep.delhi@organikaly.in` / `Organikaly@123`.

```bash
npm run build               # tsc -b + vite build (+ injectManifest service worker)
npm run typecheck           # tsc --noEmit
npm run preview             # serve the production build (PWA/SW active here)
```

> The service worker is only active in a real (built) deploy / `preview`, not in
> `dev`. Use `npm run preview` to exercise offline behavior.

## Screens / routes

| Route | Screen |
|---|---|
| `/login` | Login (brand-forward, secure-store token) |
| `/today` | Today — route progress, quick actions, route outlets |
| `/outlets` | Outlets — search, status filters, near-me sort, list/map toggle |
| `/outlets/onboard` | Onboard outlet — live shop photo + GPS (fixes geofence) + profile + custom fields |
| `/outlets/:id` | Outlet detail — profile, map, visit history, Check-in CTA |
| `/outlets/:id/check-in` | Geo-verified check-in — GPS vs geofence, accuracy + mock flags, live photo, allow-with-flag |
| `/visit/pitch` | Pitch/demo log — demoed SKUs + notes |
| `/visit/catalog` | Stock-aware catalog — quantities, MOQ, out-of-stock disabled, running total |
| `/visit/order` | Order review — line discounts, GST, expected delivery, place order |
| `/visit/payment` | Payment terms — type/method/amount/credit days → due date |
| `/visit/outcome` | Visit outcome — order/no-order, reason codes, next-visit scheduling, checkout |
| `/orders`, `/orders/:id` | Orders list + detail (status, credit check, line items, history) |
| `/route` | Today's route — map + ordered stops + navigate deep-links |
| `/sync` | Sync status — queue, errors + retry, photo queue, refresh data, sign out |

A persistent sync indicator sits in every top bar and the bottom-nav Sync tab
badges queued/failed counts (CONTRACT §8).

## Offline model (CONTRACT §7)

- **Bootstrap:** on login/online, `GET /sync/bootstrap` caches outlets, today's
  route, the stock-aware catalog, and tenant config into IndexedDB.
- **Mutations:** onboarding, check-in, order, payment and outcome are written to
  the IndexedDB outbound queue (`client_uuid` + `idempotency_key`), applied
  optimistically (a `local:<uuid>` entity appears immediately), and drained via
  `POST /sync/batch` on reconnect / a 30 s timer / Background Sync.
- **Photos:** live captures queue as blobs and embed a `photo://<id>`
  placeholder. The sync engine uploads them via `POST /media/upload` first, swaps
  the placeholder for the returned URL, then sends the owning mutation
  (deferred-upload, §7.4).
- **Results:** each batch result marks an item synced/duplicate (dropped) or
  error (exponential backoff; surfaced on the Sync screen with Retry).
- **Conflicts:** reference data is last-write-wins on refresh; mutations are
  idempotent so replay is safe. A server-rejected order (credit/stock) returns an
  `error` the rep resolves.

The app is fully usable with the network off after first load.

## Native bridge (`src/lib/bridge`)

All device power flows through a typed `window.ReactNativeWebView` postMessage
bridge to the Expo shell, with request/response correlation by UUID:

- `camera.capture` — **live capture only**, no gallery
- `location.get` — precise GPS + accuracy + **mock-location flag**
- `pushToken.get` — device push token (registered via `POST /auth/push-token`)
- `secureStore.{set,get,delete}` — JWT storage

In a plain browser (no shell) it falls back gracefully to
`navigator.geolocation`, `<input capture>` for the camera, and `localStorage`
for the token — and shows a **DEV MODE** banner so the fallback is never mistaken
for the real device pipeline.

## Geo verification (CONTRACT §6)

On check-in the client previews the server's rule: `in_fence = distance ≤
(outlet.geofence_radius_m ?? config 100m) AND accuracy ≤ config 50m AND
!is_mock`. Out-of-fence / low-accuracy / mock check-ins require a `flag_reason`
and are recorded allow-with-flag. Onboarding's GPS read fixes the geofence
centre. The server remains authoritative.

## Project layout

```
src/
  app/         App root, router, RequireAuth
  pages/       One file per screen
  components/  ui/ (Button, Card, Input, Pill, Sheet, Toast, icons…)
               layout/ (AppShell, TopBar, BottomNav, SyncIndicator, DevModeBanner)
               domain/ (OutletCard, CameraCapture, GpsReader, MiniMap, VisitStepper…)
  features/    data hooks per domain (outlet, route, catalog, order, visit)
  lib/
    api/       typed REST client (CONTRACT §4)
    bridge/    typed native-bridge client + message types
    offline/   IndexedDB schema, mutation helpers, sync engine, bootstrap, SW reg
    geo/       haversine + geofence evaluation
  stores/      session, active-visit flow
  sw.ts        custom service worker (precache + strategies + Background Sync)
  types/       enums, models, api payloads (mirror CONTRACT §2–§4, §7)
```

## Env

`VITE_API_BASE` — backend base URL (default `http://localhost:8000/api/v1`).
