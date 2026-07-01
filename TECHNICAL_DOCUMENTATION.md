# LingoLoop Technical Documentation

## Overview

LingoLoop is a browser-based language practice platform with live rooms, WebRTC voice/screen sharing, WebSocket chat, Firebase authentication, moderation, social posting, blogs, notifications, premium gating, and monetization surfaces.

## Runtime

- Frontend: static HTML, CSS, and vanilla JavaScript.
- Backend: Node.js HTTP server in `server.js`.
- Real-time layer: WebSocket server on `/ws`.
- Auth: Firebase Auth from `auth.js`.
- Data persistence: local JSON files for prototype data, plus Firebase Realtime Database/Auth for user identity metadata.

## Main Files

- `index.html`: main UI and all app sections.
- `server.js`: HTTP API, WebSocket, channels, moderation, study helper proxy, social/blog/news APIs.
- `auth.js`: Firebase auth, Google/email sign-in, handles, avatars, profile photo upload, metadata/location capture.
- `app.js`: rooms, WebRTC voice, screen share, activities, Pomodoro, moderation, channel cards.
- `friend-chat.js`: friend chat, WebSocket client, notifications, FCM permission flow.
- `community.js`: LingoShouts, blogs, payout info, trusted news.
- `study-bot.js`: premium/trial-gated study helper.
- `monetization.js`: ad-free subscription state, crypto placeholder, premium unlock.

## Authentication

Firebase Auth supports:

- Email/password accounts.
- Google sign-in.
- Linking Google to existing email accounts.
- Profile display name/photo.
- Auto-generated unique handles such as `@name_24`.
- User-changeable handles with uniqueness checks through `/api/users/:uid/handle`.

## User Profiles

Profiles include:

- Avatar/profile image.
- Unique `@id`.
- Behaviour points.
- Channels created.
- Private todo/reminder dashboard.
- Public member page.

Profile image upload currently stores a small data URL in Firebase Auth `photoURL`. Production should use Firebase Storage.

## Channels

Channels are persisted in `channels.json` and expire after 3 inactive days. A channel includes:

- Name
- Language
- Level
- Member limit
- Creator metadata
- Last activity/expiry time

Channel deletion broadcasts a `channel-deleted` WebSocket event so other clients remove the deleted room in real time.

## Voice and Screen Sharing

Voice uses WebRTC peer connections with server-assisted signaling:

- `/api/reserve`
- `/api/join`
- `/api/signal`
- `/api/signals`

Screen sharing uses `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`.

Device/system audio is muted by default and can be toggled with the screen audio button.

## Channel Activities

Activities use the WebSocket `channel-activity` event.

Current channel activities:

- External free game hub: Lichess, PlayingCards.io, Skribbl.io.
- Drawing board.
- Screen share.
- Pomodoro timer.

Pomodoro timers are individual per member but visible to the room in real time.

## Chat and Moderation

Direct and channel chat use WebSocket messages.

Safety features:

- Profanity masking to `****`.
- Strike warnings.
- 3 strikes suspend chat for 30 minutes.
- Behaviour points start at 5000.
- Bad behaviour deducts 200 points.
- If points drop below 2000, text chat is locked.
- Each clean day awards +300 points, capped at 10000.

## Ban System

Room hosts can:

- Mute
- Remove
- Ban

Ban logic stores:

- User/client ban for the room.
- Public IP hash ban when available.

Private/local IPs are not globally banned to avoid locking out local development.

## Study Helper

The study helper calls the backend route:

- `POST /api/study-bot`

The backend uses Hugging Face when `HUGGINGFACE_API_KEY` exists in `.env`.

The helper has:

- 30-day no-card free trial.
- Premium gating after trial.
- Subscription unlock through local premium state for prototype.

## Social: LingoShouts

LingoShouts are short student progress posts.

API:

- `GET /api/lingoshouts`
- `POST /api/lingoshouts`
- `PATCH /api/lingoshouts/:id`

Supported actions:

- Like
- Unlike
- Comment
- Share link

## Blogs and Creator Revenue

Blogs are longer student posts.

API:

- `GET /api/blogs`
- `POST /api/blogs`
- `PATCH /api/blogs/:id`
- `POST /api/payout-info`

Blog ad revenue is intentionally separate from platform ad revenue.

Only blog creators can earn from blog ads. Readers do not earn money. The current business rule is:

- Creator receives 80% of their blog ad revenue.
- Platform keeps 20%.
- For now, only European creators are eligible for payouts.
- Creators provide IBAN, country, and legal name.

## Monetization

Monetization surfaces:

- Google ad slot below navigation.
- Left ad rail.
- In-page ad sections.
- Blog-specific ad slots.
- EUR5/month ad-free subscription.
- Crypto payment placeholder.

Real payment providers still need production integration, such as Stripe, PayPal, Coinbase Commerce, NOWPayments, or Binance Pay.

## News

Logged-in users can see trusted headlines from:

- BBC RSS
- Al Jazeera RSS

API:

- `GET /api/news`

Headlines link directly to the original news website.

## Notifications

Browser notifications:

- Permission is requested after login once per user.
- Direct messages and app notifications can trigger browser notifications.

FCM:

- Service worker exists as `firebase-messaging-sw.js`.
- VAPID key UI exists in notification settings.
- Full production FCM requires Firebase Web Push VAPID setup and token registration.

## SEO

SEO additions:

- Meta robots.
- Open Graph tags.
- Twitter card.
- JSON-LD WebApplication schema.
- `robots.txt`.
- `sitemap.xml`.
- Smooth anchor scrolling.

Replace `https://lingoloop.example/` in SEO files with the production domain before launch.

## Security and Production Notes

Before production:

- Move uploaded profile pictures to Firebase Storage.
- Replace JSON-file storage with Firestore/Realtime Database or a SQL database.
- Add server-side auth verification for all write APIs.
- Add rate limits.
- Configure real FCM token registration.
- Configure payment providers.
- Configure real AdSense IDs.
- Add privacy policy, cookie policy, and creator payout terms.
- Review GDPR compliance for IP/location/payout data.
