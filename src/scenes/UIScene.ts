import Phaser from 'phaser';
import { CONTROLS, DISPLAY, EXP } from '../config/balance';
import { DebugState } from '../core/DebugState';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { HudState } from '../core/HudState';
import type { ItemInstance } from '../core/types';
import { viewport } from '../core/Viewport';
import { JOBS } from '../data/jobs';
import { ActionButtons } from '../input/ActionButtons';
import { InputState } from '../input/InputState';
import { VirtualStick } from '../input/VirtualStick';
import { expToNext } from '../systems/Progression';
import { OVERLAY_OPEN_KEY, openOverlay } from '../ui/overlay';
import { applyColor, rarityTextColor } from '../ui/rarityStyle';
import { createText } from '../ui/text';
import { statPointsOf } from '../systems/StatPoints';

/** HUD と操作系。フィールドの上に常に重ねて表示する */
export class UIScene extends Phaser.Scene {
  private stick!: VirtualStick;
  private buttons!: ActionButtons;
  private attackIndex = 0;
  private gasIndex = 0;
  private gasCountText!: Phaser.GameObjects.Text;
  private skillIndices: number[] = [];
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private expBar!: Phaser.GameObjects.Graphics;
  private bagButton = { x: 0, y: 0, r: 0 };
  private statusButton = { x: 0, y: 0, r: 0 };
  private pointBadge!: Phaser.GameObjects.Container;
  private pointBadgeText!: Phaser.GameObjects.Text;
  private shownPoints = -1;
  private toasts: Phaser.GameObjects.Text[] = [];
  private toastY = 0;
  private bossName!: Phaser.GameObjects.Text;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossBarWidth = 0;
  /** ボスの技の名前（HP バーの上・右寄せ） */
  private bossAttack!: Phaser.GameObjects.Text;
  private shownAttack: string | null = null;
  private bossAttackBand!: Phaser.GameObjects.Graphics;
  /** 技が終わってから名前を消すまでの残り時間（連続攻撃の合間でちらつかないように） */
  private attackHold = 0;
  private fpsText?: Phaser.GameObjects.Text;
  /** 再起動（画面サイズ変更）後も表示を保つため static */
  private static hp = { cur: 1, max: 1 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super('UI');
  }

