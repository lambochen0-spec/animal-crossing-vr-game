// 小火猴（Chimchar）：停不下来的顽皮猴
import type { VillagerProfile } from '../types';
import { floorPlanks, wallFlames } from '../svg';

export const profile: VillagerProfile = {
  id: 'chimchar',
  def: {
    name: '小火猴', height: 0.5, species: '小猴宝可梦', color: 0xe8884a, belly: 0xf7e0b8, earType: 'dedenne',
    catchphrase: '火猴', likes: ["peach"],
    lines: ["翻跟头、爬树、荡秋千，没有我做不到的火猴！", "屁股上的火苗睡着了也不会灭，厉害吧火猴！", "下雨天火苗会变弱，那时候就乖乖待在屋里火猴！", "比谁爬树爬得快？我不会输火猴！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#fae8d0', roofA: '#c8642f', roofB: '#a85426', door: '#5a4232', accent: '#e8a868' },
  interior: {
    floorSvg: floorPlanks('#e4c9a2', '#c4a982'),
    wallSvg: wallFlames('#fae9d2', '#e89868'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#c8642f', color2: '#f7e0b8' },
      { kind: 'rug', x: 0, z: 0.8, color: '#c8642f', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🔥', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🍌', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#c8642f', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#c8642f', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f7e0b8', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#c8642f', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
