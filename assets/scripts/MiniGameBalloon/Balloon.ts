// filepath: c:\Monopoly Game\Monopoly\assets\scripts\MiniGameBalloon\Balloon.ts
const {ccclass, property} = cc._decorator;
import BalloonGameManager from "./BalloonGameManager";

export enum BalloonKeyCode {
    UP = cc.macro.KEY.up,
    DOWN = cc.macro.KEY.down,
    LEFT = cc.macro.KEY.left,
    RIGHT = cc.macro.KEY.right,
    W = cc.macro.KEY.w,
    A = cc.macro.KEY.a,
    S = cc.macro.KEY.s,
    D = cc.macro.KEY.d
}

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

    @property(cc.Sprite)
    keyIconSprite: cc.Sprite = null;

    @property(cc.SpriteFrame)
    upArrowSprite: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    downArrowSprite: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    leftArrowSprite: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    rightArrowSprite: cc.SpriteFrame = null;

    public balloonId: string = "";
    public points: number = 0;
    public operation: BalloonOperation = BalloonOperation.NONE;
    public operationValue: number = 0;
    public requiredKeyCode: BalloonKeyCode = null;
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
        keyCode: BalloonKeyCode,
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
        this.requiredKeyCode = keyCode;
        this.speed = speed;
        this.isPopped = false;

        this.updateDisplay();
    }

    update(dt: number) {
        if (this.isPopped) return;

        this.node.y += this.speed * dt;

        const balloonTopEdge = this.node.y + (this.node.height * this.node.scaleY / 2);
        if (balloonTopEdge > this.gameHeightValue / 2) {
            this.despawn();
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

        if (this.keyIconSprite) {
            let targetSpriteFrame: cc.SpriteFrame = null;
            switch (this.requiredKeyCode) {
                case BalloonKeyCode.UP:
                case BalloonKeyCode.W:
                    targetSpriteFrame = this.upArrowSprite;
                    break;
                case BalloonKeyCode.DOWN:
                case BalloonKeyCode.S:
                    targetSpriteFrame = this.downArrowSprite;
                    break;
                case BalloonKeyCode.LEFT:
                case BalloonKeyCode.A:
                    targetSpriteFrame = this.leftArrowSprite;
                    break;
                case BalloonKeyCode.RIGHT:
                case BalloonKeyCode.D:
                    targetSpriteFrame = this.rightArrowSprite;
                    break;
                default:
                    cc.warn(`[Balloon] No sprite for key code: ${this.requiredKeyCode}`);
                    break;
            }
            this.keyIconSprite.spriteFrame = targetSpriteFrame;
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
        // TODO: Add visual pop effect (e.g., particle system, animation)
        // TODO: Add sound effect
        // this.node.destroy(); 
    }

    despawn() {
        if (this.isPopped) return; 
        if (this.gameManager) {
            this.gameManager.reportBalloonDespawned(this.balloonId);
        }
        // Actual node destruction is handled by reportBalloonDespawned or directly by GameManager
        // this.node.destroy();
    }

    isPointInside(worldPoint: cc.Vec2): boolean {
        if (!this.node || !this.node.active || this.isPopped) return false;
        let boundingBox = this.node.getBoundingBoxToWorld();
        return boundingBox.contains(worldPoint);
    }
}
