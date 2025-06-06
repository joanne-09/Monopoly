import GameManager from "./GameManager";

const {ccclass, property} = cc._decorator;

@ccclass
export default class StorePopup extends cc.Component {
    @property(cc.Label)
    amountLabels: cc.Label[] = [];
    @property(cc.Button)
    minusButtons: cc.Button[] = [];
    @property(cc.Button)
    plusButtons: cc.Button[] = [];

    @property(cc.Button)
    buyButton: cc.Button = null;
    @property(cc.Button)
    leaveButton: cc.Button = null;
    @property(cc.Label)
    moneyLabel: cc.Label = null;

    @property({type: cc.AudioClip})
    cachierSfx: cc.AudioClip = null;

    @property({type:cc.AudioClip})
    errorSfx: cc.AudioClip = null;

    @property({type:cc.AudioClip})
    clickSfx: cc.AudioClip = null;

    private gadgetPrices = [200, 200, 300, 400];
    private selectedAmounts = [0, 0, 0, 0];
    private playerMoney = 0;
    private playerInventory = [0, 0, 0, 0];
    onLoad() {
        
        this.updateUI();
        for (let i = 0; i < 4; i++) {
            if (this.plusButtons[i]) {
                this.plusButtons[i].node.on("click", () => this.changeAmount(i, 1));
            }
            if (this.minusButtons[i]) {
                this.minusButtons[i].node.on("click", () => this.changeAmount(i, -1));
            }
        }
        if (this.buyButton) {
            this.buyButton.node.on("click", this.onBuy, this);
        }
        if (this.leaveButton) {
            this.leaveButton.node.on("click", this.onLeave, this);
        }

    }


    changeAmount(index: number, delta: number) {
        cc.audioEngine.playEffect(this.clickSfx, false);
        this.selectedAmounts[index] = Math.max(0, this.selectedAmounts[index] + delta);
        this.updateUI();
    }

    updateUI() {
        for (let i = 0; i < 4; i++) {
            if (this.amountLabels[i]) {
                this.amountLabels[i].string = `${this.selectedAmounts[i]}`;
            }
        }
        if (this.moneyLabel) {
            this.moneyLabel.string = `${GameManager.getInstance().getLocalPlayerData()?.money || -1}`;
        }
    }

    onBuy() {
        let total = 0;
        for (let i = 0; i < 4; i++) {
            total += this.selectedAmounts[i] * this.gadgetPrices[i];
        }
        if (total > GameManager.getInstance().getLocalPlayerData()?.money) {
            cc.audioEngine.playEffect(this.errorSfx, false);
            alert("You don't have enough money!");
            return;
        }
        //this.playerMoney -= total;
        GameManager.getInstance().addGadgetToLocalPlayer(this.selectedAmounts);
        GameManager.getInstance().deductMoneyFromLocalPlayer(total);
        for (let i = 0; i < 4; i++) {
            this.playerInventory[i] += this.selectedAmounts[i];

            this.selectedAmounts[i] = 0;
        }

        this.updateUI();
        if(total != 0) {
            cc.audioEngine.playEffect(this.cachierSfx, false);
            alert("Purchase successful!");
        }
    }

    onLeave() {
        this.node.active = false; // Hide the popup
    }

    public isActive(): boolean {
        return this.node.active;
    }
}
