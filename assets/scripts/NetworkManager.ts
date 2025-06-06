// Example structure in a TypeScript file (e.g., NetworkManager.ts)
// Ensure the Photon library is loaded globally (e.g., window.Photon)
// You might need to declare Photon if you don't have a .d.ts file:
// declare var Photon: any;

const { ccclass, property } = cc._decorator;

@ccclass
export default class NetworkManager extends cc.Component {

    private static instance: NetworkManager = null;

    private APP_ID = "e67b38a8-62a3-4f6b-bb72-f735e94a0016"; // Replace with your AppId
    private APP_VERSION = "1.0";
    private client: Photon.LoadBalancing.LoadBalancingClient;

    private messageHandlers: Array<(eventCode: number, content: any, actorNr: number) => void> = [];
    private playerReadyCallbacks: Array<(actorNr: number) => void> = [];

    onLoad() {
        // Prevent duplicate instances
        if (NetworkManager.instance) {
            // console.log("NetworkManager: Instance already exists, destroying duplicate.");
            this.node.destroy();
            return;
        }
        // Only set instance and initialize if no instance exists
        // console.log("NetworkManager: Instance created.");
        NetworkManager.instance = this;

        // Make this node persistent across scenes
        if (!cc.game.isPersistRootNode(this.node)) {
            cc.game.addPersistRootNode(this.node);
            //console.log("NetworkManager: Persist root node set.");
        }

        this.initializePhoton();
    }

    private initializePhoton() {
        // Ensure the Photon library is available
        if (typeof Photon === 'undefined') {
            console.error("Photon SDK not loaded!");
            return;
        }
        // console.log("NetworkManager: Photon SDK found.");

        // Initialize Photon client only once
        this.client = new Photon.LoadBalancing.LoadBalancingClient(Photon.ConnectionProtocol.Ws, this.APP_ID, this.APP_VERSION);
        // console.log("NetworkManager: Photon client initialized.");
        console.log(this.client);
        this.client.setLogLevel(Photon.LogLevel.WARN); // Options: ERROR, WARN, INFO, DEBUG
        this.setupPhotonCallbacks();
    }

    connectToPhoton() {
        if (this.client) {
            // Essential: log only when actually attempting to connect
            console.log("NetworkManager: Attempting to connect to Photon...");
            this.client.connectToRegionMaster("hk"); // e.g., "us", "eu", "asia"
        } else {
            console.error("NetworkManager: Photon client not initialized, cannot connect.");
        }
    }

    setupPhotonCallbacks() {
        if (!this.client) {
            console.error("NetworkManager: Client not initialized, cannot setup callbacks.");
            return;
        }
        
        this.client.onStateChange = (state: number) => {
            console.log("Photon State Change: " + state);
            if (state === Photon.LoadBalancing.LoadBalancingClient.State.ConnectedToMaster) {
                console.log("Successfully connected to Master Server. Client will automatically join lobby...");
            } else if (state === Photon.LoadBalancing.LoadBalancingClient.State.JoinedLobby) {
                console.log("Successfully joined Lobby. Ready to join or create rooms.");
                this.joinOrCreateMonopolyRoom();
            }
        };

        this.client.onJoinRoom = (createdByMe: boolean) => {
            console.log(`NetworkManager: Room joined. Was created by me: ${createdByMe}`);
            const actor = this.client.myActor && typeof this.client.myActor === 'function' ? this.client.myActor() : null;
            if (actor && actor.actorNr !== undefined) {
                const myActorNr = actor.actorNr;
                console.log(`NetworkManager: My actor number ${myActorNr} is now available.`);
                this.playerReadyCallbacks.forEach(cb => {
                    try {
                        cb(myActorNr);
                    } catch (error) {
                        console.error("NetworkManager: Error in playerReadyCallback:", error);
                    }
                });
                this.playerReadyCallbacks = []; // Clear callbacks after firing
            } else {
                console.warn("NetworkManager: Joined room but myActor or actorNr is not yet available. Player ready callbacks deferred.");
            }
        };

        this.client.onEvent = (code: number, content: any, actorNr: number) => {
            // Comment out verbose event logging
            // console.log(`NetworkManager: Received event ${code} from actor ${actorNr} with content:`, content);
            this.broadcastToHandlers(code, content, actorNr);
            // Handle custom game events for Monopoly (dice roll, buy property, etc.)
            // Example: if (code === MY_GAME_EVENT_CODES.PLAYER_MOVED) { ... }
        };

        this.client.onActorJoin = (actor: Photon.LoadBalancing.Actor) => {
            // Comment out verbose join logging
            // console.log(`NetworkManager: Player ${actor.actorNr} (${actor.userId || 'No UserId'}) joined the room.`);
        };

        this.client.onActorLeave = (actor: Photon.LoadBalancing.Actor, cleanup: boolean) => {
            // Comment out verbose leave logging
            // console.log(`NetworkManager: Player ${actor.actorNr} (${actor.userId || 'No UserId'}) left the room. Cleanup: ${cleanup}`);
        };

    }

