const {ccclass, property} = cc._decorator;

@ccclass
export default class DiceRoll extends cc.Component {

    @property(cc.Animation)
    diceAnimation: cc.Animation = null;
    @property(cc.Sprite)
    diceSprite: cc.Sprite = null;
    @property([cc.SpriteFrame])
    diceFaceSprites: cc.SpriteFrame[] = [];
    @property(cc.AudioClip)
    rollSound: cc.AudioClip = null;

    @property
    rollDuration: number = 2.0;
    @property
    showDuration: number = 1.0;
    @property
    fadeDuration: number = 0.3;

    private _rollValue: number = 1;
    private _isRolling: boolean = false;

    start() {
        // Initialize
        this.showDiceValue(1);
    }

    /**
     * Roll the dice with animation and return a random value
     * @returns Promise that resolves with the dice value
     */
    public roll(): Promise<number> {
        return new Promise((resolve) => {
            if (this._isRolling) {
                resolve(this._rollValue);
                return;
            }

            this._isRolling = true;

            this.diceAnimation.play("diceRoll");
            cc.audioEngine.playEffect(this.rollSound, false);

            // Set a timeout to stop the animation after rollDuration
            this.scheduleOnce(() => {
                this.diceAnimation.stop();
                cc.audioEngine.stopAllEffects();
                
                // Generate random number
                this._rollValue = Math.floor(Math.random() * 6) + 1;
                
                // Show the corresponding dice face
                this.showDiceValue(this._rollValue);
                
                this._isRolling = false;

                this.scheduleOnce(() => {
                  this.node.runAction(cc.fadeOut(this.fadeDuration));
                }, this.showDuration);
                
                // Return the rolled value
                resolve(this._rollValue);
            }, this.rollDuration);
        });
    }

    private showDiceValue(value: number): void {
        if (value < 1 || value > 6) {
            cc.warn(`Invalid dice value: ${value}. Using 1 instead.`);
            value = 1;
        }
        
        // Set the sprite frame to the corresponding dice face
        if (this.diceFaceSprites[value - 1]) {
            this.diceSprite.spriteFrame = this.diceFaceSprites[value - 1];
        } else {
            cc.warn(`Dice face sprite ${value} not found in diceFaceSprites array`);
        }
    }

    public getValue(): number {
        return this._rollValue;
    }
}
