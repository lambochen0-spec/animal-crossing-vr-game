// 宝可梦档案注册表：新增/替换宝可梦时，只需增删对应文件夹并在此登记
import type { VillagerProfile } from './types';
import { profile as jigglypuff } from './jigglypuff';
import { profile as eevee } from './eevee';
import { profile as snorlax } from './snorlax';
import { profile as psyduck } from './psyduck';
import { profile as charmander } from './charmander';
import { profile as squirtle } from './squirtle';
import { profile as bulbasaur } from './bulbasaur';
import { profile as piplup } from './piplup';
import { profile as meowth } from './meowth';
import { profile as pikachu } from './pikachu';
import { profile as togepi } from './togepi';
import { profile as gengar } from './gengar';
import { profile as lucario } from './lucario';
import { profile as sylveon } from './sylveon';
import { profile as mimikyu } from './mimikyu';
import { profile as dedenne } from './dedenne';
import { profile as rowlet } from './rowlet';
import { profile as scorbunny } from './scorbunny';
import { profile as yamper } from './yamper';
import { profile as dragonite } from './dragonite';
// ---- 第二批宝可梦（开店大版本扩充：全岛 42 只）----
import { profile as pichu } from './pichu';
import { profile as munchlax } from './munchlax';
import { profile as marill } from './marill';
import { profile as totodile } from './totodile';
import { profile as chikorita } from './chikorita';
import { profile as cyndaquil } from './cyndaquil';
import { profile as mudkip } from './mudkip';
import { profile as torchic } from './torchic';
import { profile as treecko } from './treecko';
import { profile as vulpix } from './vulpix';
import { profile as growlithe } from './growlithe';
import { profile as pawmi } from './pawmi';
import { profile as riolu } from './riolu';
import { profile as sprigatito } from './sprigatito';
import { profile as fuecoco } from './fuecoco';
import { profile as quaxly } from './quaxly';
import { profile as chimchar } from './chimchar';
import { profile as grookey } from './grookey';
import { profile as popplio } from './popplio';
import { profile as rockruff } from './rockruff';
import { profile as tinkatink } from './tinkatink';
import { profile as applin } from './applin';

export type { VillagerProfile, VillagerDef, HouseStyle, InteriorStyle, FurnitureItem } from './types';

// 全部可成为居民的宝可梦花名册（18 只，开局随机选 5，露营最多补到 8）
export const VILLAGER_ROSTER: VillagerProfile[] = [
  jigglypuff, eevee, snorlax, psyduck, charmander, squirtle, bulbasaur, piplup,
  togepi, gengar, lucario, sylveon, mimikyu, dedenne, rowlet, scorbunny, yamper, dragonite,
  // 第二批扩充（22 只）
  pichu, munchlax, marill, totodile, chikorita, cyndaquil, mudkip, torchic, treecko, vulpix,
  growlithe, pawmi, riolu, sprigatito, fuecoco, quaxly, chimchar, grookey, popplio, rockruff,
  tinkatink, applin,
];

// 住宅槽位：固定 8 个宅基地坐标（居民按入住顺序分配）
export const HOUSE_SLOTS: { x: number; z: number }[] = [
  { x: -72, z: -46 }, { x: -44, z: -46 }, { x: -16, z: -46 }, { x: 16, z: -46 },
  { x: 44, z: -46 }, { x: 72, z: -46 }, { x: -44, z: -78 }, { x: 44, z: -78 },
];
export const MAX_RESIDENTS = HOUSE_SLOTS.length; // 最多 8 只

// 有自宅的村民（由 applyResidents 按存档/随机结果填充）
export let VILLAGER_PROFILES: VillagerProfile[] = [];

// 把居民 id 列表映射到住宅槽位：改写各档案的 home/spawn，并填充 VILLAGER_PROFILES
export function applyResidents(ids: string[]): VillagerProfile[] {
  const list: VillagerProfile[] = [];
  ids.forEach((id, i) => {
    const p = VILLAGER_ROSTER.find(r => r.id === id);
    const slot = HOUSE_SLOTS[i];
    if (!p || !slot) return;
    p.home = { ...slot };
    p.spawn = { x: slot.x + (slot.x >= 0 ? -6 : 6), z: slot.z + 7 };
    list.push(p);
  });
  VILLAGER_PROFILES = list;
  return list;
}

export function rosterById(id: string): VillagerProfile | undefined {
  return VILLAGER_ROSTER.find(r => r.id === id);
}

// 常驻岗位的 NPC（喵喵=商店社长，皮卡丘=广场向导）
export const NPC_PROFILES = { meowth, pikachu };

export const ALL_PROFILES: VillagerProfile[] = [...VILLAGER_ROSTER, meowth, pikachu];

