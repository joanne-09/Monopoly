// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

const {ccclass, property} = cc._decorator;

enum PlayerState {
    Idle,
    Moving,
    MakingSnowball,
    HoldingSnowball,
    Frozen
}

import NetworkManager from "../NetworkManager";
import { PhotonEventCodes } from "../types/PhotonEventCodes";

@ccclass
export default class PlayerController extends cc.Component {
    @property({ type: cc.Prefab }) snowballPrefab: cc.Prefab = null;
    @property(cc.Label)
    label: cc.Label = null;

    @property
    text: string = 'hello';

    @property(cc.Animation)
    anim: cc.Animation = null;
    @property(cc.ProgressBar)
    snowballBar: cc.ProgressBar = null;
    @property(cc.Node)
    lifeNode: cc.Node = null; // 生命顯示父節點，底下放三個Sprite
    @property({ type: cc.Prefab }) hitFXPrefab: cc.Prefab = null;
    @property({ type: cc.Prefab }) icedFXPrefab: cc.Prefab = null; // 冰凍特效Prefab
    @property
    team: string = 'A'; // Player's team, can be set in the editor

    private state: PlayerState = PlayerState.Idle;
    private keys: { [key: string]: boolean } = {};
    private moveSpeed: number = 200;
    private snowballMakingTime: number = 1.0; // 製作雪球所需秒數
    private snowballTimer: number = 0;
    private hasSnowball: boolean = false;
    private faceRight: boolean = true; // true: 右, false: 左
    private life: number = 3;
    private runAnimName: string = '';
    private idleAnimName: string = '';
    private makeAnimName: string = '';
    private throwAnimName: string = '';
    private runLoadedAnimName: string = '';
    private idleLoadedAnimName: string = '';
    private handSnowball: cc.Node = null;
    private slowTimer: number = 0;
    private normalSpeed: number = 200;
    private slowSpeed: number = 80;
    private normalColor: cc.Color = cc.Color.WHITE;
    private slowColor: cc.Color = new cc.Color(100, 100, 255);
    private rb: cc.RigidBody = null;

    private networkManager: NetworkManager = null;
    private _isLocalPlayer: boolean = false; // Renamed to avoid conflict with getter
    private _actorNumber: number = -1; // Renamed to avoid conflict with getter
    private lastSentX: number = 0; // Restored
    private lastSentY: number = 0;

    public static REMOTE_MOVE_ACTION_TAG = 1001;
    private inputListenersAttached: boolean = false; // Flag to track if listeners are on
    private isDead: boolean = false; // 死亡旗標

    // Public getter for isLocalPlayer
    public getIsLocalPlayer(): boolean {
        return this._isLocalPlayer;
    }

    // Public getter for actorNumber
    public getActorNumber(): number {
        return this._actorNumber;
    }
    
    // Public setter for actorNumber (if needed, though typically set internally)
    public setActorNumber(actorNumber: number) {
        // this._actorNumber = actorNumber; // This direct assignment is now handled by initializePlayerProperties from node.name
        // // Potentially re-initialize properties if actorNumber changes post-initialization
        // this.initializePlayerProperties(); // This would require the client's actor number, making this setter complex.
        cc.warn(`[PlayerController] setActorNumber(${actorNumber}) called on ${this.node.name}. This method is deprecated as _actorNumber is derived from node name during initialization.`);
    }


    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        cc.director.getPhysicsManager().enabled = true;
        cc.director.getPhysicsManager().gravity = cc.v2(0, 0);
        
        let type = 'FIRE'; // Default
        const nameParts = this.node.name.split('_');
        if (nameParts.length >= 2) {
            type = nameParts[1]; // e.g., Player_GRASS -> GRASS
        }
        this.runAnimName = `Player_${type}_Run`;
        this.idleAnimName = `Player_${type}_Idle`;
        this.makeAnimName = `Player_${type}_Make`;
        this.throwAnimName = `Player_${type}_Throw`;
        this.runLoadedAnimName = `Player_${type}_Run_Loaded`;
        this.idleLoadedAnimName = `Player_${type}_Idle_Loaded`;

