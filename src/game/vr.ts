// ---------------- VR 模式（WebXR）----------------







// 第一人称视角 + 双手 + 原地踏步移动 + 挥臂用工具 + 手腕面板 + 悬浮对话







// 防眩晕：移动时隧道视野（暗角）、45° 快速转向（无平滑旋转）、平滑加减速







import * as THREE from 'three';







import { store, commands } from './store';







import { ITEMS } from './data';

import { ACHIEVEMENTS } from './game';







import { makeFruitDrop, makePokeBall, makeItemDrop } from './items3d';
import { GOOD_BY_ID } from './shopgoods';
import { modelForGood } from './itemmodels';















// 宿主（Game）提供给 VR 系统的接口







export interface VRHost {







  renderer: THREE.WebGLRenderer;







  scene: THREE.Scene;







  camera: THREE.PerspectiveCamera;







  playerPos: THREE.Vector3;







  groundY(x: number, z: number): number;







  setViewYaw(yaw: number): void;   // 同步视线朝向（供移动/交互判定用）







  onVrSwing(power: number): void;  // 挥臂 → 用工具/摇树/甩竿







  onVrTrigger(): void;             // 扳机 → 通用交互（对话/开店/摘花）







  onVrTriggerRelease(): boolean;   // 扳机松开 → 钓鱼按蓄力抛竿（返回是否真的抛竿，用于震动反馈）







  onCycleTool(dir: number): void;  // A/B 键切换工具







  onVRStart(): void;               // 进入 VR（隐藏玩家模型等）







  onVREnd(): void;                 // 退出 VR







  touch: { dx: number; dy: number; run: boolean }; // 移动输入通道（复用现有碰撞逻辑）







  getInventory(): [string, number][]; // 背包物品（右手"手机"显示用）

  getBagSlots(): number;             // 背包容量（里程商店可扩容，背包页按此渲染格子数）







  onSelectTool(tool: string): void;   // 手机上点选工具







  hasTool(tool: string): boolean;     // 工具是否已解锁







  getPickups(): { id: number; pos: THREE.Vector3; mesh: THREE.Object3D }[]; // 地面掉落物（指向拾取用）







  onPointPickup(id: number): void;    // 手柄指着掉落物扣扳机 → 放入背包







  getTalkTargets(): { id: string; pos: THREE.Vector3; top: number }[]; // 可对话角色（指向对话用）



  getFlowers(): { id: number; x: number; z: number; itemId: string }[];  // 可摘花（指向摘取用）



  getWeeds(): { id: number; x: number; z: number }[];                    // 可拔草（指向拔取用）



  onPointFlower(id: number): void;    // 手柄指着花扣扳机 → 摘花



  onPointWeed(id: number): void;      // 手柄指着草扣扳机 → 拔草







  onPointTalk(id: string): void;      // 手柄指着角色扣扳机 → 对话







  getMapMarkers(): { name: string; x: number; z: number; color: string }[]; // 宝可梦实时位置（手机地图页）

  // ---- VR 装修模式（房间沙盘）：阶段一在 game.ts 实现数据层，阶段二 vr.ts 交互层按此调用 ----

  getPlacedMini(): { mesh: THREE.Object3D; r: number; idx: number }[];   // 迷你房间内已摆放家具（真实房间坐标半径）

  onDecorEnter(): void;                                                    // 进入装修（隐藏村民/灯光，置 decorActive）

  onDecorExit(): void;                                                     // 退出装修（恢复 + 钳制玩家回房间 + 保存）

  onDecorAdd(id: string, x: number, z: number): void;                      // 添加家具（扣库存 + 重建 + 保存）

  onDecorMove(idx: number, x: number, z: number, rotY: number): void;      // 移动/旋转（不扣库存 + 重建 + 保存）

  onDecorRemove(idx: number): void;                                        // 移除（收回背包 + 重建 + 保存）

  onDecorSet(kind: 'wall' | 'floor', setId: string): void;                 // 换墙纸/地板（只写 homeDecor + 重建 + 保存）
  getInteriorGroup(): THREE.Group | null;      // 当前室内 group（迷你房间缩放对象）
  getInside(): string | null;                  // 当前所在室内名（'你的家'/'你的帐篷'/…，室外 null）

}


















// ================= 原地踏步检测（Godot XR Tools jog-in-place 算法移植）================







// 原理：取左右手柄的 Y 速度（位置差分），跑步时两手反相关摆动，乘积出一个







// 带 confidence 峰/谷的信号；检测峰→谷→峰间隔，得出 stroke 频率 Hz；







// 频率 ≥ 慢跑门槛 → 0.9 m/s；≥ 快跑门槛 → 3.0 m/s。完全不用头部位置，







// 适配 Pico/Quest/任何头显——手柄 IMU 速度信号天然有 1~5 m/s 振幅。







// 参考：GodotXR-tools/addons/godot-xr-tools/functions/movement_jog.gd







export class MarchDetector {







  // 慢跑触发频率（Hz）—— Godot 默认 3.5，这里降到 2.5 让"小步慢颠"也能起步







  static SLOW_FREQ = 2.5;







  // 快跑触发频率（Hz）—— Godot 默认 5.5，这里降到 3.5（Pico 手臂摆动通常 2.5~4 Hz）







  static FAST_FREQ = 3.5;







  // confidence 门槛（无量纲，speed²）—— 信号低于此视为未跑







  static CONF_THRESH = 0.4;















  // 双手柄 Y 速度 EMA（指数移动平均，避免噪声）







  private leftVy = 0; private rightVy = 0;







  // confidence 信号（peak 检测）







  private confHat = 0;







  // stroke 持续时间累加







  private currentStroke = 0;







  // 上一个完整 stroke 持续时间（用于算 Hz）







  private lastStroke = 0;







  // 上一次手柄位置（用于差分算速度）







  private prevLeftPos: THREE.Vector3 | null = null;







  private prevRightPos: THREE.Vector3 | null = null;







  // 上一帧步频Hz（输出用）







  private strokeHz = 0;















  speed = 0;                // 平滑后的目标速度（米/秒）







  running = false;















  // left/right: 当前帧两个手柄的世界位置对象；t: 当前时间秒；dt: 帧间隔秒







  update(leftPos: THREE.Vector3, rightPos: THREE.Vector3, _t: number, dt: number, _pitch = 0) {







    // 1. 计算左右手柄 Y 速度（位置差分）







    if (this.prevLeftPos && this.prevRightPos && dt > 0) {







      const leftVy = (leftPos.y - this.prevLeftPos.y) / dt;







      const rightVy = (rightPos.y - this.prevRightPos.y) / dt;







      // EMA 平滑（α ≈ 0.5 —— 跑动时 1 帧基本到位）







      this.leftVy = this.leftVy + (leftVy - this.leftVy) * Math.min(1, dt * 8);







      this.rightVy = this.rightVy + (rightVy - this.rightVy) * Math.min(1, dt * 8);







    }







    this.prevLeftPos = leftPos.clone();







    this.prevRightPos = rightPos.clone();















    // 2. confidence 信号 = 左 Y 速度 × -右 Y 速度（反相关 → 跑步时出正峰）







    const conf = this.leftVy * -this.rightVy;















    // 3. valley 检测 + confidence-hat 更新（快升慢降）







    const valley = conf < this.confHat;







    if (valley) {







      // valley 中慢慢泄







      this.confHat = this.confHat + (0 - this.confHat) * Math.min(1, dt * 2);







    } else {







      // 峰时快速升







      this.confHat = this.confHat + (conf - this.confHat) * Math.min(1, dt * 20);







    }















    // 4. confidence 不足 → 用户没跑







    if (this.confHat < MarchDetector.CONF_THRESH) {







      this.currentStroke = 0;







      this.lastStroke = 0;







      this.strokeHz = 0;







      this.running = false;







      this.speed += (0 - this.speed) * Math.min(1, dt * 24);







      if (this.speed < 0.05) this.speed = 0;







      return;







    }















    // 5. 跟踪 stroke 持续时间（peak → valley → peak 一次）







    if (valley) {







      this.currentStroke += dt;







    } else if (this.currentStroke > 0.1) {







      this.lastStroke = this.currentStroke;







      this.currentStroke = 0;







    }















    // 6. 还没出过一次完整 stroke → 0Hz







    if (this.lastStroke < 0.1) {







      this.strokeHz = 0;







    } else {







      this.strokeHz = 1.0 / this.lastStroke;







    }















    // 7. stroke 超过 0.75s（< 1.33Hz）→ 用户已停，强制归零







    if (this.currentStroke > 0.75) {







      this.strokeHz = 0;







    }















    // 8. 根据 Hz 决定目标速度（用 0.9 m/s 慢跑起步，避免一开始冲出去）







    const hz = this.strokeHz;







    let target = 0;







    if (hz >= MarchDetector.SLOW_FREQ) {







      // 线性映射：SLOW_FREQ→0.9 m/s，FAST_FREQ→3.0 m/s







      const ratio = Math.min(1, (hz - MarchDetector.SLOW_FREQ) / (MarchDetector.FAST_FREQ - MarchDetector.SLOW_FREQ));







      target = 0.9 + ratio * (3.0 - 0.9);







    } else {







      target = 0;







    }







    this.running = hz >= MarchDetector.FAST_FREQ;















    // 9. 平滑到目标速度（快速启停）







    const k = target > this.speed ? 12 : 24;







    this.speed += (target - this.speed) * Math.min(1, dt * k);







    if (this.speed < 0.05) this.speed = 0;







  }







}















// ================= 挥臂检测 =================







// 跟踪手柄世界速度：向下劈/向前挥超过阈值 = 一次挥动







export class SwingDetector {







  private prev = new THREE.Vector3();







  private vel = new THREE.Vector3();







  private tmp = new THREE.Vector3();







  private cooldown = 0;







  private init = false;







  power = 0; // 最近一次挥动力度（用于音效/震动强度）















  update(obj: THREE.Object3D, dt: number, moveSpeed = 0): boolean {







    this.cooldown -= dt;







    const p = obj.getWorldPosition(this.tmp);







    if (!this.init) { this.init = true; this.prev.copy(p); return false; }







    if (dt > 0) this.vel.copy(p).sub(this.prev).divideScalar(dt);







    this.prev.copy(p);







    if (this.cooldown > 0) return false;







    const vy = this.vel.y;







    const hSpeed = Math.hypot(this.vel.x, this.vel.z);







    // 走路/跑步时手臂自然摆动会被误判，移动越快阈值越高







    const chopTh = -2.2 - moveSpeed * 0.18;







    const swishTh = 2.8 + moveSpeed * 0.25;







    // 下劈（砍树/挖矿/铲地）或前挥（捕虫网/甩竿）







    const chop = vy < chopTh && hSpeed < 3.5;







    const swish = hSpeed > swishTh;







    if (chop || swish) {







      this.cooldown = 0.55;







      this.power = Math.min(1, (chop ? -vy : hSpeed) / 4);







      return true;







    }







    return false;







  }







}















// 指向候选：射线命中判定所需的最小数据（池化复用，重建时覆写，不每帧 new）

type PointCand = {

  kind: 'pickup' | 'talk' | 'flower' | 'weed' | 'decor';

  id: string;

  pos: THREE.Vector3;

  mesh?: THREE.Object3D;

  top: number;
  idx?: number;                 // decor 候选：placedFurniture 下标

  r2: number;

};

// ================= VR 系统主体 =================







export class VRSystem {







  active = false;







  supported = false;







  private session: XRSession | null = null;







  private rig = new THREE.Group();







  private controllers: THREE.Group[] = [];







  private inputs: (XRInputSource | null)[] = [null, null];







  private hands: THREE.Group[] = [];







  private toolMesh: THREE.Group | null = null;







  private currentTool = '';







  private march = new MarchDetector();      // 头部起伏







  private swings = [new SwingDetector(), new SwingDetector()];







  private snapYaw = 0;            // rig 朝向（摇杆快速转向已移除，固定为0）







  private wrist!: THREE.Mesh;







  private wristCtx!: CanvasRenderingContext2D;







  private wristTex!: THREE.CanvasTexture;







  private wristT = 0;







  // 右手"手机"面板：地图/背包/工具，左手射线点选







  private phone!: THREE.Mesh;







  private phoneCtx!: CanvasRenderingContext2D;







  private phoneTex!: THREE.CanvasTexture;







  private phoneTab: 'map' | 'bag' | 'tool' | 'decor' | 'skill' | 'award' = 'map';







  private phoneBtns: { x: number; y: number; w: number; h: number; action: string }[] = [];







  private phoneHover = -1;







  private phoneT = 0;







  private mapImg: HTMLImageElement | null = null;







  private mapImgSrc = '';







  private bagMsg = '';







  private bagMsgT = 0;







  private dialogPanel: THREE.Group | null = null;







  private dialogCtx!: CanvasRenderingContext2D;







  private dialogTex!: THREE.CanvasTexture;







  private dialogKey = '';







  private hoverBtn = -1;







  private hoverByHand: number[] = [-1, -1]; // 每只手激光指到的对话按钮







  private lasers: THREE.Mesh[] = [];        // 双手激光线（对话选项场景才显示）







  private btnRects: { x: number; y: number; w: number; h: number; command: string }[] = [];

  // ---- DOM Overlay 运行时诊断 ----
  private diagToastTimer: ReturnType<typeof setTimeout> | null = null;

  private domOverlayOk = false;   // 本次会话 dom-overlay 是否被浏览器接受（决定 3D 商店面板是否启用）

  // ---- VR 3D 商店面板（Quest 不支持 DOM Overlay 时的备选方案）----
  private shopPanel: THREE.Group | null = null;
  private shopCtx!: CanvasRenderingContext2D;
  private shopTex!: THREE.CanvasTexture;
  private shopKey = '';
  private shopBtnRects: { x: number; y: number; w: number; h: number; command: string }[] = [];
  private shopHoverByHand: number[] = [-1, -1];
  private shopHitDist: number[] = [-1, -1];   // 每只手射线打到商店面板的距离（-1 = 未指向面板）







  private tmpV = new THREE.Vector3();







