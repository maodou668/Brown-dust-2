# M0 测试角色：方向键/WASD 走动，感受比例与遮挡
extends CharacterBody2D

const SPEED := 150.0

func _physics_process(_delta: float) -> void:
	var v := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	velocity = v * SPEED
	move_and_slide()
