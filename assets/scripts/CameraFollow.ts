const {ccclass, property} = cc._decorator;

@ccclass
export default class CameraFollow extends cc.Component {
    @property(cc.Node)
    targetPlayer: cc.Node = null;
    @property(cc.Vec2)
    followOffset: cc.Vec2 = cc.v2(0, 0);
    @property(cc.Float)
    smoothFollow: number = 0.1;

    @property(cc.Button)
    otherPlayer1: cc.Button = null;
    @property(cc.Button)
    otherPlayer2: cc.Button = null;
    @property(cc.Button)
    otherPlayer3: cc.Button = null;

    private mapMinX: number = -Infinity;
    private mapMaxX: number = Infinity;
    private mapMinY: number = -Infinity;
    private mapMaxY: number = Infinity;

    private cameraComponent: cc.Camera = null;

    onLoad() {
        this.targetPlayer = this.node.getParent();

        this.cameraComponent = this.getComponent(cc.Camera);
        if (!this.cameraComponent) {
            console.error("CameraFollow: cc.Camera component not found on this node!");
        }

        this.setMapBoundaries();
    }

    lateUpdate(dt) {
        if (!this.targetPlayer) return;

        // Clamp position within bounds
        const targetX = cc.misc.clampf(0, this.mapMinX, this.mapMaxX);
        const targetY = cc.misc.clampf(0, this.mapMinY, this.mapMaxY);

        // Smooth follow
        const currentX = cc.misc.lerp(this.node.x, targetX, this.smoothFollow);
        const currentY = cc.misc.lerp(this.node.y, targetY, this.smoothFollow);
        
        // Apply position to camera
        this.node.setPosition(currentX, currentY);
    }

    setMapBoundaries() {
        // Get the viewport size
        const visibleSize = cc.view.getVisibleSize();
        const halfWidth = visibleSize.width / 2;
        const halfHeight = visibleSize.height / 2;
        
        // Adjust bounds based on background size
        this.mapMinX = -1600 + halfWidth;
        this.mapMaxX = 1600 - halfWidth;
        this.mapMinY = -1600 + halfHeight;
        this.mapMaxY = 1600 - halfHeight;
    }
}