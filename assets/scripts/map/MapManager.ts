import SpaceNodeCtrl from "./SpaceNodeCtrl";
import SpaceNodeItem from "./SpaceNodeItem";
import { MapNodeEvents } from "../types/GameEvents";

const {ccclass, property} = cc._decorator;

@ccclass
export default class MapManager extends cc.Component {

    @property(cc.Node)
    spacesNode: cc.Node = null;

    private spaceNum: number = 60;
    private spaceNodeCtrl = new SpaceNodeCtrl();

    // LIFE-CYCLE CALLBACKS:

    onLoad() {
      
    }

    start() {

    }

    protected getSpaceNodeItemByIndex(index: number) {
      if (!this.spacesNode) {
        cc.error(`Spaces node ${index} is not set!`);
        return null;
      }
      if (index < 0 || index >= this.spaceNum) {
        cc.error(`Invalid index: ${index}. It should be between 0 and ${this.spaceNum - 1}.`);
        return null;
      }
      let childNode = this.spacesNode.getChildByName(`space${index.toString().padStart(3, '0')}`);
      return childNode.getComponent(SpaceNodeItem);
    }

    public onSpaceClicked(event: cc.Event.EventTouch, index: string) {
      const spaceIndex = parseInt(index);
      let coord = SpaceNodeCtrl.getCoordByIndex(this.spacesNode, spaceIndex);
      let MapNodeEvent = this.getMapNodeEventByIndex(spaceIndex);
      cc.log(`Space clicked at index: ${spaceIndex}, coord: ${coord}, event: ${MapNodeEvent}`);
    }
    
    public getCoordByIndex(index: number): cc.Vec2 {
      return SpaceNodeCtrl.getCoordByIndex(this.spacesNode, index);
    }

    public getMapNodeEventByIndex(index: number): MapNodeEvents | null {
      const spaceNodeItem = this.getSpaceNodeItemByIndex(index);
      if (!spaceNodeItem) {
        cc.error(`Space node item at index ${index} not found!`);
        return null;
      }
      cc.log(`Map node event for index ${index}: ${spaceNodeItem.getMapNodeEvent()}`);
      return spaceNodeItem.getMapNodeEvent();
    }

    // update (dt) {}
}
