# Lifebookz Mobile (React Native / Expo)

The native mobile app for the Lifebookz reader experience — the React Native
counterpart of [web/client](../../web/client). Built with Expo SDK 54,
expo-router, TypeScript, React Query, and a clean RSA: it reuses the same REST
API, routes, and credential lifecycle as the web client.

## Screens

| Route | Screen |
| --- | --- |
| `(tabs)/index` | Home — hero, consult promo, latest stories rail |
| `(tabs)/stories` | Explore — paged story feed with author filters |
| `(tabs)/trending` | Trending stories |
| `(tabs)/consult` | Expert matching: describe a problem, get matches, request a session |
| `(tabs)/profile` | Signed-in profile, quick links, sign out |
| `story/[slug]` | Story reader — chapters, optimistic like, comments |
| `author/[id]` | Author profile and their published lifebooks |
| `bookings` | My sessions — join (payment handoff), cancel, rate |
| `login` / `register` / `forgot-password` | Auth screens |

## Getting started

```bash
cd mobile/client
npm install
cp .env.example .env      # then adjust EXPO_PUBLIC_* if needed
npx expo start            # then press i / a, or scan with Expo Go
```

Point `EXPO_PUBLIC_BACKEND_URL` at the backend (`backend/`, default port 5000):

- Android emulator: `http://10.0.2.2:5000`
- iOS simulator: `http://localhost:5000`
- Physical device on the same Wi-Fi: your machine's LAN IP, e.g. `http://192.168.1.10:5000`

## Architecture

```
src/
  config/api.ts       Axios client — JWT injected from expo-secure-store,
                      stale-token cleanup on 401
  api/consultation.ts Consultation endpoints (match, request, mine, rating)
  components/         ui.tsx primitives + StoryCard + toast provider
  utils/              feedFilters, consult categories, helpers, handoff
  theme.ts            Light/dark tokens
app/                  expo-router file tree (tabs + stack screens)
```

Key decisions:

- **Branding comes from the web client.** `logo.png`, `hero.png`,
  `consult.png`, and the default `user.png` are copied from
  `web/client/public/` into `assets/images/` and reused across the home hero,
  auth screens, consult header, and app icon/splash.
- **Tokens live in `expo-secure-store`** (Keychain / Keystore), never in
  AsyncStorage — the mobile equivalent of the web client's httpOnly-grade
  localStorage handling.
- **Portal handoff reuses the web ticket flow.** Payment and live sessions run
  on their own portals; the app mints a one-time ticket via
  `POST /consultations/handoff` and opens the portal URL (hash `#tk=`) in the
  system browser (`expo-web-browser`), so no credentials are duplicated.
- **React Query** owns server state (stories, comments, bookings, trending) so
  screens stay declarative; local UI state stays in components.
- **Payload shapes are normalized** — the API returns media fields (avatar,
  banner, cover) as `{ url, key }` objects; `mediaUrl()` normalizes them for
  every render path.

## Build for stores

```bash
npx eas build --platform android   # APK/AAB
npx eas build --platform ios       # IPA (Apple developer account required)
```

Configure `eas.json` when you're ready — see https://docs.expo.dev/build/introduction/.
