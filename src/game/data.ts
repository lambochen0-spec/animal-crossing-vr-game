// 游戏静态数据：物品、生物、对话、配方价格
export type ToolId = 'hand' | 'net' | 'rod' | 'shovel' | 'axe';

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  price: number; // 出售价
  category: 'fruit' | 'bug' | 'fish' | 'flower' | 'material' | 'plant' | 'furniture' | 'use' | 'seed';
  desc: string;
}

export const ITEMS: Record<string, ItemDef> = {
  apple:       { id: 'apple',       name: '苹野果', icon: '🍎', price: 100, category: 'fruit', desc: '香甜的树果，宝可梦也很喜欢' },
  cherry:      { id: 'cherry',      name: '樱子果', icon: '🍒', price: 120, category: 'fruit', desc: '成双成对的红色树果' },
  orange:      { id: 'orange',      name: '橙橙果', icon: '🍊', price: 100, category: 'fruit', desc: '多汁的树果，能恢复体力' },
  peach:       { id: 'peach',       name: '桃桃果', icon: '🍑', price: 150, category: 'fruit', desc: '毛茸茸的粉色树果' },
  butterfly:   { id: 'butterfly',   name: '凤蝶',   icon: '🦋', price: 240, category: 'bug', desc: '在花丛间翩翩起舞' },
  tigerfly:    { id: 'tigerfly',    name: '虎斑蝶', icon: '🦋', price: 300, category: 'bug', desc: '有着老虎斑纹的蝴蝶' },
  dragonfly:   { id: 'dragonfly',   name: '蜻蜓',   icon: '🪰', price: 360, category: 'bug', desc: '飞得又快又稳' },
  firefly:     { id: 'firefly',     name: '萤火虫', icon: '✨', price: 400, category: 'bug', desc: '夜里的小灯笼' },
  crucian:     { id: 'crucian',     name: '鲫鱼',   icon: '🐟', price: 160, category: 'fish', desc: '河里最常见的鱼' },
  carp:        { id: 'carp',        name: '鲤鱼',   icon: '🐟', price: 300, category: 'fish', desc: '据说能带来好运' },
  bass:        { id: 'bass',        name: '鲈鱼',   icon: '🐠', price: 400, category: 'fish', desc: '力气很大的家伙' },
  koi:         { id: 'koi',         name: '锦鲤',   icon: '🐡', price: 800, category: 'fish', desc: '华丽又稀有！' },
  fossil:      { id: 'fossil',      name: '化石',   icon: '🦴', price: 500, category: 'material', desc: '远古生物的遗迹' },
  gyroid:      { id: 'gyroid',      name: '陶俑',   icon: '🗿', price: 350, category: 'material', desc: '会发出奇妙声音的陶俑' },
  iron:        { id: 'iron',        name: '铁矿石', icon: '🔩', price: 200, category: 'material', desc: '可以打造工具的矿石' },
  stone:       { id: 'stone',       name: '石头',   icon: '🌑', price: 60,  category: 'material', desc: '普通的石头' },
  flower_red:    { id: 'flower_red',    name: '红玫瑰', icon: '🌹', price: 80, category: 'flower', desc: '热情的红色花朵' },
  flower_yellow: { id: 'flower_yellow', name: '黄郁金香', icon: '🌷', price: 80, category: 'flower', desc: '明亮的黄色花朵' },
  flower_white:  { id: 'flower_white',  name: '白雏菊', icon: '🌼', price: 80, category: 'flower', desc: '纯洁的白色花朵' },
  sapling:     { id: 'sapling',     name: '树苗',   icon: '🌱', price: 100, category: 'plant', desc: '种下去会长成果树' },
  seedbag:     { id: 'seedbag',     name: '花种子', icon: '🌾', price: 40, category: 'plant', desc: '种下去会开出鲜花' },
  branch:      { id: 'branch',      name: '树枝',   icon: '🍃', price: 5,  category: 'material', desc: '随处可见的细树枝，是DIY的基础材料' },
  wood:        { id: 'wood',        name: '木材',   icon: '🪵', price: 60, category: 'material', desc: '用斧头砍树获得的结实木材' },
  weed:        { id: 'weed',        name: '杂草',   icon: '🌿', price: 10, category: 'material', desc: '拔下来的杂草，也能卖点钱' },
  ore_copper:  { id: 'ore_copper',  name: '铜矿石', icon: '🔶', price: 120, category: 'material', desc: '矿洞一层挖到的橙色矿石，可以升级铲子' },
  ore_iron:    { id: 'ore_iron',    name: '铁矿石', icon: '🔩', price: 260, category: 'material', desc: '矿洞二层挖到的银灰矿石，可以升级铲子' },
  ore_gold:    { id: 'ore_gold',    name: '金矿石', icon: '🌟', price: 520, category: 'material', desc: '矿洞三层挖到的稀有矿石，价值不菲' },
  photo:       { id: 'photo',       name: '宝可梦照片', icon: '📷', price: 0, category: 'furniture', desc: '和宝可梦好友的珍贵合影，无价之宝' },
  diamond:     { id: 'diamond',     name: '钻石', icon: '💎', price: 2000, category: 'material', desc: '矿洞三层偶尔才能挖到的稀有宝石，开店必备' },
  deed:        { id: 'deed',        name: '店铺地契', icon: '📜', price: 0, category: 'use', desc: '拿在手上，对着心仪的空地按 E，就能把冰淇淋店建在那里' },
};

