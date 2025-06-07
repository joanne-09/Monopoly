import { PlayerAvatar, PlayerData } from "./types/DataTypes";
const {ccclass, property} = cc._decorator;
import GameManager  from "./GameManager";

@ccclass
export default class ResultScene extends cc.Component {

    @property(cc.Node)
    titleNode: cc.Node = null;
    @property(cc.Node)
    listNode: cc.Node = null;
    @property(cc.Node)
    buttonNode: cc.Node = null;
    @property(cc.Scene)
    nextScene: cc.Scene = null;
    @property([cc.AnimationClip])
    avatarAnimation: cc.AnimationClip[] = [];

    // LIFE-CYCLE CALLBACKS:
    private listItem: cc.Node[] = [];
    private playerNumber: number = 4; // Assuming 4 players for the result scene
    private playerData: PlayerData[] = []; 
    private playerScores: number[] = [];
    private gameManager: GameManager = null;
    onLoad () {
      for(let i=0; i<this.playerNumber; i++) {
        this.listItem[i] = this.listNode.getChildByName(`listItem${i+1}`) as cc.Node;
      }
      
      this.gameManager = GameManager.getInstance();
    }

    start () {
      // Calculate scores based on stars and money
      this.playerNumber = this.gameManager.getPlayerList().length;
       this.gameManager.getPlayerList().forEach((playerData: PlayerData) => {
        this.playerData.push({
          actorNumber: playerData.actorNumber, 
          name: playerData.name, 
          avatar: playerData.avatar, 
          stars: playerData.stars || 0,
          money: playerData.money || 0
        });
        cc.log("================================================")
        cc.log({
          actorNumber: playerData.actorNumber, 
          name: playerData.name, 
          avatar: playerData.avatar, 
          stars: playerData.stars, 
          money: playerData.money
        });
      });
      this.playerScores = this.playerData.map(player => 
        (player.stars || 0) * 1000 + (player.money || 0)
      );

 /*     // give a testcase of 4 sets of playerData and playerScores
      this.playerData = [
        { actorNumber: 0, name: "Alice", avatar: PlayerAvatar.GRASS },
        { actorNumber: 1, name: "Bob", avatar: PlayerAvatar.GRASS },
        { actorNumber: 2, name: "Charlie", avatar: PlayerAvatar.ICE },
        { actorNumber: 3, name: "Diana", avatar: PlayerAvatar.FIRE }
      ];
      this.playerScores = [700, 1800, 2000, 900];*/
      // Sort the playerData and playerScores based on calculated scores in descending order
      let sortedIndices = this.playerScores.map((score, index) => index)
        .sort((a, b) => this.playerScores[b] - this.playerScores[a]);
      this.playerData = sortedIndices.map(index => this.playerData[index]);
      this.playerScores = sortedIndices.map(index => this.playerScores[index]);

      // Initialize
      this.titleNode.opacity = 0;
      for(let i=0; i<this.playerNumber; i++) {
        let medal = this.listItem[i].getChildByName('Medal');
        let avatar = this.listItem[i].getChildByName('avatar');
        let label = this.listItem[i].getChildByName('Labels');
        let playerName = label.getChildByName('playerName').getComponent(cc.Label);
        let playerScore = label.getChildByName('playerScore').getComponent(cc.Label);
        
        if (medal) medal.scale = 0;
        if (avatar) avatar.opacity = 0;
        playerName.string = this.playerData[i].name;
        playerScore.string = `${this.playerScores[i]}`;
        // Set avatar animation based on PlayerData
        if (avatar) {
          let avatarSprite = avatar.getComponent(cc.Sprite);
          let avatarAnim = avatar.getComponent(cc.Animation);
          
          if (avatarAnim && this.playerData[i].avatar !== undefined) {
            // Create a mapping from PlayerAvatar enum to animation index
            let animIndex = this.getAnimationIndex(this.playerData[i].avatar);
            
            if (animIndex >= 0 && animIndex < this.avatarAnimation.length) {
              let clip = this.avatarAnimation[animIndex];
              avatarAnim.addClip(clip);
              avatarAnim.play(clip.name);
            } else {
              cc.error(`Animation index ${animIndex} out of range for player ${i} with avatar ${this.playerData[i].avatar}`);
            }
          } else {
            cc.error(`Avatar animation component not found for player ${i}`);
          }
        }
      }
      for(let i=0; i<this.playerNumber; i++) {
        this.listItem[i].y -= 500;
      }
      this.buttonNode.opacity = 0;
      
      // Execute functions one by one in sequence
      this.scheduleOnce(() => { 
        this.TitleFadeIn();
        
        this.scheduleOnce(() => {
          this.animatePlayersMove(() => {
            this.animatePlayersMedals(() => {
              this.FadeInAvatar(() => {
                this.FadeInButton(); // Finally fade in the button
              });
            });
          });
        }, 2);
      }, 1);
    }

