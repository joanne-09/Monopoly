// filepath: c:\Monopoly Game\Monopoly\assets\scripts\MiniGameBalloon\BalloonPlayerController.ts
const {ccclass, property} = cc._decorator;
import Balloon, { BalloonKeyCode } from "./Balloon"; 
import NetworkManager from "../NetworkManager";
import { PhotonEventCodes } from "../types/PhotonEventCodes";

@ccclass
export default class BalloonPlayerController extends cc.Component {

    @property(cc.Node)
    cursor: cc.Node = null; 

    private gameManager: any = null; 
    private networkManager: NetworkManager = null;
    private myActorNr: number = -1;
    private isLocalPlayer: boolean = true; 

    onLoad () {
        this.networkManager = NetworkManager.getInstance();
        if (this.networkManager) {
            this.myActorNr = this.networkManager.getMyActorNumber();
        } else {
            cc.error("[BalloonPlayerController] NetworkManager not found!");
        }
        
        if (cc.sys.isBrowser) {
            // cc.game.canvas.style.cursor = 'none';
        }

        // Corrected event types using string literals as a fallback if specific enums are not present
        this.node.on(cc.Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    init(gameManager: any) {
        this.gameManager = gameManager;
        if (!this.gameManager) {
            cc.error("[BalloonPlayerController] GameManager not properly initialized!");
        }
    }

    onDestroy() {
        this.node.off(cc.Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        if (cc.sys.isBrowser) {
            // cc.game.canvas.style.cursor = 'auto';
        }
    }

    onMouseMove(event: cc.Event.EventMouse) {
        if (!this.cursor || !this.isLocalPlayer) return;
        // Convert mouse location to node space of the cursor's parent (usually the Canvas)
        let locationInView = event.getLocation();
        let nodeSpaceLocation = this.cursor.parent.convertToNodeSpaceAR(locationInView);
        this.cursor.setPosition(nodeSpaceLocation);
    }

    onKeyDown(event: cc.Event.EventKeyboard) {
        if (!this.isLocalPlayer || !this.gameManager || !this.cursor || this.gameManager.getIsGameOver()) return;

        const keyPressed: BalloonKeyCode = event.keyCode as BalloonKeyCode; 
        const hoveredBalloon = this.getHoveredBalloon();

        if (hoveredBalloon && hoveredBalloon.requiredKeyCode === keyPressed) {
            if (this.networkManager && this.networkManager.isConnected()) {
                // Using a general purpose event code if a specific one for minigame actions isn't available.
                // Ensure PhotonEventCodes.SEND_MESSAGE or a similar general code is defined and handled.
                // The structure of the data sent should be agreed upon with the GameManager.
                this.networkManager.sendGameAction(PhotonEventCodes.SEND_MESSAGE, { 
                    type: 'balloon_pop_attempt', // Custom type to identify the action
                    balloonId: hoveredBalloon.balloonId,
                    playerId: this.myActorNr 
                });
            }
        }
    }

    getHoveredBalloon(): Balloon | null {
        if (!this.cursor || !this.gameManager || !this.gameManager.balloonLayer) return null;

        const worldCursorPos = this.cursor.parent.convertToWorldSpaceAR(this.cursor.getPosition());

        for (const balloonNode of this.gameManager.balloonLayer.children) {
            const balloonScript = balloonNode.getComponent(Balloon);
            if (balloonScript && balloonScript.isValid && balloonScript.isPointInside(worldCursorPos)) {
                return balloonScript;
            }
        }
        return null;
    }

    setRemotePlayer() {
        this.isLocalPlayer = false;
        if (this.cursor) {
            // this.cursor.active = false; 
        }
    }
}
