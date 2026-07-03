@tool
# 地面构建器：从 village_map.json 读格子铺 TileMapLayer（编辑器里也会显示）
# 地面由 web 管线的地图定义生成（scripts/gen-godot-scene.js），props 是场景里的真节点可拖拽。
extends TileMapLayer

@export_file("*.json") var map_json := "res://scenes/village_map.json"
@export var layer_key := "ground"

func _ready() -> void:
	var f := FileAccess.open(map_json, FileAccess.READ)
	if f == null:
		push_warning("找不到 %s" % map_json)
		return
	var data: Variant = JSON.parse_string(f.get_as_text())
	if typeof(data) != TYPE_DICTIONARY or not data.has(layer_key):
		return
	clear()
	for c in data[layer_key]:
		set_cell(Vector2i(int(c[0]), int(c[1])), int(c[2]), Vector2i(int(c[3]), int(c[4])))
