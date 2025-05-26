const {ccclass, property} = cc._decorator;

@ccclass('PlayerControl')
export class PlayerControl extends cc.Component {
    @property(cc.String)
    playerName: string = '';
    @property(cc.String)
    playerId: string = '';
    @property(cc.String)
    playerAvatar: string = '';
}