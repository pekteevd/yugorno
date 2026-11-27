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
  assert.match(map, /name="photo" type="file"[^>]*multiple/);
  assert.match(map, /f\.getAll\("photo"\)/);
  assert.match(map, /payload\.photoUrls=\[\]/);
  assert.match(map, /В выбранных фотографиях не найдены GPS-координаты/);
  const addFlow = map.slice(map.indexOf("function bindAdd(){"), map.indexOf("async function loadMyPlaces()"));
  assert.doesNotMatch(addFlow, /\/impressions/);
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

test('maps support mouse-wheel zoom and resolve the U Ilem village search alias', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(map, /L\.map\("yugorno-map",\{zoomControl:true,scrollWheelZoom:true/);
  assert.match(map, /L\.map\(container,\{zoomControl:true,scrollWheelZoom:true\}/);
  assert.match(map, /\["у илем","уилем"\]\.includes\(normalizedQuery\)/);
  assert.match(map, /Уилем, Моркинский район, Республика Марий Эл/);
});

test('place geocoding is explicit, cached, throttled, and uses safe text rendering', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(map, /photon\.komoot\.io\/api/);
  assert.match(map, /geocoderCache\.get\(cacheKey\)/);
  assert.match(map, /geocoderCache\.set\(cacheKey,results\)/);
  assert.match(map, /1100-\(Date\.now\(\)-geocoderLastRequest\)/);
  assert.match(map, /item\.textContent=label/);
  assert.match(map, /locationSearch\.onclick=event=>\{event\.preventDefault\(\);searchPlaceLocation\(\)\}/);
  assert.match(map, /locationQuery\.onkeydown=event=>\{if\(event\.key==="Enter"\)\{event\.preventDefault\(\);searchPlaceLocation\(\)\}\}/);
});



test('initial place photos use the place moderation lifecycle and pending attached impressions are bundled', async () => {
  const store = await readFile(new URL('./data-store.js', import.meta.url), 'utf8');
  assert.match(store, /photoUrls = cleanImageUrls\(input\.photoUrls \|\| \[\]\)/);
  assert.match(store, /pendingImpressions: store\.impressions\.filter/);
  assert.match(store, /pendingPlaceIds = new Set/);
  assert.match(store, /impression\.status = status/);
  assert.match(store, /const place = store\.places\.find\(item => \(item\.photoUrls \|\| \[\]\)\.includes\(url\)\)/);
});

test('moderation cards show full place descriptions and group pending photos with their parent place', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(map, /map-moderation-description/);
  assert.match(map, /map-moderation-gallery/);
  assert.match(map, /map-moderation-map/);
  assert.match(map, /export\/embed\.html\?bbox=/);
  assert.match(map, /marker=/);
  assert.match(map, /Координаты места не указаны/);
  assert.match(map, /place\.pendingImpressions\|\|\[\]/);
  assert.match(map, /place\.photoUrls\|\|\[\]/);
  assert.match(map, /Дополнение к заявке на место/);
  assert.match(map, /actionMarkup\("places",place\.id\)/);
  const placeModeration = map.slice(map.indexOf("const placeCards="), map.indexOf("const looseImpressions="));
  assert.doesNotMatch(placeModeration, /actionMarkup\("impressions"/);
  assert.match(map, /Фотографии места/);
  assert.match(map, /В выбранных фотографиях не найдены GPS-координаты/);
  assert.match(map, /data-private-image=/);
  assert.match(map, /Фото недоступно для просмотра/);
});


test('journeys expose points, routes, meetings and trips using the existing published APIs', () => {
  for (const tab of ['points', 'routes', 'meetings', 'trips']) assert.match(html, new RegExp(`data-journey-tab="${tab}"`));
  for (const host of ['journey-point-list', 'journey-route-list', 'journey-meeting-list', 'journey-trip-list']) assert.ok(html.includes(`id="${host}"`));
  assert.match(html, /telegramApi\('\/api\/places'\)/);
  assert.match(html, /telegramApi\('\/api\/routes'\)/);
  assert.match(html, /telegramApi\('\/api\/trips'\)/);
  assert.match(html, /function renderJourneyPoints\(/);
  assert.match(html, /function renderJourneyRoutes\(/);
  assert.match(html, /function renderJourneyMeetings\(/);
  assert.match(html, /function renderJourneyTrips\(/);
  assert.match(html, /imageUrl:t\.imageUrl\|\|t\.imageUrls\?\.\[0\]/);
});

test('journey and map list cards render uploaded photos with a visual fallback', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(html, /journey-card-image/);
  assert.match(html, /journeyImage\(p\.photoUrls\?\.\[0\]/);
  assert.match(map, /map-place-photo/);
  assert.match(map, /p\.photoUrls\?\.\[0\]/);
  assert.match(map, /r\.stops\?\.find\(stop=>stop\.photoUrls\?\.\[0\]\)/);
  assert.match(map, /cover\?'<img class="map-place-photo"/);
});

test('journeys provide separate creation flows and moderator editing for demo destinations', async () => {
  for (const action of ["openJourneyCreate('route')", "openJourneyCreate('meeting')", "openJourneyCreate('trip')"]) assert.ok(html.includes(action));
  assert.match(html, /f-route-stop/);
  assert.match(html, /payload\.stopIds/);
  assert.match(html, /payload\.kind='Встреча'/);
  assert.match(html, /f-start-date/);
  assert.match(html, /f-end-date/);
  assert.match(html, /f-price/);
  assert.match(html, /f-capacity/);
  assert.match(html, /\/api\/admin\/destinations/);
  assert.match(html, /openDestinationEditor/);
});

test('people tab shows the saved own profile and retains demo profile cards', async () => {
  const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="people-own-profile-card"/);
  assert.match(html, /id="people-own-name"/);
  assert.match(html, /id="people-own-meta"/);
  assert.match(html, /id="people-own-interest"/);
  assert.match(html, /id="people-own-avatar"/);
  assert.match(html, /function renderOwnPeopleProfile\(/);
  assert.match(html, /renderOwnPeopleProfile\(\{name,city:p\.city\|\|'',interest:p\.interest\|\|'',imageUrl:p\.imageUrl\|\|''\}\)/);
  assert.match(html, /localStorage\.getItem\('yugorno-profile'\)/);
  for (const name of ['Алексей', 'Марина', 'Илья']) assert.match(html, new RegExp(name));
  assert.doesNotMatch(html, /profile-discoverable|loadPeopleDirectory|\/api\/people/);
});


test('journey creation uses one clear set of responsive actions and consistent trip wording', () => {
  const tripsSection = html.slice(html.indexOf('<section class="view" id="trips">'), html.indexOf('<section class="view" id="map">'));
  assert.ok(tripsSection.length > 0, 'trips section should exist');
  assert.ok(tripsSection.includes('<div class="section-head"><h3>Путешествия</h3></div>'));
  assert.ok(!tripsSection.includes('Создать путешествие'));
  assert.ok(tripsSection.includes('class="journey-create-actions"'));
  for (const label of ['Создать маршрут', 'Создать встречу', 'Создать поездку']) assert.ok(tripsSection.includes(label));
  assert.ok(html.includes('.journey-create-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0 18px}'));
  assert.ok(html.includes('@media(max-width:560px){.journey-create-actions{grid-template-columns:1fr}}'));
  assert.ok(html.includes('onclick="openModal(\'trip\')">＋ Создать поездку</button>'));
});
