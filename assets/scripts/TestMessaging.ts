import NetworkManager, { PhotonEventCodes } from "./NetworkManager";

const { ccclass, property } = cc._decorator;

@ccclass
export default class TestMessaging extends cc.Component {
    @property(NetworkManager)
    networkManager: NetworkManager = null;
    @property(cc.EditBox)
    messageInput: cc.EditBox = null;
    @property(cc.Label)
    messageLabel: cc.Label = null;
    @property(cc.Button)
    sendButton: cc.Button = null;

    onLoad() {
        // Get the NetworkManager component from the scene if not set in the editor
        if (!this.networkManager) {
            const node = cc.find("NetworkManager");
            if (node) {
                this.networkManager = node.getComponent(NetworkManager);
            } else {
                console.error("NetworkManager node not found in scene!");
                return;
            }
        }

        this.networkManager.setMessageHandler(this.receiveMessage.bind(this));

        this.networkManager.connectToPhoton();
        
        if (this.sendButton) {
            this.sendButton.node.on('click', this.sendMessage, this);
        }
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