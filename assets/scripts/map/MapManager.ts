import SpaceNodeItem from "./SpaceNodeItem";
import { MapNodeEvents, NodeOwnership } from "../types/GameEvents";
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
    private gameManager: GameManager;
    private localPlayerData: PlayerData;
    private lastMoney: number = null;

    @property(cc.Button)
    gameButton: cc.Button = null;
    @property(cc.Button)
    gameButton2: cc.Button = null;

    @property(cc.Button)
    endGameButton: cc.Button = null;

    @property({type:cc.AudioClip})
    gameBgm: cc.AudioClip = null;
    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        console.log("MapManager onLoad");
        if (MapManager.instance) {
            cc.error("MapManager instance already exists, destroying this instance.");
            this.node.destroy();
            return;
        }
        MapManager.instance = this;

        this.gameManager = GameManager.getInstance();

      // Don't call startGame if the game is already active
        this.gameButton.node.on('click', this.loadGameScene, this);
        this.gameButton2.node.on('click', this.loadGameScene2, this);
        this.endGameButton.node.on('click', this.endGame, this);

        if(!this.gameManager.getIsGameActive()) {
          this.gameManager.startGame();
        }else{
              this.gameManager.exitMiniGame();
          this.gameManager.resetMapManager();
        }
        // this.gameManager.broadcastTurn();

         // Start the game while load)
        cc.audioEngine.playMusic(this.gameBgm, true);
    }

    public static getInstance(): MapManager {
        return MapManager.instance;
    }

    private endGame() {
      console.log("Ending game...");
      cc.director.loadScene("ResultScene");
    }
    start() {
      this.schedule(() => {
        this.localPlayerData = this.gameManager.getLocalPlayerData();
      }, 0.5);
      for (let i = 1; i <= this.spaceNum; i++) {
        this.setOwnershipByIndex(i, NodeOwnership.NONE);
      }

      // Add click event listener to each space node
        this.spacesNode.children.forEach((child) => {
          cc.log(`Setting up click event for child: ${child.name}`);
          try {
            const spaceNum = parseInt(child.name.replace('space', ''));
            let button = child.getComponent(cc.Button);
            if (!button) {
              button = child.addComponent(cc.Button);
            }
            
            // Clear existing events to avoid duplicates
            button.clickEvents = [];
            
            const clickEventHandler = new cc.Component.EventHandler();
            clickEventHandler.target = this.node;
            clickEventHandler.component = "MapManager"; 
            clickEventHandler.handler = "onSpaceClicked";
            clickEventHandler.customEventData = spaceNum.toString();
            cc.log(`Setting up click event for space ${spaceNum}`);
            button.clickEvents.push(clickEventHandler);
          } catch (e) {
            cc.error(`Error setting up click for ${child.name}: ${e}`);
          }
        });
    }

    private loadGameScene() {
      cc.audioEngine.stopAll();
      cc.director.loadScene("MiniGameBalloon");
      //cc.director.loadScene("MiniGameSnowball");
    }

    private loadGameScene2() {
      cc.audioEngine.stopAll();
      cc.director.loadScene("MiniGameSnowball");
    }
    protected getSpaceNodeItemByIndex(index: number) {
      if (!this.spacesNode) {
        cc.error(`Spaces node ${index} is not set!`);
        return null;
      }
      if (index <= 0 || index > this.spaceNum) {
        cc.error(`Invalid index: ${index}. It should be between 1 and ${this.spaceNum}.`);
        return null;
      }
      let childNode = this.spacesNode.getChildByName(`space${index.toString().padStart(3, '0')}`);
      return childNode.getComponent(SpaceNodeItem);
    }

    public onSpaceClicked(event: cc.Event.EventTouch, index: string) {
      const spaceIndex = parseInt(index);
      let coord = this.getCoordByIndex(spaceIndex);
      let MapNodeEvent = this.getMapNodeEventByIndex(spaceIndex);
      let ownership = this.getOwnershipByIndex(spaceIndex);
      cc.log(`Space clicked at index: ${spaceIndex}, coord: ${coord}, event: ${MapNodeEvent}, ownership: ${ownership}`);
    }
    
    public getCoordByIndex(index: number): cc.Vec2 {
      const spaceNodeItem = this.getSpaceNodeItemByIndex(index);
      if (!spaceNodeItem) {
        cc.error(`Space node item at index ${index} not found!`);
        return cc.v2(0, 0); // Return a default value or handle the error as needed
      }
      const coord = spaceNodeItem.getCoord();
      coord.x -= 132; coord.y += 293;
      cc.log(`Coord for index ${index}: ${coord}`);
      return coord;
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

    public getOwnershipByIndex(index: number): NodeOwnership | null {
      const spaceNodeItem = this.getSpaceNodeItemByIndex(index);
      if (!spaceNodeItem) {
        cc.error(`Space node item at index ${index} not found!`);
        return null;
      }
      if (spaceNodeItem.mapNodeEvents === MapNodeEvents.NORMAL) {
        return spaceNodeItem.getOwner();
      }
      else {
        return NodeOwnership.NONE;
      }
    }

    public setOwnershipByIndex(index: number, ownership: NodeOwnership) {
      const spaceNodeItem = this.getSpaceNodeItemByIndex(index);
      if (!spaceNodeItem) {
        cc.error(`Space node item at index ${index} not found!`);
        return;
      }
      if (spaceNodeItem.mapNodeEvents === MapNodeEvents.NORMAL) {
        spaceNodeItem.Owner = ownership;
      } else {
        cc.warn(`Cannot set ownership for index ${index} as it is not a normal space.`);
      }
    }
    
    update (dt) {
        if (this.localPlayerData && this.moneyLabel) {
            if (this.localPlayerData.money !== this.lastMoney) {
                this.moneyLabel.string = `Money: ${this.localPlayerData.money}`;
                this.lastMoney = this.localPlayerData.money;
            }
        } else {
           // cc.warn("Local player data or money label is not set.");
        }
    }
    onDestroy() {
        console.log("MapManager onDestroy");
        if (MapManager.instance === this) {
            MapManager.instance = null;
        }
        
    }
}