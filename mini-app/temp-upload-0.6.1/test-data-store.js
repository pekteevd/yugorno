import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const temp = await mkdtemp(path.join(os.tmpdir(), 'yugorno-store-'));
process.env.YUGORNO_DATA_DIR = temp;
const store = await import(`./data-store.js?test=${Date.now()}`);

test('stores trip dates price and capacity and allows owner updates', async () => {
  const trip = await store.createTrip(102, { title: 'Север', place: 'Териберка', kind: 'Автопутешествие', startDate: '2027-01-10', endDate: '2027-01-15', price: '25 000 ₽', capacity: 6 });
  assert.equal(trip.startDate, '2027-01-10');
  assert.equal(trip.endDate, '2027-01-15');
  assert.equal(trip.price, '25 000 ₽');
  assert.equal(trip.capacity, 6);
  const updated = await store.updateTrip(102, trip.id, { price: '30 000 ₽', capacity: 4 });
  assert.equal(updated.price, '30 000 ₽');
  assert.equal(updated.capacity, 4);
});

test('featured demo destinations remain available and can be edited by slug', async () => {
  const before = await store.listFeaturedDestinations();
  assert.deepEqual(before.map(item => item.slug).sort(), ['karelia', 'teriberka', 'u-ilem']);
  const updated = await store.updateFeaturedDestination('teriberka', { title: 'Северное побережье', place: 'Териберка', details: 'Обновлённая программа' });
  assert.equal(updated.title, 'Северное побережье');
  assert.equal((await store.listFeaturedDestinations()).find(item => item.slug === 'teriberka').details, 'Обновлённая программа');
  assert.equal(await store.updateFeaturedDestination('unknown', { title: 'x' }), null);
  const removed = await store.deleteFeaturedDestination('teriberka');
  assert.equal(removed.slug, 'teriberka');
  assert.deepEqual((await store.listFeaturedDestinations()).map(item => item.slug).sort(), ['karelia', 'u-ilem']);
  assert.equal(await store.deleteFeaturedDestination('unknown'), null);
  await store.deleteFeaturedDestination('karelia');
  await store.deleteFeaturedDestination('u-ilem');
  assert.deepEqual(await store.listFeaturedDestinations(), [], 'an intentionally empty destination catalog must stay empty instead of restoring defaults');
});

test('creates and lists published trips with escaped-as-text values preserved', async () => {
  const trip = await store.createTrip(101, { title: 'Лес <тропа>', place: 'Карелия', date: 'Июль', kind: 'Поход', description: 'Тихий маршрут' });
  assert.equal(trip.status, 'published');
  assert.equal((await store.listTrips())[0].title, 'Лес <тропа>');
  assert.equal(Object.hasOwn((await store.listTrips())[0], 'authorId'), false);
});

test('rejects incomplete trip and community records', async () => {
  await assert.rejects(() => store.createTrip(1, { title: 'Без места' }), TypeError);
  await assert.rejects(() => store.createCommunity(1, { title: 'Без описания' }), TypeError);
});

test('persists communities and keeps profiles separated by Telegram user id', async () => {
  const community = await store.createCommunity(101, { title: 'У Илем', description: 'Место встреч' });
  const trip = await store.createTrip(101, { title: 'Поездка', place: 'Карелия', kind: 'Поход' });
  assert.equal((await store.joinCommunity(202, community.id)).joined, true);
  assert.equal((await store.joinCommunity(202, community.id)).notifyUserId, '101');
  assert.equal((await store.joinCommunity(202, community.id)).alreadyJoined, true);
  assert.equal((await store.expressTripInterest(202, trip.id)).interested, true);
  assert.equal((await store.expressTripInterest(101, trip.id)).selfInterest, true);
  assert.equal((await store.expressTripInterest(202, trip.id)).notifyUserId, '101');
  assert.equal((await store.expressTripInterest(202, trip.id)).alreadyInterested, true);
  await store.saveProfile(101, { name: 'Иван', city: 'Йошкар-Ола', interest: 'Природа' });
  await store.saveProfile(202, { name: 'Мария', city: 'Казань', interest: 'Культура' });
  assert.equal((await store.listMyTrips(101))[0].interestCount, 1);
  assert.equal((await store.listTripInterests(101, trip.id))[0].name, 'Мария');
  assert.equal(await store.listTripInterests(202, trip.id), null);
  assert.equal((await store.listCommunities()).length, 1);
  assert.equal(Object.hasOwn((await store.listCommunities())[0], 'authorId'), false);
  assert.equal((await store.getProfile(101)).name, 'Иван');
  assert.equal((await store.getProfile(202)).name, 'Мария');
});

