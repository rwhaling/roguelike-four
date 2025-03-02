import * as Crypto from "crypto-js";
import { WebGLDisplay } from "./display/WebGLDisplay";
import * as glu from "./display/GLUtils";

// Then use the global noise variable
// You may need to add a declaration to make TypeScript happy
declare const noise: any;

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
    let bgReqUrl = "bg_tiles.png"; // New background sprite sheet
    
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

// Expand Sprite interface to include hitpoints
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
    lastDamageTime?: number;
    
    // Movement timing
    lastMoveTime: number;
    movementDelay: number;
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
            // Apply damage to the target sprite
            applyDamage(sprite, targetSprite);
            return true;
        }
    }
    
    return false;
}

// Function to apply damage to a sprite
function applyDamage(attacker: Sprite, target: Sprite) {
    const now = Date.now();
    
    // Check if enough time has passed since the last damage (cooldown of 1 second)
    if (!target.lastDamageTime || now - target.lastDamageTime >= 1000) {
        // Apply damage effect
        target.takingDamage = true;
        target.damageUntil = now + 150; // Show damage effect for 500ms
        target.lastDamageTime = now;
        
        // Reduce hitpoints
        target.hitpoints -= 1;
        
        console.log(`${target.faction} sprite took damage! Hitpoints: ${target.hitpoints}/${target.maxHitpoints}`);
        
        // Check if the sprite is defeated
        if (target.hitpoints <= 0) {
            handleSpriteDefeat(target);
        }
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

// New function to handle respawning
let lastOrcRespawnCheck = 0;
let lastUndeadRespawnCheck = 0;

function checkRespawns(now: number) {
    const factionCounts = countNpcsByFaction();
    
    // Check orc respawns
    if (now - lastOrcRespawnCheck >= window.gameParams.orcRespawnRate * 1000) {
        lastOrcRespawnCheck = now;
        
        if (factionCounts.orc < window.gameParams.maxOrcCount) {
            // Spawn exactly one orc
            const npc = initializeSpritePosition(false, "orc");
            if (npc) {
                npc.movementDelay = 200 + Math.floor(Math.random() * 400);
                console.log(`Respawned an orc. Current count: ${factionCounts.orc + 1}`);
            }
        }
    }
    
    // Check undead respawns
    if (now - lastUndeadRespawnCheck >= window.gameParams.undeadRespawnRate * 1000) {
        lastUndeadRespawnCheck = now;
        
        if (factionCounts.undead < window.gameParams.maxUndeadCount) {
            // Spawn exactly one undead
            const npc = initializeSpritePosition(false, "undead");
            if (npc) {
                npc.movementDelay = 200 + Math.floor(Math.random() * 400);
                console.log(`Respawned an undead. Current count: ${factionCounts.undead + 1}`);
            }
        }
    }
}

// Add a function to display player health in the UI
function displayPlayerHealth() {
    if (sprite1) {
        const healthPercent = (sprite1.hitpoints / sprite1.maxHitpoints) * 100;
        
        // Update the performance stats to include health
        window.gameParams.performanceStats += ` | Health: ${sprite1.hitpoints}/${sprite1.maxHitpoints}`;
        
        // Add faction counts to stats
        const counts = countNpcsByFaction();
        window.gameParams.performanceStats += ` | Orcs: ${counts.orc}/${window.gameParams.maxOrcCount} | Undead: ${counts.undead}/${window.gameParams.maxUndeadCount}`;
    }
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

// Modify updateSpritePosition to implement enemy targeting behavior
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
    const MAX_ATTEMPTS = 10;
    
    while (!isValidPosition && attempts < MAX_ATTEMPTS) {
        rand_x = Math.floor(Math.random() * (window.gameParams.mapWidth - 2)) + 1;
        rand_y = Math.floor(Math.random() * (window.gameParams.mapHeight - 2)) + 1;
        isValidPosition = !isPositionOccupied(rand_x, rand_y, null);
        attempts++;
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
        movementDelay: isPlayer ? 0 : 200 + Math.floor(Math.random() * 400)
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
    displayPlayerHealth();
    
    // Draw all sprites
    for (let i = 0; i < allSprites.length; i++) {
        const sprite = allSprites[i];
        const spritePos = spritePositions[i];
        display.drawForeground(sprite.sprite_x, sprite.sprite_y, 
                              sprite.visualX, sprite.visualY, 
                              camera_pos_x, camera_pos_y);
        
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
        
        // Draw the sprite
        display.drawForeground(dyingSprite.sprite_x, dyingSprite.sprite_y, 
                             dyingSprite.x, dyingSprite.y, 
                             camera_pos_x, camera_pos_y);
        
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

    // Update the performance stats in the shared parameters
    window.gameParams.performanceStats = `Render time: ${frameDuration.toFixed(2)}ms | FPS: ${fps.toFixed(2)}`;

    lastFrameTime = frameEndTime;
    requestAnimationFrame(draw_frame);
}

// Update resetSpritePositions to use max counts instead of npcCount
function resetSpritePositions() {
    // Clear existing sprites and spatial hash
    spriteMap.clear();
    allSprites = [];
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
    
    // Initialize lastRespawnCheck timestamps
    lastOrcRespawnCheck = Date.now();
    lastUndeadRespawnCheck = Date.now();
    
    console.log(`Reset positions. Player: 1, Orcs: ${maxOrcCount}, Undead: ${maxUndeadCount}`);
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
    
    // Initialize lastRespawnCheck timestamps
    lastOrcRespawnCheck = Date.now();
    lastUndeadRespawnCheck = Date.now();

    // Set up keyboard event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    lastFrameTime = performance.now();
    lastMapUpdateTime = Date.now();

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