// 商店商品并入物品库（家具可摆放、日用品可使用、种子可种）
import { SHOP_CATALOG } from './shopgoods';
for (const g of SHOP_CATALOG) {
  ITEMS[g.id] = { id: g.id, name: g.name, icon: g.icon, price: Math.floor(g.price / 4), category: g.cat, desc: g.desc };
}

export const TOOLS: { id: ToolId; name: string; icon: string; hint: string }[] = [
  { id: 'hand',   name: '空手', icon: '✋', hint: '摇晃果树 / 拾取 / 交谈' },
  { id: 'net',    name: '虫网', icon: 'svg:net', hint: '靠近昆虫按 E 捕捉' },
  { id: 'rod',    name: '鱼竿', icon: 'svg:rod', hint: '对着水面按 E 蓄力抛竿' },
  { id: 'shovel', name: '铲子', icon: 'svg:shovel', hint: '挖掘星形土坑 / 敲石头 / 铲起花草' },
  { id: 'axe',    name: '斧头', icon: 'svg:axe', hint: '对着树木按 E 砍伐，可获得木材' },
];

export const SHOP_GOODS = [
  { itemId: 'sapling', price: 200 },
  { itemId: 'seedbag', price: 80 },
];

export const FRUIT_IDS = ['apple', 'cherry', 'orange', 'peach'];
export const FLOWER_IDS = ['flower_red', 'flower_yellow', 'flower_white'];
// 铲起的花苗（可重新种植）
for (const fid of FLOWER_IDS) {
  const base = ITEMS[fid];
  ITEMS[fid + '_plant'] = { id: fid + '_plant', name: base.name + '花苗', icon: '🌱', price: base.price, category: 'seed', desc: '铲子铲起的花苗，可以重新种回土里' };
}

// 铲起的果树苗（保留品种，可重新移栽）
for (const fid of FRUIT_IDS) {
  const base = ITEMS[fid];
  ITEMS['sapling_' + fid] = { id: 'sapling_' + fid, name: base.name + '树苗', icon: '🌱', price: 200, category: 'plant', desc: '吃饱后铲起的果树苗，种下去会长回原来的果树' };
}

export const BUG_DEFS = [
  { itemId: 'butterfly', color: 0xffffff, accent: 0x4aa3ff, night: false, weight: 5 },
  { itemId: 'tigerfly',  color: 0xffb347, accent: 0x222222, night: false, weight: 3 },
  { itemId: 'dragonfly', color: 0x66ddff, accent: 0x226688, night: false, weight: 2 },
  { itemId: 'firefly',   color: 0x334422, accent: 0xd8ff6a, night: true,  weight: 4 },
];

