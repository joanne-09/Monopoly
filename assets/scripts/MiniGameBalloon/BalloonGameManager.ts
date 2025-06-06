// filepath: c:\\Monopoly Game\\Monopoly\\assets\\scripts\\MiniGameBalloon\\BalloonGameManager.ts
const {ccclass, property} = cc._decorator;
import Balloon from "./Balloon";
import BalloonPlayerController from "./BalloonPlayerController";
import NetworkManager from "../NetworkManager";
import { PhotonEventCodes } from "../types/PhotonEventCodes";

interface PlayerScore {
    actorNr: number;
    score: number;
    name: string; // Optional: player name for display
}

@ccclass
export default class BalloonGameManager extends cc.Component {

    @property(cc.Prefab)
    balloonPrefab: cc.Prefab = null;

    @property(cc.Node)
    balloonLayer: cc.Node = null; // Parent node for balloons

    @property(cc.Label)
    timerLabel: cc.Label = null;

    @property(cc.Label)
    scoreLabel: cc.Label = null; // For local player's score or general score display

    @property(cc.Node) // Assign the local player's controller node here
    localPlayerNode: cc.Node = null;

    @property
    gameTime: number = 60; // seconds

    private timer: number = 0;
    private isGameOver: boolean = false;
    private networkManager: NetworkManager = null;
    private isMasterClient: boolean = false;
    private myActorNr: number = -1;

    private playerScores: PlayerScore[] = [];
    private activeBalloons: Map<string, Balloon> = new Map(); // Keep track of active balloons by ID

    private balloonSpawnInterval: number = 0.5; // seconds
    private timeSinceLastSpawn: number = 0;
    private nextBalloonId: number = 0;

    private messageHandler: (eventCode: number, content: any, actorNr: number) => void;


    onLoad () {
        this.networkManager = NetworkManager.getInstance();
        if (!this.networkManager) {
            cc.error("[BalloonGameManager] NetworkManager not found!");
            this.isGameOver = true;
            return;
        }

        this.myActorNr = this.networkManager.getMyActorNumber();
        this.isMasterClient = this.networkManager.isMasterClient();
        this.timer = this.gameTime;

        if (this.localPlayerNode) {
            const controller = this.localPlayerNode.getComponent(BalloonPlayerController);
            if (controller) {
                controller.init(this); // Pass reference of this manager to player controller
            } else {
                cc.error("[BalloonGameManager] BalloonPlayerController component not found on localPlayerNode.");
            }
        } else {
            cc.error("[BalloonGameManager] LocalPlayerNode not assigned in editor.");
        }

        // Initialize scores for all players in the room
        const players = this.networkManager.getActorList(); // Or a similar method
        if (players) {
            players.forEach(playerInfo => { // Adjust playerInfo structure as per your NetworkManager
                this.playerScores.push({ 
                    actorNr: playerInfo.actorNr, 
                    score: 0, 
                    name: playerInfo.name || `Player ${playerInfo.actorNr}` 
                });
            });
        }
        this.internalUpdateScoreDisplay();

        this.messageHandler = this.handlePhotonEvent.bind(this);
        this.networkManager.registerMessageHandler(this.messageHandler);

        if (!this.balloonPrefab) cc.error("Balloon prefab not assigned!");
        if (!this.balloonLayer) cc.error("Balloon layer not assigned!");
        if (!this.timerLabel) cc.error("Timer label not assigned!");
        if (!this.scoreLabel) cc.error("Score label not assigned!");
    }

    onDestroy() {
        if (this.networkManager && this.messageHandler) {
            this.networkManager.unregisterMessageHandler(this.messageHandler);
        }
    }

    update (dt: number) {
        if (this.isGameOver) return;

        this.timer -= dt;
        if (this.timerLabel) {
            this.timerLabel.string = `Time: ${Math.max(0, Math.ceil(this.timer))}`;
        }

        if (this.timer <= 0 && !this.isGameOver) {
            this.internalEndGame();
        }

        if (this.isMasterClient && !this.isGameOver) {
            this.timeSinceLastSpawn += dt;
            if (this.timeSinceLastSpawn >= this.balloonSpawnInterval) {
                this.timeSinceLastSpawn = 0;
                // Adjust spawn chance for variety
                if (Math.random() < 0.7) { // 70% chance to spawn a balloon this interval
                    this.internalSpawnBalloonRandomly();
                }
            }
        }
    }

