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

func _find_skel(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node
	for c in node.get_children():
		var r := _find_skel(c)
		if r != null:
			return r
	return null

func _rot(skel: Skeleton3D, bone_name: String, euler_deg: Vector3) -> void:
	var idx := skel.find_bone(bone_name)
	if idx == -1:
		print("no bone ", bone_name)
		return
	var delta := Quaternion.from_euler(Vector3(deg_to_rad(euler_deg.x), deg_to_rad(euler_deg.y), deg_to_rad(euler_deg.z)))
	var rest_q := skel.get_bone_rest(idx).basis.get_rotation_quaternion()
	skel.set_bone_pose_rotation(idx, rest_q * delta)

func _render() -> void:
	var glb: PackedScene = load("res://mesh/justia_bone.glb")
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
	var base_pos := model.position
	# 走路循环: 我在Godot里驱动骨架, 逐帧渲(正面), 存 walk_NN.png
	if "--walkcycle" in OS.get_cmdline_user_args():
		var skel2 := _find_skel(model)
		var N := 8
		for i in range(N):
			var ph := float(i) / float(N) * TAU
			var arm := 34.0 * sin(ph)
			var leg := 26.0 * sin(ph)
			_rot(skel2, "L_Upperarm", Vector3(arm, 0, 0))
			_rot(skel2, "R_Upperarm", Vector3(-arm, 0, 0))
			_rot(skel2, "L_Thigh", Vector3(-leg, 0, 0))
			_rot(skel2, "R_Thigh", Vector3(leg, 0, 0))
			model.position.y = base_pos.y + 0.045 * absf(sin(ph * 2.0))
			await RenderingServer.frame_post_draw
			await get_tree().create_timer(0.05).timeout
			await RenderingServer.frame_post_draw
			var im := get_viewport().get_texture().get_image()
			im.save_png("res://walk_%02d.png" % i)
		print("WALKCYCLE-DONE")
		get_tree().quit()
		return
	# 测试: 摆个走路姿势(手臂摆+大腿分), 看骨架驱动干不干净
	if "--walkpose" in OS.get_cmdline_user_args():
		var skel := _find_skel(model)
		if skel:
			_rot(skel, "L_Upperarm", Vector3(35, 0, 0))
			_rot(skel, "R_Upperarm", Vector3(-35, 0, 0))
			_rot(skel, "L_Thigh", Vector3(28, 0, 0))
			_rot(skel, "R_Thigh", Vector3(-28, 0, 0))
			await get_tree().process_frame
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
