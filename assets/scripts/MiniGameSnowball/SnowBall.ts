// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

const { ccclass, property } = cc._decorator;

@ccclass
export default class SnowBall extends cc.Component {
    @property
    speed: number = 600;
    private direction: cc.Vec2 = cc.v2(1, 0);
    private isActive: boolean = false;

    // 初始化雪球方向
    init(dir: cc.Vec2) {
        this.direction = dir.normalize();
        this.isActive = true;
    }

    update(dt: number) {
        if (!this.isActive) return;
        this.node.x += this.direction.x * this.speed * dt;
        this.node.y += this.direction.y * this.speed * dt;
        // TODO: 邊界檢查、碰撞偵測
    }

    onCollisionEnter(other: cc.Collider, self: cc.Collider) {
        // TODO: 判斷是否擊中玩家，呼叫玩家被擊中邏輯
        this.isActive = false;
        this.node.destroy();
    }
}
