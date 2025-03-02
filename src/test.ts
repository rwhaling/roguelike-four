import * as Crypto from "crypto-js";
import { WebGLDisplay } from "./display/WebGLDisplay";
import * as glu from "./display/GLUtils";

// Then use the global noise variable
// You may need to add a declaration to make TypeScript happy
declare const noise: any;

// Add variables to track last respawn check times
let lastOrcRespawnCheck = Date.now();
let lastUndeadRespawnCheck = Date.now();

function init() {
    console.log(noise);
    console.log("about to retrieve encrypted images")
    
    // Load both sprite sheets
    loadSpriteSheets();
}

// Load the foreground and background sprite sheets
function loadSpriteSheets() {
    // First sprite sheet (foreground characters)
    let fgReq = new XMLHttpRequest();
    let fgReqUrl = "fg_characters.png"; // New foreground sprite sheet
    
    // Second sprite sheet (background tiles)
    let bgReqUrl = "bg_edits_1.png"; // New background sprite sheet
    
    // Load foreground tileset first
    if (fgReqUrl.endsWith(".png")) {
        fgReq.responseType = 'blob';
        fgReq.open('GET', fgReqUrl, true);
        fgReq.onreadystatechange = function() {
            if(this.readyState == 4 && this.status == 200) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    // Store foreground URL and try to load background
                    const fgUrl = reader.result as string;
                    loadBackgroundTileset(fgUrl, bgReqUrl);
                }
                reader.readAsDataURL(this.response);
            } else if (this.readyState == 4) {
                console.error("Failed to load foreground sprite sheet");
            }
        };
        fgReq.send(null);
    } else {
        // Handle encrypted files if needed
        fgReq.open('GET', fgReqUrl, true);
        fgReq.onreadystatechange = function() {
            if(this.readyState == 4 && this.status == 200) {
                const fgUrl = decryptAndCreateBlobUrl(this.responseText);
                loadBackgroundTileset(fgUrl, bgReqUrl);
            } else if (this.readyState == 4) {
                console.error("Failed to load foreground sprite sheet");
            }
        };
        fgReq.send(null);
    }
}

// Helper to decrypt and create blob URL
function decryptAndCreateBlobUrl(encryptedText) {
    var dec = Crypto.AES.decrypt(encryptedText, import.meta.env.VITE_ASSET_KEY);
    var plain = Crypto.enc.Base64.stringify(dec);

    let bytes = atob(plain)
    const binary = new Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        binary[i] = bytes.charCodeAt(i);
    }
    const byteArray = new Uint8Array(binary);

    const blob = new Blob([byteArray])
    return URL.createObjectURL(blob);
}

// Load background tileset and then initialize
function loadBackgroundTileset(fgUrl, bgReqUrl) {
    // If no separate background, just use foreground
    if (!bgReqUrl || bgReqUrl === "") {
        setup(fgUrl, null).catch(console.error);
        return;
    }
    
    let bgReq = new XMLHttpRequest();
    if (bgReqUrl.endsWith(".png")) {
        bgReq.responseType = 'blob';
        bgReq.open('GET', bgReqUrl, true);
        bgReq.onreadystatechange = function() {
            if(this.readyState == 4 && this.status == 200) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    setup(fgUrl, reader.result as string).catch(console.error);
                }
                reader.readAsDataURL(this.response);
            } else if (this.readyState == 4) {
                // Failed to load background, just use foreground
                setup(fgUrl, null).catch(console.error);
            }
        };
        bgReq.send(null);
    } else {
        bgReq.open('GET', bgReqUrl, true);
        bgReq.onreadystatechange = function() {
            if(this.readyState == 4 && this.status == 200) {
                const bgUrl = decryptAndCreateBlobUrl(this.responseText);
                setup(fgUrl, bgUrl).catch(console.error);
            } else if (this.readyState == 4) {
                // Failed to load background, just use foreground
                setup(fgUrl, null).catch(console.error);
            }
        };
        bgReq.send(null);
    }
}

// Add a new object to track key states
let keyState = {
    w: false,
    a: false,
    s: false,
    d: false,
    q: false, // diagonal top-left
    e: false, // diagonal top-right
    z: false, // diagonal bottom-left
    c: false  // diagonal bottom-right
};

// Direction mapping for movement
const DIRECTIONS = {
    q: { dx: -1, dy: -1 }, // top-left
    w: { dx: 0, dy: -1 },  // up
    e: { dx: 1, dy: -1 },  // top-right
    a: { dx: -1, dy: 0 },  // left
    d: { dx: 1, dy: 0 },   // right
    z: { dx: -1, dy: 1 },  // bottom-left
    s: { dx: 0, dy: 1 },   // down
    c: { dx: 1, dy: 1 }    // bottom-right
};

// Movement priority (higher priority directions are checked first)
const MOVEMENT_PRIORITY = ['q', 'e', 'z', 'c', 'w', 'a', 's', 'd'];

// Function to calculate new position with boundary checks
function calculateNewPosition(x, y, direction) {
    const { dx, dy } = direction;
    const MIN_X = 1;  // Keep the minimum at 1 to account for the border
    const MAX_X = window.gameParams.mapWidth - 2;  // Subtract 2 for borders (1 on each side)
    const MIN_Y = 0;  // Keep the minimum at 1 to account for the border
    const MAX_Y = window.gameParams.mapHeight - 3;  // Subtract 2 for borders (1 on each side)
    
    return {
        x: Math.max(MIN_X, Math.min(MAX_X, x + dx)),
        y: Math.max(MIN_Y, Math.min(MAX_Y, y + dy))
    };
}

// Expand Sprite interface to include structure property
interface Sprite {
    // Logical grid position
    x: number;
    y: number;
    
    // Visual position (for rendering only)
    visualX: number;
    visualY: number;
    
    // Sprite sheet coordinates
    sprite_x: number;
    sprite_y: number;
    
    // Movement target
    target_x: number;
    target_y: number;
    target_time: number;
    
    restUntil: number;
    isPlayer: boolean;
    faction: string;
    
    // NEW: Enemy factions this sprite will attack
    enemyFactions: string[];
    
    // Damage effect properties
    takingDamage?: boolean;
    damageUntil?: number;
    
    // Hitpoint properties
    maxHitpoints: number;
    hitpoints: number;
    
    // Movement timing
    lastMoveTime: number;
    movementDelay: number;
    
    // NEW: Attack cooldown
    lastAttackTime?: number;
    
    // NEW: Structure flag for immobile objects like fortresses
    isStructure?: boolean;
    
    // NEW: Flag to use background spritesheet for rendering
    useBackgroundSpritesheet?: boolean;
}

