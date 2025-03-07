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
    maxStamina: number;
    stamina: number;
    healthRegenFrequency?: number;
    healthRegenTimeElapsed?: number;
    healthRegenAmount?: number;
    staminaRegenFrequency?: number;
    staminaRegenTimeElapsed?: number;
    staminaRegenAmount?: number;
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

export interface Particle extends Visual {
    particleId: number;
    colorSwapR: number;
    colorSwapG: number;
    colorSwapB: number;
    colorSwapA: number;
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

// Animation-related types
export enum AnimationState {
    IDLE = 'IDLE',
    MOVING = 'MOVING',
    ATTACKING = 'ATTACKING',
    TAKING_DAMAGE = 'TAKING_DAMAGE',
    DYING = 'DYING'
}

export interface AnimationConfig {
    duration: number;     // Duration in milliseconds
    easing?: string;      // Easing function name (e.g., 'linear', 'easeInOut')
    repeat?: boolean;     // Whether to repeat the animation
    priority?: number;    // Priority for overlapping animations
}

export interface Animation {
    id: string;           // Unique ID for this animation
    state: AnimationState;
    startTime: number;    // When the animation started
    endTime: number;      // When the animation will end
    target: Sprite;       // The sprite being animated
    config: AnimationConfig;
    
    // For movement animations
    fromPosition?: { x: number, y: number };
    toPosition?: { x: number, y: number };
    
    // For damage animations
    damageAmount?: number;
    
    // For death animations
    removeAfterAnimation?: boolean;
}

// Queue to manage multiple animations
export interface AnimationQueue {
    activeAnimations: Animation[];
    add(animation: Animation): void;
    remove(animationId: string): void;
    update(currentTime: number): void;
    getActiveAnimation(spriteId: string): Animation | null;
}

// Campaign system to provide indirection between colors and factions
export interface Campaign {
  currentRedFaction: string,
  currentBlueFaction: string,
  currentLevel: number,
  redFactionReward: string,
  blueFactionReward: string,
  selectedFaction: string | null,
  factionRewards: Record<string, string>, // Map of faction names to their rewards
  selectedFactionRewards: string[], // Array to track rewards selected across levels
  gameHistory: CurrentLevel[]
}

export interface CurrentLevel {
  currentLevel: number,
  currentRedFaction: string,
  redFactionReward: string,
  currentBlueFaction: string,
  blueFactionReward: string,
  selectedFaction?: string,
  selectedReward?: string, // The reward that was selected for this level
  gameHistory: any[]
}