  private tmpV2 = new THREE.Vector3();







  // 指向交互：每只手指着的目标（掉落物 = 拾取；角色 = 对话）







  private pointByHand: ({ kind: 'pickup' | 'talk' | 'flower' | 'weed' | 'decor'; id: string; pos: THREE.Vector3; mesh?: THREE.Object3D; top: number; idx?: number } | null)[] = [null, null];

  // 指向候选缓存：8Hz 重建一次，每帧射线命中判定复用（消除每帧 200+ 临时对象）

  private aimCands: PointCand[] = [];        // 复用候选数组

  private aimPool: PointCand[] = [];         // 候选槽位池（懒增长，重建时覆写复用）

  private aimVecs: THREE.Vector3[] = [];     // 花/草静态坐标 Vector3 池

  private aimRebuildT = 0;                   // 候选重建节流计时（8Hz）

  private aimWin: (PointCand | null)[] = [null, null]; // 每手稳定命中槽位（跨帧只读 kind/id/mesh）
  // ---- VR 装修模式（迷你房间沙盘）交互层状态 ----
  private decorT = 0;                  // 0=未激活, 0~1=进入补间, 1=激活, -1~0=退出补间
  private decorIdx = -1;               // 当前选中家具下标（placedFurniture idx，-1=无）
  private decorDrag = false;           // 正在拖拽迷你家具
  private decorDragIdx = -1;           // 拖拽中的家具下标
  private decorGroup: THREE.Group | null = null;   // interior.group 引用（host.getInteriorGroup()）
  private decorSavePos = new THREE.Vector3();      // 进入前 group 位置（退出还原）
  private decorSaveRot = 0;            // 进入前 group.rotation.y
  private decorSaveScale = 1;          // 进入前 group 缩放
  private decorGrid: THREE.LineSegments | null = null; // 迷你房间网格底座
  private decorGhost: THREE.Object3D | null = null;    // 添加家具幽灵预览（半透明克隆）
  private decorGhostId = '';           // 幽灵物品 id
  private decorGhostPos = new THREE.Vector3();        // 幽灵当前落点（真实房间坐标，已吸附/钳制）
  private viewYaw = 0;                 // 每帧缓存视线朝向（updateDecor 用）








  private triggerHeld = [false, false];   // 扳机按住状态（挥臂命中工具的前置条件）







  private talkSprites: THREE.Sprite[] = [];   // 指着角色时头顶的 💬 气泡







  private tmpQ = new THREE.Quaternion();







  private tmpA = new THREE.Vector3();







  private tmpB = new THREE.Vector3();
  private tmpM4 = new THREE.Matrix4();















  private host: VRHost;







  constructor(host: VRHost) {







    this.host = host;







    // 检测 VR 设备（Quest 等浏览器里为 true）







    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;







    if (xr?.isSessionSupported) {







      xr.isSessionSupported('immersive-vr').then(ok => {







        this.supported = ok;







        store.patch({ vrSupported: ok });







      }).catch(() => { /* ignore */ });







    }







  }















  async enter() {







    if (this.active || !this.supported || this.entering) return;







    this.entering = true;







    const xr = (navigator as Navigator & { xr?: XRSystem }).xr!;







    try {







      // WebXR DOM Overlay：把 GameUI 根容器（id="xr-dom-overlay"）设为叠加层，
      // 商店/帮助/任务/手机等全部 DOM 面板在头显内可见，Quest 手柄射线点按投递浏览器 pointer 事件（React onClick 原样生效）
      const overlayRoot = document.getElementById('xr-dom-overlay');
      const sessionInit: XRSessionInit = {
        optionalFeatures: ['local-floor', 'bounded-floor', 'dom-overlay'],
      };
      // 找不到叠加根（非 Quest / 浏览器不支持 DOM Overlay）时回退普通沉浸会话——optionalFeatures 本身容错，这里再兜一层
      if (overlayRoot) sessionInit.domOverlay = { root: overlayRoot };
      const session = await xr.requestSession('immersive-vr', sessionInit);

      // ---- WebXR DOM Overlay 运行时诊断（必须）----
      // requestSession 返回后立刻判定浏览器是否真的接受了 dom-overlay（optionalFeatures 不保证启用）。
      // domOverlayState 定义见 WebXR DOM Overlays 规范：type ∈ 'screen' | 'floating' | 'head-locked'。
      // Quest 的 immersive-vr 会话可能静默忽略该 feature → domOverlayState 为 undefined。
      const domOverlayState = session.domOverlayState;
      this.domOverlayOk = !!domOverlayState;   // 3D 商店面板只在 dom-overlay 失效时启用（避免双 UI）
      const cssIssue = this.checkDomOverlayAncestors(overlayRoot);
      console.info('[VR] DOM Overlay 诊断', {
        overlayRootFound: !!overlayRoot,
        domOverlayRequested: !!overlayRoot,
        domOverlayState,
        cssIssue,



        conclusion: domOverlayState ? 'dom-overlay 生效' : '浏览器未授予 dom-overlay（Quest 限制，已自动使用 3D 面板兜底）',
      });
      // 延后展示 toast：避免被 host.onVRStart() 的「VR 模式」提示（1.5s 后清空）立即覆盖
      setTimeout(() => {
        if (!overlayRoot) {
          this.diagToast('⚠️ DOM Overlay 未启用', '🥽', '未找到 #xr-dom-overlay 元素，sessionInit 未携带 domOverlay');
        } else if (cssIssue) {
          this.diagToast('⚠️ DOM Overlay 祖先链异常', '🥽', `${cssIssue} 含合成属性（transform/opacity/filter…），头显内可能不显示 DOM`);
        } else if (domOverlayState) {
          this.diagToast('✅ DOM Overlay 已启用', '🟢', `会话已接受 dom-overlay（type=${domOverlayState.type}），DOM 面板应在头显内可见`, 3500);
        } else {
          this.diagToast('⚠️ DOM Overlay 未启用', '🥽', '当前浏览器不支持 DOM Overlay（Quest 限制），已自动使用 3D 面板');
        }
      }, 1800);







      this.session = session;







      const r = this.host.renderer;







      r.xr.enabled = true;







      r.xr.setReferenceSpaceType('local-floor');







      // VR 减负：降渲染分辨率。视距不动（用户对游戏视野有强偏好，宁可糊不愿小）。







      this.savedPixelRatio = r.getPixelRatio();














      this.savedFar = this.host.camera.far;



      this.host.camera.far = 40; // VR 砍远裁剪到 40m：雾不动，用户偏好



      const fog = this.host.scene.fog as THREE.Fog | null;



      if (fog) { this.savedFog = [fog.near, fog.far]; } // 雾保留不变







      // setFramebufferScalingFactor 必须在 setSession 前调用，否则 baseLayer 已创建不生效
      (r.xr as unknown as { setFramebufferScalingFactor?: (s: number) => void }).setFramebufferScalingFactor?.(0.2);
      await r.xr.setSession(session);







      // 固定注视点渲染：周边自然模糊（0=无, 1=中, 2=强, 3=最强）。VR 转头时周边本来就会糊，







      // foveation 把这种"转头边缘糊"做成视觉默认状态——动态降低中心分辨率感觉就不明显。







      (r.xr as unknown as { setFoveation?: (f: number) => void; setFramebufferScalingFactor?: (s: number) => void }).setFoveation?.(2);








      this.setupScene();







      this.host.onVRStart();







      session.addEventListener('end', () => this.teardown());







      this.active = true;







      store.patch({ vrActive: true });







    } catch (e) {







      store.patch({ toast: { title: 'VR 启动失败', icon: '🥽', desc: '请确认头显已连接并授权' } });







    } finally {







      this.entering = false;







    }







  }















  exit() { void this.session?.end(); }

  // DOM Overlay 规范（immersive-web.github.io/dom-overlays）：overlay root 自身及其祖先若带
  // transform/opacity/filter/backdrop-filter/mix-blend-mode 等合成属性，祖先的 stacking context
  // 不会绘制到头显（UA 样式表只对 overlay 元素本身强制 transform:none），面板可能显示异常。
  // 返回问题链描述（root → html 逐级检查），无问题返回 null。
  private checkDomOverlayAncestors(root: Element | null): string | null {
    if (!root) return null;
    const props: [string, (cs: CSSStyleDeclaration) => string][] = [
      ['transform', cs => cs.transform],
      ['opacity', cs => cs.opacity],
      ['filter', cs => cs.filter],
      ['backdrop-filter', cs => cs.backdropFilter],
      ['mix-blend-mode', cs => cs.mixBlendMode],
    ];
    const issues: string[] = [];
    let el: Element | null = root;
    while (el) {
      const cs = window.getComputedStyle(el);
      const bad = props.filter(([, get]) => {
        const v = get(cs).trim();
        return v !== '' && v !== 'none' && v !== '1' && v !== 'normal';
      }).map(([name]) => name);
      if (bad.length) issues.push(`${el.id ? '#' + el.id : el.tagName.toLowerCase()}[${bad.join(', ')}]`);
      el = el.parentElement;
    }
    return issues.length ? issues.join(' → ') : null;
  }

  // 诊断 toast：比 game.toast（1.5s）更久，保证用户在头显内有时间读完
  private diagToast(title: string, icon: string, desc: string, ms = 6000) {
    store.patch({ toast: { title, icon, desc } });
    if (this.diagToastTimer) clearTimeout(this.diagToastTimer);
    this.diagToastTimer = setTimeout(() => {
      if (store.state.toast?.title === title) store.patch({ toast: null });
    }, ms);
  }















  private savedPixelRatio = 1;







  private entering = false;







  // VR 专属物品显示：玩家 group.visible=false 让 heldItem 不可见，



  // VR 时把物品移到右手 controller（rig 子物体）→ 永远可见



  private vrHeldItem: THREE.Group | null = null;











  private savedFar = 600;







  private savedFog: [number, number] | null = null;















  private setupScene() {







    const { scene, camera, playerPos } = this.host;







    // 相机挂进 rig：rig 跟随玩家位置 + 快速转向角







    this.rig.position.set(playerPos.x, this.host.groundY(playerPos.x, playerPos.z), playerPos.z);







    this.rig.rotation.y = this.snapYaw = 0;







    scene.add(this.rig);







    this.rig.add(camera);







    // VR 时物品挂右手 controller（玩家看不见时物品还能看见）



    this.vrHeldItem = new THREE.Group();



    this.vrHeldItem.position.set(0, -0.06, -0.12);



    this.vrHeldItem.rotation.set(-0.3, 0, 0);



    this.attachVrHeldItem();







    camera.position.set(0, 0, 0);







    camera.rotation.set(0, 0, 0);







    // 双手手柄







    const r = this.host.renderer;







    for (let i = 0; i < 2; i++) {







      const c = r.xr.getController(i);







      this.rig.add(c);







      this.controllers[i] = c;







      const hand = this.buildHand(i === 0 ? 0xe8b88a : 0xe8b88a);







      c.add(hand);







      this.hands[i] = hand;







      c.addEventListener('connected', (e) => {







        this.inputs[i] = (e as unknown as { data: XRInputSource }).data;







        c.visible = true;







      });







      c.addEventListener('disconnected', () => { this.inputs[i] = null; this.triggerHeld[i] = false; });







      c.addEventListener('selectstart', () => { this.triggerHeld[i] = true; this.onSelect(i); });







      c.addEventListener('selectend', () => {



        this.triggerHeld[i] = false;



        // 钓鱼：松扳机抛竿（蓄力中才有动作），抛竿时给震动反馈



        if (this.host.onVrTriggerRelease()) this.pulse(i, 0.6, 80);



      });







      // 激光线（对话选项面板出现时显示，指向哪个选项哪个发光）







      const laser = new THREE.Mesh(







        new THREE.BoxGeometry(0.006, 0.006, 3),







        new THREE.MeshBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.55 }),







      );







      laser.position.set(0, 0, -1.5);







      laser.visible = false;







      c.add(laser);







