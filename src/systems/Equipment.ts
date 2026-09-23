import { AUTO_EQUIP, COMBAT, LOOT } from '../config/balance';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import type { ArmorSlot, ItemInstance, JobId, Slot, Stats } from '../core/types';
import { AFFIXES } from '../data/affixes';
import { ITEM_BASES } from '../data/itemBases';
import { SLOT_ORDER } from '../data/itemMeta';
import { JOBS } from '../data/jobs';
import { itemSlot, sellPrice, upgradeCost } from './Items';
import { calcPlayerStats } from './StatCalculator';

// 装備の付け替え・売却・ステータス計算の窓口

export function getEquipped(slot: Slot, jobId: JobId = gameState.currentJob): ItemInstance | null {
  const eq = gameState.equipment;
  return slot === 'weapon' ? eq.weapon[jobId] : eq.armor[slot as ArmorSlot];
}

function setEquipped(slot: Slot, item: ItemInstance | null, jobId: JobId = gameState.currentJob) {
  const eq = gameState.equipment;
  if (slot === 'weapon') eq.weapon[jobId] = item;
  else eq.armor[slot as ArmorSlot] = item;
}

export function equippedItems(jobId: JobId = gameState.currentJob): ItemInstance[] {
  const eq = gameState.equipment;
  return [eq.weapon[jobId], ...Object.values(eq.armor)].filter((i): i is ItemInstance => !!i);
}

/** 今のジョブで装備できるか */
export function canEquip(item: ItemInstance, jobId: JobId = gameState.currentJob): boolean {
  const base = ITEM_BASES[item.baseId];
  return base.slot !== 'weapon' || base.weaponType === JOBS[jobId].weaponType;
}

export function currentStats(jobId: JobId = gameState.currentJob): Stats {
  return calcPlayerStats(jobId, gameState.jobs[jobId].level, equippedItems(jobId));
}

/** この装備に付け替えたときのステータス（比較表示用） */
export function statsIfEquipped(item: ItemInstance, jobId: JobId = gameState.currentJob): Stats {
  const slot = itemSlot(item);
  const others = equippedItems(jobId).filter((i) => itemSlot(i) !== slot);
  return calcPlayerStats(jobId, gameState.jobs[jobId].level, [...others, item]);
}

/** 外したときのステータス（比較表示用） */
export function statsIfUnequipped(slot: Slot, jobId: JobId = gameState.currentJob): Stats {
  const others = equippedItems(jobId).filter((i) => itemSlot(i) !== slot);
  return calcPlayerStats(jobId, gameState.jobs[jobId].level, others);
}

function changed() {
  EventBus.emit(GameEvents.EquipmentChanged);
  SaveManager.requestSave();
}

/** 持ち物の装備を身につける（元の装備は持ち物へ） */
export function equipFromInventory(item: ItemInstance): boolean {
  if (!canEquip(item)) return false;
  const inv = gameState.inventory;
  const idx = inv.indexOf(item);
  if (idx < 0) return false;
  const slot = itemSlot(item);
  const prev = getEquipped(slot);
  if (prev) inv[idx] = prev;
  else inv.splice(idx, 1);
  setEquipped(slot, item);
  changed();
  return true;
}

/** 外して持ち物へ。持ち物がいっぱいなら false */
export function unequip(slot: Slot): boolean {
  const item = getEquipped(slot);
  if (!item || isInventoryFull()) return false;
  setEquipped(slot, null);
  gameState.inventory.push(item);
  changed();
  return true;
}

export function sellItem(item: ItemInstance): number {
  const idx = gameState.inventory.indexOf(item);
  if (idx < 0) return 0;
  gameState.inventory.splice(idx, 1);
  const price = sellPrice(item);
  gameState.gold += price;
  changed();
  return price;
}

export function isInventoryFull(): boolean {
  return gameState.inventory.length >= LOOT.inventorySize;
}

/** 拾う。いっぱいなら false */
export function addToInventory(item: ItemInstance): boolean {
  if (isInventoryFull()) return false;
  gameState.inventory.push(item);
  SaveManager.requestSave();
  return true;
}

/** 装備の総合的な強さ（最強装備の比較に使う） */
export function powerScore(s: Stats): number {
  const critMul = 1 + s.critRate * (COMBAT.baseCritMultiplier - 1 + s.critDamage);
  const offense = s.atk * s.attackSpeed * critMul;
  const durability = s.maxHp * (1 + s.def / COMBAT.defenseK);
  return offense * Math.pow(durability, AUTO_EQUIP.defenseWeight) * Math.pow(s.moveSpeed / 60, AUTO_EQUIP.speedWeight);
}

/**
 * 装備中＋持ち物の中から、強さが最大になる組み合わせに付け替える。
 * 付け替えた部位の数を返す。
 */
export function autoEquipBest(jobId: JobId = gameState.currentJob): number {
  const level = gameState.jobs[jobId].level;
  const chosen = new Map<Slot, ItemInstance | null>(SLOT_ORDER.map((s) => [s, getEquipped(s, jobId)]));
  const candidates = new Map<Slot, ItemInstance[]>(
    SLOT_ORDER.map((s) => {
      const cur = getEquipped(s, jobId);
      const fromBag = gameState.inventory.filter((i) => itemSlot(i) === s && canEquip(i, jobId));
      return [s, cur ? [cur, ...fromBag] : fromBag];
    }),
  );
  const scoreWith = (slot: Slot, item: ItemInstance) => {
    const items = SLOT_ORDER.map((s) => (s === slot ? item : chosen.get(s))).filter((i): i is ItemInstance => !!i);
    return powerScore(calcPlayerStats(jobId, level, items));
  };

  // %上昇どうしが影響し合うので、部位ごとの最適化を数回くり返す
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (const slot of SLOT_ORDER) {
      const list = candidates.get(slot)!;
      if (list.length === 0) continue;
      let best = chosen.get(slot) ?? list[0];
      let bestScore = scoreWith(slot, best);
      for (const item of list) {
        const sc = scoreWith(slot, item);
        if (sc > bestScore + 1e-9) {
          best = item;
          bestScore = sc;
        }
      }
      if (best !== chosen.get(slot)) {
        chosen.set(slot, best);
        improved = true;
      }
    }
    if (!improved) break;
  }

  let changes = 0;
  for (const slot of SLOT_ORDER) {
    const next = chosen.get(slot) ?? null;
    const prev = getEquipped(slot, jobId);
    if (next === prev || !next) continue;
    const idx = gameState.inventory.indexOf(next);
    if (prev) gameState.inventory[idx] = prev;
    else gameState.inventory.splice(idx, 1);
    setEquipped(slot, next, jobId);
    changes++;
  }
  if (changes > 0) changed();
  return changes;
}

/** 装備によるスキル威力の上昇（スキルid → 加算する割合） */
export function skillBonuses(jobId: JobId = gameState.currentJob): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of equippedItems(jobId)) {
    for (const a of item.affixes) {
      const def = AFFIXES[a.id];
      if (def?.skill) out[def.skill] = (out[def.skill] ?? 0) + a.value;
    }
  }
  return out;
}

/** ゴールドを払って +1 強化。できなければ false */
export function upgradeItem(item: ItemInstance): boolean {
  const cost = upgradeCost(item);
  if (cost === null || gameState.gold < cost) return false;
  gameState.gold -= cost;
  item.upgrade++;
  changed();
  return true;
}
