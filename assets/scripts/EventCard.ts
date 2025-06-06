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
    
    private currentSpriteIndex: number = 0;
    private static instance: EventCard = null;

    onLoad() {
        cc.log(`EventCard onLoad: Node ${this.node.name}. Current static instance before assignment: ${EventCard.instance ? EventCard.instance.node.name : "null"}, is current instance's node valid: ${EventCard.instance && EventCard.instance.node ? EventCard.instance.node.isValid : "N/A"}`);
        
        // If there's an existing instance, and its node is NO LONGER VALID,
        // then it's a stale instance from a previous scene. Clear it so this new one can take over.
        if (EventCard.instance && (!EventCard.instance.node || !EventCard.instance.node.isValid)) {
            cc.warn(`EventCard: Stale instance found (node ${EventCard.instance.node ? EventCard.instance.node.name : "N/A"} was invalid). Clearing old instance.`);
            EventCard.instance = null;
        }

        // Now, if an instance still exists at this point, it must be a valid one (e.g., if EventCard was made persistent).
        // In that case, this new one (from the reloaded scene) is a duplicate and should be destroyed.
        if (EventCard.instance && EventCard.instance !== this) {
            cc.warn(`EventCard: A valid instance on node ${EventCard.instance.node.name} already exists. Destroying this duplicate on ${this.node.name}.`);
            this.node.destroy();
            return;
        }
        
        // This component becomes the canonical instance.
        EventCard.instance = this;
        cc.log(`EventCard: Static instance set to this component on node ${this.node.name}`);
    }

    start() {
        // It's generally better to set the initial active state in the editor (prefab/scene).
        // If this node is part of the scene, it will be active by default unless set otherwise.
        // This ensures it's hidden if it wasn't already.
        if (this.node.parent) { // Check if it's actually in a scene
            this.node.active = false; 
        }
        this.updateSprite();
    }

    public static getInstance(): EventCard {
        if (!EventCard.instance) {
            cc.error("EventCard.getInstance() called but instance is null. The EventCard node might not be in the current scene or not yet loaded.");
        } else if (!EventCard.instance.node || !EventCard.instance.node.isValid) {
            cc.error("EventCard.getInstance() is returning an instance whose node is invalid. This indicates a problem with singleton management during scene transitions.");
            // EventCard.instance = null; // Optionally clear it to force re-evaluation, though onLoad should handle this.
            return null; // Return null to prevent further errors on an invalid instance
        }
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
        if (!this.node || !this.node.isValid) {
            cc.error("EventCard.showCard() called, but this EventCard's node is invalid. Aborting showCard. This might be due to a scene transition issue.");
            return;
        }

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
                this.setSpriteByType("star"); // Ensure "star" is in your spriteMap or handle default
                break;
            default:
                cc.warn(`Unknown node event type: ${nodeEvent}`);
                // Optionally set to a default sprite
                // this.setSpriteByType("normal"); 
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
            "deductmoney": 4,
            "star": 5 // Added "star", ensure you have a 6th spriteFrame (index 5) or adjust index
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
        if (!this.node || !this.node.isValid) {
            cc.warn("EventCard.hideCard() called, but this EventCard's node is invalid.");
            return;
        }
        this.node.active = false; // Hide the card
    }

    onDestroy() {
        cc.log(`EventCard onDestroy: Node ${this.node.name}. Static instance was ${EventCard.instance ? EventCard.instance.node.name : "null"}`);
        if (EventCard.instance === this) {
            EventCard.instance = null;
            cc.log("EventCard: Static instance cleared because this component (on " + this.node.name + ") was destroyed.");
        }
    }
}