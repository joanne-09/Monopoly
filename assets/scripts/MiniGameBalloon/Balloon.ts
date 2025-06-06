// filepath: c:\Monopoly Game\Monopoly\assets\scripts\MiniGameBalloon\Balloon.ts
const {ccclass, property} = cc._decorator;
import BalloonGameManager from "./BalloonGameManager";

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
            let opSymbol = "";
            if (this.operation !== BalloonOperation.NONE && this.operationValue !== 0) {
                switch (this.operation) {
                    case BalloonOperation.ADD: opSymbol = "+"; break;
                    case BalloonOperation.SUBTRACT: opSymbol = "-"; break;
                    case BalloonOperation.MULTIPLY: opSymbol = "x"; break;
                    case BalloonOperation.DIVIDE: opSymbol = "/"; break;
                }
                this.valueLabel.string = `${this.points}\n${opSymbol}${this.operationValue}`;
            } else {
                this.valueLabel.string = this.points.toString();
            }
        }
    }

    getCalculatedScore(): number {
        if (this.isPopped) return 0;

        let calculatedScore = this.points;
        switch (this.operation) {
            case BalloonOperation.ADD:
                calculatedScore += this.operationValue;
                break;
            case BalloonOperation.SUBTRACT:
                calculatedScore -= this.operationValue;
                break;
            case BalloonOperation.MULTIPLY:
                calculatedScore *= this.operationValue;
                break;
            case BalloonOperation.DIVIDE:
                if (this.operationValue !== 0) {
                    calculatedScore = Math.floor(calculatedScore / this.operationValue);
                } else {
                    cc.warn("[Balloon] Division by zero in getCalculatedScore. Returning original points.");
                }
                break;
        }
        return Math.max(0, calculatedScore); 
    }

    pop(popperActorNr: number) {
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
            // Optionally destroy the FX after 1s
            fx.runAction(cc.sequence(cc.delayTime(1), cc.callFunc(() => fx.destroy())));
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
            fx.runAction(cc.sequence(cc.delayTime(1), cc.callFunc(() => fx.destroy())));
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
}
