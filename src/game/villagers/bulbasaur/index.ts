// 妙蛙种子（Bulbasaur）：绿意盎然的植物园之家
import type { VillagerProfile } from '../types';
import { floorPlanks, wallLeaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'bulbasaur',
  def: {
    name: '妙蛙种子', height: 0.7, species: '种子宝可梦', color: 0x5ab8a0, belly: 0xd9f5e8, earType: 'bulbasaur', catchphrase: '种子',
    lines: [
      '种子种子~ 背上的种子今天也晒足了太阳，暖洋洋的。',
      '我最喜欢岛上的花了，你种了花吗种子？',
      '背上的种子好像又长大了一点，真期待它开花的那天种子！',
      '我收集了岛上所有的花哦，你想看看吗种子？',
    ],
  },
  home: { x: -44, z: -78 },
  spawn: { x: -38, z: -72 },
  house: { wall: '#dff5ec', roofA: '#5ab88a', roofB: '#4ca47a', door: '#3e8e6a', accent: '#6ac9a8' },
  interior: {
    floorSvg: floorPlanks('#c9a06a', '#a87f4e'),
    wallSvg: wallLeaves('#e8f7ec', '#6ac9a8'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#5ab88a', color2: '#dff5ec' },
      { kind: 'rug', x: 0, z: 0.8, color: '#8fd4ae', w: 4.4, d: 3 },
      { kind: 'plant', x: -7, z: -3.6, color: '#4a9a5a' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#5aaa4a' },
      { kind: 'plant', x: -7, z: 3.2, color: '#6aba5a' },
      { kind: 'plant', x: 6.9, z: 3.4, color: '#4a8e3e' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#a87f4e', color2: '#dff5ec' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#5ab88a', rotY: Math.PI },
      { kind: 'decor', x: 6, z: 2, emoji: '🌻', color: '#ffd34d' },
      { kind: 'dresser', x: -2, z: -4, color: '#5ab88a' },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff2c0' },
    ],
  },
};
