const {ccclass, property} = cc._decorator;
import { config } from "./firebase/firebase-service";
import NetworkManager from "./NetworkManager";

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
export default class Start extends cc.Component {
    @property(cc.Button)
    loginButton: cc.Button = null;
    @property(cc.Button)
    signupButton: cc.Button = null;
    @property(cc.Node)
    background: cc.Node = null;
    @property(cc.Node)
    background2: cc.Node = null;

    @property({type:cc.AudioClip})
    bgm: cc.AudioClip = null;

    @property({type: cc.AudioClip})
    buttonClickSfx: cc.AudioClip = null;

    @property({type: cc.AudioClip})
    buttonHoverSfx: cc.AudioClip = null;

    @property(cc.Button)
    settingsButton: cc.Button = null;

    @property(cc.Button)
    doneButton: cc.Button = null;

    @property(cc.Node)
    settingsPopup: cc.Node = null;

    @property(cc.Slider)
    bgmSlider: cc.Slider = null;

    @property(cc.Slider)
    sfxSlider: cc.Slider = null;

    private networkManager: any = null;

    private backgroundSpeed: number = 200;
    private backgroundEnd: number = 0;

    private firstBG: boolean = true;

    private screenLeftEdgeX: number = 0;

    private saveBackgroundState() {
        if (!this.background || !this.background2) {
            cc.warn("Start.ts: Cannot save background state, nodes are missing.");
            return;
        }
        const state: BackgroundState = {
            bg1x: this.background.x,
            bg1y: this.background.y,
            bg2x: this.background2.x,
            bg2y: this.background2.y,
            firstBG: this.firstBG,
            timestamp: Date.now()
        };
        cc.sys.localStorage.setItem(BACKGROUND_STATE_KEY, JSON.stringify(state));
        cc.log("Start.ts: Background state saved.", state);
    }

    onLogin() {
        cc.log("Login button clicked");
        cc.audioEngine.playEffect(this.buttonClickSfx, false);
        this.saveBackgroundState();
        cc.director.loadScene("Login");
    }

    onSignup() {
        cc.log("Signup button clicked");
        cc.audioEngine.playEffect(this.buttonClickSfx, false);
        this.saveBackgroundState();
        cc.director.loadScene("Signup");
    }

    onSettingsClicked() {
        this.settingsPopup.active = true;
    }

    onDoneClicked() {
        this.settingsPopup.active = false;
    }

    onLoad() {
        cc.audioEngine.setMusicVolume(0.5);
        cc.audioEngine.setEffectsVolume(0.5);
        this.loginButton.node.on("click", this.onLogin, this);
        this.signupButton.node.on("click", this.onSignup, this);
        this.settingsButton.node.on("click", this.onSettingsClicked, this);
        this.doneButton.node.on("click", this.onDoneClicked, this);

        if (this.bgmSlider) {
            this.bgmSlider.node.on("slide", () => {
                const value = this.bgmSlider.progress; // 0.0 ~ 1.0
                cc.audioEngine.setMusicVolume(value);
            }, this);
        }

        // Handle SFX slider
        if (this.sfxSlider) {
            this.sfxSlider.node.on("slide", () => {
                const value = this.sfxSlider.progress; // 0.0 ~ 1.0
                cc.audioEngine.setEffectsVolume(value);
            }, this);
        }

        this.scheduleOnce(() => {
            this.networkManager = NetworkManager.getInstance();
            if (!this.networkManager) {
                console.error("Start.ts: NetworkManager instance not found! Trying to find persistent node.");
            }
            // Set message handler (if any)

            if (this.networkManager && !this.networkManager.isConnected()) {
                this.networkManager.connectToPhoton();
            }
        }, 0.1);
        
        if (!this.background || !this.background2) {
            cc.error("Start.ts: Background nodes (background and background2) must be assigned in the editor.");
            this.enabled = false; // Disable update if setup is incorrect
            return;
        }

        if (this.background.width === 0 || this.background2.width === 0) {
            cc.error("Start.ts: Background nodes must have a width greater than 0.");
            this.enabled = false;
            return;
        }
        
        if (this.background.width !== this.background2.width) {
            cc.warn("Start.ts: Backgrounds have different widths. Wrapping logic assumes they are the same. This might lead to visual issues if not intended.");
        }

        this.backgroundEnd = -this.background.width / 2 + cc.winSize.width / 2;
        
        // Position background2 immediately to the right of background1's initial position
        this.background2.x = this.background.x + this.background.width;

        this.firstBG = true; // Initialize the flag

        // Determine the screen's left edge for wrapping logic (assuming camera is at x=0)
        this.screenLeftEdgeX = -cc.winSize.width / 2;

        // play bgm
        cc.audioEngine.playMusic(this.bgm, true);
        this.settingsButton.node.on("mouseenter", () => {
            if (this.buttonHoverSfx) cc.audioEngine.playEffect(this.buttonHoverSfx, false);
        });
        this.doneButton.node.on("mouseenter", () => {
            if (this.buttonHoverSfx) cc.audioEngine.playEffect(this.buttonHoverSfx, false);
        });
        this.loginButton.node.on("mouseenter", () => {
            if (this.buttonHoverSfx) cc.audioEngine.playEffect(this.buttonHoverSfx, false);
        });
        this.signupButton.node.on("mouseenter", () => {
            if (this.buttonHoverSfx) cc.audioEngine.playEffect(this.buttonHoverSfx, false);
        });
    }

    start() {
        firebase.initializeApp(config);
    }

    update(dt: number) {
        if (!this.background || !this.background2) {
            return;
        }

        // --- Handle movement for 'this.background' (bg1) ---
        if (this.firstBG) {
            if (this.background.x > this.backgroundEnd) {
                let newX = this.background.x - this.backgroundSpeed * dt;
                if (newX <= this.backgroundEnd) {
                    newX = this.backgroundEnd;
                    this.firstBG = false;
                    cc.log("'background' (bg1) reached 'backgroundEnd'. Switching to continuous scroll mode.");
                }
                this.background.x = newX;
            } else {
                this.background.x = this.backgroundEnd;
                this.firstBG = false;
                cc.log("'background' (bg1) was at or beyond 'backgroundEnd'. Switching to continuous scroll mode.");
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

    onDestroy() {
        // Optional: Save state on destroy as a fallback, 
        // though onLogin/onSignup should cover the main cases.
        // this.saveBackgroundState(); 
    }
}