// Track fortresses for easy reference
let fortresses: Sprite[] = [];

// Function to spawn fortresses
function spawnFortresses() {
    console.log("Starting fortress spawning...");
    
    // Clear existing fortresses
    fortresses = [];
    
    // Map quadrant boundaries
    const halfWidth = Math.floor(window.gameParams.mapWidth / 2);
    const halfHeight = Math.floor(window.gameParams.mapHeight / 2);
    
    // Ensure we don't place on border walls (add padding of 2)
    const minX = 2;
    const minY = 2;
    const maxOrcX = halfWidth - 2;
    const maxOrcY = halfHeight - 2;
    const minUndeadX = halfWidth + 2;
    const minUndeadY = halfHeight + 2;
    const maxX = window.gameParams.mapWidth - 3;
    const maxY = window.gameParams.mapHeight - 3;
    
    console.log(`Orc fortress range: (${minX},${minY}) to (${maxOrcX},${maxOrcY})`);
    console.log(`Undead fortress range: (${minUndeadX},${minUndeadY}) to (${maxX},${maxY})`);
    
    // Random position for orc fortress (upper-left quadrant)
    const orcFortressX = minX + Math.floor(Math.random() * (maxOrcX - minX));
    const orcFortressY = minY + Math.floor(Math.random() * (maxOrcY - minY));
    
    // Random position for undead fortress (lower-right quadrant)
    const undeadFortressX = minUndeadX + Math.floor(Math.random() * (maxX - minUndeadX));
    const undeadFortressY = minUndeadY + Math.floor(Math.random() * (maxY - minUndeadY));
    
    // Create orc fortress
    const orcFortress: Sprite = {
        x: orcFortressX,
        y: orcFortressY,
        visualX: orcFortressX,
        visualY: orcFortressY,
        sprite_x: 10,
        sprite_y: 21,
        target_x: orcFortressX,
        target_y: orcFortressY,
        target_time: 0,
        restUntil: 0,
        isPlayer: false,
        isStructure: true, // Mark as structure (immobile)
        faction: "orc",
        enemyFactions: ["undead", "human"], // Enemies of the orc faction
        maxHitpoints: 20, // Fortresses have more hitpoints
        hitpoints: 20,
        lastMoveTime: 0,
        movementDelay: 0,
        useBackgroundSpritesheet: true // Use background spritesheet
    };
    
    // Create undead fortress
    const undeadFortress: Sprite = {
        x: undeadFortressX,
        y: undeadFortressY,
        visualX: undeadFortressX,
        visualY: undeadFortressY,
        sprite_x: 10,
        sprite_y: 22,
        target_x: undeadFortressX,
        target_y: undeadFortressY,
        target_time: 0,
        restUntil: 0,
        isPlayer: false,
        isStructure: true, // Mark as structure (immobile)
        faction: "undead",
        enemyFactions: ["orc", "human"], // Enemies of the undead faction
        maxHitpoints: 20, // Fortresses have more hitpoints
        hitpoints: 20,
        lastMoveTime: 0,
        movementDelay: 0,
        useBackgroundSpritesheet: true // Use background spritesheet
    };
    
    // Add to fortresses array for reference
    fortresses.push(orcFortress, undeadFortress);
    
    // Add to spatial hash to block movement
    spriteMap.add(orcFortress);
    spriteMap.add(undeadFortress);
    
    // Add to allSprites for updating and rendering
    allSprites.push(orcFortress, undeadFortress);
    
    console.log(`Spawned orc fortress at (${orcFortressX}, ${orcFortressY})`);
    console.log(`Spawned undead fortress at (${undeadFortressX}, ${undeadFortressY})`);
    console.log(`Total sprites after fortress spawning: ${allSprites.length}`);
}

// Spatial hash implementation
class SpatialHash {
    private grid: { [key: string]: Sprite[] } = {};
    
    // Get a unique key for a grid position
    private getKey(x: number, y: number): string {
        return `${Math.floor(x)},${Math.floor(y)}`;
    }
    
    // Add a sprite to the spatial hash
    add(sprite: Sprite): void {
        const key = this.getKey(sprite.x, sprite.y);
        if (!this.grid[key]) {
            this.grid[key] = [];
        }
        if (!this.grid[key].includes(sprite)) {
            this.grid[key].push(sprite);
        }
        
        // Also reserve target position if it's different
        if (sprite.target_x !== sprite.x || sprite.target_y !== sprite.y) {
            const targetKey = this.getKey(sprite.target_x, sprite.target_y);
            if (!this.grid[targetKey]) {
                this.grid[targetKey] = [];
            }
            if (!this.grid[targetKey].includes(sprite)) {
                this.grid[targetKey].push(sprite);
            }
        }
    }
    
    // Remove a sprite from the spatial hash
    remove(sprite: Sprite): void {
        const key = this.getKey(sprite.x, sprite.y);
        if (this.grid[key]) {
            this.grid[key] = this.grid[key].filter(s => s !== sprite);
            if (this.grid[key].length === 0) {
                delete this.grid[key];
            }
        }
        
        // Also remove from target position if different
        if (sprite.x !== sprite.target_x || sprite.y !== sprite.target_y) {
            const targetKey = this.getKey(sprite.target_x, sprite.target_y);
            if (this.grid[targetKey]) {
                this.grid[targetKey] = this.grid[targetKey].filter(s => s !== sprite);
                if (this.grid[targetKey].length === 0) {
                    delete this.grid[targetKey];
                }
            }
        }
    }
    
    // COMPLETELY REWRITTEN UPDATE METHOD
    update(sprite: Sprite, oldX: number, oldY: number, oldTargetX: number, oldTargetY: number): void {
        // First, completely remove the sprite from all its old positions
        const oldPositions = [
            this.getKey(oldX, oldY),
            this.getKey(oldTargetX, oldTargetY)
        ];
        
        // Remove sprite from all old positions
        for (const key of oldPositions) {
            if (this.grid[key]) {
                this.grid[key] = this.grid[key].filter(s => s !== sprite);
                if (this.grid[key].length === 0) {
                    delete this.grid[key];
                }
            }
        }
        
        // Then add sprite to all its new positions
        const newKey = this.getKey(sprite.x, sprite.y);
        if (!this.grid[newKey]) {
            this.grid[newKey] = [];
        }
        if (!this.grid[newKey].includes(sprite)) {
            this.grid[newKey].push(sprite);
        }
        
        // Also add to target position if different
        if (sprite.target_x !== sprite.x || sprite.target_y !== sprite.y) {
            const targetKey = this.getKey(sprite.target_x, sprite.target_y);
            if (!this.grid[targetKey]) {
                this.grid[targetKey] = [];
            }
            if (!this.grid[targetKey].includes(sprite)) {
                this.grid[targetKey].push(sprite);
            }
        }
    }
    
