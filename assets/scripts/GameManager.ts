const {ccclass, property} = cc._decorator;
import NetworkManager from "./NetworkManager";
import { PlayerAvatar, PlayerData } from "./types/DataTypes";
import { config } from "./firebase/firebase-service";
import { PhotonEventCodes } from "./types/PhotonEventCodes"; // Make sure this is correctly imported
import MapManager from "./map/MapManager";
import { MapNodeEvents } from "./types/GameEvents";
@ccclass
export default class GameManager extends cc.Component {
    private static instance: GameManager = null;

    @property(cc.Label)
    statusLabel: cc.Label = null;
    private playerMap: Map<number, PlayerData> = new Map(); // Map actorNumber to avatar sprites
    private localPlayerInfo: PlayerData = null;
    private networkManager: NetworkManager = null;
    private mapManager: MapManager = null; // For managing map-related logic
    private playerList: PlayerData[] = [];
    // For handling gameplay events and logic
    private round = 0;
    private currentTurnIndex = 0; // Index of the player whose turn it is
    private currentTurnPlayer: PlayerData = null; // The player whose turn it is currently
    private isGameActive = false; // Flag to check if the game is active

    
    onLoad() {
        // Prevent duplicate instances
        if (GameManager.instance) {
            console.warn("GameManager: Instance already exists, destroying duplicate.");
            this.node.destroy();
            return;
        }
        // Only set instance and initialize if no instance exists
        GameManager.instance = this;

        // Initialize NetworkManager FIRST
        this.networkManager = NetworkManager.getInstance();
        if (!this.networkManager) {
            console.error("GameManager: NetworkManager instance not found!");
            return;
        }

        this.networkManagerHandler = this.networkManagerHandler.bind(this);
        this.networkManager.registerMessageHandler(this.networkManagerHandler);

        // Make this node persistent across scenes
        if (!cc.game.isPersistRootNode(this.node)) {
            cc.game.addPersistRootNode(this.node);
            console.log("GameManager: Persist root node set.");
        }
        this.initialize();
    }

    private initialize() {
        // Initialization logic here
        console.log("GameManager: Initialized successfully.");
        if (this.statusLabel) {
            this.statusLabel.string = "Game Manager Initialized";
        }
    }

    // Network broadcast and listening
    //content is playerData type
    private networkManagerHandler(eventCode: number, content: any, actorNr: number) {
        if(eventCode == PhotonEventCodes.PLAYER_JOINED) {
            let clients = this.networkManager["client"];
            console.log("GameManager: Network manager handler called with event code:", eventCode, "content:", content, "actorNr:", actorNr);
            //console.log("GameManager: Current clients:", clients);
            this.playerMap.set(actorNr, content);
        } else if(eventCode == PhotonEventCodes.PLAYER_DATA) {
            console.log("GameManager: Received player data from network manager handler.");
            this.playerMap = new Map(content.map((player: PlayerData) => [player.actorNumber, player]));
            // Potentially update this.playerList if game is active and master client
            if (this.isGameActive) {
                this.playerList = this.getPlayerList().sort((a, b) => a.actorNumber - b.actorNumber);
                console.log("GameManager: playerList updated due to PLAYER_DATA event on master.", this.playerList);
            }
        } else if(eventCode == PhotonEventCodes.PLAYER_MOVEMENT) { 
            console.log("GameManager: Received player movement from network manager handler.");
            //no need to update since player movement is already updated in playerController
        } else if(eventCode == PhotonEventCodes.CURRNET_TURN_PLAYER) {
            console.log("GameManager: Received player turn from network manager handler.");
            this.currentTurnPlayer = content;
        } else if (eventCode == PhotonEventCodes.START_NEXT_ROUND) {
            console.log(`GameManager: Received STARTNEXTROUND event from actorNr: ${actorNr}. Content:`, content);
            console.log(`GameManager (Master): Processing PLAYER_MOVE_COMPLETED for actorNr ${actorNr}. Current turn player: ${this.currentTurnPlayer.name} (Actor: ${this.currentTurnPlayer.actorNumber}). PlayerList length: ${this.playerList.length}, CurrentTurnIndex: ${this.currentTurnIndex}`);
            if (this.networkManager.isMasterClient()) {
                this.currentTurnIndex = (content + 1) % this.playerList.length;
                this.currentTurnPlayer = this.playerList[this.currentTurnIndex];
                this.round++;
                console.log(`GameManager (Master): Turn advanced via event. New round: ${this.round}. New turn for player: ${this.currentTurnPlayer.name} (Actor: ${this.currentTurnPlayer.actorNumber}).`);
                this.broadcastPlayerData(); // Broadcast any state changes
                this.broadcastTurn();     // Broadcast the new turn
            }
            
        } else if(eventCode == PhotonEventCodes.PLAYER_TRIGGERED_MAP_EVENT) {
            if(this.networkManager.isMasterClient()) {
                console.log("GameManager: Received PLAYER_TRIGGERED_MAP_EVENT from network manager handler.");
                this.handleMapEvent(content);
            } else {
                console.warn("GameManager: Received PLAYER_TRIGGERED_MAP_EVENT, but this client is not the master client. Ignoring event.");
            }
        }
    }

