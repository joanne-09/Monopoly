import AccessUser, {UserData} from "./firebase/AccessUser";
import GameManager from "./GameManager";
import { PlayerAvatar } from "./types/DataTypes";
const {ccclass, property} = cc._decorator;

// Use the same key and interface as in Start.ts
const BACKGROUND_STATE_KEY = "startSceneBackgroundState";
interface BackgroundState {
    bg1x: number;
    bg1y: number;
    bg2x: number;
    bg2y: number;
    firstBG: boolean;
    timestamp: number; // To potentially invalidate old data
}

@ccclass
export default class Login extends cc.Component {
    @property(cc.Button)
    enterButton: cc.Button = null;
    @property(cc.EditBox)
    emailInput: cc.EditBox = null;
    @property(cc.EditBox)
    passwordInput: cc.EditBox = null;

    @property(cc.Node)
    background: cc.Node = null;
    @property(cc.Node)
    background2: cc.Node = null;

    @property({type: cc.AudioClip})
    buttonClickSfx: cc.AudioClip = null;

    @property({type: cc.AudioClip})
    buttonHoverSfx: cc.AudioClip = null;

    private backgroundSpeed: number = 200;
    private backgroundEnd: number = 0;

    private firstBG: boolean = true;

    private screenLeftEdgeX: number = 0;

    async loadFirebase() {
        // Load player name from user data
        const currentUser = firebase.auth().currentUser.uid;
        let playerName = "";

        const userData = await AccessUser.getUser(currentUser);
        if (userData) {
            playerName = userData.username || "Player";
            console.log(`Player name loaded: ${playerName}`);
        } else {
            console.warn("No user data found, using default player name.");
            playerName = "Player";
        }

        GameManager.getInstance().setPlayerNameandAvatar(playerName, PlayerAvatar.NULL);
        console.log("WHO AM I: ", GameManager.getInstance().whoAmI());
    }

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
        cc.log("click effect played");
        cc.audioEngine.playEffect(this.buttonClickSfx, false);
    }

    onLoad(){
        this.enterButton.node.on("click", this.onEnter, this);

        this.loadAndApplyBackgroundState();

        this.enterButton.node.on("mouseenter", () => {
            if (this.buttonHoverSfx) cc.audioEngine.playEffect(this.buttonHoverSfx, false);
        });
    }

    loadAndApplyBackgroundState() {
        if (!this.background || !this.background2) {
            cc.error("Login.ts: Background nodes must be assigned to load state.");
            this.enabled = false; // Disable update if backgrounds aren't set up
            return;
        }

        const storedStateJSON = cc.sys.localStorage.getItem(BACKGROUND_STATE_KEY);
        if (storedStateJSON) {
            try {
                const storedState: BackgroundState = JSON.parse(storedStateJSON);
                cc.log("Login.ts: Found stored background state", storedState);

                this.background.x = storedState.bg1x;
                this.background.y = storedState.bg1y;
                this.background2.x = storedState.bg2x;
                this.background2.y = storedState.bg2y;
                this.firstBG = storedState.firstBG;
                
                cc.log("Login.ts: Background state restored.");
                
                cc.sys.localStorage.removeItem(BACKGROUND_STATE_KEY);

            } catch (e) {
                cc.error("Login.ts: Error parsing stored background state.", e);
                this.initializeDefaultBackgroundPositions(); // Fallback to default
            }
        } else {
            cc.log("Login.ts: No stored background state found. Initializing default positions.");
            this.initializeDefaultBackgroundPositions();
        }
        
        if (this.background.width === 0 || this.background2.width === 0) {
            cc.error("Login.ts: Background nodes must have a width > 0 for scrolling.");
            this.enabled = false; // Disable update if setup is incorrect
            return;
        }
        if (this.background.width !== this.background2.width) {
            cc.warn("Login.ts: Backgrounds have different widths. Wrapping logic assumes they are the same.");
        }
    }

    initializeDefaultBackgroundPositions() {
        if (this.background && this.background2) {
            this.background.x = 0;
            this.background.y = 0;
            if (this.background.width > 0) {
                 this.background2.x = this.background.x + this.background.width;
                 this.backgroundEnd = -this.background.width / 2 + cc.winSize.width / 2;
            } else {
                this.background2.x = cc.winSize.width;
                this.backgroundEnd = cc.winSize.width / 2;
            }
            this.background2.y = 0;
            this.firstBG = true; // Reset flag
            this.screenLeftEdgeX = -cc.winSize.width / 2;
        }
    }

    update(dt: number) {
        if (!this.background || !this.background2 || !this.enabled) {
            return;
        }

        // --- Handle movement for 'this.background' (bg1) ---
        if (this.firstBG) {
            if (this.background.x > this.backgroundEnd) {
                let newX = this.background.x - this.backgroundSpeed * dt;
                if (newX <= this.backgroundEnd) {
                    newX = this.backgroundEnd;
                    this.firstBG = false;
                }
                this.background.x = newX;
            } else {
                this.background.x = this.backgroundEnd;
                this.firstBG = false;
            }
        } else {
            this.background.x -= this.backgroundSpeed * dt;
        }

        this.background2.x -= this.backgroundSpeed * dt;

        if (!this.firstBG) {
            if (this.background.x + this.background.width / 2 < this.screenLeftEdgeX) {
                this.background.x = this.background2.x + this.background.width;
            }
        }

        if (this.background2.x + this.background2.width / 2 < this.screenLeftEdgeX) {
            this.background2.x = this.background.x + this.background.width;
        }
    }

    signInFirebase (email: string, password: string) {
        cc.log("signInFirebase");
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed in
                const user = userCredential.user;
                cc.log("User signed in: ", user);

                cc.log("Load User Data");
                this.loadFirebase()
                    .then(() => {
                        cc.director.loadScene('AvatarSelect');
                    });
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                cc.error("Error signing in: ", errorCode, errorMessage);
            });
    }
}