    // Check if a position is occupied
    isPositionOccupied(x: number, y: number, excludeSprite: Sprite | null): boolean {
        const key = this.getKey(x, y);
        if (!this.grid[key]) return false;
        
        if (excludeSprite) {
            // Check if any sprite other than the excluded one is at this position
            return this.grid[key].some(sprite => sprite !== excludeSprite);
        } else {
            // Any sprite at this position means it's occupied
            return this.grid[key].length > 0;
        }
    }
    
    // Get all sprites at a position
    getSpritesAt(x: number, y: number): Sprite[] {
        const key = this.getKey(x, y);
        return this.grid[key] || [];
    }
    
    // Clear the entire spatial hash
    clear(): void {
        this.grid = {};
    }
}

// Create a global spatial hash
let spriteMap = new SpatialHash();
let allSprites: any[] = [];

// Function to check if a position is occupied or reserved by a sprite
function isPositionOccupied(x: number, y: number, excludeSprite: any): boolean {
    return spriteMap.isPositionOccupied(x, y, excludeSprite);
}

// Function to check for faction collision and apply damage effect
function checkFactionCollision(sprite: Sprite, targetX: number, targetY: number): boolean {
    // Get sprites at the target position
    const spritesAtTarget = spriteMap.getSpritesAt(targetX, targetY);
    
    // If there are sprites and they're of a different faction, it's a collision
    for (const targetSprite of spritesAtTarget) {
        if (targetSprite !== sprite && targetSprite.faction !== sprite.faction) {
            // Check if attacker's attack cooldown has elapsed
            const now = Date.now();
            const attackCooldown = sprite.isPlayer ? 
                window.gameParams.playerAttackCooldown : 
                window.gameParams.npcAttackCooldown;
                
            if (!sprite.lastAttackTime || now - sprite.lastAttackTime >= attackCooldown) {
                // Apply damage to the target sprite
                applyDamage(sprite, targetSprite);
                // Set attacker's last attack time
                sprite.lastAttackTime = now;
            }
            return true;
        }
    }
    
    return false;
}

// Function to apply damage to a sprite
function applyDamage(attacker: Sprite, target: Sprite) {
    const now = Date.now();
    
    // Apply damage effect immediately (no cooldown on receiving damage)
    target.takingDamage = true;
    target.damageUntil = now + 150; // Show damage effect for 150ms
    
    // Reduce hitpoints
    target.hitpoints -= 1;
    
    console.log(`${target.faction} sprite took damage! Hitpoints: ${target.hitpoints}/${target.maxHitpoints}`);
    
    // Check if the sprite is defeated
    if (target.hitpoints <= 0) {
        handleSpriteDefeat(target);
    }
}

// Add an array to track defeated sprites during their death animation
let dyingSprites: Sprite[] = [];

// Function to handle sprite defeat
function handleSpriteDefeat(sprite: Sprite) {
    console.log(`${sprite.faction} sprite was defeated!`);
    
    // If it's the player, handle game over
    if (sprite.isPlayer) {
        console.log("Game over! Player defeated.");
        // You could add game over logic here
        // For now, we'll just restore player health for demonstration
        sprite.hitpoints = sprite.maxHitpoints;
        console.log("Player respawned with full health!");
    } else {
        // Instead of removing immediately, move to dyingSprites for animation
        const index = allSprites.indexOf(sprite);
        if (index > -1) {
            // Remove from spatial hash first
            spriteMap.remove(sprite);
            
            // Remove from the sprites array
            allSprites.splice(index, 1);
            
            // Make sure the damage effect shows
            sprite.takingDamage = true;
            sprite.damageUntil = Date.now() + 150; // Show damage for 500ms
            
            // Add to dying sprites array
            dyingSprites.push(sprite);
            
            console.log(`${sprite.faction} NPC removed from game. Remaining: ${countNpcsByFaction()[sprite.faction]}`);
        }
    }
}

// Count NPCs by faction
function countNpcsByFaction() {
    const counts = {
        orc: 0,
        undead: 0,
        human: 0
    };
    
    for (const sprite of allSprites) {
        if (!sprite.isPlayer && sprite.faction) {
            counts[sprite.faction]++;
        }
    }
    
    return counts;
}

// New function to respawn NPC adjacent to its faction's fortress
function respawnNpcAdjacentToFortress(faction: string): Sprite | null {
    // Find the fortress for this faction
    const fortress = fortresses.find(f => f.faction === faction);
    if (!fortress) {
        console.warn(`No fortress found for faction: ${faction}`);
        return null;
    }
    
    // Define all 8 possible adjacent positions (including diagonals)
    const adjacentPositions = [
        { x: fortress.x - 1, y: fortress.y - 1 }, // top-left
        { x: fortress.x,     y: fortress.y - 1 }, // top
        { x: fortress.x + 1, y: fortress.y - 1 }, // top-right
        { x: fortress.x - 1, y: fortress.y },     // left
        { x: fortress.x + 1, y: fortress.y },     // right
        { x: fortress.x - 1, y: fortress.y + 1 }, // bottom-left
        { x: fortress.x,     y: fortress.y + 1 }, // bottom
        { x: fortress.x + 1, y: fortress.y + 1 }  // bottom-right
    ];
    
    // Shuffle the positions array for randomness
    for (let i = adjacentPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [adjacentPositions[i], adjacentPositions[j]] = [adjacentPositions[j], adjacentPositions[i]];
    }
    
    // Try each adjacent position until finding a valid one
    for (const pos of adjacentPositions) {
        // Check if position is within map bounds and not occupied
        if (pos.x > 0 && pos.x < window.gameParams.mapWidth - 1 &&
            pos.y > 0 && pos.y < window.gameParams.mapHeight - 1 &&
            !isPositionOccupied(pos.x, pos.y, null)) {
            
            // Select appropriate sprite array based on faction
            let spriteOptions = faction === "orc" ? orc_sprites : undead_sprites;
            let selectedSprite = spriteOptions[Math.floor(Math.random() * spriteOptions.length)];
            
            // Create the sprite with the given position
            const sprite: Sprite = {
                x: pos.x,
                y: pos.y,
                visualX: pos.x,
                visualY: pos.y,
                sprite_x: selectedSprite[0],
                sprite_y: selectedSprite[1],
                target_x: pos.x,
                target_y: pos.y,
                target_time: 250,
                restUntil: 0,
                isPlayer: false,
                faction: faction,
                enemyFactions: faction === "orc" ? ["undead"] : ["orc"],
                maxHitpoints: 1,
                hitpoints: 1,
                lastMoveTime: Date.now(),
                movementDelay: 200 + Math.floor(Math.random() * 400),
                isStructure: false,
                useBackgroundSpritesheet: false
            };
            
            // Add sprite to spatial hash and sprites array
            spriteMap.add(sprite);
            allSprites.push(sprite);
            
            return sprite;
        }
    }
    
    console.warn(`Could not find valid position adjacent to ${faction} fortress`);
    return null;
}