test('serializes concurrent writes without losing records', async () => {
  await Promise.all(Array.from({ length: 12 }, (_, i) => store.createCommunity(500 + i, { title: `Тема ${i}`, description: 'Описание' })));
  assert.equal((await store.listCommunities()).length, 13);
});

test.after(async () => { await rm(temp, { recursive: true, force: true }); });


test('does not accept participation in unknown records', async () => {
  assert.equal(await store.joinCommunity(1, 'missing-community'), null);
  assert.equal(await store.expressTripInterest(1, 'missing-trip'), null);
});


test('owners can edit and unpublish only their own trips and communities', async () => {
  const trip = await store.createTrip(700, { title: 'До правки', place: 'Карелия', kind: 'Поход', description: 'Старое описание' });
  const community = await store.createCommunity(700, { title: 'Старое сообщество', description: 'Старое описание' });
  assert.equal(await store.updateTrip(701, trip.id, { title: 'Чужая правка' }), null);
  assert.equal(await store.updateCommunity(701, community.id, { title: 'Чужая правка' }), null);
  const changedTrip = await store.updateTrip(700, trip.id, { title: 'Новое путешествие', description: 'Новое описание' });
  assert.equal(changedTrip.title, 'Новое путешествие');
  assert.equal(changedTrip.place, 'Карелия');
  const changedCommunity = await store.updateCommunity(700, community.id, { title: 'Новое сообщество' });
  assert.equal(changedCommunity.title, 'Новое сообщество');
  assert.equal(await store.unpublishTrip(701, trip.id), null);
  assert.equal(await store.unpublishCommunity(701, community.id), null);
  assert.equal((await store.unpublishTrip(700, trip.id)).status, 'deleted');
  assert.equal((await store.unpublishCommunity(700, community.id)).status, 'deleted');
  assert.equal(await store.getTrip(trip.id), null);
  assert.equal((await store.listTrips()).some(item => item.id === trip.id), false);
  assert.equal((await store.listCommunities()).some(item => item.id === community.id), false);
  const trash = await store.listMyTrash(700);
  assert.equal(trash.some(item => item.id === trip.id && item.kind === 'trip'), true);
  assert.equal(trash.some(item => item.id === community.id && item.kind === 'community'), true);
  assert.equal(await store.restorePublication(701, 'trip', trip.id), null);
  assert.equal(await store.restorePublication(701, 'community', community.id), null);
  assert.equal((await store.restorePublication(700, 'trip', trip.id)).status, 'published');
  assert.equal((await store.restorePublication(700, 'community', community.id)).status, 'published');
  assert.equal((await store.listTrips()).some(item => item.id === trip.id), true);
  assert.equal((await store.listCommunities()).some(item => item.id === community.id), true);
});

test('community owners can see member profiles but public data never exposes Telegram ids', async () => {
  const community = await store.createCommunity(800, { title: 'Тропа', description: 'Совместные прогулки' });
  await store.saveProfile(801, { name: 'Павел', city: 'Казань', interest: 'Походы' });
  await store.joinCommunity(801, community.id);
  assert.equal((await store.listMyCommunities(800))[0].memberCount, 1);
  assert.equal((await store.listCommunityMembers(800, community.id))[0].name, 'Павел');
  assert.equal(await store.listCommunityMembers(801, community.id), null);
  assert.equal(Object.hasOwn((await store.getTrip('missing') || {}), 'authorId'), false);
});


test('community owner can remove a member by opaque membership id without exposing Telegram id', async () => {
  const community = await store.createCommunity(900, { title: 'Круг', description: 'Сообщество' });
  await store.joinCommunity(901, community.id);
  const [member] = await store.listCommunityMembers(900, community.id);
  assert.ok(member.memberId);
  assert.equal(Object.hasOwn(member, 'userId'), false);
  assert.equal(await store.removeCommunityMember(902, community.id, member.memberId), null);
  assert.deepEqual(await store.removeCommunityMember(900, community.id, member.memberId), { removed: true });
  assert.equal((await store.listCommunityMembers(900, community.id)).length, 0);
});


test('backfills opaque ids for community memberships created by older versions', async () => {
  const community = await store.createCommunity(950, { title: 'Старое сообщество', description: 'Миграция' });
  await store.joinCommunity(951, community.id);
  const file = path.join(temp, 'store.json');
  const persisted = JSON.parse(await readFile(file, 'utf8'));
  delete persisted.communityMembers.find(item => item.communityId === community.id).id;
  await writeFile(file, JSON.stringify(persisted));
  const [member] = await store.listCommunityMembers(950, community.id);
  assert.ok(member.memberId);
  const migrated = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(migrated.communityMembers.find(item => item.communityId === community.id).id, member.memberId);
});


