import { PlayerAvatar, PlayerData } from "./types/DataTypes";
const {ccclass, property} = cc._decorator;

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

    // LIFE-CYCLE CALLBACKS:
    private listItem: cc.Node[] = [];
    private playerNumber: number = 4; // Assuming 4 players for the result scene

    onLoad () {
      for(let i=0; i<this.playerNumber; i++) {
        this.listItem[i] = this.listNode.getChildByName(`listItem${i+1}`) as cc.Node;
      }
    }

    start () {
      // Initialize
      this.titleNode.opacity = 0;
      for(let i=0; i<this.playerNumber; i++) {
        let medal = this.listItem[i].getChildByName('Medal');
        let avatar = this.listItem[i].getChildByName('avatar');
        
        if (medal) medal.scale = 0;
        if (avatar) avatar.opacity = 0;
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
          cc.log(`Fading in avatar for player ${i + 1}`);
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
        cc.director.loadScene(this.nextScene.name);
      });
    }

    // update (dt) {}
}
