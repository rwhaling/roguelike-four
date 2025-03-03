// Shared types

export interface Sprite {
    x: number;
    y: number;
    visualX: number;
    visualY: number;
    sprite_x: number;
    sprite_y: number;
    prev_x: number;
    prev_y: number;
    animationEndTime: number;
    restUntil: number;
    isPlayer: boolean;
    faction: string;
    enemyFactions: string[];
    maxHitpoints: number;
    hitpoints: number;
    lastMoveTime: number;
    movementDelay: number;
    lastAttackTime?: number;
    isStructure?: boolean;
    useBackgroundSpritesheet?: boolean;
    isChampion?: boolean;
    takingDamage?: boolean;
    damageUntil?: number;
}