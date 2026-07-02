# LingoLoop Technical Documentation

## Overview

LingoLoop is a browser-based language practice platform with live rooms, WebRTC voice/screen sharing, WebSocket chat, Firebase authentication, moderation, social posting, blogs, notifications, premium gating, and monetization surfaces.

The current project is intentionally a legacy single-service application. It is not using the abandoned microservice split. The frontend, API routes, WebSocket server, static assets, and prototype JSON persistence all run from the same Node.js service.

## Runtime

- Frontend: static HTML, CSS, and vanilla JavaScript.
- Backend: Node.js HTTP server in `server.js`.
- Real-time layer: WebSocket server on `/ws`.
- Auth: Firebase Auth from `auth.js`.
- Data persistence: local JSON files for prototype data, plus Firebase Realtime Database/Auth for user identity metadata.
- Container runtime: Docker using `Dockerfile`.
- Render deployment: Docker web service configured by `render.yaml`.

The server reads:

- `PORT`, default `4173`.
- `HOST`, default `0.0.0.0`.
- `DATA_DIR`, default project root locally, `/app/data` in Docker/Render.

The app binds to `0.0.0.0` so it can run inside Docker containers and Render. Local browser access remains `http://localhost:4173`.

## Main Files

- `index.html`: main UI and all app sections.
- `server.js`: HTTP API, WebSocket, channels, moderation, study helper proxy, social/blog/news APIs.
- `auth.js`: Firebase auth, Google/email sign-in, handles, avatars, profile photo upload, metadata/location capture.
- `app.js`: rooms, WebRTC voice, screen share, activities, Pomodoro, moderation, channel cards.
- `friend-chat.js`: friend chat, WebSocket client, notifications, FCM permission flow.
- `community.js`: LingoShouts, blogs, payout info, trusted news.
- `study-bot.js`: premium/trial-gated study helper.
- `monetization.js`: ad-free subscription state, crypto placeholder, premium unlock.
- `Dockerfile`: production container build for the legacy Node app.
- `docker-compose.yml`: local Docker Compose setup with persistent volume.
- `render.yaml`: Render Blueprint/Docker deployment definition.
- `.dockerignore`: excludes local dependencies, secrets, and generated runtime files from the container image.

## Architecture Boundary

The app currently follows this shape:

```text
Browser
  -> static files from Node server
  -> HTTP API routes in server.js
  -> WebSocket /ws in server.js
  -> Firebase Auth / Realtime Database from browser modules
  -> Hugging Face through backend proxy route
```

There is no separate frontend service, no separate API service, and no FastAPI backend in the current legacy version.

## Docker

Docker support is provided for the legacy single-service app.

Files:

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

Build and run locally:

```bash
docker compose up --build
```

Open:

```text
http://localhost:4173
```

Stop:

```bash
docker compose down
```

View logs:

```bash
docker compose logs -f
```

The container uses Node.js 20 Alpine, installs production dependencies with `npm ci --omit=dev`, exposes port `4173`, and includes a health check against `/`.

The `.env` file is not copied into the image. Docker Compose passes `.env` at runtime through `env_file`.

## Render Deployment

Render deployment is configured through `render.yaml`.

Render service settings:

- Type: web service.
- Runtime: Docker.
- Plan: starter.
- Region: Frankfurt.
- Dockerfile: `./Dockerfile`.
- Health check path: `/`.
- Auto deploy: on commit.
- Persistent disk: `lingoloop-data`, mounted at `/app/data`.

Required Render environment variables:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=4173`
- `DATA_DIR=/app/data`
- `HUGGINGFACE_API_KEY` as a secret value.
- `HUGGINGFACE_MODEL=meta-llama/Meta-Llama-3-8B-Instruct`

Deployment flow:

1. Push the project to GitHub.
2. Open Render Dashboard.
3. Create a new Blueprint.
4. Connect the GitHub repository.
5. Let Render read `render.yaml`.
6. Add the secret `HUGGINGFACE_API_KEY`.
7. Deploy.

After deployment, add the Render domain to:

- Firebase Authentication authorized domains.
- Google sign-in provider configuration if needed.
- Google AdSense site verification.
- SEO files such as `sitemap.xml` and canonical domain values.

## Persistent Data

Prototype runtime data is stored in JSON files. Locally, files live in the project root unless `DATA_DIR` is set. In Docker and Render, the files are stored in `/app/data`.

JSON data files include:

- `community-scores.json`
- `chat-blocks.json`
- `user-identities.json`
- `channels.json`
- `friend-requests.json`
- `notification-tokens.json`
- `ip-bans.json`
- `lingoshouts.json`
- `blogs.json`
- `creator-payouts.json`
- `behavior-rewards.json`

On Render, `/app/data` is backed by the persistent disk configured in `render.yaml`. This keeps prototype data across restarts and deploys.

For production, this JSON persistence should be replaced with a managed database.

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
