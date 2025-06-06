// filepath: c:\Monopoly Game\Monopoly\assets\scripts\MiniGameBalloon\BalloonGameManager.ts
const {ccclass, property} = cc._decorator;
import Balloon, { BalloonKeyCode, BalloonOperation } from "./Balloon";
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

    @property(cc.Prefab)
    balloonPrefab: cc.Prefab = null;

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

        if (!this.balloonPrefab) cc.error("[BalloonGameManager] Balloon prefab not assigned!");
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
                        localPlayerControllerScript.setCursorNode(targetCursorNode); // Assign specific cursor to local controller
                        targetCursorNode.active = true;
                        cc.log(`[BalloonGameManager] Assigned and activated cursor for local player ${this.myActorNr} (index ${cursorIndex})`);
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
                if (Math.random() < 0.8) { // Chance to spawn
                    this.internalSpawnBalloonRandomly();
                }
            }
        }
    }

    internalSpawnBalloonRandomly() {
        if (!this.isMasterClient || !this.balloonPrefab || !this.balloonLayer) return;

        const balloonNode = cc.instantiate(this.balloonPrefab);
        if (!balloonNode) { cc.error("Failed to instantiate balloon prefab."); return; }
        
        const balloonScript = balloonNode.getComponent(Balloon);
        if (!balloonScript) {
            cc.error("Balloon script not found on prefab instance!");
            balloonNode.destroy(); return;
        }

        const gameWidth = this.balloonLayer.width;
        const gameHeight = this.balloonLayer.height;
        const balloonWidth = balloonNode.width * balloonNode.scaleX;
        const balloonHeight = balloonNode.height * balloonNode.scaleY;
        
        const x = Math.random() * (gameWidth - balloonWidth) - (gameWidth / 2) + (balloonWidth / 2);
        const y = -gameHeight / 2 - balloonHeight; // Start below screen

        const pointsValues = [10, 15, 20, 25, 30, -5, -10]; // Added negative point balloons
        const points = pointsValues[Math.floor(Math.random() * pointsValues.length)];

        const operations = [BalloonOperation.NONE, BalloonOperation.ADD, BalloonOperation.SUBTRACT, BalloonOperation.MULTIPLY];
        let operation = operations[Math.floor(Math.random() * operations.length)];
        
        let operationValue = 0;
        if (operation !== BalloonOperation.NONE) {
            if (operation === BalloonOperation.ADD || operation === BalloonOperation.SUBTRACT) {
                operationValue = (Math.floor(Math.random() * 6) + 1) * 5; // 5, 10, 15, 20, 25, 30
            } else if (operation === BalloonOperation.MULTIPLY) {
                operationValue = Math.random() < 0.7 ? 2 : 1; // Mostly x2, sometimes x1 (effectively no change)
            }
        }
        // Ensure multiply isn't used with negative base points to avoid large negative swings easily
        if (points < 0 && operation === BalloonOperation.MULTIPLY) {
            operation = BalloonOperation.NONE; 
        }


        const keyCodes = [BalloonKeyCode.UP, BalloonKeyCode.DOWN, BalloonKeyCode.LEFT, BalloonKeyCode.RIGHT];
        const requiredKeyCode = keyCodes[Math.floor(Math.random() * keyCodes.length)];
        
        const speed = 60 + Math.random() * 90; // Random speed 60-150

        const balloonId = `b${this.myActorNr}_${this.nextBalloonIdSuffix++}`;

        balloonScript.init(balloonId, cc.v2(x, y), gameWidth, gameHeight, this, points, operation, operationValue, requiredKeyCode, speed);
        
        this.balloonLayer.addChild(balloonNode);
        this.activeBalloons.set(balloonId, balloonScript);

        this.networkManager.sendGameAction(PhotonEventCodes.MINIGAME_BALLOON_SPAWN, {
            id: balloonId, posX: x, posY: y,
            points: points, operation: operation, operationValue: operationValue,
            requiredKeyCode: requiredKeyCode, speed: speed
        });
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
                    this.masterHandleBalloonPop(content.balloonId, content.playerId, content.keyCodeAttempted);
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
            // MINIGAME_BALLOON_SCORE_UPDATE might be redundant if POPPED_CONFIRMED handles it.
            // Could be used for periodic sync if needed.
            case PhotonEventCodes.MINIGAME_BALLOON_CURSOR_MOVE:
                if (actorNr !== this.myActorNr) {
                    this.updateRemoteCursor(actorNr, content.position);
                }
                break;
        }
    }
    
    updateRemoteCursor(actorNr: number, position: {x: number, y: number}) {
        const cursorNode = this.remoteCursors.get(actorNr);
        if (cursorNode) {
            if (!cursorNode.activeInHierarchy) cursorNode.active = true;
            // Assuming position is in the same world coordinate system.
            // If BalloonPlayerController sends local position to parent, convert it here if necessary.
            // For now, assume it's correct for direct application.
            cursorNode.setPosition(position.x, position.y);
        }
    }

    internalSpawnBalloonFromNetwork(data: any) {
        if (this.activeBalloons.has(data.id) || !this.balloonPrefab || !this.balloonLayer) return;

        const balloonNode = cc.instantiate(this.balloonPrefab);
        if (!balloonNode) { cc.error("Client: Failed to instantiate balloon prefab from network."); return; }
        const balloonScript = balloonNode.getComponent(Balloon);
        if (!balloonScript) {
            cc.error("Client: Balloon script not found on prefab (network)!");
            balloonNode.destroy(); return;
        }
        
        balloonScript.init(data.id, cc.v2(data.posX, data.posY), 
                           this.balloonLayer.width, this.balloonLayer.height, this,
                           data.points, data.operation, data.operationValue, 
                           data.requiredKeyCode, data.speed);
        
        this.balloonLayer.addChild(balloonNode);
        this.activeBalloons.set(data.id, balloonScript);
    }

    masterHandleBalloonPop(balloonId: string, playerId: number, keyCodeAttempted: BalloonKeyCode) {
        if (!this.isMasterClient || this.isGameOver) return;

        const balloon = this.activeBalloons.get(balloonId);
        if (balloon && balloon.isValid && !balloon.isPopped) { 
            if (balloon.requiredKeyCode === keyCodeAttempted) {
                const scoreAwarded = balloon.getCalculatedScore();
                const player = this.playerScores.find(p => p.actorNr === playerId);
                
                if (player) {
                    player.score += scoreAwarded;
                    player.score = Math.max(0, player.score); // Ensure score doesn't drop below 0

                    cc.log(`[BalloonGameManager] Master: Player ${playerId} popped ${balloonId}. Score: +${scoreAwarded}, NewTotal: ${player.score}`);

                    this.networkManager.sendGameAction(PhotonEventCodes.MINIGAME_BALLOON_POPPED_CONFIRMED, {
                        balloonId: balloonId,
                        playerId: playerId,
                        scoreAwarded: scoreAwarded,
                        newScoreTotal: player.score,
                        balloonDestroyed: true 
                    });

                    balloon.pop(playerId); // Mark as popped, play master-side effects if any
                    this.activeBalloons.delete(balloonId);
                    if (balloon.node && cc.isValid(balloon.node)) balloon.node.destroy(); // Master destroys the authoritative object
                    
                    this.internalUpdateScoreDisplay();
                }
            } else {
                 // cc.log(`[BalloonGameManager] Master: Player ${playerId} wrong key for ${balloonId}.`);
                 // Optionally send a "failed attempt" feedback if desired
            }
        }
    }

    clientHandleBalloonPopped(balloonId: string, playerId: number, scoreAwarded: number, newPlayerScoreTotal: number, balloonDestroyed: boolean) {
        const balloon = this.activeBalloons.get(balloonId);
        if (balloon && balloon.isValid && !balloon.isPopped && balloonDestroyed) {
            // cc.log(`[BalloonGameManager] Client: Balloon ${balloonId} popped by ${playerId}.`);
            balloon.remotePop(); // Play effects, mark as popped
            this.activeBalloons.delete(balloonId);
            if (balloon.node && cc.isValid(balloon.node)) balloon.node.destroy();
        }

        const player = this.playerScores.find(p => p.actorNr === playerId);
        if (player) {
            player.score = newPlayerScoreTotal;
        } else {
            // Potentially a new player joined and master sent an update for them
            // Or a slight de-sync. For now, log it.
            // cc.warn(`[BalloonGameManager] Client: Score update for unknown player ${playerId}.`);
        }
        this.internalUpdateScoreDisplay();
    }
    
    public reportBalloonDespawned(balloonId: string) {
        const balloon = this.activeBalloons.get(balloonId);
        if (balloon) {
            this.activeBalloons.delete(balloonId);
            if (balloon.node && cc.isValid(balloon.node)) {
                 // cc.log(`[BalloonGameManager] Balloon ${balloonId} despawned, destroying node.`);
                balloon.node.destroy();
            }
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
        // Disable local player input
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
    
    public getBalloonByNode(node: cc.Node): Balloon | null {
        let foundBalloon: Balloon = null;
        this.activeBalloons.forEach(balloon => {
            if (balloon.node === node) {
                foundBalloon = balloon;
            }
        });
        return foundBalloon;
    }
    
    public getActiveBalloons(): Map<string, Balloon> { // Used by PlayerController to find hovered balloon
        return this.activeBalloons;
    }

    public getMyActorNumber(): number { return this.myActorNr; }
    public getIsGameOver(): boolean { return this.isGameOver; }
    public getBalloonLayer(): cc.Node { return this.balloonLayer; }
}
