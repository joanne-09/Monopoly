import GameManager from "./GameManager";
import NetworkManager from "./NetworkManager";
const {ccclass, property} = cc._decorator;

// Start scene (player data) localStorage?
// username
// player sprite

// Multiplayer Photon custom properties
// player name and sprite needed
// name: string
// sprite: string

type PlayerInfo = {
    actorNr: number;
    username?: string;
    sprite?: string;
};

@ccclass
export default class MatchMakingScene extends cc.Component {
    @property(cc.Label)
    playerLabel1: cc.Label = null;
    @property(cc.Label)
    playerLabel2: cc.Label = null;
    @property(cc.Label)
    playerLabel3: cc.Label = null;
    @property(cc.Label)
    playerLabel4: cc.Label = null;

    @property(cc.Sprite)
    playerSprite1: cc.Sprite = null;
    @property(cc.Sprite)
    playerSprite2: cc.Sprite = null;
    @property(cc.Sprite)
    playerSprite3: cc.Sprite = null;
    @property(cc.Sprite)
    playerSprite4: cc.Sprite = null;

    @property(cc.Node)
    leaveButton: cc.Node = null;

    @property([cc.SpriteFrame])
    avatarSpriteFrames: cc.SpriteFrame[] = [];

    avatarNames: string[] = ["Player ELECTRIC", "Player FIRE", "Player GRASS", "Player ICE"];

    private networkManager: NetworkManager = null;
    private playerList: PlayerInfo[] = [];
    private handler: (eventCode: number, content: any, actorNr: number) => void;

    onLoad() {
        this.networkManager = NetworkManager.getInstance();
        if (!this.networkManager) {
            cc.error("NetworkManager not found!");
            return;
        }

        // Connect to Photon if not already connected
        if (!this.networkManager.isConnected()) {
            this.networkManager.connectToPhoton();
        }

            // Wait for connection and room join, then set custom properties
        console.log(GameManager.getInstance().getPlayerData(this.networkManager.getMyActorNumber()))

        const setPropertiesWhenReady = () => {
            if (
                this.networkManager["client"] &&
                this.networkManager["client"].isJoinedToRoom &&
                this.networkManager["client"].isJoinedToRoom()
            ) {
                const username = localStorage.getItem("username") || "Player";
                const sprite = localStorage.getItem("sprite") || "Player FIRE";
                const myActor = this.networkManager["client"].myActor();
                if (myActor && myActor.setCustomProperty) {
                    myActor.setCustomProperty("username", username);
                    myActor.setCustomProperty("sprite", sprite);
                }
                
                this.handler = this.onPhotonEvent.bind(this);
                this.networkManager.registerMessageHandler(this.handler);
                this.updatePlayerCards();
                
                if (this.leaveButton) {
                    this.leaveButton.on("click", this.onLeave, this);
                }

                this.scheduleOnce(() => {
                    this.refreshPlayerList();
                }, 0.2);
            } else {
                // Retry after a short delay
                this.scheduleOnce(setPropertiesWhenReady, 0.2);
            }
        };

        setPropertiesWhenReady();
    }

    onPhotonEvent(eventCode: number, content: any, actorNr: number) {
        // Listen for player join/leave events
        // When a second player joins, we'll receive an event like the following:
        // {actorNumber: 2, name: 'eason', avatar: 'GRASS'}
        // the calling sender is : this.networkManager.sendGameAction(PhotonEventCodes.PLAYER_JOINED, GameManager.getInstance().whoAmI());
        // where whoAmI returns the playerdata object, provided in DataTypes.ts
        console.log("Photon event received:", eventCode, content, actorNr);
        this.refreshPlayerList();
    }

    refreshPlayerList() {
        if (!this.networkManager || !this.networkManager["client"]) return;
        const actors = this.networkManager["client"].myRoomActorsArray() || [];
        this.playerList = actors
            .filter(a => a && typeof a.actorNr === "number")
            .map(a => ({
                actorNr: a.actorNr,
                username: a.getCustomProperty("username"),
                sprite: a.getCustomProperty("sprite")
            }));
        this.updatePlayerCards();
        console.log("Player list updated:", this.playerList);
    }

    updatePlayerCards() {
        const playerLabels = [this.playerLabel1, this.playerLabel2, this.playerLabel3, this.playerLabel4];
        const playerSprites = [this.playerSprite1, this.playerSprite2, this.playerSprite3, this.playerSprite4];
        for (let i = 0; i < 4; i++) {
            if (playerLabels[i]) {
                if (i < this.playerList.length) {
                    playerLabels[i].string = "Player";
                    if (playerSprites[i]) {
                        playerSprites[i].node.active = true;
                        console.log("avatarNames:", this.avatarNames);
                        console.log("playerList[i].sprite:", this.playerList[i].sprite);
                        if (this.playerList[i].sprite) {
                            const spriteFrame = this.getAvatarSpriteFrame(this.playerList[i].sprite);
                            if (spriteFrame) {
                                playerSprites[i].spriteFrame = spriteFrame;
                                playerSprites[i].node.scale = 2;
                            }
                        }
                    }
                    // Optionally set playerSprites[i].spriteFrame = ... based on playerList[i]
                } else {
                    playerLabels[i].string = "Waiting...";
                    if (playerSprites[i]) playerSprites[i].node.active = false;
                }
            }
        }
        if (this.leaveButton) {
            //this.leaveButton.interactable = this.playerList.length < 4;
        }
        if (this.playerList.length === 4) {
            this.scheduleOnce(() => {
                cc.director.loadScene("TestMultiplayer");
            }, 3.0);
        }
    }

    onLeave() {
        // Optionally: leave the Photon room here
        cc.log("leave button clicked");
        cc.director.loadScene("Start");
    }

    onDestroy() {
        if (this.networkManager && this.handler) {
            this.networkManager.unregisterMessageHandler(this.handler);
        }
        if (this.leaveButton) {
            this.leaveButton.off("click", this.onLeave, this);
        }
    }

    private getAvatarSpriteFrame(spriteName: string): cc.SpriteFrame | null {
        const idx = this.avatarNames.indexOf(spriteName);
        return idx !== -1 ? this.avatarSpriteFrames[idx] : null;
    }
}
