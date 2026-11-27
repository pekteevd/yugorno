import "dotenv/config";
import express from "express";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID, randomInt, createHmac, timingSafeEqual } from "node:crypto";
import { validateTelegramInitData } from "./telegram-auth.js";
import { createTrip, listTrips, getTrip, updateTrip, unpublishTrip, createCommunity, listCommunities, updateCommunity, unpublishCommunity, listMyCommunities, listCommunityMembers, removeCommunityMember, getProfile, saveProfile, expressTripInterest, joinCommunity, listMyTrips, listTripInterests, listPlaces, getPlace, listMyPlaces, createPlace, updatePlace, moderatePlace, createImpression, listImpressions, moderateImpression, listRoutes, createRoute, savePlace, unsavePlace, listSavedPlaces, listMapModerationQueue, moderateRoute, listMyRoutes, updateRoute, listMyImpressions, updateImpression, trashPublication, restorePublication, listMyTrash, canViewMapUpload, listFeaturedDestinations, updateFeaturedDestination } from "./data-store.js";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.YUGORNO_DATA_DIR || path.join(process.cwd(), "data"));
const UPLOADS_DIR = path.resolve(process.env.YUGORNO_UPLOAD_DIR || path.join(DATA_DIR, "uploads"));
const PRIVATE_UPLOADS_DIR = path.resolve(process.env.YUGORNO_PRIVATE_UPLOAD_DIR || path.join(DATA_DIR, "private-uploads"));
const MAP_MODERATORS = new Set((process.env.YUGORNO_MODERATOR_IDS || "").split(",").map(value => value.trim()).filter(Boolean));
const MAP_ADMINS = new Set((process.env.YUGORNO_ADMIN_IDS || "").split(",").map(value => value.trim()).filter(Boolean));
const BOT_TOKEN = process.env.BOT_TOKEN?.trim();
const BOT_USERNAME = process.env.BOT_USERNAME?.replace(/^@/, "").trim() || "YugornoTravelBot";
const WEBAPP_URL = process.env.WEBAPP_URL?.trim();
const configuredAuthMaxAge = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 86400);
const AUTH_MAX_AGE_SECONDS = Number.isSafeInteger(configuredAuthMaxAge) && configuredAuthMaxAge > 0
  ? Math.min(configuredAuthMaxAge, 604800)
  : 86400;
const TOKEN_PLACEHOLDER = "paste_your_bot_token_here";
const botEnabled = Boolean(BOT_TOKEN && BOT_TOKEN !== TOKEN_PLACEHOLDER);
const botPollingDisabled = process.env.DISABLE_BOT_POLLING === "true";
const localDemoEnabled = process.env.NODE_ENV !== "production" && (process.env.LOCAL_DEMO_MODE === "true" || !botEnabled);
const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || (process.env.NODE_ENV !== "production" ? "local-yugorno-session-secret-change-before-deploy" : "");
if (process.env.NODE_ENV === "production" && !botEnabled) {
  throw new Error("BOT_TOKEN is required in production. Add it to the hosting environment before starting Yugorno.");
}
const waOtpChallenges = new Map();
const waOtpCooldown = new Map();