      this.lasers[i] = laser;







    }







    // 指向对话气泡（指着角色时浮在对方头顶）







    for (let i = 0; i < 2; i++) {







      const cv = document.createElement('canvas');







      cv.width = cv.height = 128;







      const cx = cv.getContext('2d')!;







      cx.font = '92px sans-serif';







      cx.textAlign = 'center';







      cx.textBaseline = 'middle';







      cx.fillText('💬', 64, 68);







      const tex = new THREE.CanvasTexture(cv);







      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));







      sp.scale.setScalar(0.55);







      sp.renderOrder = 999;







      sp.visible = false;







      this.host.scene.add(sp);







      this.talkSprites[i] = sp;







    }







    // 左手腕面板（状态手表：时间/金币/任务/每日任务）







    this.wrist = this.buildWrist();







    this.controllers[0].add(this.wrist);







    // 右手腕"手机"（地图/背包/工具，左手射线点选）







    this.phone = this.buildPhone();







    this.controllers[1].add(this.phone);







    // 悬浮对话面板（懒创建）







    this.refreshToolMesh(true);







  }







  // 把 vrHeldItem 挂到右手 controller（controllers[1]）



  private attachVrHeldItem() {



    if (!this.vrHeldItem) return;



    const rc = this.controllers[1];



    if (!rc) return;



    rc.add(this.vrHeldItem);



    // 同步当前 selectedItem



    const sel = store.state.selectedItem;



    if (sel !== undefined) this.setVrHeld(sel);



  }







  // 更新 VR 时手上物品（game.ts 在 selectItem 后调 setHeldItem 时同时调这里）



  setVrHeld(item: string | null) {



    if (!this.vrHeldItem) return;



    this.vrHeldItem.clear();







    if (!item) return;



    const isFruit = item === 'apple' || item === 'cherry' || item === 'orange' || item === 'peach';
    const isFish = item === 'crucian' || item === 'carp' || item === 'bass' || item === 'koi';



    if (isFruit) this.vrHeldItem.add(makeFruitDrop(item, 0.9));
    else if (isFish) this.vrHeldItem.add(makeItemDrop(item, 0.85)); // 鱼拿外部 GLB 模型（未加载时 fallback 精灵球）
    else this.vrHeldItem.add(makePokeBall(0.85));



  }



















  private teardown() {







    this.active = false;







    this.session = null;







    const { scene, camera } = this.host;







    this.rig.remove(camera);







    scene.remove(this.rig);







    camera.position.set(0, 0, 0);







    camera.rotation.set(0, 0, 0);







    if (this.dialogPanel) { scene.remove(this.dialogPanel); this.dialogPanel = null; }

    if (this.shopPanel) { scene.remove(this.shopPanel); this.shopPanel = null; }







    for (const sp of this.talkSprites) if (sp) { scene.remove(sp); sp.visible = false; }







    this.talkSprites = [];







    for (const pt of this.pointByHand) if ((pt?.kind === 'pickup' || pt?.kind === 'decor') && pt.mesh) pt.mesh.scale.setScalar(1);
    // 装修模式残留清理：还原 interior.group 变换并通知 game 退出装修（防 VR 中途退出残留）
    if (this.decorT > 0) this.host.onDecorExit();
    if (this.decorT !== 0) {
      this.decorIdx = -1; this.decorDrag = false; this.decorDragIdx = -1;
      this.decorGhostClear();
      this.removeDecorGrid();
      const g = this.decorGroup;
      if (g) { g.scale.setScalar(this.decorSaveScale); g.position.copy(this.decorSavePos); g.rotation.y = this.decorSaveRot; }
      this.decorT = 0;
      this.decorGroup = null;
    }







    this.pointByHand = [null, null];







    this.host.renderer.xr.enabled = false;







    // 恢复画质设置







    this.host.renderer.setPixelRatio(this.savedPixelRatio);







    this.host.camera.far = this.savedFar;







    this.host.camera.updateProjectionMatrix();







    const fog = this.host.scene.fog as THREE.Fog | null;







    if (fog && this.savedFog) { fog.near = this.savedFog[0]; fog.far = this.savedFog[1]; this.savedFog = null; }







    this.host.onVREnd();







    store.patch({ vrActive: false });







  }















  // ---------------- 每帧更新（由 Game 主循环调用）----------------





















  // 跑步检测改用双手柄 Y 速度反相关（Godot 算法移植），不再用头部位置







  private leftHandPos = new THREE.Vector3();







  private rightHandPos = new THREE.Vector3();







  update(dt: number, now: number) {







    if (!this.active) return;







    const { camera } = this.host;














    // 世界视线朝向 → 同步给游戏（移动方向/交互判定都靠它）







    camera.getWorldDirection(this.tmpV);







    const viewYaw = Math.atan2(-this.tmpV.x, -this.tmpV.z);
    this.viewYaw = viewYaw; // 缓存给装修迷你房间跟随







    this.host.setViewYaw(viewYaw);







    // 取双手柄当前世界位置 → 喂 MarchDetector（Godot 算法用左右手 Y 速度反相关）







    if (this.controllers[0]) this.controllers[0].getWorldPosition(this.leftHandPos);







    if (this.controllers[1]) this.controllers[1].getWorldPosition(this.rightHandPos);







    this.march.update(this.leftHandPos, this.rightHandPos, now / 1000, dt);







    this.applyLocomotion(viewYaw, dt);







    // 手柄按键（摇杆快速转向 + A/B 切工具）







    this.pollGamepads(dt);







    // 挥臂检测（双手都算；必须扣着该手扳机才命中工具——跑步摆臂不再误触）







    for (let i = 0; i < 2; i++) {







      const c = this.controllers[i];







      if (!c || !c.visible) continue;







      if (this.swings[i].update(c, dt, this.march.speed) && this.triggerHeld[i]) {







        this.host.onVrSwing(this.swings[i].power);







        this.pulse(i, 0.4 + this.swings[i].power * 0.6, 90);







      }







    }







    // 工具模型跟随当前工具







    this.refreshToolMesh();







    // 手腕面板（4Hz 刷新）







    this.wristT -= dt;







    if (this.wristT <= 0) { this.wristT = 0.25; this.drawWrist(); }







    // 右手手机：左手射线悬停 + 定时重绘







    this.updatePhoneHover();







    this.phoneT -= dt;







    this.bagMsgT -= dt;







    if (this.phoneT <= 0) { this.phoneT = 0.25; this.drawPhone(); }







    // 抬腕变亮：面板朝向眼睛时全亮，放下时半透明







    this.updateWristBrightness(this.wrist);







    this.updateWristBrightness(this.phone);







    // 对话/提示面板







    this.updateDialogPanel(viewYaw, dt);

    // VR 3D 商店面板（dom-overlay 失效时的备选方案）

    this.updateShopPanel(viewYaw, dt);







    // 指向拾取：手柄射线指着 8m 内的掉落物 → 高亮 + 激光指引（对话/开店时禁用）







    this.updatePointAim(dt);
    // VR 装修模式（迷你房间沙盘）：补间/跟随/拖拽/幽灵
    this.updateDecor(dt);







  }















  // 主循环在 updatePlayer 之后、渲染之前调用：







  // rig 贴本帧最新玩家位置（否则滞后一帧，转头/移动时场景轻微跟晃）







  syncRig() {







    if (!this.active) return;







    const p = this.host.playerPos;







    this.rig.position.set(p.x, p.y, p.z);







    this.rig.rotation.y = this.snapYaw;







  }















  // ---------------- 指向拾取（VR 代替"走近自动/E键拾取"）----------------







  private updatePointAim(dt: number) {

    const blocked = !!(store.state.dialog || store.state.shopOpen || store.state.phoneOpen);

    // 候选列表 8Hz 重建（池化复用，消除每帧 200+ 临时对象）；射线命中判定每帧复用缓存
    if (blocked) {

      this.aimCands.length = 0;

      this.aimRebuildT = 0;

    } else {

      this.aimRebuildT -= dt;

      if (this.aimRebuildT <= 0) { this.aimRebuildT = 0.125; this.rebuildAimCands(); }

    }

    const cands = this.aimCands;

    for (let hand = 0; hand < 2; hand++) {

      const c = this.controllers[hand];

      let best: PointCand | null = null;

      let bestT = Infinity;

      if (c && c.visible) {

        const origin = c.getWorldPosition(this.tmpA);

        const dir = this.tmpB.set(0, 0, -1).applyQuaternion(c.getWorldQuaternion(this.tmpQ));

        for (let i = 0; i < cands.length; i++) {

          const cd = cands[i];

          this.tmpV.copy(cd.pos).sub(origin);

          const t = this.tmpV.dot(dir);

          if (t < 0.3 || t > 8) continue; // 8 米范围内

          const perp2 = this.tmpV.lengthSq() - t * t;

          if (perp2 < cd.r2 && t < bestT) { bestT = t; best = cd; }

        }

      }

      // 掉落物高亮切换：旧目标恢复大小，新目标放大提示"指住了"（写入稳定槽位，不每帧分配）
      const prev = this.pointByHand[hand];

      if (best) {

        if ((prev?.kind === 'pickup' || prev?.kind === 'decor') && prev.mesh && prev.mesh !== best.mesh) prev.mesh.scale.setScalar(1);

        if (best.kind === 'pickup' && best.mesh) best.mesh.scale.setScalar(1.45);
        if (best.kind === 'decor' && best.mesh) best.mesh.scale.setScalar(1.25);

        let w = this.aimWin[hand];

        if (!w) { w = { kind: 'pickup', id: '', pos: new THREE.Vector3(), top: 0, r2: 0, idx: -1 }; this.aimWin[hand] = w; }

        w.kind = best.kind;

        w.id = best.id;

        w.pos = best.pos;

        w.mesh = best.mesh;

        w.top = best.top;
        w.idx = best.idx;

        this.pointByHand[hand] = w;

      } else {

        if ((prev?.kind === 'pickup' || prev?.kind === 'decor') && prev.mesh) prev.mesh.scale.setScalar(1);

        this.pointByHand[hand] = null;

      }

      // 指着时亮出激光并缩放到目标距离，指哪打哪
      const laser = this.lasers[hand];

      if (laser) {

        if (best) {

          laser.visible = true;

          laser.scale.z = bestT / 3;

          laser.position.z = -bestT / 2;

        } else if (this.hoverByHand[hand] < 0) {

          const shopOn = !!(this.shopPanel && this.shopPanel.visible); // 商店 3D 面板打开 → 激光常亮
          laser.visible = this.decorT > 0 || shopOn; // 装修模式激光常亮（默认长度）

          if (shopOn && this.shopHitDist[hand] > 0) {
            laser.scale.z = this.shopHitDist[hand] / 3;
            laser.position.z = -this.shopHitDist[hand] / 2;
          } else {
            laser.scale.z = 1;
            laser.position.z = -1.5;
          }

        }

      }

      // 指着角色 → 头顶浮 💬 气泡
      const sp = this.talkSprites[hand];

      if (sp) {

        if (best?.kind === 'talk') {

          sp.visible = true;

          sp.position.set(best.pos.x, best.pos.y + best.top + 0.3, best.pos.z);

        } else sp.visible = false;

      }

    }

  }

  // 8Hz 重建候选列表：复用池化槽位，不每帧 new Vector3 / String / 包裹对象
  private rebuildAimCands() {

    const cands = this.aimCands;

    cands.length = 0;

    let ci = 0; // 候选槽位游标

    let vi = 0; // 花/草坐标槽位游标

    const candSlot = (): PointCand => {

      const c = this.aimPool[ci];

      if (!c) { const n = { kind: 'pickup' as const, id: '', pos: new THREE.Vector3(), top: 0, r2: 0 }; this.aimPool[ci] = n; ci++; return n; }

      ci++;

      return c;

    };

    const vecSlot = (): THREE.Vector3 => {

      const v = this.aimVecs[vi];

      if (!v) { const n = new THREE.Vector3(); this.aimVecs[vi] = n; vi++; return n; }

      vi++;

      return v;

    };

    // 装修模式：迷你家具候选（真实房间坐标 → 世界；命中半径 ×S×1.3 放大）
    if (this.decorT >= 1) {
      const S = VRSystem.DECOR_S;
      for (const p of this.host.getPlacedMini()) {
        const c = candSlot();
        const v = vecSlot();
        p.mesh.getWorldPosition(v);
        c.kind = 'decor';
        c.id = String(p.idx);
        c.idx = p.idx;
        c.pos = v;
        c.mesh = p.mesh;
        c.top = 0;
        c.r2 = Math.max(p.r * p.r * S * S * 1.3 * 1.3, 0.004); // 地毯 r=0 给最小命中半径
        cands.push(c);
      }
    }
    // 掉落物：pos/mesh 直接引用世界对象，命中判定每帧拿到最新位置
    if (this.decorT < 1) for (const p of this.host.getPickups()) {

      const c = candSlot();

      c.kind = 'pickup';

      c.id = String(p.id);

      c.pos = p.pos;

      c.mesh = p.mesh;

      c.top = 0;

      c.r2 = 0.36; // 半径 0.6m

      cands.push(c);

    }

    // 花：静态坐标写入池化 Vector3（地面高度在重建时计算一次）
    if (this.decorT < 1) for (const f of this.host.getFlowers()) {

      const c = candSlot();

      const v = vecSlot();

      const fy = this.host.groundY(f.x, f.z);

      v.set(f.x, fy, f.z);

      c.kind = 'flower';

      c.id = String(f.id);

      c.pos = v;

      c.mesh = undefined;

      c.top = fy + 0.6;

      c.r2 = 0.64;

      cands.push(c);

    }

    // 草
    if (this.decorT < 1) for (const w of this.host.getWeeds()) {

      const c = candSlot();

      const v = vecSlot();

      const wy = this.host.groundY(w.x, w.z);

      v.set(w.x, wy, w.z);

      c.kind = 'weed';

      c.id = String(w.id);

      c.pos = v;

      c.mesh = undefined;

      c.top = wy + 0.3;

      c.r2 = 0.49;

      cands.push(c);

    }

    // 对话目标：pos 直接引用角色 group.position，走动时命中判定依然最新
    if (this.decorT < 1) for (const t of this.host.getTalkTargets()) {

      const c = candSlot();

      c.kind = 'talk';

      c.id = t.id;

      c.pos = t.pos;

      c.mesh = undefined;

      c.top = t.top;

      c.r2 = 0.81; // 角色半径 0.9m

      cands.push(c);

    }

  }















  // ---------------- VR 装修模式（迷你房间沙盘）交互层 ----------------
  private static DECOR_S = 0.08;             // 迷你房间缩放系数（16×11m → 1.28×0.88m）

  private enterDecor() {
    if (this.decorT !== 0 || this.host.getInside() !== '你的家') return;
    const group = this.host.getInteriorGroup();
    if (!group) return;
    this.decorGroup = group;
    this.decorSavePos.copy(group.position);
    this.decorSaveRot = group.rotation.y;
    this.decorSaveScale = group.scale.x || 1;
    this.host.onDecorEnter();
    this.ensureDecorGrid();
    this.decorT = 0.01; // 进入补间
    this.pulse(1, 0.5, 60);
    this.drawPhone();
  }

  private exitDecor() {
    if (this.decorT <= 0) return;
    this.decorIdx = -1;
    this.decorDrag = false;
    this.decorDragIdx = -1;
    this.decorGhostClear();
    this.host.onDecorExit();
    this.decorT = -0.01; // 退出补间
    this.pulse(1, 0.5, 60);
    this.drawPhone();
  }

  // 每帧：进入/退出补间 + 激活态跟随玩家 + 拖拽 + 幽灵（由主 update 调用）
  private updateDecor(dt: number) {
    if (this.decorT === 0 && !this.decorDrag && !this.decorGhost) return;
    const group = this.decorGroup ?? this.host.getInteriorGroup();
    if (!group) { this.cleanupDecorExit(); return; }
    this.decorGroup = group;
    const S = VRSystem.DECOR_S;
    const k = Math.min(1, dt * 4); // ≈0.3s 补间（与对话面板 lerp dt*4 一致）
    if (this.decorT > 0) {
      // 目标：玩家面前 0.9m（沿视向）、眼高下方 0.75m、门（+z）朝玩家
      const eyeY = this.host.playerPos.y + (this.host.camera.position.y || 1.5);
      const tx = this.host.playerPos.x - Math.sin(this.viewYaw) * 0.9;
      const ty = eyeY - 0.75;
      const tz = this.host.playerPos.z - Math.cos(this.viewYaw) * 0.9;
      const tRot = this.viewYaw + Math.PI;
      if (this.decorT < 1) {
        group.scale.setScalar(group.scale.x + (S - group.scale.x) * k);
        group.position.x += (tx - group.position.x) * k;
        group.position.y += (ty - group.position.y) * k;
        group.position.z += (tz - group.position.z) * k;
        const d = Math.atan2(Math.sin(tRot - group.rotation.y), Math.cos(tRot - group.rotation.y));
        group.rotation.y += d * k;
        if (Math.abs(group.scale.x - S) < 0.002) { this.decorT = 1; this.snapDecor(group, tx, ty, tz, tRot, S); }
      } else {
        this.snapDecor(group, tx, ty, tz, tRot, S); // 激活态每帧跟随玩家
      }
    } else {
      // 退出补间：还原到进入前
      const tScale = this.decorSaveScale;
      group.scale.setScalar(group.scale.x + (tScale - group.scale.x) * k);
      group.position.x += (this.decorSavePos.x - group.position.x) * k;
      group.position.y += (this.decorSavePos.y - group.position.y) * k;
      group.position.z += (this.decorSavePos.z - group.position.z) * k;
      const d = Math.atan2(Math.sin(this.decorSaveRot - group.rotation.y), Math.cos(this.decorSaveRot - group.rotation.y));
      group.rotation.y += d * k;
      if (Math.abs(group.scale.x - tScale) < 0.002) {
        group.scale.setScalar(tScale);
        group.position.copy(this.decorSavePos);
        group.rotation.y = this.decorSaveRot;
        this.decorT = 0;
        this.cleanupDecorExit();
      }
    }
    // 网格底座跟随迷你房间（略低于地板，呈底座）
    if (this.decorGrid) {
      this.decorGrid.position.set(group.position.x, group.position.y - 0.01, group.position.z);
      this.decorGrid.rotation.y = group.rotation.y;
    }
    // 激活态：拖拽更新 + 幽灵跟随
    if (this.decorT >= 1) {
      this.updateDecorDrag();
      this.updateDecorGhost();
    }
  }

  private snapDecor(group: THREE.Group, tx: number, ty: number, tz: number, tRot: number, S: number) {
    group.scale.setScalar(S);
    group.position.set(tx, ty, tz);
    group.rotation.y = tRot;
  }

  private cleanupDecorExit() {
    this.removeDecorGrid();
    this.decorGhostClear();
    this.decorDrag = false;
    this.decorDragIdx = -1;
    this.decorIdx = -1;
    this.decorGroup = null;
  }

  // 网格底座：1.44×1.44m 半透明网格（0.08m/格 = 1m 房间步长），进入时创建退出时移除
  private ensureDecorGrid() {
    if (this.decorGrid) return;
    const half = 0.72;
    const lines = 18;
    const pts: number[] = [];
    for (let i = 0; i <= lines; i++) {
      const v = -half + i * ((2 * half) / lines);
      pts.push(v, 0, -half, v, 0, half);
      pts.push(-half, 0, v, half, 0, v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const grid = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: 0x8affaa, transparent: true, opacity: 0.35, depthWrite: false,
    }));
    this.host.scene.add(grid);
    this.decorGrid = grid;
  }

  private removeDecorGrid() {
    if (this.decorGrid) {
      this.host.scene.remove(this.decorGrid);
      this.decorGrid.geometry.dispose();
      (this.decorGrid.material as THREE.Material).dispose();
      this.decorGrid = null;
    }
  }

  // 拖拽：左手扳机抓起迷你家具 → 射线打到迷你地板平面（世界 Y = 组位置 y）
  // worldToLocal 已含 S 缩放（组 matrixWorld = T·R·S），得到真实房间坐标 →
  // 0.5m 网格吸附 → 钳制 → 实时改 mesh 局部位置（不重建）；松手写回
  private updateDecorDrag() {
    if (!this.decorDrag) return;
    const c = this.controllers[0];
    const group = this.decorGroup;
    if (!c || !group) { this.decorDrag = false; return; }
    if (!this.triggerHeld[0]) { this.decorDrop(); return; } // 松手
    const mesh = this.decorDragIdx >= 0 ? this.decorMesh(this.decorDragIdx) : null;
    if (!mesh) { this.decorDrag = false; return; }
    const planeY = group.getWorldPosition(this.tmpA).y;
    const origin = c.getWorldPosition(this.tmpB);
    const dir = this.tmpV.set(0, 0, -1).applyQuaternion(c.getWorldQuaternion(this.tmpQ));
    const denom = dir.y;
    if (Math.abs(denom) < 1e-4) return;
    const t = (planeY - origin.y) / denom;
    if (t < 0.05 || t > 4) return;
    const hit = this.tmpV2.copy(origin).addScaledVector(dir, t);
    const local = group.worldToLocal(hit);
    mesh.position.x = this.clampDecorX(Math.round(local.x / 0.5) * 0.5);
    mesh.position.z = this.clampDecorZ(Math.round(local.z / 0.5) * 0.5);
  }

  private decorDrop() {
    this.decorDrag = false;
    if (this.decorDragIdx < 0) return;
    const mesh = this.decorMesh(this.decorDragIdx);
    if (mesh) this.host.onDecorMove(this.decorDragIdx, mesh.position.x, mesh.position.z, mesh.rotation.y);
    this.decorDragIdx = -1;
  }

  // 幽灵：decor:add 后创建半透明克隆跟随左手激光落点；扳机放置（保持可连放）；B 取消
  private decorGhostStart(id: string) {
    this.decorGhostClear();
    const good = GOOD_BY_ID[id];
    if (!good) return;
    const model = modelForGood(good);
    model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!(m as THREE.Mesh).isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!mat) continue;
        mat.transparent = true;
        mat.opacity = 0.6;
        mat.depthWrite = false;
      }
    });
    this.host.scene.add(model);
    this.decorGhost = model;
    this.decorGhostId = id;
  }

  private decorGhostClear() {
    if (this.decorGhost) {
      this.host.scene.remove(this.decorGhost);
      this.decorGhost.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of mats) if (mat) mat.dispose();
      });
      this.decorGhost = null;
    }
    this.decorGhostId = '';
  }

  private updateDecorGhost() {
    if (!this.decorGhost) return;
    const c = this.controllers[0];
    const group = this.decorGroup;
    if (!c || !group) return;
    const S = VRSystem.DECOR_S;
    const planeY = group.getWorldPosition(this.tmpA).y;
    const origin = c.getWorldPosition(this.tmpB);
    const dir = this.tmpV.set(0, 0, -1).applyQuaternion(c.getWorldQuaternion(this.tmpQ));
    const denom = dir.y;
    if (Math.abs(denom) < 1e-4) return;
    const t = (planeY - origin.y) / denom;
    if (t < 0.05 || t > 4) return;
    const hit = this.tmpV2.copy(origin).addScaledVector(dir, t);
    const local = group.worldToLocal(hit);
    const sx = this.clampDecorX(Math.round(local.x / 0.5) * 0.5);
    const sz = this.clampDecorZ(Math.round(local.z / 0.5) * 0.5);
    this.decorGhostPos.set(sx, 0, sz);
    const wp = this.tmpV.copy(this.decorGhostPos); // localToWorld 已含组缩放 S，勿再乘
    const world = group.localToWorld(wp);
    this.decorGhost.position.copy(world);
    this.decorGhost.scale.setScalar(S);
    this.decorGhost.rotation.y = group.rotation.y;
  }

  private decorMesh(idx: number): THREE.Object3D | null {
    const list = this.host.getPlacedMini();
    for (const p of list) if (p.idx === idx) return p.mesh;
    return null;
  }

  private clampDecorX(v: number) { return Math.max(-7, Math.min(7, v)); }
  private clampDecorZ(v: number) { return Math.max(-4.4, Math.min(4.2, v)); }

  // 装修模式 A/B 键：A(4)=旋转选中家具 π/4，B(5)=移除选中（或取消幽灵）
  private decorBtn(n: number, hand: number) {
    if (this.decorGhost) {
      if (n === 5) { this.decorGhostClear(); this.pulse(hand, 0.4, 40); }
      return;
    }
    if (this.decorIdx < 0) return;
    const mesh = this.decorMesh(this.decorIdx);
    if (n === 4) {
      if (!mesh) return;
      mesh.rotation.y += Math.PI / 4;
      if (!this.decorDrag) this.host.onDecorMove(this.decorIdx, mesh.position.x, mesh.position.z, mesh.rotation.y);
      this.pulse(hand, 0.4, 40);
    } else if (n === 5) {
      this.decorDrag = false;
      this.decorDragIdx = -1;
      const idx = this.decorIdx;
      this.decorIdx = -1;
      this.host.onDecorRemove(idx);
      this.pulse(hand, 0.5, 50);
    }
  }

  // ---------------- 原地踏步 → 写入触摸输入通道（复用现有移动/碰撞逻辑）----------------







  private applyLocomotion(viewYaw: number, dt: number) {







    // 装修迷你房间期间锁定原地踏步移动（进入补间~激活）
    if (this.decorT > 0) {
      const touch = this.host.touch;
      touch.dx = 0; touch.dy = 0; touch.run = false;
      void viewYaw; void dt;
      return;
    }
    const speed = this.march.speed;







    const touch = this.host.touch;







    if (speed <= 0) { touch.dx = 0; touch.dy = 0; touch.run = false; return; }







    // camYaw 已由 setViewYaw 同步成头部朝向：iz=-1 即朝面前方向走







    const f = Math.min(1, speed / 3.8);







    touch.dx = 0;







    touch.dy = -f;







    touch.run = this.march.running;







    void dt; void viewYaw;







  }















  // ---------------- 手柄按键轮询（摇杆导航手腕页面，不做快速转向） ----------------







  private btnPrev: Record<string, boolean> = {};







  private stickCd = 0;







  private wristPage: 'status' | 'quest' | 'weekly' | 'dex' = 'status'; // 左手腕页面







  private phonePages = ['map', 'bag', 'tool', 'decor', 'skill', 'award'] as const; // 右手手机六页







  private selMode = false;   // 手机选项模式（下摇进入）







  private selIdx = 0;        // 选项光标







  private pollGamepads(dt: number) {







    this.stickCd -= dt;







    for (let i = 0; i < 2; i++) {







      const src = this.inputs[i];







      const gp = src?.gamepad;







      if (!gp) continue;







      // 扳机状态轮询同步（双保险：selectend 事件丢失时仍能正确松开）







      this.triggerHeld[i] = !!gp.buttons[0]?.pressed;







      const ax = gp.axes[2] ?? gp.axes[0] ?? 0;







      const ay = gp.axes[3] ?? gp.axes[1] ?? 0;







      if (this.stickCd <= 0) {







        if (i === 0) {







          // 左手摇杆：左右翻左手腕页面







          if (Math.abs(ax) > 0.6) {







            this.wristPage = this.wristPage === 'status' ? 'quest' : this.wristPage === 'quest' ? 'weekly' : this.wristPage === 'weekly' ? 'dex' : 'status';







            this.stickCd = 0.25;







            this.pulse(0, 0.2, 25);







            this.drawWrist();







          }







        } else {







          // 右手摇杆：翻手机页 / 选项模式导航







          if (!this.selMode) {







            if (Math.abs(ax) > 0.6) {







              const idx = this.phonePages.indexOf(this.phoneTab);







              const next = (idx + (ax > 0 ? 1 : -1) + this.phonePages.length) % this.phonePages.length;







              this.phoneTab = this.phonePages[next];







              this.stickCd = 0.25;







              this.pulse(1, 0.2, 25);







              this.drawPhone();







            } else if (ay > 0.6) {







              // 下摇：进入选项模式







              if (this.pageItems().length > 0) {







                this.selMode = true;







                this.selIdx = 0;







                this.stickCd = 0.25;







                this.pulse(1, 0.3, 35);







                this.drawPhone();







              }







            }







          } else {







            const items = this.pageItems();







            if (Math.abs(ax) > 0.6 && items.length > 0) {







              this.selIdx = (this.selIdx + (ax > 0 ? 1 : -1) + items.length) % items.length;







              this.stickCd = 0.2;







              this.pulse(1, 0.15, 20);







              this.drawPhone();







            } else if (ay < -0.6) {







              // 上摇：确认当前选项







              const btn = items[this.selIdx];







              if (btn) this.execPhoneBtn(btn.action);







              this.selMode = false;







              this.stickCd = 0.25;







            } else if (ay > 0.6) {







              // 再下摇：退出选项模式







              this.selMode = false;







              this.stickCd = 0.25;







              this.drawPhone();







            }







          }







        }







      }







      // A(4)/B(5) 切换工具（保留）







      const pressed = (n: number) => !!gp.buttons[n]?.pressed;







      const key = (n: number) => `${i}:${n}`;







      for (const [n, dir] of [[4, 1], [5, -1]] as [number, number][]) {







        if (pressed(n) && !this.btnPrev[key(n)]) {
          if (this.decorT > 0) this.decorBtn(n, i);
          else this.host.onCycleTool(dir);
        }







        this.btnPrev[key(n)] = pressed(n);







      }







    }







  }















  // 当前手机页可选项（选项模式导航范围）







  private pageItems() {







    const prefix = this.phoneTab === 'bag' ? 'item:' : this.phoneTab === 'tool' ? 'tool:' : this.phoneTab === 'decor' ? 'decor:' : '@none@';







    return this.phoneBtns.filter(b => b.action.startsWith(prefix));







  }















  // 扳机：左手优先点手机按钮；对话开着 = 点按钮/下一句；否则 = 通用交互







  private onSelect(hand: number) {







    this.pulse(hand, 0.3, 40);

    // VR 3D 商店面板：激光指向按钮扣扳机 → 直接 push 商店命令

    if (store.state.shopOpen && !this.domOverlayOk) {

      const idx = this.shopHoverByHand[hand];

      if (idx >= 0 && this.shopBtnRects[idx]) {

        const [cmd, a1, a2] = this.shopBtnRects[idx].command.split(':');

        if (cmd === 'buy') commands.push({ type: 'buy', item: a1, price: Number(a2) });

        else if (cmd === 'sell') commands.push({ type: 'sell', item: a1 });

        else if (cmd === 'sellAll') commands.push({ type: 'sellAll' });

        else if (cmd === 'closeShop') commands.push({ type: 'closeShop' });

        this.pulse(hand, 0.5, 60);

      }

      return;

    }







    // 右手扳机 + 手机选项模式 = 确认光标项







    if (hand === 1 && this.selMode) {







      const items = this.pageItems();







      const b = items[this.selIdx];







      if (b) this.execPhoneBtn(b.action);







      this.selMode = false;







      this.pulse(1, 0.5, 60);







      return;







    }







    // 左手扳机 = 点手机上指到的按钮







    if (hand === 0 && this.phoneHover >= 0 && this.phoneBtns[this.phoneHover]) {







      this.execPhoneBtn(this.phoneBtns[this.phoneHover].action);







      this.pulse(0, 0.5, 60);







      return;







    }







    // 装修模式：点选迷你家具（hand=0 抓起拖拽；挂画仅选中）或放置幽灵
    if (this.decorT >= 1) {
      if (this.decorGhost) {
        const n = this.host.getInventory().find(([id]) => id === this.decorGhostId)?.[1] ?? 0;
        if (n <= 0) { this.decorGhostClear(); return; }
        this.host.onDecorAdd(this.decorGhostId, this.decorGhostPos.x, this.decorGhostPos.z);
        this.pulse(hand, 0.6, 60);
        return; // 保持幽灵可连放
      }
      const pt = this.pointByHand[hand];
      if (pt && pt.kind === 'decor' && pt.idx !== undefined && pt.mesh) {
        this.decorIdx = pt.idx;
        if (hand === 0 && pt.mesh.position.y <= 0.5) {
          // 落地家具：抓起拖拽
          this.decorDrag = true;
          this.decorDragIdx = pt.idx;
          this.pulse(hand, 0.5, 50);
        } else {
          // 挂画（MVP：仅选中，可 A 旋转 / B 移除，不沿墙拖拽）或右手点选
          this.pulse(hand, 0.4, 40);
        }
        return;
      }
    }
    const dlg = store.state.dialog;







    if (dlg) {







      if (dlg.actions?.length) {







        // 激光指到选项的那只手才能确认







        const idx = this.hoverByHand[hand];







        if (idx >= 0 && this.btnRects[idx]) {







          commands.push({ type: 'dialogAction', command: this.btnRects[idx].command });







        }







      } else {







        commands.push({ type: 'closeDialog' });







      }







      return;







    }







    // 指着 8m 内目标：掉落物 → 放入背包；角色 → 对话







    const pt = this.pointByHand[hand];







    if (pt) {







      if (pt.kind === 'talk') this.host.onPointTalk(pt.id);

      else if (pt.kind === 'flower') this.host.onPointFlower(+pt.id);

      else if (pt.kind === 'weed') this.host.onPointWeed(+pt.id);

      else this.host.onPointPickup(+pt.id);







      this.pulse(hand, 0.6, 60);







      return;







    }







    this.host.onVrTrigger();







  }















  // ---------------- 震动反馈 ----------------







  pulse(hand: number, amp: number, ms: number) {







    const src = this.inputs[hand];







    const act = (src?.gamepad as unknown as { hapticActuators?: { pulse(a: number, m: number): void }[] })?.hapticActuators?.[0];







    try { act?.pulse(Math.min(1, amp), ms); } catch { /* ignore */ }







  }















  // ---------------- 手部模型（像素风方块手）----------------







  private buildHand(skin: number) {







    const g = new THREE.Group();







    const skinMat = new THREE.MeshLambertMaterial({ color: skin });







    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x4a90d9 });







    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.11), skinMat);







    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.05), skinMat);







    thumb.position.set(0.055, 0, 0.02);







    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.07), sleeveMat);







    sleeve.position.set(0, 0, 0.1);







    g.add(palm, thumb, sleeve);







    return g;







  }















  // 右手工具模型（跟着当前选中工具换）







  private refreshToolMesh(force = false) {







    const tool = store.state.tool;







    if (!force && tool === this.currentTool) return;







    this.currentTool = tool;







    const hand = this.hands[1];







    if (!hand) return;







    if (this.toolMesh) { hand.remove(this.toolMesh); this.toolMesh = null; }







    if (tool === 'hand') return;







    const g = new THREE.Group();







    const wood = new THREE.MeshLambertMaterial({ color: 0x8a6239 });







    const metal = new THREE.MeshLambertMaterial({ color: 0x9ab0c9 });







    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.5), wood);







    handle.position.z = -0.2;







    g.add(handle);







    if (tool === 'axe') {







      const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), metal);







      head.position.set(0.06, 0, -0.42);







      g.add(head);







    } else if (tool === 'shovel') {







      const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.16), metal);







      head.position.set(0, 0, -0.5);







      g.add(head);







    } else if (tool === 'net') {







      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 12), wood);







      ring.position.set(0, 0, -0.5);







      const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.15, 10), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));







      mesh.position.set(0, 0, -0.5);







      g.add(ring, mesh);







    } else if (tool === 'rod') {







      handle.scale.z = 1.8;







      const line = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.5), new THREE.MeshBasicMaterial({ color: 0xdddddd }));







      line.position.set(0, -0.02, -0.85);







      g.add(line);







    }







    this.toolMesh = g;







    hand.add(g);







  }















  // ---------------- 防眩晕暗角 ----------------







  // ---------------- 左手腕面板（状态手表） ----------------







  private buildWrist() {







    const c = document.createElement('canvas');







    c.width = 512; c.height = 384;







    this.wristCtx = c.getContext('2d')!;







    this.wristTex = new THREE.CanvasTexture(c);







    const m = new THREE.Mesh(







      new THREE.PlaneGeometry(0.2, 0.15),







      new THREE.MeshBasicMaterial({ map: this.wristTex, transparent: true }),







    );







    // 贴在左手背上方，抬腕可见







    m.position.set(0, 0.075, 0.09);







    m.rotation.x = -Math.PI / 3;







    return m;







  }















  private drawWrist() {







    const ctx = this.wristCtx;



    ctx.save();



    ctx.scale(512 / 384, 512 / 384); // 384×288 虚拟坐标放大到 512×384 画布







    const s = store.state;







    ctx.clearRect(0, 0, 384, 288);







    ctx.fillStyle = 'rgba(20,28,40,0.92)';







    ctx.beginPath();







    ctx.roundRect(0, 0, 384, 288, 20);







    ctx.fill();







    ctx.fillStyle = '#ffe9a8';







    ctx.font = 'bold 36px sans-serif';







    ctx.fillText(s.timeText, 18, 46);







    ctx.font = '22px sans-serif';







    ctx.fillStyle = '#cfe3ff';







    ctx.fillText(s.dateText, 170, 44);







    ctx.fillStyle = '#f7d774';







    ctx.font = 'bold 26px sans-serif';







    ctx.fillText(`💰 ${s.bells}`, 18, 86);







    // 页标







    ctx.fillStyle = '#5a6a82';







    ctx.font = '18px sans-serif';







    ctx.fillText(this.wristPage === 'status' ? '状态 1/4 ⟷' : this.wristPage === 'quest' ? '任务 2/4 ⟷' : this.wristPage === 'weekly' ? '周常 3/4 ⟷' : '图鉴 4/4 ⟷', 290, 30);







    if (this.wristPage === 'status') {







      // 步速表







      ctx.fillStyle = this.march.speed > 0.1 ? '#8aff8a' : '#8899aa';







      ctx.font = 'bold 24px sans-serif';







      ctx.fillText(`🚶 ${this.march.speed.toFixed(1)}`, 300, 86);














      const toolName: Record<string, string> = { hand: '✋ 空手', net: '🥅 捕虫网', rod: '🎣 钓竿', shovel: '⛏️ 铲子', axe: '🪓 斧头' };







      ctx.fillStyle = '#b8e6b8';







      ctx.font = 'bold 26px sans-serif';







      ctx.fillText(toolName[s.tool] ?? s.tool, 18, 140);







    } else if (this.wristPage === 'quest') {







      // 任务页：当前目标 + 每日任务







      let y = 126;







      if (s.quest) {







        ctx.fillStyle = s.quest.ready ? '#8aff8a' : '#ffd9a0';







        ctx.font = 'bold 22px sans-serif';







        ctx.fillText(`📌 ${s.quest.title} ${s.quest.progress}/${s.quest.need}`, 18, y);







        y += 34;







      }







      for (const t of s.daily.slice(0, 3)) {







        ctx.fillStyle = t.done ? '#7fd97f' : '#c8d4e0';







        ctx.font = '20px sans-serif';







        ctx.fillText(`${t.done ? '✅' : '▫️'} ${t.icon} ${t.text} ${Math.min(t.progress, t.need)}/${t.need}`, 18, y);







        y += 32;







      }







    } else if (this.wristPage === 'weekly') {


      // 周常页：本周任务（数据源 store.state.weekly，与手机成就页同源）


      if (s.weekly.length === 0) {


        ctx.fillStyle = '#8fa8c8';


        ctx.font = 'bold 20px sans-serif';


        ctx.fillText('📅 本周暂无任务', 18, 140);


      } else {


        ctx.fillStyle = '#ffd76a';


        ctx.font = 'bold 20px sans-serif';


        ctx.fillText('📅 本周任务（完成得积分）', 18, 132);


        let wy = 172;


        for (const t of s.weekly.slice(0, 3)) {


          ctx.fillStyle = t.done ? '#7fd97f' : '#c8d4e0';


          ctx.font = 'bold 19px sans-serif';


          ctx.fillText(`${t.done ? '✅' : '▫️'} ${t.icon} ${t.text} ${Math.min(t.progress, t.need)}/${t.need}`, 18, wy);


          ctx.fillStyle = t.done ? '#9fe8b8' : '#6a7f9a';


          ctx.font = '14px sans-serif';


          ctx.fillText(`+${t.reward} 积分`, 300, wy);


          wy += 34;


        }


      }


    } else {


      // 图鉴页（完整版单页）：4 类全部物品（✅/▫️）+ 进度条 + 下一档奖励（原手机完整版精简搬入）


      const dexSet = new Set(s.dex);


      const firstSet = new Set(s.firstFlags);


      const dGroups: { kind: string; icon: string; name: string; ids: string[] }[] = [
        { kind: 'bug', icon: '🦋', name: '昆虫', ids: ['butterfly', 'tigerfly', 'dragonfly', 'firefly'] },
        { kind: 'fish', icon: '🐟', name: '鱼类', ids: ['crucian', 'carp', 'bass', 'koi'] },
        { kind: 'mineral', icon: '⛏️', name: '矿物', ids: ['ore_copper', 'ore_iron', 'ore_gold', 'diamond'] },
        { kind: 'flower', icon: '🌸', name: '花卉', ids: ['flower_red', 'flower_yellow', 'flower_white'] },
      ];


      const dM: Record<string, { tiers: { need: number; key: number; bells?: number; miles?: number }[] }> = {
        bug:     { tiers: [{ need: 2, key: 1, bells: 300 }, { need: 3, key: 3, miles: 400 }, { need: 4, key: 2, miles: 800 }] },
        fish:    { tiers: [{ need: 2, key: 1, bells: 400 }, { need: 3, key: 3, miles: 500 }, { need: 4, key: 2, miles: 800 }] },
        mineral: { tiers: [{ need: 2, key: 1, bells: 500 }, { need: 3, key: 3, miles: 600 }, { need: 4, key: 2, miles: 1000 }] },
        flower:  { tiers: [{ need: 1, key: 1, bells: 300 }, { need: 2, key: 3, miles: 400 }, { need: 3, key: 2, miles: 600 }] },
      };


      const dGot = (kind: string, id: string) => (kind === 'bug' || kind === 'fish') ? dexSet.has(id) : firstSet.has(id);


      const dTotal = dGroups.reduce((n, g) => n + g.ids.length, 0);


      const dCollected = dGroups.reduce((n, g) => n + g.ids.filter(id => dGot(g.kind, id)).length, 0);


      ctx.fillStyle = '#8fa8c8';


      ctx.font = 'bold 20px sans-serif';


      ctx.fillText(`📖 图鉴　已收集 ${dCollected}/${dTotal}`, 18, 128);


      // 双列：左列昆虫/鱼类，右列矿物/花卉；每类标题行（名称 + 进度条），区内物品 2 个一排


      dGroups.forEach((g, i) => {


        const colX = i < 2 ? 18 : 200;


        const gy = i % 2 === 0 ? 152 : 204;


        const cnt = g.ids.filter(id => dGot(g.kind, id)).length;


        const t = g.ids.length;


        ctx.fillStyle = '#ffd76a';


        ctx.font = 'bold 15px sans-serif';


        ctx.fillText(`${g.icon} ${g.name} ${cnt}/${t}`, colX, gy);


        // 进度条（标题行右侧）


        ctx.fillStyle = '#233250';


        ctx.beginPath();


        ctx.roundRect(colX + 100, gy - 10, 75, 8, 4);


        ctx.fill();


        ctx.fillStyle = '#4ade80';


        ctx.beginPath();


        ctx.roundRect(colX + 100, gy - 10, Math.max(8, 75 * cnt / t), 8, 4);


        ctx.fill();


        // 区内物品：2 个一排（✅ 已收集 / ▫️ 未收集）


        g.ids.forEach((id, k) => {


          const has = dGot(g.kind, id);


          const ix = colX + (k % 2) * 82;


          ctx.fillStyle = has ? '#7ee08a' : '#4a5870';


          ctx.font = 'bold 13px sans-serif';


          ctx.fillText(`${has ? '✅' : '▫️'} ${ITEMS[id]?.name ?? id}`, ix, gy + 20 + Math.floor(k / 2) * 18);


        });


      });


      // 底部一行：下一档奖励（按类别顺序取第一个未领取的里程碑）


      let dNext: { g: (typeof dGroups)[number]; tier: { need: number; key: number; bells?: number; miles?: number } } | null = null;


      for (const g of dGroups) {


        const tier = dM[g.kind]?.tiers.find(t => !firstSet.has(`m_${g.kind}_${t.key}`));


        if (tier) { dNext = { g, tier }; break; }


      }


      ctx.fillStyle = dNext ? '#9fe8b8' : '#ffd76a';


      ctx.font = 'bold 12px sans-serif';


      ctx.fillText(


        dNext


          ? `下一奖励：${dNext.g.name} 收集 ${dNext.tier.need}/${dNext.g.ids.length} 种 → ${dNext.tier.bells ?? dNext.tier.miles}${dNext.tier.bells !== undefined ? '金币' : '积分'}`


          : '🏆 全收集完成！奖励已领取',


        18, 268


      );


    }







    if (s.prompt) {







      ctx.fillStyle = '#ffffff';







      ctx.font = '20px sans-serif';







      ctx.fillText(s.prompt.slice(0, 16), 18, 276);







    }







    this.wristTex.needsUpdate = true;







    ctx.restore();







  }















  // ---------------- 右手腕"手机"（地图/背包/工具） ----------------







  private buildPhone() {







    const c = document.createElement('canvas');







    c.width = 512; c.height = 720;







    this.phoneCtx = c.getContext('2d')!;







    this.phoneTex = new THREE.CanvasTexture(c);







    const m = new THREE.Mesh(







      new THREE.PlaneGeometry(0.17, 0.24),







      new THREE.MeshBasicMaterial({ map: this.phoneTex, transparent: true }),







    );







    m.position.set(0, 0.085, 0.09);







    m.rotation.x = -Math.PI / 3;







    return m;







  }















  private drawPhone() {







    const ctx = this.phoneCtx;



    ctx.save();



    ctx.scale(1, 1); // 画布 512×720，与绘制坐标系一致











    const s = store.state;







    ctx.clearRect(0, 0, 512, 720);







    ctx.fillStyle = 'rgba(18,26,38,0.94)';







    ctx.beginPath();







    ctx.roundRect(0, 0, 512, 720, 26);







    ctx.fill();







    this.phoneBtns = [];







    // 顶部标签页（三页）







    const tabs: [string, 'map' | 'bag' | 'tool' | 'decor' | 'skill' | 'award'][] = [['🗺️ 地图', 'map'], ['🎒 背包', 'bag'], ['🔧 工具', 'tool'], ['🏠 装修', 'decor'], ['🎣 技能', 'skill'], ['🏆 成就', 'award']];







    tabs.forEach(([label, tab], i) => {







      const bx = 5 + i * 84, by = 14, bw = 80, bh = 54; // 六页：等宽排布







      const active = this.phoneTab === tab;







      const hover = this.phoneHover === this.phoneBtns.length;







      ctx.fillStyle = hover ? '#5a7fd9' : active ? '#3a5aa8' : '#2a3a52';







      ctx.beginPath();







      ctx.roundRect(bx, by, bw, bh, 12);







      ctx.fill();







      if (hover) { ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 4; ctx.stroke(); }







      ctx.fillStyle = '#ffffff';







      ctx.font = 'bold 16px sans-serif';







      ctx.fillText(label, bx + 6, by + 35);







      this.phoneBtns.push({ x: bx, y: by, w: bw, h: bh, action: `tab:${tab}` });







    });







    if (this.phoneTab === 'map') this.drawPhoneMap(ctx, s);







    else if (this.phoneTab === 'bag') this.drawPhoneBag(ctx, s);
    else if (this.phoneTab === 'decor') this.drawPhoneDecor(ctx);
    else if (this.phoneTab === 'skill') this.drawPhoneSkill(ctx, s);
    else if (this.phoneTab === 'award') this.drawPhoneAward(ctx, s);







    else this.drawPhoneTool(ctx, s);







    this.phoneTex.needsUpdate = true;







    ctx.restore();







  }















  // 按钮高亮逻辑：选项模式看光标，否则看左手射线







  private btnGlow(btnIndex: number, itemIdx: number) {







    if (this.selMode) return itemIdx === this.selIdx;







    return this.phoneHover === btnIndex;







  }















  private drawPhoneMap(ctx: CanvasRenderingContext2D, s: typeof store.state) {



    // 地图图片（游戏内地图同一张）





    if (s.mapImage && s.mapImage !== this.mapImgSrc) {







      this.mapImgSrc = s.mapImage;







      this.mapImg = new Image();







      this.mapImg.src = s.mapImage;







    }







    if (this.mapImg?.complete) {







      ctx.imageSmoothingEnabled = false;







      ctx.drawImage(this.mapImg, 16, 86, 480, 480);







    }







    // 玩家位置红点（世界坐标 ±96 → 地图 480px）







    const px = ((s.mapPlayer.x + 96) / 192) * 480 + 16;







    const pz = ((s.mapPlayer.z + 96) / 192) * 480 + 86;







    ctx.fillStyle = '#ff4444';







    ctx.beginPath();







    ctx.arc(px, pz, 8, 0, Math.PI * 2);







    ctx.fill();







    ctx.strokeStyle = '#ffffff';







    ctx.lineWidth = 3;







    ctx.stroke();







    // 宝可梦实时位置（名字+彩色点；视距 35m，靠地图找人）







    for (const m of this.host.getMapMarkers()) {







      const mx = ((m.x + 96) / 192) * 480 + 16;







      const mz = ((m.z + 96) / 192) * 480 + 86;







      ctx.fillStyle = m.color;







      ctx.beginPath();







      ctx.arc(mx, mz, 6, 0, Math.PI * 2);







      ctx.fill();







      ctx.strokeStyle = '#1a2433';







      ctx.lineWidth = 2;







      ctx.stroke();







      ctx.font = 'bold 14px sans-serif';







      ctx.lineWidth = 3;







      ctx.strokeStyle = 'rgba(10,16,26,0.9)';







      ctx.strokeText(m.name, mx + 9, mz + 5);







      ctx.fillStyle = '#ffffff';







      ctx.fillText(m.name, mx + 9, mz + 5);







    }







    ctx.fillStyle = '#8fa8c8';







    ctx.font = '20px sans-serif';







    ctx.fillText(`${s.islandName || '小岛'} · ${s.timeText}`, 18, 600);













  }















  private drawPhoneBag(ctx: CanvasRenderingContext2D, _s: typeof store.state) {



    const inv = this.host.getInventory().filter(([, n]) => n > 0);







    ctx.fillStyle = '#8fa8c8';







    ctx.font = 'bold 20px sans-serif';







    ctx.fillText('物品（左手指点选 / 摇杆下摇进入选择）', 18, 106);







    let itemIdx = 0;







    const slots = this.host.getBagSlots();

    const rows = Math.ceil(slots / 4);

    const pitchY = Math.max(78, Math.min(108, Math.floor((668 - 122) / rows)));

    inv.slice(0, slots).forEach(([id, n], i) => {







      const col = i % 4, row = Math.floor(i / 4);







      const bx = 18 + col * 120, by = 122 + row * pitchY, bw = 108, bh = Math.max(60, pitchY - 14);







      const btnIdx = this.phoneBtns.length;







      const glow = this.btnGlow(btnIdx, itemIdx);







      ctx.fillStyle = glow ? '#5a7fd9' : '#2a3a52';







      ctx.beginPath();







      ctx.roundRect(bx, by, bw, bh, 12);







      ctx.fill();







      if (glow) { ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 4; ctx.stroke(); }







      const item = ITEMS[id];







      const iconPx = Math.max(22, Math.min(40, bh - 26));







      ctx.font = `${iconPx}px sans-serif`;

      ctx.fillText(item?.icon ?? '❓', bx + 10, by + 24 + Math.round(iconPx * 0.7));







      ctx.fillStyle = '#ffffff';







      ctx.font = 'bold 24px sans-serif';







      ctx.fillText(`×${n}`, bx + 52, by + bh - 12);







      this.phoneBtns.push({ x: bx, y: by, w: bw, h: bh, action: `item:${id}` });







      itemIdx++;







    });







    if (!inv.length) {







      ctx.fillStyle = '#8fa8c8';







      ctx.font = '22px sans-serif';







      ctx.fillText('背包空空如也', 18, 160);







    }







    // 底部说明行（点选物品后显示）







    // 悬停/选中物品名提示：激光指向背包格（或选项模式光标）→ 底部显示物品名
    let tipId: string | null = null;


    if (this.selMode) {


      const si = Math.min(this.selIdx, slots - 1);


      const s = inv[si];


      if (s) tipId = s[0];


    } else if (this.phoneHover >= 0) {


      const hb = this.phoneBtns[this.phoneHover];


      if (hb && hb.action.startsWith('item:')) tipId = hb.action.slice(5);


    }


    // 底部提示行：优先显示点选物品说明（bagMsg），否则显示激光 hover / 光标选中的物品名
    let bottomTxt: string | null = null;


    if (this.bagMsgT > 0 && this.bagMsg) bottomTxt = this.bagMsg.slice(0, 26);


    else if (tipId) bottomTxt = `🎒 选中：${ITEMS[tipId]?.name ?? tipId}`;


    if (bottomTxt) {


      ctx.fillStyle = 'rgba(10,16,28,0.85)';


      ctx.beginPath();


      ctx.roundRect(18, 676, 476, 40, 10);


      ctx.fill();


      ctx.fillStyle = '#ffe9a8';


      ctx.font = 'bold 20px sans-serif';


      ctx.fillText(bottomTxt, 30, 704);


    }













  }



  // 技能页：四个生活技能（钓鱼/捉虫/挖矿/园艺），等级 + 经验条 + 被动说明（参照图鉴页布局）
  private drawPhoneSkill(ctx: CanvasRenderingContext2D, s: typeof store.state) {
    const steps = [20, 50, 90, 140, 200]; // 与 game.ts LEVEL_STEPS 一致
    const skills: { key: string; icon: string; name: string; passive: (lv: number) => string }[] = [
      { key: 'fish', icon: '🎣', name: '钓鱼', passive: lv => `收杆效率 +${lv * 5}%（偶尔一下多拉 1 点）` },
      { key: 'bug', icon: '🦋', name: '捉虫', passive: lv => `捉虫距离 +${Math.round(lv * 6)}%` },
      { key: 'mine', icon: '⛏️', name: '挖矿', passive: lv => `双倍掉落概率 +${lv * 5}%` },
      { key: 'garden', icon: '🌱', name: '园艺', passive: lv => `果实再生加快 ${lv * 10} 秒` },
    ];
    ctx.fillStyle = '#8fa8c8';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('🎣 技能　多干活就能升级', 18, 106);

    let y = 148;
    for (const sk of skills) {
      const st = s.skills[sk.key] ?? { xp: 0, lv: 0 };
      const next = st.lv < steps.length ? steps[st.lv] : -1;
      const prev = st.lv === 0 ? 0 : steps[st.lv - 1];
      const pct = next > 0 ? Math.min(100, Math.max(0, Math.round(((st.xp - prev) / (next - prev)) * 100))) : 100;
      // 卡片背景
      ctx.fillStyle = '#233250';
      ctx.beginPath();
      ctx.roundRect(18, y, 476, 118, 14);
      ctx.fill();
      // 图标
      ctx.fillStyle = '#ffffff';
      ctx.font = '34px sans-serif';
      ctx.fillText(sk.icon, 30, y + 46);
      // 名称 + 等级
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`${sk.name}  Lv.${st.lv}`, 78, y + 38);
      // 经验值（右对齐）
      ctx.fillStyle = '#9fe8b8';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(next > 0 ? `${st.xp} / ${next}` : '⭐ 已满级', 478, y + 38);
      ctx.textAlign = 'left';
      // 经验条
      ctx.fillStyle = '#152036';
      ctx.beginPath();
      ctx.roundRect(78, y + 48, 400, 12, 6);
      ctx.fill();
      ctx.fillStyle = next > 0 ? '#a78bfa' : '#fbbf24';
      ctx.beginPath();
      ctx.roundRect(78, y + 48, Math.max(12, Math.round(400 * pct / 100)), 12, 6);
      ctx.fill();
      // 被动说明
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(st.lv > 0 ? `被动：${sk.passive(st.lv)}` : `升级解锁：${sk.passive(1)}`, 78, y + 92);
      y += 118 + 16;
    }
  }

  // 成就页：生涯累计成就列表（参照图鉴页布局，每行 icon + 名字 + 状态/进度；10 行以内正好一屏）
  private drawPhoneAward(ctx: CanvasRenderingContext2D, s: typeof store.state) {
    const achSet = new Set(s.unlockedAch);
    // 图鉴收集总数（虫+鱼走 dex，矿物/花走 firstFlags），与 game.ts dexCount 一致
    const dexSet = new Set(s.dex);
    const firstSet = new Set(s.firstFlags);
    const extraIds = ['ore_copper', 'ore_iron', 'ore_gold', 'diamond', 'flower_red', 'flower_yellow', 'flower_white'];
    const dexTotal = dexSet.size + extraIds.filter(id => firstSet.has(id)).length;

    ctx.fillStyle = '#8fa8c8';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`🏆 成就　已解锁 ${achSet.size} / ${ACHIEVEMENTS.length}`, 18, 106);

    let y = 142;
    for (const a of ACHIEVEMENTS) {
      const unlocked = achSet.has(a.id);
      const val = a.cond === 'dex' ? dexTotal : (s.stats[a.cond] ?? 0);
      // 卡片背景
      ctx.fillStyle = unlocked ? '#2a3a52' : '#1a2334';
      ctx.beginPath();
      ctx.roundRect(18, y, 476, 50, 12);
      ctx.fill();
      // 图标 / 锁
      ctx.fillStyle = '#ffffff';
      ctx.font = '28px sans-serif';
      ctx.fillText(unlocked ? a.icon : '🔒', 28, y + 34);
      // 名字
      ctx.fillStyle = unlocked ? '#ffffff' : '#8fa0b8';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(`${unlocked ? '🏆 ' : ''}${a.name}`, 70, y + 30);
      // 状态/进度（右对齐）
      ctx.textAlign = 'right';
      if (unlocked) {
        ctx.fillStyle = '#ffd76a';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`+${a.reward} 积分`, 478, y + 30);
      } else {
        ctx.fillStyle = '#7ee08a';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(`${Math.min(val, a.need)}/${a.need}`, 478, y + 30);
      }
      ctx.textAlign = 'left';
      y += 56;
    }
  }

  // 工具页：五个工具大按钮（独立一页，解决工具看不到的问题）







  private drawPhoneTool(ctx: CanvasRenderingContext2D, s: typeof store.state) {



    const tools: [string, string, string][] = [







      ['hand', '✋', '空手'], ['net', '🥅', '捕虫网'], ['rod', '🎣', '钓竿'], ['shovel', '⛏️', '铲子'], ['axe', '🪓', '斧头'],







    ];







    ctx.fillStyle = '#8fa8c8';







    ctx.font = 'bold 20px sans-serif';







    ctx.fillText('点选即装备（摇杆下摇进入选择）', 18, 106);







    let itemIdx = 0;







    tools.forEach(([t, icon, name], i) => {







      const col = i % 3, row = Math.floor(i / 3);







      const bx = 18 + col * 162, by = 122 + row * 200, bw = 150, bh = 180;







      const unlocked = this.host.hasTool(t);







      const active = s.tool === t;







      const btnIdx = this.phoneBtns.length;







      const glow = this.btnGlow(btnIdx, itemIdx);







      ctx.fillStyle = glow ? '#5a7fd9' : active ? '#3a6a48' : '#2a3a52';







      ctx.beginPath();







      ctx.roundRect(bx, by, bw, bh, 16);







      ctx.fill();







      if (glow) { ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 5; ctx.stroke(); }







      ctx.globalAlpha = unlocked ? 1 : 0.25;







      ctx.font = '72px sans-serif';







      ctx.fillText(icon, bx + 38, by + 96);







      ctx.font = 'bold 26px sans-serif';







      ctx.fillStyle = '#ffffff';







      ctx.fillText(name, bx + 30, by + 150);







      ctx.globalAlpha = 1;







      if (unlocked) {







        this.phoneBtns.push({ x: bx, y: by, w: bw, h: bh, action: `tool:${t}` });







        itemIdx++;







      }







    });







    // 当前手持







    const cur = tools.find(([t]) => t === s.tool);







    ctx.fillStyle = '#8aff8a';







    ctx.font = 'bold 24px sans-serif';







    ctx.fillText(`当前：${cur?.[1] ?? ''} ${cur?.[2] ?? s.tool}`, 18, 560);











  }















  // 装修页：进入/退出按钮 + 家具网格（添加）+ 墙纸/地板列表 + 操作说明
  private drawPhoneDecor(ctx: CanvasRenderingContext2D) {
    const atHome = this.host.getInside() === '你的家';
    const active = this.decorT !== 0;
    let itemIdx = 0;
    const inv = this.host.getInventory().filter(([, n]) => n > 0);
    const furn = inv.filter(([id]) => {
      const g = GOOD_BY_ID[id];
      return g && g.cat === 'furniture' && g.shape !== 'wallpaper' && g.shape !== 'flooring';
    });
    const deco = inv.filter(([id]) => {
      const g = GOOD_BY_ID[id];
      return g && (g.shape === 'wallpaper' || g.shape === 'flooring');
    });
    // 顶部：进入/退出装修（非自己家时禁用并提示）
    if (!atHome) {
      ctx.fillStyle = '#e8a0a0';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('仅可在自己家装修', 18, 112);
      ctx.fillStyle = '#8fa8c8';
      ctx.font = '20px sans-serif';
      ctx.fillText('在「你的家」里打开本页即可', 18, 142);
    } else {
      const bx = 18, by = 84, bw = 476, bh = 58;
      const glow = this.btnGlow(this.phoneBtns.length, itemIdx);
      ctx.fillStyle = active ? '#a8563a' : glow ? '#5a7fd9' : '#2f6a48';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 12);
      ctx.fill();
      if (glow) { ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 4; ctx.stroke(); }
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(active ? '🏠 退出装修（保存）' : '🛠️ 进入装修', bx + 138, by + 39);
      this.phoneBtns.push({ x: bx, y: by, w: bw, h: bh, action: active ? 'decor:exit' : 'decor:enter' });
      itemIdx++;
    }
    if (!active) {
      ctx.fillStyle = '#8fa8c8';
      ctx.font = '20px sans-serif';
      ctx.fillText('进入后：激光点选家具，扳机拖拽，A 旋转，B 移除', 18, 640);
      ctx.fillText('网格吸附 0.5m · 墙纸/地板即时生效', 18, 668);
      return;
    }
    // 中部：库存家具网格（可添加）
    ctx.fillStyle = '#8fa8c8';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`家具（点选后扳机放置 ×${furn.length}）`, 18, 160);
    furn.slice(0, 8).forEach(([id, n], i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const bx = 18 + col * 120, by = 172 + row * 100, bw = 108, bh = 90;
      const btnIdx = this.phoneBtns.length;
      const glow = this.btnGlow(btnIdx, itemIdx);
      ctx.fillStyle = glow ? '#5a7fd9' : '#2a3a52';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 12);
      ctx.fill();
      if (glow) { ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 4; ctx.stroke(); }
      const g = GOOD_BY_ID[id];
      ctx.font = '38px sans-serif';
      ctx.fillText(g?.icon ?? '❓', bx + 10, by + 48);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`×${n}`, bx + 62, by + 76);
      this.phoneBtns.push({ x: bx, y: by, w: bw, h: bh, action: `decor:add:${id}` });
      itemIdx++;
    });
    if (!furn.length) {
      ctx.fillStyle = '#8fa8c8';
      ctx.font = '20px sans-serif';
      ctx.fillText('背包里没有可摆放的家具', 18, 200);
    }
    // 下部：墙纸 / 地板列表（点击即时生效）
    ctx.fillStyle = '#8fa8c8';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`墙纸 / 地板（×${deco.length}）`, 18, 392);
    deco.slice(0, 8).forEach(([id, n], i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const bx = 18 + col * 120, by = 404 + row * 100, bw = 108, bh = 90;
      const btnIdx = this.phoneBtns.length;
      const glow = this.btnGlow(btnIdx, itemIdx);
      ctx.fillStyle = glow ? '#5a7fd9' : '#2a3a52';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 12);
      ctx.fill();
      if (glow) { ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 4; ctx.stroke(); }
      const g = GOOD_BY_ID[id];
      ctx.font = '38px sans-serif';
      ctx.fillText(g?.icon ?? '❓', bx + 10, by + 48);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`×${n}`, bx + 62, by + 76);
      const kind = g?.shape === 'flooring' ? 'floor' : 'wall';
      this.phoneBtns.push({ x: bx, y: by, w: bw, h: bh, action: `decor:${kind}:${g?.set ?? ''}` });
      itemIdx++;
    });
    // 底部操作说明
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '20px sans-serif';
    ctx.fillText('A 旋转 · B 移除 · 扳机拖拽 · 网格 0.5m', 18, 628);
    ctx.fillStyle = '#8fa8c8';
    ctx.fillText('选家具后点「decor:add」可连放；B 取消幽灵', 18, 656);
    ctx.fillText('墙纸/地板点击即时生效', 18, 684);
  }

  private execPhoneBtn(action: string) {







    const [kind, payload] = action.split(':');







    if (kind === 'tab') { this.phoneTab = payload as 'map' | 'bag' | 'tool' | 'decor' | 'skill' | 'award'; this.selMode = false; }







    else if (kind === 'decor') {
      // decor:enter / decor:exit / decor:add:<id> / decor:wall:<set> / decor:floor:<set>
      const [act, arg] = payload.split(':');
      if (act === 'enter') this.enterDecor();
      else if (act === 'exit') this.exitDecor();
      else if (act === 'add' && this.decorT > 0) this.decorGhostStart(arg);
      else if (act === 'wall' && this.decorT > 0) this.host.onDecorSet('wall', arg);
      else if (act === 'floor' && this.decorT > 0) this.host.onDecorSet('floor', arg);
    }
    else if (kind === 'tool') this.host.onSelectTool(payload);







    else if (kind === 'item') {



      const item = ITEMS[payload];



      const n = this.host.getInventory().find(([id]) => id === payload)?.[1] ?? 0;



      this.bagMsg = item ? `${item.icon} ${item.name} ×${n}　${item.desc ?? ''}` : '';



      this.bagMsgT = 5;



      // 背包点选物品 → 发 selectItem 命令，物品才能拿在手上 / 被吃掉 / 播种



      commands.push({ type: 'selectItem', item: payload });



    }









  }















  // 左手柄射线指向右手手机 → 命中按钮序号







  private updatePhoneHover() {







    this.phoneHover = -1;







    const c = this.controllers[0];







    if (!c || !this.phone) return;







    const hit = this.raycastPanel(c, this.phone, 0.17, 0.24);







    if (!hit) return;







    const u = hit[0] * 512, v = hit[1] * 720;







    this.phoneBtns.forEach((b, i) => {







      if (u >= b.x && u <= b.x + b.w && v >= b.y && v <= b.y + b.h) this.phoneHover = i;







    });







  }















  // 手柄射线与面板求交，返回 uv（0~1）







  private raycastPanel(ctrl: THREE.Object3D, panel: THREE.Object3D, w: number, h: number): [number, number] | null {







    const origin = ctrl.getWorldPosition(this.tmpA);







    const dir = ctrl.getWorldDirection(this.tmpB).negate();







    const normal = this.tmpV.set(0, 0, 1).applyQuaternion(panel.getWorldQuaternion(this.tmpQ));







    const pw = panel.getWorldPosition(this.tmpV2);







    const denom = dir.dot(normal);







    if (Math.abs(denom) < 1e-4) return null;







    const t = pw.sub(origin).dot(normal) / denom;







    if (t < 0 || t > 1.5) return null;







    const hitP = origin.add(dir.multiplyScalar(t));







    // 面板局部坐标（考虑父级变换）







    const inv = this.tmpM4.copy(panel.matrixWorld).invert();







    const local = hitP.applyMatrix4(inv);







    const u = local.x / w + 0.5, v = 0.5 - local.y / h;







    if (u < -0.1 || u > 1.1 || v < -0.1 || v > 1.1) return null;







    return [u, v];







  }















  // 抬腕变亮：面板朝向玩家眼睛时全亮







  private updateWristBrightness(panel: THREE.Mesh) {







    const normal = this.tmpV.set(0, 0, 1).applyQuaternion(panel.getWorldQuaternion(this.tmpQ));







    const toEye = this.host.camera.getWorldPosition(this.tmpA).sub(panel.getWorldPosition(this.tmpB)).normalize();







    const facing = Math.max(0, normal.dot(toEye));







    (panel.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.5 * facing;







  }















  // ---------------- 悬浮对话面板 ----------------







  private ensureDialogPanel() {







    if (this.dialogPanel) return;







    const c = document.createElement('canvas');







    c.width = 512; c.height = 256;







    this.dialogCtx = c.getContext('2d')!;







    this.dialogTex = new THREE.CanvasTexture(c);







    const g = new THREE.Group();







    const m = new THREE.Mesh(







      new THREE.PlaneGeometry(1.3, 0.65),







      new THREE.MeshBasicMaterial({ map: this.dialogTex, transparent: true, depthTest: false }),







    );







    m.renderOrder = 998;







    g.add(m);







    this.dialogPanel = g;







    this.host.scene.add(g);







  }















  private updateDialogPanel(viewYaw: number, dt: number) {







    const s = store.state;







    const content = s.dialog ?? s.toast;







    if (!content) {







      if (this.dialogPanel) this.dialogPanel.visible = false;







      this.dialogKey = '';







      return;







    }







    this.ensureDialogPanel();







    const p = this.dialogPanel!;







    p.visible = true;







    // 面板放在玩家前方 2.2m、视线高度，缓慢跟随视线（不锁死，避免压迫感）







    const { playerPos, camera } = this.host;







    const eyeY = playerPos.y + (camera.position.y || 1.5);







    const tx = playerPos.x - Math.sin(viewYaw) * 2.0;







    const tz = playerPos.z - Math.cos(viewYaw) * 2.0;







    p.position.x += (tx - p.position.x) * Math.min(1, dt * 4);







    // 面板放在胸口高度：视线稍向下看，不会挡住面前宝可梦的脸







    p.position.y += (eyeY - 0.55 - p.position.y) * Math.min(1, dt * 4);







    p.position.z += (tz - p.position.z) * Math.min(1, dt * 4);







    p.rotation.y = Math.atan2(playerPos.x - p.position.x, playerPos.z - p.position.z);







    // 内容变了才重绘







    const key = JSON.stringify(content) + this.hoverBtn;







    if (key !== this.dialogKey) {







      this.dialogKey = key;







      this.drawDialog(content as { name?: string; text?: string; actions?: { label: string; command: string }[]; title?: string; icon?: string; desc?: string });







    }







    // 右手射线指向按钮 → 高亮







    this.updateHover();







  }



















  private drawDialog(d: { name?: string; text?: string; actions?: { label: string; command: string }[]; title?: string; icon?: string; desc?: string }) {







    const ctx = this.dialogCtx;







    ctx.save();



    ctx.scale(0.5, 0.5); // 贴图从 1024×512 降到 512×256，所有坐标 ×0.5 缩放



    ctx.clearRect(0, 0, 1024, 512);







    ctx.fillStyle = 'rgba(255,250,238,0.97)';







    ctx.beginPath();







    ctx.roundRect(0, 0, 1024, 512, 28);







    ctx.fill();







    ctx.strokeStyle = '#d9b98a';







    ctx.lineWidth = 6;







    ctx.stroke();







    this.btnRects = [];







    if (d.title !== undefined) {







      // toast







      ctx.font = 'bold 56px sans-serif';







      ctx.fillStyle = '#5a4632';







      ctx.fillText(`${d.icon ?? ''} ${d.title}`, 48, 90);







      ctx.font = '38px sans-serif';







      ctx.fillStyle = '#7a6a52';







      ctx.fillText(d.desc ?? '', 48, 160);







    } else {







      ctx.font = 'bold 44px sans-serif';







      ctx.fillStyle = '#a87f4e';







      ctx.fillText(d.name ?? '', 48, 72);







      ctx.fillStyle = '#4a3a28';







      ctx.font = '36px sans-serif';







      // 手动换行







      const text = d.text ?? '';







      let y = 140;







      for (const rawLine of text.split('\n')) {







        let line = '';







        for (const ch of rawLine) {







          if (ctx.measureText(line + ch).width > 920) { ctx.fillText(line, 48, y); y += 50; line = ''; }







          line += ch;







        }







        ctx.fillText(line, 48, y);







        y += 50;







      }







      // 按钮







      const acts = d.actions ?? [];







      acts.forEach((a, i) => {







        const bw = Math.max(280, ctx.measureText(a.label).width + 60);







        const bx = 48 + i * 0; // 竖排







        const by = 512 - 20 - (acts.length - i) * 78;







        ctx.fillStyle = i === this.hoverBtn ? '#f2a65a' : '#e8d5b5';







        ctx.beginPath();







        ctx.roundRect(bx, by, Math.min(bw, 920), 64, 14);







        ctx.fill();







        ctx.fillStyle = '#4a3a28';







        ctx.font = 'bold 32px sans-serif';







        ctx.fillText(a.label, bx + 26, by + 44);







        this.btnRects.push({ x: bx, y: by, w: Math.min(bw, 920), h: 64, command: a.command });







      });







      if (!acts.length) {







        ctx.fillStyle = '#a89880';







        ctx.font = '28px sans-serif';







        ctx.fillText('（扣扳机继续）', 700, 480);







      }







    }







    this.dialogTex.needsUpdate = true;







    ctx.restore();



  }



















  // ---------------- VR 3D 商店面板（drawShop）----------------
  // DOM Overlay 在 Quest 的 immersive-vr 会话大概率不生效 → 商店面板改用 3D canvas 渲染。
  // 复用 btnRects / raycastPanel / onSelect 机制，点按钮直接 push 已有的 buy/sell/sellAll/closeShop 命令。

  private ensureShopPanel() {
    if (this.shopPanel) return;
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    this.shopCtx = c.getContext('2d')!;
    this.shopTex = new THREE.CanvasTexture(c);
    const g = new THREE.Group();
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: this.shopTex, transparent: true, depthTest: false }),
    );
    m.renderOrder = 998;
    g.add(m);
    this.shopPanel = g;
    this.host.scene.add(g);
  }

  private updateShopPanel(viewYaw: number, dt: number) {
    const s = store.state;
    if (!s.shopOpen || this.domOverlayOk) {
      if (this.shopPanel) this.shopPanel.visible = false;
      this.shopKey = '';
      this.shopHoverByHand = [-1, -1];
      return;
    }
    this.ensureShopPanel();
    const p = this.shopPanel!;
    p.visible = true;

    // 面板放在玩家前方 2m、视线略下方，缓慢跟随视线（与对话面板一致）
    const { playerPos, camera } = this.host;
    const eyeY = playerPos.y + (camera.position.y || 1.5);
    const tx = playerPos.x - Math.sin(viewYaw) * 2.0;
    const tz = playerPos.z - Math.cos(viewYaw) * 2.0;
    p.position.x += (tx - p.position.x) * Math.min(1, dt * 4);
    p.position.y += (eyeY - 0.65 - p.position.y) * Math.min(1, dt * 4);
    p.position.z += (tz - p.position.z) * Math.min(1, dt * 4);
    p.rotation.y = Math.atan2(playerPos.x - p.position.x, playerPos.z - p.position.z);

    this.updateShopHover();
    const key = JSON.stringify([s.shopLine, s.bells, s.hotDeal, s.shopGoods, s.inventory]) + JSON.stringify(this.shopHoverByHand);
    if (key !== this.shopKey) { this.shopKey = key; this.drawShop(); }
  }

  // 双手柄射线与商店面板求交 → 命中按钮下标（哪只手指的哪只手确认）
  private updateShopHover() {
    this.shopHoverByHand = [-1, -1];
    this.shopHitDist = [-1, -1];
    const p = this.shopPanel;
    if (!p || !p.visible) return;
    for (let hand = 0; hand < 2; hand++) {
      const c = this.controllers[hand];
      if (!c) continue;
      const origin = c.getWorldPosition(this.tmpA);
      const dir = c.getWorldDirection(this.tmpV2).negate(); // 手柄朝向前方为 -z
      const normal = this.tmpB.set(0, 0, 1).applyQuaternion(p.quaternion);
      const toPanel = this.tmpV.copy(p.position).sub(origin);
      const denom = dir.dot(normal);
      if (Math.abs(denom) < 1e-4) continue;
      const t = toPanel.dot(normal) / denom;
      if (t < 0 || t > 6) continue;
      this.shopHitDist[hand] = t; // 激光按面板距离收尾，tip 落在面板上
      const hit = this.tmpB.copy(origin).addScaledVector(dir, t);
      const local = p.worldToLocal(hit);
      // plane 1.5 x 1.5 → 虚拟画布 1024×1024
      const u = (local.x / 1.5 + 0.5) * 1024;
      const v = (0.5 - local.y / 1.5) * 1024;
      this.shopBtnRects.forEach((b, i) => {
        if (u >= b.x && u <= b.x + b.w && v >= b.y && v <= b.y + b.h && this.shopHoverByHand[hand] < 0) {
          this.shopHoverByHand[hand] = i;
        }
      });
    }
  }

  // 绘制商店面板（虚拟 1024×1024，ctx.scale(0.5)）：标题/关闭 + 高价横幅 + 今日商品 2 列 + 背包出售 4 列
  private drawShop() {
    const s = store.state;
    const ctx = this.shopCtx;
    ctx.save();
    ctx.scale(0.5, 0.5);
    ctx.clearRect(0, 0, 1024, 1024);

    // 背景
    ctx.fillStyle = 'rgba(255,250,238,0.97)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 1024, 1024, 28);
    ctx.fill();
    ctx.strokeStyle = '#d9b98a';
    ctx.lineWidth = 6;
    ctx.stroke();

    this.shopBtnRects = [];

    // 标题行 + 铃钱 + 关闭按钮
    ctx.fillStyle = '#a87f4e';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('⚡ 友好商店', 40, 66);
    ctx.fillStyle = '#7a6a52';
    ctx.font = '26px sans-serif';
    ctx.fillText(s.shopLine, 40, 108);
    ctx.fillStyle = '#b8860b';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`💰 ${s.bells} 金币`, 720, 66);
    ctx.fillStyle = '#f2a65a';
    ctx.beginPath();
    ctx.roundRect(948, 28, 52, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#4a3a28';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('✕', 963, 67);
    this.shopBtnRects.push({ x: 948, y: 28, w: 52, h: 52, command: 'closeShop' });

    // 今日高价收购横幅
    let goodsY = 168;
    if (s.hotDeal) {
      ctx.fillStyle = '#fdeaea';
      ctx.beginPath();
      ctx.roundRect(40, 130, 944, 52, 12);
      ctx.fill();
      ctx.fillStyle = '#c0392b';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`🔥 今日高价收购：${s.hotDeal.icon} ${s.hotDeal.label}（1.5 倍）`, 60, 164);
      goodsY = 210;
    }

    // 今日商品（2 列网格）
    ctx.fillStyle = '#5a4632';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('🛒 今日商品', 40, goodsY + 8);
    const goodsTop = goodsY + 28;
    s.shopGoods.forEach((g, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const bx = 40 + col * 492, by = goodsTop + row * 104;
      const idx = this.shopBtnRects.length;
      const hover = this.shopHoverByHand.some(h => h === idx);
      ctx.fillStyle = hover ? '#d8f0d8' : '#ffffff';
      ctx.beginPath();
      ctx.roundRect(bx, by, 472, 88, 16);
      ctx.fill();
      ctx.strokeStyle = '#a7d7a7';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#4a3a28';
      ctx.font = '42px sans-serif';
      ctx.fillText(ITEMS[g.id]?.icon ?? g.icon, bx + 22, by + 60);
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(ITEMS[g.id]?.name ?? g.name, bx + 92, by + 42);
      ctx.fillStyle = '#b8860b';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`${g.price} 金币`, bx + 92, by + 74);
      this.shopBtnRects.push({ x: bx, y: by, w: 472, h: 88, command: `buy:${g.id}:${g.price}` });
    });

    // 出售（背包）：可卖物品 4 列网格，最多显示 8 种（MVP）
    const priceOf = (id: string) => {
      const base = ITEMS[id]?.price ?? 0;
      return s.hotDeal && ITEMS[id]?.category === s.hotDeal.cat ? Math.round(base * 1.5) : base;
    };
    const sellable = Object.entries(s.inventory).filter(([id]) => (ITEMS[id]?.price ?? 0) > 0).slice(0, 8);
    const totalValue = sellable.reduce((sum, [id, n]) => sum + priceOf(id) * n, 0);

    const sellHeadY = goodsTop + Math.ceil(s.shopGoods.length / 2) * 104 + 20;
    ctx.fillStyle = '#5a4632';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('💰 出售（背包）', 40, sellHeadY);
    const allIdx = this.shopBtnRects.length;
    const allHover = this.shopHoverByHand.some(h => h === allIdx);
    ctx.fillStyle = allHover ? '#e8a13a' : '#f2b45c';
    ctx.beginPath();
    ctx.roundRect(700, sellHeadY - 34, 284, 48, 24);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`全部卖出 +${totalValue}`, 724, sellHeadY - 2);
    this.shopBtnRects.push({ x: 700, y: sellHeadY - 34, w: 284, h: 48, command: 'sellAll' });

    const bagTop = sellHeadY + 26;
    if (!sellable.length) {
      ctx.fillStyle = '#a89880';
      ctx.font = '26px sans-serif';
      ctx.fillText('背包空空如也……去摘果子、钓鱼、抓虫吧！', 40, bagTop + 40);
    } else {
      sellable.forEach(([id, n], i) => {
        const col = i % 4, row = Math.floor(i / 4);
        const bx = 40 + col * 244, by = bagTop + row * 96;
        const idx = this.shopBtnRects.length;
        const hover = this.shopHoverByHand.some(h => h === idx);
        ctx.fillStyle = hover ? '#fdeed2' : '#ffffff';
        ctx.beginPath();
        ctx.roundRect(bx, by, 228, 82, 14);
        ctx.fill();
        ctx.strokeStyle = '#e5d5b5';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#4a3a28';
        ctx.font = '34px sans-serif';
        ctx.fillText(ITEMS[id]?.icon ?? '❔', bx + 14, by + 50);
        ctx.font = 'bold 24px sans-serif';
        const hot = s.hotDeal && ITEMS[id]?.category === s.hotDeal.cat;
        ctx.fillText(`${ITEMS[id]?.name ?? id} ×${n}${hot ? ' 🔥' : ''}`, bx + 62, by + 36);
        ctx.fillStyle = '#b8860b';
        ctx.font = '22px sans-serif';
        ctx.fillText(`${priceOf(id) * n} 金币`, bx + 62, by + 66);
        this.shopBtnRects.push({ x: bx, y: by, w: 228, h: 82, command: `sell:${id}` });
      });
      if (Object.entries(s.inventory).filter(([id]) => (ITEMS[id]?.price ?? 0) > 0).length > 8) {
        ctx.fillStyle = '#a89880';
        ctx.font = '24px sans-serif';
        ctx.fillText('可卖物品较多，VR 里只显示前 8 种（回桌面可卖全部）', 40, bagTop + 96 * 2 + 34);
      }
    }

    // 底部提示
    ctx.fillStyle = '#a89880';
    ctx.font = '24px sans-serif';
    ctx.fillText('激光指向商品后扣扳机：购买 / 卖出；右上 ✕ 关闭商店', 40, 980);

    this.shopTex.needsUpdate = true;
    ctx.restore();
  }

  // 双手柄激光射线与对话面板求交 → 命中按钮高亮（哪只手指的哪只手确认）







  private updateHover() {







    this.hoverBtn = -1;







    this.hoverByHand = [-1, -1];







    const panel = this.dialogPanel;







    const showLaser = this.decorT > 0 || !!(panel && panel.visible && this.btnRects.length > 0) || !!(this.shopPanel && this.shopPanel.visible); // 装修模式激光常亮；商店面板同样显示激光







    for (const l of this.lasers) if (l) l.visible = showLaser;







    if (!panel || !panel.visible) return;







    for (let hand = 0; hand < 2; hand++) {







      const c = this.controllers[hand];







      if (!c) continue;







      const origin = c.getWorldPosition(this.tmpA);







      const dir = c.getWorldDirection(this.tmpV2).negate(); // 手柄朝向前方为 -z







      const normal = this.tmpB.set(0, 0, 1).applyQuaternion(panel.quaternion);







      const toPanel = this.tmpV.copy(panel.position).sub(origin);







      const denom = dir.dot(normal);







      if (Math.abs(denom) < 1e-4) continue;







      const t = toPanel.dot(normal) / denom;







      if (t < 0 || t > 6) continue;







      const hit = this.tmpB.copy(origin).addScaledVector(dir, t);







      const local = panel.worldToLocal(hit);







      // plane 1.3 x 0.65 → uv







      const u = (local.x / 1.3 + 0.5) * 1024;







      const v = (0.5 - local.y / 0.65) * 512;







      this.btnRects.forEach((b, i) => {







        if (u >= b.x && u <= b.x + b.w && v >= b.y && v <= b.y + b.h) {







          this.hoverByHand[hand] = i;







          if (this.hoverBtn < 0) this.hoverBtn = i;







        }







      });







    }







  }







}