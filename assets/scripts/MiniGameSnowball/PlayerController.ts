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
    private handSnowball: cc.Node = null;
    private slowTimer: number = 0;
    private normalSpeed: number = 200;
    private slowSpeed: number = 80;
    private normalColor: cc.Color = cc.Color.WHITE;
    private slowColor: cc.Color = new cc.Color(100, 100, 255);

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
        // 嘗試尋找手上的雪球節點（命名 handSnowball，預設隱藏）
        this.handSnowball = this.node.getChildByName('handSnowball');
        if (this.handSnowball) this.handSnowball.active = false;
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
                    // 提前放开，取消製作
                    this.state = PlayerState.Idle;
                    this.snowballTimer = 0;
                } else if (this.state === PlayerState.HoldingSnowball) {
                    // 丟出雪球
                    this.throwSnowball();
                }
                break;
        }
    }

    start () {

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
            return; // 製作雪球時不能移動
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
        if (dx !== 0 || dy !== 0) {
            if (this.anim && !this.anim.getAnimationState(this.runAnimName).isPlaying) {
                this.anim.play(this.runAnimName);
            }
            let len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
            this.node.x += dx * this.moveSpeed * dt;
            this.node.y += dy * this.moveSpeed * dt;
            this.state = this.hasSnowball ? PlayerState.HoldingSnowball : PlayerState.Moving;
        } else if (this.state === PlayerState.Moving) {
            if (this.anim && !this.anim.getAnimationState(this.idleAnimName).isPlaying) {
                this.anim.play(this.idleAnimName);
            }
            this.state = PlayerState.Idle;
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
            // TODO: 扣血、判斷冰凍
        }
    }

    throwSnowball() {
        if (!this.hasSnowball || !this.snowballPrefab) return;
        // 播放丟擲動畫
        if (this.anim) this.anim.play(this.throwAnimName);
        const snowball = cc.instantiate(this.snowballPrefab);
        // 只朝左右丟
        const dir = this.faceRight ? 1 : -1;
        const offset = 40;
        snowball.parent = this.node.parent;
        snowball.x = this.node.x + dir * offset;
        snowball.y = this.node.y;
        const rb = snowball.getComponent(cc.RigidBody);
        if (rb) {
            const force = 1200;
            rb.linearVelocity = cc.v2(dir * force, 0);
        }
        this.hasSnowball = false;
        this.state = PlayerState.Idle;
        if (this.handSnowball) this.handSnowball.active = false;
    }

    setLife(life: number) {
        this.life = Math.max(0, Math.min(3, life));
        if (this.lifeNode) {
            for (let i = 0; i < this.lifeNode.childrenCount; i++) {
                this.lifeNode.children[i].active = i < this.life;
            }
        }
    }

    // 取得目前移動方向，若靜止則預設向上
    getMoveDirection(): cc.Vec2 {
        let dx = 0, dy = 0;
        if (this.keys['up']) dy += 1;
        if (this.keys['down']) dy -= 1;
        if (this.keys['left']) dx -= 1;
        if (this.keys['right']) dx += 1;
        if (dx === 0 && dy === 0) return cc.v2(0, 1); // 預設向上
        let len = Math.sqrt(dx * dx + dy * dy);
        return cc.v2(dx / len, dy / len);
    }
}
