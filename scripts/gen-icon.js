// 纯 Node 生成 PWA 图标 PNG（无第三方依赖）
const fs = require('fs');
const zlib = require('zlib');

function png(size, file) {
  const W = size, H = size;
  const buf = Buffer.alloc(W * H * 4);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const cTop = hex('#b06bff'), cBot = hex('#ff6b9d'), cDark = hex('#241a32');
  const gemEdge = hex('#f0c674'), gemTop = hex('#ffffff'), gemBot = hex('#cdb6ff');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H;
      // 背景：左上→右下 紫粉渐变 + 四角暗角
      let t = (nx + ny) / 2;
      let r = lerp(cTop[0], cBot[0], t), g = lerp(cTop[1], cBot[1], t), b = lerp(cTop[2], cBot[2], t);
      const dx = nx - 0.5, dy = ny - 0.5;
      const vig = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 0.72);
      r = lerp(r, cDark[0], vig * 0.55); g = lerp(g, cDark[1], vig * 0.55); b = lerp(b, cDark[2], vig * 0.55);
      // 中央钻石（gem）
      const gx = Math.abs(nx - 0.5) / 0.27, gy = Math.abs(ny - 0.5) / 0.36;
      const dgem = gx + gy;
      if (dgem <= 1.0) {
        const tt = (ny - 0.16) / 0.68; // 上亮下暗
        let gr = lerp(gemTop[0], gemBot[0], Math.max(0, Math.min(1, tt)));
        let gg = lerp(gemTop[1], gemBot[1], Math.max(0, Math.min(1, tt)));
        let gb = lerp(gemTop[2], gemBot[2], Math.max(0, Math.min(1, tt)));
        if (dgem > 0.88) { gr = gemEdge[0]; gg = gemEdge[1]; gb = gemEdge[2]; } // 金边
        r = gr; g = gg; b = gb;
      }
      const i = (y * W + x) * 4;
      buf[i] = r | 0; buf[i + 1] = g | 0; buf[i + 2] = b | 0; buf[i + 3] = 255;
    }
  }
  // 组装 PNG
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0; // filter none
    buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const tb = Buffer.from(type, 'ascii');
    const cd = Buffer.concat([tb, data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(cd) >>> 0, 0);
    return Buffer.concat([len, cd, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const out = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(file, out);
  console.log('wrote', file, out.length, 'bytes');
}
png(512, 'icons/icon-512.png');
png(192, 'icons/icon-192.png');
png(180, 'icons/apple-touch-icon.png');
