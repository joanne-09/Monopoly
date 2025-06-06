// filepath: c:\Monopoly Game\Monopoly\assets\scripts\MiniGameBalloon\Balloon.ts
const {ccclass, property} = cc._decorator;
import BalloonGameManager from "./BalloonGameManager";
import GameManager from "../GameManager";
export enum BalloonOperation {
    NONE,
    ADD,
    SUBTRACT,
    MULTIPLY,
    DIVIDE
}

@ccclass
export default class Balloon extends cc.Component {

    @property(cc.Label)
    valueLabel: cc.Label = null;

    @property(cc.Prefab)
    popFXPrefab: cc.Prefab = null;

    @property({type:cc.AudioClip})
    balloonPopSfx: cc.AudioClip = null;

    public balloonId: string = "";
    public points: number = 0;
    public operation: BalloonOperation = BalloonOperation.NONE;
    public operationValue: number = 0;
    public speed: number = 100; 
    public isPopped: boolean = false;

    private gameManager: BalloonGameManager = null;
    private gameHeightValue: number = 0; // Renamed to avoid conflict with Cocos internal gameHeight
    private gameWidthValue: number = 0; // Renamed to avoid conflict with Cocos internal gameWidth


    init(
        id: string,
        startPosition: cc.Vec2,
        gameWidth: number,
        gameHeight: number,
        manager: BalloonGameManager,
        points: number,
        operation: BalloonOperation,
        operationValue: number,
        speed: number
    ) {
        this.balloonId = id;
        this.node.setPosition(startPosition);
        this.gameWidthValue = gameWidth;
        this.gameHeightValue = gameHeight;
        this.gameManager = manager;

        this.points = points;
        this.operation = operation;
        this.operationValue = operationValue;
        this.speed = speed;
        this.isPopped = false;

        this.updateDisplay();
        this.updateScale(); // Add this line
    }

    isPointInside(worldPoint: cc.Vec2): boolean {
        if (!this.node || !this.node.parent || !this.node.activeInHierarchy) { // Added activeInHierarchy check
            // cc.warn(`[Balloon ${this.balloonId}] isPointInside check skipped: Node invalid or inactive.`);
            return false;
        }
        const boundingBox = this.node.getBoundingBoxToWorld();
        const contained = boundingBox.contains(worldPoint);
        
        if (contained) {
            cc.log(`[Balloon ${this.balloonId}] isPointInside: YES for worldPoint (${worldPoint.x.toFixed(1)}, ${worldPoint.y.toFixed(1)}). Balloon worldBox: x=${boundingBox.x.toFixed(1)}, y=${boundingBox.y.toFixed(1)}, w=${boundingBox.width.toFixed(1)}, h=${boundingBox.height.toFixed(1)}`);
        } else {
            // Optional: Log if not contained, can be noisy
            // cc.log(`[Balloon ${this.balloonId}] isPointInside: NO for worldPoint (${worldPoint.x.toFixed(1)}, ${worldPoint.y.toFixed(1)}). Balloon worldBox: x=${boundingBox.x.toFixed(1)}, y=${boundingBox.y.toFixed(1)}, w=${boundingBox.width.toFixed(1)}, h=${boundingBox.height.toFixed(1)}`);
        }
        return contained;
    }

    update(dt: number) {
        if (this.isPopped) return;

        this.node.y += this.speed * dt;

        const balloonTopEdge = this.node.y + (this.node.height * this.node.scaleY / 2);
        if (balloonTopEdge > this.gameHeightValue / 2) {
            this.despawn(); // 移除 debug log
        }
    }

    updateDisplay() {
        if (this.valueLabel) {
            let textToShow = "";
            switch (this.operation) {
                case BalloonOperation.ADD:
                    textToShow = `+${this.operationValue}`;
                    break;
                case BalloonOperation.SUBTRACT:
                    textToShow = `-${this.operationValue}`; // Assumes operationValue is positive magnitude
                    break;
                case BalloonOperation.MULTIPLY:
                    textToShow = `×${this.operationValue}`; // Shows the multiplier
                    break;
                case BalloonOperation.DIVIDE:
                    textToShow = `÷${this.operationValue}`; // Shows the divisor
                    break;
                case BalloonOperation.NONE:
                    textToShow = this.points > 0 ? this.points.toString() : "0"; // Fallback, though points is usually 0
                    break;
                default:
                    textToShow = "ERR";
                    break;
            }
            this.valueLabel.string = textToShow;
        }
        
    }