export const FISH_DEFS = [
  { itemId: 'crucian', size: 0.7, weight: 5 },
  { itemId: 'carp',    size: 0.9, weight: 3 },
  { itemId: 'bass',    size: 1.1, weight: 2 },
  { itemId: 'koi',     size: 1.0, weight: 1 },
];

// 村民定义已按宝可梦拆分到独立文件夹：src/game/villagers/{宝可梦名}/index.ts
export type { VillagerDef } from './villagers';
import { VILLAGER_PROFILES } from './villagers';
import type { VillagerDef } from './villagers';
export const VILLAGERS: VillagerDef[] = VILLAGER_PROFILES.map(p => p.def);

// 皮卡丘（广场向导）
export const PIKACHU_NAME = '皮卡丘';
export const PIKACHU_LINES = [
  '皮卡皮卡！我是皮卡丘，负责岛上居民的事务，有什么需要帮忙的尽管说哦！',
  '皮卡！今天的岛上也很和平呢。记得去听听伙伴们的烦恼哦！',
  '皮卡皮卡——丘！（小提示：摇树会掉树枝，星形的痕迹下面埋着宝贝！）',
  '喵喵社长就在友好商店前面，移居套餐的事情找它准没错皮卡！',
  '皮卡~ 按时吃饭、按时睡觉，岛上的生活节奏最重要啦~',
  '想要了解什么，就看看布告栏吧，我会定期更新小贴士的皮卡！',
];

export const SHOPKEEPER_LINES = [
  '欢迎光临友好商店！想买点什么，或者卖点什么喵？',
  '哟，来啦！今天的收购价可是童叟无欺喵。',
  '树苗和花种子都有货，把岛打扮得漂漂亮亮的吧喵！',
];

// ---------------- 喵喵（喵喵商会社长） ----------------
export const NOOK_NAME = '喵喵';

export const NOOK_INTRO = [
  '欢迎来到「像素小岛」！我是喵喵商会的社长喵喵，这次的无人岛移居套餐计划就由我全程负责喵！',
  '你的帐篷已经帮你搭好了，就在广场东北边。其他的宝可梦伙伴也都住进了自己的帐篷喵~',
  '那么，岛上生活的第一件事——去捡 10 根树枝来吧！营火晚会的柴火就靠你了喵！树枝可以在树下捡，摇树也会掉哦。',
];

