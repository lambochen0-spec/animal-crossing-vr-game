// 木守宫（Treecko）：冷静沉着的森林守卫
import type { VillagerProfile } from '../types';
import { floorPlanks, wallLeaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'treecko',
  def: {
    name: '木守宫', height: 0.5, species: '林蜥宝可梦', color: 0x3aa860, belly: 0xe8f7d0, earType: 'charmander',
    catchphrase: '守宫', likes: ["apple"],
    lines: ["脚底有小刺，再滑的墙我也爬得上去守宫！", "尾巴大大的，是我的骄傲守宫！", "冷静沉着才是森林的生存之道守宫。", "这棵大树不错，从今天起就是我的地盘了守宫！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#e0f0d8', roofA: '#3a8a5a', roofB: '#2f7048', door: '#6a4a2f', accent: '#8ac8a0' },
  interior: {
    floorSvg: floorPlanks('#c8b890', '#a89878'),
    wallSvg: wallLeaves('#e2f0dc', '#5aa87a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#3a8a5a', color2: '#e8f7d0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#3a8a5a', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🍃', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🌳', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#3a8a5a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#3a8a5a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#e8f7d0', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#3a8a5a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
