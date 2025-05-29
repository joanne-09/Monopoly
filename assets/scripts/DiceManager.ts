
const {ccclass, property} = cc._decorator;

@ccclass
export default class NewClass extends cc.Component {

    @property(cc.Prefab)
    dicePrefab: cc.Prefab = null;

    @property
    diceNum: number = 1;
    @property
    diceSize: number = 128;
    @property
    dicesSpacing: number = 30;

    private result = 0;

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {}

    start () {
      
    }

    onDiceRollTriggered(event: cc.Event.EventTouch, diceNum: string): Promise<number> {
      this.diceNum = parseInt(diceNum);
      cc.log("Dice roll triggered");
      
      this.result = 0;
      
      // Store all roll promises
      const rollPromises: Promise<number>[] = [];

      for (let i = 0; i < this.diceNum; i++) {
        const diceNode = cc.instantiate(this.dicePrefab);
        diceNode.setContentSize(this.diceSize, this.diceSize);
        diceNode.setPosition(cc.v2((i - (this.diceNum - 1) / 2) * (this.diceSize + this.dicesSpacing), 0));
        
        this.node.addChild(diceNode);

        const diceRoll = diceNode.getComponent("DiceRoll");
        if (diceRoll) {
            const rollPromise = diceRoll.roll();
            rollPromises.push(rollPromise);
        } else {
            cc.error("diceRoll component not found on the instantiated dice node.");
        }
      }
      
      // Wait for all dice to finish rolling before returning the result
      return Promise.all(rollPromises).then(values => {
        // Calculate total from all dice values
        this.result = values.reduce((sum, value) => sum + value, 0);
        cc.log(`Total rolled value: ${this.result}`);
        return this.result;
      });
    }

    // update (dt) {}
}
