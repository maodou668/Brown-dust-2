# -*- coding: utf-8 -*-
# 8-direction sprite renderer for Blender (headless).
# 用法（本机命令行）:
#   blender -b -P scripts/render8.py -- <model.glb|.fbx|.blend> <out_dir>
# 例:
#   blender -b -P scripts/render8.py -- lecliss.glb out_lecliss
#
# 输出: out_dir/<动作名>/<方向>/NNN.png   (没有动画则 out_dir/static/<方向>/000.png)
# 方向顺序与游戏一致: south, south-east, east, north-east, north, north-west, west, south-west
# 渲完把 out_dir 整个发我 / 或 commit，我来切帧+拼进游戏。
#
# ★ 先渲一个角色，确认 south 是"正面朝镜头"、角度/大小合适，再批量。
#   如果朝向不对，改下面 START_ANGLE_DEG（每次 +45 试）。

import bpy, sys, os, math
from mathutils import Vector

# ---------------- 可调参数 ----------------
RES           = 256          # 每帧分辨率(正方形)；后面我会归一缩放，渲大点无妨
CAM_ELEV_DEG  = 30           # 相机俯角(低俯视~25-35°，对齐游戏 low top-down)
ORTHO_MARGIN  = 1.15         # 取景留白(越大人物越小)
FRAME_STEP    = 2            # 动画隔几帧取一帧(2=减半，省帧)
START_ANGLE_DEG = 0          # 朝向校正：south 不是正面就 +45 重试
SUN_ENERGY    = 3.0
DIRS = ['south','south-east','east','north-east','north','north-west','west','south-west']
# -----------------------------------------

argv = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(argv) < 2:
    print('usage: blender -b -P render8.py -- <model> <out_dir>'); sys.exit(1)
MODEL, OUT = argv[0], argv[1]

# 清空默认场景
bpy.ops.wm.read_factory_settings(use_empty=True)

# 导入模型
ext = os.path.splitext(MODEL)[1].lower()
if ext in ('.glb','.gltf'): bpy.ops.import_scene.gltf(filepath=MODEL)
elif ext == '.fbx':         bpy.ops.import_scene.fbx(filepath=MODEL)
elif ext == '.obj':         bpy.ops.wm.obj_import(filepath=MODEL)
elif ext == '.blend':       bpy.ops.wm.open_mainfile(filepath=MODEL)
else: print('unsupported:', ext); sys.exit(1)

scene = bpy.context.scene

# 收集导入对象，挂到一个父 Empty 上，绕 Z 旋转它来出 8 向
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0,0,0))
pivot = bpy.context.active_object
roots = [o for o in scene.objects if o.parent is None and o is not pivot]
for o in roots: o.parent = pivot

# 计算整体包围盒(用世界坐标顶点)
def world_bounds():
    mn = Vector(( 1e9, 1e9, 1e9)); mx = Vector((-1e9,-1e9,-1e9))
    for o in scene.objects:
        if o.type != 'MESH': continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i]=min(mn[i],w[i]); mx[i]=max(mx[i],w[i])
    return mn, mx
mn, mx = world_bounds()
center = (mn+mx)/2
size = mx-mn
height = max(size.z, 0.001)
radius = max(size.x, size.y, size.z)

# 相机(正交)，低俯视
cam_data = bpy.data.cameras.new('cam'); cam_data.type='ORTHO'
cam_data.ortho_scale = max(height, size.x) * ORTHO_MARGIN
cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam)
scene.camera = cam
elev = math.radians(CAM_ELEV_DEG)
dist = radius*4 + 2
# 相机放在 -Y 方向、抬高 elev，看向 center
cam.location = center + Vector((0, -dist*math.cos(elev), dist*math.sin(elev)))
# 朝向 center
dirv = (center - cam.location).normalized()
cam.rotation_euler = dirv.to_track_quat('-Z','Y').to_euler()

# 灯光：明亮 + 偏平（像立绘，不要重阴影）。强环境光打底 + 一盏正前上方柔光补面。
world = bpy.data.worlds.new('w'); scene.world = world
world.use_nodes = True
try: world.node_tree.nodes['Background'].inputs[1].default_value = 1.3   # 环境打底
except Exception: pass
# 关键光跟相机同向 → 永远照亮"朝镜头那一面"，8 个旋转受光一致、不会变剪影
sun_d = bpy.data.lights.new('sun','SUN'); sun_d.energy=4.0
sun_d.angle = math.radians(25)
sun = bpy.data.objects.new('sun', sun_d); scene.collection.objects.link(sun)
sun.rotation_euler = cam.rotation_euler.copy()   # 与相机同朝向
# 顶部再补一盏弱光给头发/肩立体感
top_d = bpy.data.lights.new('top','SUN'); top_d.energy=1.5
top = bpy.data.objects.new('top', top_d); scene.collection.objects.link(top)
top.rotation_euler = (math.radians(20), 0, 0)

# 渲染设置：透明 PNG。用 CYCLES + CPU（无头服务器无 GPU/显示，EEVEE 跑不了）。
scene.render.engine = 'CYCLES'
try:
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48          # 角色平涂用不到高采样，48 够且快
    scene.cycles.use_denoising = True
except Exception: pass
scene.render.resolution_x = RES; scene.render.resolution_y = RES
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

# 收集动画动作
actions = list(bpy.data.actions)
def render_to(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path; bpy.ops.render.render(write_still=True)

base_rot = pivot.rotation_euler.z
for di, d in enumerate(DIRS):
    pivot.rotation_euler.z = base_rot + math.radians(START_ANGLE_DEG + di*45)
    if actions:
        for act in actions:
            # 把动作挂到有动画数据的对象上
            target = next((o for o in scene.objects if o.animation_data), None)
            if target is None: break
            target.animation_data.action = act
            f0,f1 = int(act.frame_range[0]), int(act.frame_range[1])
            out_i = 0
            for f in range(f0, f1+1, FRAME_STEP):
                scene.frame_set(f)
                render_to(os.path.join(OUT, act.name, d, f'{out_i:03d}.png')); out_i += 1
    else:
        render_to(os.path.join(OUT, 'static', d, '000.png'))

print('DONE ->', OUT)
