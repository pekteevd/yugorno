import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.env.YUGORNO_DATA_DIR || path.join(process.cwd(), 'data'));
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const DEFAULT_FEATURED_DESTINATIONS = [
  { slug: 'karelia', title: 'Выходные у озера в Карелии', place: 'Карелия', date: 'Планируется', kind: 'Природа', price: 'Даты и стоимость уточняются', description: 'Озёра, лесные дороги и небольшая компания.', details: 'Идея направления: провести несколько дней у воды, гулять по лесным берегам, готовить вместе и встречать вечер у костра. Конкретный маршрут и условия участия будут опубликованы отдельным организатором.', image: 'trip-karelia' },
  { slug: 'u-ilem', title: 'Первые выходные «У Илем»', place: 'Марий Эл', date: 'Планируется', kind: 'Встреча', price: 'Условия уточняются', description: 'Знакомство с местом, деревенская жизнь и совместные дела.', details: 'Идея встречи: познакомиться с пространством У Илем, провести время у озера, приготовить общую еду и обсудить будущие события. Это не открытый набор и не подтверждённая дата.', image: 'trip-u-ilem' },
  { slug: 'teriberka', title: 'Дорога к северному морю', place: 'Териберка · Кольский полуостров', date: 'Сезон уточняется', kind: 'Автопутешествие', price: 'Бюджет уточняется', description: 'Северные пейзажи, побережье и остановки в интересных местах.', details: 'Идея маршрута: автомобильное путешествие к побережью Териберки с небольшими прогулками и знакомством с северными местами. Даты, состав группы и стоимость пока не объявлены.', image: 'trip-teriberka' }
];
const EMPTY = { trips: [], communities: [], profiles: {}, tripInterests: [], communityMembers: [], places: [], impressions: [], routes: [], savedPlaces: [], featuredDestinations: [] };
let writeQueue = Promise.resolve();

function cleanText(value, max = 500) {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
}

function cleanImageUrls(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, 8).map(url => cleanText(url, 500)).filter(url => /^\/uploads\/[a-zA-Z0-9._-]+$/.test(url) || /^\/api\/map-uploads\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/i.test(url)))];
}

