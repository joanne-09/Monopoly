import { MapNodeEvents } from "../types/GameEvents";
const {ccclass, property} = cc._decorator;

@ccclass
export default class SpaceNodeItem extends cc.Component {

    @property({type: cc.Enum(MapNodeEvents)})
    mapNodeEvents: MapNodeEvents = MapNodeEvents.NORMAL;
    

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {}

    start () {

    }

    public getMapNodeEvent(): MapNodeEvents {
        return this.mapNodeEvents;
    }

    // update (dt) {}
}