// Modify the checkRespawns function to check fortress status before spawning
function checkRespawns(now: number) {
    const factionCounts = countNpcsByFaction();
    
    // Check orc respawns - only if their fortress exists and is alive
    if (now - lastOrcRespawnCheck >= window.gameParams.orcRespawnRate) {
        lastOrcRespawnCheck = now;
        
        // Find the orc fortress
        const orcFortress = fortresses.find(f => f.faction === "orc");
        
        // Only respawn if fortress exists and has health
        if (orcFortress && orcFortress.hitpoints > 0 && factionCounts.orc < window.gameParams.maxOrcCount) {
            // Spawn exactly one orc adjacent to orc fortress
            const npc = respawnNpcAdjacentToFortress("orc");
            if (npc) {
                console.log(`Respawned an orc adjacent to fortress. Current count: ${factionCounts.orc + 1}`);
            }
        }
    }
    
    // Check undead respawns - only if their fortress exists and is alive
    if (now - lastUndeadRespawnCheck >= window.gameParams.undeadRespawnRate) {
        lastUndeadRespawnCheck = now;
        
        // Find the undead fortress
        const undeadFortress = fortresses.find(f => f.faction === "undead");
        
        // Only respawn if fortress exists and has health
        if (undeadFortress && undeadFortress.hitpoints > 0 && factionCounts.undead < window.gameParams.maxUndeadCount) {
            // Spawn exactly one undead adjacent to undead fortress
            const npc = respawnNpcAdjacentToFortress("undead");
            if (npc) {
                console.log(`Respawned an undead adjacent to fortress. Current count: ${factionCounts.undead + 1}`);
            }
        }
    }
}

// Update the displayPlayerHealth function to return stats instead of modifying window.gameParams directly
function displayPlayerHealth() {
    let statsText = "";
    
    if (sprite1) {
        // Add player health info
        statsText += `Health: ${sprite1.hitpoints}/${sprite1.maxHitpoints}`;
        
        // Add faction counts to stats
        const counts = countNpcsByFaction();
        statsText += ` | Orcs: ${counts.orc}/${window.gameParams.maxOrcCount} | Undead: ${counts.undead}/${window.gameParams.maxUndeadCount}`;
        
        // Add fortress positions and health
        fortresses.forEach(fortress => {
            statsText += ` | ${fortress.faction} fortress: (${fortress.x},${fortress.y}) HP: ${fortress.hitpoints}/${fortress.maxHitpoints}`;
        });
    }
    
    return statsText;
}

// NEW: Function to find the nearest enemy sprite
function findNearestEnemy(sprite: Sprite): Sprite | null {
    if (!sprite.enemyFactions || sprite.enemyFactions.length === 0) {
        return null;
    }
    
    let nearestEnemy: Sprite | null = null;
    let shortestDistance = Infinity;
    
    for (const otherSprite of allSprites) {
        // Skip if it's the same sprite, or if faction is not in enemy list
        if (otherSprite === sprite || !sprite.enemyFactions.includes(otherSprite.faction)) {
            continue;
        }
        
        // Calculate Manhattan distance (more efficient than Euclidean for grid-based movement)
        const distance = Math.abs(sprite.x - otherSprite.x) + Math.abs(sprite.y - otherSprite.y);
        
        // Update nearest enemy if this one is closer
        if (distance < shortestDistance) {
            nearestEnemy = otherSprite;
            shortestDistance = distance;
        }
    }
    
    return nearestEnemy;
}

// NEW: Function to get direction toward target
function getDirectionTowardTarget(fromX: number, fromY: number, toX: number, toY: number) {
    const dx = Math.sign(toX - fromX); // Will be -1, 0, or 1
    const dy = Math.sign(toY - fromY); // Will be -1, 0, or 1
    
    return { dx, dy };
}

