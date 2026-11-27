import "dotenv/config";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (packageJson.name !== "yugorno-bot") throw new Error("Запустите очистку из папки mini-app/temp-upload-0.6.1.");
if (process.env.NODE_ENV === "production" || process.env.BOT_TOKEN) {
  throw new Error("Очистка запрещена: обнаружена production-конфигурация или BOT_TOKEN.");
}

const expectedDataDir = path.join(root, "data");
const dataDir = path.resolve(process.env.YUGORNO_DATA_DIR || expectedDataDir);
if (dataDir !== expectedDataDir) throw new Error("Очистка разрешена только для локальной папки проекта data.");
const dataFile = path.join(dataDir, "store.json");

let store;
try {
  store = JSON.parse(await readFile(dataFile, "utf8"));
} catch (error) {
  if (error.code === "ENOENT") throw new Error("Локальная база data/store.json не найдена. Нечего очищать.");
  throw new Error("Не удалось прочитать локальную базу: " + error.message);
}

const backupDir = path.join(dataDir, "backups");
await mkdir(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(backupDir, `store-before-publication-cleanup-${stamp}.json`);
await copyFile(dataFile, backupFile);

const publicationCollections = ["trips", "communities", "places", "impressions", "routes"];
const counts = Object.fromEntries(publicationCollections.map(key => [key, Array.isArray(store[key]) ? store[key].length : 0]));
for (const key of publicationCollections) store[key] = [];

for (const key of ["tripInterests", "communityMembers", "savedPlaces"]) {
  store[key] = [];
}

const allowedDestinationSlugs = new Set(["karelia", "teriberka", "u-ilem"]);
store.featuredDestinations = Array.isArray(store.featuredDestinations)
  ? store.featuredDestinations.filter(item => allowedDestinationSlugs.has(item?.slug))
  : [];

const tempFile = `${dataFile}.${process.pid}.tmp`;
await writeFile(tempFile, `${JSON.stringify(store, null, 2)}\\n`, { mode: 0o600 });
await rename(tempFile, dataFile);

console.log("Локальные публикации очищены.");
for (const [kind, count] of Object.entries(counts)) console.log(`  ${kind}: ${count} → 0`);
console.log("Сохранены штатные направления: Карелия, Териберка, У Илем.");
console.log("Профили пользователей сохранены.");
console.log("Резервная копия: " + backupFile);
console.log("Фотографии из папок uploads не удалялись.");
