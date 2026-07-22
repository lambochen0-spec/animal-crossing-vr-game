// 波加曼（Piplup）：冰蓝高傲的企鹅小屋
import type { VillagerProfile } from '../types';
import { floorChecker, wallSnow } from '../svg';

export const profile: VillagerProfile = {
  id: 'piplup',
  def: {
    name: '波加曼', height: 0.4, species: '企鹅宝可梦', color: 0x3a5a8c, belly: 0xe8f0f7, earType: 'penguin', catchphrase: '波加',
    lines: [
      '波加波加！河水冰冰的最舒服了，你也来泡泡吗？',
      '虽然我不会飞，但是我游泳可快了波加！',
      '作为岛上最神气的企鹅，我可是很注意仪表的波加！',
      '波加！肚子饿了，好想吃鱼……',
    ],
  },
  home: { x: 44, z: -78 },
  spawn: { x: 38, z: -72 },
  house: { wall: '#e3e9f5', roofA: '#4a6a9a', roofB: '#405e88', door: '#33486e', accent: '#8aa8d4' },
  interior: {
    floorSvg: floorChecker('#e8f0fa', '#c4d6ee'),
    wallSvg: wallSnow('#dfeafa', '#8ab4e8'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#4a6a9a', color2: '#e3e9f5' },
      { kind: 'rug', x: 0, z: 0.8, color: '#8aa8d4', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '❄️', color: '#cfe0f7' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '👑', color: '#ffd34d' },    // 王子大人的王冠
      { kind: 'table', x: 2.6, z: -3.6, color: '#8aa8d4', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#4a6a9a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#c4d6ee', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#4a6a9a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#e8f0ff' },
    ],
  },
};