// Modify updateSpritePosition to include fallback movement for NPCs
function updateSpritePosition(sprite: Sprite, now: number, interval: number) {
    // Store old positions for spatial hash update
    const oldX = sprite.x;
    const oldY = sprite.y;
    const oldTargetX = sprite.target_x;
    const oldTargetY = sprite.target_y;
    
    // Check if damage effect has expired
    if (sprite.takingDamage && sprite.damageUntil && now >= sprite.damageUntil) {
        sprite.takingDamage = false;
    }
    
    // For structures, skip movement logic and just return current position
    if (sprite.isStructure) {
        return {
            x: sprite.x,
            y: sprite.y
        };
    }
    
    let progress = 1 - ((sprite.target_time - now) / interval);
    if (progress > 1) progress = 1;
    if (progress < 0) progress = 0;
    
    // Calculate visual position for smooth animation
    sprite.visualX = (sprite.x * (1 - progress)) + (sprite.target_x * progress);
    sprite.visualY = (sprite.y * (1 - progress)) + (sprite.target_y * progress);
    
    // Whether we've moved and need to update the spatial hash
    let hasMoved = false;
    
    // For player-controlled sprite, handle input
    if (sprite.isPlayer) {
        // Player movement logic remains unchanged
        if (progress >= 1) {
            // Player has reached target position - update logical position
            sprite.x = sprite.target_x;
            sprite.y = sprite.target_y;
            
            // Check keys in priority order
            for (const key of MOVEMENT_PRIORITY) {
                if (keyState[key]) {
                    const newPos = calculateNewPosition(sprite.x, sprite.y, DIRECTIONS[key]);
                    
                    // Check for faction collision before moving
                    if (checkFactionCollision(sprite, newPos.x, newPos.y)) {
                        // We hit an enemy! Don't move into their space, but continue processing
                        continue;
                    }
                    
                    // Check for collision before moving
                    if (!isPositionOccupied(newPos.x, newPos.y, sprite)) {
                        // ANIMATION FIX: Only update target position, NOT logical position
                        sprite.target_x = newPos.x;
                        sprite.target_y = newPos.y;
                        
                        hasMoved = true;
                        break; // Only take the highest priority direction
                    }
                }
            }
            
            // Only update target time if we actually moved
            if (hasMoved) {
                sprite.target_time = now + interval;
            }
        }
    } else {
        // AI-controlled sprite with ENEMY TARGETING behavior
        if (progress >= 1) {
            // NPC has reached target position
            sprite.x = sprite.target_x;
            sprite.y = sprite.target_y;
            
            // Check if the NPC is in a rest state
            if (!sprite.restUntil || now >= sprite.restUntil) {
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
                        // We hit an enemy! Don't move into their space, but try other directions
                        // Try other directions toward the target in order of priority
                        const alternateDirections = [
                            { dx: direction.dx, dy: 0 },  // horizontal movement
                            { dx: 0, dy: direction.dy },  // vertical movement
                            { dx: -direction.dx, dy: direction.dy }, // opposite horizontal
                            { dx: direction.dx, dy: -direction.dy }  // opposite vertical
                        ];
                        
                        for (const altDir of alternateDirections) {
                            const altPos = calculateNewPosition(sprite.x, sprite.y, altDir);
                            if (!isPositionOccupied(altPos.x, altPos.y, sprite) && 
                                !checkFactionCollision(sprite, altPos.x, altPos.y)) {
                                sprite.target_x = altPos.x;
                                sprite.target_y = altPos.y;
                                hasMoved = true;
                                break;
                            }
                        }
                    } else if (!isPositionOccupied(newPos.x, newPos.y, sprite)) {
                        // If path is clear, move directly toward enemy
                        sprite.target_x = newPos.x;
                        sprite.target_y = newPos.y;
                        hasMoved = true;
                    }
                    
                    // NEW FALLBACK: If still couldn't move, check all 8 adjacent positions
                    if (!hasMoved) {
                        // All possible directions (8 directions including diagonals)
                        const allDirections = [
                            { dx: -1, dy: -1 }, // top-left
                            { dx:  0, dy: -1 }, // top
                            { dx:  1, dy: -1 }, // top-right
                            { dx: -1, dy:  0 }, // left
                            { dx:  1, dy:  0 }, // right
                            { dx: -1, dy:  1 }, // bottom-left
                            { dx:  0, dy:  1 }, // bottom
                            { dx:  1, dy:  1 }  // bottom-right
                        ];
                        
                        // Shuffle directions for randomness
                        for (let i = allDirections.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [allDirections[i], allDirections[j]] = [allDirections[j], allDirections[i]];
                        }
                        
                        // Try each direction
                        for (const dir of allDirections) {
                            const pos = calculateNewPosition(sprite.x, sprite.y, dir);
                            if (!isPositionOccupied(pos.x, pos.y, sprite) && 
                                !checkFactionCollision(sprite, pos.x, pos.y)) {
                                // Found a valid move - take it
                                sprite.target_x = pos.x;
                                sprite.target_y = pos.y;
                                hasMoved = true;
                                break;
                            }
                        }
                    }
                } else {
                    // No visible enemies, move randomly as before
                    let attempts = 0;
                    
                    while (!hasMoved && attempts < 8) {
                        // Generate random direction (-1, 0, or 1 for both x and y)
                        const randomDirection = {
                            dx: -1 + Math.floor(Math.random() * 3),
                            dy: -1 + Math.floor(Math.random() * 3)
                        };
                        
                        // Apply the same bounds-checking logic as player movement
                        const newPos = calculateNewPosition(sprite.x, sprite.y, randomDirection);
                        
                        // Check for faction collision before moving
                        if (checkFactionCollision(sprite, newPos.x, newPos.y)) {
                            // We hit an enemy! Don't move into their space, but continue processing
                            attempts++;
                            continue;
                        }
                        
                        // Check for collision before moving
                        if (!isPositionOccupied(newPos.x, newPos.y, sprite)) {
                            sprite.target_x = newPos.x;
                            sprite.target_y = newPos.y;
                            hasMoved = true;
                        }
                        
                        attempts++;
                    }
                }
                
                // Update timing for this move
                if (hasMoved) {
                    sprite.target_time = now + interval;
                    sprite.restUntil = now + interval + sprite.movementDelay;
                } else {
                    // If no valid move was found, try again later
                    sprite.restUntil = now + 250;
                }
            }
        }
    }
    
    // Update spatial hash if any position changed
    if (sprite.x !== oldX || sprite.y !== oldY || 
        sprite.target_x !== oldTargetX || sprite.target_y !== oldTargetY) {
        // Update the spatial hash with all old and new positions
        spriteMap.update(sprite, oldX, oldY, oldTargetX, oldTargetY);
    }

    // Return visual position for rendering only
    return {
        x: sprite.visualX,
        y: sprite.visualY
    };
}

let undead_sprites = [[7,2],[9,2],[6,3],[8,3],[10,3]]
let orc_sprites = [[4,9],[6,9],[3,10],[5,10],[7,10],[4,11],[6,11]]
let human_sprites = [[9,15],[11,15],[13,15],[8,16],[10,16],[12,16],[9,17],[11,17]]

