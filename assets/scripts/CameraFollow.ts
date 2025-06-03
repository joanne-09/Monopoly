const {ccclass, property} = cc._decorator;

@ccclass
export default class CameraFollow extends cc.Component {

    @property(cc.Node)
    targetPlayer: cc.Node = null;

    // Optional: Offset the camera from the target's center if needed.
    // For a 2D game, this usually means how the player is framed.
    // A (0,0) offset means the player will be centered in this camera's view.
    @property(cc.Vec2)
    followOffset: cc.Vec2 = cc.v2(0, 0);

    // Optional: Smoothing factor for camera movement (0 to 1). 1 is instant, lower values are smoother.
    // @property({type: cc.Float, range: [0, 1], slide: true, step: 0.01})
    // smoothSpeed: number = 1; // Set to 1 for direct follow initially

    lateUpdate(dt: number) {
        if (!this.targetPlayer) {
            return;
        }

        // Get the target's world position
        const targetWorldPosition = this.targetPlayer.convertToWorldSpaceAR(cc.Vec2.ZERO);

        // The camera's node is typically a root node or child of the canvas.
        // We want the camera's (x, y) to match the target's world (x, y), adjusted by followOffset.
        // The camera's z position usually remains fixed for a 2D view.
        
        let desiredX = targetWorldPosition.x - this.followOffset.x;
        let desiredY = targetWorldPosition.y - this.followOffset.y;

        // For direct follow:
        this.node.setPosition(desiredX, desiredY);

        // Optional: For smooth follow (uncomment smoothSpeed property too):
        // if (this.smoothSpeed < 1) {
        //     let currentPos = this.node.getPosition();
        //     let smoothedX = cc.misc.lerp(currentPos.x, desiredX, this.smoothSpeed);
        //     let smoothedY = cc.misc.lerp(currentPos.y, desiredY, this.smoothSpeed);
        //     this.node.setPosition(smoothedX, smoothedY);
        // } else {
        //     this.node.setPosition(desiredX, desiredY);
        // }
    }
}