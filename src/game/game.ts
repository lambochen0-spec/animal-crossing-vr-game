// 主引擎：渲染循环、输入、相机、交互、任务流程、钓鱼、经济、昼夜（跟随真实时间）
import * as THREE from 'three';
import { World, groundHeight, isWaterAt, onBridge, rawHeight, tileType, emojiSprite, HALF, TILE, WATER_Y } from './world';
import type { Tree, Rock, Flower, DigSpot, Bug, Fish, Pickup } from './world';
import { Character, Villager, Meowth, Pikachu } from './characters';
import { ITEMS, TOOLS, SHOPKEEPER_LINES, BOARD_TIPS, GIFT_LINES, FLOWER_IDS, NOOK_INTRO, NOOK_QUESTS, NOOK_IDLE_LINES, PIKACHU_LINES, OWL_DEF, OWL_LINES } from './data';
import type { ToolId } from './data';
import { store } from './store';
import { Interior, ROOM_W, ROOM_D } from './interiors';
import { VILLAGER_PROFILES, VILLAGER_ROSTER, PLAYER_INTERIOR, TENT_INTERIOR, SHOP_INTERIOR, MUSEUM_BASE, SERVICE_INTERIOR, profileByName, applyResidents, rosterById, MAX_RESIDENTS } from './villagers';
import { floorChecker, wallStripes } from './villagers/svg';
import { modelForGood, fitToStand, footprint } from './itemmodels';
import type { InteriorStyle, FurnitureItem } from './villagers';
import { dailyGoods, GOOD_BY_ID } from './shopgoods';
import * as savefile from './savefile';
import { SETS, randomSetGoodId } from './series';
import type { ShopGood } from './shopgoods';

import { commands } from './store';
import { sfx } from './audio';
import { VRSystem } from './vr';

export const touchInput = { dx: 0, dy: 0, run: false, lookDX: 0, lookDY: 0 };
if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>).__touch = touchInput; // 调试钩子
// 显示状态：竖屏时游戏整体旋转90°强制横屏（外层应用不支持横屏的情况）
export const displayState = { rotate90: false };

const SAVE_KEY = 'pixel-crossing-save-v7';

interface Interactable {
  kind: string;
  prompt: string;
  dist: number;
  target?: unknown;
}

