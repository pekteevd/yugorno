import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.YUGORNO_BASE_URL || "http://127.0.0.1:3187";
const leafletJs = new URL("../node_modules/leaflet/dist/leaflet.js", import.meta.url);
const leafletCss = new URL("../node_modules/leaflet/dist/leaflet.css", import.meta.url);
const clusterJs = new URL("../node_modules/leaflet.markercluster/dist/leaflet.markercluster.js", import.meta.url);
const clusterCss = new URL("../node_modules/leaflet.markercluster/dist/MarkerCluster.css", import.meta.url);
const clusterDefaultCss = new URL("../node_modules/leaflet.markercluster/dist/MarkerCluster.Default.css", import.meta.url);
const transparentPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=", "base64");

const browser = await chromium.launch({ headless: true });
const failures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", error => failures.push(error.message));

  await page.addInitScript(() => { window.yugornoLocalDemo = true; });
  await page.route("https://telegram.org/**", route => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.route("https://unpkg.com/**", async route => {
    const url = route.request().url();
    let file;
    if (url.includes("leaflet.markercluster") && url.endsWith("MarkerCluster.Default.css")) file = clusterDefaultCss;
    else if (url.includes("leaflet.markercluster") && url.endsWith("MarkerCluster.css")) file = clusterCss;
    else if (url.includes("leaflet.markercluster") && url.endsWith("leaflet.markercluster.js")) file = clusterJs;
    else if (url.includes("leaflet@") && url.endsWith("leaflet.css")) file = leafletCss;
    else if (url.includes("leaflet@") && url.endsWith("leaflet.js")) file = leafletJs;
    else return route.abort();
    await route.fulfill({ status: 200, body: await readFile(file) });
  });
  await page.route("https://tile.openstreetmap.org/**", route => route.fulfill({ status: 200, contentType: "image/png", body: transparentPng }));
  await page.route("https://server.arcgisonline.com/**", route => route.fulfill({ status: 200, contentType: "image/png", body: transparentPng }));
  await page.route("https://*.tile.opentopomap.org/**", route => route.fulfill({ status: 200, contentType: "image/png", body: transparentPng }));

  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "Mini App should return HTTP 200");
  await page.locator('[data-view="map"]').click();
  await page.locator("#yugorno-map.leaflet-container").waitFor({ state: "attached", timeout: 15000 });
  await page.locator("#map.view.active").waitFor({ state: "visible", timeout: 5000 });
  await page.locator("#map-add-btn").click();
  const picker = page.locator("#place-location-map.leaflet-container");
  await picker.waitFor({ state: "visible", timeout: 15000 });

  // Exercise the real Leaflet map click path and verify that the hidden form fields are populated.
  const box = await picker.boundingBox();
  assert.ok(box && box.width > 100 && box.height > 100, "place picker map should have a usable size");
  await picker.click({ position: { x: Math.round(box.width * 0.55), y: Math.round(box.height * 0.55) } });
  await page.waitForFunction(() => {
    const form = document.querySelector("#new-place-form");
    return Boolean(form?.elements.lat.value && form?.elements.lng.value);
  }, { timeout: 5000 });
  assert.match(await page.locator("#place-location-status").innerText(), /^✓/);
  assert.ok(await page.locator("#place-location-map .leaflet-marker-icon").count(), "map click should place a marker");

  // Re-open the form and force Photon to fail; Nominatim must still provide a selectable result.
  await page.locator("#map-form-cancel").click();
  await page.locator("#map-add-btn").click();
  await page.route("https://photon.komoot.io/**", route => route.abort());
  await page.route("https://nominatim.openstreetmap.org/search?**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify([{
      name: "У Илем",
      lat: "56.5001",
      lon: "48.0002",
      display_name: "У Илем, Республика Марий Эл, Россия",
      address: { village: "У Илем", state: "Республика Марий Эл", country: "Россия" }
    }])
  }));
  await page.locator("#place-location-query").fill("У Илем");
  await page.locator("#place-location-search").click();
  const result = page.locator(".map-location-result").first();
  await result.waitFor({ state: "visible", timeout: 10000 });
  await result.click();
  await page.waitForFunction(() => {
    const form = document.querySelector("#new-place-form");
    return form?.elements.lat.value === "56.5001" && form?.elements.lng.value === "48.0002";
  }, { timeout: 5000 });
  assert.match(await page.locator("#place-location-status").innerText(), /^✓ У Илем/);

  assert.deepEqual(failures, [], "browser page should not emit uncaught JavaScript errors");
  process.stdout.write("PASS: Chromium loaded the Mini App and Leaflet map\n");
  process.stdout.write("PASS: clicking the map selected a point, populated coordinates, and placed a marker\n");
  process.stdout.write("PASS: Nominatim fallback selected a result after Photon was unavailable\n");
  process.stdout.write("PASS: no uncaught browser JavaScript errors\n");
} finally {
  await browser.close();
}
