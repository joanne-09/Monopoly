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

    @property(cc.Button)
    activeButton: cc.Button = null;

    onCharacterSelect(selectedButton: cc.Button) {
        if (!selectedButton || !this.playerNode) {
            cc.error("Selected button or playerNode is not assigned.");
            return;
        }

        this.activeButton = selectedButton;

        // Assuming the button's image is on its target node's Sprite component
        const buttonSprite = selectedButton.target?.getComponent(cc.Sprite);
        const playerSprite = this.playerNode.getComponent(cc.Sprite);

        if (buttonSprite && playerSprite) {
            playerSprite.spriteFrame = buttonSprite.spriteFrame;
        } else {
            cc.warn("Sprite component not found on button target or playerNode.");
        }
    }

    // Life cycle method
    onLoad() {
        this.character1.node.on(cc.Node.EventType.TOUCH_END, () => this.onCharacterSelect(this.character1), this);
        this.character2.node.on(cc.Node.EventType.TOUCH_END, () => this.onCharacterSelect(this.character2), this);
        this.character3.node.on(cc.Node.EventType.TOUCH_END, () => this.onCharacterSelect(this.character3), this);
        this.character4.node.on(cc.Node.EventType.TOUCH_END, () => this.onCharacterSelect(this.character4), this);

        // Optionally, set a default active button and player image
        if (this.character1) {
            this.onCharacterSelect(this.character1);
        }
    }

    onDestroy() {
        this.character1?.node.off(cc.Node.EventType.TOUCH_END, () => this.onCharacterSelect(this.character1), this);
        this.character2?.node.off(cc.Node.EventType.TOUCH_END, () => this.onCharacterSelect(this.character2), this);
        this.character3?.node.off(cc.Node.EventType.TOUCH_END, () => this.onCharacterSelect(this.character3), this);
        this.character4?.node.off(cc.Node.EventType.TOUCH_END, () => this.onCharacterSelect(this.character4), this);
    }
}