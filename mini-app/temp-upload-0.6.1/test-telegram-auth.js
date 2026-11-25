import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { validateTelegramInitData } from "./telegram-auth.js";

const token = "123456:TEST_TOKEN_FOR_UNIT_TESTS_ONLY";
function signedInitData(fields, botToken = token) {
  const params = new URLSearchParams(fields);
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", crypto.createHmac("sha256", secret).update(checkString).digest("hex"));
  return params.toString();
}

test("accepts a valid Telegram initData signature and returns a sanitized user", () => {
  const now = 1_800_000_000;
  const data = signedInitData({ auth_date: String(now), query_id: "query-1", user: JSON.stringify({ id: 42, first_name: "Test", username: "tester", is_bot: false }) });
  const result = validateTelegramInitData(data, token, 3600, now);
  assert.equal(result.ok, true);
  assert.deepEqual(result.user, { id: 42, first_name: "Test", last_name: "", username: "tester", language_code: "" });
});

test("rejects a modified payload", () => {
  const now = 1_800_000_000;
  const data = signedInitData({ auth_date: String(now), user: JSON.stringify({ id: 42 }) }).replace("id%22%3A42", "id%22%3A43");
  assert.equal(validateTelegramInitData(data, token, 3600, now).ok, false);
});

test("rejects expired initData", () => {
  const now = 1_800_000_000;
  const data = signedInitData({ auth_date: String(now - 7200), user: JSON.stringify({ id: 42 }) });
  assert.equal(validateTelegramInitData(data, token, 3600, now).reason, "expired_auth");
});

test("rejects data signed with a different bot token", () => {
  const now = 1_800_000_000;
  const data = signedInitData({ auth_date: String(now), user: JSON.stringify({ id: 42 }) });
  assert.equal(validateTelegramInitData(data, "another-token", 3600, now).reason, "invalid_signature");
});


test("rejects duplicate initData parameters", () => {
  const now = 1_800_000_000;
  const data = signedInitData({ auth_date: String(now), user: JSON.stringify({ id: 42 }) });
  assert.equal(validateTelegramInitData(`${data}&auth_date=${now}`, token, 3600, now).reason, "duplicate_parameter");
});

test("rejects non-positive Telegram user ids", () => {
  const now = 1_800_000_000;
  const data = signedInitData({ auth_date: String(now), user: JSON.stringify({ id: 0 }) });
  assert.equal(validateTelegramInitData(data, token, 3600, now).user, null);
});