export const NOOK_QUESTS: {
  id: string;
  title: string;
  need: number;
  hint: string;
  turnIn: string[];   // 交付时喵喵说的话
  rewardMiles: number;
  rewardText?: string;
}[] = [
  {
    id: 'branch', title: '捡 10 根树枝', need: 10,
    hint: '树下可以找到树枝，摇树也会掉',
    turnIn: ['哦——！10根树枝都齐了喵！营火的燃料足够了！', '接下来需要一些吃的。去摘 6 个树果回来吧，摇一摇果树就会掉下来喵！'],
    rewardMiles: 500,
  },
  {
    id: 'fruit', title: '摘 6 个树果', need: 6,
    hint: '摇一摇岛上的果树',
    turnIn: ['新鲜的树果！这样晚会的准备就全部完成了喵。', '今晚就是营火晚会！从今天起你就是这座岛的岛民代表了喵！', '对了，这是你的移居套餐请款单……49,800 金币的费用，可以用 5,000 喵喵积分来抵销喵。积分可以通过完成岛上的各种目标来获得！'],
    rewardMiles: 800,
  },
  {
    id: 'diy', title: '找喵喵学习DIY', need: 1,
    hint: '去友好商店找喵喵对话',
    turnIn: ['想要在这座岛上生活，DIY可是基础中的基础喵！', '看好了——用捡来的树枝就能做出工具！这把「简陋钓竿」「简陋虫网」和「简陋斧头」就送给你喵！', '去钓一条鱼来给我看看吧喵！'],
    rewardMiles: 500, rewardText: '学会了DIY！获得了 鱼竿、虫网 和 斧头！',
  },
  {
    id: 'fish', title: '钓 1 条鱼给喵喵', need: 1,
    hint: '装备鱼竿对着河面按 E，浮漂下沉瞬间拉杆',
    turnIn: ['哦！这条鱼可真精神喵！图鉴已经帮你登记上了。', '接下来去抓一只虫子来吧，用虫网靠近蝴蝶按 E 就行喵！'],
    rewardMiles: 800,
  },
  {
    id: 'bug', title: '抓 1 只虫给喵喵', need: 1,
    hint: '装备虫网，靠近蝴蝶按 E',
    turnIn: ['漂亮的虫子！你对生物很有研究的天赋喵。', '对了，这个「铲子」给你。岛上偶尔能看到星形的痕迹，挖挖看会有好东西喵！去挖一块化石来吧！'],
    rewardMiles: 800, rewardText: '获得了 铲子！',
  },
  {
    id: 'fossil', title: '挖 1 块化石给喵喵', need: 1,
    hint: '装备铲子，挖掘地上的星形痕迹',
    turnIn: ['这可是真正的化石喵！这座岛的历史真了不起……', '等你攒够 5,000 喵喵积分，就可以抵销移居套餐的费用，到时候帐篷就能改建成真正的房子喵！'],
    rewardMiles: 1000,
  },
  {
    id: 'debt', title: '攒 5000 积分偿还移居套餐', need: 5000,
    hint: '完成任务、钓鱼抓虫、卖出物品都能获得积分',
    turnIn: ['5,000 积分，一分不少！移居套餐的费用全部结清了喵！', '按照约定，你的帐篷现在就可以改建成房子了——施工开始！……好了！恭喜乔迁新居喵！', '对了，广场北边的博物馆正在募集展品。抓到的虫、钓到的鱼、挖到的化石，都可以带去捐给傅达喵！'],
    rewardMiles: 0,
  },
  {
    id: 'museum', title: '给博物馆捐赠 3 件展品', need: 3,
    hint: '进入博物馆找傅达，捐赠虫、鱼或化石',
    turnIn: ['3 件展品！傅达高兴得翅膀都拍起来了喵。博物馆因为你变得越来越像样了！', '接下来试试做生意吧——把岛上采到的东西卖给友好商店的豆狸，赚 3,000 金币来看看喵！'],
    rewardMiles: 1000,
  },
  {
    id: 'earn', title: '卖东西累计赚 3000 金币', need: 3000,
    hint: '树果、鱼、虫、化石都能卖给友好商店',
    turnIn: ['3,000 金币！你很有做生意的天赋喵！', '赚了钱也要懂得装点生活喵。去商店买些树苗或花种，种下 3 株植物吧！'],
    rewardMiles: 1000,
  },
  {
    id: 'plant', title: '种下 3 株植物', need: 3,
    hint: '把树苗或花种拿在手上，对草地按 E 种植',
    turnIn: ['小岛变得越来越漂亮了喵！', '住在岛上，和伙伴们的感情也很重要。去和村民们聊聊天吧，认识 5 位朋友喵！'],
    rewardMiles: 800,
  },
  {
    id: 'friend', title: '和村民聊天 5 次', need: 5,
    hint: '找到岛上的宝可梦伙伴，按 E 打招呼',
    turnIn: ['大家都夸你是个好邻居喵！', '最后一件事——你的房子还可以扩建！只要 49,800 金币，就能让家变得更宽敞。攒够了随时来找我喵！'],
    rewardMiles: 800,
  },
  {
    id: 'debt2', title: '偿还 49,800 金币扩建房贷', need: 49800,
    hint: '卖东西攒金币，找喵喵还款',
    turnIn: ['49,800 金币，全部结清喵！', '扩建工程——开工！……完成！看看你的新家，是不是宽敞多了喵！', '对了喵，看你这么能干，我有个大胆的提议——要不要在岛上开一家属于自己的店？这是「经营手册」，拿着它去收集材料吧喵！'],
    rewardMiles: 0, rewardText: '获得了经营手册！下一个目标：收集开店材料',
  },
  {
    id: 'openshop', title: '收集开店材料', need: 175,
    hint: '木材×100（砍树）＋ 石头×20（挖矿/捡）＋ 金矿×50（矿洞三层）＋ 钻石×5（三层稀有掉落），找喵喵交付，可以分批',
    turnIn: ['太棒了喵！材料全部到齐！这是「店铺地契」——选址的权力就交给你了喵！', '把地契拿在手上，在岛上找一块你心仪的空地按 E，施工队马上把冰淇淋店建起来喵！', '建好以后玩法很简单：①摇树摘水果 ②到摊位把水果放进食材箱（5 个就能开一天）③点开始营业，岛上的大家就会排队来买喵！', '每位顾客 +100 金币，接待得越多手艺越熟练，还会解锁新口味、卖出更好的价钱喵！'],
    rewardMiles: 2000, rewardText: '获得了店铺地契！找块空地建店吧',
  },
];

