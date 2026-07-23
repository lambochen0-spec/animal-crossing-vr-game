// ---------------- VR 模式（WebXR）----------------

// 第一人称视角 + 双手 + 原地踏步移动 + 挥臂用工具 + 手腕面板 + 悬浮对话

// 防眩晕：移动时隧道视野（暗角）、45° 快速转向（无平滑旋转）、平滑加减速

import * as THREE from 'three';

import { store, commands } from './store';

import { ITEMS } from './data';

import { makeFruitDrop, makePokeBall } from './items3d';



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

  onCycleTool(dir: number): void;  // A/B 键切换工具

  onVRStart(): void;               // 进入 VR（隐藏玩家模型等）

  onVREnd(): void;                 // 退出 VR

  touch: { dx: number; dy: number; run: boolean }; // 移动输入通道（复用现有碰撞逻辑）

  getInventory(): [string, number][]; // 背包物品（右手"手机"显示用）

  onSelectTool(tool: string): void;   // 手机上点选工具

  hasTool(tool: string): boolean;     // 工具是否已解锁

  getPickups(): { id: number; pos: THREE.Vector3; mesh: THREE.Object3D }[]; // 地面掉落物（指向拾取用）

  onPointPickup(id: number): void;    // 手柄指着掉落物扣扳机 → 放入背包

  getTalkTargets(): { id: string; pos: THREE.Vector3; top: number }[]; // 可对话角色（指向对话用）

  onPointTalk(id: string): void;      // 手柄指着角色扣扳机 → 对话

  getMapMarkers(): { name: string; x: number; z: number; color: string }[]; // 宝可梦实时位置（手机地图页）

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

  update(leftPos: THREE.Vector3, rightPos: THREE.Vector3, t: number, dt: number, _pitch = 0) {

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

  private phoneTab: 'map' | 'bag' | 'tool' = 'map';

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

  private tmpV = new THREE.Vector3();

  private tmpV2 = new THREE.Vector3();

  // 指向交互：每只手指着的目标（掉落物 = 拾取；角色 = 对话）

  private pointByHand: ({ kind: 'pickup' | 'talk'; id: string; pos: THREE.Vector3; mesh?: THREE.Object3D; top: number } | null)[] = [null, null];

  private triggerHeld = [false, false];   // 扳机按住状态（挥臂命中工具的前置条件）

  private talkSprites: THREE.Sprite[] = [];   // 指着角色时头顶的 💬 气泡

  private tmpQ = new THREE.Quaternion();

  private tmpA = new THREE.Vector3();

  private tmpB = new THREE.Vector3();



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

      const session = await xr.requestSession('immersive-vr', {

        optionalFeatures: ['local-floor', 'bounded-floor'],

      });

      this.session = session;

      const r = this.host.renderer;

      r.xr.enabled = true;

      r.xr.setReferenceSpaceType('local-floor');

      // VR 减负：降渲染分辨率。视距不动（用户对游戏视野有强偏好，宁可糊不愿小）。

      this.savedPixelRatio = r.getPixelRatio();

      r.setPixelRatio(Math.min(0.65, this.savedPixelRatio));

      this.savedFar = this.host.camera.far;
      this.host.camera.far = 40; // VR 砍远裁剪到 40m：雾不动，用户偏好
      const fog = this.host.scene.fog as THREE.Fog | null;
      if (fog) { this.savedFog = [fog.near, fog.far]; } // 雾保留不变

      await r.xr.setSession(session);

      // 固定注视点渲染：周边自然模糊（0=无, 1=中, 2=强, 3=最强）。VR 转头时周边本来就会糊，

      // foveation 把这种"转头边缘糊"做成视觉默认状态——动态降低中心分辨率感觉就不明显。

      (r.xr as unknown as { setFoveation?: (f: number) => void }).setFoveation?.(2);

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



  private savedPixelRatio = 1;

  private entering = false;

  // VR 专属物品显示：玩家 group.visible=false 让 heldItem 不可见，
  // VR 时把物品移到右手 controller（rig 子物体）→ 永远可见
  private vrHeldItem: THREE.Group | null = null;
  private vrHeldId: string | null = null;

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

      c.addEventListener('selectend', () => { this.triggerHeld[i] = false; });

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
    const sel = this.host.getSelectedItem?.();
    if (sel !== undefined) this.setVrHeld(sel);
  }

  // 更新 VR 时手上物品（game.ts 在 selectItem 后调 setHeldItem 时同时调这里）
  setVrHeld(item: string | null) {
    if (!this.vrHeldItem) return;
    this.vrHeldItem.clear();
    this.vrHeldId = item;
    if (!item) return;
    const isFruit = item === 'apple' || item === 'cherry' || item === 'orange' || item === 'peach';
    this.vrHeldItem.add(isFruit ? makeFruitDrop(item, 0.9) : makePokeBall(0.85));
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

    for (const sp of this.talkSprites) if (sp) { scene.remove(sp); sp.visible = false; }

    this.talkSprites = [];

    for (const pt of this.pointByHand) if (pt?.kind === 'pickup' && pt.mesh) pt.mesh.scale.setScalar(1);

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

  private drAcc = 0; private drN = 0; private drCd = 0; private curPR = 0.65;

  private lastAvgMs = 0; // 最近平均帧时间（左腕状态页显示用）

  // 跑步检测改用双手柄 Y 速度反相关（Godot 算法移植），不再用头部位置

  private leftHandPos = new THREE.Vector3();

  private rightHandPos = new THREE.Vector3();

  update(dt: number, now: number) {

    if (!this.active) return;

    const { camera } = this.host;

    // 动态分辨率：按"用户移动速度"为主信号（用户体感的延迟来自"画面跟不上运动"，

    // 站着不动时帧率再差也没事，跑动时才需要降像素比防闪烁），帧时间为辅助兜底。

    // 速度档位（march.speed 范围 0~3.8 m/s）：

    //   < 0.3 m/s  几乎不动 → 0.65 满画质

    //   0.3~1.0    慢走     → 0.55

    //   1.0~2.5    快走     → 0.45

    //   > 2.5      跑步     → 0.35

    // 帧时间兜底：avg > 40ms 强制降到 0.3；avg < 14ms 允许小幅回升

    const userSpeed = this.march.speed;

    let targetPR = 0.65;

    if (userSpeed > 2.5) targetPR = 0.35;

    else if (userSpeed > 1.0) targetPR = 0.45;

    else if (userSpeed > 0.3) targetPR = 0.55;

    // 帧时间兜底（每 2 秒采样一次，10 帧平均）

    this.drAcc += dt; this.drN++; this.drCd -= dt;

    if (this.drCd <= 0 && this.drN > 10) {

      const avg = this.drAcc / this.drN;

      this.drAcc = 0; this.drN = 0; this.drCd = 2;

      this.lastAvgMs = avg * 1000;

      if (avg > 0.040) targetPR = Math.min(targetPR, 0.3); // 兜底：50ms 强制降到 0.3

      else if (avg < 0.014) targetPR = Math.min(0.65, targetPR + 0.05); // 帧宽裕小幅回升

    }

    // 阶梯式切换像素比：每帧采样目标值，但只在差超过 0.05 时才更新，避免 setPixelRatio 频繁调用

    // + 非整数像素比造成 GPU texture 重分配抖动

    if (Math.abs(targetPR - this.curPR) > 0.05) {

      this.curPR = targetPR;

      this.host.renderer.setPixelRatio(this.curPR);

    }

    // 世界视线朝向 → 同步给游戏（移动方向/交互判定都靠它）

    camera.getWorldDirection(this.tmpV);

    const viewYaw = Math.atan2(-this.tmpV.x, -this.tmpV.z);

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

    // 指向拾取：手柄射线指着 8m 内的掉落物 → 高亮 + 激光指引（对话/开店时禁用）

    this.updatePointAim();

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

  private updatePointAim() {

    const blocked = !!(store.state.dialog || store.state.shopOpen || store.state.phoneOpen);

    type Cand = { kind: 'pickup' | 'talk'; id: string; pos: THREE.Vector3; mesh?: THREE.Object3D; top: number; r2: number };

    let cands: Cand[] = [];

    if (!blocked) {

      cands = this.host.getPickups().map(p => ({ kind: 'pickup' as const, id: String(p.id), pos: p.pos, mesh: p.mesh, top: 0, r2: 0.36 })); // 半径 0.6m

      for (const t of this.host.getTalkTargets()) {

        cands.push({ kind: 'talk', id: t.id, pos: t.pos, top: t.top, r2: 0.81 }); // 角色半径 0.9m

      }

    }

    const next: ({ kind: 'pickup' | 'talk'; id: string; pos: THREE.Vector3; mesh?: THREE.Object3D; top: number } | null)[] = [null, null];

    for (let hand = 0; hand < 2; hand++) {

      const c = this.controllers[hand];

      let best: Cand | null = null;

      let bestT = Infinity;

      if (c && c.visible) {

        const origin = c.getWorldPosition(this.tmpA);

        const dir = this.tmpB.set(0, 0, -1).applyQuaternion(c.getWorldQuaternion(this.tmpQ));

        for (const cd of cands) {

          this.tmpV.copy(cd.pos).sub(origin);

          const t = this.tmpV.dot(dir);

          if (t < 0.3 || t > 8) continue; // 8 米范围内

          const perp2 = this.tmpV.lengthSq() - t * t;

          if (perp2 < cd.r2 && t < bestT) { bestT = t; best = cd; }

        }

      }

      next[hand] = best;

      // 指着时亮出激光并缩放到目标距离，指哪打哪

      const laser = this.lasers[hand];

      if (laser) {

        if (best) {

          laser.visible = true;

          laser.scale.z = bestT / 3;

          laser.position.z = -bestT / 2;

        } else if (this.hoverByHand[hand] < 0) {

          laser.visible = false;

          laser.scale.z = 1;

          laser.position.z = -1.5;

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

    // 掉落物高亮切换：旧目标恢复大小，新目标放大提示"指住了"

    for (let hand = 0; hand < 2; hand++) {

      const prev = this.pointByHand[hand];

      if (prev?.kind === 'pickup' && prev.mesh && prev.mesh !== next[hand]?.mesh) prev.mesh.scale.setScalar(1);

      const nxt = next[hand];

      if (nxt?.kind === 'pickup' && nxt.mesh) nxt.mesh.scale.setScalar(1.45);

    }

    this.pointByHand = next;

  }



  // ---------------- 原地踏步 → 写入触摸输入通道（复用现有移动/碰撞逻辑）----------------

  private applyLocomotion(viewYaw: number, dt: number) {

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

  private wristPage: 'status' | 'quest' = 'status'; // 左手腕页面

  private phonePages = ['map', 'bag', 'tool'] as const; // 右手手机三页

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

            this.wristPage = this.wristPage === 'status' ? 'quest' : 'status';

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

        if (pressed(n) && !this.btnPrev[key(n)]) this.host.onCycleTool(dir);

        this.btnPrev[key(n)] = pressed(n);

      }

    }

  }



  // 当前手机页可选项（选项模式导航范围）

  private pageItems() {

    const prefix = this.phoneTab === 'bag' ? 'item:' : this.phoneTab === 'tool' ? 'tool:' : '@none@';

    return this.phoneBtns.filter(b => b.action.startsWith(prefix));

  }



  // 扳机：左手优先点手机按钮；对话开着 = 点按钮/下一句；否则 = 通用交互

  private onSelect(hand: number) {

    this.pulse(hand, 0.3, 40);

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

    c.width = 384; c.height = 288;

    this.wristCtx = c.getContext('2d')!;

    this.wristTex = new THREE.CanvasTexture(c);

    const m = new THREE.Mesh(

      new THREE.PlaneGeometry(0.2, 0.15),

      new THREE.MeshBasicMaterial({ map: this.wristTex, transparent: true }),

    );

    // 贴在左手背上方，抬腕可见

    m.position.set(0, 0.055, 0.06);

    m.rotation.x = -Math.PI / 3;

    return m;

  }



  private drawWrist() {

    const ctx = this.wristCtx;

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

    ctx.fillText(this.wristPage === 'status' ? '状态 1/2 ⟷' : '任务 2/2 ⟷', 290, 30);

    if (this.wristPage === 'status') {

      // 步速表

      ctx.fillStyle = this.march.speed > 0.1 ? '#8aff8a' : '#8899aa';

      ctx.font = 'bold 24px sans-serif';

      ctx.fillText(`🚶 ${this.march.speed.toFixed(1)}`, 300, 86);

      // 帧时间（调黑边问题用：>14ms 即超帧预算）

      ctx.fillStyle = this.lastAvgMs > 14 ? '#ff9a7a' : '#7fd97f';

      ctx.font = '18px sans-serif';

      ctx.fillText(`⏱ ${this.lastAvgMs.toFixed(0)}ms`, 300, 114);

      const toolName: Record<string, string> = { hand: '✋ 空手', net: '🥅 捕虫网', rod: '🎣 钓竿', shovel: '⛏️ 铲子', axe: '🪓 斧头' };

      ctx.fillStyle = '#b8e6b8';

      ctx.font = 'bold 26px sans-serif';

      ctx.fillText(toolName[s.tool] ?? s.tool, 18, 140);

    } else {

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

    }

    if (s.prompt) {

      ctx.fillStyle = '#ffffff';

      ctx.font = '20px sans-serif';

      ctx.fillText(s.prompt.slice(0, 16), 18, 276);

    }

    this.wristTex.needsUpdate = true;

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

    m.position.set(0, 0.06, 0.05);

    m.rotation.x = -Math.PI / 3;

    return m;

  }



  private drawPhone() {

    const ctx = this.phoneCtx;

    const s = store.state;

    ctx.clearRect(0, 0, 512, 720);

    ctx.fillStyle = 'rgba(18,26,38,0.94)';

    ctx.beginPath();

    ctx.roundRect(0, 0, 512, 720, 26);

    ctx.fill();

    this.phoneBtns = [];

    // 顶部标签页（三页）

    const tabs: [string, 'map' | 'bag' | 'tool'][] = [['🗺️ 地图', 'map'], ['🎒 背包', 'bag'], ['🔧 工具', 'tool']];

    tabs.forEach(([label, tab], i) => {

      const bx = 18 + i * 162, by = 14, bw = 150, bh = 54;

      const active = this.phoneTab === tab;

      const hover = this.phoneHover === this.phoneBtns.length;

      ctx.fillStyle = hover ? '#5a7fd9' : active ? '#3a5aa8' : '#2a3a52';

      ctx.beginPath();

      ctx.roundRect(bx, by, bw, bh, 12);

      ctx.fill();

      if (hover) { ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 4; ctx.stroke(); }

      ctx.fillStyle = '#ffffff';

      ctx.font = 'bold 26px sans-serif';

      ctx.fillText(label, bx + 18, by + 37);

      this.phoneBtns.push({ x: bx, y: by, w: bw, h: bh, action: `tab:${tab}` });

    });

    if (this.phoneTab === 'map') this.drawPhoneMap(ctx, s);

    else if (this.phoneTab === 'bag') this.drawPhoneBag(ctx, s);

    else this.drawPhoneTool(ctx, s);

    this.phoneTex.needsUpdate = true;

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

    inv.slice(0, 16).forEach(([id, n], i) => {

      const col = i % 4, row = Math.floor(i / 4);

      const bx = 18 + col * 120, by = 122 + row * 108, bw = 108, bh = 98;

      const btnIdx = this.phoneBtns.length;

      const glow = this.btnGlow(btnIdx, itemIdx);

      ctx.fillStyle = glow ? '#5a7fd9' : '#2a3a52';

      ctx.beginPath();

      ctx.roundRect(bx, by, bw, bh, 12);

      ctx.fill();

      if (glow) { ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 4; ctx.stroke(); }

      const item = ITEMS[id];

      ctx.font = '40px sans-serif';

      ctx.fillText(item?.icon ?? '❓', bx + 10, by + 52);

      ctx.fillStyle = '#ffffff';

      ctx.font = 'bold 24px sans-serif';

      ctx.fillText(`×${n}`, bx + 52, by + 84);

      this.phoneBtns.push({ x: bx, y: by, w: bw, h: bh, action: `item:${id}` });

      itemIdx++;

    });

    if (!inv.length) {

      ctx.fillStyle = '#8fa8c8';

      ctx.font = '22px sans-serif';

      ctx.fillText('背包空空如也', 18, 160);

    }

    // 底部说明行（点选物品后显示）

    if (this.bagMsgT > 0 && this.bagMsg) {

      ctx.fillStyle = '#ffe9a8';

      ctx.font = '20px sans-serif';

      ctx.fillText(this.bagMsg.slice(0, 24), 18, 700);

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



  private execPhoneBtn(action: string) {

    const [kind, payload] = action.split(':');

    if (kind === 'tab') { this.phoneTab = payload as 'map' | 'bag' | 'tool'; this.selMode = false; }

    else if (kind === 'tool') this.host.onSelectTool(payload);

    else if (kind === 'item') {
      const item = ITEMS[payload];
      const n = this.host.getInventory().find(([id]) => id === payload)?.[1] ?? 0;
      this.bagMsg = item ? `${item.icon} ${item.name} ×${n}　${item.desc ?? ''}` : '';
      this.bagMsgT = 5;
      // 背包点选物品 → 发 selectItem 命令，物品才能拿在手上 / 被吃掉 / 播种
      commands.push({ type: 'selectItem', item: payload });
    }
    this.drawPhone();

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

    const origin = ctrl.getWorldPosition(new THREE.Vector3());

    const dir = ctrl.getWorldDirection(new THREE.Vector3()).negate();

    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(panel.getWorldQuaternion(new THREE.Quaternion()));

    const pw = panel.getWorldPosition(new THREE.Vector3());

    const denom = dir.dot(normal);

    if (Math.abs(denom) < 1e-4) return null;

    const t = pw.clone().sub(origin).dot(normal) / denom;

    if (t < 0 || t > 1.5) return null;

    const hitP = origin.add(dir.multiplyScalar(t));

    // 面板局部坐标（考虑父级变换）

    const inv = new THREE.Matrix4().copy(panel.matrixWorld).invert();

    const local = hitP.applyMatrix4(inv);

    const u = local.x / w + 0.5, v = 0.5 - local.y / h;

    if (u < -0.1 || u > 1.1 || v < -0.1 || v > 1.1) return null;

    return [u, v];

  }



  // 抬腕变亮：面板朝向玩家眼睛时全亮

  private updateWristBrightness(panel: THREE.Mesh) {

    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(panel.getWorldQuaternion(new THREE.Quaternion()));

    const toEye = this.host.camera.getWorldPosition(new THREE.Vector3()).sub(panel.getWorldPosition(new THREE.Vector3())).normalize();

    const facing = Math.max(0, normal.dot(toEye));

    (panel.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.5 * facing;

  }



  // ---------------- 悬浮对话面板 ----------------

  private ensureDialogPanel() {

    if (this.dialogPanel) return;

    const c = document.createElement('canvas');

    c.width = 1024; c.height = 512;

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

  }



  // 双手柄激光射线与对话面板求交 → 命中按钮高亮（哪只手指的哪只手确认）

  private updateHover() {

    this.hoverBtn = -1;

    this.hoverByHand = [-1, -1];

    const panel = this.dialogPanel;

    const showLaser = !!(panel && panel.visible && this.btnRects.length > 0);

    for (const l of this.lasers) if (l) l.visible = showLaser;

    if (!panel || !panel.visible) return;

    for (let hand = 0; hand < 2; hand++) {

      const c = this.controllers[hand];

      if (!c) continue;

      const origin = c.getWorldPosition(new THREE.Vector3());

      const dir = c.getWorldDirection(this.tmpV2).negate(); // 手柄朝向前方为 -z

      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(panel.quaternion);

      const toPanel = this.tmpV.copy(panel.position).sub(origin);

      const denom = dir.dot(normal);

      if (Math.abs(denom) < 1e-4) continue;

      const t = toPanel.dot(normal) / denom;

      if (t < 0 || t > 6) continue;

      const hit = origin.clone().add(dir.clone().multiplyScalar(t));

      const local = panel.worldToLocal(hit.clone());

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

