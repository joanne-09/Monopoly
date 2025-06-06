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
    // Balloon Minigame Events
    MINIGAME_BALLOON_SPAWN = 11,
    MINIGAME_BALLOON_POP_ATTEMPT = 12,
    MINIGAME_BALLOON_POPPED_CONFIRMED = 13,
    MINIGAME_BALLOON_GAME_OVER = 14,
    MINIGAME_BALLOON_SCORE_UPDATE = 15,
    MINIGAME_BALLOON_CURSOR_MOVE = 16, // Added for cursor synchronization
    PLAYER_MAP_JOINED = 17, // Check if player new player joined the map
    SHOW_MAP_EVENT_CARD = 18, // Show the map event card
    ENTER_MINI_GAME = 19, // Enter a mini-game
}