    internalSpawnBalloonRandomly() {
        if (!this.balloonPrefab || !this.balloonLayer || !this.isMasterClient) return;

        const balloonNode = cc.instantiate(this.balloonPrefab);
        const balloonScript = balloonNode.getComponent(Balloon);
        if (!balloonScript) {
            cc.error("Balloon script not found on prefab!");
            balloonNode.destroy();
            return;
        }

        const gameWidth = this.balloonLayer.width;
        const gameHeight = this.balloonLayer.height; // Or cc.view.getVisibleSize().height

        // Spawn at bottom, random X
        const x = Math.random() * (gameWidth - balloonNode.width) - (gameWidth / 2) + (balloonNode.width / 2);
        const y = -gameHeight / 2 - balloonNode.height / 2; // Start just below the screen

        const balloonId = `b${this.myActorNr}_${this.nextBalloonId++}`;
        balloonScript.init(balloonId, cc.v2(x, y), gameWidth, gameHeight, this);
        
        this.balloonLayer.addChild(balloonNode);
        this.activeBalloons.set(balloonId, balloonScript);

        // Use a specific event code for balloon spawn if defined, otherwise use SEND_MESSAGE with a type
        const eventCodeToUse = PhotonEventCodes.MINIGAME_BALLOON_SPAWN || PhotonEventCodes.SEND_MESSAGE;
        this.networkManager.sendGameAction(eventCodeToUse, {
            type: eventCodeToUse === PhotonEventCodes.SEND_MESSAGE ? 'balloon_spawn' : undefined, // Add type if using generic SEND_MESSAGE
            id: balloonId,
            posX: x,
            posY: y,
            points: balloonScript.points,
            operation: balloonScript.operation,
            operationValue: balloonScript.operationValue,
            requiredKeyCode: balloonScript.requiredKeyCode,
            speed: balloonScript.speed
        });
    }

    handlePhotonEvent(eventCode: number, content: any, actorNr: number) {
        let messageType = content ? content.type : null;

        // If not using SEND_MESSAGE, the eventCode itself identifies the action
        if (eventCode === PhotonEventCodes.MINIGAME_BALLOON_SPAWN) messageType = 'balloon_spawn';
        else if (eventCode === PhotonEventCodes.MINIGAME_BALLOON_POP_ATTEMPT) messageType = 'balloon_pop_attempt';
        else if (eventCode === PhotonEventCodes.MINIGAME_BALLOON_POPPED_CONFIRMED) messageType = 'balloon_popped_confirmed';
        else if (eventCode === PhotonEventCodes.MINIGAME_BALLOON_GAME_OVER) messageType = 'game_over_sync';
        else if (eventCode === PhotonEventCodes.MINIGAME_BALLOON_SCORE_UPDATE) messageType = 'player_score_update';


        if (messageType) {
            switch (messageType) {
                case 'balloon_spawn':
                    if (!this.isMasterClient) {
                        this.internalSpawnBalloonFromNetwork(content);
                    }
                    break;
                case 'balloon_pop_attempt':
                    if (this.isMasterClient) {
                        this.masterHandleBalloonPop(content.balloonId, content.playerId);
                    }
                    break;
                case 'balloon_popped_confirmed':
                    this.clientHandleBalloonPopped(content.balloonId, content.playerId, content.scoreAwarded, content.updatedScores);
                    break;
                case 'game_over_sync':
                     if (!this.isMasterClient) {
                        this.isGameOver = true;
                        this.timer = 0; 
                        if(this.timerLabel) this.timerLabel.string = "Time: 0";
                        cc.log("[BalloonGameManager] Client received game over signal.");
                        if (content.finalScores) {
                            this.playerScores = content.finalScores;
                            this.internalShowFinalResults(); // Show results on client too
                        }
                    }
                    break;
                case 'player_score_update': // Could be used for periodic score sync if needed
                    if (!this.isMasterClient) {
                        const scoreData = content.scores as PlayerScore[];
                        if (scoreData) {
                            this.playerScores = scoreData;
                            this.internalUpdateScoreDisplay();
                        }
                    }
                    break;
            }
        }
    }

    internalSpawnBalloonFromNetwork(data: any) {
        if (!this.balloonPrefab || !this.balloonLayer || this.activeBalloons.has(data.id)) return;

        const balloonNode = cc.instantiate(this.balloonPrefab);
        const balloonScript = balloonNode.getComponent(Balloon);
        if (!balloonScript) {
            cc.error("Balloon script not found on prefab (network)!");
            balloonNode.destroy();
            return;
        }
        
        const gameWidth = this.balloonLayer.width;
        const gameHeight = this.balloonLayer.height;

        balloonScript.init(data.id, cc.v2(data.posX, data.posY), gameWidth, gameHeight, this);
        // Override random properties with synced ones
        balloonScript.points = data.points;
        balloonScript.operation = data.operation;
        balloonScript.operationValue = data.operationValue;
        balloonScript.requiredKeyCode = data.requiredKeyCode;
        balloonScript.speed = data.speed;
        balloonScript.updateDisplay(); // Crucial to show correct key icon and value

        this.balloonLayer.addChild(balloonNode);
        this.activeBalloons.set(data.id, balloonScript);
    }

