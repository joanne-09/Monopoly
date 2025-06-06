import SpaceNodeCtrl from "./SpaceNodeCtrl";
import SpaceNodeItem from "./SpaceNodeItem";
import { MapNodeEvents } from "../types/GameEvents";
import GameManager from "../GameManager";
import { PlayerData } from "../types/DataTypes";
const {ccclass, property} = cc._decorator;

@ccclass
export default class MapManager extends cc.Component {
    private static instance: MapManager = null;

    @property(cc.Node)
    spacesNode: cc.Node = null;
    
    @property(cc.Label)
    moneyLabel: cc.Label = null;
    private spaceNum: number = 60;
    private spaceNodeCtrl = new SpaceNodeCtrl();
    private gameManager: GameManager;
    private localPlayerData: PlayerData;
    private lastMoney: number = null;

    @property(cc.Button)
    gameButton: cc.Button = null;
    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        if (MapManager.instance) {
            this.node.destroy();
            return;
        }
        MapManager.instance = this;
        this.gameManager = GameManager.getInstance();
        this.gameButton.node.on('click', this.loadGameScene, this);
    }

    public static getInstance(): MapManager {
        return MapManager.instance;
    }

    start() {
      this.gameManager.startGame();
      this.schedule(() => {
        this.localPlayerData = this.gameManager.getLocalPlayerData();
      }, 0.5);
    }

    private loadGameScene() {
      cc.director.loadScene("MiniGameSnowball");
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

    
    update (dt) {
        if (this.localPlayerData && this.moneyLabel) {
            if (this.localPlayerData.money !== this.lastMoney) {
                this.moneyLabel.string = `Money: ${this.localPlayerData.money}`;
                this.lastMoney = this.localPlayerData.money;
            }
        } else {
            cc.warn("Local player data or money label is not set.");
        }
    }
}
