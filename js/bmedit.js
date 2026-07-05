// ============================================================
//  BmEdit v2 —— 标定工坊（用户手绘碰撞层/遮挡层的专用画图工具）
//  打开: 游戏网址加 ?bmedit   （PC + 鼠标推荐）
//  🖌 碰撞层: 红笔=不可走(默认全图可走) / 绿笔=修正回可走 / 橡皮
//  🧱 遮挡层: 每个"件"用笔刷描出轮廓(房子/井/树冠) + 拖青色脚线;
//             人物站在脚线上方时会被该件盖住 —— 假人模式可实时验证
//  通用: 滚轮缩放 / 空格或🖐拖图 / Ctrl+Z 撤销 / 导入导出 PNG
//  导出: 碰撞 town_day_mask.png(红绿) · 遮挡 town_day_occ.png(颜色=脚线y编码)
//  交付: 两张 PNG 传 GitHub inbox/ 告诉 AI 接线
// ============================================================
(function () {
  if (!/bmedit/.test(location.search)) return;
  window.addEventListener('load', () => setTimeout(boot, 900));

  function boot() {
    const bm = (window.BIGMAPS || {}).town_day;
    if (!bm) { alert('BmEdit: BIGMAPS 未加载'); return; }
    const W0 = bm.w, H0 = bm.h;

    const st = {
      tool: 'pan', ink: 'red', brush: 26,
      cam: { x: W0 / 2, y: H0 / 2, z: Math.max(0.2, Math.min(innerWidth / W0, innerHeight / H0)) },
      drag: null, space: false, cursor: null,
      pieces: [],            // 遮挡件: {cv, ctx, baseY, name}
      cur: -1,
      undo: [],
      showMask: true, showOcc: true, dummy: null,
    };

    const maskCv = document.createElement('canvas');
    maskCv.width = W0; maskCv.height = H0;
    const maskCtx = maskCv.getContext('2d', { willReadFrequently: true });

    const newPiece = (name) => {
      const cv2 = document.createElement('canvas');
      cv2.width = W0; cv2.height = H0;
      st.pieces.push({ cv: cv2, ctx: cv2.getContext('2d', { willReadFrequently: true }), baseY: Math.round(st.cam.y) + 60, name: name || ('件' + (st.pieces.length + 1)) });
      st.cur = st.pieces.length - 1;
    };

    // ---------- DOM ----------
    const root = document.createElement('div');
    root.id = 'bmedit';
    root.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#0a0a0e;font:13px/1.5 sans-serif;color:#cfc8e0;';
    root.innerHTML = `
      <canvas id="bme-cv" style="position:absolute;inset:0;touch-action:none;cursor:crosshair;"></canvas>
      <div id="bme-bar" style="position:absolute;top:8px;left:8px;right:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:rgba(16,14,22,.92);border:1px solid #3a3350;border-radius:10px;padding:8px 10px;">
        <b style="color:#e8c66a;">🛠 标定工坊 v2</b>
        <button data-t="pan">🖐 拖图</button>
        <button data-t="mask">🖌 碰撞层</button>
        <button data-t="occ">🧱 遮挡层</button>
        <button data-t="dummy">🚶 假人验证</button>
        <span id="bme-sub" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;"></span>
        <span style="flex:1;"></span>
        <button id="bme-undo" title="Ctrl+Z">↩ 撤销</button>
        <label style="cursor:pointer;">👁碰撞<input id="bme-vm" type="checkbox" checked style="vertical-align:middle;"></label>
        <label style="cursor:pointer;">👁遮挡<input id="bme-vo" type="checkbox" checked style="vertical-align:middle;"></label>
        <button id="bme-quit">退出</button>
        <div id="bme-tip" style="width:100%;color:#8f87a8;font-size:12px;"></div>
      </div>
      <div id="bme-pieces" style="position:absolute;right:8px;top:110px;width:200px;max-height:60%;overflow:auto;background:rgba(16,14,22,.92);border:1px solid #3a3350;border-radius:10px;padding:8px;display:none;"></div>
      <div id="bme-pos" style="position:absolute;bottom:8px;left:10px;color:#9a92b5;font:12px monospace;background:rgba(0,0,0,.5);padding:2px 8px;border-radius:6px;"></div>
      <input id="bme-file" type="file" accept="image/png" style="display:none;">`;
    document.body.appendChild(root);
    root.querySelectorAll('button').forEach(b => b.style.cssText += 'background:#262038;border:1px solid #4a4266;color:#d8d2ea;border-radius:7px;padding:4px 10px;cursor:pointer;');
    const cv = root.querySelector('#bme-cv'), ctx = cv.getContext('2d');
    const tip = root.querySelector('#bme-tip'), sub = root.querySelector('#bme-sub');
    const posEl = root.querySelector('#bme-pos'), piecesEl = root.querySelector('#bme-pieces');
    const fileEl = root.querySelector('#bme-file');
    root.querySelector('#bme-vm').onchange = e => st.showMask = e.target.checked;
    root.querySelector('#bme-vo').onchange = e => st.showOcc = e.target.checked;
    root.querySelector('#bme-quit').onclick = () => { if (confirm('退出前记得导出！确定退出？')) location.href = location.pathname; };
    root.querySelector('#bme-undo').onclick = doUndo;

    const TIPS = {
      pan: '拖动平移，滚轮缩放（任何工具下按住空格也能拖图）。',
      mask: '红笔描"不可走"（墙脚/水面/树干脚下——只描地面上挡人的范围，不用涂屋顶）。绿笔改回可走。完成点【💾导出碰撞】。',
      occ: '每个会挡人的物件建一个"件"：【＋新建件】→ 笔刷把它整个身子涂满(含屋顶) → 拖它的青色脚线到落地线。人在脚线上方经过就被盖住。随时【🚶假人验证】。',
      dummy: '按住拖动假人走走看——它会被脚线在它下方的件盖住。',
    };

    const toMap = (sx2, sy2) => [(sx2 - cv.width / 2) / st.cam.z + st.cam.x, (sy2 - cv.height / 2) / st.cam.z + st.cam.y];

    // ---------- 撤销 ----------
    function snap(kind) {
      const c = kind === 'mask' ? maskCtx : st.pieces[st.cur].ctx;
      st.undo.push({ kind, idx: st.cur, data: c.getImageData(0, 0, W0, H0) });
      if (st.undo.length > 18) st.undo.shift();
    }
    function doUndo() {
      const u = st.undo.pop(); if (!u) { tip.textContent = '没有可撤销的了'; return; }
      const c = u.kind === 'mask' ? maskCtx : (st.pieces[u.idx] && st.pieces[u.idx].ctx);
      if (c) c.putImageData(u.data, 0, 0);
    }
    window.addEventListener('keydown', e => {
      if (e.code === 'Space') { st.space = true; e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { doUndo(); e.preventDefault(); }
    });
    window.addEventListener('keyup', e => { if (e.code === 'Space') st.space = false; });

    // ---------- 工具栏 ----------
    function setTool(t) {
      st.tool = t; tip.textContent = TIPS[t];
      root.querySelectorAll('[data-t]').forEach(b => b.style.outline = b.dataset.t === t ? '2px solid #e8c66a' : 'none');
      piecesEl.style.display = t === 'occ' ? 'block' : 'none';
      sub.innerHTML = '';
      if (t === 'mask') {
        sub.innerHTML = `<button data-i="red">🔴不可走</button><button data-i="green">🟢可走</button>
          笔刷<input id="bme-brush" type="range" min="4" max="120" value="${st.brush}" style="width:110px;vertical-align:middle;"><span id="bme-bs">${st.brush}</span>
          <button id="bme-imp-m">📂导入碰撞</button><button id="bme-exp-m">💾导出碰撞</button>`;
        st.ink = 'red';
      } else if (t === 'occ') {
        sub.innerHTML = `<button data-i="paint">🖌涂件</button><button data-i="erase">🧹橡皮</button>
          笔刷<input id="bme-brush" type="range" min="4" max="120" value="${st.brush}" style="width:110px;vertical-align:middle;"><span id="bme-bs">${st.brush}</span>
          <button id="bme-newp">＋新建件</button>
          <button id="bme-imp-o">📂导入遮挡</button><button id="bme-exp-o">💾导出遮挡</button>`;
        st.ink = 'paint';
        renderPieces();
      }
      sub.querySelectorAll('button').forEach(b => b.style.cssText += 'background:#262038;border:1px solid #4a4266;color:#d8d2ea;border-radius:7px;padding:4px 8px;cursor:pointer;');
      sub.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { st.ink = b.dataset.i; sub.querySelectorAll('[data-i]').forEach(x => x.style.outline = x === b ? '2px solid #e8c66a' : 'none'); });
      const first = sub.querySelector('[data-i]'); if (first) first.style.outline = '2px solid #e8c66a';
      const br = sub.querySelector('#bme-brush');
      if (br) br.oninput = e => { st.brush = +e.target.value; sub.querySelector('#bme-bs').textContent = st.brush; };
      const np = sub.querySelector('#bme-newp');
      if (np) np.onclick = () => { newPiece(); renderPieces(); tip.textContent = '新件已建：笔刷涂满它的身子，然后把青色脚线拖到它落地的那条线。'; };
      const em = sub.querySelector('#bme-exp-m'); if (em) em.onclick = exportMask;
      const eo = sub.querySelector('#bme-exp-o'); if (eo) eo.onclick = exportOcc;
      const im2 = sub.querySelector('#bme-imp-m'); if (im2) im2.onclick = () => importPng('mask');
      const io = sub.querySelector('#bme-imp-o'); if (io) io.onclick = () => importPng('occ');
    }
    root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => setTool(b.dataset.t));

    function renderPieces() {
      piecesEl.innerHTML = '<b style="color:#e8c66a;">遮挡件列表</b>' + (st.pieces.map((p, i) =>
        `<div data-p="${i}" style="margin:4px 0;padding:4px 6px;border-radius:6px;cursor:pointer;display:flex;gap:4px;align-items:center;background:${i === st.cur ? '#3a3350' : '#1c1828'};">
          <span style="flex:1;">${p.name}</span><span style="color:#7ee;">y${p.baseY}</span>
          <button data-del="${i}" style="background:#4a2020;border:none;color:#ecc;border-radius:5px;cursor:pointer;padding:1px 6px;">✕</button>
        </div>`).join('') || '<div style="color:#666;margin-top:4px;">还没有件，点"＋新建件"</div>');
      piecesEl.querySelectorAll('[data-p]').forEach(el => el.onclick = (e) => {
        if (e.target.dataset.del !== undefined) return;
        st.cur = +el.dataset.p; renderPieces();
      });
      piecesEl.querySelectorAll('[data-del]').forEach(el => el.onclick = () => {
        st.pieces.splice(+el.dataset.del, 1);
        st.cur = Math.min(st.cur, st.pieces.length - 1);
        renderPieces();
      });
    }

    // ---------- 导入导出 ----------
    function dl(canvas, name) {
      canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); });
    }
    function exportMask() {
      dl(maskCv, 'town_day_mask.png');
      tip.textContent = '已下载 town_day_mask.png → 传到 GitHub inbox/ 告诉 AI。';
    }
    function exportOcc() {
      const out = document.createElement('canvas');
      out.width = W0; out.height = H0;
      const o = out.getContext('2d');
      const od = o.getImageData(0, 0, W0, H0);
      for (const p of st.pieces) {
        const pd = p.ctx.getImageData(0, 0, W0, H0);
        const r = (p.baseY >> 8) & 255, g2 = p.baseY & 255;
        for (let i = 0; i < pd.data.length; i += 4) {
          if (pd.data[i + 3] < 100) continue;
          od.data[i] = r; od.data[i + 1] = g2; od.data[i + 2] = 60; od.data[i + 3] = 255;
        }
      }
      o.putImageData(od, 0, 0);
      dl(out, 'town_day_occ.png');
      tip.textContent = '已下载 town_day_occ.png（' + st.pieces.length + ' 件）→ 传 inbox/ 告诉 AI。';
    }
    let importKind = 'mask';
    function importPng(kind) { importKind = kind; fileEl.click(); }
    fileEl.onchange = () => {
      const f = fileEl.files[0]; if (!f) return;
      const img2 = new Image();
      img2.onload = () => {
        if (importKind === 'mask') {
          maskCtx.clearRect(0, 0, W0, H0);
          maskCtx.drawImage(img2, 0, 0, W0, H0);
          tip.textContent = '碰撞层已导入，继续画。';
        } else {
          const t = document.createElement('canvas'); t.width = W0; t.height = H0;
          const tc = t.getContext('2d'); tc.drawImage(img2, 0, 0, W0, H0);
          const d = tc.getImageData(0, 0, W0, H0).data;
          const found = {};
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 128) continue;
            const y = (d[i] << 8) | d[i + 1];
            if (!found[y]) { newPiece('导入y' + y); st.pieces[st.cur].baseY = y; found[y] = st.pieces[st.cur]; }
          }
          for (const y in found) {
            const p = found[y], pd = p.ctx.getImageData(0, 0, W0, H0);
            for (let i = 0; i < d.length; i += 4) {
              if (d[i + 3] >= 128 && (((d[i] << 8) | d[i + 1]) === +y)) {
                pd.data[i] = 255; pd.data[i + 1] = 200; pd.data[i + 2] = 60; pd.data[i + 3] = 200;
              }
            }
            p.ctx.putImageData(pd, 0, 0);
          }
          renderPieces();
          tip.textContent = '遮挡层已导入 ' + Object.keys(found).length + ' 件（同脚线的件合并显示）。';
        }
        fileEl.value = '';
      };
      img2.src = URL.createObjectURL(f);
    };

    // ---------- 绘画 ----------
    function paintStroke(c, x0, y0, x1, y1, erase, color) {
      c.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
      c.strokeStyle = color; c.lineWidth = st.brush; c.lineCap = c.lineJoin = 'round';
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.globalCompositeOperation = 'source-over';
    }

    // ---------- 交互 ----------
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const [mx, my] = toMap(e.offsetX, e.offsetY);
      const z2 = Math.min(6, Math.max(0.12, st.cam.z * (e.deltaY < 0 ? 1.15 : 0.87)));
      st.cam.x = mx - (e.offsetX - cv.width / 2) / z2;
      st.cam.y = my - (e.offsetY - cv.height / 2) / z2;
      st.cam.z = z2;
    }, { passive: false });

    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      const [mx, my] = toMap(e.offsetX, e.offsetY);
      if (st.tool === 'pan' || st.space || e.button === 1) { st.drag = { t: 'pan', sx: e.offsetX, sy: e.offsetY, cx: st.cam.x, cy: st.cam.y }; return; }
      if (st.tool === 'mask') {
        snap('mask');
        st.drag = { t: 'mask', lx: mx, ly: my };
        paintStroke(maskCtx, mx, my, mx, my, false, st.ink === 'green' ? 'rgba(0,220,60,1)' : 'rgba(230,30,30,1)');
        return;
      }
      if (st.tool === 'occ') {
        if (st.cur < 0) { tip.textContent = '先点"＋新建件"'; return; }
        const p = st.pieces[st.cur];
        if (Math.abs(my - p.baseY) < 12 / st.cam.z && st.ink !== 'erase') { st.drag = { t: 'base' }; return; }
        snap('piece');
        st.drag = { t: 'piece', lx: mx, ly: my };
        paintStroke(p.ctx, mx, my, mx, my, st.ink === 'erase', 'rgba(255,200,60,.78)');
        return;
      }
      if (st.tool === 'dummy') { st.dummy = [mx, my]; st.drag = { t: 'dummy' }; }
    });

    cv.addEventListener('pointermove', e => {
      const [mx, my] = toMap(e.offsetX, e.offsetY);
      st.cursor = [mx, my];
      posEl.textContent = `(${Math.round(mx)}, ${Math.round(my)})  缩放${st.cam.z.toFixed(2)}x` +
        (st.tool === 'occ' && st.cur >= 0 ? `  当前件:${st.pieces[st.cur].name} 脚线y${st.pieces[st.cur].baseY}` : '');
      if (!st.drag) return;
      if (st.drag.t === 'pan') {
        st.cam.x = st.drag.cx - (e.offsetX - st.drag.sx) / st.cam.z;
        st.cam.y = st.drag.cy - (e.offsetY - st.drag.sy) / st.cam.z;
      } else if (st.drag.t === 'mask') {
        paintStroke(maskCtx, st.drag.lx, st.drag.ly, mx, my, false, st.ink === 'green' ? 'rgba(0,220,60,1)' : 'rgba(230,30,30,1)');
        st.drag.lx = mx; st.drag.ly = my;
      } else if (st.drag.t === 'piece') {
        const p = st.pieces[st.cur];
        paintStroke(p.ctx, st.drag.lx, st.drag.ly, mx, my, st.ink === 'erase', 'rgba(255,200,60,.78)');
        st.drag.lx = mx; st.drag.ly = my;
      } else if (st.drag.t === 'base') {
        st.pieces[st.cur].baseY = Math.round(my); renderPieces();
      } else if (st.drag.t === 'dummy') {
        st.dummy = [mx, my];
      }
    });
    const endDrag = () => st.drag = null;
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);

    // ---------- 底图 ----------
    const img = new Image();
    img.src = bm.img + '?v=' + (window.ASSET_VER || '');

    // ---------- 渲染 ----------
    function draw() {
      if (!document.getElementById('bmedit')) return;
      if (cv.width !== root.clientWidth) { cv.width = root.clientWidth; cv.height = root.clientHeight; }
      const z = st.cam.z;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0a0a0e'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.setTransform(z, 0, 0, z, cv.width / 2 - st.cam.x * z, cv.height / 2 - st.cam.y * z);
      ctx.imageSmoothingEnabled = z < 1;
      if (img.complete && img.width) ctx.drawImage(img, 0, 0, W0, H0);
      if (st.showMask) { ctx.globalAlpha = 0.55; ctx.drawImage(maskCv, 0, 0); ctx.globalAlpha = 1; }
      if (st.showOcc) {
        const dy = st.dummy ? st.dummy[1] : 9e9;
        const before = [], after = [];
        st.pieces.forEach((p, i) => (p.baseY <= dy ? before : after).push([p, i]));
        const drawPiece = ([p, i]) => {
          ctx.globalAlpha = (st.tool === 'occ' && i === st.cur) ? 0.85 : 0.5;
          ctx.drawImage(p.cv, 0, 0);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = i === st.cur ? '#7ff' : 'rgba(80,200,230,.45)';
          ctx.lineWidth = (i === st.cur ? 2.4 : 1.1) / z;
          ctx.beginPath(); ctx.moveTo(0, p.baseY); ctx.lineTo(W0, p.baseY); ctx.stroke();
        };
        before.forEach(drawPiece);
        if (st.dummy) {
          const [dx2, dy2] = st.dummy;
          ctx.fillStyle = 'rgba(0,0,0,.35)';
          ctx.beginPath(); ctx.ellipse(dx2, dy2, 16, 6, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#f5a878'; ctx.strokeStyle = '#40200a'; ctx.lineWidth = 2 / z;
          ctx.fillRect(dx2 - 12, dy2 - 60, 24, 46); ctx.strokeRect(dx2 - 12, dy2 - 60, 24, 46);
          ctx.beginPath(); ctx.arc(dx2, dy2 - 72, 13, 0, 7); ctx.fill(); ctx.stroke();
        }
        after.forEach(drawPiece);
      }
      if ((st.tool === 'mask' || st.tool === 'occ') && st.cursor) {
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.4 / z;
        ctx.beginPath(); ctx.arc(st.cursor[0], st.cursor[1], st.brush / 2, 0, 7); ctx.stroke();
      }
      requestAnimationFrame(draw);
    }
    setTool('pan');
    tip.textContent = '流程：①🖌碰撞层红笔描不可走→💾导出 ②🧱遮挡层逐件涂身子+拖脚线→💾导出 ③两张PNG传inbox/找AI接线。中途可📂导入接着画，Ctrl+Z撤销。';
    requestAnimationFrame(draw);
  }
})();
