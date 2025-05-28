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

    private state: PlayerState = PlayerState.Idle;
    private keys: { [key: string]: boolean } = {};
    private moveSpeed: number = 200;
    private snowballMakingTime: number = 1.0; // 製作雪球所需秒數
    private snowballTimer: number = 0;
    private hasSnowball: boolean = false;

    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
        // 啟用物理系統
        cc.director.getPhysicsManager().enabled = true;
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
                    // 提前放開，取消製作
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
            if (this.snowballTimer >= this.snowballMakingTime) {
                this.hasSnowball = true;
                this.state = PlayerState.HoldingSnowball;
                // TODO: 顯示雪球在手上
            }
            return; // 製作雪球時不能移動
        }
        // 移動
        let dx = 0, dy = 0;
        if (this.keys['up']) dy += 1;
        if (this.keys['down']) dy -= 1;
        if (this.keys['left']) dx -= 1;
        if (this.keys['right']) dx += 1;
        if (dx !== 0 || dy !== 0) {
            let len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
            this.node.x += dx * this.moveSpeed * dt;
            this.node.y += dy * this.moveSpeed * dt;
            this.state = this.hasSnowball ? PlayerState.HoldingSnowball : PlayerState.Moving;
        } else if (this.state === PlayerState.Moving) {
            this.state = PlayerState.Idle;
        }
    }

    // 物理碰撞回調
    onBeginContact(contact: cc.PhysicsContact, selfCollider: cc.PhysicsCollider, otherCollider: cc.PhysicsCollider) {
        // TODO: 判斷是否被雪球擊中，處理緩速/冰凍等效果
    }

    throwSnowball() {
        if (!this.hasSnowball || !this.snowballPrefab) return;
        // 1. 生成雪球
        const snowball = cc.instantiate(this.snowballPrefab);
        // 2. 設定生成位置（玩家前方）
        const forward = this.getMoveDirection();
        const offset = 40; // 雪球生成在玩家前方一點
        snowball.parent = this.node.parent;
        snowball.x = this.node.x + forward.x * offset;
        snowball.y = this.node.y + forward.y * offset;
        // 3. 設定發射方向與速度
        const rb = snowball.getComponent(cc.RigidBody);
        if (rb) {
            const force = 1200;
            rb.linearVelocity = cc.v2(forward.x * force, forward.y * force);
        }
        this.hasSnowball = false;
        this.state = PlayerState.Idle;
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