test('map places, impressions, moderation, routes and saves persist without exposing owner ids', async () => {
  const a = await store.createPlace(1101, { title: 'Озеро', category: 'Природа', lat: 56.1, lng: 47.2, coordinateAccuracy: 'approximate' }, 'Автор');
  const b = await store.createPlace(1102, { title: 'Смотровая', category: 'Красивые места', lat: 56.2, lng: 47.3 }, 'Другой автор');
  assert.equal(a.status, 'pending');
  assert.equal((await store.listPlaces()).length, 0);
  assert.ok(await store.moderatePlace(a.id, 'published'));
  assert.ok(await store.moderatePlace(b.id, 'published'));
  const publicPlace = await store.getPlace(a.id);
  assert.equal(publicPlace.title, 'Озеро');
  assert.equal(Object.hasOwn(publicPlace, 'authorId'), false);
  assert.equal(Object.hasOwn(publicPlace, 'exactLat'), false);
  const impression = await store.createImpression(1103, a.id, { text: 'Тихий берег' }, 'Гость');
  assert.equal(impression.status, 'pending');
  assert.equal((await store.listImpressions(a.id)).length, 0);
  await store.moderateImpression(impression.id, 'published');
  assert.equal((await store.listImpressions(a.id))[0].text, 'Тихий берег');
  const route = await store.createRoute(1101, { title: 'Короткая прогулка', stopIds: [a.id, b.id], transport: 'walking' }, 'Автор');
  assert.equal(route.status, 'pending');
  assert.equal(route.stops.length, 2);
  assert.equal((await store.listRoutes()).length, 0);
  assert.equal((await store.listMapModerationQueue('routes')).some(item => item.id === route.id), true);
  await store.moderateRoute(route.id, 'published');
  assert.equal((await store.listRoutes())[0].stops.length, 2);
  await store.savePlace(1103, a.id);
  assert.equal((await store.listSavedPlaces(1103)).length, 1);
  await assert.rejects(() => store.createPlace(1, { title: 'Плохие координаты', category: 'Природа', lat: 120, lng: 0 }), TypeError);
});

test('map publications move to trash only after linked routes and impressions are removed, then restore intact', async () => {
  const placeA = await store.createPlace(1301, { title: 'Точка для корзины', category: 'Природа', lat: 55.1, lng: 46.1 }, 'Автор');
  const placeB = await store.createPlace(1301, { title: 'Вторая точка для корзины', category: 'Природа', lat: 55.2, lng: 46.2 }, 'Автор');
  const impression = await store.createImpression(1301, placeA.id, { text: 'Впечатление для проверки корзины' }, 'Автор');
  const route = await store.createRoute(1301, { title: 'Маршрут для проверки корзины', stopIds: [placeA.id, placeB.id] }, 'Автор');

  await assert.rejects(() => store.trashPublication(1301, 'place', placeA.id), /связано с 1 маршрутами и 1 впечатлениями/);
  assert.equal(await store.trashPublication(9999, 'route', route.id), null);

  assert.equal((await store.trashPublication(1301, 'route', route.id)).status, 'deleted');
  assert.equal((await store.trashPublication(1301, 'impression', impression.id)).status, 'deleted');
  assert.equal((await store.trashPublication(1301, 'place', placeA.id)).status, 'deleted');

  const trash = await store.listMyTrash(1301);
  assert.equal(trash.some(item => item.id === route.id && item.kind === 'route'), true);
  assert.equal(trash.some(item => item.id === impression.id && item.kind === 'impression'), true);
  assert.equal(trash.some(item => item.id === placeA.id && item.kind === 'place'), true);

  assert.equal((await store.restorePublication(1301, 'place', placeA.id)).status, 'pending');
  assert.equal((await store.restorePublication(1301, 'impression', impression.id)).status, 'pending');
  assert.equal((await store.restorePublication(1301, 'route', route.id)).status, 'pending');
  assert.equal((await store.listMyTrash(1301)).length, 0);
  assert.equal((await store.listMyPlaces(1301)).some(item => item.id === placeA.id), true);
  assert.equal((await store.listMyRoutes(1301)).some(item => item.id === route.id), true);
  assert.equal((await store.listMyImpressions(1301)).some(item => item.id === impression.id), true);
});

