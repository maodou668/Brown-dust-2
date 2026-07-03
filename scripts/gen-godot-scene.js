#!/usr/bin/env node
// web 地图定义 → Godot 场景（M0）：
//  1) 同步资产 art/06_story/{tiles,props} + 测试角色帧 + 灯光贴图 → godot/assets/
//  2) 生成 godot/tiles/village_tileset.tres（两个 atlas 源：road_grass / grass_var）
//  3) 生成 godot/scenes/village_map.json（ground/road 两层格子，wang 与 web 渲染器同构）
//  4) 生成 godot/scenes/village.tscn（TileMapLayer 地面 + props Sprite2D 可拖拽 + 灯光 + 玩家 + gloom）
// 用法: NODE_PATH=<repo>/node_modules node scripts/gen-godot-scene.js
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ROOT = path.resolve(__dirname, '..');
const G = p => path.join(ROOT, 'godot', p);

(async () => {
  // ---- 取 web 的村庄定义（story2 chapter1 第一个带 stage 的 op）----
  global.window = {};
  require(path.join(ROOT, 'js/story2.js'));
  const cfg = (global.window.SCRIPTS.chapter1 || []).find(o => o.stage);
  const st = cfg.stage, m = st.map, T = m.tile || 32;
  const layers = m.layers;
  const gsrc = layers.map(l => l.grid).find(Boolean);
  const rows = gsrc.length - 1, cols = gsrc[0].length - 1;

  // ---- 1) 资产同步 ----
  for (const d of ['assets/tiles', 'assets/props', 'assets/chars', 'scenes', 'tiles']) fs.mkdirSync(G(d), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'art/06_story/tiles'))) if (f.endsWith('.png'))
    fs.copyFileSync(path.join(ROOT, 'art/06_story/tiles', f), G('assets/tiles/' + f));
  for (const f of fs.readdirSync(path.join(ROOT, 'art/06_story/props'))) if (f.endsWith('.png'))
    fs.copyFileSync(path.join(ROOT, 'art/06_story/props', f), G('assets/props/' + f));
  fs.copyFileSync(path.join(ROOT, 'art/05_pixellab/teried_field/idle/south/00.png'), G('assets/chars/teried_south.png'));
  // 灯光贴图（径向渐变）
  const lc = createCanvas(256, 256); const lctx = lc.getContext('2d');
  const rg = lctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.5, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  lctx.fillStyle = rg; lctx.fillRect(0, 0, 256, 256);
  fs.writeFileSync(G('assets/light_radial.png'), lc.toBuffer('image/png'));

  // ---- 2) TileSet 资源 ----
  const declare = (w, h) => { let s = ''; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) s += `${x}:${y}/0 = 0\n`; return s; };
  fs.writeFileSync(G('tiles/village_tileset.tres'), `[gd_resource type="TileSet" load_steps=5 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles/road_grass.png" id="1"]
[ext_resource type="Texture2D" path="res://assets/tiles/grass_var.png" id="2"]

[sub_resource type="TileSetAtlasSource" id="src_road"]
texture = ExtResource("1")
texture_region_size = Vector2i(32, 32)
${declare(4, 5)}
[sub_resource type="TileSetAtlasSource" id="src_grass"]
texture = ExtResource("2")
texture_region_size = Vector2i(32, 32)
${declare(6, 1)}
[resource]
tile_size = Vector2i(32, 32)
sources/0 = SubResource("src_road")
sources/1 = SubResource("src_grass")
`);

  // ---- 3) 地图 JSON（与 Diorama tick 同构的 wang 计算）----
  const lutRoad = JSON.parse(fs.readFileSync(path.join(ROOT, layers[1].lut))).lut;
  const grid = layers[1].grid;
  const ground = [], road = [];
  const gvar = layers[0].fullVar;   // grass_var 源里的像素坐标 → atlas 坐标 /32
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const gv = gvar[(c * 7 + r * 13) % gvar.length];
    ground.push([c, r, 1, gv[0] / 32, gv[1] / 32]);
    const mask = (grid[r][c] === '1' ? 1 : 0) + (grid[r][c + 1] === '1' ? 2 : 0)
               + (grid[r + 1][c] === '1' ? 4 : 0) + (grid[r + 1][c + 1] === '1' ? 8 : 0);
    if (mask === 0) continue;
    const t = lutRoad[mask];
    if (t) road.push([c, r, 0, t[0] / 32, t[1] / 32]);
  }
  fs.writeFileSync(G('scenes/village_map.json'), JSON.stringify({ ground, road }));

  // ---- 4) 场景 .tscn ----
  const props = st.props || [];
  const texOf = img => 'assets/props/' + path.basename(img);
  const uniqueTex = [...new Set(props.map(p => texOf(p.img)))];
  const extra = 6; // tileset/gd×3/light/char
  let ext = `[ext_resource type="TileSet" path="res://tiles/village_tileset.tres" id="ts"]
[ext_resource type="Script" path="res://scripts/ground_builder.gd" id="gb"]
[ext_resource type="Script" path="res://scripts/player.gd" id="pl"]
[ext_resource type="Script" path="res://scripts/shot_taker.gd" id="shot"]
[ext_resource type="Texture2D" path="res://assets/light_radial.png" id="light"]
[ext_resource type="Texture2D" path="res://assets/chars/teried_south.png" id="char"]
`;
  uniqueTex.forEach((t, i) => { ext += `[ext_resource type="Texture2D" path="res://${t}" id="t${i}"]\n`; });
  const texId = t => 't' + uniqueTex.indexOf(t);

  // props 节点：position=脚点(px)，offset.y=-半高（脚线锚定），y_sort 生效
  let propNodes = '';
  const sizes = {};
  for (const t of uniqueTex) { const im = await loadImage(G(t)); sizes[t] = [im.width, im.height]; }
  props.forEach((p, i) => {
    const t = texOf(p.img), s = p.s || 1, [w, h] = sizes[t];
    propNodes += `
[node name="prop_${i}_${path.basename(p.img, '.png')}" type="Sprite2D" parent="World"]
position = Vector2(${(p.x * T).toFixed(1)}, ${(p.y * T).toFixed(1)})
offset = Vector2(0, ${(-h / 2).toFixed(1)})
scale = Vector2(${s}, ${s})
texture = ExtResource("${texId(t)}")
y_sort_enabled = true
`;
    if (p.glow) propNodes += `
[node name="light_${i}" type="PointLight2D" parent="World"]
position = Vector2(${(p.x * T).toFixed(1)}, ${(p.y * T - 40).toFixed(1)})
texture = ExtResource("light")
color = Color(1, 0.77, 0.43, 1)
energy = 1.2
texture_scale = ${(p.glow.r || 2.6) * T / 90}
`;
  });

  // 玩家出生在广场
  const px = 0.52 * cols * T, py = 0.5 * rows * T;
  fs.writeFileSync(G('scenes/village.tscn'), `[gd_scene load_steps=${extra + uniqueTex.length + 1} format=3]

${ext}
[node name="Village" type="Node2D"]

[node name="Gloom" type="CanvasModulate" parent="."]
color = Color(0.80, 0.84, 0.80, 1)

[node name="Ground" type="TileMapLayer" parent="."]
tile_set = ExtResource("ts")
script = ExtResource("gb")
layer_key = "ground"

[node name="Road" type="TileMapLayer" parent="."]
tile_set = ExtResource("ts")
script = ExtResource("gb")
layer_key = "road"

[node name="World" type="Node2D" parent="."]
y_sort_enabled = true
${propNodes}
[node name="Player" type="CharacterBody2D" parent="World"]
position = Vector2(${px.toFixed(0)}, ${py.toFixed(0)})
script = ExtResource("pl")
y_sort_enabled = true

[node name="Sprite" type="Sprite2D" parent="World/Player"]
offset = Vector2(0, -36)
texture = ExtResource("char")

[node name="Camera" type="Camera2D" parent="World/Player"]
zoom = Vector2(2, 2)

[node name="ShotTaker" type="Node" parent="."]
script = ExtResource("shot")
`);
  console.log(`生成完成: ground ${ground.length} 格, road ${road.length} 格, props ${props.length} 件`);
})();
