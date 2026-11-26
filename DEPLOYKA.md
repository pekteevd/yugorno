# Yugorno 0.6.1 on Deployka

This repository is prepared for a container build from its root. The root Dockerfile copies and runs the application from `mini-app/temp-upload-0.6.1`. Deploy the branch `temp-upload-miniapp-061`, not `main`.

## Deployka project settings

- Source: GitHub
- Repository: `https://github.com/pekteevd/yugorno`
- Branch: `temp-upload-miniapp-061`
- Build: use the repository-root `Dockerfile`
- Start command: Dockerfile default (`npm start`); do not override unless Deployka requires it
- Instance count: one only (the JSON store is not multi-instance safe)
- HTTP port: use the platform-provided `PORT`; do not hard-code a port in Deployka

## Environment

Required:
- `NODE_ENV=production`
- `BOT_TOKEN` = real token entered only in Deployka's secret ENV editor
- `BOT_USERNAME=YugornoTravelBot`

After Deployka assigns the public HTTPS address:
- `WEBAPP_URL` = that exact public HTTPS address

Persistent storage:
- `YUGORNO_DATA_DIR=/data`
- `YUGORNO_UPLOAD_DIR=/data/uploads`

Use these paths only when the project has persistent storage mounted at `/data`. Confirm the mount in the Deployka project settings before starting production.

Polling:
- `DISABLE_BOT_POLLING=false` only if this instance is the sole process calling Telegram `getUpdates`.
- Set `DISABLE_BOT_POLLING=true` if another known instance is still polling. This keeps Mini App authentication and Bot API notifications enabled, but this instance will not answer `/start`.
- Never run two polling instances with the same bot token.

Optional:
- `TELEGRAM_AUTH_MAX_AGE_SECONDS=86400`

Do not set `PORT` manually. Do not add `.env`, bot tokens, or other secrets to GitHub.

## Checks after deployment

1. Open `https://<assigned-host>/health`; expect `ok: true` and `version: "0.6.1"`.
2. Open `/api/status`; confirm bot and Mini App configuration.
3. Open the Mini App from Telegram and test Telegram login.
4. Create a test trip/community and upload an image.
5. Restart the project and confirm the created records and uploaded image still exist.

## Known limits

- JSON file storage supports one active server process and one instance, not horizontal scaling.
- The persistent volume must be confirmed and backed up separately.
- Telegram `initData` is verified server-side using `BOT_TOKEN`.
- Deployment is not performed by this preparation commit. Keep `main` unchanged.
