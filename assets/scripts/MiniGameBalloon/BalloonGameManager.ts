// filepath: c:\Monopoly Game\Monopoly\assets\scripts\MiniGameBalloon\BalloonGameManager.ts
const {ccclass, property} = cc._decorator;
import Balloon, { BalloonOperation } from "./Balloon";
import NetworkManager from "../NetworkManager";
import { PhotonEventCodes } from "../types/PhotonEventCodes";
import BalloonPlayerController from "./BalloonPlayerController"; // Import for type hinting

interface PlayerScore {
    actorNr: number;
    score: number;
    name: string;
}

@ccclass
export default class BalloonGameManager extends cc.Component {

    @property([cc.Prefab])
    balloonPrefabs: cc.Prefab[] = [];

    @property(cc.Node)
    balloonLayer: cc.Node = null;

    @property(cc.Label)
    timerLabel: cc.Label = null;

    @property([cc.Label])
    scoreLabels: cc.Label[] = [];

    @property([cc.Node]) // Assign one cursor node for each potential player (e.g., 4 cursors)
    playerCursors: cc.Node[] = [];

    @property(cc.Node) // Assign the node that has the BalloonPlayerController for the local player
    localPlayerControllerNode: cc.Node = null;

    @property
    gameTime: number = 60; // seconds

    private timer: number = 0;
    private isGameOver: boolean = false;
    private networkManager: NetworkManager = null;
    private isMasterClient: boolean = false;
    private myActorNr: number = -1;

    private playerScores: PlayerScore[] = [];
    private activeBalloons: Map<string, Balloon> = new Map();
    private remoteCursors: Map<number, cc.Node> = new Map(); // actorNr -> cursorNode

    private balloonSpawnInterval: number = 0.75; // seconds
    private timeSinceLastSpawn: number = 0;
    private nextBalloonIdSuffix: number = 0; // Used to create unique balloon IDs

    // Player names can be predefined or fetched if your system supports it
    private playerNames: string[] = [null, "P1", "P2", "P3", "P4"]; // 1-indexed, adjust as needed

    private messageHandler: (eventCode: number, content: any, actorNr: number) => void;

    onLoad () {
        this.networkManager = NetworkManager.getInstance();
        const photonClient = this.networkManager?.getPhotonClient();

        if (!this.networkManager || !photonClient) {
            cc.error("[BalloonGameManager] NetworkManager or PhotonClient not available! Game cannot start.");
            this.isGameOver = true;
            this.node.active = false; // Disable component if network is not up
            return;
        }

        this.myActorNr = this.networkManager.getMyActorNumber();
        this.isMasterClient = photonClient.isJoinedToRoom() ? (this.myActorNr === photonClient.myRoom().masterClientId) : false;
        
        if (!photonClient.isJoinedToRoom()) {
            cc.warn("[BalloonGameManager] Not joined to a room. isMasterClient defaults to false. Game might not function correctly for multiplayer.");
        }
        
        this.timer = this.gameTime;
        this.playerScores = [];

        if (photonClient.isJoinedToRoom()) {
            const actorsInRoom = photonClient.myRoomActors();
            for (const actorNrStr in actorsInRoom) {
                const actor = actorsInRoom[actorNrStr];
                const actorNumber = parseInt(actorNrStr, 10);
                if (actor && actorNumber > 0) {
                    let playerName = (actorNumber < this.playerNames.length && this.playerNames[actorNumber])
                                       ? this.playerNames[actorNumber]
                                       : (actor.name || `Player ${actorNumber}`);
                    
                    // Ensure unique name if somehow playerNames has duplicates or actor.name is generic
                    let existingPlayerWithName = this.playerScores.find(p => p.name === playerName);
                    if (existingPlayerWithName && existingPlayerWithName.actorNr !== actorNumber) {
                        playerName = `${playerName}_${actorNumber}`;
                    }

                    this.playerScores.push({ actorNr: actorNumber, score: 0, name: playerName });
                }
            }
        } else {
             cc.warn("[BalloonGameManager] Not in a room. Player scores will be initialized minimally.");
        }
        
        // Ensure local player is in the list
        if (this.myActorNr > 0 && !this.playerScores.find(p => p.actorNr === this.myActorNr)) {
            const myName = (this.myActorNr < this.playerNames.length && this.playerNames[this.myActorNr])
                            ? this.playerNames[this.myActorNr]
                            : `Player ${this.myActorNr}`;
            this.playerScores.push({ actorNr: this.myActorNr, score: 0, name: myName });
            cc.log(`[BalloonGameManager] Added local player (actorNr: ${this.myActorNr}, name: ${myName}) to scores.`);
        }
        
        this.playerScores.sort((a, b) => a.actorNr - b.actorNr); // Consistent order

        this.internalUpdateScoreDisplay();
        this.initializeCursors();

        this.messageHandler = this.handlePhotonEvent.bind(this);
        this.networkManager.registerMessageHandler(this.messageHandler);

        if (!this.balloonPrefabs || this.balloonPrefabs.length === 0) cc.error("[BalloonGameManager] Balloon prefabs not assigned!");
        if (!this.balloonLayer) cc.error("[BalloonGameManager] Balloon layer not assigned!");
        if (!this.timerLabel) cc.error("[BalloonGameManager] Timer label not assigned!");
        if (this.scoreLabels.length === 0) cc.warn("[BalloonGameManager] Score labels array is empty!");
        if (this.playerCursors.length === 0) cc.warn("[BalloonGameManager] Player cursors array is empty!");
        if (!this.localPlayerControllerNode) cc.warn("[BalloonGameManager] LocalPlayerControllerNode not assigned!");
    }

