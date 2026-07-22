// 小锻匠（Tinkatink）：梦想打出大锤的小小铁匠
import type { VillagerProfile } from '../types';
import { floorChecker, wallDots } from '../svg';

export const profile: VillagerProfile = {
  id: 'tinkatink',
  def: {
    name: '小锻匠', height: 0.3, species: '锤宝可梦', color: 0xd8a8b8, belly: 0xf0e8ea, earType: 'jigglypuff',
    catchphrase: '锻锻', likes: ["peach"],
    lines: ["我的锤子是亲手打的，以后还要打得更大更漂亮锻锻！", "废铁可是宝贝，收集起来能做好多东西锻锻！", "嘿咻、嘿咻，打铁的节奏最棒了锻锻！", "别看锤子重，我挥起来可灵活了锻锻！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#f4e8ec', roofA: '#8a7a8a', roofB: '#6f626f', door: '#5a4a5a', accent: '#d0b0c0' },
  interior: {
    floorSvg: floorChecker('#f6ecef', '#dcc4cc'),
    wallSvg: wallDots('#f5eaf0', '#c49aaa'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#8a7a8a', color2: '#f0e8ea' },
      { kind: 'rug', x: 0, z: 0.8, color: '#8a7a8a', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🔨', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '⚙️', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#8a7a8a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#8a7a8a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f0e8ea', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#8a7a8a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
