import { Sprite, Animation, AnimationState, AnimationConfig, AnimationQueue } from './types';

// Unique ID generator for animations
let nextAnimationId = 0;
function generateAnimationId(): string {
    return `anim_${nextAnimationId++}`;
}

// Factory functions to create different types of animations
export function createMoveAnimation(
    sprite: Sprite, 
    fromX: number, 
    fromY: number, 
    toX: number, 
    toY: number, 
    duration: number
): Animation {
    return {
        id: generateAnimationId(),
        state: AnimationState.MOVING,
        startTime: Date.now(),
        endTime: Date.now() + duration,
        target: sprite,
        config: {
            duration: duration,
            easing: 'linear'
        },
        fromPosition: { x: fromX, y: fromY },
        toPosition: { x: toX, y: toY }
    };
}

export function createAttackAnimation(
    sprite: Sprite, 
    duration: number
): Animation {
    return {
        id: generateAnimationId(),
        state: AnimationState.ATTACKING,
        startTime: Date.now(),
        endTime: Date.now() + duration,
        target: sprite,
        config: {
            duration: duration,
            easing: 'easeOut',
            priority: 2
        }
    };
}

export function createDamageAnimation(
    sprite: Sprite, 
    damageAmount: number, 
    duration: number
): Animation {
    return {
        id: generateAnimationId(),
        state: AnimationState.TAKING_DAMAGE,
        startTime: Date.now(),
        endTime: Date.now() + duration,
        target: sprite,
        damageAmount: damageAmount,
        config: {
            duration: duration,
            easing: 'easeIn',
            priority: 3
        }
    };
}

export function createDeathAnimation(
    sprite: Sprite, 
    duration: number
): Animation {
    return {
        id: generateAnimationId(),
        state: AnimationState.DYING,
        startTime: Date.now(),
        endTime: Date.now() + duration,
        target: sprite,
        config: {
            duration: duration,
            easing: 'easeInOut',
            priority: 4
        },
        removeAfterAnimation: true
    };
}

// Animation queue implementation
export class AnimationManager implements AnimationQueue {
    activeAnimations: Animation[] = [];
    
    add(animation: Animation): void {
        // Check if there's already an animation for this sprite
        const existingIndex = this.activeAnimations.findIndex(
            a => a.target === animation.target && a.state === animation.state
        );
        
        if (existingIndex >= 0) {
            // Replace if new animation has higher or equal priority
            const existing = this.activeAnimations[existingIndex];
            if (!existing.config.priority || 
                !animation.config.priority || 
                animation.config.priority >= existing.config.priority) {
                this.activeAnimations[existingIndex] = animation;
            }
        } else {
            this.activeAnimations.push(animation);
        }
    }
    
    remove(animationId: string): void {
        this.activeAnimations = this.activeAnimations.filter(a => a.id !== animationId);
    }
    