app.disable("x-powered-by");
app.use(express.json({ limit: "8mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  next();
});
app.use("/uploads", express.static(UPLOADS_DIR, { etag: true, maxAge: "1d", fallthrough: false }));
app.use(express.static(path.join(process.cwd(), "public"), { etag: true, maxAge: "1h" }));

app.post("/api/uploads/image", requireTelegramUser, async (req, res, next) => {
  try {
    const dataUrl = String(req.body?.dataUrl || "");
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return res.status(400).json({ ok: false, error: "unsupported_image_format" });
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) return res.status(413).json({ ok: false, error: "image_too_large" });
    const signatures = {
      "image/jpeg": buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
      "image/png": buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/webp": buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP"
    };
    if (!signatures[match[1]]) return res.status(400).json({ ok: false, error: "image_content_mismatch" });
    const ext = ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" })[match[1]];
    const isPrivate = req.body?.private === true;
    const targetDir = isPrivate ? PRIVATE_UPLOADS_DIR : UPLOADS_DIR;
    await mkdir(targetDir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    await writeFile(path.join(targetDir, filename), buffer, { flag: "wx", mode: 0o600 });
    res.status(201).json({ ok: true, imageUrl: isPrivate ? `/api/map-uploads/${filename}` : `/uploads/${filename}` });
  } catch (error) { next(error); }
});

app.get("/api/map-uploads/:filename", async (req, res, next) => {
  try {
    const filename = String(req.params.filename || "");
    if (!/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/i.test(filename)) return res.sendStatus(404);
    const initData = req.get("X-Telegram-Init-Data");
    const auth = initData ? validateTelegramInitData(initData, botEnabled ? BOT_TOKEN : "", AUTH_MAX_AGE_SECONDS) : null;
    const phoneSession = verifyPhoneSession(req.get("X-Yugorno-Session"));
    const userId = auth?.ok && auth.user?.id ? String(auth.user.id) : phoneSession?.id || (isLocalDemoAdminRequest(req) ? "local-tester" : null);
    const isModerator = isLocalDemoAdminRequest(req) || MAP_MODERATORS.has(String(userId || ""));
    const allowed = await canViewMapUpload(userId, filename, isModerator);
    if (!allowed) return res.sendStatus(404);
    const isPublic = await canViewMapUpload(null, filename, false);
    res.setHeader("Cache-Control", isPublic ? "public, max-age=86400" : "private, no-store");
    res.sendFile(path.join(PRIVATE_UPLOADS_DIR, filename), error => { if (error && !res.headersSent) next(error); });
  } catch (error) { next(error); }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "yugorno", version: "0.6.1" });
});


function optionalAuthenticatedUser(req) {
  if (isLocalDemoAdminRequest(req)) return { id: "local-tester", first_name: "Локальный тестировщик", authMethod: "local-demo" };
  const phoneSession = verifyPhoneSession(req.get("X-Yugorno-Session"));
  if (phoneSession) return { id: phoneSession.id, first_name: phoneSession.phone, phone: phoneSession.phone, authMethod: "whatsapp" };
  const initData = req.get("X-Telegram-Init-Data");
  const auth = validateTelegramInitData(initData, botEnabled ? BOT_TOKEN : "", AUTH_MAX_AGE_SECONDS);
  return auth.ok && auth.user?.id ? { ...auth.user, authMethod: "telegram" } : null;
}
function userRole(userId) {
  const id = String(userId || "");
  if (id === "local-tester" || MAP_ADMINS.has(id)) return "admin";
  if (MAP_MODERATORS.has(id)) return "moderator";
  return "member";
}
app.get("/api/session", (req, res) => {
  const user = optionalAuthenticatedUser(req);
  if (!user) return res.json({ ok: true, authenticated: false, role: "guest", user: null });
  const { id, first_name, last_name, username, phone, authMethod } = user;
  res.json({ ok: true, authenticated: true, role: userRole(id), user: { id, first_name, last_name, username, phone, authMethod } });
});
app.get("/api/status", (_req, res) => {
  res.json({
    app: "Югорно",
    botConfigured: botEnabled,
    miniAppConfigured: Boolean(WEBAPP_URL),
    telegramAuthAvailable: botEnabled,
    whatsappAuthAvailable: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_OTP_TEMPLATE && SESSION_SECRET),
    botPollingEnabled: botEnabled && !botPollingDisabled,
    botUsername: BOT_USERNAME,
    localDemoEnabled
  });
});



