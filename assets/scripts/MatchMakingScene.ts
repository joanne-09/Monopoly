import NetworkManager from "./NetworkManager";
const {ccclass, property} = cc._decorator;

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

    private networkManager: NetworkManager = null;
    private playerList: number[] = []; // only the actNr
    private handler: (eventCode: number, content: any, actorNr: number) => void;

    onLoad() {
        this.networkManager = NetworkManager.getInstance();
        if (!this.networkManager) {
            cc.error("NetworkManager not found!");
            return;
        }
        this.handler = this.onPhotonEvent.bind(this);
        this.networkManager.registerMessageHandler(this.handler);
        this.updatePlayerCards();
        if (this.leaveButton) {
            this.leaveButton.on("click", this.onLeave, this);
        }
        // Get initial player list
        this.scheduleOnce(() => {
            this.refreshPlayerList();
        }, 0.2);
    }

    onPhotonEvent(eventCode: number, content: any, actorNr: number) {
        // Listen for player join/leave events
        this.refreshPlayerList();
    }

    refreshPlayerList() {
        if (!this.networkManager || !this.networkManager["client"]) return;
        const actors = this.networkManager["client"].myRoomActorsArray() || [];
        this.playerList = actors
            .filter(a => a && typeof a.actorNr === "number")
            .map(a => a.actorNr);
        this.updatePlayerCards();
    }

    updatePlayerCards() {
        const playerLabels = [this.playerLabel1, this.playerLabel2, this.playerLabel3, this.playerLabel4];
        const playerSprites = [this.playerSprite1, this.playerSprite2, this.playerSprite3, this.playerSprite4];
        for (let i = 0; i < 4; i++) {
            if (playerLabels[i]) {
                if (i < this.playerList.length) {
                    playerLabels[i].string = `Player ${this.playerList[i]}`;
                    if (playerSprites[i]) playerSprites[i].node.active = true;
                    // Optionally set playerSprites[i].spriteFrame = ... based on playerList[i]
                } else {
                    playerLabels[i].string = "Waiting for a player to join...";
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
}
