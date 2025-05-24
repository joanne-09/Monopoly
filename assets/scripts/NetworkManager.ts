// Example structure in a TypeScript file (e.g., NetworkManager.ts)
// Ensure the Photon library is loaded globally (e.g., window.Photon)
// You might need to declare Photon if you don't have a .d.ts file:
// declare var Photon: any;

const { ccclass, property } = cc._decorator;

export enum PhotonEventCodes {
    SEND_MESSAGE = 1,
}
@ccclass
export default class NetworkManager extends cc.Component {

    private APP_ID = "e67b38a8-62a3-4f6b-bb72-f735e94a0016"; // Replace with your AppId
    private APP_VERSION = "1.0";
    private client: Photon.LoadBalancing.LoadBalancingClient; // Use 'any' or a specific Photon type if you have .d.ts

    private messageHandler: ((eventCode: number, content: any, actorNr: number) => void) | null = null;

    onLoad() {
        // Make this node persistent across scenes !!
        if (!cc.game.isPersistRootNode(this.node)) {
            cc.game.addPersistRootNode(this.node);
            console.log("NetworkManager: Persist root node set.");
        }

        // Ensure the Photon library is available
        if (typeof Photon === 'undefined') {
            console.error("Photon SDK not loaded!");
            return;
        }
        console.log("NetworkManager: Photon SDK found.");

        // For Photon Realtime JavaScript SDK, you'd use something like:
        // The exact class name might vary based on the SDK version you download.
        // It's often Photon.LoadBalancing.LoadBalancingClient
        this.client = new Photon.LoadBalancing.LoadBalancingClient(Photon.ConnectionProtocol.Ws, this.APP_ID, this.APP_VERSION);
        console.log("NetworkManager: Photon client initialized.");

        this.setupPhotonCallbacks();
    }

    connectToPhoton() {
        if (this.client) {
            console.log("NetworkManager: Attempting to connect to Photon...");
            this.client.connectToRegionMaster("asia"); // e.g., "us", "eu", "asia"
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
            // Handle different states (ConnectedToMaster, JoinedLobby, Joined, etc.)
            if (state === Photon.LoadBalancing.LoadBalancingClient.State.ConnectedToMaster) {
                console.log("Successfully connected to Master Server. Client will automatically join lobby...");
                // Client automatically joins lobby when autoJoinLobby is true (default)
                // No additional action needed here
            } else if (state === Photon.LoadBalancing.LoadBalancingClient.State.JoinedLobby) {
                console.log("Successfully joined Lobby. Ready to join or create rooms.");
                // Now you can try to join a room for your Monopoly game
                this.joinOrCreateMonopolyRoom();
            }
        };

        this.client.onJoinRoom = (createdByMe: boolean) => {
            console.log(`NetworkManager: Room joined. Was created by me: ${createdByMe}`);
            // Game can start or wait for more players
        };

        this.client.onEvent = (code: number, content: any, actorNr: number) => {
            console.log(`NetworkManager: Received event ${code} from actor ${actorNr} with content:`, content);
            if (this.messageHandler) {
                this.messageHandler(code, content, actorNr);
            }
            // Handle custom game events for Monopoly (dice roll, buy property, etc.)
            // Example: if (code === MY_GAME_EVENT_CODES.PLAYER_MOVED) { ... }
        };

        this.client.onActorJoin = (actor: Photon.LoadBalancing.Actor) => {
            console.log(`NetworkManager: Player ${actor.actorNr} (${actor.userId || 'No UserId'}) joined the room.`);
            // Update player list, etc.
        };

        this.client.onActorLeave = (actor: Photon.LoadBalancing.Actor, cleanup: boolean) => {
            console.log(`NetworkManager: Player ${actor.actorNr} (${actor.userId || 'No UserId'}) left the room. Cleanup: ${cleanup}`);
            // Handle player disconnects
        };
        console.log("NetworkManager: Photon callbacks set up successfully.");
    }

    joinOrCreateMonopolyRoom() {
        if (this.client && this.client.isInLobby()) {
            console.log("NetworkManager: Attempting to join or create a Monopoly room...");
            const matchmakingOptions = {
                expectedCustomRoomProperties: { gameType: "monopoly" }
            };
            const roomOptions = {
                maxPlayers: 4,
                customGameProperties: { gameType: "monopoly" },
            };
            
            // This will join a matching room or create one with the specified name
            this.client.joinRandomOrCreateRoom(matchmakingOptions, "MonopolyRoom1", roomOptions);
            console.log("NetworkManager: Attempting to join or create MonopolyRoom1");
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
            console.log(`NetworkManager: Attempting to send event ${eventCode} with data:`, data);
            this.client.raiseEvent(eventCode, data, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.All });
            console.log(`NetworkManager: Event ${eventCode} dispatch attempted.`);
        } else {
            console.warn("NetworkManager: Not in a room, cannot send event.");
        }
    }

    public setMessageHandler(handler: (eventCode: number, content: any, actorNr: number) => void) {
        this.messageHandler = handler;
        console.log("NetworkManager: Message handler set successfully.");
    }

    public getMyActorName(): string {
        if (this.client && this.client.myActor) {
            return this.client.myActor.name
        }
        return "UNDEFINED"; // Default if not connected
    }

    public getMyActorNumber(): number {
        if (this.client && typeof this.client.myActor === 'function') {
            const actor = this.client.myActor();
            console.log("NetworkManager: My actor number is: " + actor.actorNr);
            return actor ? actor.actorNr : -1;
        }
        return -1; // Default if not connected
    }

    // Example: Call connectToPhoton() when the game starts or a "Multiplayer" button is clicked.
    // start() {
    //    this.connectToPhoton();
    // }
}