function initializeSpritePosition(isPlayer = false, faction = "human") {
    let rand_x, rand_y;
    let isValidPosition = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    
    // If it's the player, keep the original random placement
    if (isPlayer) {
        while (!isValidPosition && attempts < MAX_ATTEMPTS) {
            rand_x = Math.floor(Math.random() * (window.gameParams.mapWidth - 2)) + 1;
            rand_y = Math.floor(Math.random() * (window.gameParams.mapHeight - 2)) + 1;
            isValidPosition = !isPositionOccupied(rand_x, rand_y, null);
            attempts++;
        }
    } 
    // For NPCs (enemies), place them along the edges but not on walls
    else {
        while (!isValidPosition && attempts < MAX_ATTEMPTS) {
            // Decide which edge to spawn on (0=top, 1=right, 2=bottom, 3=left)
            const edge = Math.floor(Math.random() * 4);
            
            switch (edge) {
                case 0: // Top edge
                    rand_x = Math.floor(Math.random() * (window.gameParams.mapWidth - 4)) + 2;
                    rand_y = 1;
                    break;
                case 1: // Right edge
                    rand_x = window.gameParams.mapWidth - 2;
                    rand_y = Math.floor(Math.random() * (window.gameParams.mapHeight - 4)) + 2;
                    break;
                case 2: // Bottom edge
                    rand_x = Math.floor(Math.random() * (window.gameParams.mapWidth - 4)) + 2;
                    rand_y = window.gameParams.mapHeight - 2;
                    break;
                case 3: // Left edge
                    rand_x = 1;
                    rand_y = Math.floor(Math.random() * (window.gameParams.mapHeight - 4)) + 2;
                    break;
            }
            
            isValidPosition = !isPositionOccupied(rand_x, rand_y, null);
            attempts++;
        }
    }
    
    if (!isValidPosition) {
        console.warn("Could not find a valid position for sprite after multiple attempts");
        return null;
    }
    
    let selectedSprite;
    
    // Choose sprite based on faction
    if (faction === "human") {
        selectedSprite = human_sprites[Math.floor(Math.random() * human_sprites.length)];
    } else if (faction === "undead") {
        selectedSprite = undead_sprites[Math.floor(Math.random() * undead_sprites.length)];
    } else if (faction === "orc") {
        selectedSprite = orc_sprites[Math.floor(Math.random() * orc_sprites.length)];
    } else {
        console.warn(`Unknown faction: ${faction}, defaulting to human`);
        selectedSprite = human_sprites[Math.floor(Math.random() * human_sprites.length)];
        faction = "human";
    }
    
    // Define enemy factions based on this sprite's faction
    let enemyFactions: string[] = [];
    if (faction === "orc") {
        enemyFactions = ["undead"];
    } else if (faction === "undead") {
        enemyFactions = ["orc"];
    } else if (faction === "human" && isPlayer) {
        enemyFactions = ["orc", "undead"]; // Player can attack both
    }
    // Regular humans don't attack anyone
    
    const sprite = {
        x: rand_x,
        y: rand_y,
        visualX: rand_x,
        visualY: rand_y,
        sprite_x: selectedSprite[0],
        sprite_y: selectedSprite[1],
        target_x: rand_x,
        target_y: rand_y,
        target_time: 250,
        restUntil: 0,
        isPlayer: isPlayer,
        faction: faction,
        enemyFactions: enemyFactions, // Add the enemy factions list
        maxHitpoints: isPlayer ? 5 : 1,
        hitpoints: isPlayer ? 5 : 1,
        lastMoveTime: Date.now(),
        movementDelay: isPlayer ? 0 : 200 + Math.floor(Math.random() * 400),
        isStructure: false,
        useBackgroundSpritesheet: false
    };
    
    // Add sprite to spatial hash
    spriteMap.add(sprite);
    allSprites.push(sprite);
    
    return sprite;
}

let display: WebGLDisplay;
let sprite1: any; // Player sprite
let lastFrameTime: number;
let performanceDiv: HTMLDivElement;
let lastMapUpdateTime: number;
let lastNpcCount: number | null = null;

// Add a flag to detect map size changes
// This will be initialized properly once gameParams is available
let lastMapSize: number | null = null;

function draw_frame(timestamp: number) {
    // If window.gameParams is not yet initialized, just draw the next frame
    if (!window.gameParams) {
        console.log("Waiting for gameParams to be initialized...");
        requestAnimationFrame(draw_frame);
        return;
    }

    // Initialize our tracking variables on first run
    if (lastMapSize === null) {
        lastMapSize = window.gameParams.mapSize;
    }
    
    const frameStartTime = performance.now();

    const gl = display.gl;
    const tileSetTexture = display.tileSetTexture;
    const tileMap = display.tileMapTexture;
    const fgProgram = display.fgProgram;
    const bgProgram = display.bgProgram;
    const lightProgram = display.lightProgram;

    // Clear the canvas
    gl.clear(gl.COLOR_BUFFER_BIT);

    let now = Date.now();

    // Check for respawns based on respawn rates
    checkRespawns(now);

    // Check if map size has changed and regenerate map if needed
    if (lastMapSize !== window.gameParams.mapSize) {
        console.log("Map size changed, regenerating map");
        window.gameParams.mapWidth = window.gameParams.mapSize;
        window.gameParams.mapHeight = window.gameParams.mapSize;
        let newMap = makeMap();
        display.loadTilemap(newMap, window.gameParams.mapWidth, window.gameParams.mapHeight);
        lastMapSize = window.gameParams.mapSize;
        
        // Reset sprite positions when map changes
        resetSpritePositions();
    }

    // Update and get player position
    let sprite1Pos = updateSpritePosition(sprite1, now, window.gameParams.moveSpeed);
    
    // Update positions for all sprites
    let spritePositions = [sprite1Pos];
    
    // Update all other sprites (NPCs)
    for (let i = 1; i < allSprites.length; i++) {
        let spritePos = updateSpritePosition(allSprites[i], now, window.gameParams.moveSpeed);
        spritePositions.push(spritePos);
    }

    let camera_pos_x = sprite1Pos.x;
    let camera_pos_y = sprite1Pos.y;

    // Add detailed logging for debugging
    // console.log("Camera position:", camera_pos_x, camera_pos_y);
    // console.log("Map dimensions:", window.gameParams.mapWidth, window.gameParams.mapHeight);
    
    try {
        display.drawBackground(sprite1Pos.x, sprite1Pos.y);
        // console.log("Background drawn successfully"); // Remove debug logging
    } catch (e) {
        console.error("Error drawing background:", e);
    }
    
    // Update and display player health
    const healthAndFactionStats = displayPlayerHealth();
    if (healthAndFactionStats) {
        console.log(healthAndFactionStats);
    }
    
    // Draw all sprites
    for (let i = 0; i < allSprites.length; i++) {
        const sprite = allSprites[i];
        const spritePos = spritePositions[i];
        
        // Define a blue aura color for the player
        const auraColor = sprite.isPlayer ? 
            [0.0, 0.0, 0.0, 0.0] :  // No aura for player
            [0.0, 0.0, 0.0, 0.0];  // No aura for other sprites
        
        // Draw the sprite using the appropriate spritesheet
        display.drawForeground(
            sprite.sprite_x, 
            sprite.sprite_y, 
            sprite.visualX, 
            sprite.visualY, 
            camera_pos_x, 
            camera_pos_y, 
            sprite.useBackgroundSpritesheet === true, // Use bg spritesheet if specified
            auraColor // Pass the aura color
        );
        
        // If this sprite is taking damage, draw the damage effect from bg tileset
        if (sprite.takingDamage) {
            // Draw damage sprite (at position 1,3 in bg tileset)
            display.drawForeground(
                1,  // sprite_x - damage sprite X position
                3,  // sprite_y - damage sprite Y position
                spritePos.x,
                spritePos.y,
                camera_pos_x,
                camera_pos_y,
                true // Use background tileset
            );
        }
        
        // If it's the player, optionally draw health indicators
        if (sprite.isPlayer) {
            // You could draw health indicators around the player
            // For example, small hearts or a health bar
        }
    }
    
    // Process and draw dying sprites
    const currentTime = Date.now();
    for (let i = dyingSprites.length - 1; i >= 0; i--) {
        const dyingSprite = dyingSprites[i];
        
        // Draw the sprite (no aura for dying sprites)
        display.drawForeground(
            dyingSprite.sprite_x, 
            dyingSprite.sprite_y, 
            dyingSprite.x, 
            dyingSprite.y, 
            camera_pos_x, 
            camera_pos_y,
            false, // Use foreground tileset
            [0.0, 0.0, 0.0, 0.0] // No aura
        );
        
        // Always draw the damage effect for dying sprites
        display.drawForeground(
            1,  // sprite_x - damage sprite X position 
            3,  // sprite_y - damage sprite Y position
            dyingSprite.x,
            dyingSprite.y,
            camera_pos_x,
            camera_pos_y,
            true // Use background tileset
        );
        
        // Remove from dyingSprites array when animation completes
        if (currentTime >= dyingSprite.damageUntil) {
            dyingSprites.splice(i, 1);
        }
    }
    
    // Use the lighting parameter - we'll add light sources for each NPC
    if (window.gameParams.lightingEnabled) {
        // First call with player position
        display.drawLighting(sprite1Pos.x, sprite1Pos.y, 
                           sprite1Pos.x, sprite1Pos.y, 
                           camera_pos_x, camera_pos_y);
        
        // Add additional light sources for NPCs if needed
        // This depends on how your drawLighting function is implemented
        // If it only supports two light sources, we'll just use the first NPC
        if (allSprites.length > 1) {
            const npc = allSprites[1];
            const npcPos = spritePositions[1];
            display.drawLighting(sprite1Pos.x, sprite1Pos.y, 
                               npcPos.x, npcPos.y, 
                               camera_pos_x, camera_pos_y);
        }
    }

    const frameEndTime = performance.now();
    const frameDuration = frameEndTime - frameStartTime;
    const fps = 1000 / (frameEndTime - lastFrameTime);

    // First set the base performance metrics
    let performanceStats = `Render time: ${frameDuration.toFixed(2)}ms | FPS: ${fps.toFixed(2)}`;
    
    // Then add player health and faction information using a differently named variable
    const statsInfo = displayPlayerHealth();
    if (statsInfo && statsInfo.length > 0) {
        performanceStats += ` | ${statsInfo}`;
    }
    
    // Finally update the window.gameParams
    window.gameParams.performanceStats = performanceStats;

    lastFrameTime = frameEndTime;
    requestAnimationFrame(draw_frame);
}

