(() => {
"use strict";
function parseTiff(bytes, start, length) {
  const end = start + length;
  if (start < 0 || length < 8 || end > bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (p) => p >= start && p + 2 <= end ? view.getUint16(p, little) : null;
  const u32 = (p) => p >= start && p + 4 <= end ? view.getUint32(p, little) : null;
  const little = bytes[start] === 0x49 && bytes[start + 1] === 0x49;
  if (!little && !(bytes[start] === 0x4d && bytes[start + 1] === 0x4d)) return null;
  if (u16(start + 2) !== 42) return null;
  const ifd0Offset = u32(start + 4);
  if (ifd0Offset === null) return null;
  const ifd0 = start + ifd0Offset;
  const count = u16(ifd0);
  if (count === null || count > 512 || ifd0 + 2 + count * 12 > end) return null;
  let gpsOffset = null;
  for (let i = 0; i < count; i++) {
    const p = ifd0 + 2 + i * 12;
    if (u16(p) === 0x8825) gpsOffset = u32(p + 8);
  }
  if (gpsOffset === null) return null;
  const gpsIfd = start + gpsOffset;
  const gpsCount = u16(gpsIfd);
  if (gpsCount === null || gpsCount > 128 || gpsIfd + 2 + gpsCount * 12 > end) return null;
  const tags = new Map();
  for (let i = 0; i < gpsCount; i++) {
    const p = gpsIfd + 2 + i * 12;
    const tag = u16(p), type = u16(p + 2), n = u32(p + 4), raw = u32(p + 8);
    if (tag === null || type === null || n === null || raw === null) continue;
    const unit = type === 5 ? 8 : type === 2 || type === 1 ? 1 : 0;
    if (!unit || n > 64) continue;
    const size = unit * n, data = size <= 4 ? p + 8 : start + raw;
    if (data < start || data + size > end) continue;
    tags.set(tag, { type, count: n, data });
  }
  const ascii = tag => {
    const item = tags.get(tag);
    if (!item || item.type !== 2) return "";
    return String.fromCharCode(...bytes.subarray(item.data, item.data + item.count)).replace(/\0.*$/, "").trim().toUpperCase();
  };
  const dms = tag => {
    const item = tags.get(tag);
    if (!item || item.type !== 5 || item.count < 3) return null;
    const values = [];
    for (let i = 0; i < 3; i++) {
      const p = item.data + i * 8, numerator = u32(p), denominator = u32(p + 4);
      if (numerator === null || denominator === null || denominator === 0) return null;
      values.push(numerator / denominator);
    }
    return values[0] + values[1] / 60 + values[2] / 3600;
  };
  let lat = dms(2), lng = dms(4);
  const latRef = ascii(1), lngRef = ascii(3);
  if (lat === null || lng === null || !["N","S"].includes(latRef) || !["E","W"].includes(lngRef)) return null;
  if (latRef === "S") lat = -lat;
  if (lngRef === "W") lng = -lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
function findJpegExif(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let p = 2;
  while (p + 4 <= bytes.length) {
    if (bytes[p] !== 0xff) break;
    while (bytes[p] === 0xff) p++;
    const marker = bytes[p++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (p + 2 > bytes.length) break;
    const size = (bytes[p] << 8) | bytes[p + 1];
    if (size < 2 || p + size > bytes.length) break;
    const data = p + 2, dataLength = size - 2;
    if (marker === 0xe1 && dataLength >= 14 &&
        bytes[data] === 0x45 && bytes[data+1] === 0x78 && bytes[data+2] === 0x69 &&
        bytes[data+3] === 0x66 && bytes[data+4] === 0 && bytes[data+5] === 0) {
      return parseTiff(bytes, data + 6, dataLength - 6);
    }
    p += size;
  }
  return null;
}
function findPngExif(bytes) {
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  let p = 8;
  while (p + 12 <= bytes.length) {
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(p);
    if (size > bytes.length - p - 12) break;
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    if (type === "eXIf") return parseTiff(bytes, p + 8, size);
    p += 12 + size;
    if (type === "IEND") break;
  }
  return null;
}
function findWebpExif(bytes) {
  if (bytes.length < 12 || String.fromCharCode(...bytes.subarray(0,4)) !== "RIFF" ||
      String.fromCharCode(...bytes.subarray(8,12)) !== "WEBP") return null;
  let p = 12;
  while (p + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.subarray(p, p + 4));
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(p + 4, true);
    if (size > bytes.length - p - 8) break;
    if (type === "EXIF") {
      let start = p + 8, length = size;
      if (length >= 6 && String.fromCharCode(...bytes.subarray(start, start + 4)) === "Exif") { start += 6; length -= 6; }
      return parseTiff(bytes, start, length);
    }
    p += 8 + size + (size & 1);
  }
  return null;
}
function readGpsFromBytes(bytes) {
  return findJpegExif(bytes) || findPngExif(bytes) || findWebpExif(bytes) || null;
}
async function readPhotoGps(file) {
  if (!file || typeof file.arrayBuffer !== "function") return null;
  try { return readGpsFromBytes(new Uint8Array(await file.arrayBuffer())); }
  catch { return null; }
}
globalThis.YugornoExifGps = Object.freeze({ readGpsFromBytes, readPhotoGps });
})();