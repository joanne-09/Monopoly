import { PlayerAvatar, PlayerData } from "./types/DataTypes";
const {ccclass, property} = cc._decorator;

@ccclass
export default class ResultScene extends cc.Component {

    @property(cc.Node)
    titleNode: cc.Node = null;

    // LIFE-CYCLE CALLBACKS:
    private listItem: cc.Node[] = [];
    private playerNumber: number = 4; // Assuming 4 players for the result scene

    onLoad () {
      for(let i=0; i<this.playerNumber; i++) {
        this.listItem[i] = this.node.getChildByName(`listItem${i+1}`) as cc.Node;
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
      // task 1: Title fade in (2 seconds)
      this.scheduleOnce(() => { 
        this.TitleFadeIn();
        
        // task 2: Start after title fade completes (2 seconds later)
        this.scheduleOnce(() => {
          this.animatePlayersMove(() => {
            // task 3: Start after all players finish moving
            this.animatePlayersMedals(() => {
              this.FadeInAvatar();
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
      for(let i = 0; i < this.playerNumber - 1; i++) {
        this.scheduleOnce(() => {
          let medal = this.listItem[i].getChildByName('Medal');
          if (medal) {
            let action = cc.scaleTo(0.5, 1).easing(cc.easeElasticInOut(1));
            medal.runAction(action);
          }
          if (i === this.playerNumber - 2) {
            callback(); // Last player finishes, call the callback
          }
        }, i * 0.2);
      }
    }

    private FadeInAvatar() {
      for(let i = 0; i < this.playerNumber; i++) {
        let avatar = this.listItem[i].getChildByName('avatar');
        if (avatar) {
          cc.log(`Fading in avatar for player ${i + 1}`);
          avatar.runAction(cc.fadeIn(0.5));
        } else {
          cc.error(`Avatar node not found for player ${i + 1}`);
        }
      }
    }


    // update (dt) {}
}
