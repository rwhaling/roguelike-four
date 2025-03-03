// Simple AI module - using declarative actions

import { Entity, AIAction, ActionType } from './types';

// Function to update regular enemy AI - now returns an action
export function updateRegularEnemyAI(
    entity: Entity,
    findNearestEnemy: (entity: Entity) => Entity | null,
    calculateNewPosition: (x: number, y: number, direction: {dx: number, dy: number}) => {x: number, y: number}
): AIAction {
    // Find nearest enemy of opposing faction
    const nearestEnemy = findNearestEnemy(entity);
    
    if (nearestEnemy) {
        // Check if we're adjacent to the enemy (for attack)
        const distance = Math.abs(entity.x - nearestEnemy.x) + Math.abs(entity.y - nearestEnemy.y);
        
        if (distance <= 1) {
            // We're adjacent, attack instead of move
            return {
                type: ActionType.ATTACK,
                targetEntity: nearestEnemy
            };
        }
        
        // Get direction toward enemy
        const direction = getDirectionTowardTarget(
            entity.x, entity.y, 
            nearestEnemy.x, nearestEnemy.y
        );
        
        // Calculate desired position
        const newPos = calculateNewPosition(entity.x, entity.y, direction);
        
        // Return move action
        return {
            type: ActionType.MOVE,
            targetX: newPos.x,
            targetY: newPos.y
        };
    }
    
    // No enemies nearby, return idle action
    return { type: ActionType.IDLE };
}

// Function to update champion AI (prioritizing fortresses)
export function updateChampionAI(
    entity: Entity,
    findNearestEnemy: (entity: Entity) => Entity | null,
    findNearestFortress: (entity: Entity, maxDistance: number) => Entity | null,
    calculateNewPosition: (x: number, y: number, direction: {dx: number, dy: number}) => {x: number, y: number}
): AIAction {
    // Champions first check for nearby fortresses
    const nearbyFortress = findNearestFortress(entity, 2);
    
    if (nearbyFortress) {
        // Check if we're adjacent to the fortress
        const distance = Math.abs(entity.x - nearbyFortress.x) + Math.abs(entity.y - nearbyFortress.y);
        
        if (distance <= 1) {
            // We're adjacent, attack the fortress
            return {
                type: ActionType.ATTACK,
                targetEntity: nearbyFortress
            };
        }
        
        // Get direction toward fortress
        const direction = getDirectionTowardTarget(
            entity.x, entity.y, 
            nearbyFortress.x, nearbyFortress.y
        );
        
        // Calculate desired position
        const newPos = calculateNewPosition(entity.x, entity.y, direction);
        
        // Return move action
        return {
            type: ActionType.MOVE,
            targetX: newPos.x,
            targetY: newPos.y
        };
    } else {
        // No fortress nearby, fall back to regular enemy behavior
        return updateRegularEnemyAI(
            entity,
            findNearestEnemy,
            calculateNewPosition
        );
    }
}

// Function to update fortress AI (mostly passive)
export function updateFortressAI(entity: Entity): AIAction {
    // Fortresses don't take actions currently
    return { type: ActionType.IDLE };
}

// Get alternative movement options when primary direction is blocked
export function getAlternativeMovements(
    entity: Entity,
    primaryDirection: {dx: number, dy: number},
    calculateNewPosition: (x: number, y: number, direction: {dx: number, dy: number}) => {x: number, y: number}
): {x: number, y: number}[] {
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
    
    // Return list of possible positions
    return adjacentDirections.map(dir => calculateNewPosition(entity.x, entity.y, dir));
}

// Get direction toward target
export function getDirectionTowardTarget(fromX: number, fromY: number, toX: number, toY: number) {
    const dx = Math.sign(toX - fromX); // Will be -1, 0, or 1
    const dy = Math.sign(toY - fromY); // Will be -1, 0, or 1
    
    return { dx, dy };
}