// 友好商店商品目录（100 种，对标原版 Nook's Cranny：家具/摆设/日用品/种子）
// 每日从目录中轮换 8 件上架
export interface ShopGood {
  id: string; name: string; icon: string; price: number;
  cat: 'furniture' | 'use' | 'seed';
  shape: string; c1: string; c2: string;
  desc: string;
  set?: string;   // 所属家具系列 id（series.ts），有贴图的整套家具
}

type G = [string, string, string, number, ShopGood['cat'], string, string, string, string];
const RAW: G[] = [
  // ---- 椅子类 ----
  ['f_chair_wood', '木椅', '🪑', 480, 'furniture', 'chair', '#a87f4e', '#8a6239', '朴素的木制椅子，可以摆放在家里'],
  ['f_chair_red', '红漆椅', '🪑', 520, 'furniture', 'chair', '#e84a3a', '#8a6239', '亮眼的红色椅子'],
  ['f_chair_blue', '蓝布椅', '🪑', 520, 'furniture', 'chair', '#4aa3ff', '#5a7a9a', '蓝色软垫椅子'],
  ['f_chair_green', '绿藤椅', '🪑', 560, 'furniture', 'chair', '#5ab88a', '#3e6e2a', '藤编田园椅'],
  ['f_armchair_beige', '米色单人沙发', '🛋️', 1200, 'furniture', 'armchair', '#e8d5a8', '#c9b98f', '软绵绵的单人沙发'],
  ['f_armchair_pink', '粉色单人沙发', '🛋️', 1280, 'furniture', 'armchair', '#f2a8c0', '#e88aa8', '少女心爆棚'],
  ['f_sofa_blue', '蓝色双人沙发', '🛋️', 2400, 'furniture', 'sofa', '#4a6a9a', '#7a9ac9', '可以坐两个人的大沙发'],
  ['f_sofa_green', '绿色双人沙发', '🛋️', 2400, 'furniture', 'sofa', '#4a8e5a', '#8ac9a0', '森林系布艺沙发'],
  ['f_sofa_orange', '橘色双人沙发', '🛋️', 2600, 'furniture', 'sofa', '#e8763b', '#f7c08a', '活力满满的沙发'],
  ['f_stool_wood', '圆木凳', '🪑', 320, 'furniture', 'stool', '#c9a86a', '#8a6239', '便宜实用的小凳子'],
  ['f_stool_pink', '粉色圆凳', '🪑', 360, 'furniture', 'stool', '#f2a8c0', '#c98aa0', '圆滚滚的可爱凳子'],
  ['f_cushion_yellow', '黄色坐垫', '🟨', 400, 'furniture', 'cushion', '#f7d02c', '#e8b020', '直接铺在地上坐'],
  ['f_cushion_blue', '蓝色坐垫', '🟦', 400, 'furniture', 'cushion', '#4aa3ff', '#2a7ad0', '软乎乎的蓝色坐垫'],
  // ---- 桌子类 ----
  ['f_table_wood', '木桌', '🪵', 800, 'furniture', 'table', '#a87f4e', '#8a6239', '百搭的木桌'],
  ['f_table_white', '白色圆桌', '⬜', 960, 'furniture', 'table', '#f2f2f2', '#c9c9c9', '简约白色圆桌'],
  ['f_table_green', '绿茶桌', '🍵', 900, 'furniture', 'table', '#5ab88a', '#3e6e2a', '配下午茶的矮桌'],
  ['f_desk_wood', '书桌', '📖', 1400, 'furniture', 'desk', '#8a6239', '#6a4a2a', '带抽屉的书桌'],
  ['f_desk_dark', '黑色书桌', '🖥️', 1600, 'furniture', 'desk', '#3a3a3e', '#2a2a2e', '现代风办公桌'],
  // ---- 床铺类 ----
  ['f_bed_blue', '蓝色木床', '🛏️', 2200, 'furniture', 'bed', '#4a6a9a', '#e3e9f5', '睡得安稳的木床'],
  ['f_bed_pink', '粉色公主床', '🛏️', 2600, 'furniture', 'bed', '#f2a8c0', '#ffe3ec', '梦幻公主床'],
  ['f_bed_wood', '原木床', '🛏️', 2000, 'furniture', 'bed', '#a87f4e', '#f7ecd0', '原木清香的床'],
  ['f_bed_green', '抹茶软床', '🛏️', 2400, 'furniture', 'bed', '#5ab88a', '#dff5ec', '抹茶色的软床'],
  // ---- 柜架类 ----
  ['f_shelf_wood', '木书架', '📚', 1500, 'furniture', 'bookcase', '#a87f4e', '#8a6239', '摆满书的书架'],
  ['f_shelf_dark', '深色书架', '📚', 1600, 'furniture', 'bookcase', '#5a4a3a', '#3a2e22', '沉稳的深色书架'],
  ['f_shelf_white', '白色置物架', '🗄️', 1400, 'furniture', 'shelf', '#f2f2f2', '#c9c9c9', '干净的白色置物架'],
  ['f_dresser_wood', '木衣柜', '🚪', 1800, 'furniture', 'wardrobe', '#a87f4e', '#6a4a2a', '双开门木衣柜'],
  ['f_dresser_white', '白色衣柜', '🚪', 1900, 'furniture', 'wardrobe', '#f2f2f2', '#c9c9c9', '简约白色衣柜'],
  ['f_dresser_oak', '橡木抽屉柜', '🗄️', 1300, 'furniture', 'dresser', '#c9a86a', '#e8d5a8', '两层抽屉柜'],
  ['f_dresser_blue', '蓝色抽屉柜', '🗄️', 1350, 'furniture', 'dresser', '#4a6a9a', '#7a9ac9', '海蓝色抽屉柜'],
  // ---- 灯具类 ----
  ['f_lamp_yellow', '黄光台灯', '💡', 680, 'furniture', 'lamp', '#f7d02c', '#8a6a45', '暖光小台灯'],
  ['f_lamp_pink', '粉色台灯', '💡', 720, 'furniture', 'lamp', '#f2a8c0', '#8a6a45', '粉色灯罩台灯'],
  ['f_lamp_blue', '蓝色落地灯', '💡', 900, 'furniture', 'floorlamp', '#4aa3ff', '#5a5a5e', '高挑的落地灯'],
  ['f_lamp_green', '绿色落地灯', '💡', 900, 'furniture', 'floorlamp', '#5ab88a', '#5a5a5e', '柔和绿光落地灯'],
  // ---- 家电类 ----
  ['f_tv_black', '液晶电视', '📺', 3200, 'furniture', 'tv', '#4aa3ff', '#2a2a2e', '超薄大屏幕'],
  ['f_tv_retro', '复古电视', '📺', 2400, 'furniture', 'tv', '#5ab88a', '#8a6a45', '旋钮式老电视'],
  ['f_radio_wood', '木质收音机', '📻', 1100, 'furniture', 'radio', '#a87f4e', '#e8d5a8', '能听岛上广播'],
  ['f_radio_red', '红色收音机', '📻', 1200, 'furniture', 'radio', '#e84a3a', '#f7d02c', '复古红收音机'],
  ['f_fan_white', '白色电扇', '🌀', 980, 'furniture', 'fan', '#f2f2f2', '#c9c9c9', '夏天必备'],
  ['f_fan_blue', '蓝色电扇', '🌀', 980, 'furniture', 'fan', '#4aa3ff', '#7a9ac9', '呼呼吹凉风的电扇'],
  ['f_fridge_white', '白色冰箱', '🧊', 2800, 'furniture', 'fridge', '#f2f2f2', '#c9c9c9', '双门冰箱'],
  ['f_fridge_mint', '薄荷冰箱', '🧊', 3000, 'furniture', 'fridge', '#a8e8d0', '#5ab88a', '薄荷绿复古冰箱'],
  ['f_stove_black', '黑色灶台', '🍳', 2600, 'furniture', 'stove', '#3a3a3e', '#5a5a5e', '两口燃气灶'],
  ['f_sink_white', '白色水槽', '🚰', 1800, 'furniture', 'sink', '#f2f2f2', '#c9c9c9', '厨房水槽柜'],
  ['f_wash_white', '滚筒洗衣机', '🧺', 2400, 'furniture', 'washing', '#f2f2f2', '#c9c9c9', '洗得干干净净'],
  ['f_bath_white', '白色浴缸', '🛁', 3200, 'furniture', 'bath', '#f2f2f2', '#bdeaff', '泡澡最幸福了'],
  ['f_toilet_white', '马桶', '🚽', 2000, 'furniture', 'toilet', '#f2f2f2', '#c9e8f5', '干干净净的马桶'],
  // ---- 装饰摆设 ----
  ['f_rug_red', '红色圆毯', '⭕', 1100, 'furniture', 'rug', '#e84a3a', '#f7d02c', '暖和的手工圆毯'],
  ['f_rug_blue', '蓝色圆毯', '⭕', 1100, 'furniture', 'rug', '#4a6a9a', '#7a9ac9', '安静的蓝色圆毯'],
  ['f_rug_green', '草坪圆毯', '⭕', 1200, 'furniture', 'rug', '#5ab88a', '#3e6e2a', '像坐在草地上'],
  ['f_plant_green', '绿萝盆栽', '🪴', 600, 'furniture', 'plant', '#3e8e3a', '#b5673a', '好养活的绿萝'],
  ['f_plant_round', '圆叶盆栽', '🪴', 680, 'furniture', 'plant', '#5ab88a', '#8a6239', '圆滚滚的叶子'],
  ['f_vase_blue', '青瓷花瓶', '🏺', 1500, 'furniture', 'vase', '#7ab8d0', '#4a8aa8', '古朴的青瓷'],
  ['f_vase_red', '红陶花瓶', '🏺', 1300, 'furniture', 'vase', '#c95a4a', '#8a3a2e', '手工红陶器'],
  ['f_picture_sea', '海景挂画', '🖼️', 1600, 'furniture', 'picture', '#7ab8d0', '#a87f4e', '挂在墙上的大海'],
  ['f_picture_forest', '森林挂画', '🖼️', 1600, 'furniture', 'picture', '#5ab88a', '#8a6239', '挂在墙上的森林'],
  ['f_clock_wood', '木质挂钟', '🕰️', 1400, 'furniture', 'clock', '#a87f4e', '#8a6239', '滴答滴答的老挂钟'],
  ['f_clock_red', '红色座钟', '⏰', 1200, 'furniture', 'clock', '#e84a3a', '#8a6239', '复古红座钟'],
  ['f_mirror_oval', '椭圆穿衣镜', '🪞', 1900, 'furniture', 'mirror', '#bdeaff', '#a87f4e', '出门照一照'],
  ['f_globe_blue', '地球仪', '🌐', 2100, 'furniture', 'globe', '#4aa3ff', '#5ab88a', '转一圈看世界'],
  ['f_telescope', '天文望远镜', '🔭', 3600, 'furniture', 'telescope', '#4a6a9a', '#8a6a45', '夜里看星星'],
  ['f_piano_black', '黑色钢琴', '🎹', 9800, 'furniture', 'piano', '#2a2a2e', '#3a3a3e', '店里最贵重的家具'],
  ['f_guitar_wood', '木吉他', '🎸', 2400, 'furniture', 'guitar', '#c9855a', '#8a6239', '篝火晚会标配'],
  ['f_doll_bear', '小熊玩偶', '🧸', 1500, 'furniture', 'doll', '#c9855a', '#f2c94c', '抱起来软软的'],
  ['f_doll_rabbit', '兔子玩偶', '🐰', 1500, 'furniture', 'doll', '#f2f2f2', '#f2a8c0', '长耳朵兔子'],
  ['f_trophy_gold', '金奖杯', '🏆', 5000, 'furniture', 'trophy', '#f7d02c', '#c9a020', '钓鱼大赛冠军同款'],
  ['f_ball_red', '红白皮球', '⚽', 700, 'furniture', 'ball', '#e84a3a', '#f2f2f2', '可以摆在院子里'],
  ['f_ball_blue', '蓝白皮球', '⚽', 700, 'furniture', 'ball', '#4aa3ff', '#f2f2f2', '弹性十足'],
  ['f_basket_wood', '藤编篮子', '🧺', 800, 'furniture', 'basket', '#c9a86a', '#8a6239', '野餐用的小篮子'],
  ['f_umbrella_red', '红色雨伞', '🌂', 900, 'furniture', 'umbrella', '#e84a3a', '#8a6a45', '下雨天也不怕'],
  ['f_umbrella_blue', '蓝色雨伞', '🌂', 900, 'furniture', 'umbrella', '#4aa3ff', '#8a6a45', '清爽的蓝色伞面'],
  ['f_umbrella_leaf', '树叶雨伞', '🌂', 1100, 'furniture', 'umbrella', '#5ab88a', '#3e6e2a', '岛民都爱的树叶伞'],
  // ---- 更多椅子/桌子凑满阵容 ----
  ['f_chair_yellow', '黄色餐椅', '🪑', 520, 'furniture', 'chair', '#f7d02c', '#8a6239', '明亮的餐椅'],
  ['f_chair_white', '白色餐椅', '🪑', 540, 'furniture', 'chair', '#f2f2f2', '#c9c9c9', '简约餐椅'],
  ['f_armchair_green', '抹茶单人沙发', '🛋️', 1280, 'furniture', 'armchair', '#8ac9a0', '#5ab88a', '抹茶色软沙发'],
  ['f_sofa_pink', '粉色双人沙发', '🛋️', 2600, 'furniture', 'sofa', '#f2a8c0', '#e88aa8', '甜蜜双排沙发'],
  ['f_table_red', '红色茶几', '🟥', 880, 'furniture', 'table', '#e84a3a', '#8a3a2e', '亮眼的红茶几'],
  ['f_table_blue', '蓝色茶几', '🟦', 880, 'furniture', 'table', '#4aa3ff', '#2a5a9a', '海蓝色茶几'],
  ['f_desk_white', '白色书桌', '📖', 1500, 'furniture', 'desk', '#f2f2f2', '#c9c9c9', '干净的白色书桌'],
  ['f_bed_yellow', '柠檬软床', '🛏️', 2300, 'furniture', 'bed', '#f7d02c', '#fff2c0', '酸酸甜甜的床'],
  ['f_bed_purple', '紫色软床', '🛏️', 2500, 'furniture', 'bed', '#9a6ac9', '#e3d5f5', '神秘的紫色床铺'],
  ['f_shelf_green', '绿色置物架', '🗄️', 1350, 'furniture', 'shelf', '#5ab88a', '#3e6e2a', '放杂物刚刚好'],
  ['f_dresser_pink', '粉色衣柜', '🚪', 1950, 'furniture', 'wardrobe', '#f2a8c0', '#e88aa8', '装满可爱衣服'],
  ['f_lamp_orange', '橘色台灯', '💡', 700, 'furniture', 'lamp', '#e8763b', '#8a6a45', '橘子味的灯光'],
  ['f_tv_white', '白色电视', '📺', 3000, 'furniture', 'tv', '#f2f2f2', '#c9c9c9', '极简白电视'],
  ['f_radio_blue', '蓝色收音机', '📻', 1150, 'furniture', 'radio', '#4aa3ff', '#2a5a9a', '音质清澈'],
  ['f_fan_green', '复古绿电扇', '🌀', 1080, 'furniture', 'fan', '#5ab88a', '#3e6e2a', '摇头晃脑的老电扇'],
  ['f_rug_purple', '紫色圆毯', '⭕', 1150, 'furniture', 'rug', '#9a6ac9', '#6a4a9a', '优雅的紫地毯'],
  ['f_plant_tall', '高盆栽', '🪴', 750, 'furniture', 'plant', '#2a7a3a', '#8a6239', '快顶到天花板了'],
  ['f_vase_white', '白瓷花瓶', '🏺', 1400, 'furniture', 'vase', '#f2f2f2', '#c9c9c9', '插一支花正好'],
  ['f_picture_flower', '花卉挂画', '🖼️', 1600, 'furniture', 'picture', '#f2a8c0', '#a87f4e', '盛开的画中花'],
  ['f_clock_blue', '蓝色挂钟', '🕰️', 1350, 'furniture', 'clock', '#4aa3ff', '#2a5a9a', '安静的蓝挂钟'],
  ['f_doll_cat', '猫咪玩偶', '🐱', 1500, 'furniture', 'doll', '#f2c94c', '#e8763b', '圆脸的橘猫'],
  ['f_cushion_red', '红色坐垫', '🟥', 400, 'furniture', 'cushion', '#e84a3a', '#c93a2e', '正红色坐垫'],
  ['f_stool_blue', '蓝色圆凳', '🪑', 360, 'furniture', 'stool', '#4aa3ff', '#2a5a9a', '轻巧的蓝凳子'],
  ['f_bookcase_white', '白色书架', '📚', 1550, 'furniture', 'bookcase', '#f2f2f2', '#c9c9c9', 'ins风书架'],
  ['f_wardrobe_oak', '橡木衣柜', '🚪', 1850, 'furniture', 'wardrobe', '#c9a86a', '#a87f4e', '橡木原色衣柜'],
  // ---- 日用品（可使用） ----
  ['u_juice_apple', '苹果汁', '🧃', 120, 'use', 'drink', '#e84a3a', '#f7b8a0', '喝一口恢复精神'],
  ['u_juice_orange', '橘子汁', '🧃', 120, 'use', 'drink', '#f28c28', '#f7d08a', '酸甜橘子味'],
  ['u_coffee', '热咖啡', '☕', 200, 'use', 'drink', '#6a4a2a', '#c9a86a', '鸽巢咖啡店同款'],
  ['u_cookie', '手工饼干', '🍪', 150, 'use', 'food', '#c9855a', '#8a6239', '烤得香香脆脆'],
  ['u_cake', '草莓蛋糕', '🍰', 300, 'use', 'food', '#f2a8c0', '#ffe3ec', '软软的草莓蛋糕'],
  ['u_medicine', '常备药', '💊', 400, 'use', 'medicine', '#4aa3ff', '#f2f2f2', '被蜜蜂蛰了就吃它'],
  ['u_candy', '水果糖', '🍬', 80, 'use', 'candy', '#e84ad0', '#f7a8e8', '甜甜的水果糖'],
  ['u_bento', '手作便当', '🍱', 350, 'use', 'food', '#5ab88a', '#f2ecd8', '装满了岛的味道'],
  // ---- 种子/树苗 ----
  ['s_sapling_cedar', '针叶树苗', '🌲', 640, 'seed', 'seedling', '#2a6a3a', '#8a6239', '种下去长成针叶树'],
  ['s_sapling_oak', '阔叶树苗', '🌳', 640, 'seed', 'seedling', '#3e8e3a', '#a87f4e', '种下去长成阔叶树'],
  ['s_seed_rose', '玫瑰花种', '🌹', 240, 'seed', 'seedling', '#e84a8a', '#7a4a5a', '开出红玫瑰'],
  ['s_seed_tulip', '郁金香花种', '🌷', 240, 'seed', 'seedling', '#e8763b', '#8a5a3a', '开出郁金香'],
  ['s_seed_cosmos', '大波斯菊花种', '🌼', 240, 'seed', 'seedling', '#f2a8c0', '#c98aa0', '开出大波斯菊'],
];

import { SERIES_GOODS } from './series';
export const SHOP_CATALOG: ShopGood[] = [
  ...RAW.map(([id, name, icon, price, cat, shape, c1, c2, desc]) => ({ id, name, icon, price, cat, shape, c1, c2, desc })),
  ...SERIES_GOODS, // 6 套系列家具（墙纸/地板/整套家具，带 SVG 风格贴图）
];
export const GOOD_BY_ID: Record<string, ShopGood> = Object.fromEntries(SHOP_CATALOG.map(g => [g.id, g]));

// 每日轮换 8 件（以日期为种子，全岛同步）
export function dailyGoods(daySeed: number, n = 8): ShopGood[] {
  const arr = [...SHOP_CATALOG];
  let s = daySeed * 9301 + 49297;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 233 + 137) % 100000;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}
