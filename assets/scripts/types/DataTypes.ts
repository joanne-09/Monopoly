export interface PlayerData {
    actorNumber: number; // Unique identifier for the player
    name: string; // Player's name
    avatar: PlayerAvatar; // Player's avatar ID
}

export enum PlayerAvatar {
    NULL = 0,
    ELECTRIC = "ELECTRIC",
    FIRE = "FIRE",
    GRASS = "GRASS",
    ICE = "ICE",
}