const FRUIT_SET = new Set(['apple', 'cherry', 'orange', 'peach']);

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private world: World;
  private player: Character;
  private villagers: Villager[] = [];
  private residents: string[] = [];           // 当前居民（档案 id，按入住顺序对应住宅槽位）
  private camperVillager: Villager | null = null; // 高原露营考察者
  private camper: { id: string; startDay: number; task: { item: string; need: number } | null } | null = null;
  private lastCampDay = 0;                     // 上次出现露营者的日期戳
  private lastDayTick = 0;                     // 跨天检测用
  private frameNo = 0;                          // 帧计数（VR 装饰动画隔帧用）
  private cullT = -1;                           // VR 距离剔除计时（-1 = 未激活）
  private strength = 0;                        // 吃水果获得的力气（用于铲起整棵树）
  private shovelLevel = 1;                     // 铲子等级：1普通（一层）2铜铲（二层）3铁铲（三层）
  private mineFloor = 1;                       // 当前矿洞层数
  private mineNodes: { mesh: THREE.Group; hp: number; idx: number }[] = []; // 当前层的矿石节点
  private mineState: { day: number; floors: Record<number, number[]> } | null = null; // 当天各层矿石剩余耐久
  private nook: Meowth;
  private isabelle: Pikachu;
  private owl: Villager;         // 傅达（博物馆馆长）
  private donated: string[] = [];      // 博物馆已捐赠展品
  private pendingDonate: string | null = null;
  private shopStock: { good: ShopGood; x: number; z: number }[] = []; // 今日货架商品
  private shopDisplay = new THREE.Group();   // 货架模型（进店时挂载）
  private placedFurniture: { id: string; x: number; z: number; rotY?: number; hang?: boolean }[] = []; // 玩家家中摆放的家具（hang=挂墙上）
  private outdoorFurniture: { id: string; x: number; z: number; rotY: number }[] = []; // 室外摆放的家具
  private outdoorGroup = new THREE.Group();   // 室外家具渲染组
  private outdoorColliders: { x: number; z: number; r: number }[] = []; // 室外家具碰撞（重建时整体替换）
  private homeDecor: { wall: string | null; floor: string | null } = { wall: null, floor: null }; // 家中墙纸/地板系列
  private placedGroup = new THREE.Group();
  private sun: THREE.DirectionalLight;
  private playerGlow: THREE.DirectionalLight; // 平行光：均匀照亮周围，不会在地面打出光斑
  private ambient: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;

  private keys = new Set<string>();
  private camYaw = Math.PI;
  private camPitch = 0.62;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };

  private bells = 500;
  private miles = 0;
  // 自定义岛名/玩家名（开局起名，存在独立 localStorage + 存档里）
  islandName = '像素小岛';
  playerName = '岛主';
  // 每日任务（Nook 日常：每天随机 3 个小目标，完成发积分）
  private dailyTasks: { day: number; tasks: { kind: string; icon: string; text: string; need: number; reward: number; progress: number; done: boolean }[] } | null = null;
  // 宝可梦好感度：聊天每天 +1，收到礼物 +3；满 2 心送照片，满 4 心起昵称
  private friendship: Record<string, { pts: number; lastTalkDay: number }> = {};
  private nicknames: Record<string, string> = {};
  // 岛民冰淇淋店（经营玩法）
  private iceShop = { built: false, level: 1, proficiency: 0, stock: 0, open: false, todayEarn: 0, todayCustomers: 0, x: -14, z: 16 };
  // 开店材料已交付数量
  private shopMats: Record<string, number> = { wood: 0, stone: 0, ore_gold: 0, diamond: 0 };
  // 店员：分工种熟练度（采集/接待/管理各自独立）
  private staff: Record<string, { job: 'gather' | 'serve' | 'manage'; days: number; xp: { gather: number; serve: number; manage: number } }> = {};
  private hireTarget: string | null = null;
  // 外岛游客（观光船每天 8:00 来、18:00 走；数量由岛屿评价决定）
  private tourists: Villager[] = [];
  private boatState: 'none' | 'arriving' | 'docked' | 'boarding' | 'leaving' = 'none';
  private rainShy = new Set<string>(); // 雨天宅家的宝可梦（每天重抽）
  vrSys!: VRSystem; // VR 系统（构造器尾部初始化）
  private bridgeHintDay = -1; // 修桥引导提醒（每天最多一次）
  // 店员熟练度等级：越往后升得越慢（Lv1=20, Lv2=50, Lv3=90, Lv4=140, Lv5=200，封顶 Lv5）
  private static LEVEL_STEPS = [20, 50, 90, 140, 200];
  private jobLevel(xp: number) {
    let lv = 0;
    while (lv < Game.LEVEL_STEPS.length && xp >= Game.LEVEL_STEPS[lv]) lv++;
    return lv;
  }
  private nextLevelXp(lv: number) { return lv < Game.LEVEL_STEPS.length ? Game.LEVEL_STEPS[lv] : -1; } // -1 = 已满级
  // 接待员售价倍率：×1.0 起，每级 +0.2，Lv5 封顶 ×2.0
  private serveMult(name: string) { return 1 + 0.2 * this.jobLevel(this.staff[name]?.xp.serve ?? 0); }
  // 店员工资：采集/接待 = 150 + 50×等级；店长 = 300 + 100×管理等级
  private wageFor(name: string) {
    const st = this.staff[name];
    if (!st) return 0;
    if (st.job === 'manage') return 300 + 100 * this.jobLevel(st.xp.manage);
    return 150 + 50 * this.jobLevel(st.job === 'gather' ? st.xp.gather : st.xp.serve);
  }
  private basketCap(name: string) { return 4 + this.jobLevel(this.staff[name]?.xp.gather ?? 0); } // 篮子初始 4 个，每级 +1
  private static SHOP_REQ: [string, number][] = [['wood', 100], ['stone', 20], ['ore_gold', 50], ['diamond', 5]];
  // 菜单：熟练度 0/5/15/30 解锁 1~4 个口味，每多一个单价 +50
  private static MENU_STEPS = [0, 5, 15, 30];
  private static MENU_NAMES = ['香草冰淇淋', '草莓冰淇淋', '香橙冰淇淋', '缤纷水果冰淇淋'];
  private menuCount() { let m = 1; for (let i = 1; i < 4; i++) if (this.iceShop.proficiency >= Game.MENU_STEPS[i]) m = i + 1; return m; }
  private menuPrice() { return 100 + (this.menuCount() - 1) * 50 + (this.iceShop.level - 1) * 20; } // 店铺每级单价 +20
  private inventory: Record<string, number> = {};
  private selectedItem: string | null = null;
  private tool: ToolId = 'hand';
  private unlockedTools = new Set<ToolId>(['hand']);
  private dex = new Set<string>();  // 图鉴（抓到过的虫/鱼）
  private time24 = 9;

  // 任务流程
  private questIdx = 0;
  private questAccepted = false; // 任务要去找喵喵接取后才开始显示
  private questProgress = 0;
  private introDone = false;
  // 开场剧情（运镜）
  private cineActive = false;
  private cineShots: { shot: 'wide' | 'pikachu' | 'player' | 'two'; name: string; text: string }[] = [];
  private firstFlags: Record<string, boolean | number> = {};
  private dialogQueue: { name: string; text: string }[] = [];

  private playerPos = new THREE.Vector3(0, 0, 8);
  private playerYaw = Math.PI;
  private stepT = 0;

  // 钓鱼
  private fishState: 'idle' | 'charging' | 'cast' | 'waiting' | 'nibble' | 'bite' | 'hooked' = 'idle';
  private bobber: THREE.Group | null = null;
  private bobberPos = new THREE.Vector3();
  private bobberVel = new THREE.Vector3();
  private biteT = 0;
  private waitT = 0;
  private luredFish: Fish | null = null;
  private exclaim: THREE.Sprite | null = null;
  private castPower = 0;      // 蓄力 0~1
  private nibbleT = 0;        // 假咬节奏
  private nibbleCount = 0;
  private nibbleMax = 4;      // 假咬次数
  private reelGot = 0;
  private reelT = 0;

  private bugRespawnT = 0;
  private digRespawnT = 0;
  private elapsed = 0;
  private lastT = 0;
  private disposed = false;
  private currentPrompt: string | null = null;
  private container: HTMLElement;

  // 室内场景
  private interior = new Interior();
  private inside: string | null = null;        // 当前所在房屋名（null=室外）
  private outsidePos = new THREE.Vector3();    // 进屋前的站位
  private insideVillager: Villager | null = null;
  private homeFlags = new Map<string, boolean>(); // 村民是否在家（按各自作息回家）
  private skipHomeApply = false; // 晚会结束后跳过一次回家传送（大家留在原地自由活动）
  private routines = new Map<string, { wake: number; sleep: number }>(); // 村民作息（早起/普通/夜猫子）
  weather: 'sun' | 'rain' = 'sun'; // 天气：晴天/雨天（新的一天随机）
  private rain!: THREE.Points;     // 雨滴粒子
  // 天空天体（太阳/月亮/星星/云）
  private sunDisc!: THREE.Mesh;
  private sunGlow!: THREE.Mesh;
  private moonDisc!: THREE.Mesh;
  private stars!: THREE.Points;
  private clouds: THREE.Group[] = [];
  private cloudT = 0;
  private chatCd = 20;             // 村民聊天的全局冷却
  private lastNightFlag: boolean | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    // VR 头显浏览器（Quest 等）：preserveDrawingBuffer 会让 tiled GPU 每帧全量回拷导致花屏/闪烁，必须关掉；
    // 同时默认降画质（分辨率/阴影），避免 GPU 吃紧造成整机闪屏
    const xrBrowser = typeof navigator !== 'undefined' && /OculusBrowser|Quest/i.test(navigator.userAgent);
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !xrBrowser });
    this.renderer.setPixelRatio(xrBrowser ? 1 : Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = !xrBrowser;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    if (xrBrowser) this.lowQuality = true; // 头显默认低画质，优先保证帧率（防眩晕也防闪屏）
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 600);

    // 光照
    this.sun = new THREE.DirectionalLight(0xffffff, 1.1);
    this.sun.castShadow = !this.lowQuality;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.far = 200;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambient);
    // 主角随身补光：平行光均匀照亮周围（没有光点/光斑）
    this.playerGlow = new THREE.DirectionalLight(0xffe8c0, 0);
    this.scene.add(this.playerGlow);
    this.scene.add(this.playerGlow.target);
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6a8f5a, 0.5);
    this.scene.add(this.hemi);
    this.scene.fog = new THREE.Fog(0x87ceeb, 80, 320);

    // 居民名单：读档沿用，否则从 18 只宝可梦里随机挑 5 只作为初始居民
    const peek = this.peekSave();
    this.residents = peek?.residents ?? this.rollInitialResidents();
    this.camper = peek?.camper ?? null;
    this.lastCampDay = peek?.lastCampDay ?? 0;
    applyResidents(this.residents);

    // 世界
    this.world = new World();
    this.world.buildPier();
    if (!new URLSearchParams(location.search).has('nomerge')) this.world.mergeStaticDecor(); // 静态建筑/装饰合并成大 mesh（降 draw call，VR 流畅度优化）
    this.scene.add(this.world.group);
    // 雨滴粒子（下雨时开启，跟随玩家周围）
    {
      const N = 900;
      const arr = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        arr[i * 3] = Math.random() * 46 - 23;
        arr[i * 3 + 1] = Math.random() * 24;
        arr[i * 3 + 2] = Math.random() * 46 - 23;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      this.rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbfd8f0, size: 0.16, transparent: true, opacity: 0.75 }));
      this.rain.visible = false;
      this.rain.frustumCulled = false;
      this.scene.add(this.rain);
    }
    // ---- 天空天体：太阳（带光晕）/ 满月 / 星星 / 云朵 ----
    {
      // 太阳
      this.sunGlow = new THREE.Mesh(new THREE.CircleGeometry(16, 24), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.45, fog: false }));
      this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: 0xffdf5a, fog: false }));
      this.sunGlow.renderOrder = -1; this.sunDisc.renderOrder = -1;
      // 满月（一直是圆的）
      this.moonDisc = new THREE.Mesh(new THREE.CircleGeometry(7, 24), new THREE.MeshBasicMaterial({ color: 0xf6f2de, fog: false }));
      this.moonDisc.renderOrder = -1;
      // 星星：半球穹顶随机分布
      const n = 260, sp = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.48;
        const r = 190;
        sp[i * 3] = Math.cos(a) * Math.cos(e) * r;
        sp[i * 3 + 1] = 20 + Math.sin(e) * r;
        sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false }));
      this.stars.frustumCulled = false;
      // 云：几朵方块云慢慢飘
      const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
      for (let i = 0; i < 7; i++) {
        const c = new THREE.Group();
        const puffN = 2 + Math.floor(Math.random() * 2);
        for (let j = 0; j < puffN; j++) {
          const puff = new THREE.Mesh(new THREE.BoxGeometry(8 + Math.random() * 7, 2.5 + Math.random() * 1.5, 5 + Math.random() * 3), cloudMat);
          puff.position.set(j * 6 - puffN * 3 + Math.random() * 2, Math.random() * 1.5, Math.random() * 2);
          c.add(puff);
        }
        c.position.set((Math.random() - 0.5) * 260, 48 + Math.random() * 22, (Math.random() - 0.5) * 260);
        this.clouds.push(c);
        this.scene.add(c);
      }
      this.scene.add(this.sunGlow, this.sunDisc, this.moonDisc, this.stars);
    }
    this.interior.group.visible = false;
    this.scene.add(this.interior.group);

    // 玩家（动森默认配色：棕发、蓝T恤、深蓝短裤、棕鞋）
    this.player = new Character({
      skin: '#ffcf9e', shirt: 0x3aa7e8, pants: 0x27435f, shoes: 0x6b4a2f, hair: 0x6b4226, face: 'player',
    });
    this.playerPos.y = groundHeight(this.playerPos.x, this.playerPos.z);
    this.player.group.position.copy(this.playerPos);
    this.player.group.scale.setScalar(0.75); // 主角体型 3/4
    this.scene.add(this.player.group);

    // 村民（住在自己的房子附近，档案来自各宝可梦文件夹，按槽位分配）
    VILLAGER_PROFILES.forEach((prof, i) => {
      const v = new Villager(prof.def);
      const [sx, sz] = [prof.spawn.x, prof.spawn.z];
      v.group.position.set(sx, groundHeight(sx, sz), sz);
      v.yaw = Math.random() * Math.PI * 2;
      this.villagers.push(v);
      this.scene.add(v.group);
      // 作息：早起型/普通型/夜猫子型轮换（原版三种生物钟）
      const R = [
        { wake: 5.5, sleep: 19.5 },  // 早起型
        { wake: 6.5, sleep: 21.5 },  // 普通型
        { wake: 8, sleep: 25 },      // 夜猫子型（25 = 凌晨1点）
      ];
      this.routines.set(prof.def.name, R[i % 3]);
    });

    // 露营考察者恢复（存档里有未完成的考察）
    if (this.camper) this.spawnCamper(this.camper.id);
    else this.updateCamp();

    // 喵喵（常驻商店前）
    this.nook = new Meowth();
    this.nook.group.position.set(this.world.nookPos.x, groundHeight(this.world.nookPos.x, this.world.nookPos.z), this.world.nookPos.z);
    this.nook.yaw = 2.4;
    this.scene.add(this.nook.group);

    // 皮卡丘（常驻服务处柜台，对标西施惠）
    this.isabelle = new Pikachu();
    this.isabelle.group.position.set(0, 0, -3.4);
    this.isabelle.yaw = 0.2;
    this.isabelle.group.visible = false; // 进入服务处时出现
    this.scene.add(this.isabelle.group);

    // 傅达（博物馆馆长）：平时隐藏，进馆时出现
    this.owl = new Villager(OWL_DEF);
    this.owl.group.visible = false;
    this.scene.add(this.owl.group);

    // 生成小地图
    store.patch({ mapImage: this.makeMapImage() });

    this.load();
    this.readNames();
    // 对话框从有到无（无论是点掉、按钮关闭还是命令关闭）→ 立即停止语音（含高频辅音"打颤"声）
    let hadDialog = false;
    store.subscribe(s => {
      if (hadDialog && !s.dialog) sfx.stopSpeak();
      hadDialog = !!s.dialog;
    });
    // 本地文件存档：已关联且文件更新 → 写回 localStorage 并重载一次（只重载一次，防循环）
    savefile.tryRestoreLink().then(async st => {
      if (st !== 'linked') return;
      const text = await savefile.readSave();
      if (!text) return;
      try {
        const fileData = JSON.parse(text);
        const local = this.peekSave() as { _savedAt?: number } | null;
        if ((fileData._savedAt ?? 0) > (local?._savedAt ?? 0) && !sessionStorage.getItem('fsa-restored')) {
          sessionStorage.setItem('fsa-restored', '1');
          localStorage.setItem(SAVE_KEY, text);
          location.reload();
        }
      } catch { /* 文件损坏则忽略，localStorage 兜底 */ }
    });
    this.scene.add(this.outdoorGroup);
    this.renderOutdoorFurniture();
    this.syncHud();
    this.bindInput();
    // VR 系统（WebXR）：第一人称 + 原地踏步 + 挥臂工具
    this.vrSys = new VRSystem({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      playerPos: this.playerPos,
      groundY: (x, z) => groundHeight(x, z),
      setViewYaw: (yaw) => { this.camYaw = yaw; },
      onVrSwing: () => {
        if (store.state.dialog || store.state.shopOpen) return;
        // 挥臂 = 使用工具的动作，只执行工具类命中（摇树/挖矿/敲石/捕虫/挖宝/拔草/摘花/钓鱼）；
        // 进屋/开店/对话/睡觉等走近交互一律归扳机——否则走路摆臂会误进屋、误开界面锁死移动
        const it = this.findInteract();
        this.swingArm();
        if (it && Game.VR_SWING_KINDS.has(it.kind)) this.interact();
      },
      onVrTrigger: () => {
        if (store.state.dialog || store.state.shopOpen) return;
        // 工具类动作必须「扳机+挥臂」（咬钩收竿除外，留给本能反应），扳机单独扣只执行非工具交互
        const it = this.findInteract();
        if (it && Game.VR_SWING_KINDS.has(it.kind) && it.kind !== 'reel') return;
        this.interact();
      },
      onCycleTool: (dir) => {
        const list = (['hand', 'net', 'rod', 'shovel', 'axe'] as ToolId[]).filter(t => this.unlockedTools.has(t));
        const i = list.indexOf(this.tool);
        this.setTool(list[(i + dir + list.length) % list.length]);
      },
      onVRStart: () => { this.player.group.visible = false; this.toast('VR 模式', '🥽', '原地踏步前进，挥动手柄使用工具，左腕看任务，右腕是手机'); },
      onVREnd: () => { this.player.group.visible = true; },
      touch: touchInput,
      getInventory: () => Object.entries(this.inventory),
      onSelectTool: (t) => { if (this.unlockedTools.has(t as ToolId)) { this.setTool(t as ToolId); sfx.plop(); } },
      hasTool: (t) => this.unlockedTools.has(t as ToolId),
      getPickups: () => this.inside ? [] : this.world.pickups.map(pk => ({ id: pk.id, pos: pk.mesh.position, mesh: pk.mesh })),
      onPointPickup: (id) => {
        const pk = this.world.pickups.find(x => x.id === id);
        if (pk) this.collectPickup(pk);
      },
      // 可对话目标（VR 指向对话用）：店员/馆长/向导/村民/露营者/做客村民
      getTalkTargets: () => {
        const out: { id: string; pos: THREE.Vector3; top: number }[] = [];
        const push = (id: string, g: THREE.Group, top: number) => { if (g.visible) out.push({ id, pos: g.position, top }); };
        push('nook', this.nook.group, 1.6);
        push('isabelle', this.isabelle.group, 1.6);
        if (this.inside === '博物馆') push('owl', this.owl.group, 1.6);
        this.villagers.forEach((v, i) => {
          if (v !== this.camperVillager && v !== this.insideVillager) push(`v:${i}`, v.group, 1.7);
        });
        if (this.camperVillager) push('camper', this.camperVillager.group, 1.7);
        if (this.insideVillager) push(`v:${this.villagers.indexOf(this.insideVillager)}`, this.insideVillager.group, 1.7);
        return out;
      },
      onPointTalk: (id) => {
        if (store.state.dialog || store.state.shopOpen) return;
        let it: Interactable | null = null;
        if (id === 'nook') it = { kind: 'nook', prompt: '', dist: 0 };
        else if (id === 'isabelle') it = { kind: 'isabelle', prompt: '', dist: 0 };
        else if (id === 'owl') it = { kind: 'owl', prompt: '', dist: 0 };
        else if (id === 'camper') it = { kind: 'camper', prompt: '', dist: 0 };
        else if (id.startsWith('v:')) {
          const v = this.villagers[+id.slice(2)];
          if (v) it = { kind: 'villager', prompt: '', dist: 0, target: v };
        }
        if (it) this.doInteract(it);
      },
      // 宝可梦实时位置（VR 手机地图页；视距近，靠地图找人）
      getMapMarkers: () => {
        const out: { name: string; x: number; z: number; color: string }[] = [];
        for (const v of this.villagers) {
          if (!v.group.visible || v === this.camperVillager) continue;
          out.push({ name: v.def.name, x: v.group.position.x, z: v.group.position.z, color: '#ffd34d' });
        }
        if (this.isabelle.group.visible) out.push({ name: '皮卡丘', x: this.isabelle.group.position.x, z: this.isabelle.group.position.z, color: '#ffe25a' });
        if (this.nook.group.visible) out.push({ name: '喵喵', x: this.nook.group.position.x, z: this.nook.group.position.z, color: '#c89bff' });
        if (this.camperVillager?.group.visible) out.push({ name: this.camperVillager.def.name, x: this.camperVillager.group.position.x, z: this.camperVillager.group.position.z, color: '#7fd97f' });
        return out;
      },
    });
    this.lastT = performance.now();
    this.renderer.setAnimationLoop(this.loop);

    // 标题画面：先显示 logo，点击后出现存档选择；开新游戏重载后跳过标题直接开场
    const skipTitle = sessionStorage.getItem('pixel-crossing-newgame') === '1';
    sessionStorage.removeItem('pixel-crossing-newgame');
    store.patch({ hasSave: !!this.peekSave(), titleStage: skipTitle ? null : 'logo' });
    this.pendingIntro = !this.introDone;
    if (skipTitle && this.pendingIntro) {
      this.pendingIntro = false;
      this.startIntroCine();
    }
  }

  private pendingIntro = false;

  // 读取岛名/玩家名并同步到 HUD
  private readNames() {
    try {
      const n = JSON.parse(localStorage.getItem('pixel-crossing-names') ?? '{}');
      if (n.island) this.islandName = n.island;
      if (n.player) this.playerName = n.player;
    } catch { /* 用默认 */ }
    store.patch({ islandName: this.islandName, playerName: this.playerName });
    document.title = `${this.islandName} · 慢生活`;
  }
  // 文案替换：「像素小岛」→ 自定义岛名
  private tt(s: string) { return s.replaceAll('像素小岛', this.islandName); }

  // 关联本地存档文件（标题菜单按钮触发；首次选文件，之后静默读写）
  private async linkSaveFile() {
    if (!savefile.fsaSupported) {
      this.toast('当前浏览器不支持文件存档', '📁', '可以用标题菜单的「导出/导入存档」备份');
      return;
    }
    if (savefile.isLinked()) {
      this.toast(`已关联：${savefile.linkedFileName()}`, '📁', '每次存档都会自动写入这个文件');
      return;
    }
    // 以前关联过：先尝试恢复授权；否则选新文件
    const restored = await savefile.requestPermissionFromGesture() || await savefile.linkNewFile();
    if (restored) {
      this.save(); // 立刻把当前进度写进文件
      this.toast(`已关联：${savefile.linkedFileName()}`, '📁', '以后存档会自动写入，清浏览器缓存也不怕了');
      sfx.fanfare();
    }
  }

  // 从标题画面进入游戏：fresh=true 开新游戏（清掉旧存档后重载），false 继续存档
  startFromTitle(fresh: boolean) {
    if (fresh) {
      sessionStorage.setItem('pixel-crossing-newgame', '1');
      localStorage.removeItem(SAVE_KEY);
      location.reload();
      return;
    }
    sfx.ui();
    store.patch({ titleStage: null });
    if (this.pendingIntro) {
      this.pendingIntro = false;
      this.startIntroCine();
    }
  }

  // ---------------- 输入 ----------------
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (k === 'e' || k === 'enter') this.interactDown();
    if (k === 'escape') this.closeAll();
    if (k === 'h') store.patch({ helpOpen: !store.state.helpOpen });
    if (k === 'm') store.patch({ mapOpen: !store.state.mapOpen });
    if (k === 'p') store.patch({ phoneOpen: !store.state.phoneOpen });
    const toolIdx = ['1', '2', '3', '4', '5'].indexOf(k);
    if (toolIdx >= 0) this.setTool(TOOLS[toolIdx].id);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === 'e' || k === 'enter') this.interactUp();
  };
  private onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.ui-layer')) return;
    this.dragging = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.camYaw -= (e.clientX - this.lastPointer.x) * 0.008;
    this.camPitch = Math.min(1.05, Math.max(0.35, this.camPitch + (e.clientY - this.lastPointer.y) * 0.004));
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };
  private onPointerUp = () => { this.dragging = false; };
  private onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  // ---------------- 小地图 ----------------
  private makeMapImage(): string {
    const c = document.createElement('canvas');
    const N2 = Math.round((HALF * 2) / TILE);
    c.width = N2; c.height = N2;
    const ctx = c.getContext('2d')!;
    const colors: Record<string, string> = {
      grass: '#58b34a', sand: '#e8d69c', path: '#c9b78a', dirt: '#a88a5e', water: '#3f9fd8', sea: '#2f7fc0',
    };
    for (let i = 0; i < N2; i++) for (let j = 0; j < N2; j++) {
      const x = (i - N2 / 2 + 0.5) * TILE;
      const z = (j - N2 / 2 + 0.5) * TILE;
      const h = rawHeight(x, z);
      let col: string;
      if (h < -0.75) col = Math.hypot(x, z) > 110 ? colors.sea : colors.water;
      else col = colors[tileType(x, z)];
      ctx.fillStyle = col;
      ctx.fillRect(i, j, 1, 1);
    }
    // 桥
    ctx.fillStyle = '#96683a';
    const b0 = Math.round((0 + HALF) / TILE);
    ctx.fillRect(b0 - 2, Math.round((-27 + HALF) / TILE), 4, Math.round(24 / TILE));
    // 建筑标记
    const mark = (x: number, z: number, col: string, r = 2) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round((x + HALF) / TILE) - r / 2, Math.round((z + HALF) / TILE) - r / 2, r, r);
    };
    mark(-30, 26, '#e2556b', 3);       // 商店
    mark(30, 26, '#e8a2d8', 3);        // 裁缝店
    mark(0, 54, '#c9a2ff', 3);         // 博物馆
    mark(44, 20, '#f7d774', 3);        // 玩家家
    // 断桥未修好：地图上红色醒目大标记，指引玩家去交付
    if (!this.world.bridgeFixed && this.world.bridgeBarrier) {
      mark(this.world.bridgeBarrier.x, this.world.bridgeBarrier.z, '#ff3333', 5);
    }
    for (const h of this.world.houses) {
      if (h.name === '你的帐篷' || h.name === '你的家') continue;
      mark(h.x, h.z, '#ffffff', 2);
    }
    return c.toDataURL();
  }

  // ---------------- 存档 ----------------
  private save() {
    try {
      const text = JSON.stringify({
        _savedAt: Date.now(), // 用于本地文件存档比较新旧
        bells: this.bells, miles: this.miles, inventory: this.inventory,
        questIdx: this.questIdx, questProgress: this.questProgress, questAccepted: this.questAccepted,
        tools: [...this.unlockedTools], introDone: this.introDone, dex: [...this.dex],
        homeUpgraded: this.world.homeUpgraded, firstFlags: this.firstFlags,
        donated: this.donated, homeExpanded: this.world.homeExpanded,
        placedFurniture: this.placedFurniture, outdoorFurniture: this.outdoorFurniture,
        residents: this.residents, camper: this.camper, lastCampDay: this.lastCampDay,
        strength: this.strength,
        bridgeFixed: this.world.bridgeFixed, shovelLevel: this.shovelLevel,
        gameDay: this.gameDay, time24: this.time24, mineState: this.mineState,
        homeDecor: this.homeDecor, weather: this.weather,
        dailyTasks: this.dailyTasks,
        friendship: this.friendship, nicknames: this.nicknames,
        iceShop: this.iceShop, shopMats: this.shopMats,
        staff: this.staff,
        islandName: this.islandName, playerName: this.playerName,
      });
      localStorage.setItem(SAVE_KEY, text);
      savefile.writeSave(text); // 已关联本地存档文件时：静默覆盖写入
    } catch { /* ignore */ }
  }
  private load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { this.inventory = {}; return; }
      const d = JSON.parse(raw);
      this.bells = d.bells ?? 500;
      this.miles = d.miles ?? 0;
      this.inventory = d.inventory ?? {};
      this.questIdx = d.questIdx ?? 0;
      this.questAccepted = d.questAccepted ?? false;
      this.questProgress = d.questProgress ?? 0;
      this.introDone = d.introDone ?? false;
      this.firstFlags = d.firstFlags ?? {};
      this.unlockedTools = new Set<ToolId>(d.tools ?? ['hand']);
      this.dex = new Set<string>(d.dex ?? []);
      store.patch({ dex: [...this.dex] });
      if (d.homeUpgraded) this.world.upgradeHome();
      this.donated = d.donated ?? [];
      this.placedFurniture = d.placedFurniture ?? [];
      this.outdoorFurniture = d.outdoorFurniture ?? [];
      this.strength = d.strength ?? 0;
      this.shovelLevel = d.shovelLevel ?? 1;
      this.gameDay = d.gameDay ?? 1;
      this.time24 = d.time24 ?? 9;
      this.mineState = d.mineState ?? null;
      this.homeDecor = d.homeDecor ?? { wall: null, floor: null };
      this.weather = d.weather ?? 'sun';
      this.dailyTasks = d.dailyTasks ?? null;
      this.friendship = d.friendship ?? {};
      this.nicknames = d.nicknames ?? {};
      if (d.iceShop) this.iceShop = { ...this.iceShop, ...d.iceShop, open: false };
      this.shopMats = d.shopMats ?? this.shopMats;
      this.staff = d.staff ?? {};
      // 存档里的岛名/玩家名（文件存档跨设备转移时跟着走）
      if (d.islandName || d.playerName) {
        this.islandName = d.islandName ?? this.islandName;
        this.playerName = d.playerName ?? this.playerName;
        localStorage.setItem('pixel-crossing-names', JSON.stringify({ island: this.islandName, player: this.playerName }));
      }
      if (this.iceShop.built) { this.world.buildIceCreamStall(this.iceShop.x, this.iceShop.z); this.world.upgradeIceStall(this.iceShop.level); }
      if (d.bridgeFixed) this.world.setBridgeFixed(true);
      // 篝火堆只在晚会当晚存在，跨天即撤（读档不再重建）
      if (d.homeExpanded) { this.world.upgradeHome(); this.world.expandHome(); }
    } catch { /* ignore */ }
  }

  // ---------------- 居民与露营考察 ----------------
  private dayStamp() { return Math.floor(Date.now() / 86400000); }

  private peekSave(): { residents?: string[]; camper?: Game['camper']; lastCampDay?: number } | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // 开局从 18 只宝可梦中随机挑 5 只初始居民
  private rollInitialResidents(): string[] {
    const ids = VILLAGER_ROSTER.map(p => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, 5);
  }

  // 露营者在高原广场扎帐篷（不闲逛，站在帐篷旁）
  private spawnCamper(id: string) {
    const prof = rosterById(id);
    if (!prof || this.camperVillager) return;
    this.world.buildCampTent();
    const v = new Villager(prof.def);
    const cx = this.world.campPos.x + 3.4, cz = this.world.campPos.z + 2.6;
    v.group.position.set(cx, groundHeight(cx, cz), cz);
    v.wander = false;
    v.yaw = Math.PI * 0.75;
    this.scene.add(v.group);
    this.camperVillager = v;
  }

  private removeCamper() {
    if (this.camperVillager) {
      this.scene.remove(this.camperVillager.group);
      this.camperVillager = null;
    }
    this.world.removeCampTent();
  }

  // 露营考察生命周期：新的一天可能来考察者；三天未完成任务则离开
  private updateCamp() {
    const today = this.dayStamp();
    if (this.camper) {
      if (today - this.camper.startDay >= 3) {
        const prof = rosterById(this.camper.id);
        this.removeCamper();
        this.camper = null;
        this.lastCampDay = today;
        this.save();
        this.toast(`${prof?.def.name ?? '考察者'}结束了考察`, '⛺', ' ta 收拾帐篷离开了小岛……');
      }
      return;
    }
    if (this.residents.length >= MAX_RESIDENTS) return;   // 住满了就不来人
    if (today <= this.lastCampDay) return;                 // 一天最多来一次
    // 用日期做种子的伪随机：约半数日子会有考察者到访
    const seed = Math.abs(Math.sin(today * 127.1) * 43758.5453) % 1;
    if (seed > 0.5) return;
    const candidates = VILLAGER_ROSTER.filter(p => !this.residents.includes(p.id));
    if (!candidates.length) return;
    const prof = candidates[Math.floor(seed * 2 * candidates.length) % candidates.length];
    this.camper = { id: prof.id, startDay: today, task: null };
    this.lastCampDay = today;
    this.spawnCamper(prof.id);
    this.save();
    this.toast('高原广场上来了考察者！', '⛺', `${prof.def.name}正在那里扎帐篷考察小岛`);
  }

  // 与露营者对话：接任务 / 交付任务 / 搬入
  private talkToCamper() {
    const camp = this.camper;
    const v = this.camperVillager;
    if (!camp || !v) return;
    const prof = rosterById(camp.id);
    if (!prof) return;
    const name = prof.def.name;
    const p = this.playerPos;
    v.yaw = Math.atan2(p.x - v.group.position.x, p.z - v.group.position.z);
    const left = Math.max(0, 3 - (this.dayStamp() - camp.startDay));

    if (!camp.task) {
      // 发布考察任务：带 3 个水果（苹果/樱桃/橘子/桃子任选一种）
      const fruit = pick(['apple', 'cherry', 'orange', 'peach']);
      camp.task = { item: fruit, need: 3 };
      this.save();
      this.dialog(name, `我是${name}，来这座岛考察要不要搬过来住！听说这里的${ITEMS[fruit].name}特别好吃，能帮我带 3 个来吗？我只会待 ${left} 天哦！ ——${prof.def.catchphrase}`, [
        { label: '包在我身上！', command: 'closeDialog' },
      ]);
      return;
    }
    const have = this.inventory[camp.task.item] || 0;
    const itemName = ITEMS[camp.task.item]?.name ?? camp.task.item;
    if (have >= camp.task.need) {
      this.removeItem(camp.task.item, camp.task.need);
      if (this.residents.length < MAX_RESIDENTS) {
        // 考察成功：分配住宅槽位，搬进来！
        this.residents.push(camp.id);
        applyResidents(this.residents);
        this.world.addResidentHome(prof);
        const moved = new Villager(prof.def);
        moved.group.position.set(prof.spawn.x, groundHeight(prof.spawn.x, prof.spawn.z), prof.spawn.z);
        moved.yaw = Math.random() * Math.PI * 2;
        this.villagers.push(moved);
        this.scene.add(moved.group);
        this.removeCamper();
        this.camper = null;
        this.save();
        sfx.fanfare();
        this.dialog(name, `太好吃了！这座岛太棒了，我决定搬过来住！以后我们就是邻居啦，请多关照！ ——${prof.def.catchphrase}`);
        this.toast(`${name}搬进了小岛！`, '🏠', `现在岛上有 ${this.residents.length} 位宝可梦居民`);
      } else {
        this.dialog(name, `谢谢你的${itemName}！可惜岛上好像住满了……我再考虑考虑吧。 ——${prof.def.catchphrase}`);
      }
    } else {
      this.dialog(name, `我的考察任务：带 ${camp.task.need} 个${itemName}给我（现在有 ${have} 个）。我还会在岛上待 ${left} 天！ ——${prof.def.catchphrase}`);
    }
  }

  private currentQuest() {
    if (!this.questAccepted) return null; // 未接取任务
    return this.questIdx < NOOK_QUESTS.length ? NOOK_QUESTS[this.questIdx] : null;
  }

  // ---------------- 每日任务 ----------------
  private static DAILY_POOL = [
    { kind: 'fish', icon: '🎣', text: '钓到 3 条鱼', need: 3, reward: 300 },
    { kind: 'bug', icon: '🐛', text: '捉到 2 只虫', need: 2, reward: 300 },
    { kind: 'shake', icon: '🌳', text: '摇树 5 次', need: 5, reward: 200 },
    { kind: 'sell', icon: '💰', text: '卖出物品 3 次', need: 3, reward: 300 },
    { kind: 'mine', icon: '⛏️', text: '挖矿 3 次', need: 3, reward: 300 },
    { kind: 'donate', icon: '🦉', text: '捐赠 1 件展品', need: 1, reward: 500 },
    { kind: 'talk', icon: '💬', text: '和宝可梦聊天 2 次', need: 2, reward: 200 },
    { kind: 'plant', icon: '🌱', text: '种植 2 次', need: 2, reward: 200 },
  ];

  // 每天以游戏日为种子随机挑 3 个任务（当天不变，全岛同步；按进度过滤掉还做不了的任务）
  private ensureDailyTasks() {
    if (this.dailyTasks && this.dailyTasks.day === this.gameDay) return;
    const avail = Game.DAILY_POOL.filter(t => {
      if (t.kind === 'mine') return this.world.bridgeFixed;   // 修好桥才能进矿洞
      if (t.kind === 'donate') return this.questIdx >= 5;      // 博物馆任务线解锁捐赠后
      if (t.kind === 'fish' || t.kind === 'bug') return this.questIdx >= 2; // 拿到鱼竿/虫网后
      return true;
    });
    const pool = avail.map((_, i) => i);
    let s = this.gameDay * 7919 + 131;
    for (let i = pool.length - 1; i > 0; i--) {
      s = (s * 233 + 137) % 100003;
      const j = s % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.dailyTasks = {
      day: this.gameDay,
      tasks: pool.slice(0, 3).map(i => ({ ...avail[i], progress: 0, done: false })),
    };
  }

  // 行为埋点：钓鱼/捉虫/摇树/卖货/挖矿/捐赠/聊天/种植
  private trackDaily(kind: string, n: number) {
    this.ensureDailyTasks();
    let changed = false;
    for (const t of this.dailyTasks!.tasks) {
      if (t.kind !== kind || t.done) continue;
      t.progress = Math.min(t.need, t.progress + n);
      changed = true;
      if (t.progress >= t.need) {
        t.done = true;
        this.addMiles(t.reward, false);
        sfx.fanfare();
        this.toast(`每日任务完成：${t.text}`, t.icon, `+${t.reward} 积分`);
        if (this.dailyTasks!.tasks.every(x => x.done)) {
          this.addMiles(500, false);
          this.toast('今日任务全部完成！', '🎉', '额外 +500 积分，明天再来吧！');
        }
      }
    }
    if (changed) { this.syncHud(); this.save(); }
  }

  // ---------------- 好感度 ----------------
  private static HEART_STEPS = [5, 15, 30, 50, 80]; // 1~5 心所需好感点
  private heartsOf(id: string) {
    const pts = this.friendship[id]?.pts ?? 0;
    let h = 0;
    while (h < 5 && pts >= Game.HEART_STEPS[h]) h++;
    return h;
  }
  private heartStr(id: string) {
    const h = this.heartsOf(id);
    return h > 0 ? ` ${'❤️'.repeat(h)}` : '';
  }

  // ---------------- 岛屿评价 ----------------
  private islandScore() {
    let s = 0;
    s += Math.max(0, this.residents.length - 5) * 20; // 新入住居民（初始5位不计分）
    s += this.donated.length * 8;                    // 博物馆展品
    s += Math.max(0, this.world.flowers.length - 100) * 2; // 玩家新种的花（初始野花不计）
    s += this.placedFurniture.length * 4;            // 室内家具
    s += this.outdoorFurniture.length * 6;           // 室外布置
    if (this.world.bridgeFixed) s += 20;             // 修好桥梁
    if (this.world.homeUpgraded) s += 10;            // 房子建成
    if (this.world.homeExpanded) s += 10;            // 房子扩建
    return s;
  }
  private rateIsland() {
    const score = this.islandScore();
    const stars = score >= 180 ? 5 : score >= 120 ? 4 : score >= 70 ? 3 : score >= 30 ? 2 : 1;
    const lines: Record<number, string> = {
      1: '这座岛还是一片荒地喵……多种点花、摆些家具，让岛热闹起来吧！',
      2: '有点样子了喵！邀请更多宝可梦入住、给博物馆捐展品，分数会涨得更快喵。',
      3: '很不错的岛了喵！室外多布置些家具、修好桥梁，就能冲 4 星喵！',
      4: '哇，度假胜地级别的岛喵！再集齐博物馆图鉴、把岛屿打扮得更漂亮，5 星就在眼前喵！',
      5: '完美的小岛喵！！🌈 住在这里的每一天都像度假一样，你是当之无愧的岛主喵！',
    };
    const tips: string[] = [];
    if (this.world.flowers.length < 10) tips.push('多种花');
    if (this.outdoorFurniture.length < 4) tips.push('室外摆家具');
    if (this.donated.length < 9) tips.push('捐赠博物馆');
    if (!this.world.bridgeFixed) tips.push('修桥');
    this.dialog('喵喵', `岛屿评价：${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)}（${stars} 星，评分 ${score}）\n${lines[stars]}${tips.length && stars < 5 ? `\n建议：${tips.join(' / ')}` : ''}`);
    // 刷新历史最高星级：每次突破都发奖励
    const best = (this.firstFlags['bestStars'] as number) ?? 0;
    if (stars > best) {
      this.firstFlags['bestStars'] = stars;
      const bonus = stars * 200;
      this.addMiles(bonus, false);
      this.syncHud();
      this.toast(`岛屿评价提升到 ${stars} 星！`, '🏝️', `喵喵奖励 +${bonus} 积分`);
      sfx.fanfare();
    }
    this.save();
  }

  // 选址检查：草地/沙滩、非水域、离边界和碰撞体够远
  private canPlaceShop(x: number, z: number) {
    if (Math.hypot(x, z) > HALF - 7) return false;
    if (isWaterAt(x, z)) return false;
    if (tileType(x, z) !== 'grass' && tileType(x, z) !== 'sand') return false;
    for (const c of this.world.colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + 2.8) return false;
    return true;
  }
  private placeShop() {
    const p = this.playerPos;
    if (!this.canPlaceShop(p.x, p.z)) {
      this.dialog('施工队', '这里没法施工……找一块平坦开阔、不涉水、离树木建筑远一点的空地吧！');
      return;
    }
    this.removeItem('deed');
    this.iceShop.built = true;
    this.iceShop.x = p.x; this.iceShop.z = p.z;
    this.world.buildIceCreamStall(p.x, p.z);
    sfx.fanfare();
    this.toast('冰淇淋店建好啦！', '🍦', '摇树摘水果，放入 5 个就能开始营业');
    this.dialog('施工队', '铛铛——「岛民冰淇淋店」完工！\n经营三步走：①摇树摘水果 ②来摊位把水果放进食材箱（5 个开一天）③点开始营业！\n和岛上宝可梦搞好关系（好感 2 心），还能雇它们来帮忙哦！');
    this.save();
  }

  // VR 按钮直启：不经过命令队列（头显浏览器要求用户手势立即触发，隔帧会被静默拒绝）
  enterVRNow() {
    if (store.state.titleStage) {
      this.startFromTitle(!store.state.hasSave);
      setTimeout(() => void this.vrSys.enter(), 1200);
    } else {
      void this.vrSys.enter();
    }
  }

  // ---------------- 岛民冰淇淋店 ----------------
  private static SHOP_LEVEL_NAMES = ['小摊', '小店', '名店'];
  // 升级条件：熟练度 + 金币 + 材料；效果：单价 +20/级，顾客更勤快
  private static SHOP_UPGRADES = [
    null,
    { prof: 40, bells: 20000, mats: [['wood', 20], ['stone', 20], ['ore_iron', 10]] as [string, number][] },
    { prof: 120, bells: 50000, mats: [['wood', 30], ['stone', 30], ['ore_gold', 20], ['diamond', 5]] as [string, number][] },
  ];
  private talkToIceShop() {
    const s = this.iceShop;
    const fruits = this.countFruits();
    const menus = this.menuCount();
    const status = `🍦 岛民冰淇淋店（${Game.SHOP_LEVEL_NAMES[s.level - 1]}）\n菜单：${Game.MENU_NAMES.slice(0, menus).join(' / ')}（单价 ${this.menuPrice()} 金币）\n熟练度：${s.proficiency}（累计接待顾客）\n食材箱：${s.stock} 个水果${s.open ? `\n今日已接待 ${s.todayCustomers} 位顾客，收入 ${s.todayEarn} 金币` : ''}`;
    if (s.open) {
      this.dialog('冰淇淋店', `${status}\n营业中！岛上的大家闻到香味就会排队来买。`, [
        { label: '🌙 打烊结算', command: 'iceClose' },
        { label: '继续营业', command: 'cancel' },
      ]);
      return;
    }
    const actions = [];
    if (fruits > 0) actions.push({ label: `🍎 放入全部水果（${fruits} 个）`, command: 'iceStock' });
    if (s.stock >= 5) actions.push({ label: '🏁 开始营业！', command: 'iceOpen' });
    let guide = s.stock >= 5
      ? '食材充足，可以开始营业了！'
      : `每天需要 5 个水果才能营业（还差 ${5 - s.stock} 个）。去摇果树摘水果，再来找我放进食材箱吧！`;
    // 店铺升级（小摊→小店→名店）
    const up = Game.SHOP_UPGRADES[s.level];
    if (up) {
      const nextName = Game.SHOP_LEVEL_NAMES[s.level];
      const matStr = up.mats.map(([id, n]) => `${ITEMS[id]?.name ?? id}×${n}`).join('、');
      if (s.proficiency >= up.prof) {
        actions.push({ label: `⬆️ 升级成「${nextName}」（${up.bells}金币+材料）`, command: 'iceUpgrade' });
        guide += `\n可升级：${nextName}（单价+20，顾客更多）`;
      } else {
        guide += `\n升级「${nextName}」需要：熟练度 ${s.proficiency}/${up.prof}、金币×${up.bells}、${matStr}`;
      }
    }
    actions.push({ label: '离开', command: 'cancel' });
    this.dialog('冰淇淋店', `${status}\n${guide}`, actions);
  }
  private upgradeIceShop() {
    const s = this.iceShop;
    const up = Game.SHOP_UPGRADES[s.level];
    if (!up || s.proficiency < up.prof) return;
    const lack: string[] = [];
    if (this.bells < up.bells) lack.push(`金币 ${this.bells}/${up.bells}`);
    for (const [id, n] of up.mats) if ((this.inventory[id] ?? 0) < n) lack.push(`${ITEMS[id]?.name ?? id} ${this.inventory[id] ?? 0}/${n}`);
    if (lack.length) {
      sfx.fail();
      this.dialog('冰淇淋店', `升级还缺：${lack.join('、')}。再努力一下吧！`, [{ label: '好的', command: 'cancel' }]);
      return;
    }
    this.addBells(-up.bells);
    for (const [id, n] of up.mats) this.removeItem(id, n);
    s.level++;
    this.world.upgradeIceStall(s.level);
    sfx.fanfare();
    const name = Game.SHOP_LEVEL_NAMES[s.level - 1];
    this.toast(`店铺升级成「${name}」了！`, '⬆️', `菜单单价 +20，慕名而来的顾客更多了`);
    this.dialog('冰淇淋店', `铛铛——店铺焕然一新，正式升级成「${name}」！\n单价上涨、名气大增，来排队的顾客会更多哦！`, [{ label: '太棒了！', command: 'cancel' }]);
    this.save();
  }
  private countFruits() {
    let n = 0;
    for (const [id, c] of Object.entries(this.inventory)) if (ITEMS[id]?.category === 'fruit') n += c;
    return n;
  }
  private stockFruits() {
    let n = 0;
    for (const id of Object.keys({ ...this.inventory })) {
      if (ITEMS[id]?.category !== 'fruit') continue;
      const c = this.inventory[id];
      this.removeItem(id, c);
      n += c;
    }
    this.iceShop.stock += n;
    sfx.sell();
    this.toast(`食材箱 +${n} 个水果`, '🍎', `现在库存 ${this.iceShop.stock} 个（5 个可营业一天）`);
    this.save();
    this.talkToIceShop(); // 刷新面板
  }
  private openIceShop() {
    if (this.iceShop.stock < 5 || this.iceShop.open) return;
    this.iceShop.open = true;
    this.iceShop.todayEarn = 0;
    this.iceShop.todayCustomers = 0;
    sfx.fanfare();
    this.toast('开始营业啦！', '🍦', '岛上的宝可梦们闻到香味就会来排队');
    this.save();
  }
  private closeIceShop(auto = false) {
    if (!this.iceShop.open) return;
    this.iceShop.open = false;
    const s = this.iceShop;
    // 打烊结算店员工资（从玩家账户扣；发不出工资店员会离职）
    const names = Object.keys(this.staff);
    if (names.length > 0) {
      const total = names.reduce((a, n) => a + this.wageFor(n), 0);
      if (this.bells >= total) {
        this.addBells(-total);
        for (const n of names) this.staff[n].days++;
        this.toast(`付了出去店员工资 ${total} 金币`, '💼', names.map(n => `${n} ${this.wageFor(n)}（在职 ${this.staff[n].days} 天）`).join('、'));
      } else {
        for (const n of names) {
          delete this.staff[n];
          const f = this.friendship[n];
          if (f) f.pts = Math.max(0, f.pts - 5);
        }
        this.toast('金币不够发工资……店员们离职了', '😢', '下次营业前记得备好工资钱');
      }
    }
    if (s.todayCustomers > 0) {
      this.toast(`今日营业结束：${s.todayCustomers} 位顾客，收入 ${s.todayEarn} 金币`, '🍦', `熟练度 ${s.proficiency}${this.menuCount() < 4 ? `，${Game.MENU_STEPS[this.menuCount()]} 解锁新口味` : ''}`);
    } else if (auto) {
      this.toast('今天没有顾客上门……', '🍦', '明天早点开始营业试试');
    }
    this.save();
  }
  // ---------------- 送礼 & 雇佣 ----------------
  private giveGift(v: Villager, item: string) {
    const fs = this.friendship[v.def.name] ?? { pts: 0, lastTalkDay: -1 };
    this.friendship[v.def.name] = fs;
    const oldHearts = this.heartsOf(v.def.name);
    if (fs.lastTalkDay !== this.gameDay) { fs.lastTalkDay = this.gameDay; fs.pts += 1; }
    const liked = v.def.likes?.includes(item);
    this.removeItem(item);
    fs.pts += liked ? 2 : 1;
    v.setBubble(liked ? '❤' : '🎵', 2);
    sfx.fanfare();
    const name = v.def.name;
    if (liked) {
      this.dialog(name + this.heartStr(name), `哇！是${ITEMS[item].name}！我最喜欢这个了，谢谢你！ ——${v.def.catchphrase}（好感 +2）`);
    } else {
      this.dialog(name + this.heartStr(name), `送我的吗？谢谢！我会好好珍惜的 ——${v.def.catchphrase}（好感 +1）`);
    }
    // 好感里程碑（2 心照片 / 4 心昵称）
    const newHearts = this.heartsOf(name);
    if (newHearts > oldHearts) {
      if (newHearts === 2) {
        this.addItem('photo');
        this.dialogQueue.push({ name, text: `我们已经这么要好了……这张照片送给你！ ——${v.def.catchphrase}（收到了${name}的照片！）` });
      } else if (newHearts === 4) {
        const nn = pick(['小岛主', '最佳搭档', '知心朋友', '岛上的太阳']);
        this.nicknames[name] = nn;
        this.dialogQueue.push({ name, text: `以后我可以叫你「${nn}」吗？嘿嘿，就这么定了！ ——${v.def.catchphrase}` });
      }
    }
    this.syncHud();
    this.save();
  }

  // 雇佣对话：选岗位
  private hireAsk() {
    const name = this.hireTarget;
    if (!name) { store.patch({ dialog: null }); return; }
    const actions = [
      { label: '🧺 采集员：摇树摘水果，自动补食材（工资150起）', command: 'hireGather' },
      { label: '🙋 接待员：站摊接待，等级越高售价越高（工资150起）', command: 'hireServe' },
    ];
    // 店长：好感4心以上才可托付，全岛只需一位
    const hasManager = Object.values(this.staff).some(s => s.job === 'manage');
    if (!hasManager && this.heartsOf(name) >= 4) {
      actions.push({ label: '🎩 店长：每天自动开店打烊（工资300起）', command: 'hireManage' });
    }
    actions.push({ label: '再想想', command: 'cancel' });
    this.dialog(name, `要在店里做什么工作呢？（工资打烊时从你的账户结算，等级越高工资越高）`, actions);
  }
  private hire(job: 'gather' | 'serve' | 'manage') {
    const name = this.hireTarget;
    if (!name || this.staff[name]) { store.patch({ dialog: null }); return; }
    this.hireTarget = null;
    this.staff[name] = { job, days: 0, xp: { gather: 0, serve: 0, manage: 0 } };
    sfx.fanfare();
    const v = this.villagers.find(x => x.def.name === name);
    if (v) { v.setBubble('💼', 2.5); v.target = null; v.activityKind = null; v.activityT = 0; }
    this.dialog(name, `交给我吧！我会加油的！ ——${v?.def.catchphrase ?? ''}`, []);
    const jobName = job === 'gather' ? '采集员' : job === 'serve' ? '接待员' : '店长';
    this.toast(`${name}成为了${jobName}！`, '💼', `每天 9:00~18:00 上班，工资 ${this.wageFor(name)}/天`);
    this.save();
  }
  private fireStaff() {
    const name = this.hireTarget;
    this.hireTarget = null;
    if (!name) { store.patch({ dialog: null }); return; }
    delete this.staff[name];
    const v = this.villagers.find(x => x.def.name === name);
    if (v) {
      (v as unknown as { basket?: number }).basket = 0;
      this.updateBasketMesh(v);
      const ww = v as unknown as { stoolMesh?: THREE.Mesh };
      if (ww.stoolMesh) { this.scene.remove(ww.stoolMesh); ww.stoolMesh = undefined; }
      v.setBubble('👋', 2);
    }
    this.dialog(name ?? '店员', '这段时间很开心！想再上班的话随时找我哦。', []);
    this.save();
  }

  // 雨天给室外宝可梦配小伞（颜色随机，举在手边）
  private updateUmbrella(v: Villager) {
    const w = v as unknown as { umbrella?: THREE.Group };
    const need = this.weather === 'rain' && !this.inside && v.group.visible && !this.partyActive;
    if (need && !w.umbrella) {
      const g = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), new THREE.MeshLambertMaterial({ color: 0x8a6239 }));
      stick.position.y = 0.45;
      g.add(stick);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.35, 8), new THREE.MeshLambertMaterial({ color: pick([0xe84a5a, 0x4a8e5a, 0x4a90d9, 0xf2b8c6, 0xf7d774]) }));
      canopy.position.y = 0.95;
      g.add(canopy);
      g.position.set(0.42, 1.3, 0.28);
      v.group.add(g);
      w.umbrella = g;
    } else if (!need && w.umbrella) {
      v.group.remove(w.umbrella);
      w.umbrella = undefined;
    }
  }

  // ---------------- 店员工作 AI ----------------
  private onDuty(name: string) {
    return this.time24 >= 9 && this.time24 < 18 && this.villagers.some(v => v.def.name === name && v.group.visible);
  }

  // 采集员手上的水果篮（藤编筐 + 水果小球，数量可见）
  private updateBasketMesh(v: Villager) {
    const w = v as unknown as { basket?: number; basketMesh?: THREE.Group };
    if (w.basketMesh) { v.group.remove(w.basketMesh); w.basketMesh = undefined; }
    const n = Math.min(4, w.basket ?? 0);
    if (n <= 0) return;
    const g = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.4), new THREE.MeshLambertMaterial({ color: 0xa87f4e }));
    crate.position.y = 0.15;
    g.add(crate);
    const colors = [0xe84a3a, 0xf2b8c6, 0xf2a03a, 0xf7b8d0];
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshLambertMaterial({ color: colors[i % 4] }));
      b.position.set(-0.15 + (i % 2) * 0.3, 0.36 + Math.floor(i / 2) * 0.14, -0.08 + (i % 2) * 0.1);
      g.add(b);
    }
    g.position.set(0, 0.55, 0.62); // 抱在胸前
    v.group.add(g);
    w.basketMesh = g;
  }

  // 返回 true = 本帧由工作逻辑接管（跳过闲逛/活动）
  private updateWorker(v: Villager, dt: number): boolean {
    const st = this.staff[v.def.name];
    if (!st || !this.iceShop.built || this.inside) return false;
    if (this.time24 < 9 || this.time24 >= 18) return false; // 下班时间自由活动
    if (this.partyActive) return false;
    const w = v as unknown as { jobState?: string; jobTree?: Tree | null; jobSubT?: number; basket?: number };
    if (!w.jobState) { w.jobState = 'idle'; w.jobSubT = 0; }
    v.activityKind = null; v.activityT = 0; // 工作中不做即兴活动
    const pos = v.group.position;
    const stall = this.world.iceStallPos;

    if (st.job === 'serve') {
      // 接待员：站在摊位后方（-z 一侧），面向顾客方向
      // 身高适配：矮个子（<0.6m）踩小木凳，高个子（>1.5m）后退半步免得顶到雨棚
      const hgt = v.def.height;
      const sx = stall.x, sz = stall.z - (hgt > 1.5 ? 2.3 : 1.6);
      const dx = sx - pos.x, dz = sz - pos.z, d = Math.hypot(dx, dz);
      const ww = v as unknown as { stoolMesh?: THREE.Mesh };
      if (d > 0.5) {
        // 离开岗位：收凳子、贴地
        if (ww.stoolMesh) { this.scene.remove(ww.stoolMesh); ww.stoolMesh = undefined; }
        v.moving = true;
        pos.x += (dx / d) * v.speed * dt;
        pos.z += (dz / d) * v.speed * dt;
        pos.y += (groundHeight(pos.x, pos.z) - pos.y) * Math.min(1, dt * 12);
        v.yaw = Math.atan2(dx, dz);
      } else {
        if (hgt < 0.6) {
          // 踩凳子才够得着柜台
          if (!ww.stoolMesh) {
            const gy = groundHeight(sx, sz);
            ww.stoolMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.7), new THREE.MeshLambertMaterial({ color: 0xa87f4e }));
            ww.stoolMesh.position.set(sx, gy + 0.17, sz);
            this.scene.add(ww.stoolMesh);
          }
          pos.y = ww.stoolMesh.position.y + 0.18;
        } else if (ww.stoolMesh) { this.scene.remove(ww.stoolMesh); ww.stoolMesh = undefined; }
        v.moving = false;
        v.yaw = 0; // 面向 +z（顾客来的方向）
        w.jobSubT = (w.jobSubT ?? 0) - dt;
        if (w.jobSubT <= 0) {
          w.jobSubT = 4 + Math.random() * 3;
          if (this.iceShop.open) {
            v.dance = 2; setTimeout(() => { v.dance = null; }, 900); // 挥手招呼
            if (Math.random() < 0.3) v.setBubble('🍦', 1.6);
          } else {
            v.headBow = 0.5; setTimeout(() => { v.headBow = 0; }, 800); // 擦拭柜台
          }
        }
      }
      return true;
    }

    if (st.job === 'manage') {
      // 店长：站在摊位侧面照看全场；每天 9:00 库存够就自动开店
      if (!this.iceShop.open && this.iceShop.stock >= 5 && this.time24 >= 9) {
        this.openIceShop();
        this.toast(`${v.def.name}店长开店了！`, '🎩', '今天也交给店长打理吧');
      }
      const sx = stall.x + 2.8, sz = stall.z + 0.6;
      const dx = sx - pos.x, dz = sz - pos.z, d = Math.hypot(dx, dz);
      if (d > 0.5) {
        v.moving = true;
        pos.x += (dx / d) * v.speed * dt;
        pos.z += (dz / d) * v.speed * dt;
        pos.y += (groundHeight(pos.x, pos.z) - pos.y) * Math.min(1, dt * 12);
        v.yaw = Math.atan2(dx, dz);
      } else {
        v.moving = false;
        v.yaw = -Math.PI / 2; // 面向摊位
        w.jobSubT = (w.jobSubT ?? 0) - dt;
        if (w.jobSubT <= 0) {
          w.jobSubT = 5 + Math.random() * 3;
          if (this.iceShop.open) { v.dance = 2; setTimeout(() => { v.dance = null; }, 900); if (Math.random() < 0.3) v.setBubble('📋', 1.6); }
          else { v.headBow = 0.5; setTimeout(() => { v.headBow = 0; }, 800); }
        }
      }
      return true;
    }

    // 采集员：找果树 → 摘满一筐 → 抱回店里倒货
    const cap = this.basketCap(v.def.name);
    w.jobSubT = (w.jobSubT ?? 0) - dt;
    if (w.jobState === 'idle') {
      w.basket = w.basket ?? 0;
      if (w.basket >= cap) { w.jobState = 'toShop'; return true; }
      // 找最近的有果果树
      let best: Tree | null = null, bd = 1e9;
      for (const t of this.world.trees) {
        if (!t.fruitId || t.fruits.length === 0) continue;
        const d = Math.hypot(t.x - pos.x, t.z - pos.z);
        if (d < bd) { bd = d; best = t; }
      }
      if (best) { w.jobTree = best; w.jobState = 'toTree'; }
      else if (w.basket > 0) w.jobState = 'toShop';
      else {
        // 没有果子可摘：在摊位附近待命
        v.moving = false;
        if (w.jobSubT <= 0) { w.jobSubT = 5; v.setBubble('💤', 1.5); }
      }
      return true;
    }
    if (w.jobState === 'toTree' && w.jobTree) {
      const t = w.jobTree;
      const dx = t.x - pos.x, dz = t.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 2.0) {
        v.moving = true;
        pos.x += (dx / d) * v.speed * 1.15 * dt;
        pos.z += (dz / d) * v.speed * 1.15 * dt;
        v.yaw = Math.atan2(dx, dz);
      } else {
        v.moving = false;
        v.yaw = Math.atan2(dx, dz);
        w.jobState = 'pick';
        w.jobSubT = 0;
      }
      return true;
    }
    if (w.jobState === 'pick' && w.jobTree) {
      const t = w.jobTree;
      if (t.fruits.length === 0 || (w.basket ?? 0) >= cap) { w.jobState = 'idle'; w.jobTree = null; return true; }
      if (w.jobSubT <= 0) {
        w.jobSubT = 1.1;
        t.shakeT = 0.5;
        v.action('swing', 0.5);
        // 摘一颗果子进筐（不进世界掉落物）
        this.world.pickFruit(t);
        w.basket = (w.basket ?? 0) + 1;
        this.updateBasketMesh(v);
        if (t.fruits.length === 0) t.regrowT = 150;
        const vol = 0.3 * this.distVol(pos.x, pos.z);
        if (vol > 0.005) sfx.shake();
      }
      return true;
    }
    if (w.jobState === 'toShop') {
      const dx = stall.x - pos.x, dz = (stall.z + 2.2) - pos.z, d = Math.hypot(dx, dz);
      if (d > 0.8) {
        v.moving = true;
        pos.x += (dx / d) * v.speed * 0.95 * dt; // 抱着筐走得慢一点
        pos.z += (dz / d) * v.speed * 0.95 * dt;
        v.yaw = Math.atan2(dx, dz);
      } else {
        v.moving = false;
        v.yaw = Math.atan2(stall.x - pos.x, stall.z - pos.z);
        const n = w.basket ?? 0;
        if (n > 0) {
          this.iceShop.stock += n;
          const xp = st.xp;
          const lv0 = this.jobLevel(xp.gather);
          xp.gather += n;
          if (this.jobLevel(xp.gather) > lv0) {
            this.toast(`${v.def.name}的采集等级升到 Lv.${this.jobLevel(xp.gather)}！`, '⬆️', `篮子一次能装 ${this.basketCap(v.def.name)} 个水果了`);
            v.setBubble('⬆️', 2);
          }
          w.basket = 0;
          this.updateBasketMesh(v);
          v.setBubble('📦', 1.4);
          this.save();
        }
        w.jobState = 'idle';
      }
      return true;
    }
    return true;
  }

  // 村民/游客购买一份冰淇淋（有接待员在岗：1.5 倍价格 + 接待熟练度）
  private serveCustomer(v?: Villager) {
    const s = this.iceShop;
    if (!s.open || s.stock <= 0) return;
    s.stock--;
    const before = this.menuCount();
    s.proficiency++;
    s.todayCustomers++;
    // 接待员在岗：按接待等级加价（×1.0 起，每级 +0.2，×2.0 封顶），接待熟练度 +1
    const serverName = Object.keys(this.staff).find(n => this.staff[n].job === 'serve' && this.onDuty(n));
    let price = this.menuPrice();
    if (serverName) {
      price = Math.round(price * this.serveMult(serverName));
      const xp = this.staff[serverName].xp;
      const lv0 = this.jobLevel(xp.serve);
      xp.serve++;
      if (this.jobLevel(xp.serve) > lv0) this.toast(`${serverName}的接待等级升到 Lv.${this.jobLevel(xp.serve)}！`, '⬆️', `现在顾客付款 ×${this.serveMult(serverName).toFixed(1)}`);
    } else {
      // 没有接待员时，店长顶班接待：管理熟练度 +1
      const mgr = Object.keys(this.staff).find(n => this.staff[n].job === 'manage' && this.onDuty(n));
      if (mgr) {
        const xp = this.staff[mgr].xp;
        const lv0 = this.jobLevel(xp.manage);
        xp.manage++;
        if (this.jobLevel(xp.manage) > lv0) this.toast(`${mgr}的管理等级升到 Lv.${this.jobLevel(xp.manage)}！`, '⬆️', '店长越来越可靠了');
      }
    }
    // 游客出手阔绰：再多付 50%
    if (v && (v as unknown as { tourist?: boolean }).tourist) price = Math.round(price * 1.5);
    s.todayEarn += price;
    this.addBells(price);
    if (this.menuCount() > before) {
      this.toast(`新口味解锁：${Game.MENU_NAMES[this.menuCount() - 1]}！`, '🎉', `菜单变丰富了，单价涨到 ${this.menuPrice()} 金币`);
      sfx.fanfare();
    }
    if (s.stock <= 0) {
      this.closeIceShop();
      this.toast('食材售罄，提前打烊！', '🍦', '明天多备点水果吧');
    }
    this.syncHud();
  }

  // ---------------- 外岛游客（观光船）----------------
  private islandStars() {
    const s = this.islandScore();
    return s >= 180 ? 5 : s >= 120 ? 4 : s >= 70 ? 3 : s >= 30 ? 2 : 1;
  }
  private touristCount() { return [3, 6, 10, 16, 25][this.islandStars() - 1]; }
  private boatUnlocked() { return this.iceShop.built && this.iceShop.proficiency >= 15; }

  private updateBoat(dt: number) {
    const pier = this.world.pierPos;
    if (this.boatState === 'none') {
      // 每天 8:00 船来（已解锁且今天还没来过）
      if (this.boatUnlocked() && this.time24 >= 8 && this.time24 < 9 && this.lastBoatDay !== this.gameDay) {
        this.lastBoatDay = this.gameDay;
        this.boatState = 'arriving';
        this.world.boat.visible = true;
        this.world.boat.position.set(pier.x, 0.4, pier.z + 140);
        this.toast('观光船来了！', '⛵', `今天有外岛游客来岛上玩`);
      }
      return;
    }
    const b = this.world.boat;
    if (this.boatState === 'arriving') {
      b.position.z -= 9 * dt; // 缓缓靠岸
      if (b.position.z <= pier.z + 9) {
        b.position.z = pier.z + 9;
        this.boatState = 'docked';
        this.spawnTourists();
      }
    } else if (this.boatState === 'docked') {
      // 17:45 开始召回游客
      if (this.time24 >= 17.75) {
        this.boatState = 'boarding';
        for (const v of this.tourists) {
          v.activityKind = null; v.activityT = 0; v.sitting = false;
          v.target = new THREE.Vector3(pier.x + (Math.random() - 0.5) * 3, 0, pier.z + 2);
        }
        this.toast('观光船快离岸了', '⛵', '游客们正在回码头');
      }
    } else if (this.boatState === 'boarding') {
      // 游客到齐码头即离岸（兜底 19:00 强制走）
      if (this.tourists.length === 0 || this.time24 >= 19) {
        for (const v of [...this.tourists]) this.removeTourist(v);
        this.boatState = 'leaving';
      }
    } else if (this.boatState === 'leaving') {
      b.position.z += 12 * dt;
      b.position.x += 4 * dt;
      if (b.position.z > pier.z + 140) {
        b.visible = false;
        this.boatState = 'none';
      }
    }
  }
  private lastBoatDay = 0;

  private spawnTourists() {
    const pier = this.world.pierPos;
    const pool = VILLAGER_ROSTER.filter(p => !this.residents.includes(p.id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const n = Math.min(this.touristCount(), pool.length);
    for (let i = 0; i < n; i++) {
      const v = new Villager(pool[i].def);
      v.group.position.set(pier.x + (Math.random() - 0.5) * 2, groundHeight(pier.x, pier.z - 3), pier.z - 3);
      v.yaw = Math.PI;
      v.wander = true;
      (v as unknown as { tourist?: boolean }).tourist = true;
      this.scene.add(v.group);
      this.villagers.push(v);
      this.tourists.push(v);
      v.target = new THREE.Vector3(pier.x + (Math.random() - 0.5) * 30, 0, pier.z - 8 - Math.random() * 20);
    }
    this.toast(`${n} 位游客上岛了！`, '🏖️', `岛屿评价 ${this.islandStars()} 星 · 他们会逛店、使用你摆的室外设施`);
    sfx.fanfare();
  }
  private removeTourist(v: Villager) {
    this.scene.remove(v.group);
    this.villagers = this.villagers.filter(x => x !== v);
    this.tourists = this.tourists.filter(x => x !== v);
  }

  // ---------------- 每日高价收购（1.5 倍）----------------
  private static HOT_CATS = [
    { cat: 'fish', icon: '🎣', label: '鱼类' },
    { cat: 'bug', icon: '🐛', label: '虫类' },
    { cat: 'fruit', icon: '🍎', label: '水果' },
    { cat: 'material', icon: '⛏️', label: '材料' },
    { cat: 'plant', icon: '🌱', label: '植物' },
  ];
  private hotCategory() { return Game.HOT_CATS[(this.gameDay * 313 + 77) % Game.HOT_CATS.length]; }
  private sellPrice(id: string) {
    const base = ITEMS[id]?.price ?? 0;
    return ITEMS[id]?.category === this.hotCategory().cat ? Math.round(base * 1.5) : base;
  }

  // 行为类任务进度（赚钱/种植/社交/捐赠等）：仅当当前任务匹配时累计
  private trackQuest(id: string, n: number) {
    // 同步驱动每日任务
    if (id === 'plant') this.trackDaily('plant', n);
    else if (id === 'friend') this.trackDaily('talk', n);
    else if (id === 'museum') this.trackDaily('donate', n);
    const q = this.currentQuest();
    if (q && q.id === id && this.questProgress < q.need) {
      this.questProgress += n;
      this.syncHud();
      this.save();
    }
  }

  private syncHud(extra: Partial<Parameters<typeof store.patch>[0]> = {}) {
    const q = this.currentQuest();
    this.ensureDailyTasks();
    store.patch({
      daily: this.dailyTasks!.tasks.map(t => ({ icon: t.icon, text: t.text, progress: t.progress, need: t.need, done: t.done })),
      bells: this.bells,
      miles: this.miles,
      inventory: { ...this.inventory },
      selectedItem: this.selectedItem,
      tool: this.tool,
      lockedTools: (['net', 'rod', 'shovel', 'axe'] as ToolId[]).filter(t => !this.unlockedTools.has(t)),
      quest: q ? {
        title: q.title, hint: q.hint, progress: Math.min(this.questProgress, q.need), need: q.need,
        ready: this.questProgress >= q.need || q.id === 'diy',
      } : null,
      homeUpgraded: this.world.homeUpgraded,
      ...extra,
    });
    this.syncFishingHud();
  }

  private setTool(t: ToolId) {
    if (!this.unlockedTools.has(t)) {
      this.dialog('???', '这件工具还没有拿到手……去找喵喵学习DIY吧！');
      return;
    }
    this.tool = t;
    this.player.setTool(t);
    this.player.setHeldItem(t === 'hand' ? this.selectedItem : null); // 切工具时收起手中物品
    if (t !== 'rod' && this.fishState !== 'idle') this.cancelFishing();
    sfx.ui();
    this.syncHud();
  }

  private addItem(id: string, n = 1) {
    // 图鉴登记（虫/鱼）
    if ((ITEMS[id]?.category === 'bug' || ITEMS[id]?.category === 'fish') && !this.dex.has(id)) {
      this.dex.add(id);
      store.patch({ dex: [...this.dex] });
    }
    // 每日任务：钓鱼 / 捉虫
    if (ITEMS[id]?.category === 'fish') this.trackDaily('fish', n);
    else if (ITEMS[id]?.category === 'bug') this.trackDaily('bug', n);
    this.inventory[id] = (this.inventory[id] || 0) + n;
    // 任务进度
    const q = this.currentQuest();
    if (q && this.questProgress < q.need) {
      if (q.id === 'branch' && id === 'branch') this.questProgress += n;
      else if (q.id === 'fruit' && FRUIT_SET.has(id)) this.questProgress += n;
      else if (q.id === 'fish' && ITEMS[id]?.category === 'fish') this.questProgress += n;
      else if (q.id === 'bug' && ITEMS[id]?.category === 'bug') this.questProgress += n;
      else if (q.id === 'fossil' && id === 'fossil') this.questProgress += n;
    }
    // 首次获得奖励积分
    if (!this.firstFlags['first_' + id]) {
      this.firstFlags['first_' + id] = true;
      if (['fish', 'bug'].includes(ITEMS[id]?.category ?? '')) this.addMiles(300, false);
      else if (id === 'fossil') this.addMiles(300, false);
    }
    this.syncHud();
    this.save();
  }
  private removeItem(id: string, n = 1) {
    if (!this.inventory[id]) return;
    this.inventory[id] -= n;
    if (this.inventory[id] <= 0) {
      delete this.inventory[id];
      if (this.selectedItem === id) this.selectedItem = null;
    }
    this.syncHud();
    this.save();
  }
  private addBells(n: number) {
    this.bells = Math.max(0, this.bells + n);
    this.syncHud();
    this.save();
  }
  private addMiles(n: number, sync = true) {
    this.miles = Math.max(0, this.miles + n);
    if (sync) { this.syncHud(); this.save(); }
  }

  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private toast(title: string, icon: string, desc = '') {
    store.patch({ toast: { title, icon, desc } });
    // 黑色提示 1.5 秒后自动消失
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      if (store.state.toast?.title === title) store.patch({ toast: null });
    }, 1500);
  }
  private dialog(name: string, text: string, actions?: { label: string; command: string }[]) {
    text = this.tt(text); // 「像素小岛」→ 自定义岛名
    store.patch({ dialog: { name, text, actions } });
    sfx.speak(text, this.voicePitch(name)); // 动森式咿呀语音
  }
  // 说话者基准嗓音（基频）：小体型尖、大体型沉
  private voicePitch(name: string): number {
    if (name === '皮卡丘') return 330;
    if (name === '喵喵') return 260;
    if (name === '傅达') return 150;
    const prof = profileByName(name);
    if (prof) {
      const h = prof.def.height;
      return h >= 1.8 ? 125 : h < 0.5 ? 390 : h < 0.9 ? 310 : 220;
    }
    return 250;
  }
  private advanceDialog() {
    if (this.cineActive) { this.nextCineShot(); return; }
    const next = this.dialogQueue.shift();
    if (next) {
      store.patch({ dialog: next });
      sfx.speak(next.text, this.voicePitch(next.name));
    }
    else {
      store.patch({ dialog: null });
      sfx.stopSpeak(); // 对话播完/被点掉：语音立即停止
    }
  }

  // ---------------- 交互 ----------------
  private findInteract(): Interactable | null {
    const p = this.playerPos;
    const candidates: Interactable[] = [];
    const near = (x: number, z: number, r: number) => Math.hypot(p.x - x, p.z - z) < r;
    const vr = !!this.vrSys?.active; // VR：对话类目标改为"指向+扳机"，走近不触发

    // 室内：村民（如果在家）/ 店员 / 馆长 + 出门
    if (this.inside) {
      if (!vr && this.inside === '友好商店' && this.nook.group.visible) {
        const kp = this.nook.group.position;
        const d = Math.hypot(p.x - kp.x, p.z - kp.z);
        if (d < 3.6) candidates.push({ kind: 'nook', prompt: 'E 与喵喵交谈（卖东西/任务）', dist: d });
      }
      if (!vr && this.inside === '博物馆' && this.owl.group.visible) {
        const op = this.owl.group.position;
        const d = Math.hypot(p.x - op.x, p.z - op.z);
        if (d < 3.4) candidates.push({ kind: 'owl', prompt: 'E 与傅达交谈（捐赠展品）', dist: d });
      }
      if (!vr && this.inside === '服务处' && this.isabelle.group.visible) {
        const ip = this.isabelle.group.position;
        const d = Math.hypot(p.x - ip.x, p.z - ip.z);
        if (d < 3.4) candidates.push({ kind: 'isabelle', prompt: 'E 与皮卡丘交谈', dist: d });
      }
      // 商店货架：靠近显示商品名和价格
      if (this.inside === '友好商店') {
        for (const s of this.shopStock) {
          const d = Math.hypot(p.x - s.x, p.z - s.z);
          if (d < 1.9) candidates.push({ kind: 'good', prompt: `E 购买 ${s.good.name}（${s.good.price} 金币）`, dist: d, target: s.good });
        }
      }
      // 手持家具时：在玩家家中可摆放（墙纸/地板则是直接使用更换内装）；室外也可以摆放
      if (this.inside === '你的家' && this.selectedItem && ITEMS[this.selectedItem]?.category === 'furniture') {
        const gd = GOOD_BY_ID[this.selectedItem];
        if (gd?.shape === 'wallpaper') candidates.push({ kind: 'applyDecor', prompt: `E 贴上 ${gd.name}`, dist: 0, target: 'wall' });
        else if (gd?.shape === 'flooring') candidates.push({ kind: 'applyDecor', prompt: `E 铺上 ${gd.name}`, dist: 0, target: 'floor' });
        else if (gd?.shape === 'picture') candidates.push({ kind: 'placeFurniture', prompt: `E 挂上 ${gd.name}`, dist: 0 });
        else candidates.push({ kind: 'placeFurniture', prompt: `E 摆放 ${ITEMS[this.selectedItem].name}`, dist: 0 });
      }
      // 手持日用品/水果时：可使用（吃水果获得力气）
      if (this.selectedItem && ['use', 'fruit'].includes(ITEMS[this.selectedItem]?.category ?? '')) {
        const cat = ITEMS[this.selectedItem].category;
        candidates.push({ kind: 'useItem', prompt: cat === 'fruit' ? `E 吃下 ${ITEMS[this.selectedItem].name}（获得力气）` : `E 使用 ${ITEMS[this.selectedItem].name}`, dist: 0 });
      }
      // 玩家家：收回已摆放的家具（范围放宽，大家具也能够到）
      if (this.inside === '你的家') {
        for (let i = 0; i < this.placedFurniture.length; i++) {
          const pf = this.placedFurniture[i];
          const d = Math.hypot(p.x - pf.x, p.z - pf.z);
          if (d < 3.0) candidates.push({ kind: 'placed', prompt: `E 收回 ${ITEMS[pf.id]?.name ?? '家具'}`, dist: d, target: i });
        }
      }
      if (!vr && this.insideVillager) {
        const v = this.insideVillager;
        const d = Math.hypot(p.x - v.group.position.x, p.z - v.group.position.z);
        if (d < 2.6) candidates.push({ kind: 'villager', prompt: `E 与${v.def.name}交谈`, dist: d, target: v });
      }
      // 矿洞内：矿石节点（铲子）+ 下行梯子
      if (this.inside === '矿洞') {
        if (this.tool === 'shovel') {
          for (const n of this.mineNodes) {
            const d = Math.hypot(p.x - n.mesh.position.x, p.z - n.mesh.position.z);
            if (d < 1.9) candidates.push({ kind: 'ore', prompt: `E 挖矿（${ITEMS[Game.MINE_ORE[this.mineFloor]].name}）`, dist: d, target: n });
          }
        }
        if (this.mineLadderMesh) {
          const d = Math.hypot(p.x - this.mineLadderMesh.position.x, p.z - this.mineLadderMesh.position.z);
          if (d < 2) candidates.push({ kind: 'ladder', prompt: `E 下到第${this.mineFloor + 1}层`, dist: d });
        }
      }
      // 玩家家/帐篷的床：睡觉（存档并跳到次日早上）
      if (this.inside === '你的家' || this.inside === '你的帐篷') {
        const d = Math.hypot(p.x + 5.6, p.z + 3.4);
        if (d < 2.2) candidates.push({ kind: 'sleep', prompt: this.inside === '你的帐篷' ? 'E 钻进睡袋睡觉' : 'E 上床睡觉', dist: d });
      }
      const dd = Math.hypot(p.x - this.interior.doorPos.x, p.z - this.interior.doorPos.z);
      if (dd < 1.7) candidates.push({ kind: 'exit', prompt: 'E 出门', dist: dd });
      if (!candidates.length) return null;
      candidates.sort((a, b) => a.dist - b.dist);
      return candidates[0];
    }

    // 室外：手持家具可摆放在草地上
    if (this.selectedItem && ITEMS[this.selectedItem]?.category === 'furniture') {
      const gd = GOOD_BY_ID[this.selectedItem];
      if (gd && gd.shape !== 'wallpaper' && gd.shape !== 'flooring')
        candidates.push({ kind: 'placeOutdoor', prompt: `E 把 ${gd.name} 放在这里`, dist: 0 });
    }
    // 室外：收回摆放在外面的家具
    for (let i = 0; i < this.outdoorFurniture.length; i++) {
      const of2 = this.outdoorFurniture[i];
      const d = Math.hypot(p.x - of2.x, p.z - of2.z);
      if (d < 3.0) candidates.push({ kind: 'placedOutdoor', prompt: `E 收回 ${ITEMS[of2.id]?.name ?? '家具'}`, dist: d, target: i });
    }
    // 掉落物（VR 模式改为"手柄指向+扳机"拾取，走近/挥臂不再触发）
    if (!this.vrSys?.active) {
      for (const pk of this.world.pickups) {
        const d = Math.hypot(p.x - pk.mesh.position.x, p.z - pk.mesh.position.z);
        if (d < 2) {
          const label = pk.item === 'bells' ? '零钱袋' : ITEMS[pk.item]?.name ?? pk.item;
          candidates.push({ kind: 'pickup', prompt: `E 拾取 ${label}`, dist: d, target: pk });
        }
      }
    }
    // 喵喵（房子建好前在店外，之后进店里）
    if (!vr && this.nook.group.visible) {
      const d = Math.hypot(p.x - this.nook.group.position.x, p.z - this.nook.group.position.z);
      if (d < 2.8) candidates.push({ kind: 'nook', prompt: 'E 与喵喵交谈', dist: d - 0.5 });
    }
    // 皮卡丘（在服务处内）
    if (!vr && this.isabelle.group.visible) {
      const d = Math.hypot(p.x - this.isabelle.group.position.x, p.z - this.isabelle.group.position.z);
      if (d < 2.8) candidates.push({ kind: 'isabelle', prompt: 'E 与皮卡丘交谈', dist: d - 0.5 });
    }
    // 村民（手持水果/花时优先变成送礼）
    const giftable = this.selectedItem && ['fruit', 'flower'].includes(ITEMS[this.selectedItem]?.category ?? '');
    for (const v of this.villagers) {
      if (vr || !v.group.visible) continue;
      const d = Math.hypot(p.x - v.group.position.x, p.z - v.group.position.z);
      if (d < 2.6) {
        candidates.push(giftable
          ? { kind: 'villager', prompt: `E 把${ITEMS[this.selectedItem!].name}送给${v.def.name}`, dist: -1, target: v }
          : { kind: 'villager', prompt: `E 与${v.def.name}交谈`, dist: d, target: v });
      }
    }
    // 露营考察者（高原帐篷旁）
    if (!vr && this.camperVillager) {
      const cv = this.camperVillager;
      const d = Math.hypot(p.x - cv.group.position.x, p.z - cv.group.position.z);
      if (d < 3) candidates.push({ kind: 'camper', prompt: `E 与${cv.def.name}交谈（考察中）`, dist: d });
    }
    // 断桥路障：修理矿岛的桥
    if (!this.world.bridgeFixed && this.world.bridgeBarrier) {
      const bb = this.world.bridgeBarrier;
      const d = Math.hypot(p.x - bb.x, p.z - bb.z);
      if (d < 5.5) candidates.push({ kind: 'repairBridge', prompt: 'E 修理断桥（木材×10 石头×10 金币×3000）', dist: d });
    }
    // 布告栏
    if (near(this.world.boardPos.x, this.world.boardPos.z, 2.2)) {
      candidates.push({ kind: 'board', prompt: 'E 查看布告栏', dist: Math.hypot(p.x - this.world.boardPos.x, p.z - this.world.boardPos.z) });
    }
    // 冰淇淋店
    if (this.iceShop.built && near(this.world.iceStallPos.x, this.world.iceStallPos.z, 3.4)) {
      candidates.push({ kind: 'icecream', prompt: this.iceShop.open ? 'E 冰淇淋店（营业中）' : 'E 冰淇淋店', dist: Math.hypot(p.x - this.world.iceStallPos.x, p.z - this.world.iceStallPos.z) });
    }
    // 手持地契：选址建店（空地、不涉水、不撞建筑）
    if (this.selectedItem === 'deed' && !this.iceShop.built && this.canPlaceShop(p.x, p.z)) {
      candidates.push({ kind: 'placeShop', prompt: 'E 在这里建冰淇淋店！', dist: -2 });
    }
    // 房屋
    for (const h of this.world.houses) {
      const enterable = h.name !== '裁缝店';
      if (near(h.x, h.z, 2.8)) candidates.push({ kind: 'house', prompt: enterable ? `E 进入${h.name}` : `E 看看${h.name}`, dist: Math.hypot(p.x - h.x, p.z - h.z), target: h });
    }
    // 虫（需要虫网）
    if (this.tool === 'net') {
      for (const b of this.world.bugs) {
        const d = Math.hypot(p.x - b.group.position.x, p.z - b.group.position.z);
        if (d < 2.8) candidates.push({ kind: 'bug', prompt: 'E 捕捉！', dist: d, target: b });
      }
    }
    // 挖掘点（需要铲子）
    if (this.tool === 'shovel') {
      for (const s of this.world.digSpots) {
        if (near(s.x, s.z, 2.2)) candidates.push({ kind: 'dig', prompt: 'E 挖掘', dist: Math.hypot(p.x - s.x, p.z - s.z), target: s });
      }
      for (const r of this.world.rocks) {
        if (near(r.x, r.z, 2.6)) candidates.push({ kind: 'rock', prompt: 'E 敲石头', dist: Math.hypot(p.x - r.x, p.z - r.z), target: r });
      }
    }
    // 手持日用品/水果时：可使用（室内外均可，吃水果获得力气）
    if (this.selectedItem && ['use', 'fruit'].includes(ITEMS[this.selectedItem]?.category ?? '')) {
      const cat = ITEMS[this.selectedItem].category;
      candidates.push({ kind: 'useItem', prompt: cat === 'fruit' ? `E 吃下 ${ITEMS[this.selectedItem].name}（获得力气）` : `E 使用 ${ITEMS[this.selectedItem].name}`, dist: 0 });
    }
    // 空手：拔草 / 花 / 种植（树：空手摇，斧头砍）
    if (this.tool === 'hand') {
      if (this.selectedItem === 'sapling' || this.selectedItem === 'seedbag' || (this.selectedItem !== null && ['seed', 'plant'].includes(ITEMS[this.selectedItem]?.category ?? ''))) {
        if (tileType(p.x, p.z) === 'grass') {
          const sel = this.selectedItem;
          candidates.push({ kind: 'plant', prompt: sel === 'sapling' ? 'E 种下树苗' : sel === 'seedbag' ? 'E 播下花种' : `E 种下${ITEMS[sel!].name}`, dist: 0 });
        }
      }
      for (const w of this.world.weeds) {
        if (near(w.x, w.z, 1.8)) candidates.push({ kind: 'weed', prompt: 'E 拔草', dist: Math.hypot(p.x - w.x, p.z - w.z), target: w });
      }
      for (const f of this.world.flowers) {
        if (near(f.x, f.z, 1.8)) candidates.push({ kind: 'flower', prompt: 'E 摘花', dist: Math.hypot(p.x - f.x, p.z - f.z), target: f });
      }
    }
    // 铲子：铲起花（可重新种植的花苗）
    if (this.tool === 'shovel') {
      for (const f of this.world.flowers) {
        if (near(f.x, f.z, 1.8)) candidates.push({ kind: 'shovelFlower', prompt: 'E 铲起花苗', dist: Math.hypot(p.x - f.x, p.z - f.z), target: f });
      }
      // 吃饱后有力气：可以铲起整棵树（移栽）
      if (this.strength > 0) {
        for (const t of this.world.trees) {
          if (near(t.x, t.z, 2.4)) candidates.push({ kind: 'digTree', prompt: `E 铲起大树（力气 ${this.strength}）`, dist: Math.hypot(p.x - t.x, p.z - t.z), target: t });
        }
      }
    }
    // 树（空手摇树 / 斧头砍树）
    if (this.tool === 'hand' || this.tool === 'axe') {
      for (const t of this.world.trees) {
        if (near(t.x, t.z, 2.4)) candidates.push({ kind: 'tree', prompt: this.tool === 'axe' ? 'E 砍树' : 'E 摇树', dist: Math.hypot(p.x - t.x, p.z - t.z), target: t });
      }
    }
    // 钓鱼
    if (this.tool === 'rod' && this.fishState === 'idle') {
      if (this.nearWater()) candidates.push({ kind: 'fish', prompt: '长按 E 蓄力，松开抛竿', dist: 1 });
    } else if (this.fishState === 'charging') {
      candidates.push({ kind: 'reel', prompt: '松开 E 抛竿！', dist: 0 });
    } else if (this.fishState === 'bite') {
      candidates.push({ kind: 'reel', prompt: 'E 拉杆！！', dist: 0 });
    } else if (this.fishState === 'hooked') {
      candidates.push({ kind: 'reel', prompt: '连按 E 收线！', dist: 0 });
    } else if (this.fishState === 'nibble' || this.fishState === 'waiting' || this.fishState === 'cast') {
      candidates.push({ kind: 'reel', prompt: '别急着拉杆……（E 收竿）', dist: 2 });
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates[0];
  }

  // E 按下：优先处理钓鱼/弹窗，否则正常交互
  private interactDown() {
    if (store.state.titleStage) return; // 标题画面期间禁止交互
    if (store.state.phoneOpen) return;
    if (store.state.dialog) {
      if (store.state.dialog.actions) return;
      sfx.ui();
      this.advanceDialog();
      return;
    }
    if (store.state.toast) { store.patch({ toast: null }); sfx.ui(); return; }
    if (store.state.shopOpen) return;
    // 钓鱼状态机
    if (this.fishState === 'hooked') { this.reelPress(); return; }
    if (this.fishState === 'bite') { this.hookFish(); return; }
    if (this.fishState === 'nibble') { this.scareFish(); return; }
    if (this.fishState === 'waiting' || this.fishState === 'cast') { this.cancelFishing(); return; }
    if (this.fishState === 'charging') return;
    if (this.tool === 'rod' && this.fishState === 'idle' && this.nearWater()) {
      this.startCharge();
      return;
    }
    this.interact();
  }

  private interactUp() {
    if (this.fishState === 'charging') this.castRod();
  }

  // 拾取地面掉落物入包（E键交互 / VR 指向拾取共用）
  private collectPickup(pk: Pickup) {
    this.world.removePickup(pk);
    if (pk.item === 'bells') {
      this.addBells(pk.bells ?? 100);
      this.toast('捡到了零钱袋！', '💰', `+${pk.bells ?? 100} 金币`);
    } else {
      this.addItem(pk.item);
      const def = ITEMS[pk.item];
      this.toast(`获得了${def?.name ?? pk.item}！`, def?.icon ?? '❔', def?.desc ?? '');
    }
    sfx.pickup();
  }

  private interact() {
    if (store.state.dialog || store.state.toast || store.state.shopOpen) return;
    const it = this.findInteract();
    if (!it) return;
    this.doInteract(it);
  }

  // 执行一次交互（E键 / 扳机 / VR 指向对话共用）
  private doInteract(it: Interactable) {
    const p = this.playerPos;

    switch (it.kind) {
      case 'pickup': {
        this.collectPickup(it.target as Pickup);
        break;
      }
      case 'nook': this.talkToNook(); break;
      case 'isabelle': {
        this.isabelle.yaw = Math.atan2(p.x - this.isabelle.group.position.x, p.z - this.isabelle.group.position.z);
        this.dialog('皮卡丘', pick(PIKACHU_LINES));
        break;
      }
      case 'villager': {
        const v = it.target as Villager;
        v.target = null; v.idleT = 4;
        v.yaw = Math.atan2(p.x - v.group.position.x, p.z - v.group.position.z);
        this.trackQuest('friend', 1);
        // ---------- 玩家送礼：手持水果/花按 E 赠送 ----------
        const sel = this.selectedItem;
        if (sel && (ITEMS[sel]?.category === 'fruit' || ITEMS[sel]?.category === 'flower')) {
          this.giveGift(v, sel);
          break;
        }
        // ---------- 已雇佣：查看岗位状况 / 解雇 ----------
        const st0 = this.staff[v.def.name];
        if (st0) {
          const xp = st0.job === 'gather' ? st0.xp.gather : st0.job === 'serve' ? st0.xp.serve : st0.xp.manage;
          const lv = this.jobLevel(xp);
          const jobName = st0.job === 'gather' ? '采集员' : st0.job === 'serve' ? '接待员' : '店长';
          const nxt = this.nextLevelXp(lv);
          const extra = st0.job === 'gather' ? `篮子一次能装 ${this.basketCap(v.def.name)} 个水果`
            : st0.job === 'serve' ? `顾客付款 ×${this.serveMult(v.def.name).toFixed(1)}`
            : '每天 9:00 自动开店，打烊自动结算';
          this.dialog(v.def.name + this.heartStr(v.def.name), `${v.def.name}（${jobName} Lv.${lv}${nxt > 0 ? `，熟练度 ${xp}/${nxt}` : '，已满级'}）\n在职 ${st0.days} 天，${extra}。每天工资 ${this.wageFor(v.def.name)} 金币，打烊时结算。`, [
            { label: '💤 让他下班（解雇）', command: 'fireStaff' },
            { label: '辛苦啦！', command: 'cancel' },
          ]);
          this.hireTarget = v.def.name;
          break;
        }
        // ---------- 好感≥2心 + 岛屿3星 + 有店：可雇佣（游客不住岛，不能雇） ----------
        const isT = (v as unknown as { tourist?: boolean }).tourist;
        const wantHire = this.iceShop.built && this.heartsOf(v.def.name) >= 2 && !isT;
        const starGate = wantHire && this.islandStars() < 3;
        const canHire = wantHire && !starGate;
        // 好感度：每天首次聊天 +1，收到礼物 +3
        const fs = this.friendship[v.def.name] ?? { pts: 0, lastTalkDay: -1 };
        this.friendship[v.def.name] = fs;
        const oldHearts = this.heartsOf(v.def.name);
        if (fs.lastTalkDay !== this.gameDay) { fs.lastTalkDay = this.gameDay; fs.pts += 1; }
        const nick = this.nicknames[v.def.name];
        // 称呼优先级：专属昵称 > 一半概率叫玩家名 > 不称呼
        const nickCall = nick ? `${nick}！` : (Math.random() < 0.5 ? `${this.playerName}！` : '');
        // 原版设定：村民主动送礼概率很低（约 6%），不能次次聊天都送
        if (Math.random() < 0.06) {
          fs.pts += 3;
          const gr = Math.random();
          if (gr < 0.15) {
            // 小概率：村民赠送系列家具/墙纸/地板（对标原版村民送家具）
            const gid = randomSetGoodId();
            this.addItem(gid);
            this.dialog(v.def.name + this.heartStr(v.def.name), `${nickCall}${pick(GIFT_LINES)}（收到了${ITEMS[gid]?.name ?? '家具'}！）`);
          } else if (gr < 0.575) {
            const bells = 100 + Math.floor(Math.random() * 4) * 100;
            this.addBells(bells);
            this.dialog(v.def.name + this.heartStr(v.def.name), `${nickCall}${pick(GIFT_LINES)}（收到了 ${bells} 金币！）`);
          } else {
            const gift = pick(['apple', 'cherry', 'orange', 'peach', 'seedbag']);
            this.addItem(gift);
            this.dialog(v.def.name + this.heartStr(v.def.name), `${nickCall}${pick(GIFT_LINES)}（收到了${ITEMS[gift].name}！）`);
          }
        } else if (starGate) {
          this.dialog(v.def.name + this.heartStr(v.def.name), `${nickCall}${pick(v.def.lines)} ——${v.def.catchphrase}\n（想去店里帮忙，但岛屿评价达到 ⭐⭐⭐ 才能雇佣，找西施惠看看岛评吧！）`);
        } else if (canHire) {
          this.hireTarget = v.def.name;
          this.dialog(v.def.name + this.heartStr(v.def.name), nickCall + pick(v.def.lines) + ` ——${v.def.catchphrase}`, [
            { label: '💼 来我的店里帮忙吧！', command: 'hireAsk' },
            { label: '只是打个招呼', command: 'cancel' },
          ]);
        } else {
          this.dialog(v.def.name + this.heartStr(v.def.name), nickCall + pick(v.def.lines) + ` ——${v.def.catchphrase}`);
        }
        // 好感度提升事件（覆盖普通对话，里程碑式惊喜）
        const newHearts = this.heartsOf(v.def.name);
        if (newHearts > oldHearts) {
          if (newHearts === 2) {
            // 满 2 心：赠送纪念照片（原版村民照片设定）
            this.addItem('photo');
            this.dialog(v.def.name + this.heartStr(v.def.name), `${nickCall}我们已经这么要好了……这张照片送给你，要一直把我当朋友哦！ ——${v.def.catchphrase}（收到了${v.def.name}的照片！）`);
            this.toast(`和${v.def.name}的好感度达到 2 心！`, '📷', '收到了纪念照片');
          } else if (newHearts === 4) {
            // 满 4 心：给玩家起专属昵称
            const nn = pick(['小岛主', '最佳搭档', '知心朋友', '岛上的太阳']);
            this.nicknames[v.def.name] = nn;
            this.dialog(v.def.name + this.heartStr(v.def.name), `那个……以后我可以叫你「${nn}」吗？嘿嘿，就这么定了，${nn}！ ——${v.def.catchphrase}`);
            this.toast(`${v.def.name}给你起了昵称！`, '💝', `以后它会叫你「${nn}」`);
          } else {
            this.dialog(v.def.name + this.heartStr(v.def.name), `${nickCall}（好感度提升了！${'❤️'.repeat(newHearts)}）${pick(v.def.lines)} ——${v.def.catchphrase}`);
          }
        }
        this.save();
        break;
      }
      case 'shop':
        sfx.ui();
        this.openShopPanel();
        break;
      case 'icecream': this.talkToIceShop(); break;
      case 'placeShop': this.placeShop(); break;
      case 'camper': this.talkToCamper(); break;
      case 'ore': this.hitOre(it.target as { mesh: THREE.Group; hp: number; idx: number }); break;
      case 'ladder': { sfx.ui(); this.descendLadder(); break; }
      case 'sleep': {
        sfx.ui();
        this.dialog('床', '暖洋洋的被窝……要睡一觉到明天早上吗？', [
          { label: '😴 存档并睡到早上', command: 'sleepSave' },
          { label: '💤 直接睡（不存档）', command: 'sleepNoSave' },
          { label: '再躺一会儿', command: 'cancel' },
        ]);
        break;
      }
      case 'repairBridge': this.repairBridge(); break;
      case 'owl': this.talkToOwl(); break;
      case 'good': {
        // 购买货架商品
        const good = it.target as ShopGood;
        if (this.bells < good.price) {
          sfx.fail();
          this.dialog('喵喵', `这件「${good.name}」要 ${good.price} 金币喵，你现在只有 ${this.bells} 金币，再去攒一点吧喵！`);
        } else {
          this.addBells(-good.price);
          this.addItem(good.id, 1);
          sfx.sell();
          this.toast(`买到了${good.name}！`, good.icon, good.cat === 'furniture' ? '回家后拿在手上按 E 摆放' : good.cat === 'use' ? '拿在手上按 E 使用' : '拿在手上对草地按 E 种植');
        }
        break;
      }
      case 'placed': {
        // 收回摆放的家具
        const idx = it.target as number;
        const pf = this.placedFurniture[idx];
        if (pf) {
          this.placedFurniture.splice(idx, 1);
          this.addItem(pf.id, 1);
          sfx.pickup();
          this.interior.build(this.playerHomeStyle(), '你的家');
          this.renderPlacedFurniture();
          this.toast(`收回了${ITEMS[pf.id]?.name ?? '家具'}`, ITEMS[pf.id]?.icon ?? '📦');
          this.save();
        }
        break;
      }
      case 'board':
        sfx.ui();
        this.dialog('布告栏', pick(BOARD_TIPS));
        break;
      case 'house': {
        const h = it.target as { name: string };
        if (h.name === '矿洞') {
          this.enterMine(1); // 进矿洞总是从第一层开始
        } else if (h.name === '你的帐篷') {
          sfx.ui();
          this.enterInterior('你的帐篷'); // 帐篷可以进入了，睡袋能睡觉存档
        } else if (h.name === '裁缝店') {
          sfx.ui();
          this.dialog('裁缝店', '麻儿和绢儿正在里面忙碌着……服装店即将开张，敬请期待！');
        } else {
          this.enterInterior(h.name);
        }
        break;
      }
      case 'exit':
        this.exitInterior();
        break;
      case 'bug': {
        const b = it.target as Bug;
        this.swingArm();
        const def = ITEMS[b.itemId];
        this.addItem(b.itemId);
        this.world.removeBug(b);
        this.bugRespawnT = 18;
        sfx.fanfare();
        this.toast(`抓到了${def?.name}！`, def?.icon ?? '🦋', def?.desc ?? '');
        break;
      }
      case 'dig': {
        const s = it.target as DigSpot;
        this.swingArm('dig');
        sfx.dig();
        this.world.removeDigSpot(s);
        this.digRespawnT = 45;
        const roll = Math.random();
        if (roll < 0.05) {
          // 极小概率：系列家具/墙纸/地板（对标原版坑洞出家具）
          this.world.addPickup(randomSetGoodId(), new THREE.Vector3(s.x, groundHeight(s.x, s.z) + 0.5, s.z), undefined, true);
        } else if (roll < 0.42) {
          this.world.addPickup('fossil', new THREE.Vector3(s.x, groundHeight(s.x, s.z) + 0.5, s.z), undefined, true);
        } else if (roll < 0.72) {
          this.world.addPickup('gyroid', new THREE.Vector3(s.x, groundHeight(s.x, s.z) + 0.5, s.z), undefined, true);
        } else {
          this.world.addPickup('bells', new THREE.Vector3(s.x, groundHeight(s.x, s.z) + 0.5, s.z), 200 + Math.floor(Math.random() * 3) * 100, true);
        }
        break;
      }
      case 'rock': {
        const r = it.target as Rock;
        this.swingArm('chop');
        if (this.elapsed < r.cooldownUntil) {
          sfx.rock();
          this.dialog('石头', '敲了敲石头……好像暂时敲不出什么了。');
          break;
        }
        r.cooldownUntil = this.elapsed + 30;
        sfx.rock();
        const roll = Math.random();
        const pos = new THREE.Vector3(r.x, groundHeight(r.x, r.z) + 1, r.z);
        // 敲石头掉石头，小概率出铁矿石（矿洞二层那种，能升级铲子/店铺）
        if (roll < 0.88) this.world.addPickup('stone', pos, undefined, true);
        else this.world.addPickup('ore_iron', pos, undefined, true);
        r.group.rotation.z = 0.1;
        setTimeout(() => { r.group.rotation.z = 0; }, 150);
        break;
      }
      case 'weed': {
        const w = it.target as { id: number; x: number; z: number };
        this.world.removeWeed(w);
        this.addItem('weed');
        sfx.pickup();
        break;
      }
      case 'flower': {
        // 空手摘花：只能送人或卖掉，不能再种
        const f = it.target as Flower;
        this.world.removeFlower(f);
        this.addItem(f.itemId);
        sfx.pickup();
        this.toast(`摘下了${ITEMS[f.itemId].name}！`, ITEMS[f.itemId].icon, '可以送人，也可以卖给商店');
        break;
      }
      case 'shovelFlower': {
        // 铲子铲花：得到花苗，可以重新种回土里
        const f = it.target as Flower;
        this.world.removeFlower(f);
        this.addItem(f.itemId + '_plant');
        sfx.dig();
        this.toast(`铲起了${ITEMS[f.itemId].name}花苗！`, '🌱', '拿在手上对草地按 E 可以重新种');
        break;
      }
      case 'digTree': {
        // 吃饱后铲起整棵树：变成果树苗进背包（保留品种），消耗 1 点力气
        const t = it.target as Tree;
        if (this.strength <= 0) { sfx.fail(); break; }
        this.strength--;
        this.world.removeTree(t);
        const sid = t.fruitId ? `sapling_${t.fruitId}` : 'sapling';
        this.addItem(sid);
        sfx.dig();
        this.swingArm('dig');
        this.toast(`铲起了${ITEMS[sid].name}！`, '🌳', `拿在手上对草地按 E 重新种下（剩余力气 ${this.strength}）`);
        this.save();
        this.syncHud();
        break;
      }
      case 'tree': {
        const t = it.target as Tree;
        if (this.tool === 'axe') {
          // 斧头砍树：掉落木材。每棵树限时最多砍 3 次（原版设定：每天每树最多 3 块木材）
          if (this.elapsed > t.chopResetAt) { t.chopsLeft = 3; t.chopResetAt = this.elapsed + 120; }
          if (t.chopsLeft <= 0) {
            sfx.fail();
            this.dialog('大树', '这棵树今天已经砍不出木材了，让它休息一下吧。');
            break;
          }
          t.chopsLeft--;
          this.swingArm('chop');
          sfx.rock();
          t.shakeT = 0.5;
          this.world.addPickup('wood', new THREE.Vector3(t.x, groundHeight(t.x, t.z) + 1.5, t.z), undefined, true);
          break;
        }
        this.swingArm();
        sfx.shake();
        // 树上挂着看得见的果子：任何时候都能摇下来，不受每日限摇影响
        if (t.fruits.length > 0) {
          t.shakeT = 0.5;
          this.trackDaily('shake', 1);
          const got = this.world.shakeTree(t);
          if (got > 0) sfx.plop();
          break;
        }
        // 每棵树同一天只有前 3 次摇才可能掉东西，之后再摇只晃叶子（原版设定）
        const skey = `${t.x},${t.z}`;
        let sc = this.shakeCount.get(skey);
        if (!sc || sc.day !== this.gameDay) { sc = { day: this.gameDay, n: 0 }; this.shakeCount.set(skey, sc); }
        if (sc.n >= 3) {
          t.shakeT = 0.5;
          this.toast('这棵树今天已经摇不出东西了', '🌳');
          break;
        }
        sc.n++;
        this.trackDaily('shake', 1);
        const n = this.world.shakeTree(t);
        // 摇树必掉树枝（动森设定：树枝来自摇树）
        this.world.addPickup('branch', new THREE.Vector3(t.x, groundHeight(t.x, t.z) + 1.5, t.z), undefined, true);
        if (n === 0) {
          const rr = Math.random();
          if (rr < 0.015) {
            // 原版设定：摇树极小概率掉家具
            this.world.addPickup(randomSetGoodId(), new THREE.Vector3(t.x, groundHeight(t.x, t.z) + 2, t.z), undefined, true);
          } else if (rr < 0.035) {
            // 原版设定：摇树出钱概率非常小
            this.world.addPickup('bells', new THREE.Vector3(t.x, groundHeight(t.x, t.z) + 2, t.z), 100, true);
          }
        }
        break;
      }
      case 'plant': {
        const p2 = this.playerPos;
        if (this.selectedItem?.startsWith('sapling_')) {
          // 移栽果树苗：保持原品种
          const fid = this.selectedItem.replace('sapling_', '');
          this.world.plantSapling(p2.x, p2.z, fid);
          this.removeItem(this.selectedItem);
          sfx.plant();
          this.trackQuest('plant', 1);
          this.toast(`种下了${ITEMS[this.selectedItem]?.name ?? '果树苗'}！`, '🌱', '过一阵子就会长回原来的果树');
        } else if (this.selectedItem === 'sapling') {
          this.world.plantSapling(p2.x, p2.z);
          this.removeItem('sapling');
          sfx.plant();
          this.trackQuest('plant', 1);
          this.toast('种下了树苗！', '🌱', '过一阵子就会长成大树');
        } else if (this.selectedItem === 'seedbag') {
          const fid = pick(FLOWER_IDS);
          this.world.addFlower(p2.x + Math.sin(this.playerYaw) * 1.2, p2.z + Math.cos(this.playerYaw) * 1.2, fid);
          this.removeItem('seedbag');
          sfx.plant();
          this.trackQuest('plant', 1);
          this.toast('播下了花种！', '🌷', '开得真好看');
        } else if (this.selectedItem && ITEMS[this.selectedItem]?.category === 'seed') {
          const good = GOOD_BY_ID[this.selectedItem];
          const fx = p2.x + Math.sin(this.playerYaw) * 1.2, fz = p2.z + Math.cos(this.playerYaw) * 1.2;
          if (this.selectedItem.endsWith('_plant')) {
            this.world.addFlower(fx, fz, this.selectedItem.replace('_plant', '')); // 花苗种回原品种
          } else if (good && good.shape === 'seedling' && good.id.startsWith('s_sapling')) {
            this.world.plantSapling(fx, fz);
          } else {
            this.world.addFlower(fx, fz, pick(FLOWER_IDS));
          }
          this.removeItem(this.selectedItem);
          sfx.plant();
          this.trackQuest('plant', 1);
          this.toast(`种下了${ITEMS[this.selectedItem]?.name ?? '种子'}！`, '🌱', '慢慢就会长大');
        }
        break;
      }
      case 'applyDecor': {
        // 使用系列墙纸/地板：更换家中内装并消耗物品（对标原版）
        const id = this.selectedItem!;
        const gd = GOOD_BY_ID[id];
        if (!gd?.set) break;
        const which = it.target as 'wall' | 'floor';
        this.homeDecor[which] = gd.set;
        this.removeItem(id, 1);
        sfx.plant();
        this.interior.build(this.playerHomeStyle(), '你的家');
        this.renderPlacedFurniture();
        const setName = SETS[gd.set]?.name ?? '';
        this.toast(`${which === 'wall' ? '墙面换成了' : '地面铺上了'}${setName}系列！`, SETS[gd.set]?.icon ?? '🏠', '家里焕然一新');
        if (!this.selectedItem || (this.inventory[id] ?? 0) <= 0) { this.selectedItem = null; this.player.setHeldItem(null); }
        this.save();
        this.syncHud();
        break;
      }
      case 'placeFurniture': {
        // 在玩家家中摆放家具；挂画自动吸附到最近的墙上
        const id = this.selectedItem!;
        const gd = GOOD_BY_ID[id];
        this.removeItem(id, 1);
        if (gd?.shape === 'picture') {
          // 找最近的墙：北墙(z=-5.35)、西墙(x=-7.85)、东墙(x=7.85)
          const p = this.playerPos;
          const walls = [
            { x: Math.max(-7, Math.min(7, p.x)), z: -5.32, rotY: 0, d: Math.abs(p.z - (-5.32)) },        // 北墙
            { x: -7.82, z: Math.max(-4.6, Math.min(4.6, p.z)), rotY: Math.PI / 2, d: Math.abs(p.x - (-7.82)) }, // 西墙
            { x: 7.82, z: Math.max(-4.6, Math.min(4.6, p.z)), rotY: -Math.PI / 2, d: Math.abs(p.x - 7.82) },    // 东墙
          ].sort((a, b) => a.d - b.d)[0];
          const wx = walls.x;
          const wz = walls.z;
          this.placedFurniture.push({ id, x: wx, z: wz, rotY: walls.rotY, hang: true });
          this.toast(`把${gd.name}挂上了墙！`, '🖼️', '靠近可以按 E 收回');
        } else {
          const fx = Math.max(-7, Math.min(7, this.playerPos.x + Math.sin(this.playerYaw) * 1.6));
          const fz = Math.max(-4.4, Math.min(4.2, this.playerPos.z + Math.cos(this.playerYaw) * 1.6));
          this.placedFurniture.push({ id, x: fx, z: fz });
          this.toast(`摆好了${ITEMS[id]?.name ?? '家具'}！`, '🪑', '靠近可以按 E 收回');
        }
        sfx.plant();
        this.interior.build(this.playerHomeStyle(), '你的家');
        this.renderPlacedFurniture();
        if (!this.selectedItem || (this.inventory[id] ?? 0) <= 0) { this.selectedItem = null; this.player.setHeldItem(null); }
        this.save();
        this.syncHud();
        break;
      }
      case 'placeOutdoor': {
        // 在室外摆放家具（面向玩家朝向）
        const id = this.selectedItem!;
        const fx = this.playerPos.x + Math.sin(this.playerYaw) * 1.8;
        const fz = this.playerPos.z + Math.cos(this.playerYaw) * 1.8;
        if (isWaterAt(fx, fz)) { this.toast('那里是水面，放不了家具……', '💧'); sfx.fail(); break; }
        this.removeItem(id, 1);
        this.outdoorFurniture.push({ id, x: fx, z: fz, rotY: this.playerYaw });
        sfx.plant();
        this.renderOutdoorFurniture();
        this.toast(`把${ITEMS[id]?.name ?? '家具'}放在了外面！`, '🪑', '靠近可以按 E 收回');
        if (!this.selectedItem || (this.inventory[id] ?? 0) <= 0) { this.selectedItem = null; this.player.setHeldItem(null); }
        this.save();
        this.syncHud();
        break;
      }
      case 'placedOutdoor': {
        // 收回室外摆放的家具
        const idx = it.target as number;
        const of2 = this.outdoorFurniture[idx];
        if (of2) {
          this.outdoorFurniture.splice(idx, 1);
          this.addItem(of2.id, 1);
          sfx.pickup();
          this.renderOutdoorFurniture();
          this.toast(`收回了${ITEMS[of2.id]?.name ?? '家具'}`, ITEMS[of2.id]?.icon ?? '📦');
          this.save();
          this.syncHud();
        }
        break;
      }
      case 'useItem': {
        // 使用日用品（吃掉/喝掉/用掉）；吃水果获得力气，可用铲子铲起整棵树
        const id = this.selectedItem!;
        this.removeItem(id, 1);
        sfx.pickup();
        if (ITEMS[id]?.category === 'fruit') {
          this.strength = Math.min(10, this.strength + 1);
          this.toast(`吃下了${ITEMS[id].name}！`, ITEMS[id].icon, `浑身充满力气！现在用铲子可以把树铲起来（力气 ${this.strength}/10）`);
        } else {
          const useLines: Record<string, string> = {
            u_medicine: '感觉神清气爽，精神百倍！',
            u_coffee: '暖暖的咖啡，今天也要加油！',
          };
          this.toast(`使用了${ITEMS[id]?.name}！`, ITEMS[id]?.icon ?? '✨', useLines[id] ?? '真不错！');
        }
        if ((this.inventory[id] ?? 0) <= 0) { this.selectedItem = null; this.player.setHeldItem(null); }
        this.save();
        this.syncHud();
        break;
      }
      case 'fish': this.castPower = 0.6; this.castRod(); break;
      case 'reel': {
        if (this.fishState === 'bite') this.hookFish();
        else if (this.fishState === 'hooked') this.reelPress();
        else if (this.fishState === 'nibble') this.scareFish();
        else this.cancelFishing();
        break;
      }
    }
    const next = this.findInteract();
    this.currentPrompt = next?.prompt ?? null;
    store.patch({ prompt: this.currentPrompt });
  }

  // ---------------- 矿洞（星露谷式三层矿井） ----------------
  private static MINE_SPOTS: [number, number][] = [
    [-6, -3.6], [-2, -4.2], [2.4, -3.8], [6.2, -3.2],
    [-5.4, 1.2], [-1.2, 0.4], [3, 1.6], [6.4, 0.6],
  ];
  private static MINE_ORE = ['', 'ore_copper', 'ore_iron', 'ore_gold']; // 各层主产矿石
  private static MINE_ORE_COLOR = [0, 0xd97a3a, 0x9ab0c9, 0xf2c94c];    // 各层矿石颜色

  private mineStyle(): InteriorStyle {
    return {
      floorSvg: floorChecker('#6a5a48', '#5a4c3c'),
      wallSvg: wallStripes('#7a7060', '#6a6052'),
      furniture: [],
    };
  }

  // 进入矿洞（每次从第一层开始，对标星露谷矿井）
  private enterMine(floor: number) {
    if (!this.world.bridgeFixed) { sfx.fail(); return; }
    this.mineFloor = floor;
    sfx.ui();
    this.outsidePos.copy(this.playerPos);
    this.interior.build(this.mineStyle(), '矿洞');
    this.interior.group.visible = true;
    this.inside = '矿洞';
    this.world.group.visible = false;
    this.nook.group.visible = false;
    for (const v of this.villagers) v.group.visible = false;
    this.playerPos.set(0, 0, 4.2);
    this.player.group.position.copy(this.playerPos);
    this.spawnMineNodes();
    this.spawnMineLadder();
    this.toast(`矿洞·第${floor}层`, '⛏️', floor < 3 ? '用铲子挖矿石，找到梯子可以往下走' : '最深处！金矿石在这里');
  }

  // 当天矿石状态（耐久表），跨天自动重置
  private mineFloors(): Record<number, number[]> {
    if (!this.mineState || this.mineState.day !== this.gameDay) {
      this.mineState = { day: this.gameDay, floors: { 1: [], 2: [], 3: [] } };
    }
    return this.mineState.floors;
  }

  private spawnMineNodes() {
    for (const n of this.mineNodes) this.interior.group.remove(n.mesh);
    this.mineNodes = [];
    const floors = this.mineFloors();
    const hpArr = floors[this.mineFloor].length === Game.MINE_SPOTS.length
      ? floors[this.mineFloor]
      : (floors[this.mineFloor] = Game.MINE_SPOTS.map(() => 3));
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x7a7266 });
    const oreMat = new THREE.MeshLambertMaterial({ color: Game.MINE_ORE_COLOR[this.mineFloor], emissive: 0x222211 });
    Game.MINE_SPOTS.forEach(([x, z], i) => {
      if (hpArr[i] <= 0) return;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1), rockMat));
      g.children[0].position.y = 0.4;
      const ore1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), oreMat);
      ore1.position.set(0.3, 0.9, 0.2);
      const ore2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), oreMat);
      ore2.position.set(-0.3, 0.75, -0.15);
      g.add(ore1, ore2);
      g.position.set(x, 0, z);
      this.interior.group.add(g);
      this.mineNodes.push({ mesh: g, hp: hpArr[i], idx: i });
    });
  }

  private mineLadderMesh: THREE.Group | null = null;
  private spawnMineLadder() {
    if (this.mineLadderMesh) { this.interior.group.remove(this.mineLadderMesh); this.mineLadderMesh = null; }
    if (this.mineFloor >= 3) return;
    const g = new THREE.Group();
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), new THREE.MeshBasicMaterial({ color: 0x14100c }));
    hole.rotation.x = -Math.PI / 2; hole.position.y = 0.06;
    g.add(hole);
    const railMat = new THREE.MeshLambertMaterial({ color: 0x8a6239 });
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), railMat); r1.position.set(-0.5, 0.6, 0);
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), railMat); r2.position.set(0.5, 0.6, 0);
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.3), railMat); s1.position.set(0, 0.9, 0);
    g.add(r1, r2, s1);
    g.position.set(-6.8, 0, -4.6);
    this.interior.group.add(g);
    this.mineLadderMesh = g;
  }

  // 挖矿：铲子敲矿石节点
  private hitOre(node: { mesh: THREE.Group; hp: number; idx: number }) {
    if (this.tool !== 'shovel') return;
    this.swingArm('dig');
    node.hp--;
    this.mineFloors()[this.mineFloor][node.idx] = node.hp;
    const oreId = Game.MINE_ORE[this.mineFloor];
    this.addItem(oreId);
    this.trackDaily('mine', 1);
    // 三层稀有掉落：钻石（开店稀有材料）
    if (this.mineFloor === 3 && Math.random() < 0.08) {
      this.addItem('diamond');
      this.toast('挖到了钻石！', '💎', '闪闪发光！这可是开店要用的稀有材料');
      sfx.fanfare();
    }
    if (Math.random() < 0.5) this.addItem('stone');
    sfx.rock();
    if (node.hp <= 0) {
      this.interior.group.remove(node.mesh);
      this.mineNodes.splice(this.mineNodes.indexOf(node), 1);
      this.toast(`挖到了${ITEMS[oreId].name}！`, ITEMS[oreId].icon, '矿石挖空了，明天 0 点会刷新');
    } else {
      this.toast(`挖到了${ITEMS[oreId].name}！`, ITEMS[oreId].icon, `这块矿石还能再挖 ${node.hp} 次`);
    }
    this.save();
  }

  // 下梯子：铲子等级决定能到的层数
  private descendLadder() {
    const next = this.mineFloor + 1;
    if (this.shovelLevel < next) {
      sfx.fail();
      const need = next === 2 ? '铜铲' : '铁铲';
      this.dialog('矿井梯子', `下面的岩层太硬了，普通铲子挖不动……需要找喵喵把铲子升级成「${need}」（当前：${['', '普通铲子', '铜铲', '铁铲'][this.shovelLevel]}）。`);
      return;
    }
    this.enterMine(next);
  }

  // 打开喵喵商店面板：同步今日货架商品 + 种子，面板里也能直接购买
  private openShopPanel() {
    const goods = dailyGoods(this.gameDay, 8).map(g => ({ id: g.id, name: g.name, icon: g.icon, price: g.price }));
    const hot = this.hotCategory();
    store.patch({ shopOpen: true, shopLine: pick(SHOPKEEPER_LINES), shopGoods: goods, hotDeal: hot });
  }

  // 修理通往矿岛的断桥：木材×10 + 石头×10 + 金币×3000
  private static BRIDGE_COST = { wood: 10, stone: 10, bells: 3000 };
  // VR 挥臂允许触发的交互类型（工具类动作）；其余走近交互只走扳机
  private static VR_SWING_KINDS = new Set(['ore', 'bug', 'dig', 'rock', 'weed', 'flower', 'shovelFlower', 'digTree', 'tree', 'fish', 'reel']);
  private repairBridge() {
    const need = Game.BRIDGE_COST;
    const lack: string[] = [];
    if ((this.inventory['wood'] ?? 0) < need.wood) lack.push(`木材 ${this.inventory['wood'] ?? 0}/${need.wood}`);
    if ((this.inventory['stone'] ?? 0) < need.stone) lack.push(`石头 ${this.inventory['stone'] ?? 0}/${need.stone}`);
    if (this.bells < need.bells) lack.push(`金币 ${this.bells}/${need.bells}`);
    if (lack.length) {
      sfx.fail();
      this.dialog('断桥', `通往矿岛的桥断了！修好它需要：木材×${need.wood}、石头×${need.stone}、金币×${need.bells}。现在还缺：${lack.join('、')}。`);
      return;
    }
    this.removeItem('wood', need.wood);
    this.removeItem('stone', need.stone);
    this.addBells(-need.bells);
    this.world.setBridgeFixed(true);
    sfx.fanfare();
    store.patch({ mapImage: this.makeMapImage() }); // 地图上去掉断桥红标记
    this.dialog('断桥', '叮叮当当……桥修好了！现在可以去矿岛了，带上铲子进矿洞挖矿吧！矿石每天晚上 12 点会重新长出来。');
    this.save();
  }

  // 升级铲子：一层矿（铜）→ 铜铲 → 二层矿（铁）→ 铁铲 → 三层
  private upgradeShovel() {
    if (this.shovelLevel >= 3) {
      this.dialog('喵喵', '你的铲子已经是最顶级的「铁铲」了喵！矿洞三层随便挖喵！');
      return;
    }
    const req = this.shovelLevel === 1
      ? { ore: 'ore_copper', oreN: 5, mat: 'wood', matN: 5, bells: 2000, name: '铜铲' }
      : { ore: 'ore_iron', oreN: 5, mat: 'stone', matN: 10, bells: 5000, name: '铁铲' };
    const lack: string[] = [];
    if ((this.inventory[req.ore] ?? 0) < req.oreN) lack.push(`${ITEMS[req.ore].name} ${this.inventory[req.ore] ?? 0}/${req.oreN}`);
    if ((this.inventory[req.mat] ?? 0) < req.matN) lack.push(`${ITEMS[req.mat].name} ${this.inventory[req.mat] ?? 0}/${req.matN}`);
    if (this.bells < req.bells) lack.push(`金币 ${this.bells}/${req.bells}`);
    if (lack.length) {
      sfx.fail();
      this.dialog('喵喵', `升级成「${req.name}」需要：${ITEMS[req.ore].name}×${req.oreN}、${ITEMS[req.mat].name}×${req.matN}、金币×${req.bells}喵。还缺：${lack.join('、')}，去矿洞里多挖一点吧喵！`);
      return;
    }
    this.removeItem(req.ore, req.oreN);
    this.removeItem(req.mat, req.matN);
    this.addBells(-req.bells);
    this.shovelLevel++;
    sfx.fanfare();
    this.dialog('喵喵', `锵锵！「${req.name}」完成了喵！现在可以下到矿洞第${this.shovelLevel}层了喵！`);
    this.save();
  }

  // 上床睡觉：可选存档，黑屏淡入淡出后跳到次日早上 7 点
  private goSleep(save: boolean) {
    this.dialogQueue = [];
    store.patch({ dialog: null, sleepFade: true });
    setTimeout(() => {
      this.gameDay++;
      this.time24 = 7;
      this.midnightReset();
      if (save) this.save();
      this.playerPos.set(-4.2, 0, -1.8); // 从床边爬起来
      this.player.group.position.copy(this.playerPos);
      this.playerYaw = Math.PI / 2;
      setTimeout(() => {
        store.patch({ sleepFade: false });
        this.toast('早上好！', '☀️', `第 ${this.gameDay} 天开始了${save ? '（已存档）' : ''}`);
      }, 1100);
    }, 1000);
  }

  // ---------------- 篝火晚会（完成水果任务后强制入夜开晚会） ----------------
  private partyActive = false;
  private partyMembers: { g: THREE.Group; ch: Character | null; baseY: number; baseYaw: number; dance: number; phase: number; speed: number }[] = [];
  private shakeCount = new Map<string, { day: number; n: number }>(); // 每棵树每天的摇晃次数（前3次才可能掉东西）
  // 每句 8 个字 = 8 个音符（宝可梦主题曲经典开头走向），字跟着音符唱
  private static PARTY_SONG: { line: string; notes: number[] }[] = [
    { line: '篝火点亮今夜森林', notes: [392, 392, 440, 494, 494, 440, 494, 587] },   //  sol sol la si si la si do↑
    { line: '钓竿虫网叮当作响', notes: [587, 587, 659, 523, 494, 440, 392, 440] },   //  do↑ do↑ re↑ do↑ si la sol la
    { line: '手拉手围成大圈圈', notes: [392, 392, 440, 494, 494, 587, 659, 587] },   //  sol sol la si si do↑ re↑ do↑
    { line: '宝可梦之森是我家', notes: [587, 494, 440, 494, 523, 494, 440, 392] },   //  do↑ si la si do↑ si la sol（落回主音）
  ];
  private static PARTY_NOTE_DUR = 0.42; // 每个音符的时值（秒）

  private startBonfirePartyWhenReady() {
    // 等任务对话播完、人在室外再开始
    if (store.state.dialog || this.dialogQueue.length || this.inside) {
      setTimeout(() => this.startBonfirePartyWhenReady(), 800);
      return;
    }
    this.startBonfireParty();
  }

  private startBonfireParty() {
    if (this.partyActive) return;
    this.partyActive = true;
    this.world.buildBonfire();
    this.time24 = 20.6; // 强制入夜
    const cx = this.world.bonfirePos.x, cz = this.world.bonfirePos.z;
    // 参与者围成一圈：村民 + 皮卡丘 + 喵喵 + 玩家（每只随机分配一种舞姿，不再整齐划一）
    const attendees: Character[] = [...this.villagers];
    if (this.isabelle.group.visible) attendees.push(this.isabelle);
    if (this.nook.group.visible) attendees.push(this.nook);
    const R = 4.6;
    const n = attendees.length + 1;
    this.partyMembers = [];
    attendees.forEach((ch, i) => {
      const a = ((i + 1) / n) * Math.PI * 2;
      const x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R;
      const gy = groundHeight(x, z);
      // 原本回屋/不在场上的宝可梦也要现身参加，并停下移动（否则没有跳舞动作）
      ch.group.visible = true;
      ch.moving = false;
      if (ch instanceof Villager) { ch.wander = false; ch.target = null; }
      ch.group.position.set(x, gy, z);
      ch.yaw = Math.atan2(cx - x, cz - z); // 面向篝火（由角色动画系统应用）
      // 随机分配舞姿和节奏，动作在 Character.update 里执行（不会被走路动画覆盖）
      ch.dance = Math.floor(Math.random() * 4);
      ch.danceSpeed = 0.85 + Math.random() * 0.4;
      ch.danceT = Math.random() * 6;
      this.partyMembers.push({ g: ch.group, ch, baseY: gy, baseYaw: ch.yaw, dance: ch.dance, phase: 0, speed: ch.danceSpeed });
    });
    for (const v of this.villagers) { v.wander = false; v.moving = false; v.target = null; }
    // 玩家站在圈的缺口处，面向篝火
    const px = cx + Math.sin(0) * R, pz = cz + Math.cos(0) * R;
    this.playerPos.set(px, groundHeight(px, pz), pz);
    this.player.group.position.copy(this.playerPos);
    this.playerYaw = Math.atan2(cx - px, cz - pz);
    this.toast('篝火晚会开始了！', '🔥', '大家围着篝火唱歌吧！');
    // 唱歌：每句 = 旋律乐句 + 宝可梦语合唱 + 歌词横幅
    let t = 3000;
    const nd = Game.PARTY_NOTE_DUR;
    Game.PARTY_SONG.forEach((s) => {
      setTimeout(() => {
        store.patch({ karaoke: `♪ ${s.line} ♪` });
        // 伴奏旋律 + 宝可梦语合唱：字和音符一一对应，音高时值都跟着曲子走
        s.notes.forEach((f, j) => {
          sfx.tone(f, nd * 0.9, 'triangle', 0.05, j * nd);
          sfx.tone(f / 2, nd * 0.9, 'square', 0.014, j * nd);
        });
        sfx.sing(s.line, s.notes, nd);
      }, t);
      t += s.notes.length * nd * 1000 + 700; // 一句唱完，歇口气再唱下一句
    });
    setTimeout(() => {
      store.patch({ karaoke: null });
      this.toast('晚会结束啦！', '🌙', '今晚做个好梦……可以回帐篷睡觉存档哦');
      for (const v of this.villagers) v.wander = true;
      // 结束后大家留在篝火旁自由活动（不传送回家/不传送回刷新点）
      this.skipHomeApply = true;
      // 退出跳舞状态（站姿由角色动画系统自动恢复）
      for (const m of this.partyMembers) { if (m.ch) m.ch.dance = null; }
      this.partyActive = false;
      this.partyMembers = [];
      this.save();
    }, t + 1200);
  }

  // ---------------- 傅达（博物馆捐赠） ----------------
  private talkToOwl() {
    this.owl.yaw = Math.atan2(this.playerPos.x - this.owl.group.position.x, this.playerPos.z - this.owl.group.position.z);
    const cand = Object.keys(this.inventory).find(id =>
      (this.inventory[id] ?? 0) > 0 && (['bug', 'fish'].includes(ITEMS[id]?.category ?? '') || id === 'fossil'));
    if (cand) {
      this.pendingDonate = cand;
      this.dialog('傅达', `哦呀！你带来了${ITEMS[cand].name}呼！愿意把它捐赠给本馆吗？我们会悉心保管、并向所有岛民展示的呼。`, [
        { label: `🦉 捐赠 ${ITEMS[cand].name}`, command: 'donateItem' },
        { label: '再考虑一下', command: 'cancel' },
      ]);
    } else {
      this.dialog('傅达', pick(OWL_LINES));
    }
  }

  private confirmDonate() {
    const id = this.pendingDonate;
    this.dialogQueue = [];
    if (!id || (this.inventory[id] ?? 0) <= 0) { store.patch({ dialog: null }); return; }
    this.pendingDonate = null;
    this.removeItem(id, 1);
    this.donated.push(id);
    this.trackQuest('museum', 1);
    sfx.fanfare();
    this.interior.build(this.museumStyle(), '博物馆'); // 重摆展品
    store.patch({ dialog: null });
    this.toast(`捐赠了${ITEMS[id]?.name ?? id}！`, '🦉', `博物馆展品 +1（共 ${this.donated.length} 件）`);
    // 博物馆里程碑奖励（动森式收藏目标：3 / 6 / 9 种）
    const total = this.donated.length;
    if (total === 3) {
      this.addBells(1000);
      this.toast('博物馆里程碑：3 种展品！', '🏛️', '傅达赞助了 1,000 金币，继续收集吧！');
      sfx.fanfare();
    } else if (total === 6) {
      this.addMiles(800, false);
      this.syncHud();
      this.toast('博物馆里程碑：6 种展品！', '🏛️', '奖励 +800 积分，离全图鉴不远了！');
      sfx.fanfare();
    } else if (total === 9) {
      this.addItem('ore_gold', 3);
      this.toast('博物馆全图鉴集齐！', '👑', '傅达激动得说不出话，送上金矿 ×3 以表敬意！');
      sfx.fanfare();
    }
    this.save();
  }

  // ---------------- 喵喵 & 任务流程 ----------------
  private talkToNook() {
    this.nook.yaw = Math.atan2(this.playerPos.x - this.nook.group.position.x, this.playerPos.z - this.nook.group.position.z);
    // 首次交谈：发布第一个目标（此前不显示任务栏）
    if (!this.questAccepted) {
      this.questAccepted = true;
      this.dialogQueue = NOOK_INTRO.map(t => ({ name: '喵喵', text: t }));
      this.advanceDialog();
      this.syncHud();
      this.save();
      return;
    }
    const q = this.currentQuest();

    // 商店建成后：随时提供商店服务（卖东西/买种子/升级铲子），任务通过「任务相关」入口
    if (this.world.homeUpgraded) {
      const actions = [
        { label: '💰 卖东西 / 买种子', command: 'openShop' },
        { label: `🔨 升级铲子（${['', '普通', '铜铲', '铁铲'][this.shovelLevel]}）`, command: 'upgradeShovel' },
      ];
      if (q) actions.push({ label: `📋 ${q.title}`, command: 'questTalk' });
      actions.push({ label: '🏝️ 评价岛屿', command: 'rateIsland' });
      actions.push({ label: '随便聊聊', command: 'chat' });
      this.dialog('喵喵', '欢迎光临友好商店喵！要卖点什么，还是看看种子和树苗？', actions);
      return;
    }

    // 商店建成前：任务流程优先
    if (q) { this.questTalkNook(); return; }
    this.dialog('喵喵', pick(NOOK_IDLE_LINES), [
      { label: '🏝️ 评价岛屿', command: 'rateIsland' },
      { label: '再见', command: 'cancel' },
    ]);
  }

  // 喵喵的任务对话（交付/贷款/DIY）
  private questTalkNook() {
    const q = this.currentQuest();
    if (!q) { this.dialog('喵喵', pick(NOOK_IDLE_LINES)); return; }
    // 开店材料：分批交付，四种材料各自计数
    if (q.id === 'openshop') { this.openshopTurnIn(); return; }
    // DIY 学习
    if (q.id === 'diy') {
      this.completeQuest();
      return;
    }
    // 偿还贷款
    if (q.id === 'debt') {
      if (this.miles >= 5000) {
        this.dialog('喵喵', `攒够 5,000 积分了喵！要现在偿还移居套餐的费用吗？偿还后帐篷就能改建成真正的房子！（当前积分：${this.miles}）`, [
          { label: '💚 偿还 5,000 积分', command: 'payDebt' },
          { label: '再等等', command: 'cancel' },
        ]);
      } else {
        this.dialog('喵喵', `移居套餐的费用可以用 5,000 积分抵销喵。你现在有 ${this.miles} 积分，还差 ${5000 - this.miles}。继续完成岛上的目标吧喵！`);
      }
      return;
    }
    // 扩建房贷（金币）
    if (q.id === 'debt2') {
      if (this.bells >= 49800) {
        this.dialog('喵喵', `攒够 49,800 金币了喵！要现在偿还扩建贷款吗？还了就能把房子扩得更大喵！（当前金币：${this.bells}）`, [
          { label: '💰 偿还 49,800 金币', command: 'payDebt2' },
          { label: '再等等', command: 'cancel' },
        ]);
      } else {
        this.dialog('喵喵', `房子扩建的费用是 49,800 金币喵。你现在有 ${this.bells} 金币，还差 ${49800 - this.bells}。把岛上采到的东西卖给我吧喵！`);
      }
      return;
    }
    // 收集类任务交付
    if (this.questProgress >= q.need) {
      // 收取物品
      if (q.id === 'branch') this.removeItem('branch', 10);
      else if (q.id === 'fruit') {
        let left = 6;
        for (const f of ['apple', 'cherry', 'orange', 'peach']) {
          const have = this.inventory[f] || 0;
          const take = Math.min(have, left);
          if (take > 0) { this.removeItem(f, take); left -= take; }
          if (left <= 0) break;
        }
      } else if (q.id === 'fish') {
        const fid = Object.keys(this.inventory).find(id => ITEMS[id]?.category === 'fish');
        if (fid) this.removeItem(fid, 1);
      } else if (q.id === 'bug') {
        const bid = Object.keys(this.inventory).find(id => ITEMS[id]?.category === 'bug');
        if (bid) this.removeItem(bid, 1);
      } else if (q.id === 'fossil') this.removeItem('fossil', 1);
      this.completeQuest();
    } else {
      this.dialog('喵喵', `${q.title}……${q.hint}喵！（${Math.min(this.questProgress, q.need)}/${q.need}）`);
    }
  }

  // 开店任务：分批交付木材100/石头20/金矿50/钻石5
  private openshopTurnIn() {
    let deliveredNow = 0;
    const lines: string[] = [];
    for (const [id, req] of Game.SHOP_REQ) {
      const have = this.inventory[id] ?? 0;
      const want = req - (this.shopMats[id] ?? 0);
      if (have > 0 && want > 0) {
        const take = Math.min(have, want);
        this.removeItem(id, take);
        this.shopMats[id] += take;
        deliveredNow += take;
      }
      const cur = this.shopMats[id] ?? 0;
      lines.push(`${ITEMS[id].icon}${ITEMS[id].name} ${cur}/${req}${cur >= req ? ' ✓' : ''}`);
    }
    this.questProgress = Game.SHOP_REQ.reduce((s, [id]) => s + (this.shopMats[id] ?? 0), 0);
    this.syncHud();
    if (this.questProgress >= 175) { this.completeQuest(); return; }
    if (deliveredNow > 0) {
      sfx.sell();
      this.dialog('喵喵', `收到材料了喵！施工进度：\n${lines.join('\n')}\n还差的材料继续收集，随时来找我交付喵！`);
      this.save();
    } else {
      this.dialog('喵喵', `开店需要的材料清单喵：\n${lines.join('\n')}\n木材用斧头砍树获得，石头在矿洞挖，金矿在矿洞三层，钻石也是三层挖的、比较稀有，多挖几次就会有喵！`);
    }
  }

  private completeQuest() {
    const q = this.currentQuest();
    if (!q) return;
    // 奖励
    if (q.id === 'diy') {
      this.unlockedTools.add('rod');
      this.unlockedTools.add('net');
      this.unlockedTools.add('axe');
    }
    if (q.id === 'bug') this.unlockedTools.add('shovel');
    this.addMiles(q.rewardMiles, false);
    // 喵喵台词队列
    this.dialogQueue = q.turnIn.map(t => ({ name: '喵喵', text: t }));
    // 推进任务
    this.questIdx++;
    this.questProgress = 0;
    sfx.fanfare();
    this.advanceDialog();
    if (q.rewardText) this.toast(q.rewardText, '🎁', `同时获得了 ${q.rewardMiles} 积分！`);
    else this.toast(`目标完成！+${q.rewardMiles} 积分`, '💚', this.currentQuest() ? `下一个目标：${this.currentQuest()!.title}` : '');
    this.syncHud();
    this.save();
    // 水果任务（晚会准备）完成 → 对话播完后强制入夜开篝火晚会
    if (q.id === 'fruit') setTimeout(() => this.startBonfirePartyWhenReady(), 600);
    // 开店任务完成 → 发给地契，玩家自己选地建店
    if (q.id === 'openshop') {
      this.addItem('deed');
    }
  }

  private payDebt() {
    const q = this.currentQuest();
    if (!q || q.id !== 'debt' || this.miles < 5000) { this.advanceDialog(); return; }
    this.miles -= 5000;
    this.questIdx++;
    this.questProgress = 0;
    this.world.upgradeHome();
    sfx.fanfare();
    this.dialogQueue = q.turnIn.map(t => ({ name: '喵喵', text: t }));
    this.advanceDialog();
    this.toast('帐篷改建成了房子！', '🏠', '恭喜乔迁新居！');
    this.syncHud();
    this.save();
  }

  private payDebt2() {
    const q = this.currentQuest();
    if (!q || q.id !== 'debt2' || this.bells < 49800) { this.advanceDialog(); return; }
    this.addBells(-49800);
    this.questIdx++;
    this.questProgress = 0;
    this.world.expandHome();
    sfx.fanfare();
    this.dialogQueue = q.turnIn.map(t => ({ name: '喵喵', text: t }));
    this.advanceDialog();
    this.toast('房子扩建完成！', '🏠', '家变得更宽敞了！');
    this.syncHud();
    this.save();
  }

  private swingArm(kind: 'swing' | 'dig' | 'chop' = 'swing') { this.player.action(kind, kind === 'swing' ? 0.5 : 0.75); }

  private closeAll() {
    if (store.state.phoneOpen) { store.patch({ phoneOpen: false }); sfx.ui(); }
    else if (store.state.shopOpen) { store.patch({ shopOpen: false }); sfx.ui(); }
    else if (store.state.dialog && !store.state.dialog.actions) this.advanceDialog();
    else if (store.state.toast) store.patch({ toast: null });
    else if (store.state.helpOpen) store.patch({ helpOpen: false });
  }

  // ---------------- 钓鱼 ----------------
  private nearWater(): boolean {
    const fx = Math.sin(this.playerYaw), fz = Math.cos(this.playerYaw);
    for (let d = 2.5; d <= 10; d += 0.5) {
      if (isWaterAt(this.playerPos.x + fx * d, this.playerPos.z + fz * d)) return true;
    }
    return false;
  }

  private startCharge() {
    this.fishState = 'charging';
    this.castPower = 0;
    this.syncFishingHud();
  }

  private ensureBobber() {
    if (this.bobber) return;
    this.bobber = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshLambertMaterial({ color: 0xe2453b }));
    top.position.y = 0.08;
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshLambertMaterial({ color: 0xf7f7f0 }));
    bottom.position.y = -0.08;
    this.bobber.add(top, bottom);
    this.exclaim = emojiSprite('❗', 1.2);
    this.exclaim.position.y = 1.2;
    this.exclaim.visible = false;
    this.bobber.add(this.exclaim);
    this.scene.add(this.bobber);
  }

  // 松开 E：按蓄力决定抛竿距离
  private castRod() {
    const dist = 3 + this.castPower * 7;
    const fx = Math.sin(this.playerYaw), fz = Math.cos(this.playerYaw);
    const tx = this.playerPos.x + fx * dist;
    const tz = this.playerPos.z + fz * dist;
    if (!isWaterAt(tx, tz)) {
      // 没抛进水里
      sfx.fail();
      this.fishState = 'idle';
      this.dialog('钓鱼', this.castPower < 0.3 ? '力气太小，浮漂落在了岸上……按住 E 多蓄一会儿力吧！' : '抛过头了，浮漂落到了对岸……控制一下力气！');
      this.syncFishingHud();
      return;
    }
    const target = new THREE.Vector3(tx, WATER_Y, tz);
    this.player.action('cast', 0.7); // 抛竿动画
    sfx.splash();
    this.fishState = 'cast';
    this.ensureBobber();
    this.bobberPos.copy(this.playerPos).add(new THREE.Vector3(0, 2.2, 0));
    this.bobberVel.copy(target).sub(this.bobberPos).multiplyScalar(2.2);
    this.bobberVel.y += 3.5;
    this.bobber!.visible = true;
    this.exclaim!.visible = false;
    this.bobber!.position.copy(this.bobberPos);
    // 引诱最近的鱼
    this.luredFish = null;
    let best = 11;
    for (const f of this.world.fishes) {
      const d = Math.hypot(f.pos.x - target.x, f.pos.z - target.z);
      if (d < best) { best = d; this.luredFish = f; }
    }
    if (this.luredFish) {
      this.luredFish.state = 'lure';
      this.world.lureFish = this.luredFish;
      this.world.lurePos.set(target.x, WATER_Y - 0.12, target.z);
    }
    this.waitT = 6 + Math.random() * 3;
    this.syncFishingHud();
  }

  private hookFish() {
    // 钩住了！进入拉杆小游戏
    this.fishState = 'hooked';
    this.reelGot = 0;
    this.reelT = 4;
    this.exclaim!.visible = false;
    sfx.bite();
    this.syncFishingHud();
  }

  private reelPress() {
    this.reelGot++;
    sfx.splash();
    this.swingArm();
    if (this.bobber) {
      this.bobberPos.x += (Math.random() - 0.5) * 0.3;
      this.bobberPos.z += (Math.random() - 0.5) * 0.3;
    }
    if (this.reelGot >= 3) {
      const fish = this.luredFish;
      sfx.fanfare();
      if (fish) {
        const def = ITEMS[fish.itemId];
        this.addItem(fish.itemId);
        this.toast(`钓到了${def?.name}！`, def?.icon ?? '🐟', def?.desc ?? '');
        this.world.respawnFish(fish);
      }
      this.endFishing();
    } else {
      this.syncFishingHud();
    }
  }

  private scareFish() {
    // 假咬时拉杆，鱼被吓跑
    sfx.fail();
    this.toast('鱼被吓跑了……', '🐟', '要等浮漂完全沉下去（出现❗）的瞬间再拉杆');
    if (this.luredFish) { this.luredFish.state = 'swim'; this.luredFish = null; this.world.lureFish = null; }
    this.endFishing();
  }

  private cancelFishing() {
    if (this.luredFish) { this.luredFish.state = 'swim'; }
    sfx.plop();
    this.endFishing();
  }

  private endFishing() {
    this.fishState = 'idle';
    if (this.bobber) this.bobber.visible = false;
    if (this.exclaim) this.exclaim.visible = false;
    this.luredFish = null;
    this.world.lureFish = null;
    this.syncFishingHud();
  }

  private syncFishingHud() {
    store.patch({
      fishing: this.fishState === 'charging' ? 'charging'
        : this.fishState === 'bite' ? 'bite'
        : this.fishState === 'hooked' ? 'hooked'
        : this.fishState === 'idle' ? 'idle' : 'waiting',
      fishPower: this.castPower,
      reel: this.fishState === 'hooked' ? { got: this.reelGot, need: 3 } : null,
    });
  }

  private updateFishing(dt: number) {
    // 蓄力
    if (this.fishState === 'charging') {
      this.castPower = Math.min(1, this.castPower + dt / 1.2);
      this.player.armR.rotation.x = -1.4 - this.castPower * 0.6;
      this.syncFishingHud();
      return;
    }
    if (this.fishState === 'idle' || !this.bobber) return;

    if (this.fishState === 'cast') {
      this.bobberVel.y -= dt * 12;
      this.bobberPos.addScaledVector(this.bobberVel, dt);
      this.bobber.position.copy(this.bobberPos);
      if (this.bobberPos.y <= WATER_Y + 0.1) {
        this.bobberPos.y = WATER_Y + 0.1;
        this.bobber.position.copy(this.bobberPos);
        this.fishState = 'waiting';
        sfx.splash();
        this.syncFishingHud();
      }
      return;
    }
    // 玩家走远则脱钩
    if (Math.hypot(this.playerPos.x - this.bobberPos.x, this.playerPos.z - this.bobberPos.z) > 14) {
      this.cancelFishing();
      return;
    }
    if (this.fishState === 'waiting') {
      this.bobber.position.y = WATER_Y + 0.1 + Math.sin(this.elapsed * 3) * 0.05;
      // 鱼游到浮漂附近 → 开始试探性假咬
      if (this.luredFish) {
        const d = Math.hypot(this.luredFish.pos.x - this.bobberPos.x, this.luredFish.pos.z - this.bobberPos.z);
        if (d < 1.8) {
          this.fishState = 'nibble';
          this.nibbleCount = 0;
          this.nibbleMax = 2 + Math.floor(Math.random() * 3); // 2-4次假咬
          this.nibbleT = 0.6;
          this.syncFishingHud();
          return;
        }
      }
      this.waitT -= dt;
      if (this.waitT <= 0 && !this.luredFish) {
        this.dialog('钓鱼', '这附近好像没有鱼……换个地方试试吧。');
        this.cancelFishing();
      }
      return;
    }
    if (this.fishState === 'nibble') {
      this.nibbleT -= dt;
      // 假咬：浮漂轻轻点动
      this.bobber.position.y = WATER_Y + 0.05 + Math.sin(this.elapsed * 10) * 0.04;
      if (this.nibbleT <= 0) {
        this.nibbleCount++;
        sfx.nibble();
        this.bobber.position.y = WATER_Y;
        if (this.nibbleCount >= this.nibbleMax) {
          // 真咬！
          this.fishState = 'bite';
          this.biteT = 0.9;
          this.exclaim!.visible = true;
          this.bobber.position.y = WATER_Y - 0.2;
          sfx.bite();
        } else {
          this.nibbleT = 0.4 + Math.random() * 0.8;
        }
        this.syncFishingHud();
      }
      return;
    }
    if (this.fishState === 'bite') {
      this.biteT -= dt;
      this.bobber.position.y = WATER_Y - 0.2;
      if (this.biteT <= 0) {
        sfx.fail();
        this.dialog('钓鱼', '扑通……鱼叼着饵跑掉了。要在浮漂完全沉下去（出现❗）的瞬间拉杆！');
        if (this.luredFish) { this.luredFish.state = 'swim'; this.luredFish = null; this.world.lureFish = null; }
        this.endFishing();
      }
      return;
    }
    if (this.fishState === 'hooked') {
      this.reelT -= dt;
      this.bobber.position.y = WATER_Y - 0.1;
      if (this.reelT <= 0) {
        sfx.fail();
        this.dialog('钓鱼', '鱼挣扎了几下就挣脱了……下次要快速连按 E 收线！');
        if (this.luredFish) { this.luredFish.state = 'swim'; this.luredFish = null; this.world.lureFish = null; }
        this.endFishing();
      }
    }
  }

  // ---------------- 主循环 ----------------
  private slowFrames = 0;
  private lowQuality = false;

  private loop = () => {
    if (this.disposed) return;
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    // 低性能设备自动降画质（关阴影、降分辨率）
    if (!this.lowQuality) {
      if (dt > 0.35) this.slowFrames++;
      else this.slowFrames = Math.max(0, this.slowFrames - 1);
      if (this.slowFrames > 6) {
        this.lowQuality = true;
        this.renderer.shadowMap.enabled = false;
        this.renderer.setPixelRatio(1);
        this.scene.traverse(o => { if ((o as THREE.Mesh).material) ((o as THREE.Mesh).material as THREE.Material).needsUpdate = true; });
        this.sun.castShadow = false;
      }
    }
    dt = Math.min(dt, 0.05);
    this.elapsed += dt;

    this.handleCommands();
    this.updateClock(dt);
    if (!this.partyActive) this.applyNightHomes(); // 晚会期间不赶人回家
    // 晚会中：围着篝火蹦蹦跳跳
    if (this.partyActive) {
      // 跳舞动作由 Character.update 按各自 dance/danceT 执行，这里只管贴地
      for (const m of this.partyMembers) m.g.position.y = m.baseY;
    }
    // 跨天检测：露营考察者到达/离开
    const today = this.dayStamp();
    if (today !== this.lastDayTick) { this.lastDayTick = today; this.updateCamp(); }
    if (this.vrSys.active) this.vrSys.update(dt, now); // VR：踏步移动/挥臂/面板（会写入 touchInput 与 camYaw）
    this.updatePlayer(dt);
    if (this.vrSys.active) this.vrSys.syncRig(); // VR：rig 贴本帧最新玩家位置（滞后一帧会致场景跟晃）
    this.updateBoat(dt);
    if (!this.partyActive) this.updateVillagers(dt);
    this.updateFishing(dt);
    this.updateCamera(dt);

    const isNight = this.time24 < 5.5 || this.time24 >= 19.5;
    this.world.lureFish = this.luredFish;
    this.frameNo++;
    this.world.update(dt, this.time24, isNight, now, this.vrSys.active && this.frameNo % 2 === 1); // VR 隔帧跳过装饰动画保帧率
    // VR 距离剔除：75m 外的小物件直接隐藏（雾里本来也看不清）；退出 VR 全部恢复
    if (this.vrSys.active) {
      this.cullT -= dt;
      if (this.cullT <= 0) {
        this.cullT = 0.6;
        const p = this.playerPos;
        const far2 = 32 * 32; // 雾外即隐（视距 35m）
        const cull = (x: number, z: number, o: THREE.Object3D) => {
          o.visible = (p.x - x) ** 2 + (p.z - z) ** 2 < far2;
        };
        for (const pk of this.world.pickups) cull(pk.mesh.position.x, pk.mesh.position.z, pk.mesh);
        for (const b of this.world.bugs) cull(b.group.position.x, b.group.position.z, b.group);
        for (const d of this.world.digSpots) cull(d.x, d.z, d.mesh);
      }
    } else if (this.cullT !== -1) {
      this.cullT = -1;
      for (const pk of this.world.pickups) pk.mesh.visible = true;
      for (const b of this.world.bugs) b.group.visible = true;
      for (const d of this.world.digSpots) d.mesh.visible = true;
    }

    // 提示刷新（低频）
    if (Math.floor(this.elapsed * 8) !== Math.floor((this.elapsed - dt) * 8)) {
      const it = this.findInteract();
      const prompt = it?.prompt ?? null;
      if (prompt !== this.currentPrompt) {
        this.currentPrompt = prompt;
        store.patch({ prompt });
      }
      store.patch({ isNight, weather: this.weather, mapPlayer: { x: this.playerPos.x, z: this.playerPos.z } });
      // 修桥引导：材料凑齐且当天没提醒过 → 指路
      if (!this.world.bridgeFixed && this.bridgeHintDay !== this.gameDay) {
        const need = Game.BRIDGE_COST;
        if ((this.inventory['wood'] ?? 0) >= need.wood && (this.inventory['stone'] ?? 0) >= need.stone && this.bells >= need.bells) {
          this.bridgeHintDay = this.gameDay;
          this.toast('修桥材料凑齐了！', '🌉', '去岛的东北角找到断桥，靠近按 E 修理（地图上有红色标记）');
        }
      }
    }

    if (this.bugRespawnT > 0) {
      this.bugRespawnT -= dt;
      if (this.bugRespawnT <= 0 && this.world.bugs.length < 8) this.world.spawnBug(isNight);
    }
    if (this.digRespawnT > 0) {
      this.digRespawnT -= dt;
      if (this.digRespawnT <= 0) this.world.spawnDigSpot();
    }

    this.updateSky(isNight);
    this.updateRain(dt);
    this.playerGlow.intensity = isNight && !this.inside ? 0.6 : 0; // 室内不需要随身光源
    // 平行光从斜上方均匀洒下，跟着玩家移动，不产生光斑
    this.playerGlow.position.set(this.playerPos.x + 12, this.playerPos.y + 20, this.playerPos.z + 8);
    this.playerGlow.target.position.copy(this.playerPos);
    // 月亮始终挂在相机前方的夜空
    const mf = this.camYaw + Math.PI;
    this.world.moon.position.set(
      this.playerPos.x - Math.sin(mf) * 190,
      92,
      this.playerPos.z - Math.cos(mf) * 190,
    );
    this.player.update(dt);
    this.nook.update(dt);
    this.isabelle.update(dt);
    this.owl.update(dt);
    for (const v of this.villagers) v.update(dt);

    this.renderer.render(this.scene, this.camera);
  };

  // ---------------- 室内 ----------------
  // 玩家家中已摆放的家具（盒子 + 物品 SVG 图，可收回）
  // 玩家家中内装：基础家具 + 已更换的系列墙纸/地板
  private playerHomeStyle(): InteriorStyle {
    const base = PLAYER_INTERIOR as InteriorStyle;
    const wall = this.homeDecor.wall ? SETS[this.homeDecor.wall]?.wallSvg : null;
    const floor = this.homeDecor.floor ? SETS[this.homeDecor.floor]?.floorSvg : null;
    return { ...base, wallSvg: wall ?? base.wallSvg, floorSvg: floor ?? base.floorSvg };
  }

  private renderPlacedFurniture() {
    this.placedGroup.clear();
    for (const pf of this.placedFurniture) {
      const good = GOOD_BY_ID[pf.id];
      if (!good) continue;
      // 真实的 3D 家具/道具模型（不再是盒子+贴图）
      const model = modelForGood(good);
      if (pf.hang) {
        // 挂画：挂在墙上（无碰撞，可穿过）
        model.position.set(pf.x, 1.5, pf.z);
        model.rotation.y = pf.rotY ?? 0;
        this.placedGroup.add(model);
        continue;
      }
      model.position.set(pf.x, 0, pf.z);
      model.rotation.y = (pf.x * 7 + pf.z * 13) % 2 ? Math.PI : 0; // 朝向略有变化
      this.placedGroup.add(model);
      // 地毯可以踩上去，不加碰撞
      if (good.shape !== 'rug') this.interior.colliders.push({ x: pf.x, z: pf.z, r: footprint(model) });
    }
    this.interior.group.add(this.placedGroup);
  }

  // 室外家具渲染 + 碰撞重建
  private renderOutdoorFurniture() {
    this.outdoorGroup.clear();
    // 先摘掉旧的室外家具碰撞
    const old = new Set(this.outdoorColliders);
    this.world.colliders = this.world.colliders.filter(c => !old.has(c));
    this.outdoorColliders = [];
    for (const of2 of this.outdoorFurniture) {
      const good = GOOD_BY_ID[of2.id];
      if (!good) continue;
      const model = modelForGood(good);
      model.position.set(of2.x, groundHeight(of2.x, of2.z), of2.z);
      model.rotation.y = of2.rotY;
      this.outdoorGroup.add(model);
      if (good.shape !== 'rug') { // 地毯可踩
        const c = { x: of2.x, z: of2.z, r: footprint(model) };
        this.outdoorColliders.push(c);
        this.world.colliders.push(c);
      }
    }
  }

  // 博物馆室内：基础装修 + 按捐赠记录动态摆放展品台
  private museumStyle(): InteriorStyle {
    const furniture: FurnitureItem[] = [
      { kind: 'rug', x: 0, z: 0.6, color: '#7a5a8a', w: 6, d: 4 },
      { kind: 'decor', x: -6.6, z: -4.2, emoji: '🦖', color: '#b0a890' },  // 镇馆恐龙骨架
      { kind: 'decor', x: 6.6, z: -4.2, emoji: '🏺', color: '#b0a890' },
      { kind: 'plant', x: -7, z: 3.8, color: '#5a9a4a' },
      { kind: 'plant', x: 7, z: 3.8, color: '#5a9a4a' },
    ];
    // 捐赠的展品沿两侧依次摆放（每种鱼/虫/化石都有自己的 SVG 图）
    this.donated.forEach((id, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      furniture.push({ kind: 'decor', x: side * 4.2, z: -2.4 + row * 1.8, item: id, emoji: ITEMS[id]?.icon ?? '❔', color: '#c9b98f' });
    });
    return { floorSvg: MUSEUM_BASE.floorSvg, wallSvg: MUSEUM_BASE.wallSvg, furniture };
  }

  private enterInterior(houseName: string) {
    const isPlayerHome = houseName === '你的家';
    const prof = isPlayerHome ? null : profileByName(houseName.replace('的家', ''));
    let style: InteriorStyle | undefined;
    if (isPlayerHome) style = PLAYER_INTERIOR;
    else if (houseName === '你的帐篷') style = TENT_INTERIOR as InteriorStyle;
    else if (houseName === '服务处') style = SERVICE_INTERIOR as InteriorStyle;
    else if (houseName === '友好商店') style = SHOP_INTERIOR as InteriorStyle;
    else if (houseName === '博物馆') style = this.museumStyle();
    else style = prof?.interior;
    if (!style) {
      sfx.ui();
      this.dialog(houseName, '门紧紧地关着……主人好像出门了。');
      return;
    }
    sfx.ui();
    this.outsidePos.copy(this.playerPos);
    this.interior.build(style, houseName);
    this.interior.group.visible = true;
    // 友好商店：摆出今日货架商品（每日轮换）
    this.shopDisplay.clear();
    this.shopStock = [];
    if (houseName === '友好商店') {
      const goods = dailyGoods(this.gameDay, 8); // 按游戏日轮换
      // 当日最贵的两件放房间中央的展示盒，其余贴墙摆一圈
      const sorted = [...goods].sort((a, b) => b.price - a.price);
      const center = sorted.slice(0, 2);
      const ring = sorted.slice(2);
      const centerSpots: [number, number][] = [[-1.2, 0.4], [1.2, 0.4]];
      const ringSpots: [number, number][] = [[-5.6, -4.4], [-1.9, -4.7], [1.9, -4.7], [5.6, -4.4], [-7, -1], [7, -1]];
      const placements: { good: ShopGood; x: number; z: number }[] = [
        ...center.map((good, i) => ({ good, x: centerSpots[i][0], z: centerSpots[i][1] })),
        ...ring.map((good, i) => ({ good, x: ringSpots[i][0], z: ringSpots[i][1] })),
      ];
      placements.forEach(({ good, x: gx, z: gz }) => {
        this.shopStock.push({ good, x: gx, z: gz });
        const g = new THREE.Group();
        const ped = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1), new THREE.MeshLambertMaterial({ color: 0xc9a86a }));
        ped.position.y = 0.4; ped.castShadow = true;
        g.add(ped);
        // 真实 3D 商品模型：大于摆放台就缩小到放得下，小于则保持原尺寸
        const model = modelForGood(good);
        fitToStand(model, 0.95, 1.25);
        model.position.y += 0.8; // 贴在台面上
        g.add(model);
        g.position.set(gx, 0, gz);
        this.shopDisplay.add(g);
        this.interior.colliders.push({ x: gx, z: gz, r: 0.55 });
      });
      this.interior.group.add(this.shopDisplay);
    }
    // 玩家之家：摆上已放置的家具
    if (isPlayerHome) this.renderPlacedFurniture();
    this.world.group.visible = false;
    // 房子建成后，喵喵进商店当店员（对标原版狸克在 Nook's Cranny）
    this.nook.group.visible = houseName === '友好商店' && this.world.homeUpgraded;
    if (this.nook.group.visible) {
      this.nook.group.position.set(2.2, 0, -3.2); // 柜台旁，玩家能看到
      this.nook.yaw = 0.4;
    }
    this.isabelle.group.visible = false;
    this.insideVillager = null;
    for (const v of this.villagers) {
      if (prof && v.def.name === prof.def.name && (this.homeFlags.get(v.def.name) ?? false)) {
        // 主人在家：在房间里迎接你
        v.group.visible = true;
        v.group.position.set(-2.5, 0, 0.5);
        v.yaw = Math.PI / 2;
        v.wander = false;
        v.moving = false;
        v.target = null;
        this.insideVillager = v;
      } else {
        v.group.visible = false;
      }
    }
    // 博物馆馆长就位
    this.owl.group.visible = houseName === '博物馆';
    if (this.owl.group.visible) {
      this.owl.group.position.set(-2.2, 0, -3.4);
      this.owl.yaw = 0.4;
      this.owl.wander = false;
      this.owl.moving = false;
    }
    // 皮卡丘在服务处柜台后（对标西施惠）
    this.isabelle.group.visible = houseName === '服务处';
    if (this.isabelle.group.visible) {
      this.isabelle.group.position.set(2.2, 0, -2.6); // 柜台旁，玩家能看到
      this.isabelle.yaw = 0.4;
    }
    this.inside = houseName;
    this.playerPos.set(0, 0, ROOM_D / 2 - 1.9);
    this.playerYaw = 0;             // 面向室内
    this.camYaw = 0;                // 相机在门侧看向室内
    this.player.group.position.copy(this.playerPos);
    // 玩家家的窗户：进屋后亮灯
    const isNight = this.time24 < 5.5 || this.time24 >= 19.5;
    this.world.setHouseLit(houseName, true, isNight);
  }

  private exitInterior() {
    sfx.ui();
    const houseName = this.inside;
    this.inside = null;
    this.insideVillager = null;
    this.shopStock = [];
    this.shopDisplay.clear();
    this.placedGroup.clear();
    this.mineNodes = [];
    this.mineLadderMesh = null;
    this.owl.group.visible = false;
    this.isabelle.group.visible = false;
    this.interior.group.visible = false;
    this.world.group.visible = true;
    this.nook.group.visible = !this.world.homeUpgraded; // 房子建好前喵喵在店外，之后进店当店员
    // 恢复村民状态（夜晚回家里待着，白天在外活动）
    for (const v of this.villagers) {
      const prof = profileByName(v.def.name);
      const home = this.homeFlags.get(v.def.name) ?? false;
      v.group.visible = !home;
      v.wander = !home;
      if (home && prof) {
        v.group.position.set(prof.home.x, groundHeight(prof.home.x, prof.home.z), prof.home.z);
      }
    }
    const isNight = this.time24 < 5.5 || this.time24 >= 19.5;
    if (houseName) this.world.setHouseLit(houseName, isNight && (this.homeFlags.get(houseName.replace('的家', '')) ?? false), isNight);
    // 出门落在该建筑的门口（而不是进屋前的站位）
    const door = houseName ? this.world.houses.find(h => h.name === houseName) : null;
    if (door) {
      this.playerPos.set(door.x, groundHeight(door.x, door.z), door.z);
    } else {
      this.playerPos.copy(this.outsidePos);
    }
    this.player.group.position.copy(this.playerPos);
  }

  // 夜晚村民回家（窗户随之亮灯），白天出门活动
  // 村民是否到了回家睡觉的时间（按各自生物钟，夜猫子凌晨1点才回）
  private isVillagerSleepTime(name: string): boolean {
    const r = this.routines.get(name) ?? { wake: 6.5, sleep: 21.5 };
    const t = this.time24;
    const s = r.sleep % 24;
    // 睡觉区间 [sleep, wake) 跨午夜处理
    return s > r.wake ? (t >= s || t < r.wake) : (t >= s && t < r.wake);
  }

  private applyNightHomes() {
    // 晚会刚结束：只同步作息标记，不传送任何人（留在篝火旁自由活动）
    if (this.skipHomeApply) {
      this.skipHomeApply = false;
      this.lastNightFlag = this.time24 < 5.5 || this.time24 >= 19.5;
      for (const v of this.villagers) this.homeFlags.set(v.def.name, this.isVillagerSleepTime(v.def.name));
      return;
    }
    const night = this.time24 < 5.5 || this.time24 >= 19.5;
    let anyChange = night !== this.lastNightFlag;
    this.lastNightFlag = night;
    for (const v of this.villagers) {
      const prof = profileByName(v.def.name);
      if (!prof) continue;
      // 雨天约四成宝可梦选择宅在家躲雨（每天午夜重新抽）
      const shouldHome = this.isVillagerSleepTime(v.def.name) || this.rainShy.has(v.def.name);
      if ((this.homeFlags.get(v.def.name) ?? !shouldHome) === shouldHome && !anyChange) continue;
      anyChange = true;
      this.homeFlags.set(v.def.name, shouldHome);
      if (this.inside) continue; // 玩家在室内时由 enter/exit 管理
      if (shouldHome) {
        v.group.visible = false;
        v.wander = false;
        v.moving = false;
        v.target = null;
        v.activityKind = null; v.activityT = 0;
        v.setTool('hand');
        v.sitting = false; v.headBow = 0;
        v.group.position.set(prof.home.x, groundHeight(prof.home.x, prof.home.z), prof.home.z);
      } else {
        // 从屋里出来才放到门口；本来就在外面的（比如晚会后）原地不动
        if (!v.group.visible) v.group.position.set(prof.spawn.x, groundHeight(prof.spawn.x, prof.spawn.z), prof.spawn.z);
        v.group.visible = true;
        v.wander = true;
        v.target = null;
        v.idleT = 1;
      }
    }
    // 房屋窗户：主人在家亮灯，外出则暗
    if (anyChange) {
      for (const hw of this.world.houseWindows) {
        const base = hw.name.replace('的家', '');
        const lit = night && (this.homeFlags.get(base) === true);
        this.world.setHouseLit(hw.name, lit, night);
      }
    }
  }

  // ---------------- 开场剧情（皮卡丘 × 玩家，服务处室内，动森式运镜） ----------------
  private startIntroCine() {
    // 剧情在服务处内部进行：皮卡丘在柜台后欢迎玩家
    this.enterInterior('服务处');
    this.cineActive = true;
    this.playerPos.set(0, 0, 1.2);
    this.player.group.position.copy(this.playerPos);
    this.playerYaw = Math.PI;
    this.player.yaw = Math.PI;      // 玩家面向柜台（-z）
    this.isabelle.group.position.set(0, 0, -2.2);
    this.isabelle.yaw = 0;          // 皮卡丘面向玩家（+z）
    this.cineShots = [
      { shot: 'wide', name: '皮卡丘', text: '皮卡皮卡~！欢迎来到「像素小岛」的服务处！我是向导皮卡丘，皮卡！' },
      { shot: 'pikachu', name: '皮卡丘', text: '你刚上岛的时候还有点迷迷糊糊的，现在看起来精神多了呢皮卡！' },
      { shot: 'two', name: '皮卡丘', text: '你的帐篷已经搭好了，出门往东走就能看到。其他宝可梦伙伴也都住进自己的家了皮卡~' },
      { shot: 'pikachu', name: '皮卡丘', text: '对了对了，喵喵社长说有事想拜托你——去广场西边的友好商店找它聊聊吧皮卡！' },
      { shot: 'player', name: '皮卡丘', text: '在岛上有任何问题，随时来服务处找我。属于你的小岛生活，就要开始咯皮卡~♪' },
    ];
    this.nextCineShot();
  }

  private nextCineShot() {
    const s = this.cineShots.shift();
    if (s) s.text = this.tt(s.text);
    if (!s) {
      // 剧终：恢复正常视角
      this.cineActive = false;
      this.introDone = true;
      this.save();
      store.patch({ dialog: null });
      return;
    }
    const cam = this.camera;
    const pk = this.isabelle.group.position;
    const pp = this.playerPos;
    switch (s.shot) {
      case 'wide': // 远景建立镜头：斜上方俯瞰服务处内的两人
        cam.position.set(pp.x + 4.6, 3.4, pp.z + 5);
        cam.lookAt((pk.x + pp.x) / 2, 0.8, (pk.z + pp.z) / 2);
        break;
      case 'pikachu': // 皮卡丘特写：斜前方低机位近景（原版对话构图）
        cam.position.set(pk.x - 1.7, 1.15, pk.z + 1.8);
        cam.lookAt(pk.x, 0.62, pk.z);
        break;
      case 'player': // 皮卡丘身后反应镜头：主体是玩家
        cam.position.set(pk.x - 1.1, 1.4, pk.z - 1.9);
        cam.lookAt(pp.x, 0.9, pp.z);
        break;
      case 'two': // 双人侧面镜头
        cam.position.set(pp.x - 4.2, 1.5, pp.z - 1.4);
        cam.lookAt((pk.x + pp.x) / 2, 0.8, (pk.z + pp.z) / 2);
        break;
    }
    store.patch({ dialog: { name: s.name, text: s.text } });
    sfx.speak(s.text, this.voicePitch(s.name)); // 剧情镜头语音
  }

  private handleCommands() {
    for (const c of commands.drain()) {
      switch (c.type) {
        case 'setTool': this.setTool(c.tool); break;
        case 'selectItem':
          this.selectedItem = c.item;
          if (c.item) this.setTool('hand');
          this.player.setHeldItem(c.item); // 物品拿在手上（水果/精灵球形态）
          this.syncHud();
          break;
        case 'interact': this.interactDown(); break;
        case 'interactDown': this.interactDown(); break;
        case 'interactUp': this.interactUp(); break;
        case 'closeDialog': this.advanceDialog(); break;
        case 'closeToast': store.patch({ toast: null }); break;
        case 'closeShop': store.patch({ shopOpen: false }); break;
        case 'enterVR': this.enterVRNow(); break;
        case 'exitVR': this.vrSys.exit(); break;
        case 'toggleHelp': store.patch({ helpOpen: !store.state.helpOpen }); break;
        case 'toggleMap': store.patch({ mapOpen: !store.state.mapOpen }); break;
        case 'titleMenu': sfx.ui(); store.patch({ titleStage: 'menu' }); break;
        case 'continueGame': this.startFromTitle(false); break;
        case 'saveQuit': {
          // 保存并回到标题：先把本地存档文件刷写完成再重载
          this.save();
          this.toast('已保存！', '💾', '正在回到标题画面……');
          void savefile.flushSave().finally(() => setTimeout(() => location.reload(), 600));
          break;
        }
        case 'newGame': this.startFromTitle(true); break;
        case 'dialogAction': {
          if (c.command === 'payDebt') this.payDebt();
          else if (c.command === 'payDebt2') this.payDebt2();
          else if (c.command === 'donateItem') this.confirmDonate();
          else if (c.command === 'openShop') {
            this.dialogQueue = [];
            store.patch({ dialog: null }); this.openShopPanel();
          }
          else if (c.command === 'chat') { this.dialog('喵喵', pick(NOOK_IDLE_LINES)); }
          else if (c.command === 'rateIsland') { sfx.ui(); this.rateIsland(); }
          else if (c.command === 'iceStock') this.stockFruits();
          else if (c.command === 'iceOpen') { this.dialogQueue = []; store.patch({ dialog: null }); this.openIceShop(); }
          else if (c.command === 'iceUpgrade') this.upgradeIceShop();
          else if (c.command === 'iceClose') { this.dialogQueue = []; store.patch({ dialog: null }); this.closeIceShop(); }
          else if (c.command === 'hireAsk') this.hireAsk();
          else if (c.command === 'hireGather') this.hire('gather');
          else if (c.command === 'hireServe') this.hire('serve');
          else if (c.command === 'hireManage') this.hire('manage');
          else if (c.command === 'fireStaff') this.fireStaff();
          else if (c.command === 'linkSave') { this.dialogQueue = []; store.patch({ dialog: null }); this.linkSaveFile(); }
          else if (c.command === 'questTalk') this.questTalkNook();
          else if (c.command === 'upgradeShovel') this.upgradeShovel();
          else if (c.command === 'sleepSave') this.goSleep(true);
          else if (c.command === 'sleepNoSave') this.goSleep(false);
          else { this.dialogQueue = []; store.patch({ dialog: null }); }
          break;
        }
        case 'sell': {
          const n = this.inventory[c.item] || 0;
          if (n > 0) {
            const gain = this.sellPrice(c.item) * n; // 每日高价品类 1.5 倍
            this.removeItem(c.item, n);
            this.addBells(gain);
            this.trackQuest('earn', gain);
            this.trackDaily('sell', 1);
            this.rewardSellMiles();
            sfx.sell();
            store.patch({ shopLine: `${ITEMS[c.item]?.name} × ${n}，一共 ${gain} 金币！多谢惠顾~` });
          }
          break;
        }
        case 'sellAll': {
          let gain = 0;
          for (const [id, n] of Object.entries({ ...this.inventory })) {
            const price = this.sellPrice(id); // 每日高价品类 1.5 倍
            if (price > 0) { gain += price * n; this.removeItem(id, n); }
          }
          if (gain > 0) {
            this.addBells(gain); // 之前漏了入账：全部卖掉后金币没增加
            this.trackQuest('earn', gain);
            this.trackDaily('sell', 1);
            this.rewardSellMiles();
            sfx.sell();
            store.patch({ shopLine: `全部卖掉啦，一共 ${gain} 金币！` });
          }
          else store.patch({ shopLine: '背包里还没有能卖的东西哦。' });
          break;
        }
        case 'buy': {
          if (this.bells >= c.price) {
            this.addBells(-c.price);
            this.addItem(c.item);
            sfx.sell();
            store.patch({ shopLine: `买下了${ITEMS[c.item]?.name}！拿在手上对草地按 E 就能种。` });
          } else {
            sfx.fail();
            store.patch({ shopLine: '金币不够啦……先去卖点东西吧！' });
          }
          break;
        }
      }
    }
  }

  private rewardSellMiles() {
    if (!this.firstFlags['firstSell']) {
      this.firstFlags['firstSell'] = true;
      this.addMiles(200, false);
      this.toast('第一次卖出物品！', '💚', '+200 积分');
    }
    this.save();
  }

  // 昼夜跟随玩家真实时间
  private lastClockSec = -1;
  // 游戏内时间：1 个游戏日 = 现实 1 小时（1 游戏小时 = 现实 150 秒），不强制睡觉
  private gameDay = 1;
  private updateClock(dt: number) {
    this.time24 += dt / 150;
    // 18:00 自动打烊
    if (this.iceShop.open && this.time24 >= 18) this.closeIceShop(true);
    if (this.time24 >= 24) {
      this.time24 -= 24;
      this.gameDay++;
      this.midnightReset(); // 每晚 12 点：矿山重置
    }
    // HUD 时钟低频刷新
    const totalMin = Math.floor(this.time24 * 60);
    if (totalMin !== this.lastClockSec) {
      this.lastClockSec = totalMin;
      const hh = Math.floor(this.time24).toString().padStart(2, '0');
      const mm = Math.floor((this.time24 % 1) * 60).toString().padStart(2, '0');
      store.patch({ timeText: `${hh}:${mm}`, dateText: `第${this.gameDay}天` });
    }
  }

  // 每晚 12 点重置：矿山矿石刷新（商店货架随 gameDay 自动轮换）
  private midnightReset() {
    this.mineState = null;
    this.iceShop.open = false; // 跨天强制打烊（库存保留）
    // 兜底：跨天时清掉滞留游客和船
    for (const v of [...this.tourists]) this.removeTourist(v);
    this.boatState = 'none';
    this.world.boat.visible = false;
    // 篝火晚会的火堆只留当晚，第二天撤掉
    this.world.removeBonfire();
    this.partyActive = false;
    if (this.inside === '矿洞') this.spawnMineNodes(); // 人在矿洞里也立即刷新
    // 新的一天随机天气：30% 雨天
    this.weather = Math.random() < 0.3 ? 'rain' : 'sun';
    this.rainShy.clear();
    if (this.weather === 'rain') {
      for (const v of this.villagers) if (Math.random() < 0.4) this.rainShy.add(v.def.name);
      this.toast('今天下雨啦', '🌧️', '有的宝可梦宅在家，出门的会撑小伞');
    }
    // 新的一天：刷新每日任务 + 高价收购品类
    this.ensureDailyTasks();
    this.syncHud();
    const hot = this.hotCategory();
    this.toast('新的一天开始了！', '📋', `今日高价收购：${hot.icon} ${hot.label}（1.5 倍）`);
  }

  // 雨滴动画（跟随玩家，斜向下落）
  private updateRain(dt: number) {
    const show = this.weather === 'rain' && !this.inside;
    this.rain.visible = show;
    if (!show) return;
    this.rain.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    const attr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const a = attr.array as Float32Array;
    for (let i = 0; i < a.length; i += 3) {
      a[i + 1] -= 26 * dt;
      a[i] -= 3.5 * dt; // 斜风
      if (a[i + 1] < 0) { a[i + 1] = 24; a[i] = Math.random() * 46 - 23; a[i + 2] = Math.random() * 46 - 23; }
      if (a[i] < -23) a[i] = 23;
    }
    attr.needsUpdate = true;
  }

  private updatePlayer(dt: number) {
    const p = this.playerPos;
    let ix = 0, iz = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) iz -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) iz += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) ix -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) ix += 1;
    ix += touchInput.dx; iz += touchInput.dy;

    // 钓鱼中移动：立即收竿（否则人走了浮标还留在水里）
    if (this.fishState !== 'idle' && Math.hypot(ix, iz) > 0.3) this.cancelFishing();

    // ---------- 室内移动：矩形房间 + 家具碰撞 ----------
    if (this.inside) {
      const len0 = Math.hypot(ix, iz);
      const uiBlocked0 = store.state.shopOpen || !!store.state.dialog || store.state.phoneOpen;
      const moving0 = len0 > 0.15 && !uiBlocked0;
      if (moving0) {
        ix /= Math.max(1, len0); iz /= Math.max(1, len0);
        const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
        const wx = cos * ix + sin * iz;
        const wz = -sin * ix + cos * iz;
        const speed = 3.8;
        let nx = p.x + wx * speed * dt;
        let nz = p.z + wz * speed * dt;
        nx = Math.max(-(ROOM_W / 2 - 0.9), Math.min(ROOM_W / 2 - 0.9, nx));
        nz = Math.max(-(ROOM_D / 2 - 0.9), Math.min(ROOM_D / 2 - 0.7, nz));
        for (const c of this.interior.colliders) {
          const dx = nx - c.x, dz = nz - c.z;
          const d = Math.hypot(dx, dz);
          const min = c.r + 0.5;
          if (d < min && d > 0.0001) {
            nx = c.x + (dx / d) * min;
            nz = c.z + (dz / d) * min;
          }
        }
        p.x = nx; p.z = nz; p.y = 0;
        const targetYaw = Math.atan2(wx, wz);
        let dy = targetYaw - this.playerYaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.playerYaw += dy * Math.min(1, dt * 12);
        this.stepT -= dt;
        if (this.stepT <= 0) { sfx.step(); this.stepT = 0.42; }
      }
      this.player.moving = moving0;
      this.player.yaw = this.playerYaw;
      this.player.group.position.copy(p);
      return;
    }
    const len = Math.hypot(ix, iz);
    const running = this.keys.has('shift') || touchInput.run;
    const moving = len > 0.15;
    const uiBlocked = store.state.shopOpen || !!store.state.dialog || store.state.phoneOpen;

    if (moving && !uiBlocked) {
      ix /= Math.max(1, len); iz /= Math.max(1, len);
      // 相对相机方向（W = 朝屏幕前方 / 远离相机）
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      const wx = cos * ix + sin * iz;
      const wz = -sin * ix + cos * iz;
      const speed = running ? 7.6 : 4.6;
      let nx = p.x + wx * speed * dt;
      let nz = p.z + wz * speed * dt;
      // 台阶式地形：单级高差 ≤0.5 可直接迈上（河岸沙滩/坡道台阶），更高的悬崖不可攀爬
      if (!onBridge(p.x, p.z) && !onBridge(nx, nz)) {
        const hOld = groundHeight(p.x, p.z), hNew = groundHeight(nx, nz);
        if (hNew - hOld > 0.55) { nx = p.x; nz = p.z; }
      }
      const r = Math.hypot(nx, nz);
      if (r > HALF - 4) { nx *= (HALF - 4) / r; nz *= (HALF - 4) / r; }
      // 深水阻挡（允许滑墙；浅滩沙岸可以行走钓鱼，深水区不可踏入）
      const wet = (wx: number, wz: number) =>
        !onBridge(wx, wz) && (isWaterAt(wx, wz) || groundHeight(wx, wz) < -0.75);
      if (wet(nx, nz)) {
        if (!wet(nx, p.z)) nz = p.z;
        else if (!wet(p.x, nz)) nx = p.x;
        else { nx = p.x; nz = p.z; }
      }
      // 碰撞体推挤
      for (const c of this.world.colliders) {
        const dx = nx - c.x, dz = nz - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + 0.55;
        if (d < min && d > 0.0001) {
          nx = c.x + (dx / d) * min;
          nz = c.z + (dz / d) * min;
        }
      }
      p.x = nx; p.z = nz;
      // 玩家面向移动方向（摇杆指向哪就朝哪跑）
      const targetYaw = Math.atan2(wx, wz);
      let dy = targetYaw - this.playerYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.playerYaw += dy * Math.min(1, dt * 12);
      // 键盘操作时相机缓慢跟随到身后；触屏视角由滑屏控制不跟随
      const fromTouch = Math.abs(touchInput.dx) + Math.abs(touchInput.dy) > 0.15;
      if (!fromTouch && !this.dragging) {
        let cd = (this.playerYaw + Math.PI) - this.camYaw;
        while (cd > Math.PI) cd -= Math.PI * 2;
        while (cd < -Math.PI) cd += Math.PI * 2;
        this.camYaw += cd * Math.min(1, dt * 1.2);
      }
      this.stepT -= dt;
      if (this.stepT <= 0) { sfx.step(); this.stepT = running ? 0.28 : 0.42; }
    }
    this.player.moving = moving && !uiBlocked;
    this.player.yaw = this.playerYaw;
    // 贴地（无跳跃，坡度平缓）
    p.y += (groundHeight(p.x, p.z) - p.y) * Math.min(1, dt * 14);
    this.player.group.position.copy(p);
  }

  // 环境音距离衰减：16 米外完全听不到（原版听感）
  private distVol(x: number, z: number, range = 16): number {
    if (this.inside) return 0; // 玩家在室内时听不到外面的动静
    return Math.max(0, 1 - Math.hypot(this.playerPos.x - x, this.playerPos.z - z) / range);
  }

  private updateVillagers(dt: number) {
    if (this.chatCd > 0) this.chatCd -= dt;
    for (const v of this.villagers) {
      if (!v.group.visible) continue;
      this.updateUmbrella(v);
      if (!v.wander) { v.moving = false; continue; }
      // 店员上班时间：工作逻辑接管
      if (this.updateWorker(v, dt)) continue;
      const pos = v.group.position;
      const isTourist = (v as unknown as { tourist?: boolean }).tourist === true;
      // 游客登船时间：径直走回码头，到达即上船
      if (isTourist && this.boatState === 'boarding') {
        const pier = this.world.pierPos;
        const dx = pier.x - pos.x, dz = (pier.z + 2) - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.5) { this.removeTourist(v); continue; }
        v.moving = true;
        pos.x += (dx / d) * v.speed * 1.2 * dt;
        pos.z += (dz / d) * v.speed * 1.2 * dt;
        pos.y += (groundHeight(pos.x, pos.z) - pos.y) * Math.min(1, dt * 12);
        v.yaw = Math.atan2(dx, dz);
        continue;
      }
      // ---- 即兴活动（动森原版氛围：钓鱼/捉虫/树下打盹/闻花/哼歌/早操/聊天/找玩家打招呼） ----
      if (v.activityT > 0) {
        v.activityT -= dt;
        v.activitySubT -= dt;
        v.target = null;
        v.moving = false;
        switch (v.activityKind) {
          case 'fish':
            // 偶尔「有鱼上钩」的惊喜
            if (v.activitySubT <= 0) {
              v.activitySubT = 3 + Math.random() * 3.5;
              if (Math.random() < 0.45) { v.setBubble('❗', 1.2); v.action('cast', 0.4); }
            }
            break;
          case 'net':
            if (Math.random() < dt * 0.45) v.action('swing', 0.5);
            if (v.activitySubT <= 0) { v.activitySubT = 4 + Math.random() * 3; if (Math.random() < 0.4) v.setBubble('❓', 1.2); }
            break;
          case 'nap': // 树下打盹
            if (v.activitySubT <= 0) { v.activitySubT = 3.5; v.setBubble('💤', 2.6); }
            break;
          case 'smell': // 驻足闻花
            if (v.activitySubT <= 0) { v.activitySubT = 4; v.setBubble(Math.random() < 0.5 ? '🎵' : '❤', 2); }
            break;
          case 'sing': // 哼歌（音量随距离衰减）
            if (v.activitySubT <= 0) {
              v.activitySubT = 1.7;
              v.setBubble('🎵', 1.5);
              const vol = 0.045 * this.distVol(pos.x, pos.z);
              if (vol > 0.002) {
                const base = 330 + Math.random() * 160;
                [0, 2, 4].forEach((st, j) => sfx.tone(base * Math.pow(1.122, st + Math.floor(Math.random() * 2)), 0.16, 'triangle', vol, j * 0.2));
              }
            }
            break;
          case 'chat': { // 面对面聊天
            const w = (v as unknown as { chatWith?: Villager }).chatWith;
            if (!w || w.activityKind !== 'chat') { v.activityT = 0; break; }
            if (v.activitySubT <= 0) {
              v.activitySubT = 1.1 + Math.random();
              v.setBubble(Math.random() < 0.7 ? '💬' : '🎵', 1.1);
              sfx.speak('叽里呱啦', 280 + Math.random() * 120, this.distVol(pos.x, pos.z));
              if (w.activityT > 0.5) { w.setBubble('💬', 1.1); }
            }
            break;
          }
          case 'facility': { // 游客使用室外公共设施（坐一下 +10 金币）
            const ft = (v as unknown as { facTarget?: { x: number; z: number } }).facTarget;
            if (!ft) { v.activityT = 0; break; }
            const dx = ft.x - pos.x, dz = ft.z - pos.z;
            const d = Math.hypot(dx, dz);
            if (d > 1.1) {
              v.moving = true;
              pos.x += (dx / d) * v.speed * dt;
              pos.z += (dz / d) * v.speed * dt;
              pos.y += (groundHeight(pos.x, pos.z) - pos.y) * Math.min(1, dt * 12);
              v.yaw = Math.atan2(dx, dz);
              v.sitting = false;
            } else {
              v.moving = false;
              v.sitting = true; // 坐在设施上
              if (v.activitySubT <= 0) {
                v.activitySubT = 999;
                this.addBells(10);
                v.setBubble('❤', 1.8);
                if (Math.random() < 0.15) this.toast('游客使用了你摆的设施', '🪑', '+10 金币');
              }
            }
            break;
          }
          case 'buyice': { // 去冰淇淋店排队买冰
            const sp = this.world.iceStallPos;
            const qx = sp.x + ((v as unknown as { queueOff?: number }).queueOff ?? 0), qz = sp.z + 3.2;
            const dx = qx - pos.x, dz = qz - pos.z;
            const d = Math.hypot(dx, dz);
            if (!this.iceShop.open || this.iceShop.stock <= 0) { v.activityT = 0; break; } // 打烊/售罄就走
            if (d > 0.6) {
              v.moving = true;
              const sp2 = v.speed * 1.3;
              pos.x += (dx / d) * sp2 * dt;
              pos.z += (dz / d) * sp2 * dt;
              v.yaw = Math.atan2(dx, dz);
            } else {
              v.yaw = Math.atan2(sp.x - pos.x, sp.z - pos.z);
              const paid = (v as unknown as { shopPaid?: boolean });
              if (!paid.shopPaid) {
                paid.shopPaid = true;
                v.setBubble('🍦', 2);
                this.serveCustomer(v);
                sfx.speak('来一个', 300 + Math.random() * 80, this.distVol(pos.x, pos.z));
              } else if (v.activitySubT <= 0) {
                v.activitySubT = 2.2;
                v.setBubble('❤', 1.6); // 吃得很开心
              }
            }
            break;
          }
          case 'greet': { // 跑来找玩家打招呼
            const pp = this.playerPos;
            const dx = pp.x - pos.x, dz = pp.z - pos.z;
            const d = Math.hypot(dx, dz);
            if (d > 2.4 && !this.inside) {
              v.moving = true;
              const sp = v.speed * 1.7;
              pos.x += (dx / d) * sp * dt;
              pos.z += (dz / d) * sp * dt;
              v.yaw = Math.atan2(dx, dz);
            } else {
              v.yaw = Math.atan2(pp.x - pos.x, pp.z - pos.z);
              if (v.activitySubT <= 0) {
                v.activitySubT = 2.4;
                v.setBubble(v.activityT > 2.5 ? '❗' : '❤', 1.6);
                sfx.speak('你好呀', 320, this.distVol(pos.x, pos.z));
              }
            }
            break;
          }
        }
        if (v.activityT <= 0) {
          // 活动收尾：聊天结束偶尔开心/生气
          if (v.activityKind === 'chat' && Math.random() < 0.6) v.setBubble(Math.random() < 0.75 ? '❤' : '💢', 2.2);
          if (v.activityKind === 'stretch') v.dance = null;
          v.setTool('hand');
          v.sitting = false;
          v.headBow = 0;
          v.activityKind = null;
          (v as unknown as { chatWith?: Villager }).chatWith = undefined;
          (v as unknown as { shopPaid?: boolean }).shopPaid = false;
          (v as unknown as { facTarget?: { x: number; z: number } }).facTarget = undefined;
          v.idleT = 2 + Math.random() * 3;
        }
        continue;
      }
      // ---- 开始一个新的即兴活动（站着歇脚的时候就可能做起别的事） ----
      if (!v.target && Math.random() < dt / 14) {
        const pos0 = v.group.position;
        const raining = this.weather === 'rain';
        let waterYaw: number | null = null;
        for (let a = 0; a < 8; a++) {
          const ang = (a * Math.PI) / 4;
          if (isWaterAt(pos0.x + Math.sin(ang) * 6, pos0.z + Math.cos(ang) * 6)) { waterYaw = ang; break; }
        }
        const hour = this.time24;
        const opts: string[] = [];
        if (waterYaw !== null) opts.push('fish', 'fish');          // 有水面更爱钓鱼
        if (!raining) opts.push('net', 'smell');
        if (!raining && hour > 11 && hour < 17) opts.push('nap');   // 午后打盹
        if (hour > 6.5 && hour < 9.5) opts.push('stretch');         // 清晨做操
        opts.push('sing');
        // 附近有闲逛的伙伴：聊天
        const partner = this.villagers.find(w => w !== v && w.group.visible && w.wander && w.activityT <= 0 && !w.target
          && Math.hypot(w.group.position.x - pos0.x, w.group.position.z - pos0.z) < 4.5);
        if (partner && this.chatCd <= 0 && !raining) opts.push('chat', 'chat');
        // 冰淇淋店营业中：去买冰（游客更积极，权重 ×3）
        if (this.iceShop.open && this.iceShop.stock > 0 && !this.inside) {
          opts.push('buyice', 'buyice');
          for (let i = 1; i < this.iceShop.level; i++) opts.push('buyice'); // 店铺升级后名气更大，顾客更勤
          if (isTourist) opts.push('buyice');
        }
        // 游客：使用室外公共设施
        if (isTourist && this.outdoorFurniture.length > 0) opts.push('facility', 'facility');
        // 玩家在旁边：跑来打招呼
        if (!this.inside && Math.hypot(this.playerPos.x - pos0.x, this.playerPos.z - pos0.z) < 8 && Math.random() < 0.35) opts.push('greet');
        const pickAct = opts[Math.floor(Math.random() * opts.length)];
        switch (pickAct) {
          case 'fish':
            v.activityKind = 'fish'; v.activityT = 12 + Math.random() * 8;
            v.yaw = waterYaw!; v.setTool('rod');
            break;
          case 'net':
            v.activityKind = 'net'; v.activityT = 6 + Math.random() * 4; v.setTool('net');
            break;
          case 'nap':
            v.activityKind = 'nap'; v.activityT = 14 + Math.random() * 10; v.sitting = true;
            v.setBubble('💤', 2.5);
            break;
          case 'smell':
            v.activityKind = 'smell'; v.activityT = 6 + Math.random() * 4; v.headBow = 0.55;
            break;
          case 'sing':
            v.activityKind = 'sing'; v.activityT = 5 + Math.random() * 3;
            break;
          case 'stretch':
            v.activityKind = 'stretch'; v.activityT = 7 + Math.random() * 3;
            v.dance = 2; // 借用开心小跳动作当做操
            break;
          case 'chat': {
            // 双方进入聊天状态，面对面站定
            const w = partner!;
            const dur = 6 + Math.random() * 3;
            v.activityKind = 'chat'; v.activityT = dur;
            w.activityKind = 'chat'; w.activityT = dur;
            w.activitySubT = 0.5; w.target = null; w.moving = false;
            v.yaw = Math.atan2(w.group.position.x - pos0.x, w.group.position.z - pos0.z);
            w.yaw = Math.atan2(pos0.x - w.group.position.x, pos0.z - w.group.position.z);
            (v as unknown as { chatWith?: Villager }).chatWith = w;
            (w as unknown as { chatWith?: Villager }).chatWith = v;
            this.chatCd = 45 + Math.random() * 30;
            break;
          }
          case 'facility': {
            const f = pick(this.outdoorFurniture);
            v.activityKind = 'facility'; v.activityT = 9 + Math.random() * 5;
            (v as unknown as { facTarget?: { x: number; z: number } }).facTarget = { x: f.x, z: f.z };
            break;
          }
          case 'buyice':
            v.activityKind = 'buyice'; v.activityT = 14 + Math.random() * 6;
            (v as unknown as { queueOff?: number }).queueOff = (Math.random() - 0.5) * 2.4;
            (v as unknown as { shopPaid?: boolean }).shopPaid = false;
            break;
          case 'greet':
            v.activityKind = 'greet'; v.activityT = 7;
            v.setBubble('❗', 1.4);
            break;
        }
        v.activitySubT = 0;
        v.target = null;
        continue;
      }
      if (v.idleT > 0) {
        v.idleT -= dt;
        v.moving = false;
        continue;
      }
      if (!v.target) {
        for (let tries = 0; tries < 12; tries++) {
          const nx = pos.x + (Math.random() - 0.5) * 24;
          const nz = pos.z + (Math.random() - 0.5) * 24;
          if (Math.hypot(nx, nz) > HALF - 8) continue;
          if (isWaterAt(nx, nz)) continue;
          if (this.world.colliders.some(c => Math.hypot(nx - c.x, nz - c.z) < c.r + 1)) continue;
          v.target = new THREE.Vector3(nx, 0, nz);
          break;
        }
        if (!v.target) { v.idleT = 2; continue; }
      }
      const dx = v.target.x - pos.x, dz = v.target.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) {
        v.target = null;
        v.idleT = 2 + Math.random() * 5;
        v.moving = false;
      } else {
        let nx = pos.x + (dx / d) * v.speed * dt;
        let nz = pos.z + (dz / d) * v.speed * dt;
        for (const c of this.world.colliders) {
          const cdx = nx - c.x, cdz = nz - c.z;
          const cd = Math.hypot(cdx, cdz);
          if (cd < c.r + 0.6 && cd > 0.001) {
            nx = c.x + (cdx / cd) * (c.r + 0.6);
            nz = c.z + (cdz / cd) * (c.r + 0.6);
          }
        }
        // 路径不能踏进水里（目标点虽在岸上，直线走过去也可能过河）
        if (isWaterAt(nx, nz) || groundHeight(nx, nz) < -0.75) {
          v.target = null;
          v.idleT = 1.5;
          v.moving = false;
          continue;
        }
        pos.x = nx; pos.z = nz;
        pos.y += (groundHeight(nx, nz) - pos.y) * Math.min(1, dt * 12);
        v.yaw = Math.atan2(dx, dz);
        v.moving = true;
      }
    }
  }

  private updateCamera(dt: number) {
    if (this.vrSys?.active) return; // VR：相机由头显驱动（rig 跟随玩家）
    if ((window as unknown as { __freecam?: boolean }).__freecam) return; // 调试：自由相机
    if (this.cineActive) return; // 剧情运镜中：相机由脚本控制
    // 触摸/鼠标滑动转视角
    if (touchInput.lookDX || touchInput.lookDY) {
      this.camYaw -= touchInput.lookDX * 0.0085;
      this.camPitch = Math.min(1.05, Math.max(0.35, this.camPitch + touchInput.lookDY * 0.005));
      touchInput.lookDX = 0; touchInput.lookDY = 0;
    }
    const p = this.playerPos;
    const pitch = this.inside ? 0.55 : this.camPitch;
    const dist = this.inside ? 7 : 10.5;
    const tx = p.x + Math.sin(this.camYaw) * Math.cos(pitch) * dist;
    const tz = p.z + Math.cos(this.camYaw) * Math.cos(pitch) * dist;
    const ty = p.y + Math.sin(pitch) * dist;
    this.camera.position.x += (tx - this.camera.position.x) * Math.min(1, dt * 6);
    this.camera.position.y += (ty - this.camera.position.y) * Math.min(1, dt * 6);
    this.camera.position.z += (tz - this.camera.position.z) * Math.min(1, dt * 6);
    this.camera.lookAt(p.x, p.y + 1.6, p.z);
  }

  private updateSky(isNight: boolean) {
    const t = this.time24;
    const sunA = ((t - 6) / 24) * Math.PI * 2; // 6点日出
    const sx = Math.cos(sunA), sy = Math.sin(sunA);
    this.sun.position.set(this.playerPos.x + sx * 60, Math.max(8, sy * 80), this.playerPos.z + 30);
    this.sun.target.position.copy(this.playerPos);
    const day = new THREE.Color(0x87ceeb);
    const night = new THREE.Color(0x101736);
    const dawn = new THREE.Color(0xffb37a);
    const dusk = new THREE.Color(0xd97a9e);
    let sky: THREE.Color;
    if (t < 5) sky = night.clone();
    else if (t < 7) sky = night.clone().lerp(dawn, (t - 5) / 2);
    else if (t < 9) sky = dawn.clone().lerp(day, (t - 7) / 2);
    else if (t < 17) sky = day.clone();
    else if (t < 19) sky = day.clone().lerp(dusk, (t - 17) / 2);
    else if (t < 21) sky = dusk.clone().lerp(night, (t - 19) / 2);
    else sky = night.clone();
    // 雨天：白天压成铅灰色，阳光减弱
    if (this.weather === 'rain' && !isNight) sky.lerp(new THREE.Color(0x6a7684), 0.62);
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color.copy(sky);
    // ---- 天体位置/可见性 ----
    {
      const px = this.playerPos.x, pz = this.playerPos.z;
      const rain = this.weather === 'rain';
      // VR 远裁剪面只有 35m：天体整体拉近（ck 0.14 → 约 29m，盘同步缩小保持视角大小），
      // 云直接去掉、星星只画 1/3——保帧率
      const vr = !!this.vrSys?.active;
      const ck = vr ? 0.14 : 1;
      this.stars.scale.setScalar(ck);
      const starTotal = this.stars.geometry.attributes.position.count;
      this.stars.geometry.setDrawRange(0, vr ? Math.floor(starTotal / 3) : starTotal);
      for (const c of this.clouds) c.visible = !vr;
            this.moonDisc.scale.setScalar(vr ? 0.31 : 1);
      // 太阳永久隐藏（用户反馈太丑）：moonGlow/sunDisc 仍占可见性字段，后续可一键恢复
      this.sunDisc.visible = false;
      this.sunGlow.visible = false;
      // 满月：18 点升起、6 点落下
      const moonA = (((t + 6) % 24) / 24) * Math.PI * 2;
      const my = Math.sin(moonA);
      const moonShow = my > -0.05 && isNight && !rain;
      this.moonDisc.visible = moonShow;
      if (moonShow) {
        this.moonDisc.position.set(px + Math.cos(moonA) * 170 * ck, Math.max(10, my * 150 * ck), pz + 120 * ck);
        this.moonDisc.lookAt(this.camera.position);
      }
      // 星星：深夜最亮，黄昏/黎明渐隐；雨天遮住
      const starF = rain ? 0 : Math.max(0, Math.min(1, (isNight ? 1 : 0) * (t >= 21 || t < 3 ? 1 : t >= 19 ? (t - 19) / 2 : t < 5 ? (5 - t) / 2 : 0)));
      this.stars.visible = starF > 0.02;
      if (this.stars.visible) {
        (this.stars.material as THREE.PointsMaterial).opacity = 0.9 * starF;
        this.stars.position.set(px, 0, pz);
        this.stars.rotation.y += 0.0004;
      }
      // 云：慢慢漂移，围绕玩家循环；夜里变暗、雨天几乎融进灰天
      this.cloudT += 0.16 * (1 / 60);
      for (let i = 0; i < this.clouds.length; i++) {
        const c = this.clouds[i];
        c.position.x += 0.016;
        const cWrap = 160 * ck;
        if (c.position.x - px > cWrap) c.position.x = px - cWrap;
        const mat = (c.children[0] as THREE.Mesh).material as THREE.MeshLambertMaterial;
        mat.opacity = rain ? 0.5 : isNight ? 0.35 : 0.92;
        mat.color.setHex(rain ? 0x8a94a0 : isNight ? 0x3a4460 : 0xffffff);
      }
    }
    const dayF = Math.max(0, Math.min(1, sy * 2 + 0.4));
    this.sun.intensity = isNight ? 0.18 : 0.4 + dayF * 0.8;
    if (this.weather === 'rain' && !isNight) this.sun.intensity *= 0.5;
    this.sun.color.set(isNight ? 0x8fa8ff : 0xfff4e0);
    this.ambient.intensity = isNight ? 0.32 : 0.55;
    this.hemi.intensity = isNight ? 0.2 : this.weather === 'rain' ? 0.38 : 0.5;
  }
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
