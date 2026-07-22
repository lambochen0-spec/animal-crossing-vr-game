// 岩狗狗（Rockruff）：收集石头的元气小狗
import type { VillagerProfile } from '../types';
import { floorPlanks, wallPaws } from '../svg';

export const profile: VillagerProfile = {
  id: 'rockruff',
  def: {
    name: '岩狗狗', height: 0.5, species: '小狗宝可梦', color: 0xa87848, belly: 0xe8d8c0, earType: 'yamper',
    catchphrase: '岩岩', likes: ["apple"],
    lines: ["脖子上的石头是我的宝贝收藏，最亮的这块送你看看岩岩！", "闻到你的味道就知道你今天去了哪里岩岩！", "长大之后我会变成什么样呢？好期待岩岩！", "尾巴摇得停不下来了，因为见到你开心岩岩！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#f0e8da', roofA: '#8a6a48', roofB: '#705538', door: '#4a3a2a', accent: '#c8a878' },
  interior: {
    floorSvg: floorPlanks('#d9c4a4', '#b9a484'),
    wallSvg: wallPaws('#f2eadc', '#b08c5e'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#8a6a48', color2: '#e8d8c0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#8a6a48', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🪨', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🦴', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#8a6a48', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#8a6a48', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#e8d8c0', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#8a6a48', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
