// Shared types

// Gameplay and logic properties
export interface Entity {
    x: number;
    y: number;
    isPlayer: boolean;
    faction: string;
    enemyFactions: string[];
    maxHitpoints: number;
    hitpoints: number;
    lastMoveTime: number;
    movementDelay: number;
    lastAttackTime?: number;
    isStructure?: boolean;
    isChampion?: boolean;
}

// Visual and animation properties
export interface Visual {
    visualX: number;
    visualY: number;
    sprite_x: number;
    sprite_y: number;
    prev_x: number;
    prev_y: number;
    animationEndTime: number;
    restUntil: number;
    useBackgroundSpritesheet?: boolean;
    takingDamage?: boolean;
    damageUntil?: number;
}

// Combined type that represents a game object with both entity and visual components
export interface GameObject extends Entity, Visual {}

// Keep Sprite as an alias for GameObject for backward compatibility
export type Sprite = GameObject;

// Define possible AI actions
export enum ActionType {
    MOVE = 'MOVE',
    ATTACK = 'ATTACK',
    IDLE = 'IDLE'
}

// Define the action interface returned by AI functions
export interface AIAction {
    type: ActionType;
    targetX?: number;
    targetY?: number;
    targetEntity?: Entity;
}