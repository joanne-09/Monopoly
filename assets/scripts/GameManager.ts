const {ccclass, property} = cc._decorator;
import NetworkManager from "./NetworkManager";
import { PlayerData } from "./types/DataTypes";
@ccclass
export default class GameManager extends cc.Component {
    private static instance: GameManager = null;

    @property(cc.Label)
    statusLabel: cc.Label = null;
    
    private playerData: PlayerData[] = []; // Store player data, e.g., actorNumber, name, avatar
    private playerMap: Map<number, PlayerData> = new Map(); // Map actorNumber to avatar sprites
    //private mapPhotonIDto
    private networkManager: NetworkManager = null;
    onLoad() {
        // Prevent duplicate instances
        if (GameManager.instance) {
            console.warn("GameManager: Instance already exists, destroying duplicate.");
            this.node.destroy();
            return;
        }
        // Only set instance and initialize if no instance exists
        GameManager.instance = this;

        // Make this node persistent across scenes
        if (!cc.game.isPersistRootNode(this.node)) {
            cc.game.addPersistRootNode(this.node);
            console.log("GameManager: Persist root node set.");
        }
        // Initialize NetworkManager
        this.networkManager = NetworkManager.getInstance();
        if (!this.networkManager) {
            console.error("GameManager: NetworkManager instance not found!");
            return;
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

    public static getInstance(): GameManager {
        return GameManager.instance;
    }

    
    public setPlayerNameandAvatar(name: string, avatar: cc.Sprite) {
        const myActorNumber = this.networkManager.getMyActorNumber();
        if (myActorNumber === -1) {
            console.error("GameManager: Cannot set player name and avatar, actor number is not valid.");
            return;
        }
        this.playerData.push({
            actorNumber: myActorNumber,
            name: name,
            avatar: avatar,
        });
        this.playerMap.set(myActorNumber, {
            actorNumber: myActorNumber,
            name: name,
            avatar: avatar});
    }

    public getPlayerData(actorNumber: number): PlayerData | null {
        return this.playerMap.get(actorNumber) || null;
    }
}