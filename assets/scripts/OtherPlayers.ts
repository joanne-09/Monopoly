const {ccclass, property} = cc._decorator;
import { PlayerData, PlayerAvatar, PlayerState } from "./types/DataTypes";

@ccclass
export default class OtherPlayers extends cc.Component {
    playerId: number = 0;
    playerName: string = '';
    playerAvatar: PlayerAvatar = PlayerAvatar.NULL;

    playerState: PlayerState = PlayerState.IDLE;
    position: cc.Vec2 = cc.v2(0, 0);

    private moveBuffer: cc.Vec2[] = [];
    private movementIndex: number = 0;
    private moveSpeed: number = 100;

    // Animation Settings
    private animationClip: string = '';
    private currentClip: string = '';

    // Init Player Data
    public initPlayer(playerData: PlayerData) {
        this.playerId = playerData.actorNumber;
        this.playerName = playerData.name;
        this.playerAvatar = playerData.avatar;
        this.initPlayerAnimation();
    }

    public initPlayerPosition(position: cc.Vec2) {
        this.setPlayerPosition(position);
    }

    // handle Player Animation
    initPlayerAnimation() {
        const animation = this.node.getComponent(cc.Animation);
        const clips = animation.getClips();
        switch (this.playerAvatar) {
            case PlayerAvatar.ELECTRIC:
                this.animationClip = clips[0].name;
                break;
            case PlayerAvatar.FIRE:
                this.animationClip = clips[2].name;
                break;
            case PlayerAvatar.GRASS:
                this.animationClip = clips[4].name;
                break;
            case PlayerAvatar.ICE:
                this.animationClip = clips[6].name;
                break;
        }
    }

    setPlayerAnimation(){
        const animation = this.node.getComponent(cc.Animation);
        const clips = animation.getClips();

        if(this.playerState === PlayerState.MOVING){
            switch (this.playerAvatar) {
            case PlayerAvatar.ELECTRIC:
                this.animationClip = clips[1].name;
                break;
            case PlayerAvatar.FIRE:
                this.animationClip = clips[3].name;
                break;
            case PlayerAvatar.GRASS:
                this.animationClip = clips[5].name;
                break;
            case PlayerAvatar.ICE:
                this.animationClip = clips[7].name;
                break;
            }
        }else{
            this.initPlayerAnimation();
        }
    }

    playAnimation() {
        const animation = this.node.getComponent(cc.Animation);
        if(this.currentClip !== this.animationClip) {
            animation.play(this.animationClip);
            this.currentClip = this.animationClip;
        }
    }

    // Handle Player Move
    public setPlayerMoveBuffer(newMovement: any[]) {
        if (newMovement.length > 0) {
            this.moveBuffer = newMovement.map(move => {
                if (move instanceof cc.Vec2) {
                    return move.clone();
                } else if (move && typeof move.x === "number" && typeof move.y === "number") {
                    return cc.v2(move.x, move.y);
                } else {
                    console.error("OtherPlayers: Invalid move data received:", move);
                    return cc.v2(0, 0);
                }
            });
            this.movementIndex = 0;
            this.playerState = PlayerState.MOVING;
            console.log(`Player ${this.playerId} move buffer set:`, this.moveBuffer);
        } else {
            this.moveBuffer = [];
            this.playerState = PlayerState.IDLE;
            console.log(`Player ${this.playerId} move buffer cleared.`);
        }
    }

    // Set Player State
    public setPlayerState(newState: PlayerState) {
        this.playerState = newState;
    }

    // Handle Player Position
    public getPlayerPosition(): cc.Vec2 {
        return this.position;
    }

    setPlayerPosition(newPosition: cc.Vec2) {
        this.position = newPosition;
        this.node.setPosition(newPosition);
    }

    update(dt: number){
        // Set player animation
        this.setPlayerAnimation();
        this.playAnimation();

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

                // Adjust the scale based on the direction
                if(direction.x > 0){
                    this.node.scaleX = Math.abs(this.node.scaleX);
                }else if(direction.x < 0){
                    this.node.scaleX = -Math.abs(this.node.scaleX);
                }

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
                return;
            }
        }
    }
}