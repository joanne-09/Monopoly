export interface PlayerData {
    actorNumber: number; // Unique identifier for the player
    name: string; // Player's name
    avatar: PlayerAvatar; // Player's avatar ID
}

export enum PlayerAvatar {
    ELECTRIC = 1,
    FIRE = 2,
    GRASS = 3,
    ICE = 4,
}