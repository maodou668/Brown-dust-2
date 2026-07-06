# HD-2D 样板间: 相机/光照由场景 .tscn 定死; 带 --screenshot 用户参数时渲染后截图退出
extends Node3D

func _ready() -> void:
	if "--screenshot" in OS.get_cmdline_user_args():
		_shoot()

func _shoot() -> void:
	await RenderingServer.frame_post_draw
	await get_tree().create_timer(0.8).timeout
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png("res://shot.png")
	print("SHOT-SAVED")
	get_tree().quit()
