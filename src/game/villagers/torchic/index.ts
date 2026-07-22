// 火稚鸡（Torchic）：绒毛里暖呼呼的雏鸡
import type { VillagerProfile } from '../types';
import { floorChecker, wallDots } from '../svg';

export const profile: VillagerProfile = {
  id: 'torchic',
  def: {
    name: '火稚鸡', height: 0.4, species: '雏鸡宝可梦', color: 0xf2a03a, belly: 0xffe0a8, earType: 'rowlet',
    catchphrase: '稚稚', likes: ["peach"],
    lines: ["我的绒毛里暖暖的，抱一下就不想放手稚稚！", "每天清晨我都第一个起床打鸣……咳咳，还小，声音不大稚稚。", "翅膀还小飞不高，但是跑得可快了稚稚！", "肚子里有一团火，吹气都是暖暖的稚稚！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#fff0d8', roofA: '#e8783a', roofB: '#c86430', door: '#8a5a2f', accent: '#f2c88a' },
  interior: {
    floorSvg: floorChecker('#fff4e0', '#f2d8a8'),
    wallSvg: wallDots('#fff0da', '#f0a86a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#e8783a', color2: '#ffe0a8' },
      { kind: 'rug', x: 0, z: 0.8, color: '#e8783a', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🐣', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🔥', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#e8783a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#e8783a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#ffe0a8', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#e8783a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
