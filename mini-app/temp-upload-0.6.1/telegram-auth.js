import crypto from "node:crypto";

/**
 * Validate Telegram Mini App initData.
 * The bot token must only be supplied by the server environment.
 */
export function validateTelegramInitData(initData, botToken, maxAgeSeconds = 86_400, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof botToken !== "string" || !botToken || typeof initData !== "string" || !initData || initData.length > 16_384) {
    return { ok: false, reason: "invalid_request" };
  }

  const params = new URLSearchParams(initData);
  const seenKeys = new Set();
  for (const [key] of params.entries()) {
    if (seenKeys.has(key)) return { ok: false, reason: "duplicate_parameter" };
    seenKeys.add(key);
  }
  const receivedHash = params.get("hash");
  const authDateRaw = params.get("auth_date");
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash) || !authDateRaw || !/^\d+$/.test(authDateRaw)) {
    return { ok: false, reason: "invalid_signature" };
  }

  const authDate = Number(authDateRaw);
  if (!Number.isSafeInteger(authDate) || authDate > nowSeconds + 60 || nowSeconds - authDate > maxAgeSeconds) {
    return { ok: false, reason: "expired_auth" };
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest();
  const suppliedHash = Buffer.from(receivedHash, "hex");
  if (suppliedHash.length !== calculatedHash.length || !crypto.timingSafeEqual(suppliedHash, calculatedHash)) {
    return { ok: false, reason: "invalid_signature" };
  }

  let user = null;
  const userRaw = params.get("user");
  if (userRaw) {
    try {
      const parsed = JSON.parse(userRaw);
      if (parsed && Number.isSafeInteger(parsed.id) && parsed.id > 0) {
        user = {
          id: parsed.id,
          first_name: typeof parsed.first_name === "string" ? parsed.first_name.slice(0, 128) : "",
          last_name: typeof parsed.last_name === "string" ? parsed.last_name.slice(0, 128) : "",
          username: typeof parsed.username === "string" ? parsed.username.slice(0, 64) : "",
          language_code: typeof parsed.language_code === "string" ? parsed.language_code.slice(0, 16) : ""
        };
      }
    } catch {
      return { ok: false, reason: "invalid_user" };
    }
  }

  return { ok: true, authDate, user };
}
