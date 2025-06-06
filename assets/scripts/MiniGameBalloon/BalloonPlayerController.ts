// filepath: c:\Monopoly Game\Monopoly\assets\scripts\MiniGameBalloon\BalloonPlayerController.ts
const {ccclass, property} = cc._decorator;
import Balloon from "./Balloon"; 
import NetworkManager from "../NetworkManager";
import { PhotonEventCodes } from "../types/PhotonEventCodes";
import BalloonGameManager from "./BalloonGameManager";

@ccclass
export default class BalloonPlayerController extends cc.Component {
    private static instanceCounter = 0; // Static counter for instance IDs
    private instanceId: number;         // Unique ID for this instance

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
        this.instanceId = BalloonPlayerController.instanceCounter++;
        cc.log(`[BPC ${this.instanceId}] onLoad called for node: ${this.node.name}`);
        this.networkManager = NetworkManager.getInstance();
        if (this.networkManager) {
            this.myActorNr = this.networkManager.getMyActorNumber();
        } else {
            cc.error(`[BPC ${this.instanceId}] NetworkManager not found!`);
            this.inputEnabled = false;
            return;
        }
        
        const canvasNode = cc.director.getScene()?.getChildByName('Canvas'); // Added nullish coalescing for safety
        if (canvasNode) {
            cc.log(`[BPC ${this.instanceId}] Found Canvas node: Name='${canvasNode.name}', ActiveInHierarchy=${canvasNode.activeInHierarchy}, Path='${this.getNodePath(canvasNode)}'`);
            canvasNode.on(cc.Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
            canvasNode.on(cc.Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
            canvasNode.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this); // Added TOUCH_START listener
            cc.log(`[BPC ${this.instanceId}] MOUSE_MOVE, MOUSE_DOWN, and TOUCH_START listeners registered on Canvas: ${canvasNode.name}`);
        } else {
            cc.error(`[BPC ${this.instanceId}] Canvas node not found in onLoad!`);
        }
        cc.log(`[BPC ${this.instanceId}] Controller Node activeInHierarchy: ${this.node.activeInHierarchy}, Component enabled: ${this.enabled}`);
    }

    // Called by BalloonGameManager to assign the specific cursor node and game manager instance
    public initialize(manager: BalloonGameManager, cursorNode: cc.Node) {
        cc.log(`[BPC ${this.instanceId}] initialize called. GameManager will be assigned: ${!!manager}, Cursor will be assigned: ${!!cursorNode}.`);
        this.gameManager = manager;
        this.cursor = cursorNode;
        cc.log(`[BPC ${this.instanceId}] initialize complete. GameManager assigned: ${!!this.gameManager}, Cursor assigned: ${!!this.cursor}`);
        if (!this.gameManager) {
            cc.error(`[BPC ${this.instanceId}] GameManager not properly initialized!`);
            this.inputEnabled = false;
        }
        if (!this.cursor) {
            cc.error(`[BPC ${this.instanceId}] Cursor node not assigned during initialization!`);
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
            this.networkManager.sendGameAction(PhotonEventCodes.MINIGAME_BALLOON_CURSOR_MOVE, {
                position: { x: this.cursor.x, y: this.cursor.y }
            });
        }
    }

