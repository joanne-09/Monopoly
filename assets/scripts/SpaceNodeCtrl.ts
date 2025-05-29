// Learn TypeScript:
const {ccclass, property} = cc._decorator;

@ccclass
export default class SpaceNodeCtrl extends cc.Component {
    // LIFE-CYCLE CALLBACKS:
    private spaceNum: number = 60;

    onLoad() {
      cc.log("SpaceNodeCtrl onLoad - setting up click events");
      
      // Find the node with MapManager component
      const mapNode = cc.find("Canvas/Map");
      if (!mapNode) {
        cc.error("Could not find Map node!");
        return;
      }
      const mapManager = mapNode.getComponent("MapManager");
      if (!mapManager) {
        cc.error("Could not find MapManager component!");
        return;
      }
            
      // Add click event listener to each space node
      this.node.children.forEach((child) => {
        try {
          const spaceNum = parseInt(child.name.replace('space', ''));
          let button = child.getComponent(cc.Button);
          if (!button) {
            button = child.addComponent(cc.Button);
          }
          
          // Clear existing events to avoid duplicates
          button.clickEvents = [];
          
          const clickEventHandler = new cc.Component.EventHandler();
          clickEventHandler.target = mapNode;
          clickEventHandler.component = "MapManager"; 
          clickEventHandler.handler = "onSpaceClicked";
          clickEventHandler.customEventData = spaceNum.toString();
          
          button.clickEvents.push(clickEventHandler);
        } catch (e) {
          cc.error(`Error setting up click for ${child.name}: ${e}`);
        }
      });
    }

    start () {

    }

    static getCoordByIndex(spacesNode: cc.Node, index: number): cc.Vec2 {
      if (!spacesNode) {
        cc.error("Spaces node is null!");
        return null;
      }
      
      if (index <= 0 || index > 60) {
        cc.log(`Invalid index: ${index}. It should be between 1 and 60.`);
        return null;
      }

      const targetSpace = spacesNode.getChildByName(`space${index.toString().padStart(3, '0')}`);
      return targetSpace ? new cc.Vec2(targetSpace.position.x, targetSpace.position.y) : null;
    }

    // update (dt) {}
}
