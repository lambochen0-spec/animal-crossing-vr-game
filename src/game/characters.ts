// 动森风格角色：大头 Q 版比例，多块小盒拼出圆润轮廓，全物种耳朵/吻部/尾巴
import * as THREE from 'three';
import { faceTexture } from './textures';
import { makePokeBall, makeFruitDrop } from './items3d';
import type { VillagerDef } from './data';
import { NPC_PROFILES } from './villagers';

function bx(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export interface CharacterOpts {
  skin: string;        // 脸/毛色
  muzzle?: string;     // 吻部浅色
  shirt: number;
  sleeves?: number;    // 袖子颜色（默认同 shirt）
  pants: number;
  shoes: number;
  hair: number;
  face: 'player' | 'pikachu' | 'meowth' | 'jigglypuff' | 'eevee' | 'snorlax' | 'psyduck' | 'charmander' | 'squirtle' | 'bulbasaur' | 'penguin'
    | 'togepi' | 'gengar' | 'lucario' | 'sylveon' | 'mimikyu' | 'dedenne' | 'rowlet' | 'scorbunny' | 'yamper' | 'dragonite';
  earColor?: number;
}

export class Character {
  group = new THREE.Group();
  body = new THREE.Group();
  headG = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  walkT = 0;
  moving = false;
  yaw = 0;
  // 待机小动作（动森原版氛围：呼吸/歪头/摆手，每只相位不同）
  private idlePh = Math.random() * 20;
  // 篝火晚会跳舞：null=不跳，0~3=四种舞姿
  dance: number | null = null;
  danceT = Math.random() * 6;
  danceSpeed = 1;
  sitting = false;   // 坐姿（树下打盹/休息）
  headBow = 0;       // 低头角度（闻花等）
  // 情绪气泡（动森原版标志：头顶 💬❗💢🎵💤❤ 等）
  bubble: THREE.Sprite | null = null;
  bubbleT = 0;
  private bubbleEmoji = '';
  private static bubbleTexCache = new Map<string, THREE.CanvasTexture>();

  // 头顶冒一个情绪气泡，dur 秒后消失；emoji 为空则立即隐藏
  setBubble(emoji: string | null, dur = 2.5) {
    if (!emoji) { this.bubbleT = 0; if (this.bubble) this.bubble.visible = false; return; }
    if (!this.bubble) {
      this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      this.bubble.scale.set(0.85, 0.85, 1);
      this.bubble.position.y = 2.55;
      this.bubble.renderOrder = 10;
      this.group.add(this.bubble);
    }
    if (this.bubbleEmoji !== emoji) {
      this.bubbleEmoji = emoji;
      let tex = Character.bubbleTexCache.get(emoji);
      if (!tex) {
        const c = document.createElement('canvas');
        c.width = c.height = 96;
        const ctx = c.getContext('2d')!;
        // 白底圆角气泡
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.roundRect(6, 10, 84, 68, 20);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(40, 76); ctx.lineTo(52, 92); ctx.lineTo(56, 76);
        ctx.fill();
        ctx.font = '44px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 48, 46);
        tex = new THREE.CanvasTexture(c);
        Character.bubbleTexCache.set(emoji, tex);
      }
      (this.bubble.material as THREE.SpriteMaterial).map = tex;
      this.bubble.material.needsUpdate = true;
    }
    this.bubble.visible = true;
    this.bubbleT = dur;
  }
  toolMeshes: Record<string, THREE.Group> = {};
  curTool: 'hand' | 'net' | 'rod' | 'shovel' | 'axe' = 'hand';
  private actionT = 0;
  private actionDur = 0;
  private actionKind: 'swing' | 'dig' | 'chop' | 'cast' | null = null;

  constructor(opts: CharacterOpts) {
    const { skin, shirt, pants, shoes, hair, face } = opts;
    const skinMat = new THREE.MeshLambertMaterial({ color: skin });
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
    const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
    const shoeMat = new THREE.MeshLambertMaterial({ color: shoes });
    const hairMat = new THREE.MeshLambertMaterial({ color: hair });

    // ---- 小短腿 + 鞋子 ----
    for (const [grp, sx] of [[this.legL, -0.17], [this.legR, 0.17]] as const) {
      const leg = bx(0.24, 0.3, 0.26, pantsMat, 0, -0.15, 0);
      const shoe = bx(0.26, 0.13, 0.32, shoeMat, 0, -0.29, 0.03);
      const shoeToe = bx(0.26, 0.1, 0.1, shoeMat, 0, -0.28, 0.22);
      grp.add(leg, shoe, shoeToe);
      grp.position.set(sx, 0.4, 0);
      this.body.add(grp);
    }
    // ---- 小身体（下宽上窄的圆润感） ----
    const torso = bx(0.72, 0.5, 0.48, shirtMat, 0, 0.74, 0);
    const belly = bx(0.84, 0.24, 0.54, shirtMat, 0, 0.5, 0);
    const hips = bx(0.68, 0.14, 0.46, shirtMat, 0, 0.4, 0);
    this.body.add(torso, belly, hips);
    // ---- 细短手臂（上端贴着身体两侧，略靠前，垂下来在大头下缘露出小手） ----
    const sleeveMat = new THREE.MeshLambertMaterial({ color: opts.sleeves ?? shirt });
    for (const [grp, sx] of [[this.armL, -0.46], [this.armR, 0.46]] as const) {
      const arm = bx(0.18, 0.38, 0.22, sleeveMat, 0, -0.19, 0);
      const hand = bx(0.2, 0.16, 0.22, skinMat, 0, -0.44, 0);
      grp.add(arm, hand);
      grp.position.set(sx, 0.88, 0.08);
      this.body.add(grp);
    }
    // ---- 大头（核心盒 + 圆润补块） ----
    const faceTex = faceTexture(face === 'player' ? 'player' : face, skin, opts.muzzle);
    const headMats = [
      skinMat, skinMat,
      hairMat,  // 头顶
      skinMat,  // 下巴
      new THREE.MeshLambertMaterial({ map: faceTex }), // 脸
      hairMat,  // 后脑
    ];
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.15, 1.05), headMats);
    head.castShadow = true;
    this.headG.add(head);
    // 圆润补块（无脸区域用肤色/毛色）
    const crown = bx(1.08, 0.3, 0.92, hair === 0 ? skinMat : hairMat, 0, 0.68, -0.02); // 头顶弧
    const cheekL = bx(0.12, 0.6, 0.9, skinMat, -0.7, -0.12, 0);
    const cheekR = bx(0.12, 0.6, 0.9, skinMat, 0.7, -0.12, 0);
    const chin = bx(0.92, 0.26, 0.85, skinMat, 0, -0.66, 0); // 下巴弧
    this.headG.add(crown, cheekL, cheekR, chin);
    this.headG.position.set(0, 1.72, 0);
    this.body.add(this.headG);

    // ---- 玩家头发：圆润锅盖头 + 实心碎刘海 + 头顶发旋 + 耳朵与耳后头发 ----
    if (face === 'player') {
      const cap = bx(1.4, 0.36, 1.16, hairMat, 0, 0.5, -0.02); // 前表面探出头盒，消除前上方发缝
      const capTop = bx(1.14, 0.24, 0.94, hairMat, 0, 0.76, -0.02);
      // 刘海：实心发带 + 三缕参差发梢（全部不透明，前额不露秃）
      const bangBand = bx(1.38, 0.34, 0.14, hairMat, 0, 0.38, 0.53);
      const fringeL = bx(0.36, 0.2, 0.13, hairMat, -0.42, 0.16, 0.53);
      const fringeC = bx(0.5, 0.26, 0.13, hairMat, 0.05, 0.13, 0.53);
      const fringeR = bx(0.36, 0.17, 0.13, hairMat, 0.45, 0.17, 0.53);
      // 侧发（遮到耳前上方）
      const bangsL = bx(0.14, 0.34, 1.0, hairMat, -0.66, 0.26, 0);
      const bangsR = bx(0.14, 0.34, 1.0, hairMat, 0.66, 0.26, 0);
      // 耳后头发（上接顶发、下盖耳后，与整体发型连成一片）
      const backHairL = bx(0.2, 0.56, 0.6, hairMat, -0.7, 0.08, -0.32);
      const backHairR = bx(0.2, 0.56, 0.6, hairMat, 0.7, 0.08, -0.32);
      // 后脑勺发板（把顶发和两侧耳后发连接成整体）
      const backPanel = bx(1.3, 0.52, 0.16, hairMat, 0, 0.3, -0.55);
      const backPanelLow = bx(1.16, 0.3, 0.14, hairMat, 0, -0.02, -0.52);
      // 耳朵（正面看明显向两侧凸出，比肤色深一号形成轮廓）
      const earSkinMat = new THREE.MeshLambertMaterial({ color: opts.earColor ?? 0xe0b48c });
      const earL = bx(0.22, 0.26, 0.24, earSkinMat, -0.78, -0.02, 0.1);
      const earR = bx(0.22, 0.26, 0.24, earSkinMat, 0.78, -0.02, 0.1);
      // 头顶小发旋（呆毛）
      const whorl = bx(0.34, 0.1, 0.34, hairMat, 0.08, 0.9, -0.12);
      whorl.rotation.y = 0.6;
      const whorlTip = bx(0.16, 0.08, 0.16, hairMat, 0.2, 0.94, -0.06);
      whorlTip.rotation.y = 0.6;
      this.headG.add(cap, capTop, bangBand, fringeL, fringeC, fringeR, bangsL, bangsR, backHairL, backHairR, backPanel, backPanelLow, earL, earR, whorl, whorlTip);
    }

    // ---- 耳朵 ----
    const earMat = new THREE.MeshLambertMaterial({ color: opts.earColor ?? hair });
    const innerMat = new THREE.MeshLambertMaterial({ color: opts.muzzle ?? '#ffd9d9' });
    if (face === 'pikachu') {
      // 皮卡丘：长耳朵（黄色耳根 + 黑色耳尖，向外撇）
      const tipMat = new THREE.MeshLambertMaterial({ color: 0x26262e });
      for (const sx of [-0.42, 0.42]) {
        const base = bx(0.24, 0.55, 0.18, earMat, sx, 0.9, 0);
        base.rotation.z = sx > 0 ? -0.28 : 0.28;
        const tip = bx(0.2, 0.32, 0.15, tipMat, sx * 1.35, 1.28, 0);
        tip.rotation.z = sx > 0 ? -0.28 : 0.28;
        this.headG.add(base, tip);
      }
    } else if (face === 'meowth') {
      // 喵喵：尖耳朵（深耳尖）+ 额头金币
      const tipMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
      for (const sx of [-0.4, 0.4]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 4), earMat);
        ear.position.set(sx, 0.76, 0);
        ear.castShadow = true;
        this.headG.add(ear, bx(0.16, 0.14, 0.16, tipMat, sx, 0.94, 0));
      }
      // 额头上的金币
      const coinMat = new THREE.MeshLambertMaterial({ color: 0xe8c33b, emissive: 0x554400 });
      this.headG.add(bx(0.3, 0.34, 0.1, coinMat, 0, 0.3, 0.56));
    } else if (face === 'jigglypuff') {
      // 胖丁：小尖耳 + 额头卷毛
      for (const sx of [-0.4, 0.4]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 4), earMat);
        ear.position.set(sx, 0.74, 0);
        ear.castShadow = true;
        this.headG.add(ear, bx(0.12, 0.14, 0.12, innerMat, sx, 0.68, 0.06));
      }
      this.headG.add(bx(0.24, 0.18, 0.14, earMat, 0.02, 0.7, 0.5));
      this.headG.add(bx(0.14, 0.12, 0.1, earMat, 0.14, 0.62, 0.54));
    } else if (face === 'eevee') {
      // 伊布：又大又尖的耳朵，略微外撇
      for (const sx of [-0.36, 0.36]) {
        const earBase = bx(0.26, 0.62, 0.14, earMat, sx, 0.98, 0);
        earBase.rotation.z = sx > 0 ? -0.14 : 0.14;
        const earTip = bx(0.2, 0.4, 0.12, earMat, sx * 1.3, 1.42, 0);
        earTip.rotation.z = sx > 0 ? -0.14 : 0.14;
        this.headG.add(earBase, earTip);
      }
    } else if (face === 'snorlax') {
      // 卡比兽：小圆耳
      for (const sx of [-0.44, 0.44]) {
        this.headG.add(bx(0.22, 0.18, 0.14, earMat, sx, 0.7, 0));
      }
    } else if (face === 'psyduck') {
      // 可达鸭：头顶三根黑毛 + 扁扁的喙
      const hairMat2 = new THREE.MeshLambertMaterial({ color: 0x26262e });
      for (const [hx, rz] of [[-0.12, 0.3], [0, 0], [0.12, -0.3]] as const) {
        const h = bx(0.05, 0.34, 0.05, hairMat2, hx, 0.88, -0.05);
        h.rotation.z = rz;
        this.headG.add(h);
      }
      const billMat = new THREE.MeshLambertMaterial({ color: 0xe8a33b });
      this.headG.add(bx(0.52, 0.14, 0.36, billMat, 0, -0.2, 0.62));
    } else if (face === 'bulbasaur') {
      // 妙蛙种子：小尖耳（背上的球茎在躯干）
      for (const sx of [-0.38, 0.38]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 4), earMat);
        ear.position.set(sx, 0.74, 0);
        ear.castShadow = true;
        this.headG.add(ear);
      }
    } else if (face === 'charmander' || face === 'squirtle') {
      // 小火龙 / 杰尼龟：圆润光头，无大耳（特征在尾巴和背上）
    } else if (face === 'penguin') {
      // 企鹅：黄色喙
      const beakMat = new THREE.MeshLambertMaterial({ color: 0xe8a33b });
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 4), beakMat);
      beak.position.set(0, -0.15, 0.68);
      beak.rotation.x = Math.PI / 2;
      beak.castShadow = true;
      this.headG.add(beak);
      // 白色胸腹
      const chest = bx(0.6, 0.6, 0.06, new THREE.MeshLambertMaterial({ color: 0xf7f7f0 }), 0, 0.62, 0.28);
      this.body.add(chest);
    }

    // ---- 宝可梦躯干特征 ----
    if (face === 'eevee') {
      // 伊布：奶油色毛围脖
      const ruffMat = new THREE.MeshLambertMaterial({ color: opts.muzzle ?? '#f7e8c9' });
      this.body.add(bx(0.95, 0.26, 0.3, ruffMat, 0, 0.96, 0.3));
      this.body.add(bx(0.95, 0.26, 0.3, ruffMat, 0, 0.96, -0.3));
      this.body.add(bx(0.28, 0.26, 0.66, ruffMat, -0.44, 0.96, 0));
      this.body.add(bx(0.28, 0.26, 0.66, ruffMat, 0.44, 0.96, 0));
    } else if (face === 'charmander') {
      // 小火龙：奶油色胸腹
      this.body.add(bx(0.5, 0.5, 0.06, new THREE.MeshLambertMaterial({ color: opts.muzzle ?? '#ffe8b0' }), 0, 0.62, 0.28));
    } else if (face === 'squirtle') {
      // 杰尼龟：背后的龟壳（奶油壳缘 + 深棕壳面）
      const rimMat = new THREE.MeshLambertMaterial({ color: 0xf7ecd0 });
      const shellMat = new THREE.MeshLambertMaterial({ color: 0x8a5a3b });
      this.body.add(bx(0.62, 0.56, 0.22, rimMat, 0, 0.68, -0.3));
      this.body.add(bx(0.54, 0.48, 0.14, shellMat, 0, 0.68, -0.42));
    } else if (face === 'bulbasaur') {
      // 妙蛙种子：背上的大球茎（三层洋葱 + 深绿叶棱 + 顶部嫩芽，背面醒目）
      const bulbMat = new THREE.MeshLambertMaterial({ color: 0x4a9a4a });
      const bulbMat2 = new THREE.MeshLambertMaterial({ color: 0x5ab85a });
      const bulbDark = new THREE.MeshLambertMaterial({ color: 0x3a7a3a });
      const sprout = new THREE.MeshLambertMaterial({ color: 0x7ad46a });
      this.body.add(bx(0.68, 0.46, 0.44, bulbDark, 0, 1.1, -0.58));   // 底层（探出背后）
      this.body.add(bx(0.54, 0.38, 0.38, bulbMat, 0, 1.36, -0.62));   // 中层
      this.body.add(bx(0.36, 0.3, 0.3, bulbMat2, 0, 1.62, -0.6));     // 顶层
      // 叶棱（两侧深绿竖纹）
      this.body.add(bx(0.08, 0.52, 0.46, bulbDark, -0.22, 1.28, -0.6));
      this.body.add(bx(0.08, 0.52, 0.46, bulbDark, 0.22, 1.28, -0.6));
      // 嫩芽
      this.body.add(bx(0.1, 0.24, 0.1, sprout, 0, 1.9, -0.6));
      this.body.add(bx(0.18, 0.1, 0.14, sprout, 0.05, 2.02, -0.6));
    }

    // ---- 3D 吻部（仅伊布/小火龙这类有小吻部的） ----
    if (face === 'eevee' || face === 'charmander') {
      const snoutMat = new THREE.MeshLambertMaterial({ color: opts.muzzle ?? '#fff3e0' });
      const snout = bx(0.4, 0.22, 0.18, snoutMat, 0, -0.2, 0.6);
      const nose = bx(0.13, 0.1, 0.08, new THREE.MeshLambertMaterial({ color: 0x4a3025 }), 0, -0.09, 0.68);
      this.headG.add(snout, nose);
    }

    // ---- 尾巴 ----
    const tailMat = new THREE.MeshLambertMaterial({ color: opts.earColor ?? hair });
    if (face === 'pikachu') {
      // 闪电尾巴（扁平锯齿三段式，从身体右后侧高高探出）
      const tailBrown = new THREE.MeshLambertMaterial({ color: 0x8a5a3b });
      this.body.add(bx(0.2, 0.26, 0.2, tailBrown, 0, 0.42, -0.44)); // 棕色根部
      const mkBolt = (h: number, x: number, y: number, rz: number) => {
        const m = bx(0.16, h, 0.1, tailMat, x, y, -0.56);
        m.rotation.z = rz;
        this.body.add(m);
      };
      mkBolt(0.62, 0.82, 0.8, -0.35);  // 下段
      mkBolt(0.56, 1.0, 1.3, 0.45);    // 中段折返
      mkBolt(0.4, 0.82, 1.72, -0.3);   // 上段尾尖（高过头顶）
    } else if (face === 'meowth') {
      // 喵喵：尖耳朵（深耳尖）+ 额头金币
      const tipMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
      for (const sx of [-0.4, 0.4]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 4), earMat);
        ear.position.set(sx, 0.76, 0);
        ear.castShadow = true;
        this.headG.add(ear, bx(0.16, 0.14, 0.16, tipMat, sx, 0.94, 0));
      }
      // 额头上的金币
      const coinMat = new THREE.MeshLambertMaterial({ color: 0xe8c33b, emissive: 0x554400 });
      this.headG.add(bx(0.3, 0.34, 0.1, coinMat, 0, 0.3, 0.56));
    } else if (face === 'jigglypuff') {
      // 胖丁：小尖耳 + 额头卷毛
      for (const sx of [-0.4, 0.4]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 4), earMat);
        ear.position.set(sx, 0.74, 0);
        ear.castShadow = true;
        this.headG.add(ear, bx(0.12, 0.14, 0.12, innerMat, sx, 0.68, 0.06));
      }
      this.headG.add(bx(0.24, 0.18, 0.14, earMat, 0.02, 0.7, 0.5));
      this.headG.add(bx(0.14, 0.12, 0.1, earMat, 0.14, 0.62, 0.54));
    } else if (face === 'eevee') {
      // 伊布：又大又尖的耳朵，略微外撇
      for (const sx of [-0.36, 0.36]) {
        const earBase = bx(0.26, 0.62, 0.14, earMat, sx, 0.98, 0);
        earBase.rotation.z = sx > 0 ? -0.14 : 0.14;
        const earTip = bx(0.2, 0.4, 0.12, earMat, sx * 1.3, 1.42, 0);
        earTip.rotation.z = sx > 0 ? -0.14 : 0.14;
        this.headG.add(earBase, earTip);
      }
    } else if (face === 'snorlax') {
      // 卡比兽：小圆耳
      for (const sx of [-0.44, 0.44]) {
        this.headG.add(bx(0.22, 0.18, 0.14, earMat, sx, 0.7, 0));
      }
    } else if (face === 'psyduck') {
      // 可达鸭：头顶三根黑毛 + 扁扁的喙
      const hairMat2 = new THREE.MeshLambertMaterial({ color: 0x26262e });
      for (const [hx, rz] of [[-0.12, 0.3], [0, 0], [0.12, -0.3]] as const) {
        const h = bx(0.05, 0.34, 0.05, hairMat2, hx, 0.88, -0.05);
        h.rotation.z = rz;
        this.headG.add(h);
      }
      const billMat = new THREE.MeshLambertMaterial({ color: 0xe8a33b });
      this.headG.add(bx(0.52, 0.14, 0.36, billMat, 0, -0.2, 0.62));
    } else if (face === 'bulbasaur') {
      // 妙蛙种子：小尖耳（背上的球茎在躯干）
      for (const sx of [-0.38, 0.38]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 4), earMat);
        ear.position.set(sx, 0.74, 0);
        ear.castShadow = true;
        this.headG.add(ear);
      }
    } else if (face === 'charmander' || face === 'squirtle') {
      // 小火龙 / 杰尼龟：圆润光头，无大耳（特征在尾巴和背上）
    } else if (face === 'penguin') {
      // 企鹅：黄色喙
      const beakMat = new THREE.MeshLambertMaterial({ color: 0xe8a33b });
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 4), beakMat);
      beak.position.set(0, -0.15, 0.68);
      beak.rotation.x = Math.PI / 2;
      beak.castShadow = true;
      this.headG.add(beak);
      // 白色胸腹
      const chest = bx(0.6, 0.6, 0.06, new THREE.MeshLambertMaterial({ color: 0xf7f7f0 }), 0, 0.62, 0.28);
      this.body.add(chest);
    }

    // ---- 宝可梦躯干特征 ----
    if (face === 'eevee') {
      // 伊布：奶油色毛围脖
      const ruffMat = new THREE.MeshLambertMaterial({ color: opts.muzzle ?? '#f7e8c9' });
      this.body.add(bx(0.95, 0.26, 0.3, ruffMat, 0, 0.96, 0.3));
      this.body.add(bx(0.95, 0.26, 0.3, ruffMat, 0, 0.96, -0.3));
      this.body.add(bx(0.28, 0.26, 0.66, ruffMat, -0.44, 0.96, 0));
      this.body.add(bx(0.28, 0.26, 0.66, ruffMat, 0.44, 0.96, 0));
    } else if (face === 'charmander') {
      // 小火龙：奶油色胸腹
      this.body.add(bx(0.5, 0.5, 0.06, new THREE.MeshLambertMaterial({ color: opts.muzzle ?? '#ffe8b0' }), 0, 0.62, 0.28));
    } else if (face === 'squirtle') {
      // 杰尼龟：背后的龟壳（奶油壳缘 + 深棕壳面）
      const rimMat = new THREE.MeshLambertMaterial({ color: 0xf7ecd0 });
      const shellMat = new THREE.MeshLambertMaterial({ color: 0x8a5a3b });
      this.body.add(bx(0.62, 0.56, 0.22, rimMat, 0, 0.68, -0.3));
      this.body.add(bx(0.54, 0.48, 0.14, shellMat, 0, 0.68, -0.42));
    } else if (face === 'bulbasaur') {
      // 妙蛙种子：背上的大球茎（三层洋葱 + 深绿叶棱 + 顶部嫩芽，背面醒目）
      const bulbMat = new THREE.MeshLambertMaterial({ color: 0x4a9a4a });
      const bulbMat2 = new THREE.MeshLambertMaterial({ color: 0x5ab85a });
      const bulbDark = new THREE.MeshLambertMaterial({ color: 0x3a7a3a });
      const sprout = new THREE.MeshLambertMaterial({ color: 0x7ad46a });
      this.body.add(bx(0.68, 0.46, 0.44, bulbDark, 0, 1.1, -0.58));   // 底层（探出背后）
      this.body.add(bx(0.54, 0.38, 0.38, bulbMat, 0, 1.36, -0.62));   // 中层
      this.body.add(bx(0.36, 0.3, 0.3, bulbMat2, 0, 1.62, -0.6));     // 顶层
      // 叶棱（两侧深绿竖纹）
      this.body.add(bx(0.08, 0.52, 0.46, bulbDark, -0.22, 1.28, -0.6));
      this.body.add(bx(0.08, 0.52, 0.46, bulbDark, 0.22, 1.28, -0.6));
      // 嫩芽
      this.body.add(bx(0.1, 0.24, 0.1, sprout, 0, 1.9, -0.6));
      this.body.add(bx(0.18, 0.1, 0.14, sprout, 0.05, 2.02, -0.6));
    }

    // ---- 3D 吻部（仅伊布/小火龙这类有小吻部的） ----
    if (face === 'eevee' || face === 'charmander') {
      const snoutMat = new THREE.MeshLambertMaterial({ color: opts.muzzle ?? '#fff3e0' });
      const snout = bx(0.4, 0.22, 0.18, snoutMat, 0, -0.2, 0.6);
      const nose = bx(0.13, 0.1, 0.08, new THREE.MeshLambertMaterial({ color: 0x4a3025 }), 0, -0.09, 0.68);
      this.headG.add(snout, nose);
    }

    // ---- 尾巴 ----
    if (face === 'meowth') {
      // 卷卷的尾巴（末端棕色）
      this.body.add(bx(0.1, 0.1, 0.5, tailMat, 0, 0.32, -0.45));
      this.body.add(bx(0.22, 0.22, 0.12, new THREE.MeshLambertMaterial({ color: 0x8a5a3b }), 0, 0.46, -0.68));
    } else if (face === 'eevee') {
      // 蓬松大尾巴（奶油色尾尖）
      this.body.add(bx(0.36, 0.6, 0.3, tailMat, 0, 0.56, -0.46));
      this.body.add(bx(0.3, 0.34, 0.24, new THREE.MeshLambertMaterial({ color: opts.muzzle ?? '#f7e8c9' }), 0, 1.0, -0.46));
    } else if (face === 'charmander') {
      // 火焰尾巴（尾尖燃烧的火焰）
      this.body.add(bx(0.16, 0.16, 0.42, tailMat, 0, 0.32, -0.42));
      const flameOut = new THREE.MeshLambertMaterial({ color: 0xe8452c, emissive: 0x882000 });
      const flameIn = new THREE.MeshLambertMaterial({ color: 0xf7d02c, emissive: 0xaa6600 });
      this.body.add(bx(0.2, 0.3, 0.18, flameOut, 0, 0.58, -0.64));
      this.body.add(bx(0.12, 0.2, 0.12, flameIn, 0, 0.58, -0.62));
    } else if (face === 'squirtle') {
      // 杰尼龟卷尾
      this.body.add(bx(0.16, 0.16, 0.3, tailMat, 0, 0.3, -0.42));
      this.body.add(bx(0.2, 0.2, 0.12, tailMat, 0, 0.44, -0.58));
    } else if (face === 'psyduck') {
      // 可达鸭小尾巴
      this.body.add(bx(0.2, 0.16, 0.22, tailMat, 0, 0.36, -0.44));
    } else if (face === 'jigglypuff') {
      // 胖丁小卷尾
      this.body.add(bx(0.18, 0.18, 0.14, tailMat, 0, 0.36, -0.46));
      this.body.add(bx(0.12, 0.12, 0.1, tailMat, 0.06, 0.5, -0.5));
    } else if (face === 'penguin') {
      // 企鹅脚蹼
      const footMat = new THREE.MeshLambertMaterial({ color: 0xe8a33b });
      for (const sx of [-0.17, 0.17]) {
        this.body.add(bx(0.3, 0.08, 0.4, footMat, sx, 0.04, 0.06));
      }
      // 背部白色披风斑 + 小尾羽
      this.body.add(bx(0.5, 0.56, 0.08, new THREE.MeshLambertMaterial({ color: 0xe8f0f7 }), 0, 0.66, -0.36));
      this.body.add(bx(0.22, 0.2, 0.14, tailMat, 0, 0.34, -0.44));
    }

    this.group.add(this.body);
    this.buildTools();
  }

  private buildTools() {
    // 虫网
    const net = new THREE.Group();
    const stickMat = new THREE.MeshLambertMaterial({ color: 0x8a6239 });
    net.add(bx(0.08, 1.1, 0.08, stickMat, 0, -0.5, 0));
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 10), new THREE.MeshLambertMaterial({ color: 0xd0d0d8 }));
    hoop.position.set(0, -1.15, 0);
    net.add(hoop);
    const bag = bx(0.5, 0.5, 0.1, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }), 0, -1.15, -0.15);
    net.add(bag);
    // 鱼竿
    const rod = new THREE.Group();
    rod.add(bx(0.07, 1.5, 0.07, new THREE.MeshLambertMaterial({ color: 0x6e4c2a }), 0, -0.55, 0));
    rod.add(bx(0.04, 0.4, 0.04, new THREE.MeshLambertMaterial({ color: 0xd0d0d8 }), 0, -1.35, 0));
    // 铲子（铁锹：长柄 + 铲头）
    const shovel = new THREE.Group();
    shovel.add(bx(0.08, 0.9, 0.08, stickMat, 0, -0.4, 0));
    shovel.add(bx(0.16, 0.1, 0.1, new THREE.MeshLambertMaterial({ color: 0x8a5a3b }), 0, -0.82, 0));
    shovel.add(bx(0.3, 0.4, 0.08, new THREE.MeshLambertMaterial({ color: 0x9a9aa2 }), 0, -1.05, 0));
    shovel.add(bx(0.34, 0.08, 0.08, new THREE.MeshLambertMaterial({ color: 0xc9c9d2 }), 0, -1.24, 0));
    // 斧头（木柄 + 金属斧刃）
    const axe = new THREE.Group();
    axe.add(bx(0.08, 1.0, 0.08, stickMat, 0, -0.45, 0));
    axe.add(bx(0.26, 0.2, 0.07, new THREE.MeshLambertMaterial({ color: 0x9a9aa2 }), 0.12, -0.85, 0));
    axe.add(bx(0.1, 0.24, 0.05, new THREE.MeshLambertMaterial({ color: 0xc9c9d2 }), 0.26, -0.85, 0));

    this.toolMeshes = { net, rod, shovel, axe };
    for (const k of Object.keys(this.toolMeshes)) {
      const t = this.toolMeshes[k as keyof typeof this.toolMeshes];
      t.position.set(0, -0.4, 0.15);
      t.visible = false;
      this.armR.add(t);
    }
    // 左手持有的物品（水果拿水果模型，其他物品拿精灵球，对应原版动森的"叶子"）
    this.heldItem = new THREE.Group();
    this.heldItem.position.set(0, -0.85, 0.15);
    this.heldItem.visible = false;
    this.armL.add(this.heldItem);
  }

  // 手上拿着/放下物品
  heldItem!: THREE.Group;
  setHeldItem(item: string | null) {
    this.heldItem.clear();
    if (!item) { this.heldItem.visible = false; return; }
    const isFruit = item === 'apple' || item === 'cherry' || item === 'orange' || item === 'peach';
    this.heldItem.add(isFruit ? makeFruitDrop(item, 0.9) : makePokeBall(0.85));
    this.heldItem.visible = true;
  }

  setTool(tool: 'hand' | 'net' | 'rod' | 'shovel' | 'axe') {
    this.curTool = tool;
    for (const k of Object.keys(this.toolMeshes)) {
      this.toolMeshes[k as keyof typeof this.toolMeshes].visible = k === tool;
    }
  }

  // ---- 使用工具的动作动画（挥网/挖铲/砍斧/抛竿） ----
  action(kind: 'swing' | 'dig' | 'chop' | 'cast', dur = 0.6) {
    this.actionKind = kind;
    this.actionT = dur;
    this.actionDur = dur;
  }

  update(dt: number) {
    this.idlePh += dt;
    // 情绪气泡倒计时 + 轻微上下浮动
    if (this.bubble && this.bubble.visible) {
      this.bubble.position.y = 2.55 + Math.sin(this.idlePh * 3) * 0.05;
      if (this.bubbleT > 0) {
        this.bubbleT -= dt;
        if (this.bubbleT <= 0) this.bubble.visible = false;
      }
    }
    if (this.moving) this.walkT += dt * 10;
    else this.walkT *= 0.85;
    const s = Math.sin(this.walkT);
    this.legL.rotation.x = s * 0.9;
    this.legR.rotation.x = -s * 0.9;
    this.armL.rotation.x = -s * 0.7;
    this.armR.rotation.x = s * 0.7;
    this.body.position.y = Math.abs(Math.sin(this.walkT)) * 0.07;
    this.group.rotation.y = this.yaw;
    // 每帧先复位跳舞/待机改过的部件，避免残留
    this.body.rotation.y = 0;
    this.body.rotation.z = 0;
    this.headG.rotation.x = 0;
    this.headG.rotation.z = 0;
    // 手臂基础姿势：向两侧外八张开（左臂负旋转朝外，右臂正旋转朝外）
    this.armL.rotation.z = -0.28;
    this.armR.rotation.z = 0.28;
    // 坐姿：双腿前伸、身体下沉（打盹/休息用）
    if (this.sitting) {
      this.legL.rotation.x = -1.35;
      this.legR.rotation.x = -1.35;
      this.body.position.y -= 0.24;
    }
    // 低头（闻花等动作用，数值即低头角度）
    if (this.headBow > 0) this.headG.rotation.x = this.headBow;

    // ---- 篝火晚会跳舞（优先级最高，各自节奏不同） ----
    if (this.dance != null) {
      this.danceT += dt * this.danceSpeed;
      const t = this.danceT;
      if (this.dance === 0) {
        // 左右摇摆 + 轮流高举双手
        this.body.rotation.z = Math.sin(t * 2.4) * 0.12;
        this.body.position.y = Math.abs(Math.sin(t * 2.4)) * 0.1;
        this.armL.rotation.z = -2.2 - Math.sin(t * 2.4) * 0.6;
        this.armR.rotation.z = 2.2 + Math.sin(t * 2.4 + Math.PI) * 0.6;
      } else if (this.dance === 1) {
        // 转圈圈（偶尔踮脚小跳）
        this.body.rotation.y = (this.danceT * 2.8) % (Math.PI * 2);
        this.body.position.y = Math.max(0, Math.sin(t * 4)) * 0.14;
      } else if (this.dance === 2) {
        // 开心小跳 + 点头
        this.body.position.y = Math.abs(Math.sin(t * 3)) * 0.2;
        this.headG.rotation.x = Math.sin(t * 3) * 0.2;
        this.armL.rotation.z = -0.5;
        this.armR.rotation.z = 0.5;
      } else {
        // 原地扭动 + 双臂前后摆（身体起伏加大，任何体型都能看出在跳舞）
        this.body.rotation.y = Math.sin(t * 2.2) * 0.4;
        this.body.position.y = Math.abs(Math.sin(t * 4.4)) * 0.12;
        this.armL.rotation.x = Math.sin(t * 4.4) * 0.8;
        this.armR.rotation.x = -Math.sin(t * 4.4) * 0.8;
      }
      return;
    }

    // ---- 待机小动作（动森原版氛围）：呼吸起伏 + 歪头点头 + 手臂轻摆 + 偶尔伸懒腰 ----
    if (!this.moving && this.actionT <= 0) {
      const it = this.idlePh;
      const cyc = it % 9; // 每 9 秒一轮，前 1.3 秒伸个懒腰（每只相位不同）
      if (cyc < 1.3) {
        const k = Math.sin((cyc / 1.3) * Math.PI); // 0→1→0 平滑起落
        this.armL.rotation.z = -0.28 - k * 1.8;              // 双臂向上举起伸展
        this.armR.rotation.z = 0.28 + k * 1.8;
        this.body.position.y = k * 0.07;                     // 踮起脚尖
        this.headG.rotation.x = -k * 0.18;                   // 仰起头
      } else {
        this.body.position.y = Math.sin(it * 2.2) * 0.04;    // 呼吸（幅度加大）
        this.headG.rotation.z = Math.sin(it * 0.9) * 0.11;   // 慢慢歪头
        this.headG.rotation.x = Math.sin(it * 1.3) * 0.08;   // 轻轻点头
        this.armL.rotation.z = -0.28 - Math.sin(it * 2.2) * 0.08; // 手臂随呼吸摆动
        this.armR.rotation.z = 0.28 + Math.sin(it * 2.2 + 1) * 0.08;
      }
    }
    // ---- 动作动画覆盖（优先级高于走路摆臂，姿势参考动森原版） ----
    const tm = this.toolMeshes[this.curTool];
    if (this.actionT > 0) {
      this.actionT -= dt;
      const k = 1 - Math.max(0, this.actionT) / this.actionDur; // 0→1
      if (this.actionKind === 'swing' || this.actionKind === 'chop') {
        // 挥网 / 砍斧：双手举过头顶，再猛力挥劈下来，身体随之前倾
        const rx = k < 0.35
          ? -2.6 * (k / 0.35)
          : -2.6 + 3.2 * ((k - 0.35) / 0.65);
        this.armR.rotation.x = rx;
        this.armL.rotation.x = rx; // 双手合握
        this.body.rotation.x = k < 0.35 ? 0 : 0.16 * ((k - 0.35) / 0.65);
      } else if (this.actionKind === 'dig') {
        // 挖铲：双手握铲向下掘土，身体配合起伏
        const th = Math.abs(Math.sin(k * Math.PI * 2));
        const rx = -0.9 - th * 0.9;
        this.armR.rotation.x = rx;
        this.armL.rotation.x = rx;
        this.body.rotation.x = 0.14 * th;
      } else if (this.actionKind === 'cast') {
        // 抛竿：单手举过肩向后蓄力，再向前挥出
        this.armR.rotation.x = k < 0.4
          ? -0.4 + 0.9 * (k / 0.4)
          : 0.5 - 2.6 * ((k - 0.4) / 0.6);
        this.armL.rotation.x = -0.3;
      }
      if (tm) tm.rotation.x = 0; // 用械时工具随手臂直指
      if (this.actionT <= 0) {
        this.actionKind = null;
        this.body.rotation.x = 0;
      }
    } else {
      this.body.rotation.x = 0;
      if (this.curTool !== 'hand' && !this.moving) {
        // 持械姿势（原版）：手臂自然前伸，工具竖持上翘
        this.armR.rotation.x = -0.45;
        if (tm) tm.rotation.x = -2.1;
      }
    }
  }
}