test('pending place and its attached impressions are reviewed together while published-place impressions stay separate', async () => {
  const p = await store.createPlace(1201, { title: 'Водопад', category: 'Природа', lat: 55, lng: 46 });
  const attached = await store.createImpression(1201, p.id, { text: 'После дождя' });
  const placeQueue = await store.listMapModerationQueue('places');
  assert.equal(placeQueue.some(item => item.id === p.id), true);
  assert.equal(placeQueue.find(item => item.id === p.id).pendingImpressions.some(item => item.id === attached.id), true);
  assert.equal((await store.listMapModerationQueue('impressions')).some(item => item.id === attached.id), false);
  await store.moderatePlace(p.id, 'published');
  assert.equal((await store.listImpressions(p.id)).some(item => item.id === attached.id), true);
  const later = await store.createImpression(1202, p.id, { text: 'Позднее впечатление' });
  assert.equal((await store.listMapModerationQueue('impressions')).some(item => item.id === later.id), true);
});


test('prevents a nearby duplicate place with the same normalized title and category', async () => {
  const first = await store.createPlace(1301, { title: 'Озеро Синее', category: 'Природа', lat: 56.1, lng: 47.2 });
  await store.moderatePlace(first.id, 'published');
  const duplicate = await store.createPlace(1302, { title: '  озеро   синее ', category: 'Природа', lat: 56.1001, lng: 47.2001 });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.matches[0].id, first.id);
});

test('stores validated GPX track points with a route and rejects malformed tracks', async () => {
  const a = await store.createPlace(1401, { title: 'Точка А', category: 'Природа', lat: 56.1, lng: 47.2 });
  const b = await store.createPlace(1401, { title: 'Точка Б', category: 'Природа', lat: 56.2, lng: 47.3 });
  const route = await store.createRoute(1401, { title: 'Трек', stopIds: [a.id, b.id], trackPoints: [{ lat: 56.1, lng: 47.2 }, { lat: 56.15, lng: 47.25 }, { lat: 56.2, lng: 47.3 }] });
  assert.equal(route.trackPoints.length, 3);
  assert.equal((await store.listMapModerationQueue('routes')).find(item => item.id === route.id).trackPoints.length, 3);
  await assert.rejects(() => store.createRoute(1401, { title: 'Плохой трек', stopIds: [a.id, b.id], trackPoints: [{ lat: 120, lng: 47 }, { lat: 56, lng: 47 }] }), TypeError);
});


test('initial place photos are private and follow the place moderation decision', async () => {
  const filename = '223e4567-e89b-12d3-a456-426614174000.jpg';
  const url = '/api/map-uploads/' + filename;
  const place = await store.createPlace(1551, { title: 'Лесная поляна', category: 'Природа', lat: 55.2, lng: 46.3, photoUrls: [url] });
  assert.deepEqual(place.photoUrls, [url]);
  assert.equal(await store.canViewMapUpload(1551, filename, false), true);
  assert.equal(await store.canViewMapUpload(1552, filename, false), false);
  const queued = (await store.listMapModerationQueue('places')).find(item => item.id === place.id);
  assert.deepEqual(queued.photoUrls, [url]);
  await store.moderatePlace(place.id, 'published');
  assert.equal(await store.canViewMapUpload(null, filename, false), true);
  assert.deepEqual((await store.getPlace(place.id)).photoUrls, [url]);
});


test('map impression photos remain private until publication', async () => {
  const place = await store.createPlace(1501, { title: 'Берег', category: 'Природа', lat: 55, lng: 46 });
  await store.moderatePlace(place.id, 'published');
  const filename = '123e4567-e89b-12d3-a456-426614174000.jpg';
  const url = `/api/map-uploads/${filename}`;
  const impression = await store.createImpression(1502, place.id, { text: 'Фото берега', photoUrls: [url] });
  assert.equal(await store.canViewMapUpload(1502, filename, false), true);
  assert.equal(await store.canViewMapUpload(9999, filename, false), false);
  assert.equal(await store.canViewMapUpload(9999, filename, true), true);
  await store.moderateImpression(impression.id, 'published');
  assert.equal(await store.canViewMapUpload(null, filename, false), true);
});


test('approximate map coordinates are rounded before being returned publicly', async () => {
  const place = await store.createPlace(1601, { title: 'Тихая поляна', category: 'Природа', lat: 56.123456, lng: 47.654321, coordinateAccuracy: 'approximate' });
  assert.equal(place.lat, 56.12);
  assert.equal(place.lng, 47.65);
  const ownPlaces = await store.listMyPlaces(1601);
  assert.equal(ownPlaces.find(item => item.id === place.id).lat, 56.123456);
  assert.equal(ownPlaces.find(item => item.id === place.id).lng, 47.654321);
  await store.moderatePlace(place.id, 'published');
  assert.equal((await store.listPlaces()).find(item => item.id === place.id).lng, 47.65);
  assert.equal((await store.getPlace(place.id)).lat, 56.12);
});
