import AccessUser, {UserData} from "./firebase/AccessUser";
const {ccclass, property} = cc._decorator;

@ccclass
export default class Login extends cc.Component {
    @property(cc.Button)
    enterButton: cc.Button = null;
    @property(cc.EditBox)
    usernameInput: cc.EditBox = null;
    @property(cc.EditBox)
    emailInput: cc.EditBox = null;
    @property(cc.EditBox)
    passwordInput: cc.EditBox = null;

    onEnter() {
        console.log("Enter button clicked");

        if(!this.usernameInput || !this.emailInput || !this.passwordInput) {
            cc.warn("Some is missing")
            return;
        }

        const username = this.usernameInput.string;
        const email = this.emailInput.string;
        const password = this.passwordInput.string;

        if(!email || !password) {
            cc.warn("Some is empty")
            return;
        }

        this.signUpFirebase(username, email, password);
    }

    onLoad(){
        this.enterButton.node.on("click", this.onEnter, this);
    }

    signUpFirebase (username: string, email: string, password: string) {
        cc.log("signUpFirebase");
        firebase.auth().createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed in
                const user = userCredential.user;
                cc.log("User signed up: ", user);

                // Save user data to Firestore
                AccessUser.saveUser(user.uid, email, username)
                    .then(() => {
                        cc.director.loadScene('AvatarSelect');
                    })
                    .catch((error) => {
                        cc.error("Error saving user data:", error);
                    });
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                cc.error("Error signing up: ", errorCode, errorMessage);
            });
    }
}