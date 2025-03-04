import * as Crypto from "crypto-js";
import { WebGLDisplay } from "./display/WebGLDisplay";
import * as glu from "./display/GLUtils";
import { Sprite, Entity, GameObject, Visual, AIAction, ActionType } from './types';
import * as AI from './ai';
import { 
    animationManager, 
    updateAnimations, 
    triggerMoveAnimation, 
    triggerDamageAnimation, 
    triggerDeathAnimation 
} from './animation';

// Add variables to track last respawn check times
let lastOrcRespawnCheck = Date.now();
let lastUndeadRespawnCheck = Date.now();

function init() {
    console.log("about to load sprite sheets")
    
    // Load both sprite sheets
    loadSpriteSheets();
}

// Load the foreground and background sprite sheets
function loadSpriteSheets() {
    // First sprite sheet (foreground characters)
    let fgReq = new XMLHttpRequest();
    let fgReqUrl = "fg_characters.png"; // New foreground sprite sheet
    
    // Second sprite sheet (background tiles)
    let bgReqUrl = "bg_edits_2.png"; // New background sprite sheet
    
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
function calculateNewPosition(x: number, y: number, direction: {dx: number, dy: number}) {
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

// Track fortresses for easy reference
let fortresses: Sprite[] = [];

// Track champions per faction
let orcChampions = 0;
let undeadChampions = 0;

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
        prev_x: orcFortressX,
        prev_y: orcFortressY,
        animationEndTime: 0,
        restUntil: 0,
        isPlayer: false,
        isStructure: true, // Mark as structure (immobile)
        faction: "orc",
        enemyFactions: ["undead", "human"], // Enemies of the orc faction
        maxHitpoints: 20, // Fortresses have more hitpoints
        hitpoints: 20,
        lastMoveTime: 0,
        movementDelay: 0,
        useBackgroundSpritesheet: true, // Use background spritesheet
        isChampion: false
    };
    
    // Create undead fortress
    const undeadFortress: Sprite = {
        x: undeadFortressX,
        y: undeadFortressY,
        visualX: undeadFortressX,
        visualY: undeadFortressY,
        sprite_x: 10,
        sprite_y: 22,
        prev_x: undeadFortressX,
        prev_y: undeadFortressY,
        animationEndTime: 0,
        restUntil: 0,
        isPlayer: false,
        isStructure: true, // Mark as structure (immobile)
        faction: "undead",
        enemyFactions: ["orc", "human"], // Enemies of the undead faction
        maxHitpoints: 20, // Fortresses have more hitpoints
        hitpoints: 20,
        lastMoveTime: 0,
        movementDelay: 0,
        useBackgroundSpritesheet: true, // Use background spritesheet
        isChampion: false
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

// Simplified spatial hash implementation
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
    }
    
    // Update a sprite's position in the spatial hash
    updatePosition(sprite: Sprite, newX: number, newY: number): void {
        // Remove from old position
        this.remove(sprite);
        
        // Update the sprite's position
        sprite.x = newX;
        sprite.y = newY;
        
        // Add to new position
        this.add(sprite);
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
function checkFactionCollision(entity: Sprite, targetX: number, targetY: number): boolean {
    // Get sprites at the target position
    const spritesAtTarget = spriteMap.getSpritesAt(targetX, targetY);
    
    // If there are sprites and they're of a different faction, it's a collision
    for (const targetSprite of spritesAtTarget) {
        if (targetSprite !== entity && 
            entity.enemyFactions && 
            entity.enemyFactions.includes(targetSprite.faction)) {
            
            // Check if attacker's attack cooldown has elapsed
            const now = Date.now();
            const attackCooldown = entity.isPlayer ? 
                window.gameParams.playerAttackCooldown : 
                window.gameParams.npcAttackCooldown;
                
            if (!entity.lastAttackTime || now - entity.lastAttackTime >= attackCooldown) {
                // Apply damage to the target sprite
                applyDamage(entity, targetSprite);
                // Set attacker's last attack time
                entity.lastAttackTime = now;
                
                // Special message for fortress attacks
                if (targetSprite.isStructure) {
                    console.log(`${entity.faction} ${entity.isChampion ? "champion" : "unit"} attacked ${targetSprite.faction} fortress!`);
                }
                
                // Only return true (preventing movement) if the target wasn't killed
                // If target was killed, the attacker will move into its space
                return targetSprite.hitpoints > 0;
            }
            return true;
        }
    }
    
    return false;
}

// Add an array to track defeated sprites during their death animation
let dyingSprites: Sprite[] = [];

// Function to handle sprite defeat
function handleSpriteDefeat(sprite: Sprite, attacker: Sprite | null) {
    console.log(`${sprite.faction} sprite defeated!`);
    
    // Update champion count if necessary
    if (sprite.isChampion) {
        if (sprite.faction === "orc") {
            orcChampions--;
        } else if (sprite.faction === "undead") {
            undeadChampions--;
        }
    }
    
    // If it's the player, handle game over
    if (sprite.isPlayer) {
        console.log("Game over! Player defeated.");
        
        // Update game UI state
        window.gameUI.currentScreen = "gameOver";
        window.gameUI.screenData = {
            message: "Game Over!",
            score: calculateScore(),
            playerFaction: window.gameUI.screenData.playerFaction // Preserve existing faction
        };
    } else {
        // Store the position of the defeated sprite before removing it
        const defeatedX = sprite.x;
        const defeatedY = sprite.y;
        
        // Define the death animation duration
        const deathDuration = 300; // Same as the default in triggerDeathAnimation
        
        // Create a copy of the sprite with proper animation timing
        const dyingSpriteCopy = {...sprite, 
            takingDamage: true,
            damageUntil: Date.now() + deathDuration
        };
        
        // Add to dyingSprites array for death animation
        dyingSprites.push(dyingSpriteCopy);
        
        // Trigger death animation on the original sprite
        // This isn't strictly necessary since we're removing it,
        // but we keep it for consistency with the animation system
        triggerDeathAnimation(sprite);
        
        // Remove from spatial hash immediately
        spriteMap.remove(sprite);
        
        // Remove from the sprites array
        const index = allSprites.indexOf(sprite);
        if (index > -1) {
            allSprites.splice(index, 1);
            
            console.log(`${sprite.faction} NPC removed from game. Remaining: ${countNpcsByFaction()[sprite.faction]}`);
            
            // If we have an attacker, immediately move them into the defeated sprite's position
            if (attacker && !attacker.isStructure) {
                console.log(`Moving ${attacker.faction} attacker to position (${defeatedX}, ${defeatedY})`);
                
                // Save previous position
                const prevX = attacker.x;
                const prevY = attacker.y;
                
                // Update logical position
                spriteMap.updatePosition(attacker, defeatedX, defeatedY);
                
                // Trigger animation
                triggerMoveAnimation(attacker, prevX, prevY, defeatedX, defeatedY, window.gameParams.moveSpeed);
            }
        }
    }
}

// Add a function to calculate score (simple example)
function calculateScore() {
    // Simple score based on game time and enemy defeats
    const factionCounts = countNpcsByFaction();
    const initialEnemies = window.gameParams.maxOrcCount + window.gameParams.maxUndeadCount;
    const remainingEnemies = factionCounts.orc + factionCounts.undead;
    const defeatedEnemies = initialEnemies - remainingEnemies;
    
    return defeatedEnemies * 10; // 10 points per defeated enemy
}

// Update resetGame function to return to faction selection screen
window.resetGame = function() {
    console.log("Resetting game after Game Over...");
    
    // Reset player health if they died
    if (sprite1 && sprite1.hitpoints <= 0) {
        sprite1.hitpoints = sprite1.maxHitpoints;
    }
    
    // Switch to faction selection screen instead of restarting with same faction
    window.gameUI.currentScreen = "factionSelect";
    
    // Clear player faction to force new selection
    window.gameUI.screenData.playerFaction = null;
    
    // Note: The actual game state will be reset when startGameWithFaction is called
    // after the player selects a faction
    
    console.log("Game reset complete - returning to faction select screen");
};

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
            
            // Determine if this should be a champion based on spawn chance parameter
            let isChampion = false;
            if (faction === "orc") {
                // Use the new parameter for orc champion spawn chance
                const spawnChance = window.gameParams.orcChampionSpawnChance / 100; // Convert to probability
                if (Math.random() < spawnChance && orcChampions < window.gameParams.maxOrcChampions) {
                    isChampion = true;
                    orcChampions++;
                    console.log(`Respawned an Orc Champion! Current Orc champions: ${orcChampions}/${window.gameParams.maxOrcChampions}`);
                }
            } else if (faction === "undead") {
                // Use the new parameter for undead champion spawn chance
                const spawnChance = window.gameParams.undeadChampionSpawnChance / 100; // Convert to probability
                if (Math.random() < spawnChance && undeadChampions < window.gameParams.maxUndeadChampions) {
                    isChampion = true;
                    undeadChampions++;
                    console.log(`Respawned an Undead Champion! Current Undead champions: ${undeadChampions}/${window.gameParams.maxUndeadChampions}`);
                }
            }
            
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
                prev_x: pos.x,
                prev_y: pos.y,
                animationEndTime: 250,
                restUntil: 0,
                isPlayer: false,
                faction: faction,
                enemyFactions: faction === "orc" ? ["undead"] : ["orc"],
                maxHitpoints: isChampion ? 5 : 1,
                hitpoints: isChampion ? 5 : 1,
                lastMoveTime: Date.now(),
                movementDelay: 200 + Math.floor(Math.random() * 400),
                isStructure: false,
                useBackgroundSpritesheet: false,
                isChampion: isChampion,
                takingDamage: false,
                damageUntil: undefined
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

// Update the displayPlayerHealth function to show max champions from parameters
function displayPlayerHealth() {
    let statsText = "";
    
    if (sprite1) {
        // Add player health info
        statsText += `Health: ${sprite1.hitpoints}/${sprite1.maxHitpoints}`;
        
        // Add faction counts to stats
        const counts = countNpcsByFaction();
        statsText += ` | Orcs: ${counts.orc}/${window.gameParams.maxOrcCount} | Undead: ${counts.undead}/${window.gameParams.maxUndeadCount}`;
        
        // Add champion counts to stats with max from parameters
        statsText += ` | Champions: Orc ${orcChampions}/${window.gameParams.maxOrcChampions}, Undead ${undeadChampions}/${window.gameParams.maxUndeadChampions}`;
        
        // Add fortress positions and health
        fortresses.forEach(fortress => {
            statsText += ` | ${fortress.faction} fortress: (${fortress.x},${fortress.y}) HP: ${fortress.hitpoints}/${fortress.maxHitpoints}`;
        });
    }
    
    return statsText;
}

// NEW: Function to find nearest fortress for champions
function findNearestFortress(sprite: Entity, maxDistance: number = 2): Entity | null {
    if (!sprite.enemyFactions || sprite.enemyFactions.length === 0) {
        return null;
    }
    
    // Only look for fortresses of enemy factions
    const enemyFortresses = fortresses.filter(f => sprite.enemyFactions.includes(f.faction));
    
    let nearestFortress: Entity | null = null;
    let shortestDistance = Infinity;
    
    for (const fortress of enemyFortresses) {
        // Calculate Manhattan distance
        const distance = Math.abs(sprite.x - fortress.x) + Math.abs(sprite.y - fortress.y);
        
        // If within our max distance and closer than any previous fortress
        if (distance <= maxDistance && distance < shortestDistance) {
            nearestFortress = fortress;
            shortestDistance = distance;
        }
    }
    
    return nearestFortress;
}

// Modify the findNearestEnemy function to make champions prioritize fortresses
function findNearestEnemy(sprite: Entity): Entity | null {
    if (!sprite.enemyFactions || sprite.enemyFactions.length === 0) {
        return null;
    }
    
    // CHAMPIONS: Check for nearby fortresses first if this sprite is a champion
    if (sprite.isChampion) {
        const nearbyFortress = findNearestFortress(sprite, 2);
        if (nearbyFortress) {
            // Champion found an enemy fortress within range, prioritize it!
            return nearbyFortress;
        }
    }
    
    // If no fortress is targeted (or not a champion), continue with normal enemy finding
    let nearestEnemy: Entity | null = null;
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

// Function to update player or NPC position
function updateSpritePosition(sprite: Sprite, now: number, interval: number) {
    // For structures, skip movement logic and just return current position
    if (sprite.isStructure) {
        // Call fortress AI function (even though they don't move)
        const action = AI.updateFortressAI(sprite);
        // We don't do anything with fortress actions currently
        return {
            x: sprite.visualX,
            y: sprite.visualY
        };
    }
    
    // For player-controlled sprite, handle input
    if (sprite.isPlayer) {
        // Only process input if no animation is currently running
        if (now >= sprite.animationEndTime) {
            // Check keys in priority order
            for (const key of MOVEMENT_PRIORITY) {
                if (keyState[key]) {
                    const newPos = calculateNewPosition(sprite.x, sprite.y, DIRECTIONS[key]);
                    
                    // Check for faction collision before moving
                    if (checkFactionCollision(sprite, newPos.x, newPos.y)) {
                        // We hit an enemy! Don't move into their space
                        continue;
                    }
                    
                    // Check for collision before moving
                    if (!isPositionOccupied(newPos.x, newPos.y, sprite)) {
                        // Save previous position
                        const prevX = sprite.x;
                        const prevY = sprite.y;
                        
                        // Update the spatial hash immediately
                        spriteMap.updatePosition(sprite, newPos.x, newPos.y);
                        
                        // Trigger animation with separate game and visual state
                        triggerMoveAnimation(sprite, prevX, prevY, newPos.x, newPos.y, interval);
                        
                        break; // Only take the highest priority direction
                    }
                }
            }
        }
    } else {
        // AI-controlled sprite
        // Only process AI if no animation is currently running
        if (now >= sprite.animationEndTime) {
            // Check if the NPC is in a rest state
            if (!sprite.restUntil || now >= sprite.restUntil) {
                // Choose AI behavior based on sprite type
                let action;
                
                if (sprite.isChampion) {
                    action = AI.updateChampionAI(
                        sprite, 
                        findNearestEnemy, 
                        calculateNewPosition,
                        (x, y) => isPositionOccupied(x, y, sprite)
                    );
                } else {
                    action = AI.updateRegularEnemyAI(
                        sprite, 
                        findNearestEnemy,
                        calculateNewPosition,
                        (x, y) => isPositionOccupied(x, y, sprite)
                    );
                }
                
                // Handle the action
                handleAIAction(sprite, action, now, interval);
            }
        }
    }
    
    // Return visual position for rendering
    return {
        x: sprite.visualX,
        y: sprite.visualY
    };
}

// Handle AI actions with proper animation pattern
function handleAIAction(sprite: Sprite, action: AIAction, now: number, interval: number) {
    switch (action.type) {
        case ActionType.MOVE:
            // Ensure targetX and targetY are defined
            if (action.targetX !== undefined && action.targetY !== undefined) {
                // Check for faction collision before moving
                if (checkFactionCollision(sprite, action.targetX, action.targetY)) {
                    // Try alternative movements
                    const direction = AI.getDirectionTowardTarget(
                        sprite.x, sprite.y, 
                        action.targetX, action.targetY
                    );
                    
                    const alternativePositions = AI.getAlternativeMovements(
                        sprite, direction, calculateNewPosition
                    );
                    
                    // Try each alternative position
                    for (const pos of alternativePositions) {
                        if (!isPositionOccupied(pos.x, pos.y, sprite) && 
                            !checkFactionCollision(sprite, pos.x, pos.y)) {
                            // Save previous position
                            const prevX = sprite.x;
                            const prevY = sprite.y;
                            
                            // Update spatial hash with new logical position
                            spriteMap.updatePosition(sprite, pos.x, pos.y);
                            
                            // Trigger animation
                            triggerMoveAnimation(sprite, prevX, prevY, pos.x, pos.y, interval);
                            
                            // Set rest period
                            sprite.restUntil = now + interval + sprite.movementDelay;
                            break;
                        }
                    }
                } else if (!isPositionOccupied(action.targetX, action.targetY, sprite)) {
                    // Save previous position
                    const prevX = sprite.x;
                    const prevY = sprite.y;
                    
                    // Update spatial hash with new logical position
                    spriteMap.updatePosition(sprite, action.targetX, action.targetY);
                    
                    // Trigger animation
                    triggerMoveAnimation(sprite, prevX, prevY, action.targetX, action.targetY, interval);
                    
                    // Set rest period
                    sprite.restUntil = now + interval + sprite.movementDelay;
                }
            }
            break;
            
        case ActionType.ATTACK:
            if (action.targetEntity) {
                // Check if attacker's attack cooldown has elapsed
                const attackCooldown = sprite.isPlayer ? 
                    window.gameParams.playerAttackCooldown : 
                    window.gameParams.npcAttackCooldown;
                    
                if (!sprite.lastAttackTime || now - sprite.lastAttackTime >= attackCooldown) {
                    // Apply damage to the target entity - convert Entity to GameObject/Sprite
                    applyDamage(sprite, action.targetEntity as GameObject);
                    // Set attacker's last attack time
                    sprite.lastAttackTime = now;
                }
            }
            break;
            
        case ActionType.IDLE:
            // Entity is idle, set a short rest period
            sprite.restUntil = now + sprite.movementDelay;
            break;
    }
}

// Function to apply damage - now uses the animation system
function applyDamage(attacker: Sprite, target: Sprite, amount: number = 1) {    
    // Reduce hitpoints
    target.hitpoints -= amount;
    
    // Trigger damage animation
    triggerDamageAnimation(target, amount);
    
    console.log(`${target.faction} sprite took ${amount} damage! Hitpoints: ${target.hitpoints}/${target.maxHitpoints}`);
    
    // Check if the sprite is defeated
    if (target.hitpoints <= 0) {
        // Pass the attacker to handleSpriteDefeat so it can move to target's position
        handleSpriteDefeat(target, attacker);
    }

    // Display appropriate message based on visualFaction vs faction
    if (target.isPlayer) {
        console.log(`Player (allied with ${target.faction}) took ${amount} damage from ${attacker.faction}!`);
    } else if (attacker.isPlayer) {
        console.log(`Player (allied with ${attacker.faction}) dealt ${amount} damage to ${target.faction}!`);
    }
}

let undead_sprites = [[7,2],[9,2],[6,3],[8,3],[10,3]]
let orc_sprites = [[4,9],[6,9],[3,10],[5,10],[7,10],[4,11],[6,11]]
let human_sprites = [[9,15],[11,15],[13,15],[8,16],[10,16],[12,16],[9,17],[11,17]]

function initializeSpritePosition(isPlayer = false, faction = "human"): Sprite {
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
        enemyFactions = isPlayer ? ["undead"] : ["undead", "human"];
    } else if (faction === "undead") {
        enemyFactions = isPlayer ? ["orc"] : ["orc", "human"];
    } else if (faction === "human") {
        enemyFactions = isPlayer ? ["orc", "undead"] : []; // Player can attack both, NPCs are neutral
    }
    
    // Determine if this NPC should be a champion
    let isChampion = false;
    if (!isPlayer) {
        if (faction === "orc") {
            // Use the new parameter for orc champion spawn chance for initial spawning
            const spawnChance = window.gameParams.orcChampionSpawnChance / 100; // Convert to probability
            if (Math.random() < spawnChance && orcChampions < window.gameParams.maxOrcChampions) {
                isChampion = true;
                orcChampions++;
            }
        } else if (faction === "undead") {
            // Use the new parameter for undead champion spawn chance for initial spawning
            const spawnChance = window.gameParams.undeadChampionSpawnChance / 100; // Convert to probability
            if (Math.random() < spawnChance && undeadChampions < window.gameParams.maxUndeadChampions) {
                isChampion = true;
                undeadChampions++;
            }
        }
    }
    
    const sprite: Sprite = {
        x: rand_x,
        y: rand_y,
        visualX: rand_x,
        visualY: rand_y,
        sprite_x: selectedSprite[0],
        sprite_y: selectedSprite[1],
        prev_x: rand_x,
        prev_y: rand_y,
        animationEndTime: 250,
        restUntil: 0,
        isPlayer: isPlayer,
        faction: faction,
        enemyFactions: enemyFactions, // Add the enemy factions list
        maxHitpoints: isPlayer ? 10 : (isChampion ? 5 : 1),
        hitpoints: isPlayer ? 10 : (isChampion ? 5 : 1),
        lastMoveTime: Date.now(),
        movementDelay: isPlayer ? 0 : 200 + Math.floor(Math.random() * 400),
        isStructure: false,
        useBackgroundSpritesheet: false,
        isChampion: isChampion,
        takingDamage: false,
        damageUntil: undefined
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

    // Check if any modal is active - pause game logic if modal is showing
    const isModalActive = window.gameUI && window.gameUI.currentScreen !== "playing";
    
    // Only update game state if no modal is active
    if (!isModalActive) {
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
        
        // Check for win/lose conditions after updates
        checkGameEndConditions();
    }
    
    // If modal is active, don't update positions - use last known positions
    let camera_pos_x = sprite1.visualX;
    let camera_pos_y = sprite1.visualY;
    let spritePositions = allSprites.map(sprite => ({ x: sprite.visualX, y: sprite.visualY }));
    
    // Even while paused, still render the game (just don't update state)
    try {
        display.drawBackground(camera_pos_x, camera_pos_y);
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
        
        // Define aura color based on sprite properties
        const auraColor = sprite.isPlayer ? 
            [0.0, 0.0, 0.0, 0.0] :  // No aura for player
            sprite.isChampion ? 
                [1.0, 0.1, 0.1, 1.0] :  // Yellow aura for champions
                [0.0, 0.0, 0.0, 0.0];   // No aura for regular NPCs
        
        // Draw the sprite using the appropriate spritesheet
        display.drawForeground(
            sprite.sprite_x, 
            sprite.sprite_y, 
            sprite.visualX, 
            sprite.visualY, 
            camera_pos_x, 
            camera_pos_y, 
            sprite.useBackgroundSpritesheet === true, // Use bg spritesheet if specified
            auraColor as [number, number, number, number]  // Pass the aura color
        );
        
        // If this sprite is taking damage, draw the damage effect from bg tileset
        if (sprite.takingDamage) {
            // Draw damage sprite (at position 1,3 in bg tileset)
            display.drawParticle(
                15,
                0,
                spritePos.x,
                spritePos.y,
                camera_pos_x,
                camera_pos_y,
                true,
                [0.0, 0.0, 1.0, 1.0]
            );
            // display.drawForeground(
            //     1,  // sprite_x - damage sprite X position
            //     3,  // sprite_y - damage sprite Y position
            //     spritePos.x,
            //     spritePos.y,
            //     camera_pos_x,
            //     camera_pos_y,
            //     true // Use background tileset
            // );
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
        display.drawParticle(
            15,
            0,
            dyingSprite.x,
            dyingSprite.y,
            camera_pos_x,
            camera_pos_y,
            true,
            [0.0, 0.0, 1.0, 1.0]
        );
    
        // Remove from dyingSprites array when animation completes
        if (currentTime >= dyingSprite.damageUntil) {
            dyingSprites.splice(i, 1);
        }
    }
    
    // Use the lighting parameter - we'll add light sources for each NPC
    if (window.gameParams.lightingEnabled) {
        // First call with player position
        display.drawLighting(sprite1.visualX, sprite1.visualY, 
                           sprite1.visualX, sprite1.visualY, 
                           camera_pos_x, camera_pos_y);
        
        // Add additional light sources for NPCs if needed
        // This depends on how your drawLighting function is implemented
        // If it only supports two light sources, we'll just use the first NPC
        if (allSprites.length > 1) {
            const npc = allSprites[1];
            const npcPos = spritePositions[1];
            display.drawLighting(npc.visualX, npc.visualY, 
                               npcPos.x, npcPos.y, 
                               camera_pos_x, camera_pos_y);
        }
    }

    // Update animations
    updateAnimations(now);

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
function resetSpritePositions(playerVisualFaction: string = "human", playerAllianceFaction: string = null) {
    console.log(`Resetting sprite positions with player visual faction: ${playerVisualFaction}, alliance: ${playerAllianceFaction}`);
    
    // Get the player's alliance faction from parameter or UI state
    const allianceFaction = playerAllianceFaction || window.gameUI.screenData.playerFaction || "human";
    
    // Reset champion counters
    orcChampions = 0;
    undeadChampions = 0;
    
    // Clear existing sprites and spatial hash
    spriteMap.clear();
    allSprites = [];
    fortresses = []; // Clear fortresses array
    dyingSprites = []; // Clear dying sprites too
    
    // Re-initialize player sprite with human visuals but proper alliance
    sprite1 = initializePlayerWithAlliance(playerVisualFaction, allianceFaction);
    
    // Make sure player is first in the allSprites array
    allSprites[0] = sprite1;
    
    // Initialize orcs - MODIFIED LOGIC
    const maxOrcCount = window.gameParams.maxOrcCount || 5;
    // If player is allied with orcs, spawn fewer orcs initially to help player
    const initialOrcCount = allianceFaction === "orc" 
        ? Math.ceil(maxOrcCount / 2) // Spawn half the max for allied faction
        : maxOrcCount;               // Spawn full amount for enemy faction
    
    // Always spawn some orcs (both for allies and enemies)
    for (let i = 0; i < initialOrcCount; i++) {
        const npc = initializeSpritePosition(false, "orc");
        if (npc) {
            npc.movementDelay = 200 + Math.floor(Math.random() * 400);
        }
    }
    
    // Initialize undead - MODIFIED LOGIC
    const maxUndeadCount = window.gameParams.maxUndeadCount || 5;
    // If player is allied with undead, spawn fewer undead initially to help player
    const initialUndeadCount = allianceFaction === "undead" 
        ? Math.ceil(maxUndeadCount / 2) // Spawn half the max for allied faction
        : maxUndeadCount;               // Spawn full amount for enemy faction
    
    // Always spawn some undead (both for allies and enemies)
    for (let i = 0; i < initialUndeadCount; i++) {
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
    
    console.log(`Reset complete. Player visual faction: ${playerVisualFaction}, alliance: ${allianceFaction}`);
}

// New function to initialize player with proper visual and alliance faction
function initializePlayerWithAlliance(visualFaction: string, allianceFaction: string): Sprite {
    // Find valid position for player
    let x, y;
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
        if (allianceFaction === "orc") {
            // Start near orc fortress area (upper-left quadrant)
            x = 2 + Math.floor(Math.random() * (Math.floor(window.gameParams.mapWidth / 2) - 4));
            y = 2 + Math.floor(Math.random() * (Math.floor(window.gameParams.mapHeight / 2) - 4));
        } else if (allianceFaction === "undead") {
            // Start near undead fortress area (bottom-right quadrant)
            x = Math.floor(window.gameParams.mapWidth / 2) + 2 + Math.floor(Math.random() * (window.gameParams.mapWidth / 2 - 4));
            y = Math.floor(window.gameParams.mapHeight / 2) + 2 + Math.floor(Math.random() * (window.gameParams.mapHeight / 2 - 4));
        } else {
            // Default random position for neutral/human
            x = 2 + Math.floor(Math.random() * (window.gameParams.mapWidth - 4));
            y = 2 + Math.floor(Math.random() * (window.gameParams.mapHeight - 4));
        }
        attempts++;
    } while (isPositionOccupied(x, y, null) && attempts < maxAttempts);
    
    // Player sprite information (using human sprite)
    let spriteX = 12; // Human sprite x-coordinate in tileset
    let spriteY = 16; // Human sprite y-coordinate in tileset
    
    // Create player sprite without the visualFaction property
    const player: Sprite = {
        x: x,
        y: y,
        visualX: x,
        visualY: y,
        sprite_x: spriteX,
        sprite_y: spriteY,
        prev_x: x,
        prev_y: y,
        animationEndTime: 0,
        restUntil: 0,
        isPlayer: true,
        useBackgroundSpritesheet: false,
        faction: allianceFaction, // This determines combat behavior
        enemyFactions: allianceFaction === "orc" ? ["undead"] : ["orc"], // Enemies based on alliance
        maxHitpoints: 10,
        hitpoints: 10,
        lastMoveTime: 0,
        movementDelay: 0,
        isStructure: false,
        isChampion: false
    };
    
    // Add to spatial hash
    spriteMap.add(player);
    
    return player;
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
    
    // Initialize orcs - with REDUCED initial count since no alliance chosen yet
    const maxOrcCount = window.gameParams.maxOrcCount || 5;
    const initialOrcCount = Math.ceil(maxOrcCount / 2); // Only spawn half initially
    for (let i = 0; i < initialOrcCount; i++) {
        const npc = initializeSpritePosition(false, "orc");
        if (npc) {
            npc.movementDelay = 200 + Math.floor(Math.random() * 400);
        }
    }
    
    // Initialize undead - with REDUCED initial count since no alliance chosen yet
    const maxUndeadCount = window.gameParams.maxUndeadCount || 5;
    const initialUndeadCount = Math.ceil(maxUndeadCount / 2); // Only spawn half initially
    for (let i = 0; i < initialUndeadCount; i++) {
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
      maxOrcChampions: number;          // New property
      maxUndeadChampions: number;       // New property
      orcChampionSpawnChance: number;   // New property
      undeadChampionSpawnChance: number; // New property
      playerAttackCooldown?: number;    // Optional
      npcAttackCooldown?: number;       // Optional
    };
    gameUI: {
      currentScreen: string;
      screenData: {
        message: string;
        score: number;
        playerFaction: string | null;
        [key: string]: any;
      };
    };
    resetGame?: () => void; // Optional function provided by test.ts
    startGameWithFaction?: (faction: string) => void; // New function for faction selection
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

// Update checkGameEndConditions to handle faction-based win/loss conditions
function checkGameEndConditions() {
    // Get player's faction from UI state
    const playerFaction = window.gameUI.screenData.playerFaction || "human";
    
    // Check if any fortress has been destroyed
    const orcFortress = fortresses.find(f => f.faction === "orc");
    const undeadFortress = fortresses.find(f => f.faction === "undead");
    
    // Different win/loss conditions based on player faction
    if (playerFaction === "orc") {
        // Player is Orc - lose if Orc fortress destroyed, win if Undead fortress destroyed
        if (orcFortress && orcFortress.hitpoints <= 0 && window.gameUI.currentScreen === "playing") {
            console.log("Game over - Orc fortress destroyed!");
            
            // Set game over screen with appropriate message
            window.gameUI.currentScreen = "gameOver";
            window.gameUI.screenData = {
                message: "Game Over! Your fortress was destroyed.",
                score: calculateScore(),
                playerFaction: playerFaction
            };
        }
        
        // Victory if enemy fortress is destroyed
        if (undeadFortress && undeadFortress.hitpoints <= 0 && window.gameUI.currentScreen === "playing") {
            console.log("Victory - Undead fortress destroyed!");
            
            // Set win screen with appropriate message
            window.gameUI.currentScreen = "gameOver";
            window.gameUI.screenData = {
                message: "You Win! The enemy fortress is destroyed.",
                score: calculateScore(),
                playerFaction: playerFaction
            };
        }
    } else if (playerFaction === "undead") {
        // Player is Undead - lose if Undead fortress destroyed, win if Orc fortress destroyed
        if (undeadFortress && undeadFortress.hitpoints <= 0 && window.gameUI.currentScreen === "playing") {
            console.log("Game over - Undead fortress destroyed!");
            
            // Set game over screen with appropriate message
            window.gameUI.currentScreen = "gameOver";
            window.gameUI.screenData = {
                message: "Game Over! Your fortress was destroyed.",
                score: calculateScore(),
                playerFaction: playerFaction
            };
        }
        
        // Victory if enemy fortress is destroyed
        if (orcFortress && orcFortress.hitpoints <= 0 && window.gameUI.currentScreen === "playing") {
            console.log("Victory - Orc fortress destroyed!");
            
            // Set win screen with appropriate message
            window.gameUI.currentScreen = "gameOver";
            window.gameUI.screenData = {
                message: "You Win! The enemy fortress is destroyed.",
                score: calculateScore(),
                playerFaction: playerFaction
            };
        }
    } else {
        // Original logic for human player (neutral)
        if (orcFortress && orcFortress.hitpoints <= 0 && window.gameUI.currentScreen === "playing") {
            console.log("Game over - Orc fortress destroyed!");
            
            // Set game over screen with appropriate message
            window.gameUI.currentScreen = "gameOver";
            window.gameUI.screenData = {
                message: "Game Over! The orc fortress was destroyed.",
                score: calculateScore(),
                playerFaction: playerFaction
            };
        }
        
        // Victory if enemy (undead) fortress is destroyed
        if (undeadFortress && undeadFortress.hitpoints <= 0 && window.gameUI.currentScreen === "playing") {
            console.log("Victory - Undead fortress destroyed!");
            
            // Set win screen with appropriate message
            window.gameUI.currentScreen = "gameOver";
            window.gameUI.screenData = {
                message: "You Win! The undead fortress is destroyed.",
                score: calculateScore(),
                playerFaction: playerFaction
            };
        }
    }
}

// Add a function to handle starting the game with a selected faction
window.startGameWithFaction = function(faction: string) {
    console.log(`Starting game with player allied to faction: ${faction}`);
    
    // Store the player's alliance faction
    window.gameUI.screenData.playerFaction = faction;
    
    // Reset game state, but always give player a human sprite
    resetSpritePositions("human", faction);
};


