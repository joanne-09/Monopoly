
const {ccclass, property} = cc._decorator;

@ccclass("Store")
export default class Store extends cc.Component {
    @property(cc.Label)
    gadgetLabels: cc.Label[] = [];
    @property(cc.Label)
    amountLabels: cc.Label[] = [];
    @property(cc.Button)
    plusButtons: cc.Button[] = [];
    @property(cc.Button)
    minusButtons: cc.Button[] = [];

    @property(cc.Button)
    buyButton: cc.Button = null;
    @property(cc.Button)
    leaveButton: cc.Button = null;
    @property(cc.Label)
    moneyLabel: cc.Label = null;

    private gadgetNames = ["Gadget A", "Gadget B", "Gadget C", "Gadget D"];
    private gadgetPrices = [100, 200, 300, 400];
    private selectedAmounts = [0, 0, 0, 0];
    private playerMoney = 1000;
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
        this.selectedAmounts[index] = Math.max(0, this.selectedAmounts[index] + delta);
        this.updateUI();
    }

    updateUI() {
        for (let i = 0; i < 4; i++) {
            if (this.gadgetLabels[i]) {
                this.gadgetLabels[i].string = `${this.gadgetNames[i]} ($${this.gadgetPrices[i]})`;
            }
            if (this.amountLabels[i]) {
                this.amountLabels[i].string = `${this.selectedAmounts[i]}`;
            }
        }
        if (this.moneyLabel) {
            this.moneyLabel.string = `Money: $${this.playerMoney}`;
        }
    }

    onBuy() {
        let total = 0;
        for (let i = 0; i < 4; i++) {
            total += this.selectedAmounts[i] * this.gadgetPrices[i];
        }
        if (total > this.playerMoney) {
            alert("You don't have enough money!");
            return;
        }
        this.playerMoney -= total;
        for (let i = 0; i < 4; i++) {
            this.playerInventory[i] += this.selectedAmounts[i];
            this.selectedAmounts[i] = 0;
        }
        this.updateUI();
        alert("Purchase successful!");
    }

    onLeave() {
        this.node.active = false; // Hide the popup
    }
}
