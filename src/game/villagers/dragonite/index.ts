// 快龙（Dragonite）：橙云小屋，温柔可靠的空中快递员
import type { VillagerProfile } from '../types';
import { floorChecker, wallSnow } from '../svg';

export const profile: VillagerProfile = {
  id: 'dragonite',
  def: {
    name: '快龙', height: 2.2, species: '龙宝可梦', color: 0xf2a65a, belly: 0xf7e8c9, earType: 'dragonite', catchphrase: '吼呜',
    lines: [
      '吼呜~ 要我带你绕岛飞一圈吗？抓稳了哦！',
      '别看我个头大，收快递我可是全岛最快的吼呜！',
      '海那边的风景很棒，改天我带你去看看吼呜。',
      '遇到困难的宝可梦，我都会去帮忙。这是我的信条吼呜！',
    ],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 6, z: 6 },
  house: { wall: '#fdf2e2', roofA: '#4a8ec9', roofB: '#3a7eb9', door: '#2a6a9a', accent: '#f2a65a', big: true },
  interior: {
    floorSvg: floorChecker('#f7ecd9', '#eadcba'),
    wallSvg: wallSnow('#eef4fb', '#b8d4ea'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#4a8ec9', color2: '#f7e8c9' },
      { kind: 'rug', x: 0, z: 0.8, color: '#f2a65a', w: 4.4, d: 3 },
      { kind: 'decor', x: 5.8, z: -3.2, emoji: '📮', color: '#4a8ec9' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#4a8ec9', color2: '#fdf2e2' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#f2a65a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#8ec3e8', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#3a7eb9', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff2c0' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#5a9a4a' },
    ],
  },
};
