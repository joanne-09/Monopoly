// GameManager.ts
// 管理雪球小遊戲的主要規則與流程
const { ccclass, property } = cc._decorator;
import NetworkManager from "../NetworkManager";
import { PhotonEventCodes } from "../types/PhotonEventCodes";
import PlayerController from "./PlayerController"; 

@ccclass
export default class GameManager extends cc.Component {
    @property(cc.Label)
    timerLabel: cc.Label = null;
    @property(cc.Label)
    scoreLabelA: cc.Label = null;
    @property(cc.Label)
    scoreLabelB: cc.Label = null;

    private gameTime: number = 120; // 遊戲總秒數
    private timer: number = 0;
    private isGameOver: boolean = false;
    private teamAScore: number = 0;
    private teamBScore: number = 0;
    private players: any[] = [];
    private networkManager: NetworkManager = null;
    private isMaster: boolean = false;
    private messageHandler: (eventCode: number, content: any, actorNr: number) => void;

    // Corrected playerNames to include Player_ICE as per screenshot and PlayerController.ts
    private playerNames: string[] = [null, "Player_GRASS", "Player_FIRE", "Player_ICE", "Player_ELECTRIC"]; // 1-indexed

    onLoad() {
        this.timer = this.gameTime;
        this.initNetworkManager();
        // TODO: 初始化玩家、分隊
    }

    initNetworkManager() {
        this.networkManager = NetworkManager.getInstance();
        if (!this.networkManager) {
            this.scheduleOnce(() => this.initNetworkManager(), 0.1);
            return;
        }
        if (this.networkManager.isConnected() === false) {
            this.networkManager.connectToPhoton();
        }
        this.isMaster = this.networkManager.getMyActorNumber() === 1; // 預設1號為主機
        this.messageHandler = this.handlePhotonEvent.bind(this);
        this.networkManager.registerMessageHandler(this.messageHandler);
    }

    onDestroy() {
        if (this.networkManager && this.messageHandler) {
            this.networkManager.unregisterMessageHandler(this.messageHandler);
        }
    }

    update(dt: number) {
        if (this.isGameOver) return;
        if (this.isMaster) {
            this.timer -= dt;
            if (this.timerLabel) {
                const newTimeText = `Time: ${Math.ceil(this.timer)}`;
                if (this.timerLabel.string !== newTimeText) {
                    this.timerLabel.string = newTimeText;
                    // cc.log(`[GameManager] Master client updated timerLabel: ${newTimeText}`);
                }
            }
            if (this.timer <= 0) {
                cc.log(`[GameManager] Master client: Timer reached 0. Ending game.`);
                this.endGame();
            }
            this.syncTimer -= dt;
            if (this.syncTimer <= 0) {
                this.syncTimer = 1.0; 
                if (this.networkManager && this.networkManager.isConnected()) {
                    this.networkManager.sendGameAction(PhotonEventCodes.SEND_MESSAGE, { type: 'timer', timer: this.timer });
                }
            }
        }
    }

    private syncTimer: number = 1.0; // Timer for syncing game state like time

    addScore(team: 'A' | 'B', score: number) {
        cc.log(`[GameManager] addScore called for team: ${team}, score: ${score}`);
        if (team === 'A') {
            this.teamAScore += score;
            if (this.scoreLabelA) { // Corrected: Added parentheses
                this.scoreLabelA.string = `${this.teamAScore}`;
                cc.log(`[GameManager] Updated scoreLabelA: ${this.teamAScore}`);
            }
        } else {
            this.teamBScore += score;
            if (this.scoreLabelB) {
                this.scoreLabelB.string = `${this.teamBScore}`;
                cc.log(`[GameManager] Updated scoreLabelB: ${this.teamBScore}`);
            }
        }
        // 主機同步分數
        if (this.isMaster) {
            cc.log(`[GameManager] Master client sending score update. A: ${this.teamAScore}, B: ${this.teamBScore}`);
            if (this.networkManager && this.networkManager.isConnected()) {
                this.networkManager.sendGameAction(PhotonEventCodes.SEND_MESSAGE, {
                    type: 'score',
                    teamAScore: this.teamAScore,
                    teamBScore: this.teamBScore
                });
            }
        }
    }

