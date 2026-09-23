import Phaser from 'phaser';
import { PLAYER } from '../config/balance';
import { DebugState } from '../core/DebugState';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { HudState } from '../core/HudState';
import { SaveManager } from '../core/SaveManager';
import type { AreaDef, AreaObjectDef, DialogLine, ExitDef, ItemInstance, StoryEventDef, StoryTrigger } from '../core/types';
import { viewport } from '../core/Viewport';
import { AREAS } from '../data/areas';
import type { Enemy } from '../entities/Enemy';
import { FloatingTextPool } from '../entities/FloatingTextPool';
import { Player } from '../entities/Player';
import { AoeManager } from '../entities/AoeManager';
import { HazardManager } from '../entities/HazardManager';
import { ProjectileManager } from '../entities/ProjectileManager';
import { InputState } from '../input/InputState';
import { rollDamage } from '../systems/Combat';
import type { AoeSpec, CombatWorld, HazardSpec, ProjectileSpec } from '../systems/CombatWorld';
import { addToInventory } from '../systems/Equipment';
import { createItem } from '../systems/Items';
import { buildAreaMap, type BuiltMap } from '../systems/MapBuilder';
import { completeEvent, currentLoop, enemyLevel, findEvent, hasFlag, linesForLoop } from '../systems/Story';
import { OVERLAY_OPEN_KEY, openOverlay, WORLD_SCENE_KEY } from '../ui/overlay';
import { Sfx } from '../ui/sfx';

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
  protected hazards!: HazardManager;
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
    if (this.area.chapter > gameState.story.chapter) {
      gameState.story.chapter = this.area.chapter;
      SaveManager.save();
    }
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
    this.hazards = new HazardManager(this, this);

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
    this.refreshObjectFrames();

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
  private objects: { def: AreaObjectDef; img: Phaser.GameObjects.Image; touched: boolean }[] = [];

  private createObjects() {
    this.objects = [];
    const loop = currentLoop();
    for (const def of this.area.objects ?? []) {
      if ((def.minLoop ?? 1) > loop || loop > (def.maxLoop ?? Infinity)) continue;
      // 同じ文字を複数置けば、すべての位置に置く
      for (const pos of this.map.markers.get(def.marker) ?? []) {
        const img = def.solid
          ? this.physics.add.staticImage(pos.x, pos.y, def.sprite, 0)
          : this.add.image(pos.x, pos.y, def.sprite, 0);
        img.setDepth(pos.y + img.height * 0.3);
        if (def.solid) this.physics.add.collider(this.player, img as Phaser.Physics.Arcade.Image);
        const shadow = img.width > 16 ? 1.6 : 1;
        this.add
          .image(pos.x, pos.y + img.height * 0.4, 'shadow_wide', 0)
          .setScale(shadow)
          .setAlpha(0.3)
          .setDepth(pos.y - 1);
        this.objects.push({ def, img, touched: false });
      }
    }
  }

  private refreshObjectFrames() {
    for (const o of this.objects) {
      const fw = o.def.frameWhen;
      if (fw) o.img.setFrame(hasFlag(fw.flag) ? fw.frame : 0);
    }
  }

  private updateObjects() {
    for (const o of this.objects) {
      if (o.touched) continue;
      if (Math.hypot(o.img.x - this.player.x, o.img.y - this.player.y) < 20) {
        // 同じ物が複数あっても、どれか1つに触れたら全部「触れた」扱い
        for (const other of this.objects) if (other.def.id === o.def.id) other.touched = true;
        this.playStory({ type: 'touch', object: o.def.id });
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
      // フラグで見た目が変わる物（大時計など）を、次の会話より前に描き替える
      this.refreshObjectFrames();
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
    this.hazards.update(dt);
    if (!this.leaving && !this.player.dead) this.updateObjects();
    if (!this.leaving && !this.player.dead) {
      const exit = this.map.exitAt(this.player.x, this.player.y);
      if (exit && exit.requires && !hasFlag(exit.requires)) this.warnLocked(exit.lockedText ?? 'この先へはまだ進めない');
      else if (exit && this.canLeave()) this.goTo(exit);
    }
  }

  private lockedWarnAt = 0;

  /** 通れない出入口のメッセージ（連続して出さない） */
  protected warnLocked(text: string) {
    if (this.time.now < this.lockedWarnAt) return;
    this.lockedWarnAt = this.time.now + 2500;
    EventBus.emit(GameEvents.Toast, text, '#94b0c2');
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

  damagePlayer(rawAtk: number, fromX: number, fromY: number, dot = false) {
    const p = this.player;
    if (DebugState.invincible) return;
    if (dot ? p.dead : p.isInvulnerable) return;
    const res = rollDamage({ atk: rawAtk, critRate: 0, critDamage: 0 }, 1, p.stats.def);
    const died = p.applyDamage(res.amount, dot);
    this.floatText.show(p.x, p.y - 8, `${res.amount}`, dot ? '#ef7d57' : '#b13e53');
    if (!dot) EventBus.emit(GameEvents.PlayerDamaged, res.amount, fromX, fromY);
    this.emitHp();
    if (died) this.onPlayerDied();
  }

  spawnAoe(spec: AoeSpec) {
    this.aoes.spawn(spec);
  }

  spawnProjectile(spec: ProjectileSpec) {
    this.projectiles.spawn(spec);
  }

  spawnHazard(spec: HazardSpec) {
    this.hazards.spawn(spec);
  }

  showAoeEffect(spec: AoeSpec) {
    if (spec.effect === 'meteor') return this.showMeteor(spec);
    if (spec.effect === 'finale') return this.showFinale(spec);
    if (spec.effect !== 'flame') return;
    // 範囲の広さに合わせた数の炎を、範囲内のランダムな位置に立ち上らせる
    const s = spec.shape;
    const area =
      s.type === 'circle'
        ? Math.PI * s.radius ** 2
        : s.type === 'line'
          ? s.length * s.width
          : s.type === 'cone'
            ? (Math.PI * s.radius ** 2 * s.angle) / 360
            : s.type === 'ring'
              ? Math.PI * (s.outer ** 2 - s.inner ** 2)
              : s.length * s.width * 4;
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

  /** 上空から光の柱が落ちてきて爆発 */
  private showMeteor(spec: AoeSpec) {
    const r = spec.shape.type === 'circle' ? spec.shape.radius : 16;
    const streak = this.add
      .image(spec.x, spec.y - 70, 'fx_pixel', 0)
      .setOrigin(0.5, 1)
      .setScale(3, 26)
      .setTint(0xffd23f)
      .setDepth(spec.y + 40);
    this.tweens.add({
      targets: streak,
      y: spec.y,
      duration: 90,
      onComplete: () => {
        streak.destroy();
        this.showBlast(spec.x, spec.y, r, 0xffd23f);
        this.sparks.explode(4, spec.x, spec.y);
      },
    });
  }

  /** 必殺技の大爆発：強い光・画面揺れ・効果音・何重もの爆発 */
  private showFinale(spec: AoeSpec) {
    const cam = this.cameras.main;
    cam.flash(500, 255, 255, 255);
    cam.shake(600, 0.012);
    Sfx.boom(1);
    const R = spec.shape.type === 'circle' ? spec.shape.radius : 120;
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 90, () => this.showBlast(spec.x, spec.y, (R * (i + 1)) / 4, i % 2 ? 0xffd23f : 0xef7d57));
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const d = R * (0.3 + Math.random() * 0.6);
      this.time.delayedCall(80 + Math.random() * 250, () =>
        this.showBlast(spec.x + Math.cos(a) * d, spec.y + Math.sin(a) * d, 14, 0xef7d57),
      );
    }
  }

  /** 時間停止：画面をモノクロ＋暗くし、狙った場所に時計盤を出す */
  timeStopEffect(duration: number, x: number, y: number) {
    const cam = this.cameras.main;
    Sfx.chime();
    // モノクロ（WebGL のときだけ）
    const fx = this.game.renderer.type === Phaser.WEBGL ? cam.postFX.addColorMatrix() : null;
    fx?.grayscale(1);
    // 暗い幕（画面に固定）
    const veil = this.add
      .rectangle(0, 0, cam.width / cam.zoom, cam.height / cam.zoom, 0x1a1c2c, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(90000);
    this.tweens.add({ targets: veil, fillAlpha: 0.35, duration: 150, yoyo: true, hold: Math.max(0, duration * 1000 - 300) });
    // 時計盤：目盛りと、ぐるりと回る針
    const clock = this.add.graphics().setDepth(90001);
    const R = 30;
    const t = { a: 0 };
    this.tweens.add({
      targets: t,
      a: 1,
      duration: duration * 1000,
      onUpdate: () => {
        clock.clear();
        clock.lineStyle(1, 0xf4f4f4, 0.8).strokeCircle(x, y, R + 4);
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          const inner = i % 3 === 0 ? R - 2 : R + 1;
          clock.lineBetween(
            x + Math.cos(ang) * inner,
            y + Math.sin(ang) * inner,
            x + Math.cos(ang) * (R + 4),
            y + Math.sin(ang) * (R + 4),
          );
        }
        const hand = -Math.PI / 2 + t.a * Math.PI * 2;
        clock.lineStyle(2, 0xffd23f, 1).lineBetween(x, y, x + Math.cos(hand) * (R - 4), y + Math.sin(hand) * (R - 4));
        const hour = -Math.PI / 2 + t.a * Math.PI * 0.5;
        clock.lineStyle(1, 0xf4f4f4, 1).lineBetween(x, y, x + Math.cos(hour) * (R - 12), y + Math.sin(hour) * (R - 12));
      },
      onComplete: () => {
        clock.destroy();
        veil.destroy();
        if (fx) cam.postFX.remove(fx as unknown as Phaser.FX.Controller);
      },
    });
  }

  /** 剣を地面に突き立てる：光る剣と、小さな揺れ */
  swordPlantEffect(x: number, y: number, duration: number) {
    const sword = this.add
      .image(x, y - 30, 'fx_pixel', 0)
      .setOrigin(0.5, 1)
      .setScale(3, 26)
      .setTint(0xf4f4f4)
      .setDepth(y + 20);
    this.tweens.add({ targets: sword, y: y + 6, duration: 120, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: sword, alpha: 0.4, duration: 200, yoyo: true, repeat: -1, delay: 150 });
    this.time.delayedCall(120, () => {
      this.cameras.main.shake(180, 0.006);
      this.showBlast(x, y, 16, 0xffd23f);
      Sfx.boom(0.3);
    });
    this.time.delayedCall(duration * 1000, () => {
      this.tweens.killTweensOf(sword);
      sword.destroy();
    });
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
