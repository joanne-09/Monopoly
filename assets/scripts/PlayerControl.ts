const {ccclass, property} = cc._decorator;
import { PlayerData, PlayerAvatar, PlayerState } from "./types/DataTypes";
import { PhotonEventCodes } from "./types/PhotonEventCodes";
import { MapNodeEvents } from "./types/GameEvents";
import NetworkManager from "./NetworkManager";
import GameManager from "./GameManager";
import DiceManager from "./DiceManager";
import OtherPlayers from "./OtherPlayers";
import CameraFollow from "./CameraFollow";

@ccclass('PlayerControl')
export class PlayerControl extends cc.Component {
    @property(cc.Prefab)
    otherPlayerPrefab: cc.Prefab = null;
    @property(DiceManager)
    diceManager: DiceManager = null;
    @property(cc.Button)
    rollDiceButton: cc.Button = null;

    private playerCamera: cc.Node = null;

    playerName: string = '';
    playerId: number = 0;
    
    playerAvatar: PlayerAvatar = PlayerAvatar.NULL;

    whosTurn: number = 0;
    otherPlayerMap: Map<number, cc.Node> = new Map();

    position: cc.Vec2 = cc.v2(0, 0);
    playerState: PlayerState = PlayerState.IDLE;

    private moveBuffer: cc.Vec2[] = [];
    private movementIndex: number = 0;
    private moveSpeed: number = 150;

    private networkManager: NetworkManager = null;
    private gameManager: GameManager = GameManager.getInstance();

    // Send message to the network
    private sendMessageToNetwork(eventCode: number, content: any) {
        NetworkManager.getInstance().sendGameAction(eventCode, content);
    }

    private networkManagerHandler(eventCode: number, content: any, actorNr: number) {
        //Will listen to all events on photon
        switch(eventCode) {
            case PhotonEventCodes.PLAYER_TURN:
                this.setPlayerTurn(content.actorNumber);
                break;
            case PhotonEventCodes.PLAYER_MOVEMENT:
                if(this.playerState === PlayerState.ROLLDICE) {
                    this.setPlayerMoveBuffer(content);
                }else{
                    this.setOtherPlayerMoveBuffer(this.whosTurn, content);
                }
                break;
        }
    }

    // Handle Player State
    setPlayerTurn(turn: number) {
        this.whosTurn = turn;
        if (this.whosTurn === this.playerId) {
            this.playerState = PlayerState.MYTURN;
            console.log(`Player ${this.playerId} is now MYTURN and should roll the dice.`);
        }else{
            this.playerState = PlayerState.IDLE;
            this.otherPlayerMap.get(this.whosTurn).getComponent(OtherPlayers).setPlayerState(PlayerState.MYTURN);
            console.log(`Player ${this.whosTurn} is now MYTURN and wait for PlayerControl to move it.`);
        }
    }

    setPlayerPosition(position: cc.Vec2) {
        this.position = position;
        this.node.setPosition(position);
    }

    /*
    * Get the current position of the player.
    * @returns {cc.Vec2} - The current position of the player.
    * This method returns the position of the player as a cc.Vec2 object.
    */
    public getPlayerPosition(playerId: number): cc.Vec2 {
        if (playerId === this.playerId) {
            console.log(`Player ${this.playerId} position:`, this.position);
            return this.position;
        } else {
            const otherPlayerNode = this.otherPlayerMap.get(playerId);
            if (otherPlayerNode) {
                const target = otherPlayerNode.getPosition();
                console.log(`Other Player ${playerId} position:`, target);
                return target;
            }
        }
        return cc.v2(0, 0);
    }

    // Handle Player Move
    setPlayerMoveBuffer(newMovement: any[]) {
        if (newMovement.length > 0) {
            this.moveBuffer = newMovement.map(move => cc.v2(move.x, move.y));
            this.movementIndex = 0;
            this.playerState = PlayerState.MOVING;
            console.log(`Player ${this.playerId} move buffer set:`, this.moveBuffer);
        } else {
            this.moveBuffer = [];
            this.playerState = PlayerState.IDLE;
            console.log(`Player ${this.playerId} move buffer cleared.`);
        }
    }

