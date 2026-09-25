import Phaser from 'phaser';
import { PLAYER, WATER } from '../config/balance';
import { DebugState } from '../core/DebugState';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { HudState } from '../core/HudState';
import { SaveManager } from '../core/SaveManager';
import type { AreaDef, AreaObjectDef, DialogLine, ExitDef, ItemInstance, Rarity, StoryEventDef, StoryTrigger } from '../core/types';
import { viewport } from '../core/Viewport';
import { AREAS } from '../data/areas';
import type { Enemy } from '../entities/Enemy';
import { FloatingTextPool } from '../entities/FloatingTextPool';
import { Player } from '../entities/Player';
import { AoeManager } from '../entities/AoeManager';
import { HazardManager } from '../entities/HazardManager';
import { SweepManager } from '../entities/SweepManager';
import { WaterManager } from '../entities/WaterManager';
import { PitManager } from '../entities/PitManager';
import { FieldGimmicks, memoryFlash } from '../systems/FieldGimmicks';
import type { FieldGimmickDef } from '../core/types';
import { ProjectileManager } from '../entities/ProjectileManager';
import { InputState } from '../input/InputState';
import { rollDamage } from '../systems/Combat';
import type { AoeSpec, CombatWorld, HazardSpec, ProjectileSpec, SweepSpec } from '../systems/CombatWorld';
import { addToInventory } from '../systems/Equipment';
import { createItem } from '../systems/Items';
import { buildAreaMap, type BuiltMap } from '../systems/MapBuilder';
import { completeEvent, currentLoop, enemyLevel, findEvent, hasFlag, linesForLoop, setFlag } from '../systems/Story';
import { OVERLAY_OPEN_KEY, openOverlay, WORLD_SCENE_KEY } from '../ui/overlay';
import { Sfx } from '../ui/sfx';
import { createText } from '../ui/text';

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
  protected water!: WaterManager;
  protected sweeps!: SweepManager;
  protected pits!: PitManager;
  /** 最終章のフィールドのしかけ */
  protected gimmicks: FieldGimmicks | null = null;
  /** 最後に立っていた安全な場所（穴に落ちたときに戻る） */
  private lastSafe = { x: 0, y: 0 };
  /** 最後にボスを倒した位置（イベントで物を出すときに使う） */
  protected lastBossPos: { x: number; y: number } | null = null;
  private arrive = '@';
  private leaving = false;
  /** 時間が止まっているときのモノクロ */
  private timeFx: Phaser.FX.ColorMatrix | null = null;

  get gameScene(): Phaser.Scene {
    return this;
  }

  init(data: WorldData) {
    this.area = AREAS[data.areaId];
    this.arrive = data.arrive ?? '@';
    this.leaving = false;
    this.timeFx = null;
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
    this.water = new WaterManager(this, this.map.width, this.map.height);
    this.sweeps = new SweepManager(this, this);
    this.pits = new PitManager(this, this);
    this.lastSafe = { ...pos };
    this.gimmicks = this.area.gimmicks ? new FieldGimmicks(this, this.area.gimmicks) : null;
    if (this.area.riftExits) this.drawRifts();
    // 満ち引きする潮だまり
    if (this.area.tideMarker) for (const pos of this.map.markers.get(this.area.tideMarker) ?? []) this.water.addTide(pos.x, pos.y);

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
    const onLevelUp = (level: number, points = 0) => {
      this.player.recalcStats(true);
      this.emitHp();
      this.floatText.show(this.player.x, this.player.y - 12, `LEVEL UP! Lv${level}`, '#a7f070', true);
      this.sparks.explode(20, this.player.x, this.player.y);
      if (points > 0) {
        this.time.delayedCall(350, () => this.floatText.show(this.player.x, this.player.y - 12, `ステータスポイント +${points}`, '#ffd23f', true));
        EventBus.emit(GameEvents.Toast, `ステータスポイント +${points}（右上のボタンで振り分け）`, '#ffd23f');
      }
    };
    const onJob = () => {
      this.player.setJob(gameState.currentJob);
      this.emitHp();
      this.showBlast(this.player.x, this.player.y, 16, 0xffffff);
    };
    const handlers: [string, (...args: any[]) => void][] = [
      [GameEvents.ViewportChanged, onViewport],
      [GameEvents.EquipmentChanged, onEquip],
      [GameEvents.StatsChanged, onEquip],
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
    // 時間が止まった世界（NPC などを置き終えてから止める）
    if (this.area.frozenWhen && hasFlag(this.area.frozenWhen)) this.time.delayedCall(0, () => this.stopTime());

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
  private objects: {
    def: AreaObjectDef;
    img: Phaser.GameObjects.Image;
    shadow: Phaser.GameObjects.Image;
    touched: boolean;
    chestFlag: string;
    hiding: boolean;
  }[] = [];

  private createObjects() {
    this.objects = [];
    const loop = currentLoop();
    for (const def of this.area.objects ?? []) {
      if (def.hidden) continue;
      if ((def.minLoop ?? 1) > loop || loop > (def.maxLoop ?? Infinity)) continue;
      // 同じ文字を複数置けば、すべての位置に置く
      for (const pos of this.map.markers.get(def.marker) ?? []) this.placeObject(def, pos.x, pos.y);
    }
  }

  /** 物を1つ置く（宝箱は開いていれば開いた絵で） */
  protected placeObject(def: AreaObjectDef, x: number, y: number) {
    const img = def.solid ? this.physics.add.staticImage(x, y, def.sprite, 0) : this.add.image(x, y, def.sprite, 0);
    img.setDepth(y + img.height * 0.3);
    if (def.solid) this.physics.add.collider(this.player, img as Phaser.Physics.Arcade.Image);
    const shadow = img.width > 16 ? 1.6 : 1;
    const shadowImg = this.add
      .image(x, y + img.height * 0.4, 'shadow_wide', 0)
      .setScale(shadow)
      .setAlpha(0.3)
      .setDepth(y - 1);
    const index = this.objects.filter((o) => o.def.id === def.id).length;
    const chestFlag = `chest_${this.area.id}_${def.id}_${index}`;
    const opened = !!def.loot && hasFlag(chestFlag);
    if (opened) img.setFrame(1);
    if (def.hideWhen && hasFlag(def.hideWhen)) {
      img.setVisible(false);
      shadowImg.setVisible(false);
      if (img.body) (img.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    }
    const gone = !!def.hideWhen && hasFlag(def.hideWhen);
    this.objects.push({ def, img, shadow: shadowImg, touched: opened || gone, chestFlag, hiding: gone });
  }

  private refreshObjectFrames() {
    for (const o of this.objects) {
      const fw = o.def.frameWhen;
      if (fw) o.img.setFrame(hasFlag(fw.flag) ? fw.frame : 0);
      // 消える物（記憶の結晶など）：光って消える
      if (o.def.hideWhen && hasFlag(o.def.hideWhen) && o.img.visible && !o.hiding) {
        o.hiding = true;
        o.touched = true;
        this.sparks.explode(10, o.img.x, o.img.y);
        this.tweens.add({ targets: [o.img, o.shadow], alpha: 0, duration: 500, onComplete: () => { o.img.setVisible(false); o.shadow.setVisible(false); } });
      }
    }
  }

  private updateObjects() {
    for (const o of this.objects) {
      // 大きな物（ぶつかる装置など）は、ふちまで近づけば調べられる
      const reach = Math.max(20, Math.max(o.img.width, o.img.height) / 2 + 10);
      const dist = Math.hypot(o.img.x - this.player.x, o.img.y - this.player.y);
      if (o.touched) {
        // 離れたら、もう一度調べられる（宝箱・消えた物は除く）
        if (!o.def.loot && !o.hiding && dist > reach + 14) o.touched = false;
        continue;
      }
      if (dist < reach) {
        if (o.def.loot) {
          // 宝箱：開けて装備を出す（1周に1回）
          o.touched = true;
          o.img.setFrame(1);
          setFlag(o.chestFlag);
          this.dropLootAt(o.img.x, o.img.y + 10, o.def.loot.minRarity);
          continue;
        }
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
        openOverlay(this, 'ChapterClear', { chapter: then.chapter ?? gameState.story.chapter });
        return;
      case 'clockBreak':
        this.clockBreak(next);
        return;
      case 'collapse':
        this.collapse(next);
        return;
      case 'titleCard':
        openOverlay(this, 'TitleCard', {
          title: then.title,
          subtitle: then.subtitle,
          onComplete: () => this.goToArea(then.area, then.arrive),
        });
        return;
      case 'goTo':
        // イベントで別の場所へ運ばれるときは、落ちている装備を拾ってから
        this.collectDrops();
        this.goToArea(then.area, then.arrive);
        return;
      case 'dropItem':
        this.dropStoryItem(createItem(then.baseId, then.rarity, enemyLevel(this.area.level)));
        return next();
      case 'flashback':
        openOverlay(this, 'Flashback', { onComplete: next, variant: then.variant, cut: then.cut, captions: then.captions });
        return;
      case 'spawnBoss':
        this.spawnBossNow(then.boss);
        return next();
      case 'loopChoice':
        openOverlay(this, 'Choice', { question: then.question, onComplete: next });
        return;
      case 'ending':
        this.collectDrops();
        SaveManager.save();
        this.scene.stop('UI');
        this.scene.start('Ending');
        return;
      case 'spawnObject': {
        const def = this.area.objects?.find((o) => o.id === then.object);
        if (def) {
          const pos = this.lastBossPos ?? { x: this.player.x, y: this.player.y - 30 };
          this.placeObject(def, pos.x, pos.y);
        }
        return next();
      }
    }
  }

  // ------------------------------------------------------------ 第4章の演出

  /** 時間が止まる：画面がモノクロになり、主人公以外の動きが止まる */
  protected stopTime() {
    const cam = this.cameras.main;
    if (!this.timeFx && this.game.renderer.type === Phaser.WEBGL) {
      this.timeFx = cam.postFX.addColorMatrix();
      this.timeFx.grayscale(1);
    }
    for (const o of this.children.list) {
      if (o instanceof Phaser.GameObjects.Sprite && o !== this.player) o.anims.pause();
    }
  }

  /** 巨大な時計が現れて砕け散り、時間が止まる */
  private clockBreak(next: () => void) {
    const pos = this.lastBossPos ?? { x: this.player.x, y: this.player.y - 40 };
    const cam = this.cameras.main;
    const clock = this.add.image(pos.x, pos.y - 16, 'big_clock', 0).setAlpha(0).setScale(1.5).setDepth(pos.y + 200);
    this.tweens.add({ targets: clock, alpha: 1, duration: 500 });
    this.time.delayedCall(1100, () => {
      cam.shake(600, 0.012);
      cam.flash(300, 255, 255, 255);
      Sfx.boom(0.6);
      // 砕けた破片
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
        const d = 30 + Math.random() * 50;
        const shard = this.add
          .image(clock.x, clock.y, 'fx_crystal_shard', 0)
          .setTint(i % 3 ? 0xffcd75 : 0xf4f4f4)
          .setDepth(clock.depth + 1);
        this.tweens.add({
          targets: shard,
          x: clock.x + Math.cos(a) * d,
          y: clock.y + Math.sin(a) * d + 20,
          angle: (Math.random() - 0.5) * 540,
          alpha: 0,
          duration: 900 + Math.random() * 400,
          ease: 'Quad.easeOut',
          onComplete: () => shard.destroy(),
        });
      }
      clock.destroy();
      this.sparks.explode(24, pos.x, pos.y - 16);
    });
    // 音が消え、時間が止まる
    this.time.delayedCall(1700, () => {
      Sfx.chime();
      this.stopTime();
    });
    this.time.delayedCall(2600, next);
  }

  /** 世界の崩壊：景色も人も、光の粒になって消えていく。主人公の FIT だけが残る */
  private collapse(next: () => void) {
    const cam = this.cameras.main;
    if (this.timeFx) {
      cam.postFX.remove(this.timeFx as unknown as Phaser.FX.Controller);
      this.timeFx = null;
    }
    cam.flash(500, 255, 255, 255);
    cam.shake(3000, 0.003);
    Sfx.boom(0.6);
    const view = cam.worldView;
    const motes = this.add
      .particles(0, 0, 'fx_spark', {
        x: { min: view.x, max: view.right },
        y: { min: view.y, max: view.bottom },
        lifespan: 1400,
        speedY: { min: -50, max: -15 },
        speedX: { min: -10, max: 10 },
        scale: { start: 1, end: 0 },
        tint: [0xffffff, 0xffcd75, 0x73eff7],
        frequency: 16,
        quantity: 3,
      })
      .setDepth(99990);
    const keep = new Set<Phaser.GameObjects.GameObject>([this.player, motes, this.sparks]);
    for (const o of [...this.children.list]) {
      if (keep.has(o) || !('alpha' in o)) continue;
      const target = o as Phaser.GameObjects.GameObject & { alpha: number; x?: number; y?: number };
      const delay = Math.random() * 1800;
      this.tweens.add({
        targets: target,
        alpha: 0,
        delay,
        duration: 900,
        onStart: () => {
          if (typeof target.x === 'number' && typeof target.y === 'number' && target.x > 0) this.sparks.explode(4, target.x, target.y);
        },
      });
    }
    this.time.delayedCall(2600, () => cam.setBackgroundColor('#000000'));
    this.time.delayedCall(3400, () => {
      motes.stop();
      next();
    });
  }

  /** 落ちている装備をすべて拾う（フィールドのみ） */
  protected collectDrops() {}

  /** その場にボスを出す（フィールドのみ） */
  protected spawnBossNow(_id: string) {}

  /** 宝箱の中身（フィールドでは地面に落とす） */
  protected dropLootAt(_x: number, _y: number, _minRarity: Rarity) {}

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
    this.water.update(dt);
    this.sweeps.update(dt);
    this.pits.update(dt);
    this.gimmicks?.update(dt);
    const pl = this.player;
    if (!pl.dead && !this.pits.isDanger(pl.x, pl.y) && !this.map.isWall(pl.x, pl.y)) {
      this.lastSafe.x = pl.x;
      this.lastSafe.y = pl.y;
    }
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

  spawnWater(x: number, y: number, radius: number, duration: number) {
    this.water.spawn(x, y, radius, duration);
  }

  moveMultiplierAt(x: number, y: number): number {
    return this.map.isSlow(x, y) || this.water.contains(x, y) ? WATER.slowMultiplier : 1;
  }

  pushPlayer(vx: number, vy: number) {
    this.player.push(vx, vy);
  }

  knockPlayer(vx: number, vy: number, time: number) {
    if (DebugState.invincible || this.player.dead) return;
    this.player.knockBack(vx, vy, time);
  }

  startSweep(spec: SweepSpec) {
    this.sweeps.start(spec);
  }

  /** 渦巻きの腕が回る演出 */
  vortexEffect(x: number, y: number, dir: number, duration: number) {
    const g = this.add.graphics().setDepth(-4996);
    const t = { a: 0 };
    this.tweens.add({
      targets: t,
      a: 1,
      duration: duration * 1000,
      onUpdate: () => {
        g.clear();
        const fade = Math.min(1, t.a * 4, (1 - t.a) * 4);
        for (let arm = 0; arm < 4; arm++) {
          const pts: { x: number; y: number }[] = [];
          for (let i = 0; i <= 24; i++) {
            const r = 8 + i * 6;
            const ang = dir * (t.a * 8 + i * 0.22) + (arm * Math.PI) / 2;
            pts.push({ x: x + Math.cos(ang) * r, y: y + Math.sin(ang) * r });
          }
          g.lineStyle(2, 0x73eff7, 0.45 * fade).strokePoints(pts);
        }
      },
      onComplete: () => g.destroy(),
    });
  }

  /** 頭上の吹き出し（戦闘は止めない） */
  showFloat(x: number, y: number, text: string, color: string) {
    this.floatText.show(x, y, text, color, true);
  }

  showSpeech(x: number, y: number, text: string) {
    const t = createText(this, x, y - 16, text, 6, '#f4f4f4', { backgroundColor: '#1a1c2ccc', padding: { x: 2, y: 1 } })
      .setOrigin(0.5, 1)
      .setDepth(100001);
    this.tweens.add({ targets: t, y: y - 20, alpha: 0, delay: 2000, duration: 400, onComplete: () => t.destroy() });
  }

  spawnHazard(spec: HazardSpec) {
    this.hazards.spawn(spec);
  }

  showAoeEffect(spec: AoeSpec) {
    if (spec.effect === 'meteor') return this.showMeteor(spec);
    if (spec.effect === 'finale') return this.showFinale(spec);
    if (spec.effect === 'splash') return this.showSplash(spec);
    if (spec.effect === 'crystal') return this.showCrystal(spec);
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

  /** 水しぶき：青い爆発と、飛び散る水滴 */
  private showSplash(spec: AoeSpec) {
    const r = spec.shape.type === 'circle' ? spec.shape.radius : 20;
    this.showBlast(spec.x, spec.y, r, 0x41a6f6);
    for (let i = 0; i < 8; i++) {
      const p = AoeManager.randomPoint(spec);
      const d = this.add.image(p.x, p.y, 'fx_pixel', 0).setScale(2).setTint(0x73eff7).setDepth(p.y + 30);
      this.tweens.add({ targets: d, y: p.y - 10 - Math.random() * 8, alpha: 0, duration: 300 + Math.random() * 200, onComplete: () => d.destroy() });
    }
  }

  /** 水晶が上空から落ちて砕ける */
  private showCrystal(spec: AoeSpec) {
    const r = spec.shape.type === 'circle' ? spec.shape.radius : 16;
    const shard = this.add.image(spec.x, spec.y - 60, 'fx_crystal_shard', 0).setDepth(spec.y + 40);
    this.tweens.add({
      targets: shard,
      y: spec.y,
      duration: 110,
      onComplete: () => {
        shard.destroy();
        this.showBlast(spec.x, spec.y, r, 0x73eff7);
        this.sparks.explode(5, spec.x, spec.y);
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

  // ------------------------------------------------------------ 最終章（穴・しかけ）

  spawnPit(x: number, y: number, w: number, h: number, warn: number, open: number, lethal: boolean, power = 0) {
    this.pits.spawn(x, y, w, h, warn, open, lethal, power);
  }

  /** 穴に落ちた：即死、または大きなダメージを受けて直前の安全な場所へ */
  fallIntoPit(lethal: boolean, power: number) {
    const p = this.player;
    if (p.dead) return;
    this.tweens.add({ targets: p, scale: 0.2, alpha: 0.3, duration: 250 });
    this.time.delayedCall(260, () => {
      p.setScale(1).setAlpha(1);
      if (DebugState.invincible) {
        p.body.reset(this.lastSafe.x, this.lastSafe.y);
        return;
      }
      if (lethal) {
        EventBus.emit(GameEvents.Toast, '道路の下へ落ちた……', '#b13e53');
        if (p.applyDamage(p.hp, true)) this.onPlayerDied();
        this.emitHp();
        return;
      }
      const amount = Math.max(1, Math.round(Math.max(power, p.stats.maxHp * 0.2)));
      const died = p.applyDamage(amount, true);
      this.floatText.show(p.x, p.y - 8, `${amount}`, '#b13e53');
      this.emitHp();
      if (died) this.onPlayerDied();
      else p.body.reset(this.lastSafe.x, this.lastSafe.y);
    });
  }

  memoryFlash(x: number, y: number, duration: number, label = true) {
    memoryFlash(this, x, y, duration, label);
  }

  setGimmicks(cfg: FieldGimmickDef) {
    if (this.gimmicks) this.gimmicks.setConfig(cfg);
    else this.gimmicks = new FieldGimmicks(this, cfg);
  }

  /** ボスを倒したことにする（フィールドのみ） */
  defeatEnemy(_enemy: Enemy) {}

  /** 歩ける床か（壁・出入口・消えかけの道路でない） */
  isWalkableFloor(x: number, y: number): boolean {
    return !this.map.isWall(x, y) && !this.map.exitAt(x, y) && !this.pits.isDanger(x, y);
  }

  /** 空中の何もない場所（道路から少し離れた闇）の候補 */
  voidSpots(): { x: number; y: number }[] {
    const ts = 16;
    const out: { x: number; y: number }[] = [];
    for (let y = ts / 2; y < this.map.height; y += ts) {
      for (let x = ts / 2; x < this.map.width; x += ts) {
        if (this.map.charAt(x, y) !== '0') continue;
        const near = [-2, 0, 2].some((dx) => [-2, 0, 2].some((dy) => !this.map.isWall(x + dx * ts, y + dy * ts)));
        if (!near) out.push({ x, y });
      }
    }
    return out;
  }

  /** フィールドのしかけの強さ（エリアのレベルの敵の攻撃力くらい） */
  gimmickPower(): number {
    return 22 * (1 + (enemyLevel(this.area.level) - 1) * 0.18);
  }

  /** 出入口を「時間の裂け目」として描く（渦を巻く紫と水色の光） */
  private drawRifts() {
    for (const t of this.map.exitTiles) {
      const g = this.add.graphics().setDepth(-9000);
      let a = Math.random() * Math.PI * 2;
      this.time.addEvent({
        delay: 50,
        loop: true,
        callback: () => {
          a += 0.25;
          g.clear();
          for (let i = 0; i < 3; i++) {
            const r = 7 - i * 2 + Math.sin(a + i) * 1;
            g.lineStyle(1, i % 2 ? 0x73eff7 : 0xc58cff, 0.9).strokeEllipse(t.x, t.y, r * 2, r * 2.6);
          }
          g.fillStyle(0xffffff, 0.8).fillCircle(t.x + Math.cos(a * 2) * 3, t.y + Math.sin(a * 2) * 4, 1);
        },
      });
    }
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