function signPhoneSession(phone) {
  const payload = Buffer.from(JSON.stringify({ sub: `wa:${phone}`, phone, exp: Date.now() + 30 * 86400_000, provider: "whatsapp" })).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function verifyPhoneSession(token) {
  if (!SESSION_SECRET || typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", SESSION_SECRET).update(payload).digest();
  let actual; try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try { const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); return data.exp > Date.now() && /^\+?[1-9]\d{7,14}$/.test(data.phone) ? { id: data.sub, phone: data.phone, provider: "whatsapp" } : null; } catch { return null; }
}
function normalizePhone(value) { const phone = String(value || "").replace(/[\s()-]/g, ""); return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : ""; }
async function sendWhatsAppOtp(phone, code) {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const version = process.env.WHATSAPP_API_VERSION?.trim() || "v22.0";
  const template = process.env.WHATSAPP_OTP_TEMPLATE?.trim();
  const language = process.env.WHATSAPP_OTP_LANGUAGE?.trim() || "ru";
  if (!id || !token || !template) throw new Error("whatsapp_provider_not_configured");
  const response = await fetch(`https://graph.facebook.com/${version}/${id}/messages`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace("+", ""), type: "template", template: { name: template, language: { code: language }, components: [{ type: "body", parameters: [{ type: "text", text: code }] }, { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] }] } })
  });
  if (!response.ok) { const detail = await response.text(); console.error("WhatsApp OTP delivery failed:", detail.slice(0, 500)); throw new Error("whatsapp_delivery_failed"); }
}
app.post("/api/auth/whatsapp/send-code", async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) return res.status(400).json({ ok: false, error: "phone_must_be_e164" });
  if (!SESSION_SECRET) return res.status(503).json({ ok: false, error: "session_secret_not_configured" });
  const last = waOtpCooldown.get(phone) || 0;
  if (Date.now() - last < 60_000) return res.status(429).json({ ok: false, error: "otp_rate_limited" });
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    await sendWhatsAppOtp(phone, code);
    const digest = createHmac("sha256", SESSION_SECRET).update(`${phone}:${code}`).digest("hex");
    waOtpChallenges.set(phone, { digest, expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
    waOtpCooldown.set(phone, Date.now());
    res.json({ ok: true, expiresIn: 300 });
  } catch (error) {
    const configured = error.message !== "whatsapp_provider_not_configured";
    res.status(configured ? 502 : 503).json({ ok: false, error: error.message });
  }
});
app.post("/api/auth/whatsapp/verify-code", (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code || "").trim();
  if (!phone || !/^\d{6}$/.test(code)) return res.status(400).json({ ok: false, error: "invalid_phone_or_code" });
  const challenge = waOtpChallenges.get(phone);
  if (!challenge || challenge.expiresAt < Date.now() || challenge.attempts >= 5) { waOtpChallenges.delete(phone); return res.status(401).json({ ok: false, error: "otp_expired_or_missing" }); }
  const digest = createHmac("sha256", SESSION_SECRET).update(`${phone}:${code}`).digest("hex");
  challenge.attempts += 1;
  if (!timingSafeEqual(Buffer.from(digest), Buffer.from(challenge.digest))) return res.status(401).json({ ok: false, error: "invalid_otp" });
  waOtpChallenges.delete(phone);
  res.json({ ok: true, sessionToken: signPhoneSession(phone), user: { id: `wa:${phone}`, phone, provider: "whatsapp" } });
});

app.post("/api/auth/telegram", (req, res) => {
  const result = validateTelegramInitData(req.body?.initData, botEnabled ? BOT_TOKEN : "", AUTH_MAX_AGE_SECONDS);
  if (!result.ok || !result.user?.id) {
    return res.status(401).json({ ok: false, error: "telegram_auth_failed" });
  }
  return res.json({ ok: true, user: result.user, authDate: result.authDate });
});

function requireTelegramUser(req, res, next) {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  const remote = req.socket?.remoteAddress || '';
  const loopbackHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const loopbackRemote = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  if (localDemoEnabled && loopbackHost && loopbackRemote && req.get('X-Local-Demo-User') === 'local-tester') {
    req.telegramUser = { id: 'local-tester', first_name: 'Локальный тестировщик' };
    return next();
  }
  const phoneSession = verifyPhoneSession(req.get("X-Yugorno-Session"));
  if (phoneSession) { req.telegramUser = { id: phoneSession.id, first_name: phoneSession.phone, phone: phoneSession.phone }; return next(); }
  const initData = req.get("X-Telegram-Init-Data") || req.body?.initData;
  const result = validateTelegramInitData(initData, botEnabled ? BOT_TOKEN : "", AUTH_MAX_AGE_SECONDS);
  if (!result.ok || !result.user?.id) return res.status(401).json({ ok: false, error: "telegram_auth_required" });
  req.telegramUser = result.user;
  next();
}

app.get("/api/trips", async (_req, res, next) => {
  try { res.json({ ok: true, items: await listTrips() }); } catch (error) { next(error); }
});
app.get("/api/trips/:id", async (req, res, next) => {
  try {
    const item = await getTrip(req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: "trip_not_found" });
    res.json({ ok: true, item });
  } catch (error) { next(error); }
});
app.post("/api/trips", requireTelegramUser, async (req, res, next) => {
  try { res.status(201).json({ ok: true, item: await createTrip(req.telegramUser.id, req.body || {}) }); }
  catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});