    setOtherPlayerMoveBuffer(actorNumber: number, newMovement: cc.Vec2[]) {
        const otherPlayerNode = this.otherPlayerMap.get(actorNumber);
        otherPlayerNode.getComponent(OtherPlayers).setPlayerMoveBuffer(newMovement);
    }

    // Handle Other Players Init
    initPlayers(playerList: PlayerData[]) {
        playerList.forEach(player => {
            console.log("PlayerControl initPlayers", player);
            if (player.actorNumber !== this.playerId) {
                const otherPlayerNode = cc.instantiate(this.otherPlayerPrefab);
                const playerControl = otherPlayerNode.getComponent(OtherPlayers);
                playerControl.initPlayer(player);
                this.otherPlayerMap.set(player.actorNumber, otherPlayerNode);
                this.node.parent.addChild(otherPlayerNode);
            }else{
                this.playerName = player.name;
                this.playerAvatar = player.avatar;
                this.initPlayerAnimation();
            }
        });
    }

    initPlayersPosition(playerList: PlayerData[]) {
        playerList.forEach(player => {
            if (player.actorNumber !== this.playerId) {
                const otherPlayerNode = this.otherPlayerMap.get(player.actorNumber);
                otherPlayerNode.getComponent(OtherPlayers).initPlayerPosition(cc.v2(player.position.x, player.position.y));
            } else {
                this.setPlayerPosition(cc.v2(player.position.x, player.position.y));
            }
        });
    }

    initPlayerAnimation() {
        const animation = this.node.getComponent(cc.Animation);
        const clips = animation.getClips();
        switch (this.playerAvatar) {
            case PlayerAvatar.ELECTRIC:
                animation.play(clips[0].name);
                break;
            case PlayerAvatar.FIRE:
                animation.play(clips[2].name);
                break;
            case PlayerAvatar.GRASS:
                animation.play(clips[4].name);
                break;
            case PlayerAvatar.ICE:
                animation.play(clips[6].name);
                break;
        }
    }

    // Handle Roll Dice
    async rollDice(): Promise<number> {
        const result = await this.diceManager.onDiceRollTriggered(null, "1");
        console.log(`Player ${this.playerId} rolled:`, result);
        return result;
    }

    // Life-cycle callbacks
    onLoad() {
        // Find player id and add other players to its child
        this.networkManager = NetworkManager.getInstance();
        this.playerId = NetworkManager.getInstance().getMyActorNumber();
        this.initPlayers(this.gameManager.getPlayerList());

        // Connect to the network manager and register the message handler
        this.networkManagerHandler = this.networkManagerHandler.bind(this);
        NetworkManager.getInstance().registerMessageHandler(this.networkManagerHandler);

        // Find the player camera
        this.playerCamera = this.node.getChildByName('PlayerCamera');
        this.playerCamera.getComponent(CameraFollow).initPlayers(this.gameManager.getPlayerList(), this.playerId);

        // Bind the rollDiceButton click event
        if (this.rollDiceButton) {
            this.rollDiceButton.node.on('click', async () => {
                if (this.playerState === PlayerState.MYTURN) {
                    this.playerState = PlayerState.ROLLDICE;
                    const rollResult = await this.rollDice();
                    console.log(`Player ${this.playerId} rolled:`, rollResult);

                    this.gameManager.rolledDice(rollResult);
                } else {
                    console.warn(`Player ${this.playerId} tried to roll dice but it's not their turn.`);
                }
            });
        }
    }

    start(){
        this.initPlayersPosition(this.gameManager.getPlayerList());
    }

    update(dt: number){
        if(this.playerState === PlayerState.MYTURN) {

        }else if(this.playerState === PlayerState.MOVING){
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
            }else if(this.moveBuffer.length > 0) {
                this.playerState = PlayerState.IDLE;
                this.moveBuffer = [];
                this.movementIndex = 0;

                this.gameManager.playerMovementCompleted();
                return;
            }
        }

        // Show/hide rollDiceButton based on playerState
        if (this.rollDiceButton) {
            this.rollDiceButton.node.active = (this.playerState === PlayerState.MYTURN);
        }
    }
    protected onDestroy(): void {
        this.networkManager.unregisterMessageHandler(this.networkManagerHandler);
    }
}