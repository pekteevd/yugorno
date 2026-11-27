import "dotenv/config";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (packageJson.name !== "yugorno-bot") throw new Error("Запустите очистку из папки mini-app/temp-upload-0.6.1.");
if (process.env.NODE_ENV === "production" || process.env.BOT_TOKEN?.trim()) {
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

// Удаляем только известные тестовые записи из локального демо-профиля.
// Все остальные публикации, включая реальное место «У Илем», остаются нетронутыми.
const TEST_PUBLICATION_IDS = {
  places: new Set([
    "04aef7f1-b24f-4fb1-8aaf-8a814e513f5d",
    "dbf8b55f-b181-4031-8e82-9423cde5f47e",
    "d764c47b-1357-4b2a-88b0-1984ed211c38"
  ]),
  impressions: new Set([
    "e3eac278-c8d4-4808-abaf-2d4e459ae68c",
    "0beed35a-5a93-4fa8-ad57-0c1f2fd654c9",
    "b208c553-bad4-42a6-8586-1d3d0b4fd832",
    "9ce39e14-57e2-4b11-897e-fdd53821c148",
    "51fba6b4-243e-449a-9f25-34f5f9e9586a"
  ]),
  routes: new Set([
    "baa11d1b-bbb2-4acb-8cf9-d1e695de1d5f"
  ]),
  trips: new Set(),
  communities: new Set()
};
const OWNER_ID = "local-tester";
const removedIds = { places: new Set(), impressions: new Set(), routes: new Set(), trips: new Set(), communities: new Set() };
const counts = {};

for (const [collection, ids] of Object.entries(TEST_PUBLICATION_IDS)) {
  const records = Array.isArray(store[collection]) ? store[collection] : [];
  const kept = [];
  let removed = 0;
  for (const item of records) {
    if (item?.authorId === OWNER_ID && ids.has(item.id)) {
      removedIds[collection].add(item.id);
      removed += 1;
    } else {
      kept.push(item);
    }
  }
  store[collection] = kept;
  counts[collection] = { before: records.length, removed, after: kept.length };
}

// Убираем только связи с действительно удалёнными тестовыми записями.
if (Array.isArray(store.tripInterests)) {
  store.tripInterests = store.tripInterests.filter(item => !removedIds.trips.has(item?.tripId));
}
if (Array.isArray(store.communityMembers)) {
  store.communityMembers = store.communityMembers.filter(item => !removedIds.communities.has(item?.communityId));
}
if (Array.isArray(store.savedPlaces)) {
  store.savedPlaces = store.savedPlaces.filter(item => !removedIds.places.has(item?.placeId));
}

// Не очищаем profiles, featuredDestinations и медиафайлы.
// В частности, опубликованное место «У Илем» сохраняется.

const backupDir = path.join(dataDir, "backups");
await mkdir(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(backupDir, `store-before-publication-cleanup-${stamp}.json`);
await copyFile(dataFile, backupFile);

const tempFile = `${dataFile}.${process.pid}.tmp`;
await writeFile(tempFile, `${JSON.stringify(store, null, 2)}\\n`, { mode: 0o600 });
await rename(tempFile, dataFile);

console.log("Локальные тестовые публикации очищены.");
for (const [kind, count] of Object.entries(counts)) {
  console.log(`  ${kind}: ${count.removed} удалено, ${count.after} сохранено из ${count.before}`);
}
console.log("Сохранены профили, стандартные направления, все неизвестные публикации и медиафайлы.");
console.log("Резервная копия: " + backupFile);
