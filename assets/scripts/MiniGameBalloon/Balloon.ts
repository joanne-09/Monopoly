// filepath: c:\Monopoly Game\Monopoly\assets\scripts\MiniGameBalloon\Balloon.ts
const {ccclass, property} = cc._decorator;

export enum BalloonOperation {
    ADD = '+',
    SUBTRACT = '-',
    MULTIPLY = '*',
    DIVIDE = '/',
    NONE = ''
}

// Enum for key codes to make it clearer
export enum BalloonKeyCode {
    W = cc.macro.KEY.w,
    A = cc.macro.KEY.a,
    S = cc.macro.KEY.s,
    D = cc.macro.KEY.d,
    UP = cc.macro.KEY.up,
    LEFT = cc.macro.KEY.left,
    DOWN = cc.macro.KEY.down,
    RIGHT = cc.macro.KEY.right,
    UNKNOWN = 0
}

@ccclass
export default class Balloon extends cc.Component {

    @property(cc.Label)
    valueLabel: cc.Label = null;

    @property(cc.Sprite)
    iconSprite: cc.Sprite = null; // Sprite to show which key to press

    // Optional: Link these in the editor if you have specific sprite frames for each key
    @property(cc.SpriteFrame)
    keyWIcon: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    keyAIcon: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    keySIcon: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    keyDIcon: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    keyUpIcon: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    keyLeftIcon: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    keyDownIcon: cc.SpriteFrame = null;
    @property(cc.SpriteFrame)
    keyRightIcon: cc.SpriteFrame = null;


    public speed: number = 100; // Pixels per second
    public points: number = 10;
    public operation: BalloonOperation = BalloonOperation.NONE;
    public operationValue: number = 0; // Value for operations like *2, /2
    public requiredKeyCode: BalloonKeyCode = BalloonKeyCode.UNKNOWN; // The cc.macro.KEY code
    public balloonId: string = ''; // Unique ID for network identification

    private gameManager: any = null; // Reference to BalloonGameManager

    // More robust key code list
    private availableKeyCodes: BalloonKeyCode[] = [
        BalloonKeyCode.W, BalloonKeyCode.A, BalloonKeyCode.S, BalloonKeyCode.D,
        BalloonKeyCode.UP, BalloonKeyCode.LEFT, BalloonKeyCode.DOWN, BalloonKeyCode.RIGHT
    ];

    // Call this to initialize the balloon after instantiation
    init(id: string, startPos: cc.Vec2, gameWidth: number, gameHeight: number, manager: any) {
        this.balloonId = id;
        this.node.setPosition(startPos);
        this.gameManager = manager;

        // Randomize properties
        this.points = (Math.floor(Math.random() * 3) + 1) * 10; // 10, 20, 30 points base

        const operationRoll = Math.random();
        if (operationRoll < 0.15) { // 15% chance for multiply
            this.operation = BalloonOperation.MULTIPLY;
            this.operationValue = Math.floor(Math.random() * 2) + 2; // *2 or *3
        } else if (operationRoll < 0.3) { // 15% chance for divide
            this.operation = BalloonOperation.DIVIDE;
            this.operationValue = Math.floor(Math.random() * 2) + 2; // /2 or /3 (ensure points are divisible or handle float)
        } else if (operationRoll < 0.5) { // 20% chance for add/subtract small fixed amounts
            if (Math.random() < 0.5) {
                this.operation = BalloonOperation.ADD;
                this.operationValue = (Math.floor(Math.random() * 2) + 1) * 5; // +5 or +10
            } else {
                this.operation = BalloonOperation.SUBTRACT;
                this.operationValue = (Math.floor(Math.random() * 2) + 1) * 5; // -5 or -10
            }
        }
        else { // 50% chance of no operation
            this.operation = BalloonOperation.NONE;
        }

        // Assign a random key
        this.requiredKeyCode = this.availableKeyCodes[Math.floor(Math.random() * this.availableKeyCodes.length)];
        this.updateDisplay();
    }

    updateDisplay() {
        let displayText = `${this.points}`;
        if (this.operation !== BalloonOperation.NONE) {
            // Display like "x2 (10)" or "+5 (20)"
            displayText = `${this.operation}${this.operationValue} (base:${this.points})`;
        }
        if (this.valueLabel) {
            this.valueLabel.string = displayText;
        }

        if (this.iconSprite) {
            // Update the iconSprite based on this.requiredKeyCode
            // This requires you to have SpriteFrames linked in the editor or a way to load them dynamically
            switch (this.requiredKeyCode) {
                case BalloonKeyCode.W: this.iconSprite.spriteFrame = this.keyWIcon; break;
                case BalloonKeyCode.A: this.iconSprite.spriteFrame = this.keyAIcon; break;
                case BalloonKeyCode.S: this.iconSprite.spriteFrame = this.keySIcon; break;
                case BalloonKeyCode.D: this.iconSprite.spriteFrame = this.keyDIcon; break;
                case BalloonKeyCode.UP: this.iconSprite.spriteFrame = this.keyUpIcon; break;
                case BalloonKeyCode.LEFT: this.iconSprite.spriteFrame = this.keyLeftIcon; break;
                case BalloonKeyCode.DOWN: this.iconSprite.spriteFrame = this.keyDownIcon; break;
                case BalloonKeyCode.RIGHT: this.iconSprite.spriteFrame = this.keyRightIcon; break;
                default: if(this.iconSprite) this.iconSprite.spriteFrame = null; break; // Or a default question mark icon
            }
        }
    }

    getCalculatedScore(): number {
        let score = this.points;
        switch (this.operation) {
            case BalloonOperation.ADD:
                score += this.operationValue;
                break;
            case BalloonOperation.SUBTRACT:
                score -= this.operationValue;
                break;
            case BalloonOperation.MULTIPLY:
                score *= this.operationValue;
                break;
            case BalloonOperation.DIVIDE:
                // Ensure division by zero doesn't occur, though operationValue is >= 2
                score = Math.floor(score / (this.operationValue || 1)); 
                break;
        }
        return Math.max(0, score); // Score cannot be negative from operations, and ensure it's an integer for display
    }

    update(dt: number) {
        this.node.y += this.speed * dt;
        // Destroy balloon if it goes off screen (top)
        if (this.node.y > cc.view.getVisibleSize().height + this.node.height / 2) {
            // Notify game manager that this balloon was missed (optional)
            if (this.gameManager && typeof this.gameManager.balloonMissed === 'function') {
                this.gameManager.balloonMissed(this.balloonId);
            }
            this.node.destroy();
        }
    }

    // Called by PlayerController when a correct key is pressed while hovering
    pop(popPlayerActorNr: number) {
        // cc.log(`Balloon ${this.balloonId} popped by player ${popPlayerActorNr}, Value: ${this.getCalculatedScore()}`);
        // Play animation/sound if any
        // e.g., const anim = this.getComponent(cc.Animation);
        // if (anim) anim.play('pop_animation');
        // this.scheduleOnce(() => this.node.destroy(), 0.5); // Destroy after animation
        
        // For now, just destroy immediately
        this.node.destroy();
    }

    // Helper to check if a point (mouse cursor) is over this balloon
    isPointInside(point: cc.Vec2): boolean {
        const rect = this.node.getBoundingBoxToWorld();
        return rect.contains(point);
    }

    // Optional: Call this if a balloon is popped by another player via network event
    remotePop() {
        // cc.log(`Balloon ${this.balloonId} remotely popped.`);
        // Play animation/sound
        this.node.destroy();
    }
}
