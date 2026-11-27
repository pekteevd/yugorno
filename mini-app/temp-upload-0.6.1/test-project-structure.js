import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8');
const images = JSON.parse(await readFile(new URL('./public/assets/images.json', import.meta.url), 'utf8'));
const expectedImageKeys = [
  'hero', 'trip-karelia', 'trip-u-ilem', 'trip-teriberka',
  'community-u-ilem', 'community-road', 'community-trails'
];

test('keeps all seven approved sections in the Mini App', () => {
  for (const section of ['home', 'discover', 'people', 'trips', 'map', 'communities', 'profile']) {
    assert.match(html, new RegExp(`<section class="view(?: active)?" id="${section}"`));
  }
});

test('keeps the original seven photo slots in the manifest', () => {
  assert.deepEqual(Object.keys(images).sort(), [...expectedImageKeys].sort());
  for (const key of expectedImageKeys) assert.match(images[key], /^https:\/\/images\.unsplash\.com\//);
});

test('preserves CSS fallback bindings for every photo slot', () => {
  for (const key of expectedImageKeys) assert.ok(html.includes(`--image-${key}:url(`), `missing CSS image binding: ${key}`);
});

test('keeps mobile viewport metadata and responsive layout breakpoints', () => {
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1/);
  assert.match(html, /@media\(max-width:850px\)/);
  assert.match(html, /@media\(max-width:560px\)/);
});


test('includes owner management and trip detail UI flows', () => {
  for (const marker of ['openTripDetails', 'editTrip', 'unpublishTripFromList', 'loadMyCommunities', 'showCommunityMembers', 'removeCommunityMemberFromList', 'unpublishCommunityFromList']) {
    assert.ok(html.includes(marker), `missing UI flow: ${marker}`);
  }
  assert.match(html, /id="my-communities-panel"/);
  assert.match(html, /id="my-trip-list"/);
});


test('protects owner management routes with Telegram authentication middleware', async () => {
  const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  for (const route of [
    'app.patch("/api/my/trips/:id", requireTelegramUser',
    'app.delete("/api/my/trips/:id", requireTelegramUser',
    'app.patch("/api/my/communities/:id", requireTelegramUser',
    'app.delete("/api/my/communities/:id", requireTelegramUser',
    'app.get("/api/my/communities/:id/members", requireTelegramUser',
    'app.delete("/api/my/communities/:id/members/:memberId", requireTelegramUser'
  ]) assert.ok(server.includes(route), `missing auth guard: ${route}`);
});


test('supports local Mini App testing without a second Telegram polling process', async () => {
  const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  const env = await readFile(new URL('./.env.example', import.meta.url), 'utf8');
  assert.match(server, /DISABLE_BOT_POLLING === "true"/);
  assert.match(server, /else if \(botPollingDisabled\)/);
  assert.match(server, /botPollingEnabled: botEnabled && !botPollingDisabled/);
  assert.match(env, /DISABLE_BOT_POLLING=false/);
});


