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
  assert.match(map, /Просмотреть маршрут на карте/);
  assert.match(map, /data-mod-preview-route/);
  assert.match(map, /renderRouteOnMap\(route\)/);
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
  assert.match(html, /function journeyFirstPhoto\(item\)\{return item\?\.imageUrl\|\|item\?\.imageUrls\?\.\[0\]\|\|item\?\.photoUrls\?\.\[0\]/);
  assert.match(map, /map-place-photo/);
  assert.match(map, /p\.photoUrls\?\.\[0\]/);
  assert.match(map, /const cover=r\.stops\?\.find\(stop=>stop\.photoUrls\?\.\[0\]\)\?\.photoUrls\?\.\[0\];const preview=cover\?/);
  assert.match(map, /const preview=cover\?'<img class="map-place-photo"/);
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
  assert.ok(html.includes('.journey-create-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 16px}'));
  assert.ok(html.includes('.journey-create-actions .btn{width:100%;min-height:36px;padding:7px 10px;font-size:13px;line-height:1.2;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}'));
  assert.ok(html.includes('@media(max-width:560px){.journey-create-actions{grid-template-columns:1fr;gap:7px}.journey-create-actions .btn{min-height:36px;justify-content:flex-start;padding:7px 12px}}'));
  for (const icon of ['🧭', '🤝', '🎒']) assert.ok(tripsSection.includes(icon), `creation action should include ${icon}`);
  assert.ok(!tripsSection.includes('Создать путешествие'));
  assert.match(html, /f-meeting-date/);
  assert.match(html, /f-meeting-time/);
  assert.match(html, /Продолжительность:/);
  assert.ok(html.includes('inputmode="numeric" pattern="[0-9]*"'));
  assert.match(html, /date:startDate&&endDate\?startDate\+' – '\+endDate/);
  assert.match(html, /Дата окончания не может быть раньше даты начала/);
});

test('owner editing APIs enforce ownership for routes and impressions and re-submit edits for moderation', async () => {
  const store = await readFile(new URL('./data-store.js', import.meta.url), 'utf8');
  const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  for (const marker of ['export async function listMyRoutes(userId)', 'export async function updateRoute(userId, routeId, input = {})', 'export async function listMyImpressions(userId)', 'export async function updateImpression(userId, impressionId, input = {})']) {
    assert.ok(store.includes(marker), `missing owner operation: ${marker}`);
  }
  assert.match(store, /item\.authorId === String\(userId\)/);
  assert.match(store, /route\.authorId === String\(userId\)/);
  assert.match(store, /status: "pending"/);
  for (const route of [
    'app.get("/api/my/routes", requireTelegramUser',
    'app.patch("/api/my/routes/:id", requireTelegramUser',
    'app.get("/api/my/impressions", requireTelegramUser',
    'app.patch("/api/my/impressions/:id", requireTelegramUser'
  ]) assert.ok(server.includes(route), `missing authenticated owner route: ${route}`);
});

test('map owner tools expose edit actions for places, routes and impressions', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  for (const marker of ['loadMyPublications', 'editOwnPlace', 'editOwnRoute', 'editOwnImpression', '/api/my/places/', '/api/my/routes/', '/api/my/impressions/']) {
    assert.ok(map.includes(marker), `missing map owner editor: ${marker}`);
  }
  assert.match(map, /data-owner-edit/);
  assert.match(map, /removePhotos/);
});

