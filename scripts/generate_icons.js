/**
 * Pure Node.js PNG Generator for KeyFlip icons (no npm dependencies needed)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createIconPNG(size) {
  const width = size;
  const height = size;

  // RGBA buffer: 4 bytes per pixel + 1 filter byte per scanline
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  // Colors
  // Emerald primary: #10b981 (16, 185, 129)
  // Emerald dark: #059669 (5, 150, 105)
  // White: #ffffff (255, 255, 255)
  // Emerald soft border

  const radius = Math.floor(size * 0.22); // Rounded corner radius

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Check rounded rect boundaries
      let inside = true;
      const cornerDx = Math.min(x, width - 1 - x);
      const cornerDy = Math.min(y, height - 1 - y);

      if (cornerDx < radius && cornerDy < radius) {
        const dist = Math.hypot(radius - cornerDx, radius - cornerDy);
        if (dist > radius) {
          inside = false;
        }
      }

      if (!inside) {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
        continue;
      }

      // Emerald background gradient
      const gradRatio = y / height;
      const bgR = Math.round(16 * (1 - gradRatio) + 5 * gradRatio);
      const bgG = Math.round(185 * (1 - gradRatio) + 150 * gradRatio);
      const bgB = Math.round(129 * (1 - gradRatio) + 105 * gradRatio);

      // Draw Keyboard Key / Switch Icon
      // Draw inner keyboard key square
      const margin = Math.max(2, Math.floor(size * 0.16));
      const keyW = width - margin * 2;
      const keyH = height - margin * 2;

      let isKeyCap = false;
      let isSymbol = false;

      if (x >= margin && x < width - margin && y >= margin && y < height - margin) {
        isKeyCap = true;
      }

      // Draw two bidirectional arrows / characters inside
      const cx = width / 2;
      const cy = height / 2;
      const scale = size / 32;

      // Draw "K" or arrows symbol in center
      // Top-left arrow pointing right ->
      // Bottom-right arrow pointing left <-
      const inTopArrow = (
        (y >= cy - 6 * scale && y <= cy - 3 * scale && x >= cx - 8 * scale && x <= cx + 4 * scale) ||
        (y >= cy - 8 * scale && y <= cy - 1 * scale && x >= cx + 2 * scale && x <= cx + 8 * scale && Math.abs(y - (cy - 4.5 * scale)) <= (cx + 8 * scale - x))
      );

      const inBottomArrow = (
        (y >= cy + 3 * scale && y <= cy + 6 * scale && x >= cx - 4 * scale && x <= cx + 8 * scale) ||
        (y >= cy + 1 * scale && y <= cy + 8 * scale && x >= cx - 8 * scale && x <= cx - 2 * scale && Math.abs(y - (cy + 4.5 * scale)) <= (x - (cx - 8 * scale)))
      );

      if (inTopArrow || inBottomArrow) {
        isSymbol = true;
      }

      if (isSymbol) {
        // Crisp White symbol
        rawData[pxOffset] = 255;
        rawData[pxOffset + 1] = 255;
        rawData[pxOffset + 2] = 255;
        rawData[pxOffset + 3] = 255;
      } else if (isKeyCap && (x === margin || x === width - margin - 1 || y === margin || y === height - margin - 1)) {
        // Inner keycap highlight border
        rawData[pxOffset] = 52;
        rawData[pxOffset + 1] = 211;
        rawData[pxOffset + 2] = 153; // #34d399
        rawData[pxOffset + 3] = 255;
      } else {
        rawData[pxOffset] = bgR;
        rawData[pxOffset + 1] = bgG;
        rawData[pxOffset + 2] = bgB;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  // Compress raw data with DEFLATE
  const compressedData = zlib.deflateSync(rawData);

  // PNG File Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression: 0
  ihdrData[11] = 0; // Filter: 0
  ihdrData[12] = 0; // Interlace: 0
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  // CRC32 of type + data
  const crcTarget = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(crcTarget);
  chunk.writeInt32BE(crc, 8 + length);

  return chunk;
}

// CRC32 implementation
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    for (let j = 0; j < 8; j++) {
      const bit = (crc ^ byte) & 1;
      crc = (crc >>> 1) ^ (bit ? 0xEDB88320 : 0);
      byte >>>= 1;
    }
  }
  return (crc ^ -1) | 0;
}

// Ensure assets directories exist
const chromeAssetsDir = path.join(__dirname, '..', 'extensions', 'chrome', 'assets');
const firefoxAssetsDir = path.join(__dirname, '..', 'extensions', 'firefox', 'assets');
[chromeAssetsDir, firefoxAssetsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

[16, 48, 128].forEach(size => {
  const iconBuffer = createIconPNG(size);
  [chromeAssetsDir, firefoxAssetsDir].forEach(dir => {
    const iconPath = path.join(dir, `icon${size}.png`);
    fs.writeFileSync(iconPath, iconBuffer);
    console.log(`Generated icon: ${iconPath} (${size}x${size})`);
  });
});
