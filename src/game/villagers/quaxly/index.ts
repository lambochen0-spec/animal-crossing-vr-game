// 润水鸭（Quaxly）：爱干净的优雅小鸭
import type { VillagerProfile } from '../types';
import { floorChecker, wallWaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'quaxly',
  def: {
    name: '润水鸭', height: 0.5, species: '小鸭宝可梦', color: 0xf0f4f7, belly: 0xd0e8f7, earType: 'psyduck',
    catchphrase: '润润', likes: ["orange"],
    lines: ["头上的羽毛要用发胶定型，这是鸭子的体面润润！", "羽毛不沾水的秘密是每天认真涂油润润！", "地板脏了可不行，我来擦干净润润！", "游泳的姿势要优雅，看我的示范润润！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#eaf4fb', roofA: '#4a90c8', roofB: '#3c7aa8', door: '#2f5a80', accent: '#98ccf0' },
  interior: {
    floorSvg: floorChecker('#f0f8fd', '#c4def0'),
    wallSvg: wallWaves('#ecf5fb', '#82bde4'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#4a90c8', color2: '#f0f4f7' },
      { kind: 'rug', x: 0, z: 0.8, color: '#4a90c8', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🪶', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🫧', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#4a90c8', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#4a90c8', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f0f4f7', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#4a90c8', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
