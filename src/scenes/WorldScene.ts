import Phaser from 'phaser';
import { PLAYER } from '../config/balance';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { HudState } from '../core/HudState';
import { SaveManager } from '../core/SaveManager';
import type { AreaDef, DialogLine, ExitDef, ItemInstance, StoryEventDef, StoryTrigger } from '../core/types';
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
import { addToInventory } from '../systems/Equipment';
import { createItem } from '../systems/Items';
import { buildAreaMap, type BuiltMap } from '../systems/MapBuilder';
import { completeEvent, currentLoop, enemyLevel, findEvent, linesForLoop } from '../systems/Story';
import { OVERLAY_OPEN_KEY, openOverlay, WORLD_SCENE_KEY } from '../ui/overlay';

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
    this.registry.set(OVERLAY_OPEN_KEY, false);
    if (this.scene.isActive('UI') || this.scene.isSleeping('UI')) this.scene.get('UI').scene.restart();
    else this.scene.launch('UI');
    this.scene.bringToTop('UI');
    this.createObjects();

    // UIScene の create が終わってから初期値を通知し、エリアに入ったときのイベントを起こす
    this.time.delayedCall(0, () => {
      this.emitHp();
      EventBus.emit(GameEvents.Toast, this.area.name, '#f4f4f4');
    });
    // 画面が明るくなりきってから、エリアに入ったときのイベント
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.playStory({ type: 'areaEnter', area: this.area.id });
    });
  }

  // ------------------------------------------------------------ ストーリー

  /** 調べられる物（近づくと自動でイベント） */
  private objects: { id: string; img: Phaser.GameObjects.Image; touched: boolean }[] = [];

  private createObjects() {
    this.objects = [];
    const loop = currentLoop();
    for (const def of this.area.objects ?? []) {
      if ((def.minLoop ?? 1) > loop || loop > (def.maxLoop ?? Infinity)) continue;
      const pos = this.map.markers.get(def.marker)?.[0];
      if (!pos) continue;
      const img = this.add.image(pos.x, pos.y, def.sprite, 0).setDepth(pos.y);
      this.add.image(pos.x, pos.y + 6, 'shadow_wide', 0).setAlpha(0.3).setDepth(pos.y - 1);
      this.objects.push({ id: def.id, img, touched: false });
    }
  }

  private updateObjects() {
    for (const o of this.objects) {
      if (o.touched) continue;
      if (Math.hypot(o.img.x - this.player.x, o.img.y - this.player.y) < 20) {
        o.touched = true;
        this.playStory({ type: 'touch', object: o.id });
      }
    }
  }

  /**
   * きっかけに合うストーリーイベントを再生する。
   * 同じきっかけで続けて起こるイベントがあれば順に再生し、最後に onDone を呼ぶ。
   * 何も起きなければ false（onDone は呼ばない）
   */
  playStory(trigger: StoryTrigger, onDone?: (last?: StoryEventDef) => void, played = new Set<string>()): boolean {
    const ev = findEvent(trigger);
    // 同じ連鎖の中で同じイベントは2回再生しない（何度でも起きるイベント対策）
    if (!ev || played.has(ev.id)) return false;
    played.add(ev.id);
    this.playLines(ev.lines, () => {
      completeEvent(ev);
      this.runThen(ev, () => {
        if (!this.playStory(trigger, onDone, played)) onDone?.(ev);
      });
    });
    return true;
  }

  /** 会話を再生（フィールド／町は止まる） */
  playLines(lines: DialogLine[], onDone?: () => void) {
    const filtered = linesForLoop(lines);
    if (filtered.length === 0) {
      onDone?.();
      return;
    }
    openOverlay(this, 'Dialog', { lines: filtered, onComplete: onDone });
  }

  private runThen(ev: StoryEventDef, next: () => void) {
    const then = ev.then;
    if (!then || then.type === 'npcMenu') return next();
    switch (then.type) {
      case 'chapterClear':
        openOverlay(this, 'ChapterClear', { chapter: gameState.story.chapter });
        return;
      case 'goTo':
        this.goToArea(then.area, then.arrive);
        return;
      case 'dropItem':
        this.dropStoryItem(createItem(then.baseId, then.rarity, enemyLevel(this.area.level)));
        return next();
    }
  }

  /** イベントで手に入る装備（フィールドでは足元に落とす） */
  protected dropStoryItem(item: ItemInstance) {
    if (addToInventory(item)) EventBus.emit(GameEvents.ItemPickedUp, item);
  }

  /** 各シーンの update から呼ぶ */
  protected updateWorld(dt: number) {
    HudState.attackEnabled = this.player.canAttack;
    HudState.skillsEnabled = this.player.canAttack;
    HudState.interactLabel = null;
    this.player.updatePlayer(dt, this);
    this.projectiles.update(dt);
    this.aoes.update(dt);
    if (!this.leaving && !this.player.dead) this.updateObjects();
    if (!this.leaving && !this.player.dead) {
      const exit = this.map.exitAt(this.player.x, this.player.y);
      if (exit && this.canLeave()) this.goTo(exit);
    }
  }

  /** 出入口から出られるか（ボス戦中は出られない） */
  protected canLeave(): boolean {
    return true;
  }

  /** 出入口を踏んだ */
  protected goTo(exit: ExitDef) {
    this.goToArea(exit.to, exit.arrive);
  }

  /** 別のエリアへ移動 */
  goToArea(areaId: string, arrive?: string) {
    if (this.leaving) return;
    this.leaving = true;
    InputState.reset();
    SaveManager.save();
    const target = AREAS[areaId];
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target.type === 'town' ? 'Town' : 'Field', { areaId: target.id, arrive });
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

  showAoeEffect(spec: AoeSpec) {
    if (spec.effect !== 'flame') return;
    // 範囲の広さに合わせた数の炎を、範囲内のランダムな位置に立ち上らせる
    const s = spec.shape;
    const area =
      s.type === 'circle' ? Math.PI * s.radius ** 2 : s.type === 'line' ? s.length * s.width : (Math.PI * s.radius ** 2 * s.angle) / 360;
    const count = Phaser.Math.Clamp(Math.round(area / 70), 6, 28);
    for (let i = 0; i < count; i++) {
      const p = AoeManager.randomPoint(spec);
      const scale = 1 + Math.random() * 0.6;
      const flame = this.add
        .sprite(Math.round(p.x), Math.round(p.y), 'fx_flame', 0)
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setAlpha(0)
        .setDepth(p.y + 5)
        .play('fx_flame_burn');
      flame.anims.setProgress(Math.random());
      this.tweens.add({
        targets: flame,
        alpha: { from: 1, to: 0 },
        y: p.y - 8 - Math.random() * 6,
        scaleX: scale * 0.6,
        delay: Math.random() * 120,
        duration: 380 + Math.random() * 260,
        ease: 'Quad.easeIn',
        onComplete: () => flame.destroy(),
      });
    }
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
