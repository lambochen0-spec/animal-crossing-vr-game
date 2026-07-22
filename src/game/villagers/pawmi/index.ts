// 布拨（Pawmi）：肉球放电的小小电工
import type { VillagerProfile } from '../types';
import { floorChecker, wallDots } from '../svg';

export const profile: VillagerProfile = {
  id: 'pawmi',
  def: {
    name: '布拨', height: 0.3, species: '鼠宝可梦', color: 0xe8a04a, belly: 0xfff4e0, earType: 'dedenne',
    catchphrase: '布拨', likes: ["orange"],
    lines: ["手掌的肉球会放电，握手的时候要小心布拨！", "搓搓脸颊，电力就充满啦布拨！", "小小的身体，大大的电力布拨！", "静电让毛都炸开了？这叫时尚布拨！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#fff0dc', roofA: '#e8933a', roofB: '#c87e30', door: '#8a6a3a', accent: '#f2c078' },
  interior: {
    floorSvg: floorChecker('#fff6e6', '#f2d8ac'),
    wallSvg: wallDots('#fff2de', '#f0b070'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#e8933a', color2: '#fff4e0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#e8933a', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '⚡', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🍊', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#e8933a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#e8933a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#fff4e0', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#e8933a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
