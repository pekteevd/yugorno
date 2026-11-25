import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const temp = await mkdtemp(path.join(os.tmpdir(), 'yugorno-store-'));
process.env.YUGORNO_DATA_DIR = temp;
const store = await import(`./data-store.js?test=${Date.now()}`);

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
  assert.equal((await store.unpublishTrip(700, trip.id)).status, 'unpublished');
  assert.equal((await store.unpublishCommunity(700, community.id)).status, 'unpublished');
  assert.equal(await store.getTrip(trip.id), null);
  assert.equal((await store.listTrips()).some(item => item.id === trip.id), false);
  assert.equal((await store.listCommunities()).some(item => item.id === community.id), false);
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
