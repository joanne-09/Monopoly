import NetworkManager, { PhotonEventCodes } from "./NetworkManager";

const { ccclass, property } = cc._decorator;

@ccclass
export default class TestMessaging extends cc.Component {
    
    private networkManager: NetworkManager = null;

    @property(cc.EditBox)
    messageInput: cc.EditBox = null;
    @property(cc.Label)
    messageLabel: cc.Label = null;
    @property(cc.Button)
    sendButton: cc.Button = null;
    @property(cc.Button)
    changeSceneButton: cc.Button = null;

    onLoad() {
        // Wait a frame to ensure NetworkManager singleton is set up
        this.scheduleOnce(() => {

            // ====== Setting up the NetworkManager instance for scripts ======
            this.networkManager = NetworkManager.getInstance();

            // Fallback: try to find the persistent node if singleton is not set yet
            if (!this.networkManager) {
                console.error("NetworkManager instance not found! Trying to find persistent node.");
            }
            if (!this.networkManager) {
                console.error("NetworkManager instance not found!");
                return;
            }
            // Set message handler
            this.networkManager.setMessageHandler(this.receiveMessage.bind(this));

            // Only connect if not already connected
            if (!this.networkManager.isConnected()) {
                this.networkManager.connectToPhoton();
            }
            
            // ====== END ======

            if (this.sendButton) {
                this.sendButton.node.on('click', this.sendMessage, this);
            }

            if(this.changeSceneButton) {
                this.changeSceneButton.node.on('click', () => {
                    cc.director.loadScene("TestMessaging2");
                }, this);
            }
        }, 0.1);
    }

    sendMessage() {
        if (!this.messageInput) return;
        const text = this.messageInput.string.trim();
        if (!text) return;
        const message = { type: "chat", content: text };
        this.networkManager.sendGameAction(PhotonEventCodes.SEND_MESSAGE, message);
        console.log("Message sent:", message);
        const myActorName: number = this.networkManager.getMyActorNumber();
        console.log("My actor number:", myActorName);
        this.appendMessage(`User ${myActorName}: ${text}`);
        
        this.messageInput.string = "";
    }

    receiveMessage(eventCode: number, content: any, actorNr: number) {
        if (eventCode === PhotonEventCodes.SEND_MESSAGE) {
            const msg = content && content.content ? content.content : JSON.stringify(content);
            const myActorNr = this.networkManager.getMyActorNumber();
            
            // Only display if it's NOT from yourself
            console.log("My actor number:", myActorNr);
            console.log("Received actor number:", actorNr);
            if (actorNr !== myActorNr) {
                this.appendMessage(`User ${actorNr}: ${msg}`);
            }
            console.log("Received message:", content, "from actor:", actorNr);
        }
    }

    appendMessage(msg: string) {
        if (!this.messageLabel) return;
        if (this.messageLabel.string.length > 0) {
            this.messageLabel.string += "\n" + msg;
        } else {
            this.messageLabel.string = msg;
        }
    }
}