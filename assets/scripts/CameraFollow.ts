const {ccclass, property} = cc._decorator;
import { PlayerData, PlayerAvatar } from "./types/DataTypes";
import { PlayerControl } from "./PlayerControl";
import OtherPlayers from "./OtherPlayers";

enum CameraState {
    FOLLOW_PLAYER,
    FOLLOW_OTHER,
}

@ccclass
export default class CameraFollow extends cc.Component {
    @property(cc.Vec2)
    followOffset: cc.Vec2 = cc.v2(0, 0);
    @property(cc.Float)
    smoothFollow: number = 0.1;

    @property(cc.Node)
    selfDisplay: cc.Node = null;
    @property(cc.Node)
    otherPlayer1: cc.Node = null;
    @property(cc.Node)
    otherPlayer2: cc.Node = null;
    @property(cc.Node)
    otherPlayer3: cc.Node = null;

    @property(cc.Button)
    backButton: cc.Button = null;
    @property(cc.Label)
    moneyLabel: cc.Label = null;

    private parentPlayer: PlayerControl = null;
    private playerIndex: Map<number, number> = new Map();

    private currentCameraState: CameraState = CameraState.FOLLOW_PLAYER;
    private targetPlayerId: number = 0;

    private mapMinX: number = -Infinity;
    private mapMaxX: number = Infinity;
    private mapMinY: number = -Infinity;
    private mapMaxY: number = Infinity;

    private cameraComponent: cc.Camera = null;

    public initPlayers(players: Map<number, PlayerData>) {
        if (!players || players.size === 0) {
            console.error("No players provided to initialize camera.");
            return;
        }

        let index = 1;
        players.forEach((playerData, playerId) => {
            this.playerIndex.set(index, playerId);
            index++;
        });
    }

    switchToOtherPlayer(index: number) {
        if (index < 1 || index > 3) {
            console.error("Invalid player index. Must be between 1 and 3.");
            return;
        }

        this.targetPlayerId = this.playerIndex.get(index);
        this.currentCameraState = CameraState.FOLLOW_OTHER;
        console.log(`Switched camera to follow player with ID: ${this.targetPlayerId}`);
    }

    getTargetPosition(): cc.Vec2 {
        if (this.targetPlayerId === 0) {
            console.error("Target player ID is not set.");
            return cc.v2(0, 0);
        }

        const parentPosition = this.parentPlayer.getPlayerPosition(this.parentPlayer.playerId);
        const targetPosition = this.parentPlayer.getPlayerPosition(this.targetPlayerId).sub(parentPosition);
        return targetPosition;
    }

    onLoad() {
        this.parentPlayer = this.node.getParent().getComponent(PlayerControl);

        this.cameraComponent = this.getComponent(cc.Camera);
        if (!this.cameraComponent) {
            console.error("CameraFollow: cc.Camera component not found on this node!");
        }

        // Handle button clicks to switch camera state
        this.otherPlayer1.getChildByName("Route").on('click', () => this.switchToOtherPlayer(1));
        this.otherPlayer2.getChildByName("Route").on('click', () => this.switchToOtherPlayer(2));
        this.otherPlayer3.getChildByName("Route").on('click', () => this.switchToOtherPlayer(3));

        this.backButton.node.on('click', () => {
            this.currentCameraState = CameraState.FOLLOW_PLAYER;
        });

        this.setMapBoundaries();
    }

    lateUpdate(dt) {
        // Show/hide backButton based on camera state
        if (this.backButton) {
            this.backButton.node.active = (this.currentCameraState === CameraState.FOLLOW_OTHER);
        }

        if(this.currentCameraState === CameraState.FOLLOW_PLAYER) {
            // Clamp position within bounds
            const targetX = cc.misc.clampf(0, this.mapMinX, this.mapMaxX);
            const targetY = cc.misc.clampf(0, this.mapMinY, this.mapMaxY);

            // Smooth follow
            const currentX = cc.misc.lerp(this.node.x, targetX, this.smoothFollow);
            const currentY = cc.misc.lerp(this.node.y, targetY, this.smoothFollow);
            
            // Apply position to camera
            this.node.setPosition(currentX, currentY);
        }else if(this.currentCameraState === CameraState.FOLLOW_OTHER) {
            const targetPosition = this.getTargetPosition();
            this.node.setPosition(targetPosition);
        }
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