    initializeCursors() {
        if (!this.localPlayerControllerNode) {
            cc.warn("[BalloonGameManager] LocalPlayerControllerNode not set.");
        }
        
        const localPlayerControllerScript = this.localPlayerControllerNode?.getComponent(BalloonPlayerController);

        this.playerCursors.forEach(cursorNode => { if (cursorNode) cursorNode.active = false; });
        
        this.playerScores.forEach(player => {
            // Player actorNr is 1-indexed. Cursors array is 0-indexed.
            // We need a mapping strategy. If playerCursors are meant to correspond to actorNr 1, 2, 3, 4
            // then playerCursors[0] is for actorNr 1, playerCursors[1] for actorNr 2 etc.
            const cursorIndex = player.actorNr - 1; 

            if (cursorIndex >= 0 && cursorIndex < this.playerCursors.length && this.playerCursors[cursorIndex]) {
                const targetCursorNode = this.playerCursors[cursorIndex];
                if (player.actorNr === this.myActorNr) {
                    if (localPlayerControllerScript) {
                        // localPlayerControllerScript.setCursorNode(targetCursorNode); // Old incorrect call
                        localPlayerControllerScript.initialize(this, targetCursorNode); // Correct call to initialize
                        targetCursorNode.active = true;
                        cc.log(`[BalloonGameManager] Initialized and activated cursor for local player ${this.myActorNr} (controller: ${localPlayerControllerScript.node.name}, cursor: ${targetCursorNode.name}, index ${cursorIndex})`);
                    } else {
                         cc.warn(`[BalloonGameManager] Local player controller script not found for actorNr ${this.myActorNr}. Cannot assign its cursor.`);
                         targetCursorNode.active = true; // Activate directly as a fallback
                    }
                } else {
                    this.remoteCursors.set(player.actorNr, targetCursorNode);
                    // Remote cursors are initially hidden, activated on first CURSOR_MOVE event.
                    targetCursorNode.active = false; 
                    cc.log(`[BalloonGameManager] Mapped remote cursor for player ${player.actorNr} (index ${cursorIndex})`);
                }
            } else {
                cc.warn(`[BalloonGameManager] No cursor node in playerCursors for actorNr ${player.actorNr} (expected index ${cursorIndex}). Total cursors: ${this.playerCursors.length}`);
            }
        });
    }
    
