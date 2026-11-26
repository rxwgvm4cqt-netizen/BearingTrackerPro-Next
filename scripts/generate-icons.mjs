import { writeFile, mkdir } from "node:fs/promises";
import { deflateSync } from "node:zlib";
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#091119"/><circle cx="256" cy="242" r="164" fill="none" stroke="#61788a" stroke-width="18"/><circle cx="256" cy="242" r="106" fill="none" stroke="#61788a" stroke-width="12"/><g stroke="#2ad4ff" stroke-width="24" stroke-linecap="round"><path d="M256 242V78M256 242L398 324M256 242L114 324"/></g><circle cx="256" cy="242" r="31" fill="#091119" stroke="#2ad4ff" stroke-width="10"/><circle cx="140" cy="177" r="20" fill="#ff3045"/><rect x="158" y="416" width="196" height="48" rx="15" fill="#2ad4ff"/><text x="256" y="450" font-family="system-ui,sans-serif" font-size="34" font-weight="800" text-anchor="middle" fill="#091119">NEXT</text></svg>';
await writeFile("public/favicon.svg", svg);
await mkdir("public/icons", { recursive: true });
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const key = Buffer.from(type),
    size = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([key, data])));
  return Buffer.concat([size, key, data, crc]);
}
const lineDistance = (x, y, ax, ay, bx, by) => {
  const d = (bx - ax) ** 2 + (by - ay) ** 2,
    t = Math.max(
      0,
      Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / d),
    );
  return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
};
const glyphs = {
  N: ["10001", "11001", "10101", "10011", "10001"],
  E: ["11111", "10000", "11110", "10000", "11111"],
  X: ["10001", "01010", "00100", "01010", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100"],
};
for (const size of [180, 192, 512]) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const xx = (x * 512) / size,
        yy = (y * 512) / size,
        r = Math.hypot(xx - 256, yy - 242);
      let color = [9, 17, 25];
      if (Math.abs(r - 164) < 9 || Math.abs(r - 106) < 6)
        color = [97, 120, 138];
      if (
        [
          [256, 78],
          [398, 324],
          [114, 324],
        ].some(([bx, by]) => lineDistance(xx, yy, 256, 242, bx, by) < 12)
      )
        color = [42, 212, 255];
      if (r < 36) color = [42, 212, 255];
      if (r < 26) color = [9, 17, 25];
      if (Math.hypot(xx - 140, yy - 177) < 20) color = [255, 48, 69];
      if (xx >= 158 && xx < 354 && yy >= 416 && yy < 464) {
        color = [42, 212, 255];
        const gx = Math.floor((xx - 176) / 8),
          gy = Math.floor((yy - 420) / 8),
          letter = Math.floor(gx / 6),
          col = gx % 6;
        if (
          letter >= 0 &&
          letter < 4 &&
          gy >= 0 &&
          gy < 5 &&
          col < 5 &&
          glyphs["NEXT"[letter]][gy][col] === "1"
        )
          color = [9, 17, 25];
      }
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = color[0];
      raw[i + 1] = color[1];
      raw[i + 2] = color[2];
      raw[i + 3] = 255;
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  await writeFile(
    `public/icons/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
console.log("Separate Next app icons generated");