app.patch("/api/my/trips/:id", requireTelegramUser, async (req, res, next) => {
  try {
    const item = await updateTrip(req.telegramUser.id, req.params.id, req.body || {});
    if (!item) return res.status(404).json({ ok: false, error: "trip_not_found" });
    const { authorId, ...publicItem } = item;
    res.json({ ok: true, item: publicItem });
  } catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});
app.delete("/api/my/trips/:id", requireTelegramUser, async (req, res, next) => {
  try {
    const result = await unpublishTrip(req.telegramUser.id, req.params.id);
    if (!result) return res.status(404).json({ ok: false, error: "trip_not_found" });
    res.json({ ok: true, item: result });
  } catch (error) { next(error); }
});
app.get("/api/communities", async (_req, res, next) => {
  try { res.json({ ok: true, items: await listCommunities() }); } catch (error) { next(error); }
});
app.post("/api/communities", requireTelegramUser, async (req, res, next) => {
  try { res.status(201).json({ ok: true, item: await createCommunity(req.telegramUser.id, req.body || {}) }); }
  catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});
app.patch("/api/my/communities/:id", requireTelegramUser, async (req, res, next) => {
  try {
    const item = await updateCommunity(req.telegramUser.id, req.params.id, req.body || {});
    if (!item) return res.status(404).json({ ok: false, error: "community_not_found" });
    const { authorId, ...publicItem } = item;
    res.json({ ok: true, item: publicItem });
  } catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});
app.delete("/api/my/communities/:id", requireTelegramUser, async (req, res, next) => {
  try {
    const result = await unpublishCommunity(req.telegramUser.id, req.params.id);
    if (!result) return res.status(404).json({ ok: false, error: "community_not_found" });
    res.json({ ok: true, item: result });
  } catch (error) { next(error); }
});
app.post("/api/trips/:id/interest", requireTelegramUser, async (req, res, next) => {
  try {
    const result = await expressTripInterest(req.telegramUser.id, req.params.id);
    if (!result) return res.status(404).json({ ok: false, error: "trip_not_found" });
    if (result.selfInterest) return res.status(400).json({ ok: false, error: "cannot_apply_to_own_trip" });
    if (!result.alreadyInterested && result.notifyUserId && result.notifyUserId !== String(req.telegramUser.id)) {
      const participant = [req.telegramUser.first_name, req.telegramUser.last_name].filter(Boolean).join(" ") || "Участник Югорно";
      telegram("sendMessage", { chat_id: Number(result.notifyUserId), text: `Новый отклик на путешествие «${result.tripTitle}» от ${participant}. Откройте Югорно, чтобы посмотреть отклики.` })
        .catch(error => console.warn("Trip interest notification failed:", error.message));
    }
    const { notifyUserId, tripTitle, ...publicResult } = result;
    res.json({ ok: true, result: publicResult });
  } catch (error) { next(error); }
});
app.post("/api/communities/:id/join", requireTelegramUser, async (req, res, next) => {
  try {
    const result = await joinCommunity(req.telegramUser.id, req.params.id);
    if (!result) return res.status(404).json({ ok: false, error: "community_not_found" });
    if (!result.alreadyJoined && result.notifyUserId && result.notifyUserId !== String(req.telegramUser.id)) {
      const participant = [req.telegramUser.first_name, req.telegramUser.last_name].filter(Boolean).join(" ") || "Участник Югорно";
      telegram("sendMessage", { chat_id: Number(result.notifyUserId), text: `${participant} присоединился к сообществу «${result.communityTitle}». Откройте Югорно, чтобы увидеть участников.` })
        .catch(error => console.warn("Community join notification failed:", error.message));
    }
    const { notifyUserId, communityTitle, ...publicResult } = result;
    res.json({ ok: true, result: publicResult });
  } catch (error) { next(error); }
});