    updateScale() {
        const minScale = 0.85; // was 0.7
        const maxScale = 1.25; // was 1.8
        let valueForScaling = 0;
        const minOverallImpact = 10;
        const maxOverallImpact = 50; // was 100, now matches max allowed value
        switch (this.operation) {
            case BalloonOperation.ADD:
            case BalloonOperation.SUBTRACT:
                valueForScaling = Math.abs(this.operationValue);
                break;
            case BalloonOperation.MULTIPLY:
                valueForScaling = 50; // Only *2 allowed, treat as max impact
                break;
            default:
                this.node.scale = 1.0;
                if (isNaN(this.node.scaleX) || this.node.scaleX < minScale) {
                    this.node.scale = minScale;
                }
                return;
        }
        let normalizedImpact = (valueForScaling - minOverallImpact) / (maxOverallImpact - minOverallImpact);
        normalizedImpact = Math.max(0, Math.min(1, normalizedImpact));
        let targetScale = minScale + normalizedImpact * (maxScale - minScale);
        this.node.scale = Math.max(minScale, Math.min(maxScale, targetScale));
        if (isNaN(this.node.scaleX)) {
            this.node.scale = minScale;
        }
    }

    getCalculatedScore(): number {
        if (this.isPopped) return 0;
        // this.points is expected to be 0 from BalloonGameManager for all types.
        // Score calculation for ADD/SUB is based on operationValue.
        // Score calculation for MULTIPLY/DIVIDE will be handled by BalloonGameManager,
        // as it needs the player's current score. This function will return 0 for M/D types.
        let calculatedScore = 0; 
        switch (this.operation) {
            case BalloonOperation.ADD:
                calculatedScore = this.operationValue; // operationValue is the direct score to add
                break;
            case BalloonOperation.SUBTRACT:
                calculatedScore = -this.operationValue; // operationValue is the positive magnitude to subtract
                break;
            case BalloonOperation.MULTIPLY:
            case BalloonOperation.DIVIDE:
                // These types are handled by BalloonGameManager by applying the factor.
                // This function returns 0 for them as they don't award a fixed score directly.
                calculatedScore = 0; 
                break;
            default:
                calculatedScore = this.points; // Fallback, should be 0
                break;
        }
        // Removed Math.max(0, calculatedScore) to allow negative scores (e.g., -20)
        return calculatedScore; 
    }

    pop(popperActorNr: number) {
        cc.audioEngine.playEffect(this.balloonPopSfx, false);
        if (this.isPopped) return;
        this.isPopped = true;
        cc.log(`[Balloon] Balloon ${this.balloonId} popped by ${popperActorNr}.`);
        // Instantiate popFX at balloon position
        if (this.popFXPrefab) {
            const fx = cc.instantiate(this.popFXPrefab);
            fx.setPosition(this.node.getPosition());
            if (this.node.parent) {
                this.node.parent.addChild(fx);
            }
            // Destroy FX after animation ends, or fallback to timer
            const anim = fx.getComponent(cc.Animation);
            if (anim) {
                anim.on(cc.Animation.EventType.FINISHED, () => fx.destroy(), fx);
                anim.play();
            } else {
                fx.runAction(cc.sequence(cc.delayTime(1), cc.callFunc(() => fx.destroy())));
            }
        }
        // TODO: Add visual pop effect (e.g., particle system, animation)
        // TODO: Add sound effect
        
        // Destroy is now handled by GameManager after this call or after remotePop
        // to ensure it's removed from activeBalloons map first.
        // For master client, it will call this, then remove from map, then destroy.
        // For other clients, clientHandleBalloonPopped will call remotePop, then remove from map, then destroy.
        // this.node.destroy(); 
    }
    
    remotePop() {
        if (this.isPopped) return;
        this.isPopped = true;
        cc.log(`[Balloon] Balloon ${this.balloonId} remotePopped.`);
        // Instantiate popFX at balloon position
        if (this.popFXPrefab) {
            const fx = cc.instantiate(this.popFXPrefab);
            fx.setPosition(this.node.getPosition());
            if (this.node.parent) {
                this.node.parent.addChild(fx);
            }
            const anim = fx.getComponent(cc.Animation);
            if (anim) {
                anim.on(cc.Animation.EventType.FINISHED, () => fx.destroy(), fx);
                anim.play();
            } else {
                fx.runAction(cc.sequence(cc.delayTime(1), cc.callFunc(() => fx.destroy())));
            }
        }
        // TODO: Add visual pop effect (e.g., particle system, animation)
        // TODO: Add sound effect
        // this.node.destroy(); 
    }

    despawn() {
        if (this.isPopped) return; 
        cc.log(`[Balloon] Balloon ${this.balloonId} despawn() called.`);
        if (this.gameManager) {
            this.gameManager.reportBalloonDespawned(this.balloonId);
        }
        // Actual node destruction is handled by reportBalloonDespawned or directly by GameManager
        // this.node.destroy();
    }

    // Utility: Map player avatar type to slot index (0-3) for cursor/label assignment
    // Avatar types: 'electric', 'grass', 'ice', 'fire' (order: 0,1,2,3)
    // Returns slot index for a given avatar type string
    static getAvatarSlotIndex(avatarType: string): number {
        switch (avatarType) {
            case 'electric': return 0;
            case 'grass': return 1;
            case 'ice': return 2;
            case 'fire': return 3;
            default: return 0; // fallback to electric if unknown
        }
    }
}
