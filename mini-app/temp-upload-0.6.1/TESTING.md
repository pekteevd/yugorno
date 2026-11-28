# Yugorno automated browser tests

The browser suite starts its own local server with isolated temporary data. It never uses the normal application data directory, production credentials, Telegram polling, or Deployka.

## One-time setup

Run from this directory:

    npm.cmd install
    npx.cmd playwright install chromium

## Run

    npm.cmd test
    npm.cmd run test:browser

Or run both layers:

    npm.cmd run test:all

The browser suite currently covers:
- local administrator login and role display;
- opening the moderation tools and queue;
- authenticated moderation/admin API responses;
- map loading and map-point selection;
- geocoder fallback from Photon to Nominatim;
- creating a place and moving it to, then restoring it from, the trash;
- map controls remaining available when the Leaflet CDN is unavailable.

Each run uses a random localhost port and fresh temporary storage, then shuts down its test server and removes only its own temporary data.
