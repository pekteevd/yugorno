import test from 'node:test';
import assert from 'node:assert/strict';
import './public/exif-gps.js';

function buildJpegGps(lat, lng) {
  const tiff = Buffer.alloc(128);
  tiff.write('II',0,'ascii'); tiff.writeUInt16LE(42,2); tiff.writeUInt32LE(8,4);
  tiff.writeUInt16LE(1,8); tiff.writeUInt16LE(0x8825,10); tiff.writeUInt16LE(4,12); tiff.writeUInt32LE(1,14); tiff.writeUInt32LE(26,18);
  tiff.writeUInt32LE(0,22);
  tiff.writeUInt16LE(4,26);
  const entries = [[1,2,2,0],[2,5,3,80],[3,2,2,0],[4,5,3,104]];
  entries.forEach((entry,i)=>{const p=28+i*12;tiff.writeUInt16LE(entry[0],p);tiff.writeUInt16LE(entry[1],p+2);tiff.writeUInt32LE(entry[2],p+4);tiff.writeUInt32LE(entry[3],p+8)});
  tiff.write('N\\0',36,'ascii'); tiff.write('E\\0',60,'ascii');
  function writeDms(offset,value){const d=Math.floor(value),mFloat=(value-d)*60,m=Math.floor(mFloat),seconds=Math.round((mFloat-m)*60000);[d,m,seconds].forEach((v,i)=>{tiff.writeUInt32LE(v,offset+i*8);tiff.writeUInt32LE(i===2?1000:1,offset+i*8+4)})}
  writeDms(80,Math.abs(lat));writeDms(104,Math.abs(lng));
  const exif=Buffer.concat([Buffer.from('Exif\\0\\0','binary'),tiff]);
  const segment=Buffer.alloc(4+exif.length);segment[0]=0xff;segment[1]=0xe1;segment.writeUInt16BE(exif.length+2,2);exif.copy(segment,4);
  return Buffer.concat([Buffer.from([0xff,0xd8]),segment,Buffer.from([0xff,0xd9])]);
}

test('reads GPS latitude and longitude from JPEG EXIF',()=>{
  const result=globalThis.YugornoExifGps.readGpsFromBytes(new Uint8Array(buildJpegGps(56.25,47.5)));
  assert.ok(result);
  assert.ok(Math.abs(result.lat-56.25)<0.00001);
  assert.ok(Math.abs(result.lng-47.5)<0.00001);
});
test('returns no coordinates for a photo without EXIF GPS',()=>{
  assert.equal(globalThis.YugornoExifGps.readGpsFromBytes(new Uint8Array([0xff,0xd8,0xff,0xd9])),null);
});
