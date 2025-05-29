import SpaceNodeCtrl from "./SpaceNodeCtrl";

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

    onSpaceClicked(event: cc.Event.EventTouch, index: string) {
      const spaceIndex = parseInt(index);
      let coord = SpaceNodeCtrl.getCoordByIndex(this.spacesNode, spaceIndex);
      cc.log(`The Coordina of Space ${spaceIndex}: ${coord.x}, ${coord.y}`);
    }

    // update (dt) {}
}
