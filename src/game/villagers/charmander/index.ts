// 小火龙（Charmander）：暖洋洋的火焰之家
import type { VillagerProfile } from '../types';
import { floorPlanks, wallFlames } from '../svg';

export const profile: VillagerProfile = {
  id: 'charmander',
  def: {
    name: '小火龙', height: 0.6, species: '蜥蜴宝可梦', color: 0xf59b42, belly: 0xffe8b0, earType: 'charmander', catchphrase: '呜嗷',
    lines: [
      '呜嗷！今天也是元气满满的一天！尾巴的火焰也很精神！',
      '下雨天要小心尾巴上的火焰，呜嗷……所以我每天都看天气预报！',
      '比赛跑步吧！输了的人要做一百个深蹲，呜嗷！',
      '听说桥那边的风景最适合晨练了，呜嗷！',
    ],
  },
  home: { x: -16, z: -46 },
  spawn: { x: -10, z: -40 },
  house: { wall: '#f5e3d5', roofA: '#e8763b', roofB: '#d4682f', door: '#b5502a', accent: '#f29a4a' },
  interior: {
    floorSvg: floorPlanks('#8a5a3b', '#6e452b'),
    wallSvg: wallFlames('#f7e0cc', '#f2a05a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#e8763b', color2: '#fde8c0' },
      { kind: 'rug', x: 0.4, z: 0.8, color: '#d4682f', w: 4.4, d: 3 },
      { kind: 'decor', x: 5.9, z: -3.6, emoji: '🔥', color: '#8a5a3b', w: 2 }, // 壁炉
      { kind: 'table', x: 2.4, z: -3.4, color: '#8a5a3b', color2: '#fde8c0' },
      { kind: 'chair', x: 2.4, z: -2, color: '#e8763b', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f29a4a', color2: '#fde8c0', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#8a5a3b', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#ffcf8a' },
      { kind: 'decor', x: 6.9, z: 0.6, emoji: '🌶️', color: '#e2453b' },
    ],
  },
};