test('opens every editorial trip card into a real detail view, not a demo toast', () => {
  assert.match(html, /function openTripPreview\(slug\)/);
  assert.match(html, /onclick="openTripPreview\('/);
  assert.doesNotMatch(html, /Это пример оформления, а не опубликованная поездка/);
  assert.doesNotMatch(html, /Это демонстрационная карточка/);
});

test('static people and community cards open informative profiles', () => {
  assert.match(html, /function openPersonPreview\(/);
  assert.match(html, /function openCommunityPreview\(/);
  assert.doesNotMatch(html, /Связь с участниками появится после регистрации/);
});

test('supports explicitly enabled loopback-only local testing', async () => {
  const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  assert.match(server, /LOCAL_DEMO_MODE === "true" \|\| !botEnabled/);
  assert.match(server, /loopbackHost && loopbackRemote/);
  assert.match(server, /X-Local-Demo-User/);
  assert.match(server, /localDemoEnabled && !botEnabled \? "127.0.0.1"/);
});

test('description previews can open a dedicated full page and return to the previous section', () => {
  assert.match(html, /id="detail-page"/);
  assert.match(html, /Открыть страницу целиком/);
  assert.match(html, /function openDetailPage\(/);
  assert.match(html, /function closeDetailPage\(/);
  assert.match(html, /addEventListener\('popstate'/);
  assert.match(html, /detail-description/);
  assert.match(html, /data\.description\|\|'Описание пока не добавлено'/);
});

test('published communities and trips expose full descriptions and full-page actions', () => {
  assert.match(html, /showInfoModal\(c\.title/);
  assert.match(html, /type:'community',id:c\.id/);
  assert.match(html, /type:'trip',id:trip\.id/);
});


test('production deployment requires a bot token and reports the correct release version', async () => {
  const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  const env = await readFile(new URL('./.env.example', import.meta.url), 'utf8');
  assert.match(server, /NODE_ENV === "production" && !botEnabled/);
  assert.match(server, /BOT_TOKEN is required in production/);
  assert.match(server, /version: "0.6.1"/);
  assert.match(env, /NODE_ENV=production/);
  assert.match(env, /BOT_TOKEN=paste_your_bot_token_here/);
});

test('uploaded images are stored outside the application code in the persistent upload directory', async () => {
  const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  const env = await readFile(new URL('./.env.example', import.meta.url), 'utf8');
  assert.match(server, /const UPLOADS_DIR = path\.resolve\(process\.env\.YUGORNO_UPLOAD_DIR/);
  assert.match(server, /express\.static\(UPLOADS_DIR/);
  assert.match(server, /writeFile\(path\.join\(targetDir, filename\)/);
  assert.match(server, /const targetDir = isPrivate \? PRIVATE_UPLOADS_DIR : UPLOADS_DIR/);
  assert.match(env, /YUGORNO_UPLOAD_DIR=\/data\/uploads/);
});


test('loads the local EXIF GPS reader before the map interface and strips metadata by re-encoding', async () => {
  const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8');
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  const parser = await readFile(new URL('./public/exif-gps.js', import.meta.url), 'utf8');
  assert.ok(html.indexOf('/exif-gps.js') < html.indexOf('/map.js'));
  assert.match(parser, /readPhotoGps/);
  assert.match(map, /YugornoExifGps\?\.readPhotoGps/);
  assert.match(map, /canvas\.toDataURL\("image\/jpeg",0\.82\)/);
});


test('route builder preserves the order in which the user selects stops', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(map, /selectedStopIds\.push\(input\.value\)/);
  assert.match(map, /stopIds:selectedStopIds/);
  assert.match(map, /route-stop-order/);
});


test('GPS mismatch warnings use the Telegram confirmation dialog when available', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(map, /window\.askConfirm/);
  assert.match(map, /await askUserConfirmation/);
});



test('server permits geolocation only for the same-origin app while keeping camera and microphone disabled', async () => {
  const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  assert.match(server, /Permissions-Policy", "camera=\(\), microphone=\(\), geolocation=\(self\)"/);
});

test('place creation selects coordinates by search, map click, or device GPS without manual coordinate entry', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(map, /id="place-location-query"/);
  assert.match(map, /id="place-location-search"/);
  assert.match(map, /id="place-location-map"/);
  assert.match(map, /id="place-location-gps"/);
  assert.match(map, /placePickerClickHandler=event=>/);
  assert.match(map, /mouseEventToLatLng\(event\)/);
  assert.match(map, /removeEventListener\("click",placePickerClickHandler\)/);
  assert.match(map, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(map, /name="lat"><input type="hidden" name="lng"/);
  assert.doesNotMatch(map, /name="lat" type="number"[^>]*required/);
  assert.doesNotMatch(map, /name="lng" type="number"[^>]*required/);
});

test('place picker uses a native container click handler and cleans it up', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(map, /clickContainer\.addEventListener\("click",placePickerClickHandler\)/);
  assert.match(map, /mouseEventToLatLng\(event\)/);
  assert.match(map, /removeEventListener\("click",placePickerClickHandler\)/);
});

test('place geocoder falls back from Photon to OpenStreetMap Nominatim', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(map, /photon\.komoot\.io\/api/);
  assert.match(map, /nominatim\.openstreetmap\.org\/search/);
  assert.match(map, /await fetchPlaceGeocoding\(query\)/);
  assert.match(map, /geocoderCache\.set\(cacheKey,results\)/);
});

test('place geocoding is explicit, cached, throttled, and uses safe text rendering', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(map, /photon\.komoot\.io\/api/);
  assert.match(map, /geocoderCache\.get\(cacheKey\)/);
  assert.match(map, /geocoderCache\.set\(cacheKey,results\)/);
  assert.match(map, /1100-\(Date\.now\(\)-geocoderLastRequest\)/);
  assert.match(map, /item\.textContent=label/);
  assert.match(map, /place-location-search.*onclick=searchPlaceLocation/s);
});
