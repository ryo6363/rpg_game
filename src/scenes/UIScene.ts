import Phaser from 'phaser';
import { CONTROLS, DISPLAY } from '../config/balance';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { viewport } from '../core/Viewport';
import { JOBS } from '../data/jobs';
import { ActionButtons } from '../input/ActionButtons';
import { InputState } from '../input/InputState';
import { VirtualStick } from '../input/VirtualStick';
import { createText } from '../ui/text';

/** HUD と操作系。フィールドの上に常に重ねて表示する */
export class UIScene extends Phaser.Scene {
  private stick!: VirtualStick;
  private buttons!: ActionButtons;
  private attackIndex = 0;
  private skillIndices: number[] = [];
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private fpsText?: Phaser.GameObjects.Text;
  /** 再起動（画面サイズ変更）後も表示を保つため static */
  private static hp = { cur: 1, max: 1 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super('UI');
  }

  create() {
    const vp = viewport;
    const { width: W, height: H, safe } = vp;
    this.cameras.main.setZoom(vp.zoom).setOrigin(0, 0);

    // ---- HUD
    const hudX = safe.left + 6;
    const hudY = safe.top + 6;
    const job = JOBS[gameState.currentJob];
    createText(this, hudX, hudY, `Lv${gameState.jobs[job.id].level} ${job.name}`, 8);
    this.hpBar = this.add.graphics();
    this.hpText = createText(this, hudX + 2, hudY + 12, '', 6).setDepth(1);
    this.hpBar.setPosition(hudX, hudY + 11);
    if (DISPLAY.showFps) this.fpsText = createText(this, W - safe.right - 4, hudY, '', 6, '#94b0c2').setOrigin(1, 0);

    // ---- 操作系
    const bottom = H - safe.bottom;
    const right = W - safe.right;
    const stickArea = new Phaser.Geom.Rectangle(0, H * CONTROLS.stickAreaTopRatio, W * 0.5, H);
    this.stick = new VirtualStick(this, stickArea, safe.left + 34, bottom - 36);

    this.buttons = new ActionButtons(this);
    const ax = right - 30;
    const ay = bottom - 34;
    this.attackIndex = this.buttons.add(ax, ay, CONTROLS.attackButtonRadius, '攻撃', 0xb13e53);
    const offsets = [
      [-40, 6],
      [-32, -30],
      [2, -44],
    ];
    this.skillIndices = offsets.map(([dx, dy], i) =>
      this.buttons.add(ax + dx, ay + dy, CONTROLS.skillButtonRadius, `${i + 1}`, 0x3b5dc9, true),
    );

    // ---- タッチ（マルチタッチ対応：ポインタ id ごとに管理）
    const toLogical = (p: Phaser.Input.Pointer) => ({ x: p.x / viewport.zoom, y: p.y / viewport.zoom });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const { x, y } = toLogical(p);
      const hit = this.buttons.hitTest(x, y);
      if (hit >= 0) {
        this.buttons.press(p.id, hit);
        const si = this.skillIndices.indexOf(hit);
        if (si >= 0 && !this.buttons.buttons[hit].locked) InputState.skillQueue.push(si);
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
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,SPACE,ONE,TWO,THREE,I') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
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
    const onViewport = () => this.scene.restart();
    EventBus.on(GameEvents.PlayerHpChanged, onHp);
    EventBus.on(GameEvents.ViewportChanged, onViewport);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(GameEvents.PlayerHpChanged, onHp);
      EventBus.off(GameEvents.ViewportChanged, onViewport);
      InputState.reset();
    });
    this.drawHp();
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

  update() {
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

    this.buttons.draw();
    if (this.fpsText) this.fpsText.setText(`${Math.round(this.game.loop.actualFps)}fps`);
  }
}
