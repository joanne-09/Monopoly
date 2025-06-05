const {ccclass, property} = cc._decorator;
import NetworkManager from "./NetworkManager";
import { PlayerAvatar, PlayerData } from "./types/DataTypes";
import { config } from "./firebase/firebase-service";
import { PhotonEventCodes } from "./types/PhotonEventCodes";
import MapManager from "./map/MapManager";
@ccclass
export default class GameManager extends cc.Component {
    private static instance: GameManager = null;

    @property(cc.Label)
    statusLabel: cc.Label = null;
    private playerMap: Map<number, PlayerData> = new Map(); // Map actorNumber to avatar sprites
    private localPlayerInfo: PlayerData = null;
    private networkManager: NetworkManager = null;
    private mapManager: MapManager = null; // For managing map-related logic
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
        }
    }

    private broadcastTurn() {
        if (!this.isGameActive) {
            console.warn("GameManager: Cannot broadcast turn, game is not active.");
            return;
        }
        if (!this.currentTurnPlayer) {
            console.error(`GameManager: No player data found for actor number ${this.currentTurnIndex}.`);
            return;
        }
        // Broadcast the current player's turn to all clients
        this.networkManager.sendGameAction(PhotonEventCodes.PLAYER_TURN, this.currentTurnPlayer);
        console.log(`GameManager: Broadcasting turn for player ${this.currentTurnPlayer}.`);
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

        const playerList = this.getPlayerList().sort((a, b) => a.actorNumber - b.actorNumber);
        if (playerList.length === 0) {
            console.error("GameManager: No players found in playerMap. Cannot start game.");
            return;
        }
        this.currentTurnPlayer = playerList[this.currentTurnIndex];

        this.mapManager = MapManager.getInstance();

        // Initialize playerData
        this.playerMap.forEach((playerData: PlayerData) => {
            if (playerData.actorNumber === this.networkManager.getMyActorNumber()) {
                playerData.islocal = true;
            }
            if (playerData.islocal) {
                playerData.position = this.mapManager.getCoordByIndex(0);
                playerData.money = 1500;
                this.broadcastPlayerData();
            }
        });

        this.broadcastTurn();
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