const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const toCrc = buf.slice(4, 8 + len);
  buf.writeUInt32BE(crc32(toCrc), 8 + len);
  return buf;
}

function createPng(size) {
  // Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw pixel data: for each scanline, 1 filter byte (0) + 4 bytes per pixel (RGBA)
  const rowBytes = 1 + size * 4;
  const rawData = Buffer.alloc(rowBytes * size);

  // Dusk gradient colors:
  // Sakura: rgba(255, 117, 151, 255)
  // Peach: rgba(255, 170, 90, 255)
  // Indigo border: rgba(30, 26, 46, 255)
  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const t = (x + y) / (2 * size);

      // Check if on border (1-2 px border)
      const borderSize = Math.max(1, Math.round(size * 0.08));
      const isBorder = (x < borderSize || x >= size - borderSize || y < borderSize || y >= size - borderSize);

      if (isBorder) {
        rawData[pxOffset] = 0x21;     // R (33)
        rawData[pxOffset + 1] = 0x1c; // G (28)
        rawData[pxOffset + 2] = 0x38; // B (56)
        rawData[pxOffset + 3] = 0xff; // A
      } else {
        // Linear gradient between sakura (255, 117, 151) and peach (255, 170, 90)
        const r = 255;
        const g = Math.round(117 + (170 - 117) * t);
        const b = Math.round(151 + (90 - 151) * t);
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = 0xff;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const iconSizes = [16, 32, 48, 128];
const iconsDir = path.resolve(__dirname, '../safari-extension/icons');

iconSizes.forEach((s) => {
  const pngBuf = createPng(s);
  const outPath = path.join(iconsDir, `icon-${s}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated ${outPath} (${pngBuf.length} bytes)`);
});