app.get("/api/my/trash", requireTelegramUser, async (req, res, next) => {
  try { res.json({ ok: true, items: await listMyTrash(req.telegramUser.id) }); } catch (error) { next(error); }
});
app.delete("/api/my/publications/:kind/:id", requireTelegramUser, async (req, res, next) => {
  try {
    const item = await trashPublication(req.telegramUser.id, req.params.kind, req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: "publication_not_found" });
    res.json({ ok: true, item });
  } catch (error) { if (error instanceof TypeError) return res.status(409).json({ ok: false, error: error.message }); next(error); }
});
app.post("/api/my/trash/:kind/:id/restore", requireTelegramUser, async (req, res, next) => {
  try {
    const item = await restorePublication(req.telegramUser.id, req.params.kind, req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: "trash_item_not_found" });
    res.json({ ok: true, item });
  } catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});

app.get("/api/my/trips", requireTelegramUser, async (req, res, next) => {
  try { res.json({ ok: true, items: await listMyTrips(req.telegramUser.id) }); } catch (error) { next(error); }
});
app.get("/api/my/communities", requireTelegramUser, async (req, res, next) => {
  try { res.json({ ok: true, items: await listMyCommunities(req.telegramUser.id) }); } catch (error) { next(error); }
});
app.get("/api/my/communities/:id/members", requireTelegramUser, async (req, res, next) => {
  try {
    const items = await listCommunityMembers(req.telegramUser.id, req.params.id);
    if (!items) return res.status(404).json({ ok: false, error: "community_not_found" });
    res.json({ ok: true, items });
  } catch (error) { next(error); }
});
app.delete("/api/my/communities/:id/members/:memberId", requireTelegramUser, async (req, res, next) => {
  try {
    const result = await removeCommunityMember(req.telegramUser.id, req.params.id, req.params.memberId);
    if (!result) return res.status(404).json({ ok: false, error: "community_not_found" });
    if (!result.removed) return res.status(404).json({ ok: false, error: "member_not_found" });
    res.json({ ok: true, result });
  } catch (error) { next(error); }
});
app.get("/api/my/trips/:id/interests", requireTelegramUser, async (req, res, next) => {
  try {
    const items = await listTripInterests(req.telegramUser.id, req.params.id);
    if (!items) return res.status(404).json({ ok: false, error: "trip_not_found" });
    res.json({ ok: true, items });
  } catch (error) { next(error); }
});


function isLocalDemoAdminRequest(req) {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  const remote = req.socket?.remoteAddress || '';
  const loopbackHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const loopbackRemote = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  return localDemoEnabled && loopbackHost && loopbackRemote && req.get('X-Local-Demo-User') === 'local-tester';
}
function requireMapModerator(req, res, next) {
  const role = userRole(req.telegramUser?.id);
  if (role !== "admin" && role !== "moderator") return res.status(403).json({ ok: false, error: "moderator_required" });
  next();
}
function authorLabel(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "";
}

app.get("/api/destinations", async (_req, res, next) => {
  try { res.json({ ok: true, items: await listFeaturedDestinations() }); } catch (error) { next(error); }
});
app.get("/api/admin/destinations", requireTelegramUser, requireMapModerator, async (_req, res, next) => {
  try { res.json({ ok: true, items: await listFeaturedDestinations() }); } catch (error) { next(error); }
});
app.patch("/api/admin/destinations/:slug", requireTelegramUser, requireMapModerator, async (req, res, next) => {
  try {
    const item = await updateFeaturedDestination(req.params.slug, req.body || {});
    if (!item) return res.status(404).json({ ok: false, error: "destination_not_found" });
    res.json({ ok: true, item });
  } catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});

app.get("/api/places", async (req, res, next) => {
  try {
    const items = await listPlaces({ q: req.query.q, category: req.query.category, west: req.query.west, east: req.query.east, south: req.query.south, north: req.query.north });
    res.json({ ok: true, items });
  } catch (error) { next(error); }
});
app.get("/api/places/:id", async (req, res, next) => {
  try {
    const item = await getPlace(req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: "place_not_found" });
    res.json({ ok: true, item, impressions: await listImpressions(item.id) });
  } catch (error) { next(error); }
});
app.get("/api/my/places", requireTelegramUser, async (req, res, next) => {
  try { res.json({ ok: true, items: await listMyPlaces(req.telegramUser.id) }); } catch (error) { next(error); }
});
app.get("/api/my/routes", requireTelegramUser, async (req, res, next) => {
  try { res.json({ ok: true, items: await listMyRoutes(req.telegramUser.id) }); } catch (error) { next(error); }
});
app.patch("/api/my/routes/:id", requireTelegramUser, async (req, res, next) => {
  try {
    const item = await updateRoute(req.telegramUser.id, req.params.id, req.body || {});
    if (!item) return res.status(404).json({ ok: false, error: "route_not_found" });
    res.json({ ok: true, item });
  } catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});