// Modify resetSpritePositions to handle fortresses properly
function resetSpritePositions() {
    console.log("Resetting sprite positions...");
    
    // Clear existing sprites and spatial hash
    spriteMap.clear();
    allSprites = [];
    fortresses = []; // Clear fortresses array
    dyingSprites = []; // Clear dying sprites too
    
    // Re-initialize player sprite as human with 5 hitpoints
    sprite1 = initializeSpritePosition(true, "human");
    
    // Make sure player is first in the allSprites array
    allSprites[0] = sprite1;
    
    // Initialize orcs
    const maxOrcCount = window.gameParams.maxOrcCount || 5;
    for (let i = 0; i < maxOrcCount; i++) {
        const npc = initializeSpritePosition(false, "orc");
        if (npc) {
            npc.movementDelay = 200 + Math.floor(Math.random() * 400);
        }
    }
    
    // Initialize undead
    const maxUndeadCount = window.gameParams.maxUndeadCount || 5;
    for (let i = 0; i < maxUndeadCount; i++) {
        const npc = initializeSpritePosition(false, "undead");
        if (npc) {
            npc.movementDelay = 200 + Math.floor(Math.random() * 400);
        }
    }
    
    console.log("About to spawn fortresses in resetSpritePositions...");
    // Explicitly spawn fortresses
    spawnFortresses();
    
    // Initialize lastRespawnCheck timestamps
    lastOrcRespawnCheck = Date.now();
    lastUndeadRespawnCheck = Date.now();
    
    console.log(`Reset positions. Player: 1, Orcs: ${maxOrcCount}, Undead: ${maxUndeadCount}, Fortresses: ${fortresses.length}`);
}

// Function to get fortress at position (if any)
function getFortressAt(x: number, y: number): Sprite | null {
    return fortresses.find(fortress => fortress.x === x && fortress.y === y) || null;
}

// Replace updateNpcCount with functions to update max counts if needed
function updateMaxOrcCount(newCount: number) {
    const currentCounts = countNpcsByFaction();
    const currentOrcCount = currentCounts.orc;
    
    if (newCount > currentOrcCount) {
        // Add more orcs if the new max is higher
        for (let i = 0; i < newCount - currentOrcCount; i++) {
            const npc = initializeSpritePosition(false, "orc");
            if (npc) {
                npc.movementDelay = 200 + Math.floor(Math.random() * 400);
            }
        }
    } else if (newCount < currentOrcCount) {
        // Remove orcs if the new max is lower
        let removed = 0;
        for (let i = allSprites.length - 1; i >= 0; i--) {
            if (!allSprites[i].isPlayer && allSprites[i].faction === "orc") {
                spriteMap.remove(allSprites[i]);
                allSprites.splice(i, 1);
                removed++;
                if (removed >= currentOrcCount - newCount) break;
            }
        }
    }
}

function updateMaxUndeadCount(newCount: number) {
    const currentCounts = countNpcsByFaction();
    const currentUndeadCount = currentCounts.undead;
    
    if (newCount > currentUndeadCount) {
        // Add more undead if the new max is higher
        for (let i = 0; i < newCount - currentUndeadCount; i++) {
            const npc = initializeSpritePosition(false, "undead");
            if (npc) {
                npc.movementDelay = 200 + Math.floor(Math.random() * 400);
            }
        }
    } else if (newCount < currentUndeadCount) {
        // Remove undead if the new max is lower
        let removed = 0;
        for (let i = allSprites.length - 1; i >= 0; i--) {
            if (!allSprites[i].isPlayer && allSprites[i].faction === "undead") {
                spriteMap.remove(allSprites[i]);
                allSprites.splice(i, 1);
                removed++;
                if (removed >= currentUndeadCount - newCount) break;
            }
        }
    }
}

