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
    private team: string = 'A'; // 發射者 team
    @property({ type: cc.Prefab }) hitFXPrefab: cc.Prefab = null; // 可選，若Prefab沒設可自動尋找

    // 初始化雪球方向與 team
    init(dir: cc.Vec2, team: string = 'A') {
        this.direction = dir.normalize();
        this.isActive = true;
        this.team = team;
        // 用物理推動
        const rb = this.node.getComponent(cc.RigidBody);
        if (rb) {
            rb.linearVelocity = this.direction.mul(this.speed);
        }
    }

    update(dt: number) {
        if (!this.isActive) return;
        // 物理推動已由剛體處理，這裡只做邊界檢查
        const pos = this.node.convertToWorldSpaceAR(cc.v2(0, 0));
        const winSize = cc.view.getVisibleSize();
        if (
            pos.x < -100 || pos.x > winSize.width + 100 ||
            pos.y < -100 || pos.y > winSize.height + 100
        ) {
            this.node.destroy();
            return;
        }
    }

    onBeginContact(contact: cc.PhysicsContact, selfCollider: cc.PhysicsCollider, otherCollider: cc.PhysicsCollider) {
        // 只處理 Player group
        if (otherCollider.node.group === 'Player') {
            const playerCtrl = otherCollider.node.getComponent('PlayerController');
            if (playerCtrl && playerCtrl.team === this.team) {
                // 同隊，讓雪球穿過：設為 sensor 不處理碰撞
                contact.disabled = true;
                return;
            }
            // 擊中敵隊玩家：扣血、加分
            if (playerCtrl && playerCtrl.team !== this.team) {
                playerCtrl.loseLife();
                // 加分
                const gm = cc.find('Canvas')?.getComponentInChildren('GameManager');
                if (gm && typeof gm.addScore === 'function') {
                    gm.addScore(this.team, 1);
                }
                // 產生雪球擊中特效（直接用 playerCtrl 的 hitFXPrefab）
                let fxPrefab = this.hitFXPrefab || (playerCtrl && playerCtrl.hitFXPrefab);
                if (fxPrefab) {
                    const fx = cc.instantiate(fxPrefab);
                    fx.parent = this.node.parent;
                    fx.x = this.node.x;
                    fx.y = this.node.y + 20;
                }
                this.isActive = false;
                this.node.destroy();
                return;
            }
        }
        if (otherCollider.node.group === 'Wall') {
            // 產生雪球擊中特效
            let fxPrefab = this.hitFXPrefab;
            if (fxPrefab) {
                const fx = cc.instantiate(fxPrefab);
                fx.parent = this.node.parent;
                fx.x = this.node.x;
                fx.y = this.node.y + 20;
            }
            this.isActive = false;
            this.node.destroy();
        }
    }
}
