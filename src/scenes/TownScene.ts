import Phaser from 'phaser';
import { TOWN } from '../config/balance';
import { EventBus, GameEvents } from '../core/EventBus';
import { HudState } from '../core/HudState';
import type { NpcDef } from '../core/types';
import { InputState } from '../input/InputState';
import { openOverlay } from '../ui/overlay';
import { createText } from '../ui/text';
import { WorldScene } from './WorldScene';

interface NpcObj {
  def: NpcDef;
  img: Phaser.Physics.Arcade.Image;
}

/** 拠点の町。戦闘はなく、攻撃ボタンが「話す」になる */
export class TownScene extends WorldScene {
  private npcs: NpcObj[] = [];
  private marker!: Phaser.GameObjects.Text;
  private wasPressed = false;

  constructor() {
    super('Town');
  }

  create() {
    this.createWorld();
    this.player.canAttack = false;
    this.npcs = [];

    for (const def of this.area.npcs ?? []) {
      const pos = this.map.markers.get(def.marker)?.[0];
      if (!pos) continue;
      const img = this.physics.add.staticImage(pos.x, pos.y, def.sprite, 0).setDepth(pos.y);
      img.body.setCircle(6, 2, 4);
      img.refreshBody();
      this.physics.add.collider(this.player, img);
      this.add.image(pos.x, pos.y + 7, 'shadow', 0).setAlpha(0.3).setDepth(pos.y - 1);
      createText(this, pos.x, pos.y - 11, def.name, 6, '#f4f4f4', { stroke: '#1a1c2c', strokeThickness: 2 })
        .setOrigin(0.5, 1)
        .setDepth(99990);
      // その場で小さく跳ねる
      this.tweens.add({ targets: img, y: pos.y - 1, duration: 500 + Math.random() * 200, yoyo: true, repeat: -1 });
      this.npcs.push({ def, img });
    }

    this.marker = createText(this, 0, 0, '▼', 6, '#ffd23f', { stroke: '#1a1c2c', strokeThickness: 2 })
      .setOrigin(0.5, 1)
      .setDepth(99991)
      .setVisible(false);
    this.tweens.add({ targets: this.marker, alpha: 0.4, duration: 400, yoyo: true, repeat: -1 });
    this.wasPressed = true;
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;
    this.updateWorld(dt);

    const near = this.nearestNpc();
    HudState.skillsEnabled = false;
    HudState.attackEnabled = !!near;
    HudState.interactLabel = near ? '話す' : null;
    if (near) this.marker.setPosition(near.img.x, near.img.y - 19).setVisible(true);
    else this.marker.setVisible(false);

    // 攻撃ボタンを押した瞬間に話しかける
    const pressed = InputState.attackHeld;
    if (pressed && !this.wasPressed && near) this.interact(near.def);
    this.wasPressed = pressed;
  }

  private nearestNpc(): NpcObj | undefined {
    let best: NpcObj | undefined;
    let bestD: number = TOWN.talkRange;
    for (const n of this.npcs) {
      const d = Math.hypot(n.img.x - this.player.x, n.img.y - this.player.y);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  private interact(def: NpcDef) {
    for (const line of def.lines) EventBus.emit(GameEvents.Toast, `${def.name}「${line}」`, '#f4f4f4');
    if (def.action === 'jobChange') openOverlay(this, 'JobSelect');
    if (def.action === 'upgrade') openOverlay(this, 'Inventory', { mode: 'upgrade' });
  }
}
