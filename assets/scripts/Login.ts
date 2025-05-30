const {ccclass, property} = cc._decorator;

@ccclass
export default class Login extends cc.Component {
    @property(cc.Button)
    enterButton: cc.Button = null;
    @property(cc.EditBox)
    emailInput: cc.EditBox = null;
    @property(cc.EditBox)
    passwordInput: cc.EditBox = null;

    onEnter() {
        console.log("Enter button clicked");

        if(!this.emailInput || !this.passwordInput) {
            cc.warn("Some is missing")
            return;
        }

        const email = this.emailInput.string;
        const password = this.passwordInput.string;

        if(!email || !password) {
            cc.warn("Some is empty")
            return;
        }

        this.signInFirebase(email, password);
    }

    onLoad(){
        this.enterButton.node.on("click", this.onEnter, this);
    }

    signInFirebase (email: string, password: string) {
        cc.log("signInFirebase");
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed in
                const user = userCredential.user;
                cc.log("User signed in: ", user);
                cc.director.loadScene('AvatarSelect');
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                cc.error("Error signing in: ", errorCode, errorMessage);
            });
    }
}