    internalUpdateScoreDisplay() {
        this.playerScores.forEach((player, displayIndex) => {
            // Assuming scoreLabels are ordered to match sorted playerScores (by actorNr)
            // and that scoreLabels are assigned in the editor for P1, P2, etc.
            if (displayIndex < this.scoreLabels.length && this.scoreLabels[displayIndex]) {
                this.scoreLabels[displayIndex].string = player.score.toString(); // Display only the score
            } else if (this.scoreLabels.length > 0) {
                // This case might indicate a mismatch or fewer labels than players.
                // For simplicity, we'll only update if a direct match exists.
                // cc.warn(`[BalloonGameManager] Mismatch in player count and score labels. Player ${player.name} (actorNr ${player.actorNr}) at displayIndex ${displayIndex} has no label.`);
            }
        });

        // Clear any extra score labels if players leave or there are more labels than players
        for (let i = this.playerScores.length; i < this.scoreLabels.length; i++) {
            if (this.scoreLabels[i]) {
                this.scoreLabels[i].string = ""; // Clear unused labels
            }
        }
    }

    onDestroy() {
        if (this.networkManager && this.messageHandler) {
            this.networkManager.unregisterMessageHandler(this.messageHandler);
        }
        this.activeBalloons.forEach(balloon => {
            if (balloon && balloon.node && cc.isValid(balloon.node)) {
                balloon.node.destroy();
            }
        });
        this.activeBalloons.clear();
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
                if (Math.random() < 0.8) {
                    this.internalSpawnBalloonRandomly();
                }
            }
        }
    }

    handlePhotonEvent(eventCode: number, content: any, actorNr: number) {
        switch (eventCode) {
            case PhotonEventCodes.MINIGAME_BALLOON_SPAWN:
                if (!this.isMasterClient) {
                    this.internalSpawnBalloonFromNetwork(content);
                }
                break;
            case PhotonEventCodes.MINIGAME_BALLOON_POP_ATTEMPT:
                if (this.isMasterClient) {
                    this.masterHandleBalloonPop(content.balloonId, content.playerId);
                }
                break;
            case PhotonEventCodes.MINIGAME_BALLOON_POPPED_CONFIRMED:
                this.clientHandleBalloonPopped(content.balloonId, content.playerId, content.scoreAwarded, content.newScoreTotal, content.balloonDestroyed);
                break;
            case PhotonEventCodes.MINIGAME_BALLOON_GAME_OVER:
                 if (!this.isMasterClient) {
                    this.isGameOver = true; this.timer = 0; 
                    if(this.timerLabel) this.timerLabel.string = "Time: 0";
                    cc.log("[BalloonGameManager] Client received game over.");
                    if (content.finalScores) {
                        this.playerScores = content.finalScores;
                        this.internalUpdateScoreDisplay();
                        this.internalShowFinalResults();
                    }
                }
                break;
            case PhotonEventCodes.MINIGAME_BALLOON_CURSOR_MOVE:
                if (actorNr !== this.myActorNr) {
                    this.updateRemoteCursor(actorNr, content.position);
                }
                break;
        }
    }

    internalEndGame() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.timer = 0;
        if(this.timerLabel) this.timerLabel.string = "Time: 0";
        cc.log("[BalloonGameManager] Game Over!");
        this.activeBalloons.forEach(b => { if(b.node && cc.isValid(b.node)) b.node.destroy(); });
        this.activeBalloons.clear();
        // --- Custom: After 0.5s, award money by rank, then return to MapScene ---
        this.scheduleOnce(() => {
            // Sort by score descending
            const sorted = [...this.playerScores].sort((a, b) => b.score - a.score);
            // Award: 1st 200, 2nd 100, 3rd 50, 4th 20
            const rewards = [200, 100, 50, 20];
            let gameManager = null;
            try {
                gameManager = (window as any).GameManager?.getInstance?.() || null;
            } catch (e) {}
            if (!gameManager) {
                const gameManagerNode = cc.director.getScene().getChildByName("GameManager");
                if (gameManagerNode) {
                    gameManager = gameManagerNode.getComponent("GameManager");
                }
            }
            if (gameManager && typeof gameManager.deductMoneyFromLocalPlayer === 'function') {
                // Find local player rank
                const myActorNr = this.myActorNr;
                const myRank = sorted.findIndex(p => p.actorNr === myActorNr);
                if (myRank >= 0 && myRank < rewards.length) {
                    const reward = rewards[myRank];
                    if (reward > 0) {
                        gameManager.deductMoneyFromLocalPlayer(-reward); // Negative means add money
                    }
                }
            } else {
                cc.warn("[BalloonGameManager] GameManager not found or deductMoneyFromLocalPlayer missing.");
            }
            this.internalShowFinalResults();
            // --- Return to MapScene ---
            cc.director.loadScene("MapScene");
        }, 0.5);
        if (this.isMasterClient) {
            this.networkManager.sendGameAction(PhotonEventCodes.MINIGAME_BALLOON_GAME_OVER, {
                finalScores: this.playerScores 
            });
        }
        const localController = this.localPlayerControllerNode?.getComponent(BalloonPlayerController);
        if (localController) {
            localController.disableInput();
        }
    }

    internalShowFinalResults() {
        this.playerScores.sort((a, b) => b.score - a.score); 
        let resultsText = "Final Scores:\n";
        this.playerScores.forEach(p => { resultsText += `${p.name}: ${p.score}\n`; });
        cc.log(resultsText);
        // Display this on a UI panel
    }

    clientHandleBalloonPopped(balloonId: string, playerId: number, scoreAwarded: number, newPlayerScoreTotal: number, balloonDestroyed: boolean) {
        const balloon = this.activeBalloons.get(balloonId);
        if (balloon && balloon.isValid && !balloon.isPopped && balloonDestroyed) {
            balloon.remotePop();
            this.activeBalloons.delete(balloonId);
            if (balloon.node && cc.isValid(balloon.node)) balloon.node.destroy();
        }
        const player = this.playerScores.find(p => p.actorNr === playerId);
        if (player) {
            player.score = newPlayerScoreTotal;
        }
        this.internalUpdateScoreDisplay();
    }

    // --- Add missing methods and stubs below ---

    /**
     * Master client: spawn a balloon at a random position and broadcast to all clients.
     */
    internalSpawnBalloonRandomly() {
        if (!this.balloonPrefabs || this.balloonPrefabs.length === 0) return;

        let gameWidth = this.balloonLayer.width;
        let gameHeight = this.balloonLayer.height;

        if (gameWidth === 0 || gameHeight === 0) {
            cc.warn("[BalloonGameManager] balloonLayer dimensions are zero. Using default spawn area.");
            gameWidth = cc.winSize.width;
            gameHeight = cc.winSize.height;
        }

        let prefab: cc.Prefab = this.balloonPrefabs[Math.floor(Math.random() * this.balloonPrefabs.length)];
        const tempNode = cc.instantiate(prefab);
        let balloonHeight = tempNode.height * tempNode.scaleY;
        tempNode.destroy();

        const x = (Math.random() - 0.5) * gameWidth * 0.8;
        const y = -gameHeight / 2 - (balloonHeight / 2) - 10;
        const id = `b${Date.now()}_${this.nextBalloonIdSuffix++}`;

        let points = 0;
        let opType = Math.random() < 0.7 ? 'addsub' : 'muldiv';
        let op: BalloonOperation;
        let opValue: number;
        if (opType === 'addsub') {
            const addSubValues = [10, -10, 20, -20, 50, -50];
            let chosenVal = addSubValues[Math.floor(Math.random() * addSubValues.length)];
            if (chosenVal >= 0) {
                op = BalloonOperation.ADD;
                opValue = chosenVal;
            } else {
                op = BalloonOperation.SUBTRACT;
                opValue = Math.abs(chosenVal);
            }
        } else { // muldiv
            op = BalloonOperation.MULTIPLY;
            opValue = 2; // Only *2 allowed
        }
        
        const speed = 200 + Math.random() * 200;

        cc.log(`[BalloonGameManager] Spawning balloon id=${id}, op=${BalloonOperation[op]}(${op}), opValue=${opValue}, speed=${speed.toFixed(1)}`);

        this.networkManager.sendGameAction(PhotonEventCodes.MINIGAME_BALLOON_SPAWN, {
            id, x, y, points, operation: op, operationValue: opValue, speed,
            prefabIndex: this.balloonPrefabs.indexOf(prefab)
        });

        this.spawnBalloon(id, x, y, points, op, opValue, speed, prefab);
        this.balloonSpawnInterval = 0.25 + Math.random() * 0.25;
    }

    /**
     * All clients: spawn a balloon from network event.
     */
    internalSpawnBalloonFromNetwork(data: any) {
        let prefab = this.balloonPrefabs && typeof data.prefabIndex === 'number' && data.prefabIndex >= 0 ? this.balloonPrefabs[data.prefabIndex] : this.balloonPrefabs[0];
        this.spawnBalloon(data.id, data.x, data.y, data.points, data.operation, data.operationValue, data.speed, prefab);
    }

    /**
     * Shared spawn logic.
     */
    private spawnBalloon(id: string, x: number, y: number, points: number, operation: BalloonOperation, operationValue: number, speed: number, prefabOverride?: cc.Prefab) {
        if (!this.balloonPrefabs || this.balloonPrefabs.length === 0) return;
        const prefab = prefabOverride || this.balloonPrefabs[0];
        const node = cc.instantiate(prefab);
        this.balloonLayer.addChild(node);
        const balloon = node.getComponent(Balloon);
        if (balloon) {
            balloon.init(id, cc.v2(x, y), this.balloonLayer.width, this.balloonLayer.height, this, points, operation, operationValue, speed);
            this.activeBalloons.set(id, balloon);
            cc.log(`[BalloonGameManager] Balloon ${id} spawned and added to activeBalloons. Total: ${this.activeBalloons.size}`);
        }
    }

    /**
     * Master client: handle pop attempt from a player.
     */
    masterHandleBalloonPop(balloonId: string, playerId: number) {
        const balloon = this.activeBalloons.get(balloonId);
        if (!balloon || balloon.isPopped) return;

        const player = this.playerScores.find(p => p.actorNr === playerId);
        if (!player) {
            cc.warn(`[BalloonGameManager] Player ${playerId} not found for score update.`);
            if (balloon.node && cc.isValid(balloon.node)) balloon.node.destroy();
            this.activeBalloons.delete(balloonId);
            this.networkManager.sendGameAction(PhotonEventCodes.MINIGAME_BALLOON_POPPED_CONFIRMED, {
                balloonId,
                playerId,
                scoreAwarded: 0,
                newScoreTotal: 0,
                balloonDestroyed: true
            });
            return;
        }

        let scoreAwarded = 0;
        let newScore = player.score;

        if (balloon.operation === BalloonOperation.ADD || balloon.operation === BalloonOperation.SUBTRACT) {
            scoreAwarded = balloon.getCalculatedScore();
            newScore = player.score + scoreAwarded;
        } else if (balloon.operation === BalloonOperation.MULTIPLY) {
            // Only *2 allowed
            let tempScore = player.score * 2;
            newScore = Math.max(0, tempScore);
            scoreAwarded = newScore - player.score;
        }
        // Prevent negative scores
        newScore = Math.max(0, newScore);
        balloon.pop(playerId);
        this.activeBalloons.delete(balloonId);
        if (balloon.node && cc.isValid(balloon.node)) balloon.node.destroy();
        
        player.score = newScore;
        
        this.networkManager.sendGameAction(PhotonEventCodes.MINIGAME_BALLOON_POPPED_CONFIRMED, {
            balloonId,
            playerId,
            scoreAwarded,
            newScoreTotal: newScore,
            balloonDestroyed: true
        });
        this.internalUpdateScoreDisplay();
    }

    /**
     * Update a remote player's cursor position.
     */
    updateRemoteCursor(actorNr: number, position: { x: number, y: number }) {
        const cursor = this.remoteCursors.get(actorNr);
        if (cursor) {
            cursor.setPosition(position.x, position.y);
            cursor.active = true;
        }
    }

    /**
     * Get all active balloons (for BalloonPlayerController).
     */
    getActiveBalloons(): Map<string, Balloon> {
        return this.activeBalloons;
    }

    /**
     * Get the balloon layer node (for BalloonPlayerController).
     */
    getBalloonLayer(): cc.Node {
        return this.balloonLayer;
    }

    /**
     * Get game over state (for BalloonPlayerController).
     */
    getIsGameOver(): boolean {
        return this.isGameOver;
    }

    /**
     * Called by Balloon when it despawns (floats off screen).
     */
    reportBalloonDespawned(balloonId: string) {
        const balloon = this.activeBalloons.get(balloonId);
        if (balloon) {
            this.activeBalloons.delete(balloonId);
            if (balloon.node && cc.isValid(balloon.node)) balloon.node.destroy();
            cc.log(`[BalloonGameManager] Balloon ${balloonId} despawned and destroyed. Remaining: ${this.activeBalloons.size}`);
        }
    }
}