    private TitleFadeIn() {
      this.titleNode.runAction(cc.fadeIn(2));
    }

    private animatePlayersMove(callback: () => void) {
      let completedCount = 0;
      
      for(let i = 0; i < this.playerNumber; i++) {
        this.scheduleOnce(() => {
          let action = cc.moveBy(1, cc.v2(0, 500)).easing(cc.easeElasticInOut(1));
          let callbackAction = cc.callFunc(() => {
            completedCount++;
            if (completedCount === this.playerNumber) {
              callback(); // All players finished moving
            }
          });
          
          this.listItem[i].runAction(cc.sequence(action, callbackAction));
        }, i * 0.2);
      }
    }

    private animatePlayersMedals(callback: () => void) {
      let completedCount = 0;
  
      for(let i = 0; i < this.playerNumber - 1; i++) {
        this.scheduleOnce(() => {
          let medal = this.listItem[i].getChildByName('Medal');
          if (medal) {
            let action = cc.scaleTo(0.5, 1).easing(cc.easeElasticInOut(1));
            let callbackAction = cc.callFunc(() => {
              completedCount++;
              if (completedCount === this.playerNumber - 1) {
                callback(); // All medals finished animating
              }
            });
            medal.runAction(cc.sequence(action, callbackAction));
          } else {
            completedCount++;
            if (completedCount === this.playerNumber - 1) {
              callback();
            }
          }
        }, i * 0.2);
      }
    }

    private FadeInAvatar(callback: () => void) {
      let completedCount = 0;
  
      for(let i = 0; i < this.playerNumber; i++) {
        let avatar = this.listItem[i].getChildByName('avatar');
        if (avatar) {
          let callbackAction = cc.callFunc(() => {
            completedCount++;
            if (completedCount === this.playerNumber) {
              callback(); // All avatars finished fading in
            }
          });
          avatar.runAction(cc.sequence(cc.fadeIn(0.5), callbackAction));
        } else {
          cc.error(`Avatar node not found for player ${i + 1}`);
          completedCount++;
          if (completedCount === this.playerNumber) {
            callback();
          }
        }
      }
    }

    private FadeInButton() {
      this.buttonNode.runAction(cc.fadeIn(0.5));
      this.buttonNode.on('click', () => {
        this.gameManager.resetGameData();
        cc.director.loadScene("Start");
      });
    }

    private getAnimationIndex(avatar: PlayerAvatar): number {
      switch (avatar) {
        case PlayerAvatar.NULL:
          return 0;
        case PlayerAvatar.ELECTRIC:
          return 1;
        case PlayerAvatar.FIRE:
          return 2;
        case PlayerAvatar.GRASS:
          return 3;
        case PlayerAvatar.ICE:
          return 4;
        default:
          cc.error(`Unknown avatar type: ${avatar}`);
          return -1;
      }
    }

    // update (dt) {}
}
