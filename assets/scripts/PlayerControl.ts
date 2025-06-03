const {ccclass, property} = cc._decorator;
import { PlayerData } from "./types/DataTypes";
import { MapNodeEvents } from "./types/GameEvents";
import NetworkManager from "./NetworkManager";
import GameManager from "./GameManager";
import DiceManager from "./DiceManager";

enum PlayerState {
    IDLE,
    MYTURN,
    ROLLDICE,
    MOVING,
    GAMING,
    WAITING,
}

@ccclass('PlayerControl')
export class PlayerControl extends cc.Component {
    @property(cc.String)
    playerName: string = '';
    @property(cc.Float)
    playerId: number = 1;
    @property(cc.Float)
    playerAvatar: number = 0;

    position: cc.Vec2 = cc.v2(0, 0);
    playerState: PlayerState = PlayerState.IDLE;

    private moveBuffer: cc.Vec2[] = [];
    private movementIndex: number = 0;
    private moveSpeed: number = 100;

    getPlayerInfo() {
        const playerData: PlayerData = GameManager.getInstance().getPlayerData(this.playerId);
        this.playerName = playerData.name;
        this.playerAvatar = playerData.avatar;
    }

    // Handle Player State
    setPlayerTurn() {
        this.playerState = PlayerState.MYTURN;
    }

    // Handle Player Position
    setPlayerPosition(position: cc.Vec2) {
        this.position = position;
        this.node.setPosition(position);

    }

    // Handle Player Move
    setPlayerMoveBuffer(newMovement: cc.Vec2[]) {
        if (newMovement.length > 0) {
            this.moveBuffer = newMovement.map(move => move.clone());
            this.movementIndex = 0;
            this.playerState = PlayerState.MOVING;
            console.log(`Player ${this.playerId} move buffer set:`, this.moveBuffer);
        }else{
            this.moveBuffer = [];
            this.playerState = PlayerState.IDLE;
            console.log(`Player ${this.playerId} move buffer cleared.`);
        }
    }

    getPlayerPosition(): cc.Vec2 {
        return this.position;
    }

    initializePosition(position: cc.Vec2 = cc.v2(0, 0)) {
        this.position = position;
        this.node.setPosition(position);
        this.playerState = PlayerState.IDLE;
        console.log(`Player ${this.playerId} initialized at position:`, position);

    }

    // Life-cycle callbacks
    onLoad() {
        this.playerId = NetworkManager.getInstance().getMyActorNumber();
        this.getPlayerInfo();
        this.initializePosition();
    }

    update(dt: number){
        if(this.playerState === PlayerState.MOVING){
            if(this.movementIndex < this.moveBuffer.length) {
                // get current move from the buffer
                const nextMove = this.moveBuffer[this.movementIndex];
                const currentPosition = this.node.getPosition();

                if(currentPosition.equals(nextMove)) {
                    // if the player is already at the next position
                    this.movementIndex++;
                }

                // move toward the target position
                const direction = nextMove.sub(currentPosition).normalize();
                const distance = this.moveSpeed * dt;
                const remainingDistance = nextMove.sub(currentPosition).mag();

                if(distance >= remainingDistance) {
                    // if the distance to the next position is less than or equal to the move speed
                    this.setPlayerPosition(nextMove);
                }else{
                    const moveVector = direction.mul(distance);
                    this.setPlayerPosition(currentPosition.add(moveVector));
                }

                this.node.setPosition(this.position);
            }else if(this.moveBuffer.length > 0) {
                this.playerState = PlayerState.IDLE;
                this.moveBuffer = [];
                this.movementIndex = 0;
                return;
            }
        }
    }
}