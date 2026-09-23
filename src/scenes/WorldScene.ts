import Phaser from 'phaser';
import { PLAYER } from '../config/balance';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { HudState } from '../core/HudState';
import { SaveManager } from '../core/SaveManager';
import type { AreaDef, ExitDef } from '../core/types';
import { viewport } from '../core/Viewport';
import { AREAS } from '../data/areas';
import type { Enemy } from '../entities/Enemy';
import { FloatingTextPool } from '../entities/FloatingTextPool';
import { Player } from '../entities/Player';
import { AoeManager } from '../entities/AoeManager';
import { ProjectileManager } from '../entities/ProjectileManager';
import { InputState } from '../input/InputState';
import { rollDamage } from '../systems/Combat';
import type { AoeSpec, CombatWorld, ProjectileSpec } from '../systems/CombatWorld';
import { buildAreaMap, type BuiltMap } from '../systems/MapBuilder';
import { WORLD_SCENE_KEY } from '../ui/overlay';

export interface WorldData {
  areaId: string;
  /** 出現位置の目印の文字（省略時 '@'） */
  arrive?: string;
}

/**
 * 町・フィールド共通の土台。
 * マップ・プレイヤー・カメラ・出入口・エフェクト・CombatWorld の基本実装を持つ。
 */
export abstract class WorldScene extends Phaser.Scene implements CombatWorld {
  player!: Player;
  protected area!: AreaDef;
  protected map!: BuiltMap;
  protected startPos = { x: 0, y: 0 };
  protected floatText!: FloatingTextPool;
  protected sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  protected projectiles!: ProjectileManager;
  protected aoes!: AoeManager;
  private arrive = '@';
  private leaving = false;

  get gameScene(): Phaser.Scene {
    return this;
  }

  init(data: WorldData) {
    this.area = AREAS[data.areaId];
    this.arrive = data.arrive ?? '@';
    this.leaving = false;
  }

  /** 各シーンの create の最初に呼ぶ */
  protected createWorld() {
    InputState.reset();
    this.map = buildAreaMap(this, this.area);
    const pos = this.map.markers.get(this.arrive)?.[0] ?? this.map.markers.get('@')?.[0] ?? this.map.walkable[0];
    this.startPos = { ...pos };

    this.player = new Player(this, pos.x, pos.y);
    this.player.setJob(gameState.currentJob);
    this.physics.add.collider(this.player, this.map.layer);

    this.floatText = new FloatingTextPool(this);
    this.sparks = this.add.particles(0, 0, 'fx_spark', {
      speed: { min: 30, max: 90 },
      lifespan: 280,
      scale: { start: 1, end: 0 },
      emitting: false,
    });
    this.sparks.setDepth(99998);
    this.projectiles = new ProjectileManager(this, this);
    this.aoes = new AoeManager(this, this);

    const cam = this.cameras.main;
    cam.setZoom(viewport.zoom).setRoundPixels(true).setBackgroundColor('#1a1c2c');
    cam.setBounds(0, 0, this.map.width, this.map.height);
    cam.startFollow(this.player, true, 0.2, 0.2);
    cam.fadeIn(250);

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
    const onJob = () => {
      this.player.setJob(gameState.currentJob);
      this.emitHp();
      this.showBlast(this.player.x, this.player.y, 16, 0xffffff);
    };
    const handlers: [string, (...args: any[]) => void][] = [
      [GameEvents.ViewportChanged, onViewport],
      [GameEvents.EquipmentChanged, onEquip],
      [GameEvents.LevelUp, onLevelUp],
      [GameEvents.JobChanged, onJob],
    ];
    handlers.forEach(([ev, fn]) => EventBus.on(ev, fn));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => handlers.forEach(([ev, fn]) => EventBus.off(ev, fn)));

    // 全画面メニューを閉じたときに戻る先として登録
    this.registry.set(WORLD_SCENE_KEY, this.scene.key);
    if (this.scene.isActive('UI') || this.scene.isSleeping('UI')) this.scene.get('UI').scene.restart();
    else this.scene.launch('UI');
    this.scene.bringToTop('UI');
    // UIScene の create が終わってから初期値を通知する
    this.time.delayedCall(0, () => {
      this.emitHp();
      EventBus.emit(GameEvents.Toast, this.area.name, '#f4f4f4');
    });
  }

  /** 各シーンの update から呼ぶ */
  protected updateWorld(dt: number) {
    HudState.attackEnabled = this.player.canAttack;
    HudState.skillsEnabled = this.player.canAttack;
    HudState.interactLabel = null;
    this.player.updatePlayer(dt, this);
    this.projectiles.update(dt);
    this.aoes.update(dt);
    if (!this.leaving && !this.player.dead) {
      const exit = this.map.exitAt(this.player.x, this.player.y);
      if (exit) this.goTo(exit);
    }
  }

  /** 別のエリアへ移動 */
  protected goTo(exit: ExitDef) {
    this.leaving = true;
    InputState.reset();
    SaveManager.save();
    const target = AREAS[exit.to];
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target.type === 'town' ? 'Town' : 'Field', { areaId: target.id, arrive: exit.arrive });
    });
  }

  protected emitHp() {
    EventBus.emit(GameEvents.PlayerHpChanged, this.player.hp, this.player.stats.maxHp);
  }

  // ------------------------------------------------------------ CombatWorld（敵がいないシーン用の既定実装）

  getLiveEnemies(): readonly Enemy[] {
    return [];
  }

  damageEnemy(_enemy: Enemy, _power: number, _fromX: number, _fromY: number): void {}

  damageArea(x: number, y: number, radius: number, power: number): number {
    let hits = 0;
    for (const e of [...this.getLiveEnemies()]) {
      if (Math.hypot(e.x - x, e.y - y) <= radius + e.radius) {
        this.damageEnemy(e, power, x, y);
        hits++;
      }
    }
    return hits;
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

  spawnAoe(spec: AoeSpec) {
    this.aoes.spawn(spec);
  }

  spawnProjectile(spec: ProjectileSpec) {
    this.projectiles.spawn(spec);
  }

  showBlast(x: number, y: number, radius: number, color: number) {
    const fx = this.add
      .sprite(x, y, 'fx_blast', 0)
      .setTint(color)
      .setScale(radius / 15)
      .setAlpha(0.85)
      .setDepth(y + 30);
    let frame = 0;
    this.time.addEvent({
      delay: 50,
      repeat: 2,
      callback: () => {
        frame++;
        if (frame > 2) fx.destroy();
        else fx.setFrame(frame);
      },
    });
  }

  isWall(x: number, y: number): boolean {
    return this.map.isWall(x, y);
  }

  protected onPlayerDied() {
    EventBus.emit(GameEvents.PlayerDied);
    this.tweens.add({ targets: this.player, alpha: 0.2, angle: 90, duration: 400 });
    this.time.delayedCall(PLAYER.respawnTime * 1000, () => {
      this.player.revive(this.startPos.x, this.startPos.y);
      this.emitHp();
    });
  }
}
