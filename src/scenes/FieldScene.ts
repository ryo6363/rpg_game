import Phaser from 'phaser';
import { DISPLAY, ENEMY, LOOT, PLAYER } from '../config/balance';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameState } from '../core/GameState';
import type { AreaDef, ItemInstance } from '../core/types';
import { viewport } from '../core/Viewport';
import { AREAS } from '../data/areas';
import { ENEMIES } from '../data/enemies';
import { MAPS } from '../data/maps';
import { MAP_MARKERS, TILE_TYPES } from '../data/tiles';
import { Enemy } from '../entities/Enemy';
import { FloatingTextPool } from '../entities/FloatingTextPool';
import { LootDrop } from '../entities/LootDrop';
import { Player } from '../entities/Player';
import { InputState } from '../input/InputState';
import { rollDamage } from '../systems/Combat';
import { addToInventory } from '../systems/Equipment';
import { rollDrop } from '../systems/LootGenerator';
import { gainExp, killExp } from '../systems/Progression';
import type { CombatWorld } from '../systems/CombatWorld';
import { RAINBOW } from '../ui/rarityStyle';

interface FieldData {
  areaId: string;
}

/** フィールド／ボスエリア共通のシーン。data/areas.ts の定義から構築する */
export class FieldScene extends Phaser.Scene implements CombatWorld {
  player!: Player;
  private area!: AreaDef;
  private enemies: Enemy[] = [];
  private liveEnemies: Enemy[] = [];
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private walkable: { x: number; y: number }[] = [];
  private startPos = { x: 0, y: 0 };
  private respawnTimers: number[] = [];
  private drops: LootDrop[] = [];
  private fullWarnAt = 0;
  private hpBars!: Phaser.GameObjects.Graphics;
  private floatText!: FloatingTextPool;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('Field');
  }

  get gameScene(): Phaser.Scene {
    return this;
  }

  init(data: FieldData) {
    this.area = AREAS[data.areaId ?? 'ch1_field1'];
    this.enemies = [];
    this.liveEnemies = [];
    this.respawnTimers = [];
    this.walkable = [];
    this.drops = [];
  }

  create() {
    InputState.reset();
    this.buildMap();

    this.player = new Player(this, this.startPos.x, this.startPos.y);
    this.player.setJob(gameState.currentJob);
    this.physics.add.collider(this.player, this.layer);

    this.enemyGroup = this.physics.add.group();
    for (let i = 0; i < this.area.maxEnemies; i++) {
      const e = new Enemy(this);
      this.enemies.push(e);
      this.enemyGroup.add(e);
    }
    this.physics.add.collider(this.enemyGroup, this.layer);
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);
    this.physics.add.collider(this.player, this.enemyGroup);
    for (let i = 0; i < this.area.maxEnemies; i++) this.spawnEnemy(true);

    this.hpBars = this.add.graphics().setDepth(99999);
    this.floatText = new FloatingTextPool(this);
    this.sparks = this.add.particles(0, 0, 'fx_spark', {
      speed: { min: 30, max: 90 },
      lifespan: 280,
      scale: { start: 1, end: 0 },
      emitting: false,
    });
    this.sparks.setDepth(99998);

    const cam = this.cameras.main;
    cam.setZoom(viewport.zoom).setRoundPixels(true).setBackgroundColor('#1a1c2c');
    cam.setBounds(0, 0, this.mapW, this.mapH);
    cam.startFollow(this.player, true, 0.2, 0.2);

    const onViewport = () => cam.setZoom(viewport.zoom);
    const onEquip = () => {
      this.player.recalcStats();
      this.emitHp();
    };
    const onLevelUp = (level: number) => {
      this.player.recalcStats(true);
      this.emitHp();
      this.floatText.show(this.player.x, this.player.y - 12, `LEVEL UP! Lv${level}`, '#a7f070', true);
      this.sparks.explode(20, this.player.x, this.player.y);
    };
    EventBus.on(GameEvents.ViewportChanged, onViewport);
    EventBus.on(GameEvents.EquipmentChanged, onEquip);
    EventBus.on(GameEvents.LevelUp, onLevelUp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(GameEvents.ViewportChanged, onViewport);
      EventBus.off(GameEvents.EquipmentChanged, onEquip);
      EventBus.off(GameEvents.LevelUp, onLevelUp);
    });

    if (!this.scene.isActive('UI')) this.scene.launch('UI');
    this.scene.bringToTop('UI');
    // UIScene の create が終わってから初期値を通知する
    this.time.delayedCall(0, () => this.emitHp());
  }

  // ------------------------------------------------------------ マップ

  private layer!: Phaser.Tilemaps.TilemapLayer;
  private mapW = 0;
  private mapH = 0;

  private buildMap() {
    const padX = DISPLAY.mapPadX;
    const padY = DISPLAY.mapPadY;
    const src = MAPS[this.area.map];
    const wall = MAP_MARKERS.border;
    const fullW = src[0].length + padX * 2;
    const rows = [
      ...Array.from({ length: padY }, () => wall.repeat(fullW)),
      ...src.map((r) => wall.repeat(padX) + r + wall.repeat(padX)),
      ...Array.from({ length: padY }, () => wall.repeat(fullW)),
    ];
    const ts = DISPLAY.tileSize;
    const charToIndex = new Map(TILE_TYPES.map((t, i) => [t.char, i]));
    const data = rows.map((row, y) =>
      [...row].map((ch, x) => {
        if (ch === MAP_MARKERS.playerStart) {
          this.startPos = { x: x * ts + ts / 2, y: y * ts + ts / 2 };
          return 0;
        }
        return charToIndex.get(ch) ?? 0;
      }),
    );
    data.forEach((row, y) =>
      row.forEach((idx, x) => {
        if (!TILE_TYPES[idx].collide) this.walkable.push({ x: x * ts + ts / 2, y: y * ts + ts / 2 });
      }),
    );

    const map = this.make.tilemap({ data, tileWidth: ts, tileHeight: ts });
    const tileset = map.addTilesetImage('tiles', 'tiles', ts, ts, 0, 0)!;
    this.layer = map.createLayer(0, tileset, 0, 0)!;
    this.layer.setCollision(TILE_TYPES.flatMap((t, i) => (t.collide ? [i] : [])));
    this.layer.setDepth(-10000);
    this.mapW = map.widthInPixels;
    this.mapH = map.heightInPixels;
    this.physics.world.setBounds(0, 0, this.mapW, this.mapH);
  }

  // ------------------------------------------------------------ 敵の出現

  private spawnEnemy(initial = false) {
    const e = this.enemies.find((en) => !en.active);
    if (!e) return;
    // プレイヤーから一定以上離れた場所
    const minD = initial ? 80 : ENEMY.respawnMinDistance;
    let pos = this.walkable[0];
    for (let tries = 0; tries < 30; tries++) {
      pos = Phaser.Utils.Array.GetRandom(this.walkable);
      if (Math.hypot(pos.x - this.player.x, pos.y - this.player.y) >= minD) break;
    }
    const def = ENEMIES[this.pickEnemyId()];
    e.spawn(def, pos.x, pos.y, this.area.level);
  }

  private pickEnemyId(): string {
    const list = this.area.enemies;
    const total = list.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const e of list) {
      r -= e.weight;
      if (r <= 0) return e.id;
    }
    return list[0].id;
  }

  // ------------------------------------------------------------ CombatWorld

  getLiveEnemies(): readonly Enemy[] {
    return this.liveEnemies;
  }

  damageEnemy(enemy: Enemy, power: number, fromX: number, fromY: number) {
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

  damagePlayer(rawAtk: number, fromX: number, fromY: number) {
    const p = this.player;
    if (p.isInvulnerable) return;
    const res = rollDamage({ atk: rawAtk, critRate: 0, critDamage: 0 }, 1, p.stats.def);
    const died = p.applyDamage(res.amount);
    this.floatText.show(p.x, p.y - 8, `${res.amount}`, '#b13e53');
    EventBus.emit(GameEvents.PlayerDamaged, res.amount, fromX, fromY);
    this.emitHp();
    if (died) this.onPlayerDied();
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

  private onPlayerDied() {
    EventBus.emit(GameEvents.PlayerDied);
    this.tweens.add({ targets: this.player, alpha: 0.2, angle: 90, duration: 400 });
    this.time.delayedCall(PLAYER.respawnTime * 1000, () => {
      this.player.revive(this.startPos.x, this.startPos.y);
      this.emitHp();
    });
  }

  private emitHp() {
    EventBus.emit(GameEvents.PlayerHpChanged, this.player.hp, this.player.stats.maxHp);
  }

  // ------------------------------------------------------------ 毎フレーム

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;

    this.liveEnemies.length = 0;
    for (const e of this.enemies) if (e.alive) this.liveEnemies.push(e);

    this.player.updatePlayer(dt, this);
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
