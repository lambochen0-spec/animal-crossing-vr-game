// 可达鸭（Psyduck）：蓝色水漾小屋，总有点迷迷糊糊
import type { VillagerProfile } from '../types';
import { floorChecker, wallDots } from '../svg';

export const profile: VillagerProfile = {
  id: 'psyduck',
  def: {
    name: '可达鸭', height: 0.8, species: '鸭宝可梦', color: 0xf7d24a, belly: 0xfff3c0, earType: 'psyduck', catchphrase: '可达',
    lines: [
      '可达？我刚才要说什么来着……头好痛……',
      '可达可达！桥那边的风景……咦，我为什么要去那边？',
      '钓鱼的诀窍是……可达？什么诀窍来着？',
      '你手里拿的是什么？可达可达！给我看看！',
    ],
  },
  home: { x: 16, z: -46 },
  spawn: { x: 22, z: -40 },
  house: { wall: '#f5eedf', roofA: '#e8c33b', roofB: '#d4aa30', door: '#b8902a', accent: '#f7d774' },
  interior: {
    floorSvg: floorChecker('#cfe8f7', '#a8d4ee'),
    wallSvg: wallDots('#e3f2fb', '#8ec3e8'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#5a9ac9', color2: '#f7d774' },
      { kind: 'rug', x: 0, z: 0.8, color: '#8ec3e8', w: 4.4, d: 3 },
      { kind: 'decor', x: 5.8, z: -3.2, emoji: '🛟', color: '#f7d774' },  // 游泳圈：随时泡水
      { kind: 'table', x: 2.6, z: -3.6, color: '#f7d774', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#5a9ac9', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#a8d4ee', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#5a9ac9', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff2c0' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#5a9a8a' },
    ],
  },
};
