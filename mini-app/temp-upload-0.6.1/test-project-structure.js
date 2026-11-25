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
  const env = await readFile(new URL('./.env.example', import.meta.url), 'utf8');
  assert.match(server, /LOCAL_DEMO_MODE === "true" \|\| !botEnabled/);
  assert.match(server, /loopbackHost && loopbackRemote/);
  assert.match(server, /X-Local-Demo-User/);
  assert.match(server, /localDemoEnabled && !botEnabled \? "127.0.0.1"/);
  assert.match(env, /LOCAL_DEMO_MODE=true/);
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