app.get("/api/my/impressions", requireTelegramUser, async (req, res, next) => {
  try { res.json({ ok: true, items: await listMyImpressions(req.telegramUser.id) }); } catch (error) { next(error); }
});
app.patch("/api/my/impressions/:id", requireTelegramUser, async (req, res, next) => {
  try {
    const item = await updateImpression(req.telegramUser.id, req.params.id, req.body || {});
    if (!item) return res.status(404).json({ ok: false, error: "impression_not_found" });
    res.json({ ok: true, item });
  } catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});
app.post("/api/places", requireTelegramUser, async (req, res, next) => {
  try {
    const item = await createPlace(req.telegramUser.id, req.body || {}, authorLabel(req.telegramUser));
    if (item?.duplicate) return res.status(409).json({ ok: false, error: "Похожее место уже опубликовано рядом. Проверьте существующую точку перед повторным добавлением.", matches: item.matches });
    res.status(201).json({ ok: true, item });
  } catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});
app.patch("/api/my/places/:id", requireTelegramUser, async (req, res, next) => {
  try {
    const item = await updatePlace(req.telegramUser.id, req.params.id, req.body || {});
    if (!item) return res.status(404).json({ ok: false, error: "place_not_found" });
    res.json({ ok: true, item });
  } catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});
app.post("/api/places/:id/impressions", requireTelegramUser, async (req, res, next) => {
  try {
    const item = await createImpression(req.telegramUser.id, req.params.id, req.body || {}, authorLabel(req.telegramUser));
    if (!item) return res.status(404).json({ ok: false, error: "place_not_found" });
    res.status(201).json({ ok: true, item });
  } catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});
app.get("/api/routes", async (_req, res, next) => {
  try { res.json({ ok: true, items: await listRoutes() }); } catch (error) { next(error); }
});
app.post("/api/routes", requireTelegramUser, async (req, res, next) => {
  try { res.status(201).json({ ok: true, item: await createRoute(req.telegramUser.id, req.body || {}, authorLabel(req.telegramUser)) }); }
  catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});
app.post("/api/my/places/:id/save", requireTelegramUser, async (req, res, next) => {
  try {
    const result = await savePlace(req.telegramUser.id, req.params.id);
    if (!result) return res.status(404).json({ ok: false, error: "place_not_found" });
    res.json({ ok: true, result });
  } catch (error) { next(error); }
});
app.delete("/api/my/places/:id/save", requireTelegramUser, async (req, res, next) => {
  try { res.json({ ok: true, result: await unsavePlace(req.telegramUser.id, req.params.id) }); } catch (error) { next(error); }
});
app.get("/api/my/saved-places", requireTelegramUser, async (req, res, next) => {
  try { res.json({ ok: true, items: await listSavedPlaces(req.telegramUser.id) }); } catch (error) { next(error); }
});
app.get("/api/moderation/places", requireTelegramUser, requireMapModerator, async (_req, res, next) => { try { res.json({ ok: true, items: await listMapModerationQueue("places") }); } catch (error) { next(error); } });
app.get("/api/moderation/impressions", requireTelegramUser, requireMapModerator, async (_req, res, next) => { try { res.json({ ok: true, items: await listMapModerationQueue("impressions") }); } catch (error) { next(error); } });
app.patch("/api/moderation/places/:id", requireTelegramUser, requireMapModerator, async (req, res, next) => {
  try {
    const item = await moderatePlace(req.params.id, req.body?.status);
    if (!item) return res.status(404).json({ ok: false, error: "place_not_found" });
    res.json({ ok: true, item });
  } catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});
app.get("/api/moderation/routes", requireTelegramUser, requireMapModerator, async (_req, res, next) => { try { res.json({ ok: true, items: await listMapModerationQueue("routes") }); } catch (error) { next(error); } });
app.patch("/api/moderation/routes/:id", requireTelegramUser, requireMapModerator, async (req, res, next) => { try { const item = await moderateRoute(req.params.id, req.body?.status); if (!item) return res.status(404).json({ ok: false, error: "route_not_found" }); res.json({ ok: true, item }); } catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); } });
app.patch("/api/moderation/impressions/:id", requireTelegramUser, requireMapModerator, async (req, res, next) => {
  try {
    const item = await moderateImpression(req.params.id, req.body?.status);
    if (!item) return res.status(404).json({ ok: false, error: "impression_not_found" });
    res.json({ ok: true, item });
  } catch (error) { if (error instanceof TypeError) return res.status(400).json({ ok: false, error: error.message }); next(error); }
});

