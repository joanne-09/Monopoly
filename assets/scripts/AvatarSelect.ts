const {ccclass, property} = cc._decorator;

@ccclass
export default class AvatarSelect extends cc.Component {
    @property(cc.Button)
    character1: cc.Button = null;
    @property(cc.Button)
    character2: cc.Button = null;
    @property(cc.Button)
    character3: cc.Button = null;
    @property(cc.Button)
    character4: cc.Button = null;

    @property(cc.Node)
    playerNode: cc.Node = null;
    @property(cc.Animation)
    playerAnimation: cc.Animation = null;

    private activeAvatar: number = 0;
    private readonly ANIMATION_INTERVAL: number = 3; // Interval in seconds for active character's random animation

    private playCharacterAnimation(characterNumber: number) {
        if (!this.playerNode) {
            console.warn("PlayerNode not assigned for character animation play.");
            return;
        }

        const clips = this.playerAnimation.getClips();
        const baseIndex = (characterNumber - 1) * 2;

        const randomIndex = Math.floor(Math.random() * 2); // 0 or 1
        const clipToPlay = clips[baseIndex + randomIndex];
        if (clipToPlay) {
            if (this.playerAnimation.currentClip !== clipToPlay) {
                this.playerAnimation.play(clipToPlay.name);
            }
            console.log(`Playing animation clip: ${clipToPlay.name} for character ${characterNumber}.`);
        } else {
            console.warn(`Animation clip at index ${baseIndex + randomIndex} is null for character ${characterNumber}.`);
        }
    }

    private playActiveCharacterRandomAnimationScheduled() {
        if (this.activeAvatar === 0 || !this.playerNode) {
            return;
        }
        this.playCharacterAnimation(this.activeAvatar);
    }

    onCharacterSelect(selected: number = 0) {
        if (this.playerAnimation) {
            this.playerAnimation.stop();
        }

        // Stop any previously scheduled character animation
        this.unschedule(this.playActiveCharacterRandomAnimationScheduled);

        this.activeAvatar = selected;

        // Play animation once immediately and then schedule it
        this.playActiveCharacterRandomAnimationScheduled(); // Play once immediately
        this.schedule(this.playActiveCharacterRandomAnimationScheduled, this.ANIMATION_INTERVAL, cc.macro.REPEAT_FOREVER, 0.1);

        console.log(`Character ${selected} selected. Active avatar set to ${this.activeAvatar}.`);
    }

    // Life cycle method
    onLoad() {
        // Character button click listeners
        if (this.character1 && this.character1.node) {
            this.character1.node.on("click", () => {
                this.onCharacterSelect(1);
            }, this);
        }
        if (this.character2 && this.character2.node) {
            this.character2.node.on("click", () => {
                this.onCharacterSelect(2);
            }, this);
        }
        if (this.character3 && this.character3.node) {
            this.character3.node.on("click", () => {
                this.onCharacterSelect(3);
            }, this);
        }
        if (this.character4 && this.character4.node) {
            this.character4.node.on("click", () => {
                this.onCharacterSelect(4);
            }, this);
        }

        // Optionally, set a default active button and player image
        if (this.character1) {
            this.onCharacterSelect(1);
        }
    }

    update(dt: number) {
        
    }

    onDestroy() {
        this.character1?.node.off("click", () => this.onCharacterSelect(1), this);
        this.character2?.node.off("click", () => this.onCharacterSelect(2), this);
        this.character3?.node.off("click", () => this.onCharacterSelect(3), this);
        this.character4?.node.off("click", () => this.onCharacterSelect(4), this);
    }
}