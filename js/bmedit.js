// ============================================================
//  BmEdit —— 大图标定工坊（用户可视化标定工具，游戏本体不受影响）
//  打开方式：游戏网址后加 ?bmedit  （如 https://…/Brown-dust-2/?bmedit）
//  能干什么（全鼠标操作，PC 推荐）：
//    🔦 灯：点空处加灯，拖动挪位，滚轮悬停/滑杆改半径，实时闪烁预览
//    💨 烟：点空处加烟囱烟出烟口，拖动挪位，实时烟柱预览
//    🖌 碰撞笔：红=不可走 / 绿=强制可走，直接在图上描；橡皮擦除
//    🧱 遮挡件：拖动黄框挪位，拖右下角改大小，拖青线改脚线(baseY)
//    导出：JSON(灯/烟/遮挡) 复制发给 AI；掩码 PNG 下载后传 inbox/
//  坐标系 = 原图像素 1792×1024，与 js/bigmap.js 完全一致。
// ============================================================
(function () {
  if (!/bmedit/.test(location.search)) return;
  window.addEventListener('load', () => setTimeout(boot, 900));

  function boot() {
    const bm = (window.BIGMAPS || {}).town_day;
    if (!bm) { alert('BmEdit: BIGMAPS 未加载'); return; }
    const W0 = bm.w, H0 = bm.h;

    // ---------- 数据（从 bigmap.js 拷贝，编辑不回写游戏运行时） ----------
    const st = {
      glows: (bm.glows || []).map(g => g.slice()),
      smokes: (bm.parts || []).filter(p => p.type === 'smoke').map(p => (p.px ? p.px.slice() : [p.x * 32, p.y * 32])),
      occ: (bm.occ || []).map(o => o.slice()),
      tool: 'pan', ink: 'red', brush: 30,
      sel: null,                    // {k:'glow'|'smoke'|'occ', i}
      cam: { x: W0 / 2, y: H0 / 2, z: Math.max(0.3, Math.min(innerWidth / W0, innerHeight / H0)) },
      showBase: true, drag: null, newOcc: false,
    };

    // ---------- DOM ----------
    const root = document.createElement('div');
    root.id = 'bmedit';
    root.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#0a0a0e;';
    root.innerHTML = `
      <canvas id="bme-cv" style="position:absolute;inset:0;touch-action:none;"></canvas>
      <div id="bme-bar" style="position:absolute;top:8px;left:8px;right:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;
           background:rgba(16,14,22,.88);border:1px solid #3a3350;border-radius:10px;padding:8px 10px;font:13px/1.4 sans-serif;color:#cfc8e0;">
        <b style="color:#e8c66a;">🛠 标定工坊</b>
        <button data-t="pan">🖐 拖图</button>
        <button data-t="glow">🔦 灯</button>
        <button data-t="smoke">💨 烟</button>
        <button data-t="mask">🖌 碰撞笔</button>
        <button data-t="occ">🧱 遮挡件</button>
        <span id="bme-sub"></span>
        <span style="flex:1;"></span>
        <button id="bme-base">底色开/关</button>
        <button id="bme-json" style="background:#2c4a2c;">📋 导出JSON</button>
        <button id="bme-png" style="background:#4a2c2c;">🖼 导出掩码PNG</button>
        <button id="bme-quit">退出</button>
        <div id="bme-tip" style="width:100%;color:#8f87a8;font-size:12px;"></div>
      </div>
      <div id="bme-pos" style="position:absolute;bottom:8px;left:10px;color:#9a92b5;font:12px monospace;background:rgba(0,0,0,.5);padding:2px 8px;border-radius:6px;"></div>`;
    document.body.appendChild(root);
    root.querySelectorAll('button').forEach(b => b.style.cssText += 'background:#262038;border:1px solid #4a4266;color:#d8d2ea;border-radius:7px;padding:4px 10px;cursor:pointer;' + (b.style.background ? 'background:' + b.style.background + ';' : ''));
    const cv = root.querySelector('#bme-cv'), ctx = cv.getContext('2d');
    const tip = root.querySelector('#bme-tip'), sub = root.querySelector('#bme-sub'), posEl = root.querySelector('#bme-pos');

    const TIPS = {
      pan: '拖动平移，滚轮缩放。',
      glow: '点空处=加灯；拖动=挪位；选中后在滑杆改半径；⌫删除。放大看闪烁预览。',
      smoke: '点空处=加烟（点在烟囱口上）；拖动=挪位；⌫删除。',
      mask: '按住描画：红=不可走，绿=强制可走（覆盖我的自动碰撞），橡皮=擦掉你画的。画完点"导出掩码PNG"，把文件传到 inbox/。',
      occ: '黄框=遮挡件（人走到框内脚线以上会被盖住）。拖框身=挪位，拖右下角=改大小，拖青线=改脚线。"新建"后在图上拉框。',
    };

    // ---------- 手绘掩码画布（透明底，红/绿笔迹） ----------
    const maskCv = document.createElement('canvas');
    maskCv.width = W0; maskCv.height = H0;
    const maskCtx = maskCv.getContext('2d');

    // ---------- 几何底掩码（展示我当前的可走区，绿色半透明） ----------
    const base = document.createElement('canvas');
    base.width = W0 / 2; base.height = H0 / 2;
    (function bakeBase() {
      const c = base.getContext('2d'), s = 0.5;
      const poly = p => { c.beginPath(); p.forEach(([x, y], i) => i ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s)); c.closePath(); c.fill(); };
      c.fillStyle = c.strokeStyle = 'rgba(70,255,120,.30)'; c.lineCap = c.lineJoin = 'round';
      for (const k of (bm.walk || {}).strokes || []) { c.lineWidth = k.w * s; c.beginPath(); k.pts.forEach(([x, y], i) => i ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s)); c.stroke(); }
      ((bm.walk || {}).polys || []).forEach(poly);
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = '#000';
      for (const [x, y, r] of (bm.block || {}).circles || []) { c.beginPath(); c.arc(x * s, y * s, r * s, 0, 7); c.fill(); }
      for (const [x, y, w, h] of (bm.block || {}).rects || []) c.fillRect(x * s, y * s, w * s, h * s);
      ((bm.block || {}).polys || []).forEach(poly);
    })();

    const img = new Image();
    img.src = bm.img + '?v=' + (window.ASSET_VER || '');

    // ---------- 坐标换算 ----------
    const toMap = (sx, sy) => [(sx - cv.width / 2) / st.cam.z + st.cam.x, (sy - cv.height / 2) / st.cam.z + st.cam.y];
    const toScr = (mx, my) => [(mx - st.cam.x) * st.cam.z + cv.width / 2, (my - st.cam.y) * st.cam.z + cv.height / 2];

    // ---------- 工具栏 ----------
    const setTool = t => {
      st.tool = t; st.sel = null; st.newOcc = false;
      tip.textContent = TIPS[t];
      root.querySelectorAll('[data-t]').forEach(b => b.style.outline = b.dataset.t === t ? '2px solid #e8c66a' : 'none');
      sub.innerHTML = '';
      if (t === 'mask') {
        sub.innerHTML = `<button data-i="red">🔴挡</button><button data-i="green">🟢通</button><button data-i="erase">🧹橡皮</button>
          笔刷<input id="bme-brush" type="range" min="8" max="90" value="${st.brush}" style="width:90px;vertical-align:middle;">`;
        sub.querySelectorAll('[data-i]').forEach(b => {
          b.style.cssText = 'background:#262038;border:1px solid #4a4266;color:#d8d2ea;border-radius:7px;padding:4px 8px;cursor:pointer;';
          b.onclick = () => { st.ink = b.dataset.i; sub.querySelectorAll('[data-i]').forEach(x => x.style.outline = x === b ? '2px solid #e8c66a' : 'none'); };
        });
        sub.querySelector('#bme-brush').oninput = e => st.brush = +e.target.value;
      }
      if (t === 'glow') sub.innerHTML = `半径<input id="bme-r" type="range" min="20" max="130" value="55" style="width:90px;vertical-align:middle;"> <button id="bme-del">⌫删除</button>`;
      if (t === 'smoke') sub.innerHTML = `<button id="bme-del">⌫删除</button>`;
      if (t === 'occ') sub.innerHTML = `<button id="bme-new">▧ 新建遮挡件</button> <button id="bme-del">⌫删除</button>`;
      const del = sub.querySelector('#bme-del');
      if (del) { del.style.cssText = 'background:#4a2020;border:1px solid #6a3a3a;color:#ecc;border-radius:7px;padding:4px 8px;cursor:pointer;'; del.onclick = delSel; }
      const nw = sub.querySelector('#bme-new');
      if (nw) { nw.style.cssText = 'background:#262038;border:1px solid #4a4266;color:#d8d2ea;border-radius:7px;padding:4px 8px;cursor:pointer;'; nw.onclick = () => { st.newOcc = true; tip.textContent = '在图上按住拖出一个框（松手时框底边=脚线）'; }; }
      const rr = sub.querySelector('#bme-r');
      if (rr) rr.oninput = e => { if (st.sel && st.sel.k === 'glow') st.glows[st.sel.i][2] = +e.target.value; };
    };
    root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => setTool(b.dataset.t));
    root.querySelector('#bme-base').onclick = () => st.showBase = !st.showBase;
    root.querySelector('#bme-quit').onclick = () => { location.href = location.pathname; };

    function delSel() {
      if (!st.sel) return;
      if (st.sel.k === 'glow') st.glows.splice(st.sel.i, 1);
      if (st.sel.k === 'smoke') st.smokes.splice(st.sel.i, 1);
      if (st.sel.k === 'occ') st.occ.splice(st.sel.i, 1);
      st.sel = null;
    }

    // ---------- 导出 ----------
    root.querySelector('#bme-json').onclick = () => {
      const out = {
        glows: st.glows,
        parts: st.smokes.map(p => ({ type: 'smoke', px: [Math.round(p[0]), Math.round(p[1])] })).concat([{ type: 'leaves', n: 8 }]),
        occ: st.occ.map(o => o.map(Math.round)),
      };
      const txt = JSON.stringify(out);
      const ta = document.createElement('textarea');
      ta.style.cssText = 'position:fixed;left:10%;top:15%;width:80%;height:60%;z-index:100001;background:#14121c;color:#cfc8e0;border:2px solid #e8c66a;border-radius:10px;padding:10px;font:12px monospace;';
      ta.value = '【把下面整段复制发给 AI 即可】\n' + txt;
      document.body.appendChild(ta); ta.select();
      try { navigator.clipboard.writeText(txt); tip.textContent = '已复制到剪贴板；也可手动全选复制。点文本框外关闭。'; } catch (e) {}
      ta.onblur = () => ta.remove();
    };
    root.querySelector('#bme-png').onclick = () => {
      maskCv.toBlob(b => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b); a.download = 'town_day_mask.png'; a.click();
        tip.textContent = '已下载 town_day_mask.png —— 去 GitHub 网页把它上传到 inbox/ 然后告诉 AI。';
      });
    };

    // ---------- 命中检测 ----------
    function hit(mx, my) {
      if (st.tool === 'glow') {
        for (let i = st.glows.length - 1; i >= 0; i--) if (Math.hypot(mx - st.glows[i][0], my - st.glows[i][1]) < Math.max(18, 14 / st.cam.z)) return { k: 'glow', i };
      }
      if (st.tool === 'smoke') {
        for (let i = st.smokes.length - 1; i >= 0; i--) if (Math.hypot(mx - st.smokes[i][0], my - st.smokes[i][1]) < Math.max(18, 14 / st.cam.z)) return { k: 'smoke', i };
      }
      if (st.tool === 'occ') {
        for (let i = st.occ.length - 1; i >= 0; i--) {
          const o = st.occ[i], tol = 8 / st.cam.z;
          if (Math.abs(my - o[4]) < tol && mx > o[0] && mx < o[0] + o[2]) return { k: 'occ', i, part: 'base' };
          if (Math.abs(mx - (o[0] + o[2])) < tol * 1.5 && Math.abs(my - (o[1] + o[3])) < tol * 1.5) return { k: 'occ', i, part: 'size' };
          if (mx > o[0] && mx < o[0] + o[2] && my > o[1] && my < o[1] + o[3]) return { k: 'occ', i, part: 'move' };
        }
      }
      return null;
    }

    // ---------- 交互 ----------
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const [mx, my] = toMap(e.offsetX, e.offsetY);
      const z2 = Math.min(4, Math.max(0.25, st.cam.z * (e.deltaY < 0 ? 1.15 : 0.87)));
      st.cam.x = mx - (e.offsetX - cv.width / 2) / z2;
      st.cam.y = my - (e.offsetY - cv.height / 2) / z2;
      st.cam.z = z2;
    }, { passive: false });

    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      const [mx, my] = toMap(e.offsetX, e.offsetY);
      if (st.tool === 'pan' || e.button === 1) { st.drag = { t: 'pan', sx: e.offsetX, sy: e.offsetY, cx: st.cam.x, cy: st.cam.y }; return; }
      if (st.tool === 'mask') { st.drag = { t: 'paint' }; paint(mx, my, mx, my); return; }
      if (st.tool === 'occ' && st.newOcc) { st.drag = { t: 'newocc', x0: mx, y0: my }; st.occ.push([mx, my, 2, 2, my + 2]); st.sel = { k: 'occ', i: st.occ.length - 1 }; return; }
      const h = hit(mx, my);
      if (h) {
        st.sel = h;
        if (h.k === 'glow') { const r = sub.querySelector('#bme-r'); if (r) r.value = st.glows[h.i][2]; }
        st.drag = { t: 'obj', h, mx, my, snap: JSON.stringify(h.k === 'occ' ? st.occ[h.i] : (h.k === 'glow' ? st.glows[h.i] : st.smokes[h.i])) };
      } else if (st.tool === 'glow') { st.glows.push([Math.round(mx), Math.round(my), 55]); st.sel = { k: 'glow', i: st.glows.length - 1 }; }
      else if (st.tool === 'smoke') { st.smokes.push([Math.round(mx), Math.round(my)]); st.sel = { k: 'smoke', i: st.smokes.length - 1 }; }
      else st.sel = null;
    });

    cv.addEventListener('pointermove', e => {
      const [mx, my] = toMap(e.offsetX, e.offsetY);
      posEl.textContent = `(${Math.round(mx)}, ${Math.round(my)})  缩放 ${st.cam.z.toFixed(2)}x`;
      if (!st.drag) return;
      if (st.drag.t === 'pan') {
        st.cam.x = st.drag.cx - (e.offsetX - st.drag.sx) / st.cam.z;
        st.cam.y = st.drag.cy - (e.offsetY - st.drag.sy) / st.cam.z;
      } else if (st.drag.t === 'paint') {
        paint(st.drag.lx == null ? mx : st.drag.lx, st.drag.ly == null ? my : st.drag.ly, mx, my);
        st.drag.lx = mx; st.drag.ly = my;
      } else if (st.drag.t === 'newocc') {
        const o = st.occ[st.sel.i];
        o[0] = Math.min(st.drag.x0, mx); o[1] = Math.min(st.drag.y0, my);
        o[2] = Math.abs(mx - st.drag.x0); o[3] = Math.abs(my - st.drag.y0);
        o[4] = o[1] + o[3];
      } else if (st.drag.t === 'obj') {
        const dx = mx - st.drag.mx, dy = my - st.drag.my;
        const s0 = JSON.parse(st.drag.snap), h = st.drag.h;
        if (h.k === 'glow') { st.glows[h.i][0] = Math.round(s0[0] + dx); st.glows[h.i][1] = Math.round(s0[1] + dy); }
        if (h.k === 'smoke') { st.smokes[h.i][0] = Math.round(s0[0] + dx); st.smokes[h.i][1] = Math.round(s0[1] + dy); }
        if (h.k === 'occ') {
          const o = st.occ[h.i];
          if (h.part === 'move') { o[0] = s0[0] + dx; o[1] = s0[1] + dy; o[4] = s0[4] + dy; }
          if (h.part === 'size') { o[2] = Math.max(10, s0[2] + dx); o[3] = Math.max(10, s0[3] + dy); }
          if (h.part === 'base') o[4] = s0[4] + dy;
        }
      }
    });
    const endDrag = () => { if (st.drag && st.drag.t === 'newocc') st.newOcc = false; st.drag = null; };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);

    function paint(x0, y0, x1, y1) {
      maskCtx.globalCompositeOperation = st.ink === 'erase' ? 'destination-out' : 'source-over';
      maskCtx.strokeStyle = st.ink === 'green' ? 'rgba(0,220,60,1)' : 'rgba(230,30,30,1)';
      maskCtx.lineWidth = st.brush; maskCtx.lineCap = 'round';
      maskCtx.beginPath(); maskCtx.moveTo(x0, y0); maskCtx.lineTo(x1, y1); maskCtx.stroke();
      maskCtx.globalCompositeOperation = 'source-over';
    }

    // ---------- 渲染 ----------
    function draw(now) {
      if (!document.getElementById('bmedit')) return;
      if (cv.width !== root.clientWidth) { cv.width = root.clientWidth; cv.height = root.clientHeight; }
      const z = st.cam.z;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0a0a0e'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.setTransform(z, 0, 0, z, cv.width / 2 - st.cam.x * z, cv.height / 2 - st.cam.y * z);
      ctx.imageSmoothingEnabled = z < 1;
      if (img.complete && img.width) ctx.drawImage(img, 0, 0);
      if (st.showBase) { ctx.globalAlpha = 0.85; ctx.drawImage(base, 0, 0, W0, H0); ctx.globalAlpha = 1; }
      ctx.globalAlpha = 0.6; ctx.drawImage(maskCv, 0, 0); ctx.globalAlpha = 1;

      // 烟预览
      for (let si = 0; si < st.smokes.length; si++) {
        const [bx, by] = st.smokes[si];
        for (let i = 0; i < 9; i++) {
          const ph = (now * (0.010 + (i % 3) * 0.0013) + i * 29 + si * 41) % 130;
          const px = bx + Math.sin(ph * 0.085 + i * 1.9) * (1 + ph * 0.1) + ph * 0.22;
          const py = by - ph * 0.83;
          const a = 0.22 * (1 - ph / 130) * Math.min(1, ph / 12);
          ctx.fillStyle = `rgba(206,206,214,${a.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(px, py, 1.6 + ph * 0.075, 0, 7); ctx.fill();
        }
        const on = st.sel && st.sel.k === 'smoke' && st.sel.i === si;
        ctx.strokeStyle = on ? '#fff' : 'rgba(140,200,255,.9)'; ctx.lineWidth = 1.6 / z;
        ctx.strokeRect(bx - 7, by - 7, 14, 14);
      }
      // 灯预览（闪烁）
      ctx.globalCompositeOperation = 'screen';
      for (let gi = 0; gi < st.glows.length; gi++) {
        const g = st.glows[gi];
        const f = 0.87 + 0.09 * Math.sin(now * 0.0036 + gi * 2.13) + 0.05 * Math.sin(now * 0.0121 + gi * 5.31);
        const rr = g[2] * f;
        const rg = ctx.createRadialGradient(g[0], g[1], 2, g[0], g[1], rr);
        rg.addColorStop(0, g[3] || 'rgba(255,190,105,.55)');
        rg.addColorStop(0.5, 'rgba(255,170,80,.20)'); rg.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = rg; ctx.fillRect(g[0] - rr, g[1] - rr, rr * 2, rr * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (let gi = 0; gi < st.glows.length; gi++) {
        const g = st.glows[gi], on = st.sel && st.sel.k === 'glow' && st.sel.i === gi;
        ctx.strokeStyle = on ? '#fff' : 'rgba(255,220,90,.9)'; ctx.lineWidth = 1.6 / z;
        ctx.beginPath(); ctx.arc(g[0], g[1], 8, 0, 7); ctx.stroke();
      }
      // 遮挡件
      if (st.tool === 'occ') for (let i = 0; i < st.occ.length; i++) {
        const o = st.occ[i], on = st.sel && st.sel.k === 'occ' && st.sel.i === i;
        ctx.strokeStyle = on ? '#fff' : 'rgba(255,220,60,.85)'; ctx.lineWidth = (on ? 2.4 : 1.4) / z;
        ctx.strokeRect(o[0], o[1], o[2], o[3]);
        ctx.strokeStyle = 'rgba(80,230,255,.95)';
        ctx.beginPath(); ctx.moveTo(o[0], o[4]); ctx.lineTo(o[0] + o[2], o[4]); ctx.stroke();
        ctx.fillStyle = on ? '#fff' : 'rgba(255,220,60,.85)';
        ctx.fillRect(o[0] + o[2] - 5 / z, o[1] + o[3] - 5 / z, 10 / z, 10 / z);
      }
      requestAnimationFrame(draw);
    }
    setTool('pan');
    requestAnimationFrame(draw);
  }
})();
