export enum PhotonEventCodes {
    SEND_MESSAGE = 1,
    PLAYER_MOVEMENT = 2,
    PLAYER_JOINED = 3,
    PLAYER_THROW_ACTION = 4, // Added
    PLAYER_HIT_ACTION = 5,   // Added
    CURRNET_TURN_PLAYER = 6,      // Added
    PLAYER_DATA = 7,
    START_GAME = 8,
    START_NEXT_ROUND = 9, // Added
    PLAYER_TRIGGERED_MAP_EVENT = 10, // Added
}