export function profileByName(name: string): VillagerProfile | undefined {
  return ALL_PROFILES.find(p => p.def.name === name);
}

// 玩家之家的室内装修（初始通用风格）
import { floorPlanks, wallDots } from './svg';
export const PLAYER_INTERIOR = {
  floorSvg: floorPlanks('#d9b98a', '#b8986a'),
  wallSvg: wallDots('#f2e8d5', '#d9c9a8'),
  furniture: [
    { kind: 'bed', x: -5.6, z: -3.4, color: '#3aa7e8', color2: '#f7f0e0' },
    { kind: 'rug', x: 0, z: 0.8, color: '#e8b45a', w: 4.4, d: 3 },
    { kind: 'table', x: 2.6, z: -3.6, color: '#b8804a', color2: '#f7f0e0' },
    { kind: 'chair', x: 2.6, z: -2.2, color: '#3aa7e8', rotY: Math.PI },
    { kind: 'dresser', x: -7, z: 1.8, color: '#b8804a', rotY: Math.PI / 2 },
    { kind: 'lamp', x: -3.4, z: -4.6, color: '#ffd9a0' },
    { kind: 'plant', x: 6.9, z: -3.6, color: '#5a9a4a' },
    { kind: 'sofa', x: 6, z: 2.2, color: '#e8b45a', color2: '#f7f0e0', rotY: -Math.PI / 2 },
  ] as import('./types').FurnitureItem[],
};

// 玩家帐篷室内（睡袋 + 简单行李，可以在睡袋里睡觉）
export const TENT_INTERIOR = {
  floorSvg: floorPlanks('#c9b08a', '#a88f6a'),
  wallSvg: wallDots('#e8dcc0', '#c9b88a'),
  furniture: [
    { kind: 'bed', x: -5.6, z: -3.4, color: '#5a9a4a', color2: '#f7f0e0' }, // 睡袋
    { kind: 'rug', x: 0, z: 0.8, color: '#c98a4a', w: 3.6, d: 2.6 },
    { kind: 'dresser', x: -7, z: 1.8, color: '#8a6a4a', rotY: Math.PI / 2 },
    { kind: 'lamp', x: -3.4, z: -4.6, color: '#ffd9a0' },
    { kind: 'decor', x: 5.8, z: -3.2, emoji: '🏕️', color: '#c9a86a' },
    { kind: 'plant', x: 6.9, z: -3.6, color: '#5a9a4a' },
  ] as import('./types').FurnitureItem[],
};

// 友好商店室内（对标 Nook's Cranny：商品小方盒贴墙摆一圈，空间不拥挤）
import { floorChecker, wallStripes } from './svg';
export const SHOP_INTERIOR = {
  floorSvg: floorPlanks('#c9a86a', '#a88752'),
  wallSvg: wallStripes('#e8d5a8', '#d9c090'),
  furniture: [
    { kind: 'rug', x: 0, z: 3.2, color: '#4a8e5a', w: 4, d: 2.6 },
    { kind: 'plant', x: -7.2, z: 4.4, color: '#5a9a4a' },
    { kind: 'plant', x: 7.2, z: 4.4, color: '#5a9a4a' },
  ] as import('./types').FurnitureItem[],
};

// 博物馆室内基底（展品台由游戏根据捐赠动态追加）
export const MUSEUM_BASE = {
  floorSvg: floorChecker('#e8e2d5', '#d4ccba'),
  wallSvg: wallStripes('#e8e2d5', '#cfc7b2'),
};

// 服务处室内（对标原版 Resident Services：木地板 + 接待柜台 + 公告角）
export const SERVICE_INTERIOR = {
  floorSvg: floorPlanks('#c9a86a', '#a88752'),
  wallSvg: wallStripes('#f2ecd8', '#ddd2b2'),
  furniture: [
    { kind: 'rug', x: 0, z: 0.8, color: '#4a8e5a', w: 5.6, d: 3.6 },
    { kind: 'table', x: -5.4, z: -1.5, color: '#b8804a', color2: '#4a8e5a' },        // 工作台
    { kind: 'shelf', x: 5.6, z: -4.9, color: '#a87f4e' },                            // 资料架
    { kind: 'decor', x: 5.6, z: -4.2, emoji: '📚', color: '#c9a86a' },
    { kind: 'decor', x: -6.6, z: -4.2, emoji: '📋', color: '#c9a86a' },              // 公告板
    { kind: 'plant', x: -7, z: 3.8, color: '#5a9a4a' },
    { kind: 'plant', x: 7, z: 3.8, color: '#5a9a4a' },
    { kind: 'bed', x: 6.6, z: 2.8, color: '#8a6239', color2: '#f2ecd8', rotY: -Math.PI / 2 }, // 休息长椅
  ] as import('./types').FurnitureItem[],
};
