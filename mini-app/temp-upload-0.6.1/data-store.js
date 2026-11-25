import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = process.env.YUGORNO_DATA_DIR || path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const EMPTY = { trips: [], communities: [], profiles: {}, tripInterests: [], communityMembers: [] };
let writeQueue = Promise.resolve();

function cleanText(value, max = 500) {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
}

function cleanImageUrls(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, 8).map(url => cleanText(url, 500)).filter(url => /^\/uploads\/[a-zA-Z0-9._-]+$/.test(url)))];
}

async function readStore() {
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    return {
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
      communities: Array.isArray(parsed.communities) ? parsed.communities : [],
      profiles: parsed.profiles && typeof parsed.profiles === 'object' && !Array.isArray(parsed.profiles) ? parsed.profiles : {},
      tripInterests: Array.isArray(parsed.tripInterests) ? parsed.tripInterests : [],
      communityMembers: Array.isArray(parsed.communityMembers) ? parsed.communityMembers : []
    };
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(EMPTY);
    throw new Error(`Cannot read Yugorno data store: ${error.message}`);
  }
}

async function persist(store) {
  await mkdir(DATA_DIR, { recursive: true });
  const temp = `${DATA_FILE}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, DATA_FILE);
}

function update(mutator) {
  const operation = writeQueue.then(async () => {
    const store = await readStore();
    const result = await mutator(store);
    await persist(store);
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

export async function listTrips() {
  const store = await readStore();
  return store.trips.filter(item => item.status === 'published').map(item => {
    const { authorId, ...publicTrip } = item;
    publicTrip.interestCount = store.tripInterests.filter(entry => entry.tripId === item.id).length;
    return publicTrip;
  });
}

export async function getTrip(tripId) {
  const store = await readStore();
  const trip = store.trips.find(item => item.id === tripId && item.status === 'published');
  if (!trip) return null;
  const { authorId, ...publicTrip } = trip;
  publicTrip.interestCount = store.tripInterests.filter(entry => entry.tripId === tripId).length;
  return publicTrip;
}

export async function updateTrip(userId, tripId, input) {
  return update(store => {
    const trip = store.trips.find(item => item.id === tripId && item.status === 'published' && item.authorId === String(userId));
    if (!trip) return null;
    const fields = { title: 120, place: 160, date: 100, kind: 60, description: 1200 };
    for (const [field, max] of Object.entries(fields)) {
      if (Object.hasOwn(input, field)) trip[field] = cleanText(input[field], max);
    if (Object.hasOwn(input, 'imageUrl')) trip.imageUrl = cleanText(input.imageUrl, 500);
    if (Object.hasOwn(input, 'imageUrls')) { trip.imageUrls = cleanImageUrls(input.imageUrls); trip.imageUrl = trip.imageUrls[0] || ''; }
    }
    if (!trip.title || !trip.place || !trip.kind) throw new TypeError('title, place and kind are required');
    trip.updatedAt = new Date().toISOString();
    return { ...trip };
  });
}

export async function unpublishTrip(userId, tripId) {
  return update(store => {
    const trip = store.trips.find(item => item.id === tripId && item.status === 'published' && item.authorId === String(userId));
    if (!trip) return null;
    trip.status = 'unpublished';
    trip.unpublishedAt = new Date().toISOString();
    return { id: trip.id, status: trip.status };
  });
}

export async function createTrip(userId, input) {
  const trip = {
    id: randomUUID(), authorId: String(userId), title: cleanText(input.title, 120),
    place: cleanText(input.place, 160), date: cleanText(input.date, 100),
    kind: cleanText(input.kind, 60), description: cleanText(input.description, 1200), imageUrl: cleanText(input.imageUrl, 500), imageUrls: cleanImageUrls(input.imageUrls?.length ? input.imageUrls : (input.imageUrl ? [input.imageUrl] : [])),
    createdAt: new Date().toISOString(), status: 'published'
  };
  if (!trip.title || !trip.place || !trip.kind) throw new TypeError('title, place and kind are required');
  return update(store => { store.trips.unshift(trip); return trip; });
}

export async function listCommunities() {
  const store = await readStore();
  return store.communities.filter(item => item.status === 'published').map(item => {
    const { authorId, ...publicCommunity } = item;
    publicCommunity.memberCount = store.communityMembers.filter(entry => entry.communityId === item.id).length;
    return publicCommunity;
  });
}

export async function updateCommunity(userId, communityId, input) {
  return update(store => {
    const community = store.communities.find(item => item.id === communityId && item.status === 'published' && item.authorId === String(userId));
    if (!community) return null;
    if (Object.hasOwn(input, 'title')) community.title = cleanText(input.title, 120);
    if (Object.hasOwn(input, 'description')) community.description = cleanText(input.description, 1200);
    if (Object.hasOwn(input, 'imageUrl')) community.imageUrl = cleanText(input.imageUrl, 500);
    if (Object.hasOwn(input, 'imageUrls')) { community.imageUrls = cleanImageUrls(input.imageUrls); community.imageUrl = community.imageUrls[0] || ''; }
    if (!community.title || !community.description) throw new TypeError('title and description are required');
    community.updatedAt = new Date().toISOString();
    return { ...community };
  });
}

export async function unpublishCommunity(userId, communityId) {
  return update(store => {
    const community = store.communities.find(item => item.id === communityId && item.status === 'published' && item.authorId === String(userId));
    if (!community) return null;
    community.status = 'unpublished';
    community.unpublishedAt = new Date().toISOString();
    return { id: community.id, status: community.status };
  });
}

export async function listMyCommunities(userId) {
  const store = await readStore();
  return store.communities.filter(item => item.status === 'published' && item.authorId === String(userId)).map(item => ({
    id: item.id, title: item.title, description: item.description, createdAt: item.createdAt,
    memberCount: store.communityMembers.filter(entry => entry.communityId === item.id).length
  }));
}

export async function listCommunityMembers(userId, communityId) {
  return update(store => {
    const community = store.communities.find(item => item.id === communityId && item.status === 'published' && item.authorId === String(userId));
    if (!community) return null;
    return store.communityMembers.filter(entry => entry.communityId === communityId).map(entry => {
      // Backfill opaque membership IDs for records created by versions before 0.5.
      if (!entry.id) entry.id = randomUUID();
      const profile = store.profiles[entry.userId] || {};
      return { memberId: entry.id, name: profile.name || 'Участник Югорно', city: profile.city || '', interest: profile.interest || '', joinedAt: entry.joinedAt };
    });
  });
}


export async function removeCommunityMember(ownerId, communityId, memberId) {
  return update(store => {
    const community = store.communities.find(item => item.id === communityId && item.status === 'published' && item.authorId === String(ownerId));
    if (!community) return null;
    const index = store.communityMembers.findIndex(entry => entry.communityId === communityId && entry.id === memberId);
    if (index < 0) return { removed: false };
    store.communityMembers.splice(index, 1);
    return { removed: true };
  });
}

export async function createCommunity(userId, input) {
  const community = {
    id: randomUUID(), authorId: String(userId), title: cleanText(input.title, 120),
    description: cleanText(input.description, 1200), imageUrl: cleanText(input.imageUrl, 500), imageUrls: cleanImageUrls(input.imageUrls?.length ? input.imageUrls : (input.imageUrl ? [input.imageUrl] : [])),
    createdAt: new Date().toISOString(), status: 'published'
  };
  if (!community.title || !community.description) throw new TypeError('title and description are required');
  return update(store => { store.communities.unshift(community); return community; });
}

export async function getProfile(userId) {
  const store = await readStore();
  return store.profiles[String(userId)] || null;
}

export async function saveProfile(userId, input) {
  const profile = {
    name: cleanText(input.name, 100), city: cleanText(input.city, 120),
    interest: cleanText(input.interest, 120), imageUrl: cleanText(input.imageUrl, 500), updatedAt: new Date().toISOString()
  };
  return update(store => { store.profiles[String(userId)] = profile; return profile; });
}


export async function expressTripInterest(userId, tripId) {
  return update(store => {
    const trip = store.trips.find(item => item.id === tripId && item.status === 'published');
    if (!trip) return null;
    if (trip.authorId === String(userId)) return { tripId, selfInterest: true, alreadyInterested: false };
    const exists = store.tripInterests.some(item => item.tripId === tripId && item.userId === String(userId));
    if (!exists) store.tripInterests.push({ tripId, userId: String(userId), createdAt: new Date().toISOString() });
    return { tripId, interested: true, alreadyInterested: exists, notifyUserId: trip.authorId, tripTitle: trip.title };
  });
}

export async function joinCommunity(userId, communityId) {
  return update(store => {
    const community = store.communities.find(item => item.id === communityId && item.status === 'published');
    if (!community) return null;
    const exists = store.communityMembers.some(item => item.communityId === communityId && item.userId === String(userId));
    if (!exists) store.communityMembers.push({ id: randomUUID(), communityId, userId: String(userId), joinedAt: new Date().toISOString() });
    return { communityId, joined: true, alreadyJoined: exists, notifyUserId: community.authorId, communityTitle: community.title };
  });
}


export async function listMyTrips(userId) {
  const store = await readStore();
  return store.trips.filter(item => item.status === 'published' && item.authorId === String(userId)).map(item => ({
    id: item.id, title: item.title, place: item.place, date: item.date, kind: item.kind, description: item.description, imageUrl: item.imageUrl || '', imageUrls: item.imageUrls || (item.imageUrl ? [item.imageUrl] : []),
    createdAt: item.createdAt,
    interestCount: store.tripInterests.filter(entry => entry.tripId === item.id).length
  }));
}

export async function listTripInterests(userId, tripId) {
  const store = await readStore();
  const trip = store.trips.find(item => item.id === tripId && item.status === 'published' && item.authorId === String(userId));
  if (!trip) return null;
  return store.tripInterests.filter(entry => entry.tripId === tripId).map(entry => {
    const profile = store.profiles[entry.userId] || {};
    return {
      name: profile.name || 'Участник Югорно',
      city: profile.city || '',
      interest: profile.interest || '',
      createdAt: entry.createdAt
    };
  });
}
