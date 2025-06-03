const {ccclass, property} = cc._decorator;
import { config } from "./firebase/firebase-service";
import NetworkManager from "./NetworkManager";
@ccclass
export default class Start extends cc.Component {
    @property(cc.Button)
    loginButton: cc.Button = null;
    @property(cc.Button)
    signupButton: cc.Button = null;
    private networkManager: any = null; 

    onLogin() {
        cc.log("Login button clicked");
        cc.director.loadScene("Login");
    }

    onSignup() {
        cc.log("Signup button clicked");
        cc.director.loadScene("Signup");
    }

    onLoad() {
        this.loginButton.node.on("click", this.onLogin, this);
        this.signupButton.node.on("click", this.onSignup, this);
        this.scheduleOnce(() => {

            // ====== Setting up the NetworkManager instance for scripts ======
            this.networkManager = NetworkManager.getInstance();
            // Fallback: try to find the persistent node if singleton is not set yet
            if (!this.networkManager) {
                console.error("NetworkManager instance not found! Trying to find persistent node.");
            }
            // Set message handler

            // Only connect if not already connected
            if (!this.networkManager.isConnected()) {
                this.networkManager.connectToPhoton();
            }
            // ====== END ======


        }, 0.1);
        
    }

    start() {
        firebase.initializeApp(config);
    }
}