// 卡比兽（Snorlax）：超大户型，睡觉与零食的天堂
import type { VillagerProfile } from '../types';
import { floorPlanks, wallStars } from '../svg';

export const profile: VillagerProfile = {
  id: 'snorlax',
  def: {
    name: '卡比兽', height: 2.1, species: '瞌睡宝可梦', color: 0x3d5a50, belly: 0xf7ecd0, earType: 'snorlax', catchphrase: '呼啊',
    lines: [
      '呼啊……摇树的时候轻一点，我正在树下打盹……',
      '肚子饿了……树上的树果，帮我摇两个下来吧呼啊……',
      '这座岛真安静啊，最适合睡午觉了，呼啊……',
      '刚吃完午饭就想睡觉，这一定就是幸福吧呼啊。',
    ],
  },
  home: { x: 72, z: -46 },
  spawn: { x: 64, z: -40 },
  house: { wall: '#dfe8e2', roofA: '#4a7a68', roofB: '#406a5c', door: '#3d5a50', accent: '#8fb5a5', big: true },
  interior: {
    floorSvg: floorPlanks('#b8c9be', '#96aa9e'),
    wallSvg: wallStars('#2e4a56', '#f7ecd0'),
    furniture: [
      { kind: 'bed', x: -4.6, z: -3.2, color: '#3d5a50', color2: '#f7ecd0', w: 4.6, d: 3.2 }, // 特大号床
      { kind: 'rug', x: 1.4, z: 0.8, color: '#4a7a68', w: 5, d: 3.4 },
      { kind: 'table', x: 3.2, z: -3.4, color: '#8a6a45', color2: '#f7ecd0' },
      { kind: 'decor', x: 3.2, z: -3.4, emoji: '🍎', color: '#e2453b' },  // 零食随手可及
      { kind: 'decor', x: 4.2, z: -3.2, emoji: '🍊', color: '#f28c28' },
      { kind: 'sofa', x: 6.2, z: 1.6, color: '#4a7a68', color2: '#f7ecd0', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 2.2, color: '#3d5a50', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -7.3, z: -4.7, color: '#f7ecd0' },
      { kind: 'decor', x: 6.9, z: -3.4, emoji: '💤', color: '#8fb5a5' },
      { kind: 'plant', x: -0.5, z: -3.8, color: '#5a9a4a' },
    ],
  },
};