    masterHandleBalloonPop(balloonId: string, playerId: number) {
        if (!this.isMasterClient || this.isGameOver) return;

        const balloon = this.activeBalloons.get(balloonId);
        if (balloon && balloon.isValid) { // Check if balloon still exists and is valid
            const scoreAwarded = balloon.getCalculatedScore();
            
            // Update score for the player
            const player = this.playerScores.find(p => p.actorNr === playerId);
            if (player) {
                player.score += scoreAwarded;
                cc.log(`[BalloonGameManager] Master: Player ${playerId} popped ${balloonId}, score +${scoreAwarded}, new total: ${player.score}`);
            }

            // Remove balloon
            balloon.pop(playerId); // Let balloon handle its own destruction animation etc.
            this.activeBalloons.delete(balloonId);

            // Broadcast that the balloon was popped and scores updated
            const eventCodeToUse = PhotonEventCodes.MINIGAME_BALLOON_POPPED_CONFIRMED || PhotonEventCodes.SEND_MESSAGE;
            this.networkManager.sendGameAction(eventCodeToUse, {
                type: eventCodeToUse === PhotonEventCodes.SEND_MESSAGE ? 'balloon_popped_confirmed' : undefined,
                balloonId: balloonId,
                playerId: playerId,
                scoreAwarded: scoreAwarded, // Send score for local display if needed
                updatedScores: this.playerScores // Send all scores for sync
            });
            
            this.internalUpdateScoreDisplay();
        }
    }

    clientHandleBalloonPopped(balloonId: string, playerId: number, scoreAwarded: number, updatedScores: PlayerScore[]) {
        const balloon = this.activeBalloons.get(balloonId);
        if (balloon && balloon.isValid) {
            balloon.remotePop(); // Or balloon.pop(playerId) if it handles remote vs local differently
            this.activeBalloons.delete(balloonId);
        }

        if (updatedScores) {
             this.playerScores = updatedScores;
        } else { // Fallback if full scores not sent, update individually (less ideal)
            if (!this.isMasterClient) {
                const player = this.playerScores.find(p => p.actorNr === playerId);
                if (player) {
                    player.score += scoreAwarded; // This might be redundant if full scores are synced
                }
            }
        }
        this.internalUpdateScoreDisplay();
    }
    
    public balloonMissed(balloonId: string) { // Make public if called from Balloon.ts
        if (this.activeBalloons.has(balloonId)) {
            this.activeBalloons.delete(balloonId);
            // cc.log(`[BalloonGameManager] Balloon ${balloonId} was missed.`);
        }
    }

    internalUpdateScoreDisplay() {
        // Display score for the local player
        const localPlayerScore = this.playerScores.find(p => p.actorNr === this.myActorNr);
        if (this.scoreLabel && localPlayerScore) {
            this.scoreLabel.string = `Score: ${localPlayerScore.score}`;
        } else if (this.scoreLabel) {
             this.scoreLabel.string = "Score: 0"; // Default if local player not found yet
        }
        // For debugging or a multi-score display:
        // console.log("Current Scores:", this.playerScores.map(p => `P${p.actorNr} (${p.name}): ${p.score}`).join(", "));
    }

    internalEndGame() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        cc.log("[BalloonGameManager] Game Over!");
        
        this.activeBalloons.forEach(balloon => { if (balloon.isValid) balloon.node.destroy(); });
        this.activeBalloons.clear();

        if (this.isMasterClient) {
            const eventCodeToUse = PhotonEventCodes.MINIGAME_BALLOON_GAME_OVER || PhotonEventCodes.SEND_MESSAGE;
            this.networkManager.sendGameAction(eventCodeToUse, {
                type: eventCodeToUse === PhotonEventCodes.SEND_MESSAGE ? 'game_over_sync' : undefined,
                finalScores: this.playerScores
            });
            this.internalShowFinalResults();
        } else {
             if (this.timerLabel) this.timerLabel.string = "GAME OVER";
        }
    }
    
    internalShowFinalResults() {
        let resultText = "Final Scores:\n";
        // Sort by score descending before displaying
        const sortedScores = [...this.playerScores].sort((a, b) => b.score - a.score);
        sortedScores.forEach(p => {
            resultText += `${p.name || 'Player ' + p.actorNr}: ${p.score}\n`;
        });
        cc.log(resultText); // Log for debugging

        if (this.scoreLabel) { 
            this.scoreLabel.string = resultText.replace(/\n/g, '\n'); 
        }
        if (this.timerLabel) this.timerLabel.string = "GAME OVER";

        // Example: Load a result scene after a delay
        // this.scheduleOnce(() => {
        // cc.director.loadScene('ResultScene'); // Pass scores to ResultScene if needed
        // }, 3);
    }

    public getIsGameOver(): boolean { // Make public for PlayerController
        return this.isGameOver;
    }
}

// Ensure PhotonEventCodes includes a general purpose code like SEND_MESSAGE
// and that your NetworkManager is set up to handle these custom message types.
// Example in PhotonEventCodes.ts:
// export enum PhotonEventCodes {
//     // ... other codes
//     SEND_MESSAGE = 200, // Or any unused number
//     CUSTOM_EVENT_CODE_201 = 201, // For Balloon Pop Attempt if SEND_MESSAGE is too generic
//     // ... other codes
// }