    joinOrCreateMonopolyRoom() {
        if (this.client && this.client.isInLobby()) {
            // Essential: log room join/create attempt
            console.log("NetworkManager: Attempting to join or create a Monopoly room...");
            const matchmakingOptions = {
                expectedCustomRoomProperties: { gameType: "monopoly" }
            };
            const roomOptions = {
                maxPlayers: 4,
                customGameProperties: { gameType: "monopoly" },
            };
            this.client.joinRandomOrCreateRoom(matchmakingOptions, "MonopolyRoom1", roomOptions);
            // console.log("NetworkManager: Attempting to join or create MonopolyRoom1");
        } else {
            console.warn("NetworkManager: Not in lobby or client not ready, cannot join/create room yet. Client state: " + (this.client ? this.client.state : "null"));
        }
    }

    // Call this method continuously in your component's update method
    update(dt: number) {
        if (this.client) {
            // Note: LoadBalancingClient handles network updates internally
            // No need to call service() as it doesn't exist in this version
        }
    }

    sendGameAction(eventCode: number, data: any) {
        if (this.client && this.client.isJoinedToRoom()) {
           // console.log(`NetworkManager: Attempting to send event ${eventCode} with data:`, data);
            this.client.raiseEvent(eventCode, data, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.All });
            //console.log(`NetworkManager: Event ${eventCode} dispatch attempted.`);
        } else {
            console.warn("NetworkManager: Not in a room, cannot send event.");
        }
    }

    public isMasterClient(): boolean {
        return this.getMyActorNumber() === 1;
    }

    public registerMessageHandler(handler: (eventCode: number, content: any, actorNr: number) => void) {
        if (!this.messageHandlers.includes(handler)) {
            this.messageHandlers.push(handler);
            console.log(`NetworkManager: Handler registered. Total handlers: ${this.messageHandlers.length}`);
        }
    }
    
    public unregisterMessageHandler(handler: (eventCode: number, content: any, actorNr: number) => void) {
        const index = this.messageHandlers.indexOf(handler);
        if (index > -1) {
            this.messageHandlers.splice(index, 1);
            console.log(`NetworkManager: Handler unregistered. Total handlers: ${this.messageHandlers.length}`);
        }
    }
    
    private broadcastToHandlers(eventCode: number, content: any, actorNr: number) {
        console.log(`NetworkManager: Broadcasting event ${eventCode} to ${this.messageHandlers.length} handlers`);
        this.messageHandlers.forEach(handler => {
            try {
                handler(eventCode, content, actorNr);
            } catch (error) {
                console.error("NetworkManager: Error in handler:", error);
            }
        });
    }

    public registerPlayerReadyCallback(callback: (actorNr: number) => void) {
        const actor = this.client && typeof this.client.myActor === 'function' ? this.client.myActor() : null;
        if (this.client && this.client.isJoinedToRoom() && actor && actor.actorNr !== undefined) {
            try {
                console.log(`NetworkManager: Player already ready, invoking callback immediately with actorNr: ${actor.actorNr}`);
                callback(actor.actorNr);
            } catch (error) {
                console.error("NetworkManager: Error in immediate playerReadyCallback:", error);
            }
        } else {
            console.log("NetworkManager: Player not ready yet, queuing callback.");
            this.playerReadyCallbacks.push(callback);
        }
    }

    public getMyActorNumber(): number {
        const actor = this.client && typeof this.client.myActor === 'function' ? this.client.myActor() : null;
        if (actor && actor.actorNr !== undefined) {
            return actor.actorNr;
        }
        return -1; 
    }

    public getPhotonClient(): Photon.LoadBalancing.LoadBalancingClient {
        return this.client;
    }
    
    public static getInstance(): NetworkManager {
        return NetworkManager.instance;
    }

    public isConnected(): boolean {
        return this.client && this.client.isJoinedToRoom();
    }

    public getPhotonID(): string {
        const actor = this.client && typeof this.client.myActor === 'function' ? this.client.myActor() : null;
        if (actor && actor.userId) {
            return actor.userId;
        }
        return "UNDEFINED";
    }
    onDestroy() {
        if (NetworkManager.instance === this) {
            NetworkManager.instance = null;
            // Disconnect from Photon when the singleton is destroyed
            if (this.client) {
                this.client.disconnect();
            }
        }
    }

    // Example: Call connectToPhoton() when the game starts or a "Multiplayer" button is clicked.
    // start() {
    //    this.connectToPhoton();
    // }
}