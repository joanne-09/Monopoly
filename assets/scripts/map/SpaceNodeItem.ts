import { MapNodeEvents, NodeOwnership } from "../types/GameEvents";
const {ccclass, property} = cc._decorator;

@ccclass
export default class SpaceNodeItem extends cc.Component {

    @property({type: cc.Enum(MapNodeEvents)})
    mapNodeEvents: MapNodeEvents = MapNodeEvents.NORMAL;
    @property({type: cc.Enum(NodeOwnership)})
    Owner: NodeOwnership = NodeOwnership.NONE;
    private coord: cc.Vec2 = cc.v2(0, 0);

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {}

    start () {
    }

    isOwned(): boolean {
        return !(this.Owner === NodeOwnership.NONE);
    }

    getOwner(): NodeOwnership {
        return this.Owner;
    }

    getCoord(): cc.Vec2 {
      cc.log("getCoord called on SpaceNodeItem");
        return this.node.getPosition();
    }

    public getMapNodeEvent(): MapNodeEvents {
        return this.mapNodeEvents;
    }

    // update (dt) {}
}
