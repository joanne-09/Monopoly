export interface PlayerData {
    actorNumber: number; // Unique identifier for the player
    name: string; // Player's name
    avatar: PlayerAvatar; // Player's avatar ID
    position?: cc.Vec2; // Player's position in the game world
    positionIndex?: number;
    islocal?: boolean;
    isready?: boolean; // Indicates if the player is ready to start the game
    money?: number;
}
export interface PlayerMovement {
    actorNumber: number; // Unique identifier for the player
    name: string,
    avatar?: PlayerAvatar; // Player's avatar ID
    position: cc.Vec2[]; // Player's position in the game world
}
export enum PlayerAvatar {
    NULL = 0,
    ELECTRIC = "ELECTRIC",
    FIRE = "FIRE",
    GRASS = "GRASS",
    ICE = "ICE",
}

export enum PlayerState {
    IDLE = 1,
    MYTURN = 2,
    ROLLDICE = 3,
    MOVING = 4,
    GAMING = 5,
    WAITING = 6,
}