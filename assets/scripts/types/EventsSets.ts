export interface EventEffect {
    propertyToModify: string;
    value: number;
}

export interface GameEvent {
    id: number;
    description: string;
    effectList: EventEffect[];
}

export const EVENTS_DATASET: GameEvent[] = [
    {
        id: 1,
        description: "You found a wallet on the street! Gain money.",
        effectList: [
            { propertyToModify: "money", value: 200 }
        ]
    },
    {
        id: 2,
        description: "Tax season! Pay income tax.",
        effectList: [
            { propertyToModify: "money", value: -150 }
        ]
    },
    {
        id: 3,
        description: "Lucky day! Roll dice again and gain money.",
        effectList: [
            { propertyToModify: "money", value: 100 },
            { propertyToModify: "extraTurn", value: 1 }
        ]
    },
    {
        id: 4,
        description: "Speeding ticket! Pay fine and lose a turn.",
        effectList: [
            { propertyToModify: "money", value: -80 },
            { propertyToModify: "skipTurn", value: 1 }
        ]
    },
    {
        id: 5,
        description: "Bank error in your favor! Collect money.",
        effectList: [
            { propertyToModify: "money", value: 300 }
        ]
    },
    {
        id: 6,
        description: "Property maintenance! Pay for all owned properties.",
        effectList: [
            { propertyToModify: "money", value: -50 },
            { propertyToModify: "payPerProperty", value: -25 }
        ]
    },
    {
        id: 7,
        description: "Charity donation! Lose money but gain reputation.",
        effectList: [
            { propertyToModify: "money", value: -100 },
            { propertyToModify: "reputation", value: 2 }
        ]
    },
    {
        id: 8,
        description: "Stock market boom! Your investments pay off.",
        effectList: [
            { propertyToModify: "money", value: 250 }
        ]
    },
    {
        id: 9,
        description: "Medical bills! Unexpected health costs.",
        effectList: [
            { propertyToModify: "money", value: -120 }
        ]
    },
    {
        id: 10,
        description: "Business opportunity! Invest money for future gains.",
        effectList: [
            { propertyToModify: "money", value: -100 },
            { propertyToModify: "futureIncome", value: 200 }
        ]
    },
    {
        id: 11,
        description: "Insurance payout! Receive compensation.",
        effectList: [
            { propertyToModify: "money", value: 180 }
        ]
    },
    {
        id: 12,
        description: "Lawsuit! Pay legal fees and damages.",
        effectList: [
            { propertyToModify: "money", value: -200 }
        ]
    },
    {
        id: 13,
        description: "Lottery winner! Big cash prize!",
        effectList: [
            { propertyToModify: "money", value: 500 }
        ]
    },
    {
        id: 14,
        description: "Move to GO! Teleport to start and collect bonus.",
        effectList: [
            { propertyToModify: "position", value: 0 },
            { propertyToModify: "money", value: 200 }
        ]
    },
    {
        id: 15,
        description: "Go back 3 spaces! Move backwards.",
        effectList: [
            { propertyToModify: "position", value: -3 }
        ]
    },
    {
        id: 16,
        description: "Double rent collection! Next rent is doubled.",
        effectList: [
            { propertyToModify: "rentMultiplier", value: 2 }
        ]
    },
    {
        id: 17,
        description: "Property upgrade! Improve one property for free.",
        effectList: [
            { propertyToModify: "freeUpgrade", value: 1 }
        ]
    },
    {
        id: 18,
        description: "Economic crisis! All players lose money.",
        effectList: [
            { propertyToModify: "money", value: -100 },
            { propertyToModify: "affectAllPlayers", value: 1 }
        ]
    },
    {
        id: 19,
        description: "Birthday celebration! All players give you money.",
        effectList: [
            { propertyToModify: "collectFromAll", value: 30 }
        ]
    },
    {
        id: 20,
        description: "Road construction! Pay for street repairs.",
        effectList: [
            { propertyToModify: "money", value: -40 },
            { propertyToModify: "payPerHouse", value: -25 }
        ]
    }
];

// Helper function to get random event
export function getRandomEvent(): GameEvent {
    const randomIndex = Math.floor(Math.random() * EVENTS_DATASET.length);
    return EVENTS_DATASET[randomIndex];
}

// Helper function to get event by ID
export function getEventById(id: number): GameEvent | undefined {
    return EVENTS_DATASET.find(event => event.id === id);
}

// Helper function to apply event effects to a player
export function applyEventEffects(event: GameEvent, player: any): void {
    event.effectList.forEach(effect => {
        switch (effect.propertyToModify) {
            case "money":
                player.money = Math.max(0, player.money + effect.value);
                break;
            case "position":
                if (effect.value === 0) {
                    player.position = 0; // Go to start
                } else {
                    player.position = Math.max(0, player.position + effect.value);
                }
                break;
            case "extraTurn":
                player.extraTurns = (player.extraTurns || 0) + effect.value;
                break;
            case "skipTurn":
                player.skipTurns = (player.skipTurns || 0) + effect.value;
                break;
            case "reputation":
                player.reputation = (player.reputation || 0) + effect.value;
                break;
            default:
                // Handle other properties as needed
                if (player.hasOwnProperty(effect.propertyToModify)) {
                    player[effect.propertyToModify] += effect.value;
                } else {
                    player[effect.propertyToModify] = effect.value;
                }
                break;
        }
    });
}