        this.handSnowball = this.node.getChildByName('handSnowball');
        if (this.handSnowball) this.handSnowball.active = false;
        this.rb = this.node.getComponent(cc.RigidBody);
        if (this.rb) {
            this.rb.linearDamping = 0.25; // 冰上滑行感(調高一點)
            this.rb.fixedRotation = true; // 不會旋轉
            // Rigidbody type will be set in initializePlayerProperties based on local/remote status
        }
        
        this.networkManager = NetworkManager.getInstance();
        if (this.networkManager) {
            const clientActorNr = this.networkManager.getMyActorNumber();
            if (clientActorNr > 0) {
                this.initializePlayerProperties(clientActorNr);
            } else {
                // Listen for when the client's actor number is ready
                this.networkManager.registerPlayerReadyCallback((actorNrCallback) => {
                    // Ensure this initialization runs only once with a valid client actor number
                    // Check if already initialized by a different path or if callback fires multiple times.
                    // Given initializePlayerProperties now sets _actorNumber from node name first,
                    // repeated calls with the same clientActorNr should be mostly idempotent,
                    // but event listener registration needs care (already handled by _isLocalPlayer check).
                    cc.log(`[PlayerController] Node ${this.node.name} received playerReadyCallback with clientActorNr: ${actorNrCallback}. Current _actorNumber: ${this._actorNumber}`);
                    this.initializePlayerProperties(actorNrCallback);
                });
            }
        } else {
            cc.error("[PlayerController] NetworkManager instance not found on load for node " + this.node.name + "!");
            this.scheduleOnce(() => {
                this.networkManager = NetworkManager.getInstance();
                if (this.networkManager) {
                    const clientActorNr = this.networkManager.getMyActorNumber();
                    if (clientActorNr > 0) {
                        this.initializePlayerProperties(clientActorNr);
                    } else {
                        this.networkManager.registerPlayerReadyCallback((actorNrCallback) => {
                             cc.log(`[PlayerController] Node ${this.node.name} (delayed) received playerReadyCallback with clientActorNr: ${actorNrCallback}.`);
                            this.initializePlayerProperties(actorNrCallback);
                        });
                    }
                } else {
                    cc.error("[PlayerController] NetworkManager still not available after delay for node " + this.node.name);
                    this.initializePlayerProperties(-1); // Initialize with invalid client actor number
                }
            }, 0.1);
        }

