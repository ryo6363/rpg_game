import Phaser from 'phaser';
import { BOSS, ENEMY, LOOT } from '../config/balance';
import { EventBus, GameEvents } from '../core/EventBus';
import { HudState } from '../core/HudState';
import type { ItemInstance } from '../core/types';
import { ENEMIES } from '../data/enemies';
import { Enemy } from '../entities/Enemy';
import { LootDrop } from '../entities/LootDrop';
import { rollDamage } from '../systems/Combat';
import { addToInventory } from '../systems/Equipment';
import { weightedPick } from '../systems/Items';
import { createRandomItem, rollDrop } from '../systems/LootGenerator';
import { gainExp, killExp } from '../systems/Progression';
import { enemyLevel, hasFlag, rarityBonus, setFlag } from '../systems/Story';
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
  private boss: Enemy | null = null;

  constructor() {
    super('Field');
  }

  init(data: WorldData) {
    super.init(data);
    this.enemies = [];
    this.liveEnemies = [];
    this.respawnTimers = [];
    this.drops = [];
    this.boss = null;
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
    this.spawnBoss();

    this.hpBars = this.add.graphics().setDepth(99999);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (HudState.boss = null));
  }

  /** ボスエリアならボスを出す（この周回で倒していなければ） */
  private spawnBoss() {
    const b = this.area.boss;
    if (!b || hasFlag(`defeated_${b.id}`)) return;
    const pos = this.map.markers.get(b.marker)?.[0];
    if (!pos) return;
    const e = new Enemy(this);
    this.enemies.push(e);
    this.enemyGroup.add(e);
    e.spawn(ENEMIES[b.id], pos.x, pos.y, enemyLevel(this.area.level));
    this.boss = e;
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
    e.spawn(ENEMIES[pick.id], pos.x, pos.y, enemyLevel(this.area.level));
  }

  // ------------------------------------------------------------ CombatWorld

  getLiveEnemies(): readonly Enemy[] {
    return this.liveEnemies;
  }

  damageEnemy(enemy: Enemy, power: number, fromX: number, fromY: number) {
    if (!enemy.alive) return;
    const res = rollDamage(this.player.stats, power, enemy.defense);
    const { died, phaseUp } = enemy.applyDamage(res.amount, fromX, fromY);
    this.floatText.show(enemy.x, enemy.y - 6, `${res.amount}`, res.crit ? '#ffcd75' : '#f4f4f4', res.crit);
    this.sparks.explode(res.crit ? 8 : 4, enemy.x, enemy.y);
    // ボスに最初の一撃を当てたとき・フェーズが変わったときの台詞
    if (enemy.isBoss && !enemy.hitOnce && !died) {
      enemy.hitOnce = true;
      this.playStory({ type: 'bossHit', boss: enemy.def.id });
    }
    if (phaseUp) this.playStory({ type: 'bossPhase', boss: enemy.def.id, phase: enemy.phase });
    if (died) {
      this.sparks.explode(12, enemy.x, enemy.y);
      EventBus.emit(GameEvents.EnemyKilled, enemy.def.id, enemy.x, enemy.y);
      gainExp(killExp(enemy.def.exp, enemy.level));
      if (enemy.isBoss) {
        this.onBossDefeated(enemy);
        return;
      }
      this.respawnTimers.push(ENEMY.respawnDelay);
      const item = rollDrop({
        itemLevel: enemy.level,
        jobId: this.player.jobId,
        dropRate: enemy.def.dropRate,
        rarityBonus: rarityBonus(),
      });
      if (item) this.spawnDrop(item, enemy.x, enemy.y);
    }
  }

  /** ボス撃破：消える演出のあと確定ドロップとイベント */
  private onBossDefeated(boss: Enemy) {
    const def = boss.def;
    setFlag(`defeated_${def.id}`);
    this.cameras.main.flash(400, 255, 255, 255);
    this.time.addEvent({
      delay: 120,
      repeat: Math.floor((BOSS.deathTime * 1000) / 120),
      callback: () => this.sparks.explode(6, boss.x + (Math.random() - 0.5) * 24, boss.y + (Math.random() - 0.5) * 20),
    });
    this.time.delayedCall(BOSS.deathTime * 1000, () => {
      const loot = def.boss!.loot;
      for (let i = 0; i < loot.count; i++) {
        const item = createRandomItem(
          { itemLevel: boss.level, jobId: this.player.jobId, rarityBonus: rarityBonus() },
          loot.minRarity,
        );
        if (item) this.spawnDrop(item, boss.x, boss.y);
      }
      this.boss = null;
      this.playStory({ type: 'bossDefeated', boss: def.id });
    });
  }

  private lockWarnAt = 0;

  protected canLeave(): boolean {
    if (!this.boss?.alive) return true;
    if (this.time.now > this.lockWarnAt) {
      EventBus.emit(GameEvents.Toast, '強い気配に阻まれて、ここから出られない！', '#ef7d57');
      this.lockWarnAt = this.time.now + 2500;
    }
    return false;
  }

  protected dropStoryItem(item: ItemInstance) {
    this.spawnDrop(item, this.player.x, this.player.y - 20);
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
    const b = this.boss;
    HudState.boss = b && b.alive ? { name: b.def.name, hp: b.hp, maxHp: b.maxHp } : null;
  }

  private drawHpBars() {
    const g = this.hpBars;
    g.clear();
    for (const e of this.liveEnemies) {
      if (e.hp >= e.maxHp || e.isBoss) continue;
      const w = 12;
      const x = Math.round(e.x - w / 2);
      const y = Math.round(e.y - 10);
      g.fillStyle(0x1a1c2c, 1).fillRect(x - 1, y - 1, w + 2, 3);
      g.fillStyle(0xb13e53, 1).fillRect(x, y, Math.max(1, Math.round((w * e.hp) / e.maxHp)), 1);
    }
  }
}
