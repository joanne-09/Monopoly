// To send game events, define your own interfaces that include data that your componenet needs.
// Also, in your script, a 
export interface PlayerMoveEvent {
    type: "player_move";
    playerId: string;
    from: { x: number, y: number };
    to: { x: number, y: number };
    animation?: string;
    timestamp?: number;
}

export enum MapNodeEvents {
    NORMAL,
    DESTINY,
    CHANCE,
    GAME,
}
