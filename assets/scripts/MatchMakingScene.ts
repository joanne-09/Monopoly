import GameManager from "./GameManager";
import NetworkManager from "./NetworkManager";
import { PhotonEventCodes } from "./types/PhotonEventCodes";
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

    // Button to transition to the game scene
    @property(cc.Button)
    startGameButton: cc.Button = null;

    @property(cc.Node)
    leaveButton: cc.Node = null;

    @property([cc.SpriteFrame])
    avatarSpriteFrames: cc.SpriteFrame[] = [];

    avatarNames: string[] = ["Player ELECTRIC", "Player FIRE", "Player GRASS", "Player ICE"];

    private networkManager: NetworkManager = null;
    private playerList: PlayerInfo[] = [];
    private handler: (eventCode: number, content: any, actorNr: number) => void;
    private sceneLoadScheduled: boolean = false;

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

        this.handler = this.onPhotonEvent.bind(this);
        this.networkManager.registerMessageHandler(this.handler);
        // Wait for connection and room join, then set custom properties
        // console.log(GameManager.getInstance().getPlayerData(this.networkManager.getMyActorNumber()))
        // console.log(GameManager.getInstance().getPlayerList());
        const list = GameManager.getInstance().getPlayerList();
        console.log(list);
        const myActorNr = this.networkManager.getMyActorNumber();
        const setPropertiesWhenReady = () => {
            if (
                this.networkManager["client"] &&
                this.networkManager["client"].isJoinedToRoom &&
                this.networkManager["client"].isJoinedToRoom()
            ) {
                let username, sprite;

                for(let i = 0; i < list.length; i++) {
                    if(list[i].actorNumber == myActorNr) {
                        username = list[i].name;
                        sprite = list[i].avatar;
                    }
                }

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

                if(this.startGameButton) {
                    this.startGameButton.node.on("click", this.onStartGame, this);
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

        this.sceneLoadScheduled = false;
    }

    onPhotonEvent(eventCode: number, content: any, actorNr: number) {
        // Listen for player join/leave events
        // When a second player joins, we'll receive an event like the following:
        // {actorNumber: 2, name: 'eason', avatar: 'GRASS'}
        // the calling sender is : this.networkManager.sendGameAction(PhotonEventCodes.PLAYER_JOINED, GameManager.getInstance().whoAmI());
        // where whoAmI returns the playerdata object, provided in DataTypes.ts
        // console.log("Photon event received:", eventCode, content, actorNr);
        // console.log(GameManager.getInstance().getPlayerList());
        if(eventCode === PhotonEventCodes.START_GAME) {
            cc.director.loadScene("MapScene");
        }
        this.refreshPlayerList();
    }

    refreshPlayerList() {
        if (!this.networkManager || !this.networkManager["client"]) return;
        const actors = this.networkManager["client"].myRoomActorsArray() || [];
        console.log("myRoomActorsArray:", actors);
        this.playerList = actors
            .map(a => ({
                actorNr: a.actorNr,
                username: a.getCustomProperty("username"),
                sprite: a.getCustomProperty("sprite")
            })).sort((a, b) => a.actorNr - b.actorNr);
        if (this.playerList.some(p => !p.username || !p.sprite)) {
            this.scheduleOnce(() => this.refreshPlayerList(), 0.2);
        }
        this.updatePlayerCards();
        console.log("Player list updated:", this.playerList);
    }

    updatePlayerCards() {
        const playerLabels = [this.playerLabel1, this.playerLabel2, this.playerLabel3, this.playerLabel4];
        const playerSprites = [this.playerSprite1, this.playerSprite2, this.playerSprite3, this.playerSprite4];
        for (let i = 0; i < 4; i++) {
            if (playerLabels[i]) {
                if (i < this.playerList.length) {
                    if(this.playerList[i].username)
                        playerLabels[i].string = this.playerList[i].username;
                    if (playerSprites[i] && this.playerList[i].sprite) {
                        playerSprites[i].node.active = true;
                        switch(this.playerList[i].sprite) {
                            case "ELECTRIC":
                                playerSprites[i].spriteFrame = this.avatarSpriteFrames[0];
                                playerSprites[i].node.setScale(2);
                                break;
                            case "FIRE":
                                playerSprites[i].spriteFrame = this.avatarSpriteFrames[1];
                                playerSprites[i].node.setScale(2);
                                break;
                            case "GRASS":
                                playerSprites[i].spriteFrame = this.avatarSpriteFrames[2];
                                playerSprites[i].node.setScale(2);
                                break;
                            case "ICE":
                                playerSprites[i].spriteFrame = this.avatarSpriteFrames[3];
                                playerSprites[i].node.setScale(2);
                                break;
                        }
                    }
                } else {
                    playerLabels[i].string = "Waiting...";
                    if (playerSprites[i]) playerSprites[i].node.active = false;
                }
            }
        }
        if (this.leaveButton) {
            this.leaveButton.getComponent(cc.Button).enabled = this.playerList.length < 4;
        }
        if (this.playerList.length === 4 && !this.sceneLoadScheduled) {
            this.sceneLoadScheduled = true
            this.scheduleOnce(() => {
                cc.director.loadScene("MapScene");
            }, 3.0);
        }
    }

    onLeave() {
        // Optionally: leave the Photon room here
        cc.log("leave button clicked");
        //cc.director.loadScene("Start");
    }

    onStartGame() {
        cc.log("start game button clicked");
        this.networkManager.sendGameAction(PhotonEventCodes.START_GAME, null);
    
        cc.director.loadScene("MapScene");
    }

    onDestroy() {
        if (this.networkManager && this.handler) {
            this.networkManager.unregisterMessageHandler(this.handler);
        }
        if (this.leaveButton) {
            this.leaveButton.off("click", this.onLeave, this);
        }
    }
}