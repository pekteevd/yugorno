import test from 'node:test';
import assert from 'node:assert/strict';
import './public/exif-gps.js';

function buildTiffGps(lat, lng) {
  const tiff = Buffer.alloc(128);
  tiff.write('II',0,'ascii'); tiff.writeUInt16LE(42,2); tiff.writeUInt32LE(8,4);
  tiff.writeUInt16LE(1,8); tiff.writeUInt16LE(0x8825,10); tiff.writeUInt16LE(4,12); tiff.writeUInt32LE(1,14); tiff.writeUInt32LE(26,18);
  tiff.writeUInt32LE(0,22); tiff.writeUInt16LE(4,26);
  const entries = [[1,2,2,0],[2,5,3,80],[3,2,2,0],[4,5,3,104]];
  entries.forEach((entry,i)=>{const p=28+i*12;tiff.writeUInt16LE(entry[0],p);tiff.writeUInt16LE(entry[1],p+2);tiff.writeUInt32LE(entry[2],p+4);tiff.writeUInt32LE(entry[3],p+8)});
  tiff[36]=lat<0?0x53:0x4e; tiff[37]=0; tiff[60]=lng<0?0x57:0x45; tiff[61]=0;
  function writeDms(offset,value){const d=Math.floor(value),mFloat=(value-d)*60,m=Math.floor(mFloat),seconds=Math.round((mFloat-m)*60000);[d,m,seconds].forEach((v,i)=>{tiff.writeUInt32LE(v,offset+i*8);tiff.writeUInt32LE(i===2?1000:1,offset+i*8+4)})}
  writeDms(80,Math.abs(lat)); writeDms(104,Math.abs(lng));
  return tiff;
}
function buildJpegGps(lat,lng) {
  const exif=Buffer.concat([Buffer.from([0x45,0x78,0x69,0x66,0,0]),buildTiffGps(lat,lng)]);
  const segment=Buffer.alloc(4+exif.length);segment[0]=0xff;segment[1]=0xe1;segment.writeUInt16BE(exif.length+2,2);exif.copy(segment,4);
  return Buffer.concat([Buffer.from([0xff,0xd8]),segment,Buffer.from([0xff,0xd9])]);
}
function pngChunk(type,data) {
  const chunk=Buffer.alloc(12+data.length);chunk.writeUInt32BE(data.length,0);chunk.write(type,4,'ascii');data.copy(chunk,8);return chunk;
}
function buildPngGps(lat,lng) {
  const signature=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=2;
  return Buffer.concat([signature,pngChunk('IHDR',ihdr),pngChunk('eXIf',buildTiffGps(lat,lng)),pngChunk('IEND',Buffer.alloc(0))]);
}
function buildWebpGps(lat,lng) {
  const tiff=buildTiffGps(lat,lng),chunk=Buffer.alloc(8+tiff.length+(tiff.length&1));
  chunk.write('EXIF',0,'ascii');chunk.writeUInt32LE(tiff.length,4);tiff.copy(chunk,8);
  const header=Buffer.alloc(12);header.write('RIFF',0,'ascii');header.writeUInt32LE(4+chunk.length,4);header.write('WEBP',8,'ascii');
  return Buffer.concat([header,chunk]);
}

test('reads GPS latitude and longitude from JPEG EXIF',()=>{
  const result=globalThis.YugornoExifGps.readGpsFromBytes(new Uint8Array(buildJpegGps(56.25,47.5)));
  assert.ok(result); assert.ok(Math.abs(result.lat-56.25)<0.00001); assert.ok(Math.abs(result.lng-47.5)<0.00001);
});
test('applies south and west hemisphere references as negative coordinates',()=>{
  const result=globalThis.YugornoExifGps.readGpsFromBytes(new Uint8Array(buildJpegGps(-12.5,-77.25)));
  assert.ok(result); assert.ok(Math.abs(result.lat+12.5)<0.00001); assert.ok(Math.abs(result.lng+77.25)<0.00001);
});
test('reads GPS from PNG eXIf chunks',()=>{
  const result=globalThis.YugornoExifGps.readGpsFromBytes(new Uint8Array(buildPngGps(56.25,47.5)));
  assert.ok(result); assert.ok(Math.abs(result.lat-56.25)<0.00001); assert.ok(Math.abs(result.lng-47.5)<0.00001);
});
test('reads GPS from WebP EXIF chunks',()=>{
  const result=globalThis.YugornoExifGps.readGpsFromBytes(new Uint8Array(buildWebpGps(56.25,47.5)));
  assert.ok(result); assert.ok(Math.abs(result.lat-56.25)<0.00001); assert.ok(Math.abs(result.lng-47.5)<0.00001);
});
test('returns no coordinates for a photo without EXIF GPS',()=>{
  assert.equal(globalThis.YugornoExifGps.readGpsFromBytes(new Uint8Array([0xff,0xd8,0xff,0xd9])),null);
});
test('reads photo bytes through the browser File-like interface',async()=>{
  const bytes=new Uint8Array(buildJpegGps(56.25,47.5));
  const file={arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
  const result=await globalThis.YugornoExifGps.readPhotoGps(file);
  assert.ok(result); assert.ok(Math.abs(result.lat-56.25)<0.00001);
});
