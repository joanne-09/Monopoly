const {ccclass, property} = cc._decorator;

@ccclass
export default class Store extends cc.Component {
    @property(cc.Button)
    storePopupButton: cc.Button = null;
    
    @property(cc.Node)
    storePopup: cc.Node = null;

    onLoad() {
        if(this.storePopupButton) {
            this.storePopupButton.node.on("click", this.openStorePopup, this);
        }
    }

    openStorePopup() {
        this.storePopup.active = true;
    }

}