        // 強制一開始關閉跑條
        if (this.snowballBar) this.snowballBar.node.active = false;
    }

    // New method to consolidate initialization that depends on actorNumber
    initializePlayerProperties(clientActorNumber: number) {
        const playerNames = ["Player_GRASS", "Player_FIRE", "Player_ICE", "Player_ELECTRIC"]; // Ensure this matches node names
        
        // Determine actorNumber for THIS player node based on its name
        this._actorNumber = -1; // Reset or default to invalid
        for (let i = 0; i < playerNames.length; i++) {
            if (this.node.name === playerNames[i]) {
                this._actorNumber = i + 1; // 1-based actor number
                break;
            }
        }

        if (this._actorNumber === -1) {
            cc.error(`[PlayerController] Node ${this.node.name} does not match any known player name pattern. Cannot determine its representative actor number.`);
            this._isLocalPlayer = false; // Cannot be local if we don't know who it is
            return;
        }

        // Determine if this node represents the local player
        if (clientActorNumber > 0) {
            this._isLocalPlayer = (this._actorNumber === clientActorNumber);
        } else {
            this._isLocalPlayer = false; // Client actor number is unknown or invalid, assume not local
            cc.warn(`[PlayerController] Node ${this.node.name} (rep: ${this._actorNumber}): Client actor number is invalid (${clientActorNumber}) or not yet known. Assuming not local for now.`);
        }

        // Unregister old listeners first to prevent duplicates if this method is called multiple times
        // (though the goal is to call it once with the correct clientActorNumber).
        // cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
        // cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
        // onDestroy handles unregistration based on the final _isLocalPlayer state.
        // The check before registration should be sufficient.

        if (this._isLocalPlayer) {
            // Only register if not already registered, or ensure idempotency if called multiple times.
            // For simplicity, we assume this part of init runs once effectively.
            cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
            cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
            if (this.rb) {
                this.rb.type = cc.RigidBodyType.Dynamic; // Local player is dynamic
            }
        } else {
            // For remote players, set Rigidbody to Kinematic for smoother remote updates
            if (this.rb) {
                this.rb.type = cc.RigidBodyType.Kinematic;
                cc.log(`[PlayerController] Node ${this.node.name} (Remote Actor: ${this._actorNumber}) Rigidbody set to Kinematic.`);
            }
        }
        cc.log(`[PlayerController] Initialized: node.name=${this.node.name}, representativeActorNumber=${this._actorNumber}, clientActorNr=${clientActorNumber}, isLocalPlayer=${this._isLocalPlayer}`);
    }

    onDestroy() {
        if (this.inputListenersAttached) {
            cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
            cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
            this.inputListenersAttached = false;
            cc.log(`[PlayerController] Input listeners DETACHED for: ${this.node.name}`);
        }
        // TODO: Consider unregistering from networkManager.registerPlayerReadyCallback if specific callbacks were stored.
    }

    onKeyDown(event: cc.Event.EventKeyboard) {
        if (this.state === PlayerState.Frozen) return;
        switch (event.keyCode) {
            case cc.macro.KEY.w:
            case cc.macro.KEY.up:
                this.keys['up'] = true;
                break;
            case cc.macro.KEY.s:
            case cc.macro.KEY.down:
                this.keys['down'] = true;
                break;
            case cc.macro.KEY.a:
            case cc.macro.KEY.left:
                this.keys['left'] = true;
                break;
            case cc.macro.KEY.d:
            case cc.macro.KEY.right:
                this.keys['right'] = true;
                break;
            case cc.macro.KEY.space:
                if (!this.hasSnowball && this.state !== PlayerState.MakingSnowball) {
                    this.state = PlayerState.MakingSnowball;
                    this.snowballTimer = 0;
                    if (this.anim) this.anim.play(this.makeAnimName);
                }
                break;
        }
    }

    onKeyUp(event: cc.Event.EventKeyboard) {
        switch (event.keyCode) {
            case cc.macro.KEY.w:
            case cc.macro.KEY.up:
                this.keys['up'] = false;
                break;
            case cc.macro.KEY.s:
            case cc.macro.KEY.down:
                this.keys['down'] = false;
                break;
            case cc.macro.KEY.a:
            case cc.macro.KEY.left:
                this.keys['left'] = false;
                break;
            case cc.macro.KEY.d:
            case cc.macro.KEY.right:
                this.keys['right'] = false;
                break;
            case cc.macro.KEY.space:
                if (this.state === PlayerState.MakingSnowball) {
                    this.state = PlayerState.Idle;
                    this.snowballTimer = 0;
                    if (this.anim) this.anim.play(this.idleAnimName); 
                } else if (this.state === PlayerState.HoldingSnowball) {
                    this.throwSnowball();
                }
                break;
        }
    }

    start () {}

    // 生命減少與顯示
    loseLife() {
        if (this.isDead) return; // 死亡後不再觸發
        this.life = Math.max(0, this.life - 1);
        if (this.lifeNode) {
            for (let i = 0; i < this.lifeNode.children.length; i++) {
                this.lifeNode.children[i].active = i < this.life;
            }
        }
        if (this.life <= 0) {
            this.handleDeath();
        }
    }

    // 玩家死亡流程
    private handleDeath() {
        this.isDead = true;
        // 停止操控
        this.state = PlayerState.Frozen;
        // 關閉本地玩家輸入
        if (this._isLocalPlayer && this.inputListenersAttached) {
            cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
            cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
            this.inputListenersAttached = false;
        }
        // 生成 IcedFX 特效
        if (this.icedFXPrefab) {
            const icedFX = cc.instantiate(this.icedFXPrefab);
            icedFX.parent = this.node.parent;
            icedFX.setPosition(this.node.getPosition());
            // 如果A隊，IcedFX垂直反轉
            if (this.team === 'A') {
                icedFX.scaleX = -1;
            }
            // 不調整透明度
            // 播放動畫（如果有 Animation 組件）
            const icedAnim = icedFX.getComponent(cc.Animation);
            if (icedAnim) {
                icedAnim.play();
            }
        }
        // 玩家角色消失
        this.node.opacity = 0;
        // 設定碰撞體為 sensor
        const collider = this.node.getComponent(cc.PhysicsCollider);
        if (collider) {
            collider.sensor = true;
            collider.apply();
        }
        // 若有剛體，停止移動
        if (this.rb) {
            this.rb.linearVelocity = cc.v2(0, 0);
            this.rb.angularVelocity = 0;
            // 不要設 active = false，避免 Box2D SetActive crash
            // this.rb.active = false; // <-- 移除這行
        }
    }

    update(dt: number) {
        // Unified slowTimer logic for both local and remote players
        // This should be processed regardless of whether the player is local or remote.
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            this.node.color = this.slowColor; // Apply slow color
            // moveSpeed is primarily for local player's input-driven movement,
            // but update for consistency or if any other logic relies on it.
            this.moveSpeed = this.slowSpeed; 

            if (this.slowTimer <= 0) {
                this.node.color = this.normalColor; // Revert to normal color
                this.moveSpeed = this.normalSpeed;
                cc.log(`[PlayerController] Player ${this.node.name} (Actor: ${this._actorNumber}) slow effect ended.`);
            }
        }

        if (!this._isLocalPlayer) {
            // For remote players, movement is primarily handled by applyRemoteMove.
            // Animation updates related to movement are in applyRemoteMove.
            // The slowTimer logic above handles color and speed state for remotes.
            return;
        }

        // --- Local Player Logic from here ---
        if (this.state === PlayerState.Frozen) return; // 如果凍結，則不執行任何操作

        // 製作雪球流程
        if (this.state === PlayerState.MakingSnowball) {
            this.snowballTimer += dt;
            if (this.snowballBar) {
                this.snowballBar.node.active = true;
                this.snowballBar.progress = Math.min(this.snowballTimer / this.snowballMakingTime, 1);
            }
            if (this.snowballTimer >= this.snowballMakingTime) {
                this.hasSnowball = true;
                this.state = PlayerState.HoldingSnowball;
                if (this.snowballBar) this.snowballBar.node.active = false;
            }
            if (this.anim && !this.anim.getAnimationState(this.makeAnimName).isPlaying) {
                this.anim.play(this.makeAnimName);
            }
            if (this.rb) this.rb.linearVelocity = cc.v2(0, 0);
            return;
        } else if (this.snowballBar) {
            this.snowballBar.node.active = false;
        }

        // 移動
        let inputDx = 0, inputDy = 0; // Raw input direction
        if (this.keys['up']) inputDy += 1;
        if (this.keys['down']) inputDy -= 1;
        if (this.keys['left']) inputDx -= 1;
        if (this.keys['right']) inputDx += 1;

        let normalizedInputDx = inputDx;
        let normalizedInputDy = inputDy;

        if (inputDx !== 0 || inputDy !== 0) {
            let len = Math.sqrt(inputDx * inputDx + inputDy * inputDy);
            normalizedInputDx = inputDx / len;
            normalizedInputDy = inputDy / len;
            this.node.x += normalizedInputDx * this.moveSpeed * dt;
            this.node.y += normalizedInputDy * this.moveSpeed * dt;
        }
        
        // Send movement data if position changed significantly OR input direction changed
        // OR if it was moving by input and input stopped (to send inputDx:0, inputDy:0)
        const positionChanged = Math.abs(this.node.x - this.lastSentX) > 0.1 || Math.abs(this.node.y - this.lastSentY) > 0.1;
        const inputDirectionChanged = normalizedInputDx !== this.lastSentInputDx || normalizedInputDy !== this.lastSentInputDy;

        if (positionChanged || inputDirectionChanged) {
            this.sendMoveMessage(normalizedInputDx, normalizedInputDy);
            this.lastSentX = this.node.x;
            this.lastSentY = this.node.y;
            this.lastSentInputDx = normalizedInputDx; 
            this.lastSentInputDy = normalizedInputDy;
        }
        
        // 方向判斷與動畫 (based on input)
        if (inputDx !== 0) { // Use raw inputDx for immediate facing direction change
            this.faceRight = inputDx > 0;
            this.node.scaleX = this.faceRight ? 1 : -1;
        }

        let currentAnimName = "";
        if (this.hasSnowball) {
            currentAnimName = (inputDx !== 0 || inputDy !== 0) ? this.runLoadedAnimName : this.idleLoadedAnimName;
        } else {
            currentAnimName = (inputDx !== 0 || inputDy !== 0) ? this.runAnimName : this.idleAnimName;
        }

        if (this.anim && (this.anim.currentClip?.name !== currentAnimName || !this.anim.getAnimationState(currentAnimName).isPlaying)) {
            this.anim.play(currentAnimName);
        }
        
        // 狀態更新 (based on input)
        if (inputDx !== 0 || inputDy !== 0) {
            this.state = this.hasSnowball ? PlayerState.HoldingSnowball : PlayerState.Moving;
             if (this.rb && this.rb.type === cc.RigidBodyType.Dynamic) { // Apply force only if dynamic (local player)
                // We are directly setting position, so applying force might be redundant or cause overshoot.
                // If direct position setting is preferred, this force application might be removed or adjusted.
                // For now, let's keep it to see its effect with the direct position update.
                // this.rb.applyForceToCenter(cc.v2(normalizedInputDx * this.moveSpeed * 5, normalizedInputDy * this.moveSpeed * 5), true);
                
                // Alternative: Set linear velocity directly for more responsive control if not relying on forces for drift
                this.rb.linearVelocity = cc.v2(normalizedInputDx * this.moveSpeed, normalizedInputDy * this.moveSpeed);
            }
        } else {
            // If no input, state becomes Idle or HoldingSnowball. Physics (damping) will handle drift.
            this.state = this.hasSnowball ? PlayerState.HoldingSnowball : PlayerState.Idle;
            if (this.rb && this.rb.type === cc.RigidBodyType.Dynamic) {
                // If we were setting linearVelocity directly, we might want to zero it out when input stops,
                // and let damping handle the slowdown. Or, if applyForceToCenter was used, it naturally stops.
                // For now, if linearVelocity was set, let damping take over. If not, this is fine.
            }
        }
        // 手上雪球顯示控制
        if (this.handSnowball) this.handSnowball.active = this.hasSnowball;
        // The slowTimer logic for local player that was here is now moved to the top of the update method.
    }

    // Add these to store last sent direction for local player movement optimization
    private lastSentInputDx: number = 0; // Changed from lastSentDx
    private lastSentInputDy: number = 0; // Changed from lastSentDy

    sendMoveMessage(currentInputDx: number, currentInputDy: number) { // Added inputDx, inputDy params
        if (!this.networkManager || !this._isLocalPlayer || this._actorNumber === -1) return;
        // cc.log(`[PlayerController] sendMoveMessage: actor=${this._actorNumber}, pos=(${this.node.x.toFixed(1)}, ${this.node.y.toFixed(1)}), input=(${currentInputDx.toFixed(1)}, ${currentInputDy.toFixed(1)}), hasSnowball=${this.hasSnowball}, faceRight=${this.faceRight}`);
        this.networkManager.sendGameAction(PhotonEventCodes.PLAYER_MOVEMENT, {
            playerId: this._actorNumber,
            to: { x: this.node.x, y: this.node.y },
            inputDx: currentInputDx, // Send current input direction
            inputDy: currentInputDy, // Send current input direction
            hasSnowball: this.hasSnowball,
            faceRight: this.faceRight
        });
    }

    /**
     * 遠端同步移動（只給非本地玩家呼叫）
     * 支援補間、動畫、雪球顯示同步
     */
    applyRemoteMove(to: { x: number, y: number }, opts?: { inputDx?: number, inputDy?: number, hasSnowball?: boolean, faceRight?: boolean }) {
        if (this._isLocalPlayer) return;

        const currentPos = cc.v2(this.node.x, this.node.y);
        const targetPos = cc.v2(to.x, to.y);
        const distance = currentPos.sub(targetPos).mag();
        
        this.node.stopActionByTag(PlayerController.REMOTE_MOVE_ACTION_TAG);
        const duration = 0.1; // Slightly increased for smoother interpolation over typical network update rates
        const moveAction = cc.moveTo(duration, targetPos.x, targetPos.y);
        moveAction.setTag(PlayerController.REMOTE_MOVE_ACTION_TAG);
        this.node.runAction(moveAction);

        let remoteIsActuallyMovingBasedOnInput = false; // Default to not moving based on input

        if (opts) {
            if (opts.faceRight !== undefined && this.faceRight !== opts.faceRight) {
                this.faceRight = opts.faceRight;
                this.node.scaleX = this.faceRight ? Math.abs(this.node.scaleX) : -Math.abs(this.node.scaleX);
            }
            if (opts.hasSnowball !== undefined && this.hasSnowball !== opts.hasSnowball) {
                this.hasSnowball = opts.hasSnowball;
                if (this.handSnowball) this.handSnowball.active = this.hasSnowball;
            }
            // Check inputDx and inputDy from opts
            if (opts.inputDx !== undefined && opts.inputDy !== undefined) {
                remoteIsActuallyMovingBasedOnInput = opts.inputDx !== 0 || opts.inputDy !== 0;
            }
        }

        let remoteAnimName = "";
        if (remoteIsActuallyMovingBasedOnInput) { // Animation based on input from network
            this.state = PlayerState.Moving; 
            remoteAnimName = this.hasSnowball ? this.runLoadedAnimName : this.runAnimName;
        } else {
            this.state = this.hasSnowball ? PlayerState.HoldingSnowball : PlayerState.Idle;
            remoteAnimName = this.hasSnowball ? this.idleLoadedAnimName : this.idleAnimName;
        }
        
        if (this.anim && (this.anim.currentClip?.name !== remoteAnimName || !this.anim.getAnimationState(remoteAnimName).isPlaying)) {
            this.anim.play(remoteAnimName);
        }
    }
    
    throwSnowball() {
        if (!this.hasSnowball || !this.snowballPrefab) return;
        if (this.anim) this.anim.play(this.throwAnimName);
        // Instantiate and init snowball locally for immediate feedback
        const dir = this.faceRight ? 1 : -1;
        const offset = 40;
        const throwX = this.node.x + dir * offset;
        const throwY = this.node.y;
        const snowball = cc.instantiate(this.snowballPrefab);
        snowball.parent = this.node.parent;
        snowball.x = throwX;
        snowball.y = throwY;
        const snowballScript = snowball.getComponent('SnowBall');
        if (snowballScript) {
            snowballScript.init(cc.v2(dir, 0), this.team);
        }
        cc.log(`[PlayerController] throwSnowball: node=${this.node.name}, actor=${this._actorNumber}, pos=(${throwX},${throwY}), dir=${dir}, team=${this.team}`);
        this.hasSnowball = false;
        if (this.handSnowball) this.handSnowball.active = false;
        this.state = PlayerState.Idle;
        if (this.anim) {
            const throwAnimState = this.anim.getAnimationState(this.throwAnimName);
            const duration = throwAnimState ? throwAnimState.duration : 0.5;
            this.scheduleOnce(() => {
                if (this.anim && (this.state === PlayerState.Idle || this.state === PlayerState.HoldingSnowball) && !this.hasSnowball) {
                    const idleAnimToPlay = this.idleAnimName;
                    this.anim.play(idleAnimToPlay);
                }
            }, duration);
        }
        if (this.networkManager && this._isLocalPlayer && this._actorNumber !== -1) {
            // 廣播丟雪球事件，包含座標、方向、team，正確包裝 data
            this.networkManager.sendGameAction(PhotonEventCodes.PLAYER_THROW_ACTION, {
                playerId: this._actorNumber,
                data: {
                    x: throwX,
                    y: throwY,
                    dir: dir,
                    team: this.team
                }
            });
            cc.log(`[PlayerController] throwSnowball: sent PLAYER_THROW_ACTION, playerId=${this._actorNumber}, data={x:${throwX},y:${throwY},dir:${dir},team:${this.team}}`);
        }
    }

    // New method to handle remote actions like throw or hit, called by NetworkManager
    public handleRemoteAction(actionCode: number, data: any) {
        cc.log(`[PlayerController] handleRemoteAction RAW_INPUT: node=${this.node.name} (actor: ${this._actorNumber}), actionCode=${actionCode}, data=`, data);

        if (!data) {
            cc.warn(`[PlayerController] handleRemoteAction: node=${this.node.name} received undefined/null data, skip.`);
            return;
        }
        if (this._isLocalPlayer) {
            cc.log(`[PlayerController] handleRemoteAction: node=${this.node.name} isLocalPlayer. Ignoring remote action for self.`);
            return; 
        }
        // For remote throw/hit, always process (do not check data.playerId)
        cc.log(`[PlayerController] handleRemoteAction PROCESSING: node=${this.node.name} (actor: ${this._actorNumber}), actionCode=${actionCode}, data=`, data);

        switch (actionCode) {
            case PhotonEventCodes.PLAYER_THROW_ACTION:
                // 遠端也要產生雪球
                cc.log(`[PlayerController] [SYNC] Remote THROW: node=${this.node.name}, x=${data.x}, y=${data.y}, dir=${data.dir}, team=${data.team}`);
                if (this.snowballPrefab && data) {
                    const snowball = cc.instantiate(this.snowballPrefab);
                    snowball.parent = this.node.parent;
                    snowball.x = data.x;
                    snowball.y = data.y;
                    const snowballScript = snowball.getComponent('SnowBall');
                    if (snowballScript) {
                        snowballScript.init(cc.v2(data.dir, 0), data.team);
                    }
                }
                this.hasSnowball = false;
                if (this.handSnowball) this.handSnowball.active = false;
                if (this.anim) {
                    this.anim.play(this.throwAnimName);
                    const throwAnimState = this.anim.getAnimationState(this.throwAnimName);
                    const duration = throwAnimState ? throwAnimState.duration : 0.5;
                    this.scheduleOnce(() => {
                        if (this.anim) { 
                            const idleAnimToPlay = this.idleAnimName;
                            this.anim.play(idleAnimToPlay);
                        }
                    }, duration);
                }
                this.state = PlayerState.Idle; 
                break;

            case PhotonEventCodes.PLAYER_HIT_ACTION:
                if (data && data.newLife !== undefined) { // Assuming 'data' contains newLife
                    this.life = data.newLife;
                    if (this.lifeNode) {
                        for (let i = 0; i < this.lifeNode.children.length; i++) {
                            this.lifeNode.children[i].active = i < this.life;
                        }
                    }
                }
                if (this.hitFXPrefab) {
                    const fx = cc.instantiate(this.hitFXPrefab);
                    fx.parent = this.node.parent; 
                    fx.x = this.node.x;
                    fx.y = this.node.y + 20; // Adjust FX position as needed
                }
                this.node.color = this.slowColor;
                this.slowTimer = 2.0; // This will be handled by the update loop to revert color
                break;
        }
    }
}
