# LingoLoop

A responsive front-end concept for a global, live language-practice community.

Run `npm install` once, then `npm start` and open `http://localhost:4173`.

For authentication, add your Firebase Web App values to `firebase-config.js` and enable Email/Password plus Google in Firebase Authentication -> Sign-in method.

## Run with Docker

Build and start the legacy app:

```bash
docker compose up --build
```

Then open `http://localhost:4173`.

The container uses the same single Node.js legacy app. It does not use the removed microservice architecture.

Runtime JSON data is stored in the Docker volume `lingoloop-data` at `/app/data`, so rooms, shouts, blogs, scores, bans, and requests can survive container restarts.

If you use Hugging Face, keep `HUGGINGFACE_API_KEY` in your local `.env` file. Docker Compose reads `.env` at runtime, but `.env` is not copied into the Docker image.

Useful commands:

```bash
docker compose up --build
docker compose down
docker compose logs -f
```

## Deploy on Render

This repo includes `render.yaml`, so the easiest path is a Render Blueprint deploy:

1. Push this project to a GitHub repository.
2. Open Render Dashboard.
3. Choose **New** -> **Blueprint**.
4. Connect the GitHub repository.
5. Render will read `render.yaml` and create the Docker web service.
6. Add the secret environment variable `HUGGINGFACE_API_KEY` when Render asks for it.
7. Deploy.

After deploy, copy your Render URL, for example `https://your-app.onrender.com`, and add that domain in:

- Firebase Authentication -> Settings -> Authorized domains
- Google sign-in provider settings, if needed
- Google AdSense site verification

The Render service uses a persistent disk mounted at `/app/data` so JSON runtime data can survive deploys and restarts.

To verify the latest Google auth fix is live, open your deployed page source and confirm it contains:

```html
auth.js?v=20260705-redirect-only
```

In the browser console, this should also exist:

```js
window.lingoAuthBuild
```

It should print:

```text
20260705-redirect-only-google-auth
```

## Included

- Responsive landing page and live-room directory
- Language filters and room search
- Interactive join feedback
- Create-room modal with form handling
- Accessible navigation, labels, dialog behavior, and keyboard dismissal
- Firebase email/password and Google authentication
- Random starter avatars with profile customization
- Persistent Material light and dark themes
- WebSocket friend messaging with emoji and file sharing
