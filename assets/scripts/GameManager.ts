const {ccclass, property} = cc._decorator;
import NetworkManager from "./NetworkManager";
import { PlayerAvatar, PlayerData } from "./types/DataTypes";
import { config } from "./firebase/firebase-service";
import { PhotonEventCodes } from "./types/PhotonEventCodes";
@ccclass
export default class GameManager extends cc.Component {
    private static instance: GameManager = null;

    @property(cc.Label)
    statusLabel: cc.Label = null;
    private playerData: PlayerData[] = []; // Store player data, e.g., actorNumber, name, avatar
    private playerMap: Map<number, PlayerData> = new Map(); // Map actorNumber to avatar sprites
    private localPlayerInfo: PlayerData = null;
    //private mapPhotonIDto
    private networkManager: NetworkManager = null;
    private networkHandler: (eventCode: number, content: any, actorNr: number) => void = null;
    
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

    //content is playerData type
    private networkManagerHandler(eventCode: number, content: any, actorNr: number) {
        if(eventCode != PhotonEventCodes.PLAYER_JOINED) return;
        let clients = this.networkManager["client"];
        console.log("GameManager: Network manager handler called with event code:", eventCode, "content:", content, "actorNr:", actorNr);
        //console.log("GameManager: Current clients:", clients);
        this.playerMap.set(actorNr, content);
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
        // this.playerData.push({
        //     actorNumber: myActorNumber,
        //     name: name,
        //     avatar: avatar,
        // });
        this.localPlayerInfo = {
            actorNumber: myActorNumber,
            name: name,
            avatar: avatar
        };
        // this.playerMap.set(myActorNumber, {
        //     actorNumber: myActorNumber,
        //     name: name,
        //     avatar: avatar
        // });
    }


    //Find who am I, returns PlayerData

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

    public getPlayerList(): PlayerData[] {
        return Array.from(this.playerMap.values());
    }
    public getPlayerData(actorNumber: number): PlayerData | null {
        return this.playerMap.get(actorNumber) || null;
    }
}