    private handleMapEvent(mapEvent: MapNodeEvents) {
        switch(mapEvent) {
            case MapNodeEvents.NORMAL:
                console.log("GameManager: Handling NORMAL map event.");
                this.playerMap.forEach((playerData: PlayerData) => {
                    if(playerData.actorNumber === this.currentTurnPlayer.actorNumber) {
                        playerData.money += 100;
                    }
                });
                this.broadcastPlayerData();
                break;
            case MapNodeEvents.DESTINY:
                console.log("GameManager: Handling DESTINY map event.");
                break;
            case MapNodeEvents.CHANCE:
                console.log("GameManager: Handling CHANCE map event.");
                break;
            case MapNodeEvents.GAME:
                console.log("GameManager: Handling GAME map event.");
                break;
        }
        this.broadcastNextRound();
    }

    private broadcastNextRound() {
        this.networkManager.sendGameAction(PhotonEventCodes.START_NEXT_ROUND, this.currentTurnIndex); // PLAYER_MOVE_COMPLETED is used to broadcast the next round
    }
    private broadcastTurn() {
        if (!this.isGameActive) {
            console.warn("GameManager: Cannot broadcast turn, game is not active.");
            return;
        }
        if (!this.currentTurnPlayer) {
            // It's possible currentTurnIndex is out of bounds if playerList changed, ensure currentTurnPlayer is valid.
            if (this.playerList && this.playerList.length > 0) {
                 this.currentTurnPlayer = this.playerList[this.currentTurnIndex % this.playerList.length];
            }
            if (!this.currentTurnPlayer) {
                console.error(`GameManager: No player data found for currentTurnIndex ${this.currentTurnIndex}. PlayerList length: ${this.playerList?.length}. Cannot broadcast turn.`);
                return;
            }
        }
        // Broadcast the current player's turn to all clients
        this.networkManager.sendGameAction(PhotonEventCodes.CURRNET_TURN_PLAYER, this.currentTurnPlayer);
        console.log(`GameManager: Broadcasting turn for player ${this.currentTurnPlayer.name} (Actor: ${this.currentTurnPlayer.actorNumber}).`);
    }

    private broadcastPlayerData(){ //broadcast updated player data to call clients (gameManagers)
        if (!this.isGameActive) {
            console.warn("GameManager: Cannot broadcast player data, game is not active.");
            return;
        }
        // Broadcast the player data to all clients
        this.networkManager.sendGameAction(PhotonEventCodes.PLAYER_DATA, Array.from(this.playerMap.values()));
        console.log("GameManager: Broadcasting player data to all clients.");
    }

    private broadcastPlayerMovement(playerMovement: cc.Vec2[]) {
        if (!this.isGameActive) {
            console.warn("GameManager: Cannot broadcast player movement, game is not active.");
            return;
        }
        this.networkManager.sendGameAction(PhotonEventCodes.PLAYER_MOVEMENT, playerMovement);
        console.log("Player movement broadcasted to Photon: ", playerMovement);
    }


    public static getInstance(): GameManager {
        return GameManager.instance;
    }

    // This is called in Avatar Select, but this only sets local player data
    public setPlayerNameandAvatar(name: string, avatar: PlayerAvatar) {
        const myActorNumber = this.networkManager.getMyActorNumber();
        if (myActorNumber === -1) {
            console.error("GameManager: Cannot set player name and avatar, actor number is not valid.");
            return;
        }
        this.localPlayerInfo = {
            actorNumber: myActorNumber,
            name: name,
            avatar: avatar
        };
    }

    //Find who am I, returns PlayerData of local player
    public whoAmI(): PlayerData | null {
        const myActorNumber = this.networkManager.getMyActorNumber();
        // if (myActorNumber === -1) {
        //     console.error("GameManager: Cannot retrieve player data, actor number is not valid.");
        //     return null;
        // }
        const playerData = this.localPlayerInfo;
        if (!playerData) {
            console.warn(`GameManager: No player data found for actor number ${myActorNumber}.`);
            return null;
        }
        return playerData;
    }

