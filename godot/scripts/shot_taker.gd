# 云端自测钩子：环境变量 SHOT=<输出png路径> 时，渲染两帧后截图退出
# 用法: SHOT=/tmp/shot.png xvfb-run tools/godot --path godot scenes/village.tscn
extends Node

func _ready() -> void:
	var out := OS.get_environment("SHOT")
	if out == "":
		return
	await get_tree().process_frame
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(out)
	print("SHOT_SAVED ", out)
	get_tree().quit()