// Update the setup function to use max counts
async function setup(fgTilesetBlobUrl: string, bgTilesetBlobUrl: string | null) {
    // Wait for gameParams to be available if needed
    if (!window.gameParams) {
        console.log("Waiting for gameParams before setup...");
        setTimeout(() => setup(fgTilesetBlobUrl, bgTilesetBlobUrl), 100);
        return;
    }

    const canvas = document.createElement("canvas");
    
    function resizeCanvas() {
        const canvasSize = Math.min(600, window.innerWidth * 0.9);
        
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        
        canvas.style.display = "block";
        canvas.style.margin = "auto";
        canvas.style.width = `${canvasSize}px`;
        canvas.style.height = `${canvasSize}px`;
        
        if (display) {
            display.resize(canvasSize, canvasSize);
        }
    }

    // Initial setup
    resizeCanvas();
    
    // Append canvas to the dedicated game canvas container
    const gameCanvasContainer = document.getElementById("game-canvas-container");
    if (gameCanvasContainer) {
        gameCanvasContainer.appendChild(canvas);
    } else {
        // Fallback to body if container doesn't exist
        document.body.appendChild(canvas);
    }

    // Initialize WebGLDisplay with both tilesets
    display = new WebGLDisplay(canvas, {});
    
    await display.initialize(fgTilesetBlobUrl, bgTilesetBlobUrl);

    console.log("WebGLDisplay initialized with both tilesets");

    // Add resize event listener
    window.addEventListener('resize', resizeCanvas);

    // Apply map size parameter to ensure width and height are in sync
    window.gameParams.mapWidth = window.gameParams.mapSize || window.gameParams.mapWidth;
    window.gameParams.mapHeight = window.gameParams.mapSize || window.gameParams.mapHeight;

    // Create initial map
    let map = makeMap();
    
    console.log("Loading initial map into display");
    console.log("Map data sample:", map.slice(0, 20));
    console.log("Map dimensions for display:", window.gameParams.mapWidth, window.gameParams.mapHeight);
    
    try {
        display.loadTilemap(map, window.gameParams.mapWidth, window.gameParams.mapHeight);
        console.log("Tilemap loaded successfully");
    } catch (e) {
        console.error("Error loading tilemap:", e);
    }

    // Clear existing sprites and spatial hash before initializing
    spriteMap.clear();
    allSprites = [];

    // Initialize player sprite as human
    sprite1 = initializeSpritePosition(true, "human");
    
    // Make sure player is first in the allSprites array
    allSprites[0] = sprite1;
    
    // Initialize orcs
    const maxOrcCount = window.gameParams.maxOrcCount || 5;
    for (let i = 0; i < maxOrcCount; i++) {
        const npc = initializeSpritePosition(false, "orc");
        if (npc) {
            npc.movementDelay = 200 + Math.floor(Math.random() * 400);
        }
    }
    
    // Initialize undead
    const maxUndeadCount = window.gameParams.maxUndeadCount || 5;
    for (let i = 0; i < maxUndeadCount; i++) {
        const npc = initializeSpritePosition(false, "undead");
        if (npc) {
            npc.movementDelay = 200 + Math.floor(Math.random() * 400);
        }
    }
    
    console.log("About to spawn fortresses...");
    // Explicitly spawn fortresses here
    spawnFortresses();
    
    // Initialize lastRespawnCheck timestamps
    lastOrcRespawnCheck = Date.now();
    lastUndeadRespawnCheck = Date.now();

    // Set up keyboard event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    lastFrameTime = performance.now();
    lastMapUpdateTime = Date.now();

    // Ensure attack cooldown parameters exist with defaults if not set
    if (window.gameParams.playerAttackCooldown === undefined) {
        window.gameParams.playerAttackCooldown = 400; // 800ms default for player attacks
    }
    if (window.gameParams.npcAttackCooldown === undefined) {
        window.gameParams.npcAttackCooldown = 400; // 1200ms default for NPC attacks
    }

    console.log("Starting animation loop");
    requestAnimationFrame(draw_frame);
}

function makeMap() {
    let options = [
        [27,7],
        [28,7],
        [29,7],
        [30,7],
        [31,7],
        [22,7],
        [22,7],
        [22,7]
    ]
    
    // Use params with fallbacks to ensure we always have valid values
    const mapWidth = window.gameParams?.mapWidth || 10;
    const mapHeight = window.gameParams?.mapHeight || 10;
    const grid_size = mapWidth * mapHeight;
    
    console.log(`Creating map with dimensions: ${mapWidth}x${mapHeight}, total tiles: ${grid_size}`);
    
    let map = []
    
    for (let i = 0; i < grid_size; i++) {
        if ((i % mapWidth == 0) || (i % mapWidth == mapWidth-1)) {
            map.push(1,1)
        } else if (i <= mapWidth-1 || i >= grid_size - mapWidth) {
            map.push(2,1);                
        } else {
            let r = Math.floor(Math.random() * options.length);
            let o = options[r];
            map.push(o[0],o[1]);          
        }
    }
    
    // Remove or condense debug logging
    // console.log("Map first few tiles:", map.slice(0, 20));
    // console.log("Map length:", map.length, "Expected:", grid_size * 2);
    
    return map;    
}

console.log("hello test world?");
init();

// Add TypeScript declaration for window.gameParams if it doesn't exist in this file
declare global {
  interface Window {
    gameParams: {
      moveSpeed: number;
      lightingEnabled: boolean;
      performanceStats: string;
      zoom: number;
      mapWidth: number;
      mapHeight: number;
      mapSize: number;
      maxOrcCount: number;
      maxUndeadCount: number;
      orcRespawnRate: number;
      undeadRespawnRate: number;
      playerAttackCooldown: number; // New: player attack cooldown in ms
      npcAttackCooldown: number;    // New: NPC attack cooldown in ms
    };
  }
}

// Add these functions to handle keyboard input
function handleKeyDown(event: KeyboardEvent) {
    // Prevent default actions like scrolling with arrow keys
    if (['w', 'a', 's', 'd', 'q', 'e', 'z', 'c'].includes(event.key.toLowerCase())) {
        event.preventDefault();
    }
    
    switch (event.key.toLowerCase()) {
        case 'w': keyState.w = true; break;
        case 'a': keyState.a = true; break;
        case 's': keyState.s = true; break;
        case 'd': keyState.d = true; break;
        case 'q': keyState.q = true; break;
        case 'e': keyState.e = true; break;
        case 'z': keyState.z = true; break;
        case 'c': keyState.c = true; break;
    }
}

function handleKeyUp(event: KeyboardEvent) {
    switch (event.key.toLowerCase()) {
        case 'w': keyState.w = false; break;
        case 'a': keyState.a = false; break;
        case 's': keyState.s = false; break;
        case 'd': keyState.d = false; break;
        case 'q': keyState.q = false; break;
        case 'e': keyState.e = false; break;
        case 'z': keyState.z = false; break;
        case 'c': keyState.c = false; break;
    }
}


