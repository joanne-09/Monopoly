// filepath: c:\Monopoly Game\Monopoly\assets\scripts\MiniGameBalloon\BalloonPlayerController.ts
const {ccclass, property} = cc._decorator;
import Balloon, { BalloonKeyCode } from "./Balloon"; 
import NetworkManager from "../NetworkManager";
import { PhotonEventCodes } from "../types/PhotonEventCodes";
import BalloonGameManager from "./BalloonGameManager";

@ccclass
export default class BalloonPlayerController extends cc.Component {

    // This cursor node will be assigned by BalloonGameManager
    // Do not assign it in the editor directly on this component's node if using the playerCursors array in GameManager
    public cursor: cc.Node = null; 

    private gameManager: BalloonGameManager = null; 
    private networkManager: NetworkManager = null;
    private myActorNr: number = -1;
    private inputEnabled: boolean = true;

    // Time interval for sending cursor updates (in seconds)
    private readonly CURSOR_UPDATE_INTERVAL = 0.1; // 10 times per second
    private timeSinceLastCursorUpdate: number = 0;

    onLoad () {
        this.networkManager = NetworkManager.getInstance();
        if (this.networkManager) {
            this.myActorNr = this.networkManager.getMyActorNumber();
        } else {
            cc.error("[BalloonPlayerController] NetworkManager not found!");
            this.inputEnabled = false;
            return;
        }
        
        // Mouse move and key down listeners are for the local player
        this.node.on(cc.Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);

        // Hide the OS cursor if this controller is active for the local player
        if (cc.sys.isBrowser) {
            // Consider doing this only if this instance is the local player's controller
            // cc.game.canvas.style.cursor = 'none'; 
        }
    }

    // Called by BalloonGameManager to assign the specific cursor node and game manager instance
    public initialize(manager: BalloonGameManager, cursorNode: cc.Node) {
        this.gameManager = manager;
        this.cursor = cursorNode;
        if (!this.gameManager) {
            cc.error("[BalloonPlayerController] GameManager not properly initialized!");
            this.inputEnabled = false;
        }
        if (!this.cursor) {
            cc.error("[BalloonPlayerController] Cursor node not assigned during initialization!");
            this.inputEnabled = false;
        }
        if (this.cursor) this.cursor.active = true; // Ensure assigned cursor is active
    }
    
    // Method for GameManager to assign the cursor node if not done at init or needs changing
    public setCursorNode(cursorNode: cc.Node) {
        this.cursor = cursorNode;
        if (this.cursor) { // Corrected: Added braces for the if statement
            this.cursor.active = true; // Make sure it's visible
        } else {
            cc.warn("[BalloonPlayerController] Attempted to set a null cursor node.");
        }
    }

    update(dt: number) {
        if (!this.inputEnabled || !this.cursor || !this.networkManager || !this.networkManager.isConnected()) return;

        this.timeSinceLastCursorUpdate += dt;
        if (this.timeSinceLastCursorUpdate >= this.CURSOR_UPDATE_INTERVAL) {
            this.timeSinceLastCursorUpdate = 0;
            // Send cursor position if it has moved or periodically
            // The cursor position is relative to its parent (e.g., Canvas or a UI layer)
            this.networkManager.sendGameAction(PhotonEventCodes.MINIGAME_BALLOON_CURSOR_MOVE, {
                // actorNr is automatically included by NetworkManager
                position: { x: this.cursor.x, y: this.cursor.y }
            });
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
        if (!this.inputEnabled || !this.cursor) return;
        
        let locationInView = event.getLocation(); // Mouse location in screen coordinates
        // Convert mouse location to the node space of the cursor's parent
        // This assumes the cursor node is a direct child of the node that defines the game area (e.g., Canvas)
        if (this.cursor.parent) {
            let nodeSpaceLocation = this.cursor.parent.convertToNodeSpaceAR(locationInView);
            this.cursor.setPosition(nodeSpaceLocation);
        } else {
            cc.warn("[BalloonPlayerController] Cursor has no parent, cannot set position from mouse move.");
        }
    }

    onKeyDown(event: cc.Event.EventKeyboard) {
        if (!this.inputEnabled || !this.gameManager || !this.cursor || this.gameManager.getIsGameOver()) return;

        const keyPressed: BalloonKeyCode = event.keyCode as BalloonKeyCode; 
        const hoveredBalloon = this.getHoveredBalloon();

        if (hoveredBalloon) { // No need to check requiredKeyCode here, master will validate
            if (this.networkManager && this.networkManager.isConnected()) {
                cc.log(`[BalloonPlayerController] Attempting to pop ${hoveredBalloon.balloonId} with key ${BalloonKeyCode[keyPressed]}`);
                this.networkManager.sendGameAction(PhotonEventCodes.MINIGAME_BALLOON_POP_ATTEMPT, { 
                    balloonId: hoveredBalloon.balloonId,
                    playerId: this.myActorNr, // The player attempting the pop
                    keyCodeAttempted: keyPressed // The key that was pressed
                });
            }
        } else {
            // cc.log("[BalloonPlayerController] Key pressed, but no balloon hovered.");
        }
    }

    getHoveredBalloon(): Balloon | null {
        if (!this.inputEnabled || !this.cursor || !this.gameManager || !this.gameManager.getBalloonLayer()) return null;

        const worldCursorPos = this.cursor.parent.convertToWorldSpaceAR(this.cursor.getPosition());

        const activeBalloons = this.gameManager.getActiveBalloons();
        let hoveredBalloon: Balloon = null;
        activeBalloons.forEach(balloon => {
            if (balloon && balloon.node && balloon.isValid && !balloon.isPopped) {
                 if (balloon.isPointInside(worldCursorPos)) {
                    hoveredBalloon = balloon;
                }
            }
        });
        return hoveredBalloon;
    }

    public disableInput() {
        this.inputEnabled = false;
        if (this.cursor) {
            // this.cursor.active = false; // Optionally hide cursor when input is disabled
        }
        cc.log("[BalloonPlayerController] Input disabled.");
    }
}
