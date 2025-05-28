const {ccclass, property} = cc._decorator;

@ccclass('PlayerControl')
export class PlayerControl extends cc.Component {
    @property(cc.String)
    playerName: string = '';
    @property(cc.String)
    playerId: string = '';
    @property(cc.Float)
    playerAvatar: number = 0;

    @property(cc.Vec2)
    position: cc.Vec2 = cc.v2(0, 0);

    rollDice(dice: number[]): number {
        /*
        * Rolls a die and returns the result.
        * @param {number[]} dice - The array of dice values to roll.
        * @returns {number} The rolled value from the provided dice array.
        */

        if (dice.length === 0) {
            console.warn("No dice provided for rolling.");
            return 0;
        }
        const randomIndex = Math.floor(Math.random() * dice.length);
        const rolledValue = dice[randomIndex];
        console.log(`Rolled value: ${rolledValue} from dice: ${dice}`);

        return rolledValue;
    }
}