// Simple AI module - extracts existing functions with minimal changes

// Updated imports to use the new type definitions
import { Entity, Sprite } from './types';

// Function to update regular enemy AI
export function updateRegularEnemyAI(
    sprite: Sprite, 
    now: number, 
    interval: number,
    spriteMap: any,
    findNearestEnemy: (entity: Entity) => Entity | null,
    checkFactionCollision: (entity: Entity, x: number, y: number) => boolean,
    isPositionOccupied: (x: number, y: number, excludeEntity: Entity | null) => boolean,
    calculateNewPosition: (x: number, y: number, direction: {dx: number, dy: number}) => {x: number, y: number}
) {
    // Find nearest enemy of opposing faction
    const nearestEnemy = findNearestEnemy(sprite);
    
    if (nearestEnemy) {
        // Get direction toward enemy
        const direction = getDirectionTowardTarget(
            sprite.x, sprite.y, 
            nearestEnemy.x, nearestEnemy.y
        );
        
        // Apply the same bounds-checking logic as player movement
        const newPos = calculateNewPosition(sprite.x, sprite.y, direction);
        
        // Check for faction collision before moving
        if (checkFactionCollision(sprite, newPos.x, newPos.y)) {
            // We hit an enemy, check alternate directions
            tryAlternativeMovements(
                sprite, direction, now, interval, 
                spriteMap, calculateNewPosition, 
                checkFactionCollision, isPositionOccupied
            );
        } else if (!isPositionOccupied(newPos.x, newPos.y, sprite)) {
            // Save previous position for animation
            sprite.prev_x = sprite.x;
            sprite.prev_y = sprite.y;
            
            // Update spatial hash immediately 
            spriteMap.updatePosition(sprite, newPos.x, newPos.y);
            
            // Update animation end time
            sprite.animationEndTime = now + interval;
            sprite.restUntil = now + interval + sprite.movementDelay;
        }
    }
}

// Function to update champion AI (prioritizing fortresses)
export function updateChampionAI(
    sprite: Sprite, 
    now: number, 
    interval: number,
    spriteMap: any,
    findNearestEnemy: (entity: Entity) => Entity | null,
    findNearestFortress: (entity: Entity, maxDistance: number) => Entity | null,
    checkFactionCollision: (entity: Entity, x: number, y: number) => boolean,
    isPositionOccupied: (x: number, y: number, excludeEntity: Entity | null) => boolean,
    calculateNewPosition: (x: number, y: number, direction: {dx: number, dy: number}) => {x: number, y: number}
) {
    // Champions first check for nearby fortresses
    const nearbyFortress = findNearestFortress(sprite, 2);
    
    if (nearbyFortress) {
        // Get direction toward fortress
        const direction = getDirectionTowardTarget(
            sprite.x, sprite.y, 
            nearbyFortress.x, nearbyFortress.y
        );
        
        // Apply the same bounds-checking logic as player movement
        const newPos = calculateNewPosition(sprite.x, sprite.y, direction);
        
        // Check for faction collision before moving
        if (checkFactionCollision(sprite, newPos.x, newPos.y)) {
            // We hit an enemy, check alternate directions
            tryAlternativeMovements(
                sprite, direction, now, interval, 
                spriteMap, calculateNewPosition, 
                checkFactionCollision, isPositionOccupied
            );
        } else if (!isPositionOccupied(newPos.x, newPos.y, sprite)) {
            // Save previous position for animation
            sprite.prev_x = sprite.x;
            sprite.prev_y = sprite.y;
            
            // Update spatial hash immediately 
            spriteMap.updatePosition(sprite, newPos.x, newPos.y);
            
            // Update animation end time
            sprite.animationEndTime = now + interval;
            sprite.restUntil = now + interval + sprite.movementDelay;
        }
    } else {
        // No fortress nearby, fall back to regular enemy behavior
        updateRegularEnemyAI(
            sprite, now, interval, spriteMap,
            findNearestEnemy, checkFactionCollision, 
            isPositionOccupied, calculateNewPosition
        );
    }
}

// Function to update fortress AI (mostly passive)
export function updateFortressAI(entity: Entity, now: number) {
    // Fortresses don't move, but they could have logic for:
    // - Periodic healing
    // - Spawning nearby units
    // - Alert status changes
    
    // Currently, fortresses have no active behavior
    return;
}

// Helper function to try alternative movement directions
function tryAlternativeMovements(
    sprite: Sprite, 
    direction: {dx: number, dy: number}, 
    now: number, 
    interval: number,
    spriteMap: any,
    calculateNewPosition: (x: number, y: number, direction: {dx: number, dy: number}) => {x: number, y: number},
    checkFactionCollision: (entity: Entity, x: number, y: number) => boolean,
    isPositionOccupied: (x: number, y: number, excludeEntity: Entity | null) => boolean
) {
    // Consider all 8 adjacent squares
    let adjacentDirections = [
        { dx: 1, dy: 0 },   // right
        { dx: 1, dy: 1 },   // down-right
        { dx: 0, dy: 1 },   // down
        { dx: -1, dy: 1 },  // down-left
        { dx: -1, dy: 0 },  // left
        { dx: -1, dy: -1 }, // up-left
        { dx: 0, dy: -1 },  // up
        { dx: 1, dy: -1 }   // up-right
    ];
    
    // Shuffle the array to randomize movement choices
    for (let i = adjacentDirections.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [adjacentDirections[i], adjacentDirections[j]] = [adjacentDirections[j], adjacentDirections[i]];
    }
    
    for (const adjDir of adjacentDirections) {
        const adjPos = calculateNewPosition(sprite.x, sprite.y, adjDir);
        if (!isPositionOccupied(adjPos.x, adjPos.y, sprite) && 
            !checkFactionCollision(sprite, adjPos.x, adjPos.y)) {
            // Save previous position for animation
            sprite.prev_x = sprite.x;
            sprite.prev_y = sprite.y;
            
            spriteMap.updatePosition(sprite, adjPos.x, adjPos.y);
            sprite.animationEndTime = now + interval;
            sprite.restUntil = now + interval + sprite.movementDelay;
            break;
        }
    }
}

// Get direction toward target
export function getDirectionTowardTarget(fromX: number, fromY: number, toX: number, toY: number) {
    const dx = Math.sign(toX - fromX); // Will be -1, 0, or 1
    const dy = Math.sign(toY - fromY); // Will be -1, 0, or 1
    
    return { dx, dy };
}