    update(currentTime: number): void {
        // Process completed animations
        for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
            const anim = this.activeAnimations[i];
            
            // If animation is complete
            if (currentTime >= anim.endTime) {
                // Apply final state
                this.applyAnimationFinalState(anim);
                
                // Remove from queue
                this.activeAnimations.splice(i, 1);
            } else {
                // Update in-progress animation
                this.updateAnimation(anim, currentTime);
            }
        }
    }
    
    getActiveAnimation(spriteId: string): Animation | null {
        // Use type assertion to tell TypeScript the property exists at runtime
        return this.activeAnimations.find(a => (a.target as any).id === spriteId) || null;
    }
    
    private updateAnimation(animation: Animation, currentTime: number): void {
        const sprite = animation.target;
        const progress = this.calculateProgress(animation, currentTime);
        
        switch (animation.state) {
            case AnimationState.MOVING:
                if (animation.fromPosition && animation.toPosition) {
                    // Update visual position - add console.log for debugging
                    console.log(`Animating sprite from (${animation.fromPosition.x},${animation.fromPosition.y}) to (${animation.toPosition.x},${animation.toPosition.y}) at progress ${progress}`);
                    
                    sprite.visualX = animation.fromPosition.x + 
                        (animation.toPosition.x - animation.fromPosition.x) * progress;
                    sprite.visualY = animation.fromPosition.y + 
                        (animation.toPosition.y - animation.fromPosition.y) * progress;
                    
                    console.log(`New visual position: (${sprite.visualX},${sprite.visualY})`);
                }
                break;
                
            case AnimationState.ATTACKING:
                // Could implement attack visual effects here
                // e.g., weapon swing, particle effects
                break;
                
            case AnimationState.TAKING_DAMAGE:
                // Set damage visual indicator
                sprite.takingDamage = true;
                sprite.damageUntil = animation.endTime;
                break;
                
            case AnimationState.DYING:
                // Set damage visual indicator for death too
                sprite.takingDamage = true;
                sprite.damageUntil = animation.endTime;
                break;
        }
    }
    
    private applyAnimationFinalState(animation: Animation): void {
        const sprite = animation.target;
        
        switch (animation.state) {
            case AnimationState.MOVING:
                if (animation.toPosition) {
                    // Set final visual position
                    sprite.visualX = animation.toPosition.x;
                    sprite.visualY = animation.toPosition.y;
                }
                break;
                
            case AnimationState.ATTACKING:
                // Clean up any attack-specific states
                break;
                
            case AnimationState.TAKING_DAMAGE:
                // Clear damage indicator
                sprite.takingDamage = false;
                break;
                
            case AnimationState.DYING:
                // Leave damage indicator on for death unless explicitly cleared
                // This is handled by the entity removal logic
                break;
        }
    }
    
    private calculateProgress(animation: Animation, currentTime: number): number {
        const elapsed = currentTime - animation.startTime;
        const duration = animation.config.duration;
        let progress = Math.min(1, Math.max(0, elapsed / duration));
        
        // Apply easing if specified
        if (animation.config.easing) {
            progress = this.applyEasing(progress, animation.config.easing);
        }
        
        return progress;
    }
    
    private applyEasing(progress: number, easingType: string): number {
        switch (easingType) {
            case 'linear':
                return progress;
                
            case 'easeIn':
                return progress * progress;
                
            case 'easeOut':
                return 1 - (1 - progress) * (1 - progress);
                
            case 'easeInOut':
                return progress < 0.5
                    ? 2 * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
            default:
                return progress;
        }
    }
}

// Singleton instance for global use
export const animationManager = new AnimationManager();

// Helper to trigger move animations based on game state changes
export function triggerMoveAnimation(
    sprite: Sprite, 
    fromX: number, 
    fromY: number,
    toX: number, 
    toY: number, 
    duration: number
): void {
    // Create animation using the provided positions
    const moveAnim = createMoveAnimation(
        sprite,
        fromX, fromY,       // Starting position (should be previous logical position)
        toX, toY,           // Ending position (current logical position)
        duration
    );
    
    // Set animation parameters
    sprite.animationEndTime = moveAnim.endTime;
    
    // Initialize visualX/Y to starting position
    sprite.visualX = fromX;
    sprite.visualY = fromY;
    
    // Add to animation queue
    animationManager.add(moveAnim);
}

// Helper to trigger damage animations
export function triggerDamageAnimation(
    sprite: Sprite,
    damageAmount: number,
    duration: number = 150
): void {
    const damageAnim = createDamageAnimation(sprite, damageAmount, duration);
    animationManager.add(damageAnim);
}

// Helper to trigger death animations
export function triggerDeathAnimation(
    sprite: Sprite,
    duration: number = 300
): void {
    const deathAnim = createDeathAnimation(sprite, duration);
    animationManager.add(deathAnim);
}

// Main update function to call from game loop
export function updateAnimations(currentTime: number): void {
    animationManager.update(currentTime);
} 