import Phaser from 'phaser';
import { BOSS, ENEMY, LOOT } from '../config/balance';
import { EventBus, GameEvents } from '../core/EventBus';
import { HudState } from '../core/HudState';
import type { BossPatternDef, ItemInstance, Rarity } from '../core/types';
import { ENEMIES } from '../data/enemies';
import { ITEM_BASES } from '../data/itemBases';
import { Enemy } from '../entities/Enemy';
import { LootDrop } from '../entities/LootDrop';
import { rollDamage } from '../systems/Combat';
import { addToInventory } from '../systems/Equipment';
import { createItem, weightedPick } from '../systems/Items';
import { createRandomItem, rollDrop } from '../systems/LootGenerator';
import { gainExp, killExp } from '../systems/Progression';
import { enemyCountMultiplier, enemyLevel, hasFlag, rarityBonus, setFlag } from '../systems/Story';
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
    // 同時に出る敵の数（周回で増える）
    const count = this.area.maxEnemies > 0 ? Math.max(1, Math.round(this.area.maxEnemies * enemyCountMultiplier())) : 0;
    for (let i = 0; i < count; i++) {
      const e = new Enemy(this);
      this.enemies.push(e);
      this.enemyGroup.add(e);
    }
    this.physics.add.collider(this.enemyGroup, this.map.layer);
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);
    this.physics.add.collider(this.player, this.enemyGroup);
    for (let i = 0; i < count; i++) this.spawnEnemy(true);
    this.spawnBoss();

    this.hpBars = this.add.graphics().setDepth(99999);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (HudState.boss = null));
  }

  /** ボスエリアならボスを出す（この周回で倒していなければ） */
  private spawnBoss() {
    const b = this.area.boss;
    if (!b) return;
    const pos = this.map.markers.get(b.marker)?.[0];
    if (!pos) return;
    // 第一形態を倒したあと（第二形態の途中でエリアを出た場合）は、第二形態から
    let id = b.id;
    if (hasFlag(`defeated_${b.id}`)) {
      if (!b.then || hasFlag(`defeated_${b.then}`)) return;
      id = b.then;
    }
    this.placeBoss(id, pos.x, pos.y);
  }

  /** ボスを置く（相棒がいれば一緒に。相棒のダメージは本体に入る） */
  private placeBoss(id: string, x: number, y: number) {
    const def = ENEMIES[id];
    const e = new Enemy(this);
    this.enemies.push(e);
    this.enemyGroup.add(e);
    e.spawn(def, x, y, enemyLevel(this.area.level));
    this.boss = e;
    if (def.boss?.partner) {
      const c = new Enemy(this);
      this.enemies.push(c);
      this.enemyGroup.add(c);
      c.spawn(ENEMIES[def.boss.partner], x, y, enemyLevel(this.area.level));
      c.homeX = x;
      c.homeY = y;
      c.link = e;
      e.partner = c;
    }
  }

  /** イベントで第二形態を出す（倒した場所・なければエリアの中心） */
  protected spawnBossNow(id: string) {
    const b = this.area.boss;
    const pos = (b && this.map.markers.get(b.marker)?.[0]) ?? { x: this.player.x, y: this.player.y - 40 };
    this.placeBoss(id, pos.x, pos.y);
    const e = this.boss!;
    // 第一形態が消えた場所から現れる
    if (this.lastBossPos) e.body.reset(this.lastBossPos.x, this.lastBossPos.y);
    e.partner?.body.reset(e.x, e.y);
    e.setAlpha(0);
    this.tweens.add({ targets: [e, e.partner].filter(Boolean), alpha: 1, duration: 500 });
  }

  /** ZERO END を耐えきったとき：ボスを倒す */
  defeatEnemy(enemy: Enemy) {
    enemy.finisherDone = true;
    enemy.hp = 1;
    this.damageEnemy(enemy, 9999, enemy.x, enemy.y);
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
    const def = ENEMIES[pick.id];
    e.spawn(def, pos.x, pos.y, enemyLevel(this.area.level));
    // 群れで出る敵は、近くに仲間も出す
    if (def.pack) {
      const n = def.pack.min + Math.floor(Math.random() * (def.pack.max - def.pack.min + 1)) - 1;
      for (let i = 0; i < n; i++) {
        const mate = this.enemies.find((en) => !en.active);
        if (!mate) break;
        const a = Math.random() * Math.PI * 2;
        const x = pos.x + Math.cos(a) * 18;
        const y = pos.y + Math.sin(a) * 18;
        if (this.isWall(x, y)) continue;
        mate.spawn(def, x, y, enemyLevel(this.area.level));
      }
    }
    if (def.guaranteedLoot && !initial) EventBus.emit(GameEvents.Toast, `……${def.name}の気配がする`, '#c58cff');
  }

  // ------------------------------------------------------------ CombatWorld

  getLiveEnemies(): readonly Enemy[] {
    return this.liveEnemies;
  }

  /** 相棒に当てたとき、数字などは相棒の位置に出す */
  private hitAt: { x: number; y: number } | null = null;

  damageEnemy(enemy: Enemy, power: number, fromX: number, fromY: number) {
    if (!enemy.alive) return;
    // 相棒（水色の FIT）のダメージは本体に入る
    if (enemy.link) {
      this.hitAt = { x: enemy.x, y: enemy.y };
      this.damageEnemy(enemy.link, power, fromX, fromY);
      this.hitAt = null;
      return;
    }
    const hx = this.hitAt?.x ?? enemy.x;
    const hy = this.hitAt?.y ?? enemy.y;
    const res = rollDamage(this.player.stats, power, enemy.defense);
    // 防御姿勢中はダメージが減る
    res.amount = Math.max(1, Math.round(res.amount * enemy.damageMultiplier));
    const { died, phaseUp, guardStarted } = enemy.applyDamage(res.amount, fromX, fromY);
    if (guardStarted) this.showSpeech(enemy.x, enemy.y - 4, '（盾を構えた）');
    // 戦闘中の台詞（レアモンスターなど）
    const barks = enemy.def.barks;
    if (barks && !died) {
      if (!enemy.barked.hit) {
        enemy.barked.hit = true;
        this.showSpeech(enemy.x, enemy.y - 4, barks[0]);
      } else if (!enemy.barked.half && barks[1] && enemy.hp / enemy.maxHp <= 0.5) {
        enemy.barked.half = true;
        this.showSpeech(enemy.x, enemy.y - 4, barks[1]);
      }
    }
    this.floatText.show(hx, hy - 6, `${res.amount}`, res.crit ? '#ffcd75' : '#f4f4f4', res.crit);
    this.sparks.explode(res.crit ? 8 : 4, hx, hy);
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
      // 倒すと一瞬だけ過去の景色が見える（ゼロ・ハウンド）
      if (enemy.def.deathFlash) this.memoryFlash(enemy.x, enemy.y, 1.2);
      this.respawnTimers.push(ENEMY.respawnDelay);
      const item = rollDrop({
        itemLevel: enemy.level,
        jobId: this.player.jobId,
        dropRate: enemy.def.dropRate,
        rarityBonus: rarityBonus(),
      });
      if (item) this.spawnDrop(item, enemy.x, enemy.y);
      // 低確率の特別なドロップ（輪廻の欠片など）
      const rd = enemy.def.rareDrop;
      if (rd && Math.random() < rd.chance) this.spawnDrop(createItem(rd.baseId, rd.rarity, enemy.level), enemy.x, enemy.y);
      // レアモンスターの確定ドロップ
      const gl = enemy.def.guaranteedLoot;
      for (let i = 0; gl && i < gl.count; i++) {
        const extra = createRandomItem({ itemLevel: enemy.level, jobId: this.player.jobId, rarityBonus: rarityBonus() }, gl.minRarity);
        if (extra) this.spawnDrop(extra, enemy.x, enemy.y);
      }
    }
  }

  /** ボス撃破：消える演出のあと確定ドロップとイベント */
  private onBossDefeated(boss: Enemy) {
    const def = boss.def;
    this.lastBossPos = { x: boss.x, y: boss.y };
    // 相棒も一緒に消える
    const c = boss.partner;
    if (c?.alive) {
      c.setEnemyState('dead');
      c.body.enable = false;
      this.tweens.add({ targets: c, alpha: 0, duration: BOSS.deathTime * 1000, onComplete: () => c.deactivate() });
    }
    // 残っている穴・しかけを止める
    this.pits.clear();
    this.gimmicks?.setConfig({ vanish: undefined, echo: undefined, memory: undefined });
    setFlag(`defeated_${def.id}`);
    this.cameras.main.flash(400, 255, 255, 255);
    this.time.addEvent({
      delay: 120,
      repeat: Math.floor((BOSS.deathTime * 1000) / 120),
      callback: () => this.sparks.explode(6, boss.x + (Math.random() - 0.5) * 24, boss.y + (Math.random() - 0.5) * 20),
    });
    // 体が崩れていく演出（水しぶき・水晶のかけら）
    const fx = def.boss!.deathEffects;
    if (fx?.length) {
      this.cameras.main.shake(BOSS.deathTime * 1000, 0.006);
      this.time.addEvent({
        delay: 200,
        repeat: Math.floor((BOSS.deathTime * 1000) / 200),
        callback: () =>
          this.showAoeEffect({
            x: boss.x + (Math.random() - 0.5) * 36,
            y: boss.y + (Math.random() - 0.5) * 28,
            angle: 0,
            shape: { type: 'circle', radius: 10 + Math.random() * 10 },
            duration: 0,
            power: 0,
            effect: fx[Math.floor(Math.random() * fx.length)],
          }),
      });
    }
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

  protected dropLootAt(x: number, y: number, minRarity: Rarity) {
    const item = createRandomItem({ itemLevel: enemyLevel(this.area.level), jobId: this.player.jobId, rarityBonus: rarityBonus() }, minRarity);
    if (item) this.spawnDrop(item, x, y);
    EventBus.emit(GameEvents.Toast, '宝箱を開けた！', '#ffd23f');
  }

  protected collectDrops() {
    for (const d of [...this.drops]) {
      if (!addToInventory(d.item)) continue;
      d.destroy();
      this.drops.splice(this.drops.indexOf(d), 1);
      EventBus.emit(GameEvents.ItemPickedUp, d.item);
    }
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
      // 記憶の断片が記録された装備：拾うと断片が1つ流れる
      const lore = ITEM_BASES[d.item.baseId]?.lore;
      if (lore?.length) {
        const line = lore[Math.floor(Math.random() * lore.length)];
        this.time.delayedCall(300, () => this.playLines([{ t: `${d.item.name}に、記憶が残っている……` }, { t: line }]));
      }
    }
  }

  // ------------------------------------------------------------ 毎フレーム

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;

    // 狙える敵（見えない敵は除く）
    this.liveEnemies.length = 0;
    for (const e of this.enemies) if (e.alive && !e.hidden) this.liveEnemies.push(e);

    this.updateWorld(dt);
    for (const e of this.enemies) {
      if (e.alive) e.updateEnemy(dt, this);
      // 寿命で消えた敵（データゴースト）も、しばらくすると別の敵が出る
      if (e.expired) {
        e.expired = false;
        this.respawnTimers.push(ENEMY.respawnDelay);
      }
    }

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
    const using = b && (b.state === 'windup' || b.state === 'lunge') ? (b.currentAttack as BossPatternDef | undefined)?.name ?? null : null;
    HudState.boss = b && b.alive ? { name: b.def.name, hp: b.hp, maxHp: b.maxHp, attack: using } : null;
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