  create() {
    this.toasts = [];
    const vp = viewport;
    const { width: W, height: H, safe } = vp;
    this.cameras.main.setZoom(vp.zoom).setOrigin(0, 0);

    // ---- HUD
    const hudX = safe.left + 6;
    const hudY = safe.top + 6;
    this.levelText = createText(this, hudX, hudY, '', 8);
    this.hpBar = this.add.graphics();
    this.hpText = createText(this, hudX + 2, hudY + 12, '', 6).setDepth(1);
    this.hpBar.setPosition(hudX, hudY + 11);
    this.expBar = this.add.graphics().setPosition(hudX, hudY + 21);
    this.drawLevel();
    if (DISPLAY.showFps) this.fpsText = createText(this, W - safe.right - 4, hudY, '', 6, '#94b0c2').setOrigin(1, 0);
    if (DebugState.invincible) createText(this, hudX + 70, hudY + 1, '無敵', 6, '#ef7d57');

    // 持ち物ボタン（右上）
    this.bagButton = { x: W - safe.right - 14, y: hudY + 18, r: 11 };
    this.add.circle(this.bagButton.x, this.bagButton.y, 10, 0x1a1c2c, 0.6).setStrokeStyle(1, 0xf4f4f4, 0.6);
    this.add.image(this.bagButton.x, this.bagButton.y, 'icon_bag', 0);
    // ステータスボタン（持ち物ボタンの左）
    this.statusButton = { x: this.bagButton.x - 25, y: this.bagButton.y, r: 11 };
    this.add.circle(this.statusButton.x, this.statusButton.y, 10, 0x1a1c2c, 0.6).setStrokeStyle(1, 0xf4f4f4, 0.6);
    this.add.image(this.statusButton.x, this.statusButton.y, 'icon_status', 0);
    // 未使用のステータスポイントがあるときの目印（ステータスボタンの右上）
    this.pointBadge = this.add.container(this.statusButton.x + 8, this.statusButton.y - 8).setVisible(false);
    this.pointBadge.add(this.add.circle(0, 0, 5, 0xffd23f, 1).setStrokeStyle(1, 0x1a1c2c, 1));
    this.pointBadgeText = createText(this, 0, 0, '', 6, '#1a1c2c').setOrigin(0.5);
    this.pointBadge.add(this.pointBadgeText);
    this.shownPoints = -1;
    // ボス戦の技の名前と重ならない高さ
    this.toastY = hudY + 71;

    // ボスの HP バー（ボス戦のときだけ）
    this.bossName = createText(this, hudX, hudY + 29, '', 6, '#ffd23f', { stroke: '#1a1c2c', strokeThickness: 2 });
    this.bossBar = this.add.graphics().setPosition(hudX, hudY + 38);
    this.bossBarWidth = W - safe.left - safe.right - 12;
    // 技の名前：HP バーのすぐ下、中央に帯つきで
    this.bossAttackBand = this.add.graphics().setVisible(false);
    this.bossAttack = createText(this, hudX + this.bossBarWidth / 2, hudY + 58, '', 8, '#ffffff', { stroke: '#1a1c2c', strokeThickness: 3 })
      .setOrigin(0.5)
      .setVisible(false);
    this.shownAttack = null;

    // ---- 操作系
    const bottom = H - safe.bottom;
    const right = W - safe.right;
    const stickArea = new Phaser.Geom.Rectangle(0, H * CONTROLS.stickAreaTopRatio, W * 0.5, H);
    this.stick = new VirtualStick(this, stickArea, safe.left + 28, bottom - 30);

    this.buttons = new ActionButtons(this);
    const ax = right - 24;
    const ay = bottom - 28;
    this.attackIndex = this.buttons.add(ax, ay, CONTROLS.attackButtonRadius, '攻撃', 0xb13e53);
    const offsets = [
      [-32, 5],
      [-26, -24],
      [2, -35],
    ];
    this.skillIndices = offsets.map(([dx, dy], i) =>
      this.buttons.add(ax + dx, ay + dy, CONTROLS.skillButtonRadius, `${i + 1}`, 0x3b5dc9, true),
    );
    // 給油ボタン（攻撃ボタンの左下。持っている数を右上に）
    this.gasIndex = this.buttons.add(ax - 56, ay + 10, CONTROLS.skillButtonRadius, '給油', 0x38b764);
    this.gasCountText = createText(this, ax - 56 + 8, ay + 10 - 9, '', 6, '#f4f4f4', { stroke: '#1a1c2c', strokeThickness: 2 }).setOrigin(0.5);

    // ---- タッチ（マルチタッチ対応：ポインタ id ごとに管理）
    const toLogical = (p: Phaser.Input.Pointer) => ({ x: p.x / viewport.zoom, y: p.y / viewport.zoom });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const { x, y } = toLogical(p);
      const bag = this.bagButton;
      if (Math.hypot(x - bag.x, y - bag.y) <= bag.r * 1.3) {
        this.openInventory();
        return;
      }
      const st = this.statusButton;
      if (Math.hypot(x - st.x, y - st.y) <= st.r * 1.2) {
        openOverlay(this, 'Status');
        return;
      }
      const hit = this.buttons.hitTest(x, y);
      if (hit >= 0) {
        this.buttons.press(p.id, hit);
        const si = this.skillIndices.indexOf(hit);
        if (si >= 0 && !this.buttons.buttons[hit].locked) InputState.skillQueue.push(si);
        if (hit === this.gasIndex && !this.buttons.buttons[hit].locked) EventBus.emit(GameEvents.UseGas);
        return;
      }
      this.stick.tryGrab(p.id, x, y);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const { x, y } = toLogical(p);
      this.stick.move(p.id, x, y);
    });
    const onUp = (p: Phaser.Input.Pointer) => {
      this.stick.release(p.id);
      this.buttons.release(p.id);
    };
    this.input.on('pointerup', onUp);
    this.input.on('pointerupoutside', onUp);
    this.input.on('gameout', () => {
      // 画面外で指を離した場合などの取りこぼし対策
      for (const p of this.input.manager.pointers) if (!p.isDown) onUp(p);
    });

    // ---- キーボード（PC確認用）
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,SPACE,ONE,TWO,THREE,I,C,H') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.keys.I.on('down', () => this.openInventory());
    this.keys.C.on('down', () => openOverlay(this, 'Status'));
    this.keys.H.on('down', () => EventBus.emit(GameEvents.UseGas));
    (['ONE', 'TWO', 'THREE'] as const).forEach((k, i) =>
      this.keys[k].on('down', () => {
        if (!this.buttons.buttons[this.skillIndices[i]].locked) InputState.skillQueue.push(i);
      }),
    );

    // ---- イベント
    const onHp = (cur: number, max: number) => {
      UIScene.hp = { cur, max };
      this.drawHp();
    };
    // 被弾時は画面の縁を赤く光らせる（カメラを揺らすと操作中に見づらいため）
    const flash = this.add.graphics().setAlpha(0);
    const edge = 6;
    flash
      .fillStyle(0xb13e53, 1)
      .fillRect(0, 0, W, edge)
      .fillRect(0, H - edge, W, edge)
      .fillRect(0, 0, edge, H)
      .fillRect(W - edge, 0, edge, H)
      .fillStyle(0xb13e53, 0.25)
      .fillRect(0, 0, W, H);
    const onDamaged = () => {
      this.tweens.killTweensOf(flash);
      flash.setAlpha(0.8);
      this.tweens.add({ targets: flash, alpha: 0, duration: 250 });
    };
    const onViewport = () => this.scene.restart();
    const onLevel = () => this.drawLevel();
    const onPickup = (item: ItemInstance) =>
      this.toast(`${item.name} を手に入れた`, rarityTextColor(item.rarity));
    const onToast = (text: string, color: string) => this.toast(text, color);
    const handlers: [string, (...args: any[]) => void][] = [
      [GameEvents.PlayerDamaged, onDamaged],
      [GameEvents.PlayerHpChanged, onHp],
      [GameEvents.ViewportChanged, onViewport],
      [GameEvents.ExpChanged, onLevel],
      [GameEvents.LevelUp, onLevel],
      [GameEvents.ItemPickedUp, onPickup],
      [GameEvents.Toast, onToast],
    ];
    handlers.forEach(([ev, fn]) => EventBus.on(ev, fn));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      handlers.forEach(([ev, fn]) => EventBus.off(ev, fn));
      InputState.reset();
    });
    // インベントリから戻ったら操作系を初期状態に作り直す
    this.events.once(Phaser.Scenes.Events.WAKE, () => this.scene.restart());
    this.drawHp();
    // 作り直した時点で別のメニューが開いていたら隠れる（会話 → メニューと続けて開いたとき）
    if (this.registry.get(OVERLAY_OPEN_KEY)) this.time.delayedCall(0, () => this.scene.sleep());
  }

  private openInventory() {
    openOverlay(this, 'Inventory');
  }

  /** スキルボタンの表示を HudState に合わせる */
  private syncSkillButtons() {
    this.skillIndices.forEach((bi, i) => {
      const s = HudState.skills[i];
      const b = this.buttons.buttons[bi];
      const locked = !s || !s.unlocked || !HudState.skillsEnabled;
      b.locked = locked;
      b.cooldown = s?.cooldown ?? 0;
      const label = !s ? '' : s.unlocked ? s.short : `Lv${s.unlockLevel}`;
      this.buttons.setLabel(bi, label);
    });
    const gas = this.buttons.buttons[this.gasIndex];
    gas.locked = HudState.gas.count <= 0;
    gas.cooldown = HudState.gas.cooldown;
    this.gasCountText.setText(`${HudState.gas.count}`);
    const atk = this.buttons.buttons[this.attackIndex];
    atk.locked = !HudState.attackEnabled;
    this.buttons.setLabel(this.attackIndex, HudState.interactLabel ?? '攻撃');
  }

  private drawLevel() {
    const job = JOBS[gameState.currentJob];
    const prog = gameState.jobs[job.id];
    this.levelText.setText(`Lv${prog.level} ${job.name}`);
    const w = 64;
    const ratio = prog.level >= EXP.maxLevel ? 1 : Phaser.Math.Clamp(prog.exp / expToNext(prog.level), 0, 1);
    this.expBar
      .clear()
      .fillStyle(0x1a1c2c, 0.8)
      .fillRect(-1, -1, w + 2, 4)
      .fillStyle(0x333c57, 1)
      .fillRect(0, 0, w, 2)
      .fillStyle(0xffcd75, 1)
      .fillRect(0, 0, Math.round(w * ratio), 2);
  }

  /** 画面上部に短いメッセージを出す（新しいものが上） */
  private toast(text: string, color: string) {
    const t = createText(this, viewport.width / 2, this.toastY, text, 6, '#f4f4f4', {
      stroke: '#1a1c2c',
      strokeThickness: 2,
    }).setOrigin(0.5, 0);
    applyColor(t, color);
    this.toasts.unshift(t);
    while (this.toasts.length > 4) this.toasts.pop()!.destroy();
    this.toasts.forEach((tt, i) => tt.setY(this.toastY + i * 9));
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 2200,
      duration: 400,
      onComplete: () => {
        const i = this.toasts.indexOf(t);
        if (i >= 0) this.toasts.splice(i, 1);
        t.destroy();
      },
    });
  }

  private drawBossBar(dt: number) {
    const b = HudState.boss;
    this.bossName.setVisible(!!b);
    this.bossBar.clear();
    this.updateBossAttack(b?.attack ?? null, dt);
    if (!b) return;
    this.bossName.setText(b.name);
    const w = this.bossBarWidth;
    const ratio = Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1);
    this.bossBar
      .fillStyle(0x1a1c2c, 0.85)
      .fillRect(-1, -1, w + 2, 6)
      .fillStyle(0x333c57, 1)
      .fillRect(0, 0, w, 4)
      .fillStyle(0xb13e53, 1)
      .fillRect(0, 0, Math.round(w * ratio), 4)
      .fillStyle(0xef7d57, 1)
      .fillRect(0, 0, Math.round(w * ratio), 1);
    // 詠唱バー：ボスが技を溜めている間だけ。満ちたら発動（最後は赤く点滅）
    if (b.cast !== null) {
      const cy = 8;
      const ch = 3;
      const fill = Math.round(w * b.cast);
      const late = b.cast > 0.8 && Math.floor(this.time.now / 80) % 2 === 0;
      this.bossBar.fillStyle(0x1a1c2c, 0.85).fillRect(-1, cy - 1, w + 2, ch + 2);
      this.bossBar.fillStyle(0x333c57, 1).fillRect(0, cy, w, ch);
      this.bossBar.fillStyle(late ? 0xb13e53 : 0xffd23f, 1).fillRect(0, cy, fill, ch);
      this.bossBar.fillStyle(0xffffff, 1).fillRect(Math.max(0, fill - 1), cy, 1, ch);
    }
    // 50%・20% の目印（上下にはみ出す白い線と、小さな三角）
    for (const mark of [0.5, 0.2]) {
      const mx = Math.round(w * mark);
      this.bossBar.fillStyle(0xf4f4f4, 1).fillRect(mx, -2, 1, 8);
      this.bossBar.fillTriangle(mx - 2, -4, mx + 3, -4, mx + 0.5, -1);
    }
  }

  /** 技の名前：新しい技が始まったら出して少し弾ませ、終わったら少し残してから消す */
  private updateBossAttack(attack: string | null, dt: number) {
    const t = this.bossAttack;
    if (attack) {
      this.attackHold = 0.6;
      if (attack !== this.shownAttack) {
        this.shownAttack = attack;
        this.tweens.killTweensOf(t);
        t.setText(`《${attack}》`).setVisible(true).setAlpha(1).setScale(1.3);
        this.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.easeOut' });
        // 文字の後ろの帯
        const bw = t.width + 16;
        this.tweens.killTweensOf(this.bossAttackBand);
        this.bossAttackBand
          .clear()
          .fillStyle(0xb13e53, 0.85)
          .fillRect(t.x - bw / 2, t.y - 6, bw, 12)
          .fillStyle(0xffd23f, 1)
          .fillRect(t.x - bw / 2, t.y - 6, bw, 1)
          .fillRect(t.x - bw / 2, t.y + 5, bw, 1)
          .setVisible(true)
          .setAlpha(1);
      }
      return;
    }
    if (!this.shownAttack) return;
    this.attackHold -= dt;
    if (this.attackHold > 0) return;
    this.shownAttack = null;
    this.tweens.add({
      targets: [t, this.bossAttackBand],
      alpha: 0,
      duration: 250,
      onComplete: () => {
        t.setVisible(false);
        this.bossAttackBand.setVisible(false);
      },
    });
  }

  private drawHp() {
    const w = 64;
    const ratio = Phaser.Math.Clamp(UIScene.hp.cur / UIScene.hp.max, 0, 1);
    this.hpBar
      .clear()
      .fillStyle(0x1a1c2c, 0.8)
      .fillRect(-1, -1, w + 2, 9)
      .fillStyle(0x333c57, 1)
      .fillRect(0, 0, w, 7)
      .fillStyle(ratio > 0.3 ? 0x38b764 : 0xb13e53, 1)
      .fillRect(0, 0, Math.round(w * ratio), 7);
    this.hpText.setText(`${Math.ceil(UIScene.hp.cur)}/${UIScene.hp.max}`);
  }

  update(_time: number, deltaMs: number) {
    const k = this.keys;
    let kx = 0;
    let ky = 0;
    if (k.A.isDown || k.LEFT.isDown) kx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) kx += 1;
    if (k.W.isDown || k.UP.isDown) ky -= 1;
    if (k.S.isDown || k.DOWN.isDown) ky += 1;
    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      InputState.moveX = kx / len;
      InputState.moveY = ky / len;
    } else {
      InputState.moveX = this.stick.x;
      InputState.moveY = this.stick.y;
    }
    InputState.attackHeld = this.buttons.isHeld(this.attackIndex) || k.J.isDown || k.SPACE.isDown;

    this.syncSkillButtons();
    this.drawBossBar(Math.min(deltaMs, 50) / 1000);
    const pts = statPointsOf().statPoints;
    if (pts !== this.shownPoints) {
      this.shownPoints = pts;
      this.pointBadge.setVisible(pts > 0);
      this.pointBadgeText.setText(pts > 9 ? '9+' : String(pts));
    }
    this.buttons.draw();
    if (this.fpsText) this.fpsText.setText(`${Math.round(this.game.loop.actualFps)}fps`);
  }
}
