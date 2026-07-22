// 咚咚鼠（Dedenne）：橙色电波小屋，元气满满的迷你电工
import type { VillagerProfile } from '../types';
import { floorChecker, wallDots } from '../svg';

export const profile: VillagerProfile = {
  id: 'dedenne',
  def: {
    name: '咚咚鼠', height: 0.2, species: '天线宝可梦', color: 0xf2a65a, belly: 0xf7e8c9, earType: 'dedenne', catchphrase: '咚咚',
    lines: [
      '咚咚！让我用胡须帮你测测今天的运势电波！',
      '手机快没电了吗？我随时可以借你充一点咚咚！',
      '昨晚我把路灯的电偷吃了一点点……嘘——这是秘密咚咚！',
      '商店里的新品我看过了，今天最贵的那件超划算咚咚！',
    ],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 6, z: 6 },
  house: { wall: '#fdf2e0', roofA: '#f2a65a', roofB: '#e2924a', door: '#c97838', accent: '#f7d774' },
  interior: {
    floorSvg: floorChecker('#fdf2e0', '#f2ddba'),
    wallSvg: wallDots('#fdf6ea', '#f0cf9a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#f2a65a', color2: '#fdf2e0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#f7d774', w: 4.4, d: 3 },
      { kind: 'decor', x: 5.8, z: -3.2, emoji: '🔌', color: '#f2a65a' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#f2a65a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#f7d774', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f7c98a', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#e2924a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff2c0' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#7ab86a' },
    ],
  },
};
