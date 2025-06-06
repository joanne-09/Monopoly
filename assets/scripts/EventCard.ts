import { MapNodeEvents, NodeOwnership } from "./types/GameEvents";

const {ccclass, property} = cc._decorator;

@ccclass
export default class EventCard extends cc.Component {

    @property([cc.SpriteFrame])
    spriteFrames: cc.SpriteFrame[] = [];
    @property(cc.Prefab)
    eventCardPrefab: cc.Prefab = null;
    
    // These will be assigned from the prefab instance
    private iconSprite: cc.Node = null;
    private descriptionLabel: cc.Label = null;
    private effectLabel: cc.Label = null;

    onLoad() {
        // Initialize the card as hidden
        // this.node.active = false; // This will be handled by the prefab's initial state or showCard
    }

    start() {
        // updateSprite might be called before iconSprite is set if not careful
        // It's better to call updateSprite after iconSprite is assigned in showCard
    }

    // Static method to create and show event card
    public showEventCard(nodeEvent: MapNodeEvents, description: string, effect: string) {
        if (!this.eventCardPrefab) {
            cc.warn("EventCard: eventCardPrefab is not assigned!");
            return;
        }
        // initiate the prefab
        const eventCardNode = cc.instantiate(this.eventCardPrefab);
        if (!eventCardNode) {
            cc.warn("EventCard: Failed to instantiate eventCardPrefab!");
            return;
        }
        eventCardNode.setParent(this.node);
        eventCardNode.active = true; // Ensure the card is visible
        eventCardNode.setPosition(cc.v2(0, 0)); // Set position to center of the parent node
        if (!eventCardNode) {
            cc.warn("EventCard: Failed to instantiate eventCardPrefab!");
            return;
        }
        cc.log("EventCard: Prefab instance created successfully.");
/*
        // get the needed nodes from the prefab instance
        this.iconSprite = eventCardNode.getChildByName("icon")?.getChildByName("icon_sprite");
        const descriptionNode = eventCardNode.getChildByName("description")?.getChildByName("Label");
        this.descriptionLabel = descriptionNode?.getComponent(cc.Label);
        const effectNode = eventCardNode.getChildByName("effect")?.getChildByName("Label");
        this.effectLabel = effectNode?.getComponent(cc.Label);

        // Verify that all parts were found
        if (!this.iconSprite) {
            cc.warn("EventCard: 'icon/icon_sprite' node not found in prefab instance.");
        }
        if (!this.descriptionLabel) {
            cc.warn("EventCard: 'description/Label' node or its Label component not found in prefab instance.");
        }
        if (!this.effectLabel) {
            cc.warn("EventCard: 'effect/Label' node or its Label component not found in prefab instance.");
        }

        this.setEventSprite(nodeEvent);
        this.descriptionLabel.string = description || "No description provided.";
        this.effectLabel.string = effect || "No effect specified.";
        */
    }

    // Static method to hide current event card
    public static hideEventCard() {

    }

    public test() {
        // a testcase of showEventCard
        const testEvent = MapNodeEvents.DEDUCTMONEY;
        const testDescription = "This is a test event description.";
        const testEffect = "This is a test effect.";
        this.showEventCard(testEvent, testDescription, testEffect);
        cc.log("EventCard: Test event card shown with description and effect.");
    }

    // Method to switch sprite based on index
    public setEventSprite(event: MapNodeEvents) {
        switch (event) {
        case MapNodeEvents.NORMAL:
            this.iconSprite.getComponent(cc.Sprite).spriteFrame = this.spriteFrames[0];
            break;
        case MapNodeEvents.DESTINY:
            this.iconSprite.getComponent(cc.Sprite).spriteFrame = this.spriteFrames[1];
            break;
        case MapNodeEvents.CHANCE:
            this.iconSprite.getComponent(cc.Sprite).spriteFrame = this.spriteFrames[2];
            break;
        case MapNodeEvents.ADDMONEY:
            this.iconSprite.getComponent(cc.Sprite).spriteFrame = this.spriteFrames[3];
            break;
        case MapNodeEvents.DEDUCTMONEY:
            this.iconSprite.getComponent(cc.Sprite).spriteFrame = this.spriteFrames[4];
            break;
        default:
            cc.warn(`EventCard: No sprite frame found for event type ${event}`);
            break;
        }
    }
}
