// 卡蒂狗（Growlithe）：忠诚可靠的警卫犬
import type { VillagerProfile } from '../types';
import { floorPlanks, wallPaws } from '../svg';

export const profile: VillagerProfile = {
  id: 'growlithe',
  def: {
    name: '卡蒂狗', height: 0.7, species: '小狗宝可梦', color: 0xe8823a, belly: 0xf7e0b8, earType: 'eevee', earColor: 0xf7e0b8,
    catchphrase: '汪汪', likes: ["apple"],
    lines: ["汪汪！我是岛上最忠诚的警卫，有我在大家放心！", "闻闻……嗯，你身上有刚烤好的面包味汪汪！", "我的毛发又蓬又软，摸过的都说好汪汪！", "跑得飞快是我的特长，要来赛跑吗汪汪！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#f7e8d0', roofA: '#c86a2f', roofB: '#a85826', door: '#5a4a3a', accent: '#e8b070' },
  interior: {
    floorSvg: floorPlanks('#dfc49c', '#bfa47c'),
    wallSvg: wallPaws('#f7ead2', '#d8985a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#c86a2f', color2: '#f7e0b8' },
      { kind: 'rug', x: 0, z: 0.8, color: '#c86a2f', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🦴', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🏅', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#c86a2f', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#c86a2f', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f7e0b8', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#c86a2f', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
