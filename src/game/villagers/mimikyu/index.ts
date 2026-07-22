// 谜拟Q（Mimikyu）：破布影子小屋，渴望朋友的怕寂寞鬼
import type { VillagerProfile } from '../types';
import { floorPlanks, wallDots } from '../svg';

export const profile: VillagerProfile = {
  id: 'mimikyu',
  def: {
    name: '谜拟Q', height: 0.2, species: '画皮宝可梦', color: 0xd9c9a8, belly: 0xb8a888, earType: 'mimikyu', catchphrase: '咪Q',
    lines: [
      '咪Q……你愿意和我说话，我好高兴……！',
      '这身布是我亲手缝的，歪掉的部分……不许笑哦咪Q！',
      '晚上一个人待着的时候，总觉得影子在动……咪Q！',
      '我想和大家做朋友……你能帮我保守这个愿望吗咪Q？',
    ],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 6, z: 6 },
  house: { wall: '#e8e0cd', roofA: '#8a7a5a', roofB: '#7a6a4a', door: '#5a4a32', accent: '#c9b890' },
  interior: {
    floorSvg: floorPlanks('#b8a888', '#9a8a6a'),
    wallSvg: wallDots('#e5dcc8', '#c5b694'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#8a7a5a', color2: '#e8e0cd' },
      { kind: 'rug', x: 0, z: 0.8, color: '#b8a888', w: 4.4, d: 3 },
      { kind: 'decor', x: 5.8, z: -3.2, emoji: '🕯️', color: '#c9b890' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#8a7a5a', color2: '#e8e0cd' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#b8a888', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#c9b890', color2: '#f7f0e0', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#7a6a4a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#ffe8b0' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#6a7a5a' },
    ],
  },
};