    handlePhotonEvent(eventCode: number, content: any, actorNr: number) {
        cc.log(`[MiniGameManager] handlePhotonEvent received: eventCode=${eventCode}, actorNr=${actorNr}, content=`, content);

        if (eventCode === PhotonEventCodes.SEND_MESSAGE) {
            if (content.type === 'timer' && !this.isMaster) {
                const oldTimer = this.timer;
                this.timer = content.timer;
                // cc.log(`[MiniGameManager] Client received timer update. Old: ${oldTimer.toFixed(2)}, New: ${this.timer.toFixed(2)}`);
                if (this.timerLabel) {
                    const newTimeText = `Time: ${Math.ceil(this.timer)}`;
                    if (this.timerLabel.string !== newTimeText) {
                        this.timerLabel.string = newTimeText;
                        // cc.log(`[MiniGameManager] Client updated timerLabel: ${newTimeText}`);
                    }
                }
            }
            if (content.type === 'score' && !this.isMaster) {
                const oldScoreA = this.teamAScore;
                const oldScoreB = this.teamBScore;
                this.teamAScore = content.teamAScore;
                this.teamBScore = content.teamBScore;
                // cc.log(`[MiniGameManager] Client received score update. Old A: ${oldScoreA}, New A: ${this.teamAScore}. Old B: ${oldScoreB}, New B: ${this.teamBScore}`);
                if (this.scoreLabelA) {
                    this.scoreLabelA.string = `${this.teamAScore}`;
                }
                if (this.scoreLabelB) {
                    this.scoreLabelB.string = `${this.teamBScore}`;
                }
            }
            return; // SEND_MESSAGE handled, exit early
        }

        const targetPlayerId = content.playerId; 
        if (!targetPlayerId) {
            cc.log(`[MiniGameManager] Event ${eventCode} (actorNr: ${actorNr}) does not have a playerId in content. Content:`, content);
            return; 
        }

        let playerNode: cc.Node = null;
        let playerController: PlayerController = null;

        if (targetPlayerId > 0 && targetPlayerId < this.playerNames.length) {
            const playerName = this.playerNames[targetPlayerId];
            if (playerName) {
                const playerNodePath = `Players/${playerName}`;
                // Search relative to the parent of the Canvas node (which should be SnowballGame node)
                if (this.node && this.node.parent) {
                    playerNode = cc.find(playerNodePath, this.node.parent);
                } else {
                    cc.error(`[MiniGameManager] Cannot find player node: MiniGameManager's node or its parent is null.`);
                    return;
                }
                
                if (playerNode) {
                    playerController = playerNode.getComponent(PlayerController);
                } else {
                    cc.log(`[MiniGameManager] Player node not found at path: ${playerNodePath} (searched from ${this.node.parent ? this.node.parent.name : 'null parent'}) for targetPlayerId: ${targetPlayerId}`);
                }
            } else {
                cc.log(`[MiniGameManager] No player name defined for targetPlayerId: ${targetPlayerId}`);
            }
        } else {
            cc.log(`[MiniGameManager] Invalid targetPlayerId: ${targetPlayerId}`);
            return; 
        }

        if (!playerController) {
            cc.log(`[MiniGameManager] PlayerController not found for targetPlayerId: ${targetPlayerId} (nodeName: ${this.playerNames[targetPlayerId] ? this.playerNames[targetPlayerId] : 'N/A'}). Cannot handle event ${eventCode}.`);
            return;
        }
        
        // Check if the event is for the local player; if so, it might be an echo or handled differently.
        // Generally, remote events are for non-local players.
        if (playerController.getIsLocalPlayer()) {
            cc.log(`[MiniGameManager] Event ${eventCode} is for local player ${this.playerNames[targetPlayerId]} (actorNr: ${targetPlayerId}). Usually handled by PlayerController directly or ignored if echo.`);
            // return; // Potentially uncomment if local player should strictly not process these events here.
        }

        switch (eventCode) {
            case PhotonEventCodes.PLAYER_MOVEMENT:
                const { to, inputDx, inputDy, hasSnowball, faceRight } = content; // Added inputDx, inputDy
                cc.log(`[MiniGameManager] Received PLAYER_MOVEMENT for ${this.playerNames[targetPlayerId]} (ID: ${targetPlayerId}), to: (${to.x.toFixed(1)},${to.y.toFixed(1)}), input: (${inputDx !== undefined ? inputDx.toFixed(1) : 'N/A'}, ${inputDy !== undefined ? inputDy.toFixed(1) : 'N/A'}), hasSnowball: ${hasSnowball}, faceRight: ${faceRight}`);
                if (playerController.getActorNumber() === targetPlayerId && !playerController.getIsLocalPlayer()) {
                    playerController.applyRemoteMove(to, { inputDx, inputDy, hasSnowball, faceRight }); // Pass inputDx, inputDy
                } else {
                    cc.log(`[MiniGameManager] PlayerController check failed for PLAYER_MOVEMENT on ${this.playerNames[targetPlayerId]}. Controller actorNumber: ${playerController.getActorNumber()}, isLocal: ${playerController.getIsLocalPlayer()}`);
                }
                break;

            case PhotonEventCodes.PLAYER_THROW_ACTION:
            case PhotonEventCodes.PLAYER_HIT_ACTION: 
                const { data } = content; 
                const actionType = eventCode === PhotonEventCodes.PLAYER_THROW_ACTION ? 'THROW' : 'HIT';
                cc.log(`[MiniGameManager] Received PLAYER_ACTION: ${actionType} for ${this.playerNames[targetPlayerId]} (ID: ${targetPlayerId}), data:`, data);
                if (playerController.getActorNumber() === targetPlayerId && !playerController.getIsLocalPlayer()) {
                    playerController.handleRemoteAction(eventCode, data); 
                } else {
                    cc.log(`[MiniGameManager] PlayerController check failed for ${actionType} on ${this.playerNames[targetPlayerId]}. Controller actorNumber: ${playerController.getActorNumber()}, isLocal: ${playerController.getIsLocalPlayer()}`);
                }
                break;
            
            default:
                cc.log(`[MiniGameManager] Received unhandled eventCode: ${eventCode} for player ${targetPlayerId}`);
                break;
        }
    }

    // Helper to find player by actor number if your this.players array is populated
    // findControllerByActorNr(actorNr: number) {
    //     const playerEntry = this.players.find(p => p.actorNumber === actorNr);
    //     return playerEntry ? playerEntry.controller : null;
    // }

    onPlayerFrozen(player) {
        // TODO: 處理玩家被冰塊化，檢查是否全隊冰塊
        // 若全員冰塊則提前結束遊戲
    }

    endGame() {
        this.isGameOver = true;
        // TODO: 判斷勝負、加分、顯示結果
    }
}
