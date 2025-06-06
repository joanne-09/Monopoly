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
            if (displayIndex < this.scoreLabels.length && this.scoreLabels[displayIndex]) {
                this.scoreLabels[displayIndex].string = `${player.name}: ${player.score}`;
            } else if (this.scoreLabels.length > 0) {
                // cc.warn(`[BalloonGameManager] Not enough score labels for player ${player.name}. Index ${displayIndex}, Labels ${this.scoreLabels.length}`);
            }
        });
        for (let i = this.playerScores.length; i < this.scoreLabels.length; i++) {
            if (this.scoreLabels[i]) this.scoreLabels[i].string = ""; // Clear unused labels
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
        if (this.isMasterClient) {
            this.networkManager.sendGameAction(PhotonEventCodes.MINIGAME_BALLOON_GAME_OVER, {
                finalScores: this.playerScores 
            });
            this.internalShowFinalResults();
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
            cc.warn(`[BalloonGameManager] balloonLayer width or height is 0! (width=${gameWidth}, height=${gameHeight}) - Balloons will not spawn correctly. Please set balloonLayer size in the editor to match your play area (e.g., 960x640). Using fallback values for now.`);
            gameWidth = 960;
            gameHeight = 640;
        }
        // Pick a random prefab for color
        let prefab: cc.Prefab = this.balloonPrefabs[Math.floor(Math.random() * this.balloonPrefabs.length)];
        // Create a temporary node to get balloon height
        const tempNode = cc.instantiate(prefab);
        let balloonHeight = tempNode.height * tempNode.scaleY;
        tempNode.destroy();
        const x = (Math.random() - 0.5) * gameWidth * 0.8;
        const y = -gameHeight / 2 + (balloonHeight / 2) + 10; // 10px margin
        const id = `b${Date.now()}_${this.nextBalloonIdSuffix++}`;
        // --- Operation logic ---
        // Decide operation type: add/subtract or multiply/divide
        let opType = Math.random() < 0.5 ? 'addsub' : 'muldiv';
        let op: BalloonOperation;
        let opValue: number;
        if (opType === 'addsub') {
            // Add/Subtract: +10, -10, +20, -20, +50, -50, or ?
            const addSubOptions = [10, -10, 20, -20, 50, -50, '?'];
            let pick = addSubOptions[Math.floor(Math.random() * addSubOptions.length)];
            if (pick === '?') {
                // Random value: -100~-20 or +20~+100
                if (Math.random() < 0.5) {
                    opValue = -Math.floor(Math.random() * 81 + 20); // -20 to -100
                } else {
                    opValue = Math.floor(Math.random() * 81 + 20); // +20 to +100
                }
            } else {
                opValue = pick as number;
            }
            op = opValue > 0 ? BalloonOperation.ADD : BalloonOperation.SUBTRACT;
        } else {
            // Multiply/Divide: *2, /2, *5, /5
            const mulDivOptions = [2, 0.5, 5, 0.2];
            let pick = mulDivOptions[Math.floor(Math.random() * mulDivOptions.length)];
            if (pick === 2 || pick === 5) {
                op = BalloonOperation.MULTIPLY;
                opValue = pick;
            } else {
                op = BalloonOperation.DIVIDE;
                opValue = pick === 0.5 ? 2 : 5; // /2 or /5
            }
        }
        const points = 0; // You can set points logic as needed
        // --- INCREASE SPEED RANGE ---
        const speed = 200 + Math.random() * 200; // 200~400 px/sec
        cc.log(`[BalloonGameManager] Spawning balloon id=${id} at x=${x.toFixed(1)}, y=${y.toFixed(1)}, op=${op}, opValue=${opValue}, speed=${speed.toFixed(1)}`);
        this.networkManager.sendGameAction(PhotonEventCodes.MINIGAME_BALLOON_SPAWN, {
            id, x, y, points, operation: op, operationValue: opValue, speed,
            prefabIndex: this.balloonPrefabs.indexOf(prefab)
        });
        this.spawnBalloon(id, x, y, points, op, opValue, speed, prefab);
        // --- DECREASE SPAWN INTERVAL FOR MORE BALLOONS ---
        this.balloonSpawnInterval = 0.25 + Math.random() * 0.25; // 0.25~0.5s
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
        const scoreAwarded = balloon.getCalculatedScore();
        balloon.pop(playerId);
        this.activeBalloons.delete(balloonId);
        if (balloon.node && cc.isValid(balloon.node)) balloon.node.destroy();
        // Update score
        const player = this.playerScores.find(p => p.actorNr === playerId);
        let newScore = player ? player.score + scoreAwarded : scoreAwarded;
        if (player) player.score = newScore;
        // Broadcast pop confirmation
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
