import { MapNodeEvents, NodeOwnership } from "./types/GameEvents";

const {ccclass, property} = cc._decorator;

@ccclass
export default class EventCard extends cc.Component {

    @property(cc.Node)
    iconSprite: cc.Node = null;
    @property([cc.SpriteFrame])
    spriteFrames: cc.SpriteFrame[] = [];
    @property(cc.Label)
    descriptionLabel: cc.Label = null;
    @property(cc.Label)
    effectLabel: cc.Label = null;
    
    // Variable to control which sprite to show
    private currentSpriteIndex: number = 0;
    private static instance: EventCard = null;
    onLoad() {
        if (EventCard.instance) {
            cc.warn("EventCard: Instance already exists, destroying duplicate.");
            this.node.destroy();
            return;
        }
        EventCard.instance = this;
    }

    start() {
        this.node.active = false; // Hide the card initially
        this.updateSprite();
    }

    public static getInstance(): EventCard {
        return EventCard.instance;
    }

    public test() {
      cc.log("EventCard test method called");
      this.showCard(MapNodeEvents.DEDUCTMONEY, "This is a test description", "This is a test effect");
      this.scheduleOnce(() => {
        this.hideCard();
      }, 5); // Hide the card after 3 seconds
    }

    public showCard(nodeEvent: MapNodeEvents, description: string, effect: string) {
        // Set the description and effect labels
        if (this.descriptionLabel) {
            this.descriptionLabel.string = description;
        }
        if (this.effectLabel) {
            this.effectLabel.string = effect;
        }

        // Set the sprite based on the node event type
        switch (nodeEvent) {
            case MapNodeEvents.NORMAL:
                this.setSpriteByType("normal");
                break;
            case MapNodeEvents.DESTINY:
                this.setSpriteByType("destiny");
                break;
            case MapNodeEvents.CHANCE:
                this.setSpriteByType("chance");
                break;
            case MapNodeEvents.ADDMONEY:
                this.setSpriteByType("addmoney");
                break;
            case MapNodeEvents.DEDUCTMONEY:
                this.setSpriteByType("deductmoney");
                break;
            case MapNodeEvents.STAR:
                this.setSpriteByType("star");
                break;
            default:
                cc.warn(`Unknown node event type: ${nodeEvent}`);
                break;
        }
        cc.log(`Showing card for event: ${nodeEvent}, description: ${description}, effect: ${effect}`);
        // Set the card visibility to true
        this.node.active = true;

        this.scheduleOnce(() => {
            this.hideCard();
        }, 3); // Hide the card after 3 seconds
    }

    // Method to switch sprite based on index
    public setSpriteByIndex(index: number) {
        if (index >= 0 && index < this.spriteFrames.length) {
            this.currentSpriteIndex = index;
            this.updateSprite();
        } else {
            cc.warn(`Invalid sprite index: ${index}. Available indices: 0-${this.spriteFrames.length - 1}`);
        }
    }

    // Method to switch sprite based on a string identifier
    public setSpriteByType(type: string) {
        const spriteMap = {
            "normal": 0,
            "destiny": 1,
            "chance": 2,
            "addmoney": 3,
            "deductmoney": 4
        };
        
        if (spriteMap.hasOwnProperty(type)) {
            this.setSpriteByIndex(spriteMap[type]);
        } else {
            cc.warn(`Unknown sprite type: ${type}`);
        }
    }

    // Private method to actually update the sprite
    private updateSprite() {
        if (this.iconSprite && this.spriteFrames.length > 0 && this.currentSpriteIndex < this.spriteFrames.length) {
            const spriteComponent = this.iconSprite.getComponent(cc.Sprite);
            if (spriteComponent) {
                spriteComponent.spriteFrame = this.spriteFrames[this.currentSpriteIndex];
            }
        }
    }

    public hideCard() {
        this.node.active = false; // Hide the card
    }
}