    // Given an actor number, check if the player is local
    public isPlayerLocal(actorNumber: number): boolean {
        const myActorNumber = this.networkManager.getMyActorNumber();
        if (myActorNumber === -1) {
            console.error("GameManager: Cannot check if player is local, actor number is not valid.");
            return false;
        }
        if (actorNumber === myActorNumber) {
            return true; // The player is local if the actor number matches
        } else {
            return false; // The player is not local if the actor number does not match
        }
    }

    // Returns a list of all players in the game
    public getPlayerList(): PlayerData[] {
        return Array.from(this.playerMap.values());
    }

    public getLocalPlayerData(): PlayerData | null {
        const myActorNumber = this.networkManager.getMyActorNumber();
        if (myActorNumber === -1) {
            console.error("GameManager: Cannot retrieve local player data, actor number is not valid.");
            return null;
        }
        const localPlayerData = this.playerMap.get(myActorNumber);
        if (!localPlayerData) {
            console.warn(`GameManager: No local player data found for actor number ${myActorNumber}.`);
            return null;
        }

        return localPlayerData;
    }
    // Returns the player data for a specific actor number
    public getPlayerData(actorNumber: number): PlayerData | null {
        return this.playerMap.get(actorNumber) || null;
    }

    // gameplay logic
    public startGame() {
        this.isGameActive = true;
        this.round = 1;
        this.currentTurnIndex = 0;

        this.playerList = this.getPlayerList().sort((a, b) => a.actorNumber - b.actorNumber);
        if (this.playerList.length === 0) {
            console.error("GameManager: No players found in playerMap. Cannot start game.");
            return;
        }
        this.currentTurnPlayer = this.playerList[this.currentTurnIndex];

        this.mapManager = MapManager.getInstance();
        if (!this.mapManager) {
            console.error("GameManager: MapManager instance not found!");
            // Potentially try to get it again or handle the error
            this.mapManager = MapManager.getInstance(); // Retry
            if (!this.mapManager) return; // Still not found, exit
        }
        

        // Initialize playerData for ALL players on the Master Client
        this.playerMap.forEach((playerData: PlayerData) => {
            if(playerData.actorNumber === this.networkManager.getMyActorNumber()) {
                playerData.islocal = true; // Set local player flag
                playerData.isready = true; // Set local player as ready
                this.broadcastPlayerData();
            }
        })
        if (this.networkManager.isMasterClient()) {
            this.playerMap.forEach((playerData: PlayerData) => {
                // Set islocal flag based on the current client's perspective,
                // but this part of the loop is for master client's initialization of shared state.
                // The actual 'islocal' for each client will be determined by them based on their actorNumber.
                // However, the master client needs to prepare the full initial state.
                playerData.positionIndex = 1; 
                playerData.position = this.mapManager.getCoordByIndex(1);
                playerData.money = 1500;
                // 'islocal' will be correctly determined by each client upon receiving the data
                // or can be set here if we are careful, but the primary goal is to ensure
                // position and money are set for everyone by the master.
            });
            this.broadcastPlayerData(); // Broadcast once after all players are initialized
        }
        
        // Each client will set its own 'islocal' property correctly when processing received player data
        // or when their PlayerControl initializes.
        // For the local player on this client instance:

        this.broadcastTurn(); // Master client should typically manage turns
    }

