// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

const {ccclass, property} = cc._decorator;

@ccclass
export default class NewClass extends cc.Component {

    @property(cc.Node)
    playerNode: cc.Node = null;
    @property(cc.Node)
    spaceNode: cc.Node = null;
    @property([cc.Node])
    nodesUponPlayer: cc.Node[] = [];

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {}

    start () {
      // Log initial values
      cc.log("Initial zIndex values:");
      cc.log("Space zIndex: " + this.spaceNode.zIndex);
      cc.log("Player zIndex: " + (this.playerNode ? this.playerNode.zIndex : "null"));
      cc.log("wall2_uponPlayer zIndex: " + (this.nodesUponPlayer[0] ? this.nodesUponPlayer[0].zIndex : "null"));
      
      // Set values
      if (this.playerNode) {
        this.playerNode.zIndex = this.spaceNode.zIndex + 10;
      }
      this.nodesUponPlayer.forEach(node => {
        if (node) {
          node.zIndex = this.spaceNode.zIndex + 20;
          cc.log("Node name: " + node.name);
          cc.log("After setting - space zIndex: " + this.spaceNode.zIndex);
          cc.log("After setting - node zIndex: " + node.zIndex);
        }
      });
      
      // Ensure wall2_uponPlayer specifically has higher zIndex
      const wall = this.nodesUponPlayer.find(n => n && n.name === "wall2_uponPlayer");
      if (wall) {
        wall.zIndex = 100; // Force a very high zIndex
        cc.log("Forced wall2_uponPlayer zIndex to: " + wall.zIndex);
      }
    }

    // update (dt) {}
}
