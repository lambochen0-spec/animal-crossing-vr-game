// 小卡比兽（Munchlax）：永远吃不饱的大胃王
import type { VillagerProfile } from '../types';
import { floorPlanks, wallDots } from '../svg';

export const profile: VillagerProfile = {
  id: 'munchlax',
  def: {
    name: '小卡比兽', height: 0.6, species: '大胃王宝可梦', color: 0x223f52, belly: 0xf7ecd0, earType: 'snorlax',
    catchphrase: ' munch', likes: ["apple", "cherry", "orange", "peach"],
    lines: ["肚子又饿了……你有什么吃的吗 munch？", "我每天都要吃和体重一样多的食物 munch！", "梦里有一座山，全是用冰淇淋堆起来的 munch……", "吃饱了就想睡，睡醒了就想吃，这就是幸福 munch。"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#e8e0d0', roofA: '#3a5a6a', roofB: '#2f4a58', door: '#5a4a3a', accent: '#8aa0ac' },
  interior: {
    floorSvg: floorPlanks('#d8c8a8', '#b8a888'),
    wallSvg: wallDots('#eef0ea', '#b0c0c8'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#3a5a6a', color2: '#f7ecd0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#3a5a6a', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🍙', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🍩', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#3a5a6a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#3a5a6a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f7ecd0', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#3a5a6a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
