import { MapNodeEvents, NodeOwnership } from "../types/GameEvents";
const {ccclass, property} = cc._decorator;

@ccclass
export default class SpaceNodeItem extends cc.Component {

    @property({type: cc.Enum(MapNodeEvents)})
    mapNodeEvents: MapNodeEvents = MapNodeEvents.NORMAL;
    @property({type: cc.Enum(NodeOwnership)})
    Owner: NodeOwnership = NodeOwnership.NONE;

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

    public getMapNodeEvent(): MapNodeEvents {
        return this.mapNodeEvents;
    }

    // update (dt) {}
}
