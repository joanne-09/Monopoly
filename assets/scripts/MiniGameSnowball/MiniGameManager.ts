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
    @property(cc.Button)
    backToMapButton: cc.Button = null;

    private gameTime: number = 120; // 遊戲總秒數
    private timer: number = 0;
    private isGameOver: boolean = false;
    private teamAScore: number = 0;
    private teamBScore: number = 0;
    private players: any[] = [];
    private networkManager: NetworkManager = null;
    private isMaster: boolean = false;
    private messageHandler: (eventCode: number, content: any, actorNr: number) => void;

    // 新增：分數是否需要更新的標記
    private scoreNeedsUpdate: boolean = false;
    private syncTimer: number = 1.0; // Timer for syncing game state like time

    // Corrected playerNames to include Player_ICE as per screenshot and PlayerController.ts
    private playerNames: string[] = [null, "Player_GRASS", "Player_FIRE", "Player_ICE", "Player_ELECTRIC"]; // 1-indexed

    onLoad() {
        this.timer = this.gameTime;
        this.initNetworkManager();
        // 初始化分數顯示
        this.updateScoreDisplay();
        
        if (this.backToMapButton) {
            this.backToMapButton.node.on('click', () => {
                cc.director.loadScene('MapScene');
            });
        }
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
            // 更新計時器
            this.timer -= dt;
            if (this.timerLabel) {
                const newTimeText = `Time: ${Math.ceil(this.timer)}`;
                if (this.timerLabel.string !== newTimeText) {
                    this.timerLabel.string = newTimeText;
                }
            }
            
            if (this.timer <= 0) {
                cc.log("[GameManager] Master client: Timer reached 0. Ending game.");
                this.endGame();
            }
            
            // 定期同步計時器和分數
            this.syncTimer -= dt;
            if (this.syncTimer <= 0) {
                this.syncTimer = 1.0; 
                if (this.networkManager && this.networkManager.isConnected()) {
                    // 同步計時器
                    this.networkManager.sendGameAction(PhotonEventCodes.SEND_MESSAGE, { 
                        type: 'timer', 
                        timer: this.timer 
                    });
                    
                    // 如果分數有變化，也同步分數
                    if (this.scoreNeedsUpdate) {
                        this.networkManager.sendGameAction(PhotonEventCodes.SEND_MESSAGE, {
                            type: 'score',
                            teamAScore: this.teamAScore,
                            teamBScore: this.teamBScore
                        });
                        this.scoreNeedsUpdate = false;
                    }
                }
            }
        }
        
        // 非主機也要更新分數顯示（以防萬一）
        this.updateScoreDisplay();
    }

    // 新增：統一的分數顯示更新方法
    private updateScoreDisplay() {
        if (this.scoreLabelA) {
            const newScoreA = `${this.teamAScore}`;
            if (this.scoreLabelA.string !== newScoreA) {
                this.scoreLabelA.string = newScoreA;
                cc.log(`[GameManager] Updated scoreLabelA: ${this.teamAScore}`);
            }
        }
        
        if (this.scoreLabelB) {
            const newScoreB = `${this.teamBScore}`;
            if (this.scoreLabelB.string !== newScoreB) {
                this.scoreLabelB.string = newScoreB;
                cc.log(`[GameManager] Updated scoreLabelB: ${this.teamBScore}`);
            }
        }
    }

    addScore(team: 'A' | 'B', score: number) {
        if (this.isGameOver) {
            cc.log(`[GameManager] Game is over, ignoring score addition for team ${team}`);
            return;
        }

        cc.log(`[GameManager] addScore called for team: ${team}, score: ${score}`);
        
        // 更新分數
        if (team === 'A') {
            this.teamAScore += score;
        } else {
            this.teamBScore += score;
        }
        
        // 立即更新顯示
        this.updateScoreDisplay();
        
        // 標記分數需要同步
        this.scoreNeedsUpdate = true;
        
        // 主機立即同步分數（重要變化立即同步）
        if (this.isMaster) {
            cc.log(`[GameManager] Master client sending immediate score update. A: ${this.teamAScore}, B: ${this.teamBScore}`);
            if (this.networkManager && this.networkManager.isConnected()) {
                this.networkManager.sendGameAction(PhotonEventCodes.SEND_MESSAGE, {
                    type: 'score',
                    teamAScore: this.teamAScore,
                    teamBScore: this.teamBScore
                });
                this.scoreNeedsUpdate = false;
            }
        }
    }

    // 新增：測試方法，可以在開發時手動調用來測試分數更新
    testAddScore() {
        cc.log("[GameManager] Testing score addition...");
        this.addScore('A', 10);
        this.scheduleOnce(() => {
            this.addScore('B', 5);
        }, 1);
    }

    handlePhotonEvent(eventCode: number, content: any, actorNr: number) {
        cc.log(`[GameManager] handlePhotonEvent received: eventCode=${eventCode}, actorNr=${actorNr}, content=`, content);

        if (eventCode === PhotonEventCodes.SEND_MESSAGE) {
            if (content.type === 'timer' && !this.isMaster) {
                const oldTimer = this.timer;
                this.timer = content.timer;
                if (this.timerLabel) {
                    const newTimeText = `Time: ${Math.ceil(this.timer)}`;
                    if (this.timerLabel.string !== newTimeText) {
                        this.timerLabel.string = newTimeText;
                    }
                }
            }
            
            if (content.type === 'score' && !this.isMaster) {
                const oldScoreA = this.teamAScore;
                const oldScoreB = this.teamBScore;
                this.teamAScore = content.teamAScore;
                this.teamBScore = content.teamBScore;
                cc.log(`[GameManager] Client received score update. Old A: ${oldScoreA}, New A: ${this.teamAScore}. Old B: ${oldScoreB}, New B: ${this.teamBScore}`);
                
                // 立即更新顯示
                this.updateScoreDisplay();
            }
            return; // SEND_MESSAGE handled, exit early
        }

        const targetPlayerId = content.playerId; 
        if (!targetPlayerId) {
            cc.log(`[GameManager] Event ${eventCode} (actorNr: ${actorNr}) does not have a playerId in content. Content:`, content);
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
                    cc.error(`[GameManager] Cannot find player node: GameManager's node or its parent is null.`);
                    return;
                }
                
                if (playerNode) {
                    playerController = playerNode.getComponent(PlayerController);
                } else {
                    cc.log(`[GameManager] Player node not found at path: ${playerNodePath} (searched from ${this.node.parent ? this.node.parent.name : 'null parent'}) for targetPlayerId: ${targetPlayerId}`);
                }
            } else {
                cc.log(`[GameManager] No player name defined for targetPlayerId: ${targetPlayerId}`);
            }
        } else {
            cc.log(`[GameManager] Invalid targetPlayerId: ${targetPlayerId}`);
            return; 
        }

        if (!playerController) {
            cc.log(`[GameManager] PlayerController not found for targetPlayerId: ${targetPlayerId} (nodeName: ${this.playerNames[targetPlayerId] ? this.playerNames[targetPlayerId] : 'N/A'}). Cannot handle event ${eventCode}.`);
            return;
        }
        
        // Check if the event is for the local player; if so, it might be an echo or handled differently.
        if (playerController.getIsLocalPlayer()) {
            cc.log(`[GameManager] Event ${eventCode} is for local player ${this.playerNames[targetPlayerId]} (actorNr: ${targetPlayerId}). Usually handled by PlayerController directly or ignored if echo.`);
        }

        switch (eventCode) {
            case PhotonEventCodes.PLAYER_MOVEMENT:
                const { to, inputDx, inputDy, hasSnowball, faceRight } = content;
                cc.log(`[GameManager] Received PLAYER_MOVEMENT for ${this.playerNames[targetPlayerId]} (ID: ${targetPlayerId}), to: (${to.x.toFixed(1)},${to.y.toFixed(1)}), input: (${inputDx !== undefined ? inputDx.toFixed(1) : 'N/A'}, ${inputDy !== undefined ? inputDy.toFixed(1) : 'N/A'}), hasSnowball: ${hasSnowball}, faceRight: ${faceRight}`);
                if (playerController.getActorNumber() === targetPlayerId && !playerController.getIsLocalPlayer()) {
                    playerController.applyRemoteMove(to, { inputDx, inputDy, hasSnowball, faceRight });
                } else {
                    cc.log(`[GameManager] PlayerController check failed for PLAYER_MOVEMENT on ${this.playerNames[targetPlayerId]}. Controller actorNumber: ${playerController.getActorNumber()}, isLocal: ${playerController.getIsLocalPlayer()}`);
                }
                break;

            case PhotonEventCodes.PLAYER_THROW_ACTION:
            case PhotonEventCodes.PLAYER_HIT_ACTION: 
                const actionType = eventCode === PhotonEventCodes.PLAYER_THROW_ACTION ? 'THROW' : 'HIT';
                cc.log(`[GameManager] Received PLAYER_ACTION: ${actionType} for ${this.playerNames[targetPlayerId]} (ID: ${targetPlayerId}), data:`, content.data);
                if (playerController.getActorNumber() === targetPlayerId && !playerController.getIsLocalPlayer()) {
                    playerController.handleRemoteAction(eventCode, content.data); 
                } else {
                    cc.log(`[GameManager] PlayerController check failed for ${actionType} on ${this.playerNames[targetPlayerId]}. Controller actorNumber: ${playerController.getActorNumber()}, isLocal: ${playerController.getIsLocalPlayer()}`);
                }
                break;
            
            default:
                cc.log(`[GameManager] Received unhandled eventCode: ${eventCode} for player ${targetPlayerId}`);
                break;
        }
    }

    onPlayerFrozen(player) {
        // TODO: 處理玩家被冰塊化，檢查是否全隊冰塊
        // 若全員冰塊則提前結束遊戲
    }

    endGame() {
        this.isGameOver = true;
        // TODO: 判斷勝負、加分、顯示結果
    }
}