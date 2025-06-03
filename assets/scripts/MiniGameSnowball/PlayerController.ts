// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

const {ccclass, property} = cc._decorator;

enum PlayerState {
    Idle,
    Moving,
    MakingSnowball,
    HoldingSnowball,
    Frozen
}

@ccclass
export default class PlayerController extends cc.Component {
    @property({ type: cc.Prefab }) snowballPrefab: cc.Prefab = null;
    @property(cc.Label)
    label: cc.Label = null;

    @property
    text: string = 'hello';

    @property(cc.Animation)
    anim: cc.Animation = null;
    @property(cc.ProgressBar)
    snowballBar: cc.ProgressBar = null;
    @property(cc.Node)
    lifeNode: cc.Node = null; // 生命顯示父節點，底下放三個Sprite
    @property({ type: cc.Prefab }) hitFXPrefab: cc.Prefab = null;

    private state: PlayerState = PlayerState.Idle;
    private keys: { [key: string]: boolean } = {};
    private moveSpeed: number = 200;
    private snowballMakingTime: number = 1.0; // 製作雪球所需秒數
    private snowballTimer: number = 0;
    private hasSnowball: boolean = false;
    private faceRight: boolean = true; // true: 右, false: 左
    private life: number = 3;
    private runAnimName: string = '';
    private idleAnimName: string = '';
    private makeAnimName: string = '';
    private throwAnimName: string = '';
    private runLoadedAnimName: string = '';
    private idleLoadedAnimName: string = '';
    private handSnowball: cc.Node = null;
    private slowTimer: number = 0;
    private normalSpeed: number = 200;
    private slowSpeed: number = 80;
    private normalColor: cc.Color = cc.Color.WHITE;
    private slowColor: cc.Color = new cc.Color(100, 100, 255);
    private rb: cc.RigidBody = null;

    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
        cc.director.getPhysicsManager().enabled = true;
        cc.director.getPhysicsManager().gravity = cc.v2(0, 0); // 關閉重力
        // 根據玩家名字決定動畫名稱（支援 Player_GRASS_Idle 這種格式）
        // 例如: Player_GRASS_Idle => GRASS
        let type = 'FIRE';
        const nameParts = this.node.name.split('_');
        if (nameParts.length >= 2) {
            type = nameParts[1];
        }
        this.runAnimName = `Player_${type}_Run`;
        this.idleAnimName = `Player_${type}_Idle`;
        this.makeAnimName = `Player_${type}_Make`;
        this.throwAnimName = `Player_${type}_Throw`;
        this.runLoadedAnimName = `Player_${type}_Run_Loaded`;
        this.idleLoadedAnimName = `Player_${type}_Idle_Loaded`;
        // 嘗試尋找手上的雪球節點（命名 handSnowball，預設隱藏）
        this.handSnowball = this.node.getChildByName('handSnowball');
        if (this.handSnowball) this.handSnowball.active = false;
        this.rb = this.node.getComponent(cc.RigidBody);
        if (this.rb) {
            this.rb.linearDamping = 0.25; // 冰上滑行感(調高一點)
            this.rb.fixedRotation = true; // 不會旋轉
        }
    }

    onDestroy() {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
    }

    onKeyDown(event: cc.Event.EventKeyboard) {
        if (this.state === PlayerState.Frozen) return;
        switch (event.keyCode) {
            case cc.macro.KEY.w:
            case cc.macro.KEY.up:
                this.keys['up'] = true;
                break;
            case cc.macro.KEY.s:
            case cc.macro.KEY.down:
                this.keys['down'] = true;
                break;
            case cc.macro.KEY.a:
            case cc.macro.KEY.left:
                this.keys['left'] = true;
                break;
            case cc.macro.KEY.d:
            case cc.macro.KEY.right:
                this.keys['right'] = true;
                break;
            case cc.macro.KEY.space:
                if (!this.hasSnowball && this.state !== PlayerState.MakingSnowball) {
                    this.state = PlayerState.MakingSnowball;
                    this.snowballTimer = 0;
                    // 立即播放製作雪球動畫
                    if (this.anim) this.anim.play(this.makeAnimName);
                }
                break;
        }
    }

    onKeyUp(event: cc.Event.EventKeyboard) {
        switch (event.keyCode) {
            case cc.macro.KEY.w:
            case cc.macro.KEY.up:
                this.keys['up'] = false;
                break;
            case cc.macro.KEY.s:
            case cc.macro.KEY.down:
                this.keys['down'] = false;
                break;
            case cc.macro.KEY.a:
            case cc.macro.KEY.left:
                this.keys['left'] = false;
                break;
            case cc.macro.KEY.d:
            case cc.macro.KEY.right:
                this.keys['right'] = false;
                break;
            case cc.macro.KEY.space:
                if (this.state === PlayerState.MakingSnowball) {
                    // 提前放開，取消製作
                    this.state = PlayerState.Idle;
                    this.snowballTimer = 0;
                    if (this.anim) this.anim.play(this.idleAnimName); // 強制回到Idle動畫
                } else if (this.state === PlayerState.HoldingSnowball) {
                    // 丟出雪球
                    this.throwSnowball();
                }
                break;
        }
    }

    start () {

    }

    // 生命減少與顯示
    loseLife() {
        this.life = Math.max(0, this.life - 1);
        if (this.lifeNode) {
            for (let i = 0; i < this.lifeNode.children.length; i++) {
                this.lifeNode.children[i].active = i < this.life;
            }
        }
        // TODO: 死亡處理
    }

    update(dt: number) {
        if (this.state === PlayerState.Frozen) return;
        // 製作雪球流程
        if (this.state === PlayerState.MakingSnowball) {
            this.snowballTimer += dt;
            if (this.snowballBar) {
                this.snowballBar.node.active = true;
                this.snowballBar.progress = Math.min(this.snowballTimer / this.snowballMakingTime, 1);
            }
            if (this.snowballTimer >= this.snowballMakingTime) {
                this.hasSnowball = true;
                this.state = PlayerState.HoldingSnowball;
                if (this.snowballBar) this.snowballBar.node.active = false;
                // TODO: 顯示雪球在手上
            }
            if (this.anim && !this.anim.getAnimationState(this.makeAnimName).isPlaying) {
                this.anim.play(this.makeAnimName);
            }
            // 製作雪球時不 applyForce，不再滑行
            if (this.rb) this.rb.linearVelocity = cc.v2(0, 0);
            return;
        } else if (this.snowballBar) {
            this.snowballBar.node.active = false;
        }
        // 移動
        let dx = 0, dy = 0;
        if (this.keys['up']) dy += 1;
        if (this.keys['down']) dy -= 1;
        if (this.keys['left']) dx -= 1;
        if (this.keys['right']) dx += 1;
        // 方向判斷與動畫
        if (dx !== 0) {
            this.faceRight = dx > 0;
            this.node.scaleX = this.faceRight ? 1 : -1;
        }
        // 動畫切換（Loaded 狀態優先）
        if (this.hasSnowball) {
            if (dx !== 0 || dy !== 0) {
                if (this.anim && !this.anim.getAnimationState(this.runLoadedAnimName).isPlaying) {
                    this.anim.play(this.runLoadedAnimName);
                }
            } else {
                if (this.anim && !this.anim.getAnimationState(this.idleLoadedAnimName).isPlaying) {
                    this.anim.play(this.idleLoadedAnimName);
                }
            }
            // 移動與狀態切換
            if (dx !== 0 || dy !== 0) {
                let len = Math.sqrt(dx * dx + dy * dy);
                dx /= len;
                dy /= len;
                if (this.rb) {
                    // 冰上滑行感：用較小力道
                    this.rb.applyForceToCenter(cc.v2(dx * this.moveSpeed * 5, dy * this.moveSpeed * 5), true);
                }
                this.state = PlayerState.HoldingSnowball;
            } else {
                // 不主動設 linearVelocity = 0，讓滑行自然減速
                if (this.state === PlayerState.HoldingSnowball) {
                    this.state = PlayerState.HoldingSnowball;
                }
            }
            // 手上雪球顯示控制
            if (this.handSnowball) this.handSnowball.active = true;
            // Loaded 狀態下 return，不進入一般動畫切換
            if (this.slowTimer > 0) {
                this.slowTimer -= dt;
                this.moveSpeed = this.slowSpeed;
                this.node.color = this.slowColor;
                if (this.slowTimer <= 0) {
                    this.moveSpeed = this.normalSpeed;
                    this.node.color = this.normalColor;
                }
            }
            return;
        }
        if (dx !== 0 || dy !== 0) {
            if (this.anim && !this.anim.getAnimationState(this.runAnimName).isPlaying) {
                this.anim.play(this.runAnimName);
            }
            let len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
            if (this.rb) {
                // 冰上滑行感：用較小力道
                this.rb.applyForceToCenter(cc.v2(dx * this.moveSpeed * 5, dy * this.moveSpeed * 5), true);
            }
            this.state = this.hasSnowball ? PlayerState.HoldingSnowball : PlayerState.Moving;
        } else {
            // 不主動設 linearVelocity = 0，讓滑行自然減速
            if (this.state === PlayerState.Moving) {
                if (this.anim && !this.anim.getAnimationState(this.idleAnimName).isPlaying) {
                    this.anim.play(this.idleAnimName);
                }
                this.state = PlayerState.Idle;
            }
        }

        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            this.moveSpeed = this.slowSpeed;
            this.node.color = this.slowColor;
            if (this.slowTimer <= 0) {
                this.moveSpeed = this.normalSpeed;
                this.node.color = this.normalColor;
            }
        }

        // 手上雪球顯示控制
        if (this.handSnowball) this.handSnowball.active = this.hasSnowball;
    }

    // 物理碰撞回調
    onBeginContact(contact: cc.PhysicsContact, selfCollider: cc.PhysicsCollider, otherCollider: cc.PhysicsCollider) {
        // 假設雪球的 group/tag 是 'SnowBall'
        if (otherCollider.node.group === 'SnowBall') {
            // 顯示雪球FX
            if (this.hitFXPrefab) {
                const fx = cc.instantiate(this.hitFXPrefab);
                fx.parent = this.node.parent;
                fx.x = this.node.x;
                fx.y = this.node.y + 20; // 稍微在頭上
            }
            // 緩速與變藍
            this.slowTimer = 2.0; // 2秒緩速
            // 扣血
            this.loseLife();
            // 不要改變玩家速度，不會被打歪
        }
    }

    @property
    team: string = 'A'; // 玩家隊伍，可在編輯器設定
    throwSnowball() {
        if (!this.hasSnowball || !this.snowballPrefab) return;
        if (this.anim) this.anim.play(this.throwAnimName);
        const snowball = cc.instantiate(this.snowballPrefab);
        const dir = this.faceRight ? 1 : -1;
        const offset = 40;
        snowball.parent = this.node.parent;
        snowball.x = this.node.x + dir * offset;
        snowball.y = this.node.y;
        // 初始化雪球方向與發射者 team
        const snowballScript = snowball.getComponent('SnowBall');
        if (snowballScript) {
            snowballScript.init(cc.v2(dir, 0), this.team);
        }
        this.hasSnowball = false;
        this.state = PlayerState.Idle;
        if (this.handSnowball) this.handSnowball.active = false;
        if (this.anim) this.anim.play(this.idleAnimName);
    }
}
