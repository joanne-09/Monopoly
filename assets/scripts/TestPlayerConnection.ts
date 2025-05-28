import NetworkManager from "./NetworkManager";
import { PlayerMoveEvent } from "./types/GameEvents";
import { PhotonEventCodes } from "./types/PhotonEventCodes";
const { ccclass, property } = cc._decorator;

@ccclass
export default class TestPlayerConnection extends cc.Component {

    @property(cc.Sprite)
    localPlayerAvatar: cc.Sprite = null;

    @property
    spriteIndex = 0;// Set this to 0, 1, 2, 3 for each player sprite in the editor

    private photonAssignedPlayerId: string = "";
    private networkManager: NetworkManager = null;
    private isLocalPlayer: boolean = false;
    private isInitialized: boolean = false;

    private keys: { [key: string]: boolean } = {};

    private handleReceiveEvent(eventCode: number, content: any, actorNr: number) {
        console.log(`Sprite ${this.spriteIndex} received event from actor ${actorNr}`);
        if (eventCode === PhotonEventCodes.PLAYER_MOVEMENT) {
            const playerMoveEvent: PlayerMoveEvent = content;
            console.log(`Movement event for playerId: ${playerMoveEvent.playerId}, my spriteIndex: ${this.spriteIndex}, isLocalPlayer: ${this.isLocalPlayer}`);
                        if (playerMoveEvent.playerId === this.spriteIndex.toString() && !this.isLocalPlayer) {
                console.log(`Applying movement to sprite ${this.spriteIndex}`);
                this.node.x = playerMoveEvent.to.x;
                this.node.y = playerMoveEvent.to.y;
            }
        } else {
            console.warn(`Unhandled event code: ${eventCode}`);
        }
    }

    onLoad() {
        // Auto-assign sprite index based on node name
        if (this.node.name.includes("Player1") || this.node.name.includes("GRASS")) {
            this.spriteIndex = 1;
        } else if (this.node.name.includes("Player2") || this.node.name.includes("FIRE")) {
            this.spriteIndex = 2;
        } else if (this.node.name.includes("Player3") || this.node.name.includes("ICE")) {
            this.spriteIndex = 3;
        } else if (this.node.name.includes("Player4") || this.node.name.includes("ELECTRIC")) {
            this.spriteIndex = 4;
        }
        
        console.log(`Auto-assigned spriteIndex: ${this.spriteIndex} for node: ${this.node.name}`);
        
        this.scheduleOnce(() => {
            this.networkManager = NetworkManager.getInstance();
            if (!this.networkManager) {
                console.error("NetworkManager instance not found!");
                return;
            }

            // FIX: Only sprite 1 sets the message handler
            if (this.spriteIndex === 1) {
                this.networkManager.setMessageHandler((eventCode, content, actorNr) => {
                    // Find all TestPlayerConnection components and call their handlers
                    const scene = cc.director.getScene();
                    const allSprites = scene.getComponentsInChildren(TestPlayerConnection);
                    allSprites.forEach(sprite => {
                        sprite.handleReceiveEvent(eventCode, content, actorNr);
                    });
                });
                console.log("Message handler set by sprite 1");
            }
            
            if (!this.networkManager.isConnected()) {
                this.networkManager.connectToPhoton();
            }

            // Wait for connection to be established
            this.waitForConnection();
        }, 0.3);
    }

    private waitForConnection() {
        const checkConnection = () => {
            if (this.networkManager && this.networkManager.isConnected()) {
                this.photonAssignedPlayerId = this.networkManager.getMyActorNumber().toString();
                

                const myActorNumber = this.networkManager.getMyActorNumber();
                this.isLocalPlayer = myActorNumber === this.spriteIndex;
                console.log(`Sprite ${this.spriteIndex}: Actor ${myActorNumber}, isLocalPlayer: ${this.isLocalPlayer}`);
                
                // Only local player handles input
                if (this.isLocalPlayer) {
                    cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
                    cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
                    console.log(`Player ${myActorNumber} now controls sprite ${this.spriteIndex}`);
                }
                
                this.isInitialized = true;
            } else {
                // Check again in 100ms
                this.scheduleOnce(checkConnection, 0.1);
            }
        };
        
        checkConnection();
    }

    onDestroy() {
        if (this.isLocalPlayer) {
            cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
            cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
        }
    }

    sendMessage() {
        if (!this.networkManager || !this.isLocalPlayer || !this.isInitialized) return;
        console.log(`Sending movement message for sprite ${this.spriteIndex}`);
        const playerMoveEvent: PlayerMoveEvent = {
            type: "player_move",
            playerId: this.spriteIndex.toString(), // Use sprite index as player ID
            from: { x: this.lastSentX, y: this.lastSentY },
            to: { x: this.node.x, y: this.node.y },
            animation: "walk",
            timestamp: Date.now()
        };

        this.networkManager.sendGameAction(PhotonEventCodes.PLAYER_MOVEMENT, playerMoveEvent);
    }

    onKeyDown(event: cc.Event.EventKeyboard) {
        if (!this.isLocalPlayer) return;
        
        switch (event.keyCode) {
            case cc.macro.KEY.w:
                this.keys['w'] = true;
                break;
            case cc.macro.KEY.a:
                this.keys['a'] = true;
                break;
            case cc.macro.KEY.s:
                this.keys['s'] = true;
                break;
            case cc.macro.KEY.d:
                this.keys['d'] = true;
                break;
        }
    }

    onKeyUp(event: cc.Event.EventKeyboard) {
        if (!this.isLocalPlayer) return;
        
        switch (event.keyCode) {
            case cc.macro.KEY.w:
                this.keys['w'] = false;
                break;
            case cc.macro.KEY.a:
                this.keys['a'] = false;
                break;
            case cc.macro.KEY.s:
                this.keys['s'] = false;
                break;
            case cc.macro.KEY.d:
                this.keys['d'] = false;
                break;
        }
    }

    private lastSentX: number = 0;
    private lastSentY: number = 0;

    update(dt: number) {
        // Only local player can move their assigned sprite
        if (!this.isLocalPlayer || !this.isInitialized) return;
        
        let speed = 200;
        let dx = 0, dy = 0;
        
        if (this.keys['w']) dy += 1;
        if (this.keys['s']) dy -= 1;
        if (this.keys['a']) dx -= 1;
        if (this.keys['d']) dx += 1;
        
        if (dx !== 0 || dy !== 0) {
            let len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
            this.node.x += dx * speed * dt;
            this.node.y += dy * speed * dt;

            if (Math.abs(this.node.x - this.lastSentX) > 1 || Math.abs(this.node.y - this.lastSentY) > 1) {
                this.sendMessage();
                this.lastSentX = this.node.x;
                this.lastSentY = this.node.y;
            }
        }
    }
}