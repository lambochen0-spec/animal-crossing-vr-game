// 波克比（Togepi）：蛋壳花纹小屋，天真烂漫的小家伙
import type { VillagerProfile } from '../types';
import { floorChecker, wallDots } from '../svg';

export const profile: VillagerProfile = {
  id: 'togepi',
  def: {
    name: '波克比', height: 0.3, species: '针球宝可梦', color: 0xf7f0e0, belly: 0xf2c94c, earType: 'togepi', catchphrase: '波克',
    lines: [
      '波克波克！今天的天气真好，适合滚来滚去！',
      '我昨天捡到一颗亮晶晶的石头，送给你当纪念吧波克！',
      '大家说我的壳上有幸运花纹，摸摸看会变好运哦波克！',
      '波克？你去过高原那边吗？我想去看星星波克！',
    ],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 6, z: 6 },
  house: { wall: '#f7f0e0', roofA: '#e88aa0', roofB: '#d97a90', door: '#b85a70', accent: '#f2c94c' },
  interior: {
    floorSvg: floorChecker('#fdf6e3', '#f2e3c0'),
    wallSvg: wallDots('#fdf0f2', '#e8a8b8'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#e88aa0', color2: '#f7f0e0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#f2c94c', w: 4.4, d: 3 },
      { kind: 'decor', x: 5.8, z: -3.2, emoji: '🥚', color: '#f7f0e0' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#e88aa0', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#f2c94c', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f2a8b8', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#d97a90', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff2c0' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#7ab86a' },
    ],
  },
};
