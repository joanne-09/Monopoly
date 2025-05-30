const {ccclass, property} = cc._decorator;
import { config } from "./firebase/firebase-service";

@ccclass
export default class Start extends cc.Component {
    @property(cc.Button)
    loginButton: cc.Button = null;
    @property(cc.Button)
    signupButton: cc.Button = null;

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
    }

    start() {
        firebase.initializeApp(config);
    }
}