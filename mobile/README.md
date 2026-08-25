# DrinkedInn — Mobile App

React Native (Expo SDK 54) social app for iOS + Android. Talks to the **live production API**
at `https://www.drinkedinn.com/api` — no backend changes required.

## Run it

```bash
cd mobile
npm install
npx expo start
```

Then scan the QR code with **Expo Go** (iOS App Store / Google Play). Or press `i` for the
iOS simulator, `a` for an Android emulator.

> Note: the API host is pinned to `www.drinkedinn.com` in `src/api.js`. The bare domain
> 307-redirects and browsers/clients drop the `Authorization` header across that hop.

## What's in it

| Screen | File | Notes |
|---|---|---|
| Auth | `src/screens/AuthScreen.js` | Login + register, 18+ date-of-birth gate |
| Feed | `src/screens/FeedScreen.js` | Stories row, skeletons, pull-to-refresh, staggered reveals |
| Composer | `src/screens/CreatePostScreen.js` | Photo upload, drink picker, location |
| Explore | `src/screens/ExploreScreen.js` | Discover + connect, live search |
| Activity | `src/screens/NotificationsScreen.js` | Batched notifications ("X and 3 others") |
| Profile | `src/screens/ProfileScreen.js` | Own + others, stats, streak, connect |
| Post detail | `src/screens/PostDetailScreen.js` | Comments thread |

## The polish

- **Double-tap to cheer** with a heart-pop burst + success haptic (`PostCard.js`)
- **Frosted-glass floating tab bar** with a gradient compose FAB (`navigation/BlurTabBar.js`)
- **Spring press feedback** on every tappable surface (`components/Bounce.js`)
- **Gradient story rings** (`components/Avatar.js`, `StoryRow.js`)
- **Shimmer skeletons** instead of spinners (`components/Skeleton.js`)
- **Staggered list reveals** (`components/FadeInItem.js`)
- Haptics throughout — light on tap, medium on commit, success on cheer

Design tokens live in `src/theme.js` — one committed dark theme: bar-at-night
charcoal-navy, whisky amber accent, LinkedIn blue as the secondary.

## Ship it to the stores

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios      # or android
eas submit --platform ios
```

## Verified

- `npx expo-doctor` → 18/18 checks pass
- `npx expo export` → bundles clean (891 modules)