    public rolledDice(diceValue: number) {
        if (!this.isGameActive) {
            console.warn("GameManager: Cannot roll dice, game is not active.");
            return;
        }
        if (diceValue <= 0) {
            console.error("GameManager: Invalid dice value rolled:", diceValue);
            return;
        }

        // Ensure currentTurnPlayer and its actorNumber are valid
        if (!this.currentTurnPlayer || typeof this.currentTurnPlayer.actorNumber !== 'number') {
            console.error("GameManager: currentTurnPlayer is not properly set or actorNumber is missing.");
            return;
        }

        // Get the most up-to-date player data from the playerMap using the actorNumber from currentTurnPlayer
        const playerToMove = this.playerMap.get(this.currentTurnPlayer.actorNumber);

        if (!playerToMove) {
            console.error(`GameManager: Player data not found in playerMap for current turn player actorNr: ${this.currentTurnPlayer.actorNumber}`);
            return;
        }

        // Log the starting state using the data from playerMap
        console.log(`GameManager: Player ${playerToMove.name} (Actor: ${playerToMove.actorNumber}) rolling dice. Value: ${diceValue}. Starting positionIndex: ${playerToMove.positionIndex}, Starting world position: (${playerToMove.position?.x?.toFixed(2)}, ${playerToMove.position?.y?.toFixed(2)})`);

        let playerMovement: cc.Vec2[] = [];
        // This will be the logical, potentially ever-increasing, position index.
        // MapManager.getCoordByIndex is expected to handle wrapping this to a board coordinate.
        let newLogicalPositionIndex = playerToMove.positionIndex; 

        for (let i = 0; i < diceValue; i++) {
            newLogicalPositionIndex++; // Increment the logical position index for the next step
            const stepPosition = this.mapManager.getCoordByIndex(newLogicalPositionIndex);

            if (!stepPosition) {
                console.error(`GameManager: mapManager.getCoordByIndex(${newLogicalPositionIndex}) returned undefined for step ${i + 1}! Player: ${playerToMove.name}`);
                // Abort movement calculation if a coordinate is invalid
                return;
            }
            playerMovement.push(stepPosition.clone()); // Clone to ensure unique Vec2 objects in the array
        }

        // Update the PlayerData in the playerMap with the final logical positionIndex 
        // and its corresponding Vec2 position from the MapManager.
        playerToMove.positionIndex = newLogicalPositionIndex; 
        const finalPositionVec = this.mapManager.getCoordByIndex(playerToMove.positionIndex);
        
        if (!finalPositionVec) {
            console.error(`GameManager: mapManager.getCoordByIndex(${playerToMove.positionIndex}) for final position returned undefined! Player: ${playerToMove.name}`);
            // Attempt to use the last position in playerMovement if available
            if (playerMovement.length > 0) {
                playerToMove.position = playerMovement[playerMovement.length - 1].clone();
            } else if (playerToMove.position === undefined || playerToMove.position === null) {
                // If there's no movement and position is bad, this is a critical state.
                // For now, log and potentially revert positionIndex if necessary, or rely on last good broadcast.
                console.error(`GameManager: Critical - final position for ${playerToMove.name} is undefined and no movement path was generated.`);
                // playerToMove.positionIndex = playerToMove.positionIndex - diceValue; // Revert index if diceValue > 0
            }
        } else {
            playerToMove.position = finalPositionVec.clone();
        }

        console.log(`GameManager: Player ${playerToMove.name} finished rolling. Final positionIndex: ${playerToMove.positionIndex}. Final world position: (${playerToMove.position?.x?.toFixed(2)}, ${playerToMove.position?.y?.toFixed(2)}). Movement path items: ${playerMovement.length}`);

        this.broadcastPlayerData(); // playerMap now contains the updated playerToMove
        this.broadcastPlayerMovement(playerMovement);
    }

    // Called when player movement is completed in playerController
    public playerMovementCompleted() {
        if (!this.isGameActive) {
            console.warn("GameManager: playerMovementCompleted called, but game is not active.");
            return;
        }

        const myActorNumber = this.networkManager.getMyActorNumber();
        // Check if it's actually this player's turn before sending the event
        if (this.currentTurnPlayer && this.currentTurnPlayer.actorNumber === myActorNumber) {
            console.log(`GameManager (Client ${myActorNumber}): My movement completed.`);

            // Handle map events
            const currentPlayerMapEvent: MapNodeEvents = this.getMapEventofCurrentPlayer();
            console.log(`GameManager (Client ${myActorNumber}): Current player map event: ${currentPlayerMapEvent}`);
            if(currentPlayerMapEvent !== null) {
                this.networkManager.sendGameAction(PhotonEventCodes.PLAYER_TRIGGERED_MAP_EVENT, currentPlayerMapEvent);
            }  
            //this.networkManager.sendGameAction(PhotonEventCodes.PLAYER_MOVE_COMPLETED, { /* actorWhoMoved: myActorNumber */ }); // Content is optional
        } else {
            console.warn(`GameManager (Client ${myActorNumber}): playerMovementCompleted called, but it's not my turn (current: ${this.currentTurnPlayer?.name} (Actor: ${this.currentTurnPlayer?.actorNumber})).`);
        }
    }

    public getMapEventofCurrentPlayer(): MapNodeEvents | null { 
        const currentPlayerData = this.currentTurnPlayer;

        if (!currentPlayerData) {
            console.error("GameManager: No current player data found for getting map event.");
            return null;
        }
        return this.mapManager.getMapNodeEventByIndex(currentPlayerData.positionIndex);
    }
}

// TODO 
/*
1. Implement who's round is it (including player turn logic)
    send this information to playercontroller
2. Roll a dice in player controller
    sends the result to gamemanager, gamemanger invokes mapcontroller to get data
3. After gettign data form mapController, broadcast data to Photon
   includes who's movement and its movign positions in a cc.vec2 array
4. In playerController, receive data and update player position
    will need to handle which players are local and which are remote (use islocal and whoamI function in GameManager)

Notes:
In each round
    1. Invoke roll dice playerController
    2. Get the result and send it to GameManager
    3. GameManager invokes MapController to get data
    4. MapController returns data to GameManager
    5. GameManager broadcasts data to Photon


*/