// ---------------- 商店店员 豆狸 & 博物馆馆长 傅达 ----------------
export const SHOPKEEPER_DEF: VillagerDef = {
  name: '豆狸', species: '狸猫', color: 0x9a6a3f, belly: 0xe8d0a8, earType: 'meowth',
  height: 0.4, catchphrase: '狸',
  lines: ['欢迎光临狸！', '今天的收购价很不错狸！'],
};
export const OWL_DEF: VillagerDef = {
  name: '傅达', species: '猫头鹰', color: 0x7a5a8a, belly: 0xe8d8c0, earType: 'penguin',
  height: 0.5, catchphrase: '呼',
  lines: ['呼……'],
};
export const OWL_LINES = [
  '欢迎来到博物馆呼。展品还在募集中，虫、鱼、化石都可以捐赠给我呼。',
  '博物馆的工作就是守护这座岛的历史呼。有了新发现记得带来呼。',
  '呼……啊，抱歉，刚才差点睡着了。白天对我们猫头鹰来说太难熬了呼。',
];

export const NOOK_IDLE_LINES = [
  '岛上的生活还习惯吗喵？有什么事都可以来找我。',
  '喵喵积分可是好东西，记得看看当前的目标喵。',
  '友好商店会收购你带来的任何东西，尽管拿去卖喵！',
];

export const BOARD_TIPS = [
  '📋 岛民公告：\nWASD 移动，Shift 奔跑，E 互动，1-4 切换工具，拖动鼠标或 Q/E 旋转视角。',
  '📋 钓鱼小贴士：\n装备鱼竿对着河面按 E 抛竿，浮漂「扑通」下沉的瞬间再按 E 拉杆！',
  '📋 捕虫小贴士：\n装备虫网，悄悄靠近蝴蝶，距离够近时按 E 就能抓到。',
  '📋 赚钱小贴士：\n树果、鱼、虫、化石都能卖给友好商店。敲石头偶尔也会掉零钱袋！',
  '📋 种植小贴士：\n在商店买树苗或花种，拿在手上对空地按 E 就能种下去。',
  '📋 开店小贴士：\n冰淇淋店每天放入 5 个水果就能营业。顾客越多熟练度越高，能解锁新口味卖更好的价钱！',
  '📋 挖矿小贴士：\n矿洞越深矿石越好。三层除了金矿，偶尔还能挖到闪闪发光的钻石！',
];

export const GIFT_LINES = [
  '对了，这个送给你！就当是见面礼~',
  '啊，正好！这个给你，是我在河边捡到的。',
  '拿着拿着！朋友之间不用客气！',
];

export function weightedPick<T extends { weight: number }>(defs: T[]): T {
  const total = defs.reduce((s, d) => s + d.weight, 0);
  let r = Math.random() * total;
  for (const d of defs) { r -= d.weight; if (r <= 0) return d; }
  return defs[0];
}
