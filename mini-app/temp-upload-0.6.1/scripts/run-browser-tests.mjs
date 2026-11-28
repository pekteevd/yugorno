import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "yugorno-browser-suite-"));
const dataDir = path.join(tempRoot, "data");
const uploadDir = path.join(tempRoot, "uploads");
const privateUploadDir = path.join(tempRoot, "private-uploads");
const portServer = createServer();
let server;
let serverOutput = "";
let exitCode = 0;

async function getFreePort() {
  await new Promise((resolve, reject) => {
    portServer.once("error", reject);
    portServer.listen(0, "127.0.0.1", resolve);
  });
  const port = portServer.address().port;
  await new Promise(resolve => portServer.close(resolve));
  return port;
}

async function waitForServer(url) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Test server exited early:\n" + serverOutput);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error("Test server did not become ready:\n" + serverOutput);
}

try {
  const port = await getFreePort();
  const baseUrl = "http://127.0.0.1:" + port;
  server = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "test",
      BOT_TOKEN: "",
      PORT: String(port),
      LOCAL_DEMO_MODE: "true",
      DISABLE_BOT_POLLING: "true",
      YUGORNO_DATA_DIR: dataDir,
      YUGORNO_UPLOAD_DIR: uploadDir,
      YUGORNO_PRIVATE_UPLOAD_DIR: privateUploadDir
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
  server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

  await waitForServer(baseUrl + "/health");
  process.stdout.write("Test server ready on " + baseUrl + "\n");

  for (const spec of ["tests/admin-browser.spec.js", "tests/map-browser.spec.js"]) {
    process.stdout.write("\n=== " + spec + " ===\n");
    const result = spawnSync(process.execPath, [spec], {
      cwd: root,
      env: { ...process.env, YUGORNO_BASE_URL: baseUrl },
      stdio: "inherit"
    });
    if (result.error) {
      process.stderr.write(result.error.stack || result.error.message);
      exitCode = 1;
    } else if (result.status !== 0) {
      process.stderr.write("FAIL: " + spec + " (exit " + result.status + ")\n");
      exitCode = 1;
    }
  }

  process.stdout.write(exitCode === 0 ? "\nALL BROWSER TESTS PASSED\n" : "\nBROWSER TEST SUITE FAILED\n");
} catch (error) {
  process.stderr.write("\nBROWSER TEST RUNNER ERROR\n" + (error.stack || error.message) + "\n");
  process.stderr.write(serverOutput + "\n");
  exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 1500);
      server.once("exit", () => { clearTimeout(timeout); resolve(); });
    });
  }
  await rm(tempRoot, { recursive: true, force: true });
}

process.exitCode = exitCode;