export class Villager extends Character {
  def: VillagerDef;
  target: THREE.Vector3 | null = null;
  idleT = 0;
  speed = 1.6;
  wander = true;
  // 即兴活动（原版氛围：钓鱼/捉虫/打盹/闻花/哼歌/做操/聊天/打招呼）
  activityT = 0;
  activityKind: string | null = null;
  activitySubT = 0; // 活动内的气泡/音效节奏计时
  constructor(def: VillagerDef) {
    super({
      skin: colorToCss(def.color),
      muzzle: colorToCss(def.belly),
      shirt: def.shirt ?? def.color,
      pants: darken(def.color),
      shoes: def.earType === 'penguin' ? 0xe8a33b : def.color, // 宝可梦光脚
      hair: def.color,
      face: def.earType,
      earColor: def.earColor ?? def.color,
    });
    this.def = def;
    // 体型分级：大型（≥1.8m，如卡比兽）缩到 2/3；小型（<0.9m）放大 1.5 倍；中型（≈玩家身高）不变
    const h = def.height ?? 1.2;
    const s = h >= 1.8 ? (h / 1.2) * (2 / 3) : h < 0.9 ? (h / 1.2) * 1.5 : h / 1.2;
    this.group.scale.setScalar(s);
    // 卡比兽：横向发展的大块头
    if (def.earType === 'snorlax') {
      for (const i of [2, 3, 4]) {
        const m = this.body.children[i] as THREE.Mesh;
        m.scale.set(1.45, 1.12, 1.4);
      }
    }
  }
}