app.get("/api/profile", requireTelegramUser, async (req, res, next) => {
  try { res.json({ ok: true, profile: await getProfile(req.telegramUser.id) }); } catch (error) { next(error); }
});
app.put("/api/profile", requireTelegramUser, async (req, res, next) => {
  try { res.json({ ok: true, profile: await saveProfile(req.telegramUser.id, req.body || {}) }); } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error("HTTP request failed:", error.message);
  res.status(500).json({ ok: false, error: "internal_server_error" });
});

async function telegram(method, payload = {}) {
  if (!botEnabled) throw new Error("Telegram bot is not configured");
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(40_000)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API error: ${response.status}`);
  }
  return data.result;
}

async function sendStartMessage(chatId, firstName = "") {
  const greeting = firstName ? `, ${firstName}` : "";
  const message =
    `Привет${greeting}! Это Югорно.\n\n` +
    `Магия троп. Люди. Места. Встречи.\n\n` +
    `Здесь будут путешествия, локальные сообщества и встречи. ` +
    `Мы постепенно собираем платформу и начинаем с направлений У Илем, Териберка и Карелия.`;

  const keyboard = WEBAPP_URL
    ? { inline_keyboard: [[{ text: "Открыть Югорно", web_app: { url: WEBAPP_URL } }]] }
    : { inline_keyboard: [[{ text: "Что такое Югорно?", callback_data: "about" }]] };

  await telegram("sendMessage", { chat_id: chatId, text: message, reply_markup: keyboard });
}

async function handleCallbackQuery(query) {
  if (query.data === "about") {
    await telegram("answerCallbackQuery", { callback_query_id: query.id });
    await telegram("sendMessage", {
      chat_id: query.message.chat.id,
      text: "Югорно — платформа путешествий и сообществ. Сейчас мы собираем первую рабочую версию."
    });
  }
}

async function startPolling() {
  let offset = 0;
  console.log(`Telegram polling started for @${BOT_USERNAME}`);
  while (true) {
    try {
      const updates = await telegram("getUpdates", {
        offset, timeout: 30, allowed_updates: ["message", "callback_query"]
      });
      for (const update of updates) {
        offset = update.update_id + 1;
        try {
          if (update.message?.text) {
            const messageText = update.message.text.trim();
            const chatId = update.message.chat.id;
            if (messageText === "/start" || messageText.startsWith("/start ")) {
              await sendStartMessage(chatId, update.message.from?.first_name || "");
            } else if (messageText === "/help") {
              await telegram("sendMessage", {
                chat_id: chatId,
                text: "Команды:\n/start — открыть Югорно\n/help — помощь\n\nЮгорно постепенно открывает новые возможности."
              });
            } else {
              await telegram("sendMessage", {
                chat_id: chatId,
                text: "Сообщение получил. Пока доступны команды /start и /help."
              });
            }
          }
          if (update.callback_query) await handleCallbackQuery(update.callback_query);
        } catch (error) {
          console.error("Update handling error:", error.message);
        }
      }
    } catch (error) {
      console.error("Telegram polling error:", error.message);
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }
}

const server = app.listen(PORT, localDemoEnabled && !botEnabled ? "127.0.0.1" : "0.0.0.0", () => {
  console.log(`Югорно server listening on port ${PORT}`);
  console.log(`Health check: /health`);
});

if (!botEnabled) {
  console.warn(localDemoEnabled ? "BOT_TOKEN is not configured. Local-only demo auth is enabled on 127.0.0.1; Telegram bot/auth are disabled." : "BOT_TOKEN is not configured. Web app is available; Telegram bot and initData auth are disabled.");
} else if (botPollingDisabled) {
  console.log("Telegram polling is disabled by DISABLE_BOT_POLLING=true; Mini App auth and Bot API notifications remain available.");
} else {
  startPolling();
}

function shutdown(signal) {
  console.log(`${signal} received. Closing HTTP server...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));