    onDestroy() {
        cc.log(`[BPC ${this.instanceId}] onDestroy called for node: ${this.node.name}`);
        const canvasNode = cc.director.getScene()?.getChildByName('Canvas'); // Added nullish coalescing for safety
        if (canvasNode) {
            canvasNode.off(cc.Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
            canvasNode.off(cc.Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
            canvasNode.off(cc.Node.EventType.TOUCH_START, this.onTouchStart, this); // Added TOUCH_START unregister
        }
    }

    onMouseMove(event: cc.Event.EventMouse) {
        if (!this.inputEnabled || !this.cursor) return;
        let locationInView = event.getLocation();
        if (this.cursor.parent) {
            let nodeSpaceLocation = this.cursor.parent.convertToNodeSpaceAR(locationInView);
            this.cursor.setPosition(nodeSpaceLocation);
        }
    }

    onMouseDown(event: cc.Event.EventMouse) {
        cc.log(`[BPC ${this.instanceId}] onMouseDown triggered at the very start. Node: ${this.node.name}`); 
        cc.log(`[BPC ${this.instanceId}] Prerequisite check: inputEnabled=${this.inputEnabled}, cursor=${!!this.cursor}, gameManager=${!!this.gameManager}, isGameOver=${this.gameManager ? this.gameManager.getIsGameOver() : 'N/A'}`);
        if (!this.inputEnabled || !this.cursor || !this.gameManager || this.gameManager.getIsGameOver()) {
            cc.log(`[BPC ${this.instanceId}] onMouseDown prerequisites not met or game over.`);
            return;
        }
        const hoveredBalloon = this.getHoveredBalloon();
        const worldCursorPos = this.cursor.parent.convertToWorldSpaceAR(this.cursor.getPosition());
        
        cc.log(`[BPC ${this.instanceId}] onMouseDown details:`, {
            cursorWorldX: worldCursorPos.x.toFixed(2),
            cursorWorldY: worldCursorPos.y.toFixed(2),
            hoveredBalloonId: hoveredBalloon ? hoveredBalloon.balloonId : null,
            hoveredBalloonNodeName: hoveredBalloon && hoveredBalloon.node ? hoveredBalloon.node.name : null
        });
        
        // const balloonLayer = this.gameManager.getBalloonLayer();
        // const canvasNode = cc.director.getScene().getChildByName('Canvas');
        // cc.log(`[BPC ${this.instanceId}] world pos compare details:`, { 
        //     canvasWorld: canvasNode ? {x: canvasNode.convertToWorldSpaceAR(cc.v2(0,0)).x, y: canvasNode.convertToWorldSpaceAR(cc.v2(0,0)).y} : null,
        //     balloonLayerWorld: balloonLayer ? {x: balloonLayer.convertToWorldSpaceAR(cc.v2(0,0)).x, y: balloonLayer.convertToWorldSpaceAR(cc.v2(0,0)).y} : null,
        //     cursorParentWorld: this.cursor.parent ? {x: this.cursor.parent.convertToWorldSpaceAR(cc.v2(0,0)).x, y: this.cursor.parent.convertToWorldSpaceAR(cc.v2(0,0)).y} : null
        // });

        if (hoveredBalloon) {
            cc.log(`[BPC ${this.instanceId}] Hovered balloon confirmed: ${hoveredBalloon.balloonId}. Sending pop attempt.`);
            if (this.networkManager && this.networkManager.isConnected()) {
                this.networkManager.sendGameAction(PhotonEventCodes.MINIGAME_BALLOON_POP_ATTEMPT, {
                    balloonId: hoveredBalloon.balloonId,
                    playerId: this.myActorNr
                });
            }
        } else {
            cc.log(`[BPC ${this.instanceId}] No balloon hovered at cursor position.`);
        }
    }

    // New helper method to get the node's path in the scene
    private getNodePath(node: cc.Node): string {
        let path = node.name;
        let parent = node.parent;
        while (parent && parent.name !== '' && parent.name !== 'Scene' && parent.parent) { // Iterate while parent is valid and not the scene root
            path = parent.name + '/' + path;
            parent = parent.parent;
        }
        return path;
    }

    // New event handler for TOUCH_START
    private onTouchStart(event: cc.Event.EventTouch) {
        cc.log('[BalloonPlayerController] onTouchStart triggered on Canvas!');
        // Optionally, you could try to simulate a mouse down event here for testing if touch works but mouse doesn't
        // For example, by directly calling parts of onMouseDown or a shared handler.
        // However, ensure the event object is compatible or handled appropriately.
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