test('journey and map cards use photo covers or genuine coordinate-based previews', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(html, /function journeyPointMap\(/);
  assert.match(html, /function journeyRouteMap\(/);
  assert.match(html, /journeyRouteMap\(r\)/);
  assert.match(html, /journeyPointMap\(p\)/);
  assert.match(map, /function miniMapPreview\(/);
  assert.match(map, /function routeSchematic\(/);
  assert.match(map, /miniMapPreview\(p\.lat,p\.lng,p\.title\)/);
  assert.match(map, /routeSchematic\(r\)/);
  assert.match(html, /f-existing-photo-gallery/);
  assert.match(html, /f-remove-photo/);
  assert.match(html, /function journeyFirstPhoto\(item\)/);
  assert.match(html, /const image=photo\?journeyImage\(photo,r\.title\):\(journeyRouteMap\(r\)/);
  assert.match(html, /image:photo\?journeyImage\(photo,t\.title\):\(journeyPointMap\(t\)/);
});

test('meetings require a selected map location and retain coordinates while editing', async () => {
  const store = await readFile(new URL('./data-store.js', import.meta.url), 'utf8');
  assert.match(html, /f-meeting-location-search/);
  assert.match(html, /searchMeetingLocation/);
  assert.match(html, /payload\.lat=meetingLat;payload\.lng=meetingLng/);
  assert.match(html, /Найдите место встречи на карте перед сохранением/);
  assert.match(html, /activeEditIsMeeting/);
  assert.match(html, /journeyPointMap\(t\)/);
  assert.match(store, /lat: validCoordinate\(input\.lat, -90, 90\), lng: validCoordinate\(input\.lng, -180, 180\)/);
  assert.match(store, /lat: item\.lat \?\? null, lng: item\.lng \?\? null/);
});

test('map cards and journey cards open the full publication from cover and title', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(html, /journey-card-media-open/);
  assert.match(html, /journey-card-title/);
  assert.match(map, /function mapCardMedia\(/);
  assert.match(map, /class="map-card-open"/);
  assert.match(map, /data-open-meeting/);
  assert.match(map, /data-meeting=/);
});

test('place editor supports map-based location changes without manual coordinate typing', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(map, /function editOwnPlace\(/);
  assert.match(map, /id="place-location-map"/);
  assert.match(map, /document\.getElementById\("owner-edit-form"\)/);
  assert.match(map, /coordinateAccuracy:form\.get\("coordinateAccuracy"\)/);
  assert.match(map, /miniMapPreview\(item\.placeLat,item\.placeLng,item\.placeTitle\)/);
});

test('owner publications support a recoverable trash across all publication types', async () => {
  const store = await readFile(new URL('./data-store.js', import.meta.url), 'utf8');
  const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8');
  for (const kind of ['place', 'route', 'impression', 'trip', 'community']) assert.match(store, new RegExp(kind + ':'));
  for (const marker of ['export async function trashPublication', 'export async function restorePublication', 'export async function listMyTrash', 'item.status = "deleted"', 'item.deletedFromStatus']) assert.ok(store.includes(marker), 'missing trash lifecycle: ' + marker);
  assert.match(store, /status !== "deleted"/);
  assert.match(server, /app\.get\("\/api\/my\/trash", requireTelegramUser/);
  assert.match(server, /app\.delete\("\/api\/my\/publications\/:kind\/:id", requireTelegramUser/);
  assert.match(server, /app\.post\("\/api\/my\/trash\/:kind\/:id\/restore", requireTelegramUser/);
  assert.match(map, /async function loadMyPublications\(\)/);
  assert.match(map, /async function loadMyTrash\(\)/);
  assert.match(map, /data-owner-trash/);
  assert.match(map, /data-trash-restore/);
  assert.match(html, /Переместить путешествие или встречу в корзину/);
  assert.match(html, /Переместить сообщество в корзину/);
});


test('map trash controls use the shared confirmation and toast helpers and publication photos keep a portrait-friendly ratio', async () => {
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  assert.match(map, /function showToast\(message\)\{if\(typeof window\.toast==="function"\)window\.toast\(message\)/);
  assert.match(map, /async function askUserConfirmation\(message\)\{if\(typeof window\.askConfirm==="function"\)return window\.askConfirm\(message\)/);
  assert.match(map, /\.map-place-card>\.map-place-photo\{height:auto;aspect-ratio:4\/3;max-height:220px/);
});

test('server exposes explicit guest, member, moderator and admin session roles', async () => {
  const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  const env = await readFile(new URL('./.env.example', import.meta.url), 'utf8');
  assert.match(server, /YUGORNO_ADMIN_IDS/);
  assert.match(server, /function userRole\(userId\)/);
  assert.match(server, /app\.get\("\/api\/session"/);
  assert.match(server, /role: "guest"/);
  assert.match(server, /role !== "admin" && role !== "moderator"/);
  assert.match(env, /YUGORNO_ADMIN_IDS=/);
});


test('local publication cleanup is guarded, backed up and preserves the three featured destinations', async () => {
  const script = await readFile(new URL('./scripts/clean-local-publications.js', import.meta.url), 'utf8');
  const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['reset:local-publications'], 'node scripts/clean-local-publications.js');
  assert.match(script, /NODE_ENV === "production" \|\| process\.env\.BOT_TOKEN/);
  assert.match(script, /copyFile\(dataFile, backupFile\)/);
  assert.match(script, /const publicationCollections = \["trips", "communities", "places", "impressions", "routes"\]/);
  assert.match(script, /\["karelia", "teriberka", "u-ilem"\]/);
  assert.doesNotMatch(script, /store\.profiles\s*=/);
  assert.match(script, /Резервная копия/);
});

test('featured destinations can be edited only by configured admins or moderators', async () => {
  const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  const store = await readFile(new URL('./data-store.js', import.meta.url), 'utf8');
  assert.match(server, /YUGORNO_ADMIN_IDS/);
  assert.match(server, /YUGORNO_MODERATOR_IDS/);
  assert.match(server, /app\.patch\("\/api\/admin\/destinations\/:slug", requireTelegramUser, requireMapModerator/);
  assert.match(server, /if \(role !== "admin" && role !== "moderator"\)/);
  assert.match(store, /const allowed = new Set\(DEFAULT_FEATURED_DESTINATIONS\.map\(item => item\.slug\)\)/);
});


test('public website supports guest browsing and authenticated account controls', async () => {
  const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8');
  const map = await readFile(new URL('./public/map.js', import.meta.url), 'utf8');
  const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  assert.match(html, /Вы просматриваете Югорно как гость/);
  assert.match(html, /function renderAccountState/);
  assert.match(html, /function requestWhatsappCode/);
  assert.match(html, /function verifyWhatsappCode/);
  assert.match(html, /function logoutAccount/);
  assert.match(html, /localStorage\.setItem\('yugorno-session'/);
  assert.match(html, /X-Yugorno-Session/);
  assert.match(html, /\['GET','HEAD'\]\.includes\(method\)/);
  assert.match(map, /X-Yugorno-Session/);
  assert.match(map, /localStorage\.getItem\(\"yugorno-session\"\)/);
  assert.match(html, /localStorage\.getItem\('yugorno-session'\)/);
  assert.match(server, /app\.get\("\/api\/session"/);
  assert.match(server, /whatsappAuthAvailable:/);
});

test('admin and moderator identities can be assigned to Telegram or WhatsApp accounts', async () => {
  const server = await readFile(new URL('./server.js', import.meta.url), 'utf8');
  const env = await readFile(new URL('./.env.example', import.meta.url), 'utf8');
  assert.match(server, /MAP_ADMINS\.has\(id\)/);
  assert.match(server, /MAP_MODERATORS\.has\(id\)/);
  assert.match(server, /sub: `wa:\$\{phone\}`/);
  assert.match(env, /YUGORNO_ADMIN_IDS=/);
  assert.match(env, /YUGORNO_MODERATOR_IDS=/);
});


test('local browser opens as a guest and local administrator mode requires an explicit action', async () => {
  const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('async function initLocalDemoMode(){');
  const end = html.indexOf('initLocalDemoMode();', start);
  const init = html.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(init, /renderAccountState\('guest'\)/);
  assert.doesNotMatch(init, /window\.yugornoLocalDemo=true/);
  assert.match(html, /async function loginLocalDemo\(\)/);
  assert.match(html, /async function logoutAccount\(\)/);
  assert.match(html, /window\.yugornoLocalDemo=true/);
});
