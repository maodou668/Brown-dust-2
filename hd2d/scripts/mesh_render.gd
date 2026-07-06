# 图生3D网格转台渲染: 带 --meshrender 时, 把 justia.glb 从4个Y朝向各渲一张, 存 PNG 后退出
# 验证"同一个3D小人转一圈=每个角度同一个人"(转身物理保证一致)
extends Node3D

func _ready() -> void:
	if "--meshrender" in OS.get_cmdline_user_args():
		await _render()

func _all_mesh_instances(node: Node, out: Array) -> void:
	if node is MeshInstance3D:
		out.append(node)
	for c in node.get_children():
		_all_mesh_instances(c, out)

func _render() -> void:
	var glb: PackedScene = load("res://mesh/justia_tripo.glb")
	var pivot: Node3D = $Pivot
	# 有贴图: 柔和均匀打光让颜色读得清(不要硬侧光压暗)
	$Sun.rotation_degrees = Vector3(-25.0, -20.0, 0.0)
	$Fill.rotation_degrees = Vector3(-10.0, 160.0, 0.0)
	var model: Node3D = glb.instantiate()
	pivot.add_child(model)
	await get_tree().process_frame
	# 收集所有 MeshInstance3D, 合并 AABB(局部), 顶点色当 albedo
	var meshes: Array = []
	_all_mesh_instances(model, meshes)
	var aabb := AABB()
	var first := true
	for mi in meshes:
		# 保留 GLB 自带贴图材质(不override), 只算 AABB
		var a: AABB = mi.transform * mi.get_aabb()
		if first: aabb = a; first = false
		else: aabb = aabb.merge(a)
	# 归一化: 高度缩到 ~1.7, 中心移到原点
	var h: float = max(aabb.size.y, 0.001)
	var s: float = 1.7 / h
	model.scale = Vector3(s, s, s)
	model.position = -aabb.get_center() * s
	var views := [["front", 0.0], ["side", 90.0], ["back", 180.0], ["side2", 270.0]]
	for v in views:
		pivot.rotation_degrees = Vector3(0, v[1], 0)
		await RenderingServer.frame_post_draw
		await get_tree().create_timer(0.35).timeout
		await RenderingServer.frame_post_draw
		var img := get_viewport().get_texture().get_image()
		img.save_png("res://mesh_%s.png" % v[0])
		print("RENDERED ", v[0])
	print("MESHRENDER-DONE")
	get_tree().quit()
