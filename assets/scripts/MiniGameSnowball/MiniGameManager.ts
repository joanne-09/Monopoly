// GameManager.ts
// 管理雪球小遊戲的主要規則與流程
const { ccclass, property } = cc._decorator;

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

    onLoad() {
        this.timer = this.gameTime;
        // TODO: 初始化玩家、分隊
    }

    update(dt: number) {
        if (this.isGameOver) return;
        this.timer -= dt;
        if (this.timerLabel) {
            this.timerLabel.string = `Time: ${Math.ceil(this.timer)}`;
        }
        if (this.timer <= 0) {
            this.endGame();
        }
    }

    addScore(team: 'A' | 'B', score: number) {
        if (team === 'A') {
            this.teamAScore += score;
            if (this.scoreLabelA) this.scoreLabelA.string = `${this.teamAScore}`;
        } else {
            this.teamBScore += score;
            if (this.scoreLabelB) this.scoreLabelB.string = `${this.teamBScore}`;
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
