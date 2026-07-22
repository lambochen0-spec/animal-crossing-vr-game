// 敲音猴（Grookey）：用树枝打拍子的节奏大师
import type { VillagerProfile } from '../types';
import { floorChecker, wallLeaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'grookey',
  def: {
    name: '敲音猴', height: 0.3, species: '小猴宝可梦', color: 0x7ab86a, belly: 0xe8f0d8, earType: 'dedenne',
    catchphrase: '敲敲', likes: ["apple"],
    lines: ["咚咚！用树枝敲一敲，花草就会精神起来敲敲！", "听！这个节奏怎么样？我自己编的敲敲！", "树枝是我的宝贝，谁都不许碰敲敲！", "敲着敲着，整个森林都会跟着摇摆敲敲！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#e4f0da', roofA: '#5a9448', roofB: '#4a7c3c', door: '#6a4a2f', accent: '#a0cc8e' },
  interior: {
    floorSvg: floorChecker('#ecf4e2', '#c6ddb0'),
    wallSvg: wallLeaves('#e8f2de', '#84b96e'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#5a9448', color2: '#e8f0d8' },
      { kind: 'rug', x: 0, z: 0.8, color: '#5a9448', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🥁', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🌿', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#5a9448', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#5a9448', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#e8f0d8', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#5a9448', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
