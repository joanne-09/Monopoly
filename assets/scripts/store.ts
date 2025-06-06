const {ccclass, property} = cc._decorator;

@ccclass
export default class Store extends cc.Component {
    @property(cc.Button)
    storePopupButton: cc.Button = null;
    
    @property(cc.Node)
    storePopup: cc.Node = null;

    @property({type:cc.AudioClip})
    clickSfx: cc.AudioClip = null;

    onLoad() {
        if(this.storePopupButton) {
            cc.audioEngine.playEffect(this.clickSfx, false);
            this.storePopupButton.node.on("click", this.openStorePopup, this);
        }
    }

    openStorePopup() {
        this.storePopup.active = true;
    }

}