function normalizePlaceTitle(value) {
  return cleanText(value, 120).toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function distanceMeters(aLat, aLng, bLat, bLng) {
  const rad = value => value * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function cleanTrackPoints(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 5000) throw new TypeError("GPS-трек должен содержать не более 5000 точек");
  const points = value.map(point => ({
    lat: validCoordinate(point?.lat, -90, 90),
    lng: validCoordinate(point?.lng, -180, 180)
  }));
  if (points.some(point => point.lat === null || point.lng === null)) throw new TypeError("GPS-трек содержит некорректные координаты");
  if (points.length === 1) throw new TypeError("GPS-трек должен содержать не менее двух точек");
  return points;
}

async function readStore() {
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    return {
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
      communities: Array.isArray(parsed.communities) ? parsed.communities : [],
      profiles: parsed.profiles && typeof parsed.profiles === 'object' && !Array.isArray(parsed.profiles) ? parsed.profiles : {},
      tripInterests: Array.isArray(parsed.tripInterests) ? parsed.tripInterests : [],
      communityMembers: Array.isArray(parsed.communityMembers) ? parsed.communityMembers : [],
      places: Array.isArray(parsed.places) ? parsed.places : [],
      impressions: Array.isArray(parsed.impressions) ? parsed.impressions : [],
      routes: Array.isArray(parsed.routes) ? parsed.routes : [],
      savedPlaces: Array.isArray(parsed.savedPlaces) ? parsed.savedPlaces : [],
      featuredDestinations: Array.isArray(parsed.featuredDestinations) ? parsed.featuredDestinations : []
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
    const fields = { title: 120, place: 160, date: 100, kind: 60, description: 1200, startDate: 40, endDate: 40, price: 120 };
    for (const [field, max] of Object.entries(fields)) if (Object.hasOwn(input, field)) trip[field] = cleanText(input[field], max);
    if (Object.hasOwn(input, 'capacity')) trip.capacity = Math.max(0, Math.min(500, Number.parseInt(input.capacity, 10) || 0));
    if (Object.hasOwn(input, 'imageUrl')) trip.imageUrl = cleanText(input.imageUrl, 500);
    if (Object.hasOwn(input, 'imageUrls')) { trip.imageUrls = cleanImageUrls(input.imageUrls); trip.imageUrl = trip.imageUrls[0] || ''; }
    if (Object.hasOwn(input, 'lat') || Object.hasOwn(input, 'lng')) {
      trip.lat = validCoordinate(input.lat, -90, 90);
      trip.lng = validCoordinate(input.lng, -180, 180);
      if (trip.lat === null || trip.lng === null) { trip.lat = null; trip.lng = null; }
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
    kind: cleanText(input.kind, 60), description: cleanText(input.description, 1200), startDate: cleanText(input.startDate, 40), endDate: cleanText(input.endDate, 40), price: cleanText(input.price, 120), capacity: Math.max(0, Math.min(500, Number.parseInt(input.capacity, 10) || 0)), lat: validCoordinate(input.lat, -90, 90), lng: validCoordinate(input.lng, -180, 180), imageUrl: cleanText(input.imageUrl, 500), imageUrls: cleanImageUrls(input.imageUrls?.length ? input.imageUrls : (input.imageUrl ? [input.imageUrl] : [])),
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
    interest: cleanText(input.interest, 120), imageUrl: cleanText(input.imageUrl, 500),
    updatedAt: new Date().toISOString()
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
    id: item.id, title: item.title, place: item.place, date: item.date, kind: item.kind, description: item.description, startDate: item.startDate || '', endDate: item.endDate || '', price: item.price || '', capacity: item.capacity || 0, lat: item.lat ?? null, lng: item.lng ?? null, imageUrl: item.imageUrl || '', imageUrls: item.imageUrls || (item.imageUrl ? [item.imageUrl] : []),
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


// --- Map of discoveries: places, impressions, routes and saved places ---
function publicPlace(item) {
  const { authorId, exactLat, exactLng, ...safe } = item;
  if (safe.coordinateAccuracy === "approximate") {
    safe.lat = Math.round(Number(safe.lat) * 100) / 100;
    safe.lng = Math.round(Number(safe.lng) * 100) / 100;
  }
  return { ...safe, author: item.authorName || "Участник Югорно" };
}
function publicImpression(item) {
  const { authorId, ...safe } = item;
  return { ...safe, author: item.authorName || "Участник Югорно" };
}
function publicRoute(item) {
  const { authorId, ...safe } = item;
  return { ...safe, author: item.authorName || "Участник Югорно" };
}
function validCoordinate(value, min, max) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}
function cleanPlaceInput(input = {}) {
  const title = cleanText(input.title, 120);
  const category = cleanText(input.category, 40);
  const description = cleanText(input.description, 3000);
  const region = cleanText(input.region, 120);
  const lat = validCoordinate(input.lat, -90, 90);
  const lng = validCoordinate(input.lng, -180, 180);
  const accuracy = input.coordinateAccuracy === "approximate" ? "approximate" : "exact";
  if (!title || !category || lat === null || lng === null) {
    throw new TypeError("Укажите название, категорию и корректные координаты места");
  }
  const photoUrls = cleanImageUrls(input.photoUrls || []);
  return { title, category, description, region, lat, lng, coordinateAccuracy: accuracy, photoUrls };
}
export async function listPlaces(options = {}) {
  const store = await readStore();
  const q = cleanText(options.q, 120).toLocaleLowerCase("ru");
  const category = cleanText(options.category, 40);
  const west = validCoordinate(options.west, -180, 180), east = validCoordinate(options.east, -180, 180);
  const south = validCoordinate(options.south, -90, 90), north = validCoordinate(options.north, -90, 90);
  return store.places.filter(item => item.status === "published")
    .filter(item => !category || item.category === category)
    .filter(item => !q || [item.title, item.description, item.region, item.category].join(" ").toLocaleLowerCase("ru").includes(q))
    .filter(item => west === null || east === null || south === null || north === null ||
      (item.lng >= west && item.lng <= east && item.lat >= south && item.lat <= north))
    .slice(0, 500).map(publicPlace);
}
export async function getPlace(placeId) {
  const store = await readStore();
  const item = store.places.find(place => place.id === placeId && place.status === "published");
  return item ? publicPlace(item) : null;
}
export async function listMyPlaces(userId) {
  const store = await readStore();
  return store.places.filter(item => item.authorId === String(userId))
    .map(item => ({ ...publicPlace(item), status: item.status }));
}
export async function createPlace(userId, input = {}, authorName = "") {
  const data = cleanPlaceInput(input);
  const normalizedTitle = normalizePlaceTitle(data.title);
  return update(store => {
    const matches = store.places
      .filter(item => item.status === "published" || (item.status === "pending" && item.authorId === String(userId)))
      .filter(item => item.category === data.category && normalizePlaceTitle(item.title) === normalizedTitle)
      .map(item => ({ item, distance: distanceMeters(data.lat, data.lng, item.lat, item.lng) }))
      .filter(match => match.distance <= 75)
      .slice(0, 3)
      .map(({ item, distance }) => ({ id: item.id, title: item.title, region: item.region, distanceMeters: Math.round(distance) }));
    if (matches.length) return { duplicate: true, matches };
    const now = new Date().toISOString();
    const place = {
      id: randomUUID(), ...data, authorId: String(userId),
      authorName: cleanText(authorName, 100), status: "pending",
      createdAt: now, updatedAt: now
    };
    store.places.push(place);
    return { ...publicPlace(place), status: place.status };
  });
}
export async function updatePlace(userId, placeId, input = {}) {
  return update(store => {
    const place = store.places.find(item => item.id === placeId && item.authorId === String(userId));
    if (!place || place.status === "hidden" || place.status === "archived") return null;
    const data = cleanPlaceInput({ ...place, ...input });
    Object.assign(place, data, { status: "pending", updatedAt: new Date().toISOString() });
    return { ...publicPlace(place), status: place.status };
  });
}
export async function moderatePlace(placeId, status) {
  if (!["published", "rejected", "hidden", "archived"].includes(status)) throw new TypeError("Недопустимый статус публикации");
  return update(store => {
    const place = store.places.find(item => item.id === placeId);
    if (!place) return null;
    place.status = status; place.updatedAt = new Date().toISOString();
    for (const impression of store.impressions) {
      if (impression.placeId === placeId && impression.status === "pending") impression.status = status;
    }
    return { ...publicPlace(place), status: place.status };
  });
}
export async function createImpression(userId, placeId, input = {}, authorName = "") {
  const text = cleanText(input.text, 3000);
  const photos = cleanImageUrls(input.photoUrls || (input.photoUrl ? [input.photoUrl] : []));
  if (!text && !photos.length) throw new TypeError("Добавьте текст или фотографию впечатления");
  return update(store => {
    const place = store.places.find(item => item.id === placeId && (item.status === "published" || item.authorId === String(userId)));
    if (!place) return null;
    const impression = {
      id: randomUUID(), placeId, text, photoUrls: photos,
      authorId: String(userId), authorName: cleanText(authorName, 100),
      status: "pending", createdAt: new Date().toISOString()
    };
    store.impressions.push(impression);
    return { ...publicImpression(impression), status: impression.status };
  });
}
export async function listImpressions(placeId) {
  const store = await readStore();
  return store.impressions.filter(item => item.placeId === placeId && item.status === "published").slice(0, 100).map(publicImpression);
}
export async function listMyImpressions(userId) {
  const store = await readStore();
  return store.impressions.filter(item => item.authorId === String(userId)).map(item => {
    const place = store.places.find(entry => entry.id === item.placeId);
    return { ...publicImpression(item), status: item.status, placeTitle: place?.title || "Место не найдено", placeLat: place?.lat ?? null, placeLng: place?.lng ?? null };
  });
}
export async function updateImpression(userId, impressionId, input = {}) {
  return update(store => {
    const item = store.impressions.find(entry => entry.id === impressionId && entry.authorId === String(userId));
    if (!item || item.status === "hidden" || item.status === "archived") return null;
    if (Object.hasOwn(input, "text")) item.text = cleanText(input.text, 3000);
    if (Object.hasOwn(input, "photoUrls")) item.photoUrls = cleanImageUrls(input.photoUrls);
    if (!item.text && !(item.photoUrls || []).length) throw new TypeError("Добавьте текст или фотографию впечатления");
    item.status = "pending";
    item.updatedAt = new Date().toISOString();
    return { ...publicImpression(item), status: item.status };
  });
}
export async function moderateImpression(impressionId, status) {
  if (!["published", "rejected", "hidden", "archived"].includes(status)) throw new TypeError("Недопустимый статус публикации");
  return update(store => {
    const item = store.impressions.find(entry => entry.id === impressionId);
    if (!item) return null;
    item.status = status;
    return { ...publicImpression(item), status };
  });
}
export async function listFeaturedDestinations() {
  const store = await readStore();
  return store.featuredDestinations.length ? store.featuredDestinations : structuredClone(DEFAULT_FEATURED_DESTINATIONS);
}
export async function updateFeaturedDestination(slug, input = {}) {
  const allowed = new Set(DEFAULT_FEATURED_DESTINATIONS.map(item => item.slug));
  if (!allowed.has(slug)) return null;
  return update(store => {
    const current = store.featuredDestinations.length ? store.featuredDestinations : structuredClone(DEFAULT_FEATURED_DESTINATIONS);
    const index = current.findIndex(item => item.slug === slug);
    if (index < 0) return null;
    const limits = { title: 120, place: 160, date: 100, kind: 60, price: 120, description: 1200, details: 3000, imageUrl: 500 };
    for (const [field, max] of Object.entries(limits)) if (Object.hasOwn(input, field)) current[index][field] = cleanText(input[field], max);
    if (Object.hasOwn(input, 'image')) current[index].image = ['trip-karelia','trip-u-ilem','trip-teriberka'].includes(input.image) ? input.image : current[index].image;
    if (!current[index].title || !current[index].place) throw new TypeError('title and place are required');
    store.featuredDestinations = current;
    return { ...current[index] };
  });
}

export async function listRoutes() {
  const store = await readStore();
  return store.routes.filter(item => item.status === "published").slice(0, 200).map(item => ({ ...publicRoute(item), stops: item.stopIds.map(id => store.places.find(place => place.id === id && place.status === "published")).filter(Boolean).map(publicPlace) }));
}
export async function createRoute(userId, input = {}, authorName = "") {
  const title = cleanText(input.title, 120);
  const description = cleanText(input.description, 3000);
  const transport = cleanText(input.transport, 40) || "mixed";
  const stopIds = Array.isArray(input.stopIds) ? [...new Set(input.stopIds.map(id => cleanText(id, 80)).filter(Boolean))].slice(0, 50) : [];
  const trackPoints = cleanTrackPoints(input.trackPoints);
  if (!title || stopIds.length < 2) throw new TypeError("Маршрут должен иметь название и не менее двух мест");
  return update(store => {
    const stops = stopIds.map(id => store.places.find(place => place.id === id && (place.status === "published" || place.authorId === String(userId))));
    if (stops.some(item => !item)) throw new TypeError("Маршрут содержит недоступное место");
    const route = {
      id: randomUUID(), title, description, transport, stopIds, trackPoints,
      authorId: String(userId), authorName: cleanText(authorName, 100),
      status: "pending", createdAt: new Date().toISOString()
    };
    store.routes.push(route);
    return { ...publicRoute(route), status: route.status, stops: stops.map(publicPlace) };
  });
}
export async function listMyRoutes(userId) {
  const store = await readStore();
  return store.routes.filter(route => route.authorId === String(userId)).map(route => ({
    ...publicRoute(route),
    status: route.status,
    stops: (route.stopIds || []).map(id => store.places.find(place => place.id === id)).filter(Boolean).map(publicPlace)
  }));
}
export async function updateRoute(userId, routeId, input = {}) {
  return update(store => {
    const route = store.routes.find(item => item.id === routeId && item.authorId === String(userId));
    if (!route || ["hidden", "archived"].includes(route.status)) return null;
    const title = Object.hasOwn(input, "title") ? cleanText(input.title, 120) : route.title;
    const description = Object.hasOwn(input, "description") ? cleanText(input.description, 3000) : route.description;
    const transport = Object.hasOwn(input, "transport") ? cleanText(input.transport, 40) || "mixed" : route.transport;
    const stopIds = Object.hasOwn(input, "stopIds")
      ? [...new Set((Array.isArray(input.stopIds) ? input.stopIds : []).map(id => cleanText(id, 80)).filter(Boolean))].slice(0, 50)
      : route.stopIds;
    const trackPoints = Object.hasOwn(input, "trackPoints") ? cleanTrackPoints(input.trackPoints) : route.trackPoints || [];
    if (!title || stopIds.length < 2) throw new TypeError("Маршрут должен иметь название и не менее двух мест");
    const stops = stopIds.map(id => store.places.find(place => place.id === id && (place.status === "published" || place.authorId === String(userId))));
    if (stops.some(item => !item)) throw new TypeError("Маршрут содержит недоступное место");
    Object.assign(route, { title, description, transport, stopIds, trackPoints, status: "pending", updatedAt: new Date().toISOString() });
    return { ...publicRoute(route), status: route.status, stops: stops.map(publicPlace) };
  });
}
export async function savePlace(userId, placeId) {
  return update(store => {
    if (!store.places.some(item => item.id === placeId && item.status === "published")) return null;
    const exists = store.savedPlaces.some(item => item.userId === String(userId) && item.placeId === placeId);
    if (!exists) store.savedPlaces.push({ userId: String(userId), placeId, createdAt: new Date().toISOString() });
    return { saved: true, alreadySaved: exists };
  });
}
export async function unsavePlace(userId, placeId) {
  return update(store => {
    const before = store.savedPlaces.length;
    store.savedPlaces = store.savedPlaces.filter(item => !(item.userId === String(userId) && item.placeId === placeId));
    return { saved: false, removed: before !== store.savedPlaces.length };
  });
}
export async function listSavedPlaces(userId) {
  const store = await readStore();
  const ids = new Set(store.savedPlaces.filter(item => item.userId === String(userId)).map(item => item.placeId));
  return store.places.filter(item => ids.has(item.id) && item.status === "published").map(publicPlace);
}

export async function listMapModerationQueue(kind = 'places') {
  const store = await readStore();
  if (kind === 'impressions') {
    const pendingPlaceIds = new Set(store.places.filter(place => place.status === 'pending').map(place => place.id));
    return store.impressions.filter(item => item.status === 'pending' && !pendingPlaceIds.has(item.placeId)).slice(0, 200).map(publicImpression);
  }
  if (kind === 'routes') return store.routes.filter(item => item.status === 'pending').slice(0, 200).map(item => ({
    ...publicRoute(item),
    stops: (item.stopIds || []).map(id => store.places.find(place => place.id === id)).filter(Boolean).map(publicPlace)
  }));
  return store.places.filter(item => item.status === 'pending').slice(0, 200).map(item => ({
    ...publicPlace(item),
    status: item.status,
    pendingImpressions: store.impressions.filter(impression => impression.placeId === item.id && impression.status === 'pending').map(publicImpression)
  }));
}

export async function moderateRoute(routeId, status) {
  if (!["published", "rejected", "hidden", "archived"].includes(status)) throw new TypeError("Недопустимый статус публикации");
  return update(store => {
    const route = store.routes.find(item => item.id === routeId);
    if (!route) return null;
    route.status = status;
    return { ...publicRoute(route), status };
  });
}

export async function canViewMapUpload(userId, filename, isModerator = false) {
  const store = await readStore();
  const url = `/api/map-uploads/${filename}`;
  const place = store.places.find(item => (item.photoUrls || []).includes(url));
  if (place) return place.status === "published" || place.authorId === String(userId || "") || isModerator;
  const impression = store.impressions.find(item => (item.photoUrls || []).includes(url));
  if (!impression) return false;
  return impression.status === "published" || impression.authorId === String(userId || "") || isModerator;
}
