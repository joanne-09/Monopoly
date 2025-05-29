const {ccclass, property} = cc._decorator;
import { PlayerData } from "./types/DataTypes";
import { MapNodeEvents } from "./types/GameEvents";
import GameManager from "./GameManager";
import DiceCtrl from "./DiceRoll";

@ccclass('PlayerControl')
export class PlayerControl extends cc.Component {
    @property(cc.String)
    playerName: string = '';
    @property(cc.Float)
    playerId: number = 1;
    @property(cc.Float)
    playerAvatar: number = 0;

    @property(cc.Vec2)
    position: cc.Vec2 = cc.v2(0, 0);

    getPlayerInfo() {
        const playerData: PlayerData = GameManager.getInstance().getPlayerData(this.playerId);
        this.playerName = playerData.name;
        this.playerAvatar = playerData.avatar;
    }

    initializePosition() {

    }

    // Life-cycle callbacks
    onLoad() {
        this.getPlayerInfo();
        this.initializePosition();
    }
}