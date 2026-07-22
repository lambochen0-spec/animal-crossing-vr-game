// 炎兔儿（Scorbunny）：火红运动小屋，停不下来的元气飞毛腿
import type { VillagerProfile } from '../types';
import { floorChecker, wallFlames } from '../svg';

export const profile: VillagerProfile = {
  id: 'scorbunny',
  def: {
    name: '炎兔儿', height: 0.3, species: '兔子宝可梦', color: 0xf7f7f7, belly: 0xf7d774, earType: 'scorbunny', catchphrase: '蹦跳',
    lines: [
      '蹦跳！来一场赛跑吧！输的人要请大家喝果汁！',
      '脚底热起来就说明状态绝佳！今天也要跑遍全岛蹦跳！',
      '博物馆后面的坡道超适合冲刺的，你也来试试蹦跳！',
      '嘿嘿，我把宝藏埋在了……啊，差点说漏嘴了蹦跳！',
    ],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 6, z: 6 },
  house: { wall: '#fdf0e8', roofA: '#e85a3a', roofB: '#d84a2a', door: '#b83a20', accent: '#f7b88a' },
  interior: {
    floorSvg: floorChecker('#fdf2ec', '#f2d8c8'),
    wallSvg: wallFlames('#fdeee8', '#f0a888'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#e85a3a', color2: '#fdf0e8' },
      { kind: 'rug', x: 0, z: 0.8, color: '#f7b88a', w: 4.4, d: 3 },
      { kind: 'decor', x: 5.8, z: -3.2, emoji: '⚽', color: '#e85a3a' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#e85a3a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#f7b88a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f7a87a', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#d84a2a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#ffd9a0' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#7ab86a' },
    ],
  },
};
