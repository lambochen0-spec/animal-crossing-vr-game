// 水跃鱼（Mudkip）：力大无穷的泥中健将
import type { VillagerProfile } from '../types';
import { floorChecker, wallWaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'mudkip',
  def: {
    name: '水跃鱼', height: 0.4, species: '泥鱼宝可梦', color: 0x4a8ad0, belly: 0xf7b45a, earType: 'charmander',
    catchphrase: '水跃', likes: ["orange"],
    lines: ["头上的鳍能感知水流，今天适合钓鱼水跃！", "在泥里打滚最舒服了，你也试试水跃？", "别小看我的力气，我能举起大石头水跃！", "河底的沙子软软凉凉的，踩上去好舒服水跃！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#d8ecfa', roofA: '#e89a4a', roofB: '#c8843a', door: '#3a6aa8', accent: '#8ac0e8' },
  interior: {
    floorSvg: floorChecker('#e4f2fa', '#b0d4ea'),
    wallSvg: wallWaves('#e0f0fa', '#f2a05a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#e89a4a', color2: '#4a8ad0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#e89a4a', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🐟', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🪨', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#e89a4a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#e89a4a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#4a8ad0', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#e89a4a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
