import Phaser from 'phaser';
import { ENEMY, LOOT } from '../config/balance';
import { EventBus, GameEvents } from '../core/EventBus';
import type { ItemInstance } from '../core/types';
import { ENEMIES } from '../data/enemies';
import { Enemy } from '../entities/Enemy';
import { LootDrop } from '../entities/LootDrop';
import { rollDamage } from '../systems/Combat';
import { addToInventory } from '../systems/Equipment';
import { weightedPick } from '../systems/Items';
import { rollDrop } from '../systems/LootGenerator';
import { gainExp, killExp } from '../systems/Progression';
import { RAINBOW } from '../ui/rarityStyle';
import { WorldScene, type WorldData } from './WorldScene';

/** フィールド／ボスエリア。data/areas.ts の定義から構築する */
export class FieldScene extends WorldScene {
  private enemies: Enemy[] = [];
  private liveEnemies: Enemy[] = [];
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private respawnTimers: number[] = [];
  private drops: LootDrop[] = [];
  private fullWarnAt = 0;
  private hpBars!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Field');
  }

  init(data: WorldData) {
    super.init(data);
    this.enemies = [];
    this.liveEnemies = [];
    this.respawnTimers = [];
    this.drops = [];
  }

  create() {
    this.createWorld();

    this.enemyGroup = this.physics.add.group();
    for (let i = 0; i < this.area.maxEnemies; i++) {
      const e = new Enemy(this);
      this.enemies.push(e);
      this.enemyGroup.add(e);
    }
    this.physics.add.collider(this.enemyGroup, this.map.layer);
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);
    this.physics.add.collider(this.player, this.enemyGroup);
    for (let i = 0; i < this.area.maxEnemies; i++) this.spawnEnemy(true);

    this.hpBars = this.add.graphics().setDepth(99999);
  }

  // ------------------------------------------------------------ 敵の出現

  private spawnEnemy(initial = false) {
    const e = this.enemies.find((en) => !en.active);
    if (!e || this.area.enemies.length === 0) return;
    // プレイヤーから一定以上離れた場所
    const minD = initial ? 80 : ENEMY.respawnMinDistance;
    let pos = this.map.walkable[0];
    for (let tries = 0; tries < 30; tries++) {
      pos = Phaser.Utils.Array.GetRandom(this.map.walkable);
      if (Math.hypot(pos.x - this.player.x, pos.y - this.player.y) >= minD) break;
    }
    const pick = weightedPick(this.area.enemies, (en) => en.weight)!;
    e.spawn(ENEMIES[pick.id], pos.x, pos.y, this.area.level);
  }

  // ------------------------------------------------------------ CombatWorld

  getLiveEnemies(): readonly Enemy[] {
    return this.liveEnemies;
  }

  damageEnemy(enemy: Enemy, power: number, fromX: number, fromY: number) {
    if (!enemy.alive) return;
    const res = rollDamage(this.player.stats, power, enemy.defense);
    const died = enemy.applyDamage(res.amount, fromX, fromY);
    this.floatText.show(enemy.x, enemy.y - 6, `${res.amount}`, res.crit ? '#ffcd75' : '#f4f4f4', res.crit);
    this.sparks.explode(res.crit ? 8 : 4, enemy.x, enemy.y);
    if (died) {
      this.sparks.explode(12, enemy.x, enemy.y);
      this.respawnTimers.push(ENEMY.respawnDelay);
      EventBus.emit(GameEvents.EnemyKilled, enemy.def.id, enemy.x, enemy.y);
      gainExp(killExp(enemy.def.exp, this.area.level));
      const item = rollDrop({ itemLevel: this.area.level, jobId: this.player.jobId, dropRate: enemy.def.dropRate });
      if (item) this.spawnDrop(item, enemy.x, enemy.y);
    }
  }

  // ------------------------------------------------------------ ドロップ

  private spawnDrop(item: ItemInstance, x: number, y: number) {
    // 上限を超えたら古いノーマルから消す
    if (this.drops.length >= LOOT.maxGroundItems) {
      const old = this.drops.find((d) => d.item.rarity === 'normal') ?? this.drops[0];
      old.destroy();
      this.drops.splice(this.drops.indexOf(old), 1);
    }
    this.drops.push(new LootDrop(this, item, x, y));
    if (item.rarity === 'legendary') {
      this.cameras.main.flash(250, 255, 245, 220);
      EventBus.emit(GameEvents.Toast, 'レジェンダリーが出た！', RAINBOW);
    }
  }

  private updatePickup() {
    const p = this.player;
    if (p.dead) return;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (!d.ready || Math.hypot(d.x - p.x, d.y - p.y) > LOOT.pickupRange) continue;
      if (!addToInventory(d.item)) {
        if (this.time.now > this.fullWarnAt) {
          EventBus.emit(GameEvents.Toast, '持ち物がいっぱい！', '#b13e53');
          this.fullWarnAt = this.time.now + 2500;
        }
        return;
      }
      d.collect(p.x, p.y);
      this.drops.splice(i, 1);
      EventBus.emit(GameEvents.ItemPickedUp, d.item);
    }
  }

  // ------------------------------------------------------------ 毎フレーム

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;

    this.liveEnemies.length = 0;
    for (const e of this.enemies) if (e.alive) this.liveEnemies.push(e);

    this.updateWorld(dt);
    for (const e of this.liveEnemies) e.updateEnemy(dt, this);

    // 再出現
    for (let i = this.respawnTimers.length - 1; i >= 0; i--) {
      this.respawnTimers[i] -= dt;
      if (this.respawnTimers[i] <= 0) {
        this.respawnTimers.splice(i, 1);
        this.spawnEnemy();
      }
    }

    this.updatePickup();
    this.drawHpBars();
  }

  private drawHpBars() {
    const g = this.hpBars;
    g.clear();
    for (const e of this.liveEnemies) {
      if (e.hp >= e.maxHp) continue;
      const w = 12;
      const x = Math.round(e.x - w / 2);
      const y = Math.round(e.y - 10);
      g.fillStyle(0x1a1c2c, 1).fillRect(x - 1, y - 1, w + 2, 3);
      g.fillStyle(0xb13e53, 1).fillRect(x, y, Math.max(1, Math.round((w * e.hp) / e.maxHp)), 1);
    }
  }
}