// 喵喵（喵喵商会社长）：奶油色 + 额头金币 + 棕色脚掌，常驻商店不闲逛
export class Meowth extends Villager {
  constructor() {
    super(NPC_PROFILES.meowth.def);
    this.wander = false;
    // 棕色后脚掌（喵喵官设）
    for (const grp of [this.legL, this.legR]) {
      for (const i of [1, 2]) {
        ((grp.children[i] as THREE.Mesh).material as THREE.MeshLambertMaterial).color.set(0x8a5a3b);
      }
    }
  }
}

// 皮卡丘（广场向导）：电气鼠 + 黑尖长耳 + 红脸颊 + 背上棕条纹 + 闪电尾巴
export class Pikachu extends Villager {
  constructor() {
    super({
      name: '皮卡丘', height: 0.4, species: '小鼠宝可梦', color: 0xf7d02c, belly: 0xf7d02c,
      earType: 'pikachu', shirt: 0xf7d02c, earColor: 0xf7d02c, catchphrase: '皮卡', lines: [],
    });
    this.wander = false;
    // 背上两条棕色条纹（官设）
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x8a5a3b });
    this.body.add(bx(0.5, 0.13, 0.06, stripeMat, 0, 0.86, -0.28));
    this.body.add(bx(0.5, 0.13, 0.06, stripeMat, 0, 0.62, -0.31));
  }
}

function colorToCss(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}
function darken(c: number): number {
  const r = ((c >> 16) & 255) * 0.7, g = ((c >> 8) & 255) * 0.7, b = (c & 255) * 0.7;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
