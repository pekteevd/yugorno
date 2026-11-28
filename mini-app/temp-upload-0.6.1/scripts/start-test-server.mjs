import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const port = Number(process.env.YUGORNO_TEST_PORT || 3100);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("YUGORNO_TEST_PORT must be a valid TCP port.");
}

const dataDir = path.join(root, ".yugorno-test-data");
const uploadDir = path.join(root, ".yugorno-test-uploads");
const privateUploadDir = path.join(root, ".yugorno-test-private-uploads");
await Promise.all([dataDir, uploadDir, privateUploadDir].map(dir => mkdir(dir, { recursive: true })));

const child = spawn(process.execPath, ["server.js"], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: "development",
    BOT_TOKEN: "",
    WEBAPP_URL: "",
    PORT: String(port),
    LOCAL_DEMO_MODE: "true",
    DISABLE_BOT_POLLING: "true",
    YUGORNO_DATA_DIR: dataDir,
    YUGORNO_UPLOAD_DIR: uploadDir,
    YUGORNO_PRIVATE_UPLOAD_DIR: privateUploadDir
  },
  stdio: "inherit"
});

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (child.exitCode === null) child.kill(signal);
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

process.stdout.write("\nЮгорно: отдельный локальный тестовый стенд\n");
process.stdout.write("Адрес: http://127.0.0.1:" + port + "\n");
process.stdout.write("Вход: Мой профиль → Войти → «Войти как локальный тестовый администратор»\n");
process.stdout.write("Данные теста: " + dataDir + "\n");
process.stdout.write("Рабочие данные и Deployka не используются.\n");
process.stdout.write("Остановка: Ctrl+C в этом окне PowerShell.\n\n");
