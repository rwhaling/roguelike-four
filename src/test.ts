import * as Crypto from "crypto-js";
import { WebGLDisplay } from "./display/WebGLDisplay";
import * as glu from "./display/GLUtils";
import { Sprite, Entity, GameObject, Visual, AIAction, ActionType, Particle } from './types';
import * as AI from './ai';
import { 
    animationManager, 
    updateAnimations, 
    triggerMoveAnimation, 
    triggerDamageAnimation, 
    triggerDeathAnimation 
} from './animation';
import gsap from 'gsap';

// Define last respawn check variables - add at the top of the file with other global variables
let lastRedRespawnCheck = Date.now();
let lastBlueRespawnCheck = Date.now();

// Track champions per faction - replace existing orcChampions/undeadChampions variables
let redChampions = 0;
let blueChampions = 0;

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
    c: false, // diagonal bottom-right
    one: false,
    two: false,
    three: false
};

let keyPressed: string | null = null;

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


// Function to spawn fortresses
function spawnFortresses() {
  // Get faction names from campaign
  const redFaction = window.gameCampaign.currentRedFaction;
  const blueFaction = window.gameCampaign.currentBlueFaction;
  
  // Create Red faction fortress (upper-left quadrant)
  const redX = Math.floor(window.gameParams.mapWidth / 4);
  const redY = Math.floor(window.gameParams.mapHeight / 4);
  const redFortress = createFortress(redX, redY, redFaction, true);
  fortresses.push(redFortress);
  
  // Create Blue faction fortress (bottom-right quadrant)
  const blueX = Math.floor(window.gameParams.mapWidth * 3 / 4);
  const blueY = Math.floor(window.gameParams.mapHeight * 3 / 4);
  const blueFortress = createFortress(blueX, blueY, blueFaction, false);
  fortresses.push(blueFortress);
}

// Helper function to create a fortress
function createFortress(x: number, y: number, faction: string, isRed: boolean): Sprite {
  // Get faction names from campaign to determine team color
  const redFaction = window.gameCampaign.currentRedFaction;
  
  const fortress: Sprite = {
    x: x,
    y: y,
    visualX: x,
    visualY: y,
    sprite_x: 10,
    sprite_y: isRed ? 21 : 22, // Use sprite_y 21 for red team, 22 for blue team
    prev_x: x,
    prev_y: y,
    animationEndTime: 0,
    restUntil: 0,
    isPlayer: false,
    isStructure: true, // Mark as structure (immobile)
    faction: faction,
    enemyFactions: isRed ? [window.gameCampaign.currentBlueFaction] : [redFaction],
    maxHitpoints: 20, // Fortresses have more hitpoints
    hitpoints: 20,
    maxStamina: 0,
    stamina: 0,
    lastMoveTime: 0,
    movementDelay: 0,
    useBackgroundSpritesheet: true, // Use background spritesheet
    isChampion: false
  };
  
  // Add to spatial hash to block movement
  spriteMap.add(fortress);
  
  // Add to allSprites for updating and rendering
  allSprites.push(fortress);
  
  console.log(`Spawned ${faction} fortress at (${x}, ${y})`);
  console.log(`Total sprites after fortress spawning: ${allSprites.length}`);
  
  return fortress;
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
let damageParticles: Particle[] = [];
let particles: Particle[] = [];

// Function to handle sprite defeat
function handleSpriteDefeat(sprite: Sprite, attacker: Sprite | null) {
    console.log(`${sprite.faction} sprite defeated!`);
    
    // Get faction colors for tracking
    const redFaction = window.gameCampaign.currentRedFaction;
    
    // Update champion count if necessary
    if (sprite.isChampion) {
        if (sprite.faction === redFaction) {
            redChampions--;
        } else {
            blueChampions--;
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

        // let randomParticleId = Math.floor(Math.random() * 1000000);

        // let newParticle = {x: dyingSpriteCopy.x, y: dyingSpriteCopy.y, visualX: dyingSpriteCopy.x, visualY: dyingSpriteCopy.y, sprite_x: 15, sprite_y: 0, prev_x: 8, prev_y: 8, animationEndTime: 0, restUntil: 0, 
        //     colorSwapR: 1.0,
        //     colorSwapG: 0.0,
        //     colorSwapB: 0.0,
        //     colorSwapA: 1.0,
        //     particleId: randomParticleId
        // };

        // particles.push(newParticle);
        // gsap.to(newParticle, {
        //     duration: 0.2,
        //     ease: "power2.inOut",
        //     repeat: 2,
        //     yoyo: true,
        //     colorSwapB: 1.0,
        //     onComplete: () => {
        //         console.log("animation complete?");
        //         particles = particles.filter(p => p.particleId !== randomParticleId);
        //     }
        // });
    
        

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
    const initialEnemies = window.gameParams.maxRedCount + window.gameParams.maxBlueCount;
    const remainingEnemies = factionCounts[window.gameCampaign.currentRedFaction] + factionCounts[window.gameCampaign.currentBlueFaction];
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
        human: 0,
        lizard: 0,
        siren: 0,
        dragon: 0,
        gryphon: 0
    };
    
    for (const sprite of allSprites) {
        if (!sprite.isPlayer && sprite.faction) {
            // If this faction isn't in our counts object yet, initialize it
            if (counts[sprite.faction] === undefined) {
                counts[sprite.faction] = 0;
            }
            counts[sprite.faction]++;
        }
    }
    
    return counts;
}

// Modify the checkRespawns function to check fortress status before spawning
function checkRespawns(now: number) {
    const factionCounts = countNpcsByFaction();
    
    // Get faction names from campaign
    const redFaction = window.gameCampaign.currentRedFaction;
    const blueFaction = window.gameCampaign.currentBlueFaction;
    
    // Check red faction respawns - only if their fortress exists and is alive
    if (now - lastRedRespawnCheck >= window.gameParams.redRespawnRate) {
        lastRedRespawnCheck = now;
        
        // Find the red faction fortress
        const redFortress = fortresses.find(f => f.faction === redFaction);
        
        // Only respawn if fortress exists and has health
        if (redFortress && redFortress.hitpoints > 0 && factionCounts[redFaction] < window.gameParams.maxRedCount) {
            // Spawn exactly one NPC adjacent to red faction fortress
            const npc = respawnNpcAdjacentToFortress(redFaction);
            if (npc) {
                console.log(`Respawned a ${redFaction} adjacent to fortress. Current count: ${factionCounts[redFaction] + 1}`);
            }
        }
    }
    
    // Check blue faction respawns - only if their fortress exists and is alive
    if (now - lastBlueRespawnCheck >= window.gameParams.blueRespawnRate) {
        lastBlueRespawnCheck = now;
        
        // Find the blue faction fortress
        const blueFortress = fortresses.find(f => f.faction === blueFaction);
        
        // Only respawn if fortress exists and has health
        if (blueFortress && blueFortress.hitpoints > 0 && factionCounts[blueFaction] < window.gameParams.maxBlueCount) {
            // Spawn exactly one NPC adjacent to blue faction fortress
            const npc = respawnNpcAdjacentToFortress(blueFaction);
            if (npc) {
                console.log(`Respawned a ${blueFaction} adjacent to fortress. Current count: ${factionCounts[blueFaction] + 1}`);
            }
        }
    }
}

// Update respawnNpcAdjacentToFortress if it exists to use our new functions
function respawnNpcAdjacentToFortress(faction: string, forceChampion = false): Sprite {
    // Get faction colors from campaign
    const redFaction = window.gameCampaign.currentRedFaction;
    const blueFaction = window.gameCampaign.currentBlueFaction;
    const isRedFaction = faction === redFaction;
    
    // Find the fortress of this faction
    const fortress = fortresses.find(f => f.faction === faction);
    if (!fortress) {
        console.warn(`No ${faction} fortress found for spawning`);
        return null;
    }
    
    // Get potential spawn positions around the fortress
    const spawnPositions = [
        {x: fortress.x - 1, y: fortress.y},
        {x: fortress.x + 1, y: fortress.y},
        {x: fortress.x, y: fortress.y - 1},
        {x: fortress.x, y: fortress.y + 1},
        {x: fortress.x - 1, y: fortress.y - 1},
        {x: fortress.x + 1, y: fortress.y + 1},
        {x: fortress.x - 1, y: fortress.y + 1},
        {x: fortress.x + 1, y: fortress.y - 1}
    ];
    
    // Filter out occupied positions
    const availablePositions = spawnPositions.filter(pos => 
        !isPositionOccupied(pos.x, pos.y, null) && 
        pos.x > 0 && pos.x < window.gameParams.mapWidth - 1 &&
        pos.y > 0 && pos.y < window.gameParams.mapHeight - 1
    );
    
    if (availablePositions.length === 0) {
        console.warn(`No available spawn positions around ${faction} fortress`);
        return null;
    }
    
    // Choose a random available position
    const spawnPos = availablePositions[Math.floor(Math.random() * availablePositions.length)];
    
    // Determine if this should be a champion spawn
    let newSprite: Sprite;
    
    if (forceChampion) {
        // Force champion spawn if requested
        if ((isRedFaction && redChampions < window.gameParams.maxRedChampions) ||
            (!isRedFaction && blueChampions < window.gameParams.maxBlueChampions)) {
            newSprite = initializeChampion(faction);
        } else {
            console.warn(`Cannot spawn ${faction} champion: maximum reached`);
            newSprite = initializeNpc(faction);
        }
    } else {
        // Check if we should spawn a champion based on chance
        const championSpawnChance = isRedFaction ? 
            window.gameParams.redChampionSpawnChance : 
            window.gameParams.blueChampionSpawnChance;
        
        const currentChampionCount = isRedFaction ? redChampions : blueChampions;
        const maxChampionCount = isRedFaction ? 
            window.gameParams.maxRedChampions : 
            window.gameParams.maxBlueChampions;
        
        // Random champion spawn based on chance if below maximum
        if (currentChampionCount < maxChampionCount && 
            Math.random() * 100 < championSpawnChance) {
            newSprite = initializeChampion(faction);
            console.log(`Spawned a ${faction} champion! Current count: ${currentChampionCount + 1}`);
        } else {
            // Regular unit spawn
            newSprite = initializeNpc(faction);
        }
    }
    
    if (newSprite) {
        // Update position to the chosen spawn location
        spriteMap.updatePosition(newSprite, spawnPos.x, spawnPos.y);
        newSprite.x = spawnPos.x;
        newSprite.y = spawnPos.y;
        newSprite.visualX = spawnPos.x;
        newSprite.visualY = spawnPos.y;
        newSprite.prev_x = spawnPos.x;
        newSprite.prev_y = spawnPos.y;
    }
    
    return newSprite;
}

// Function to initialize a champion
function initializeChampion(faction: string): Sprite {
    // Get faction colors from campaign
    const redFaction = window.gameCampaign.currentRedFaction;
    const isRedFaction = faction === redFaction;
    
    // Create a basic NPC first
    const npc = initializeNpc(faction);
    
    // Upgrade to champion
    npc.isChampion = true;
    npc.maxHitpoints *= 2;  // Champions have double health
    npc.hitpoints = npc.maxHitpoints;
    
    // Different sprites for champions
    if (isRedFaction) {
        // npc.sprite_y = 3;  // Special sprite for red faction champion
        redChampions++;
    } else {
        // npc.sprite_y = 7;  // Special sprite for blue faction champion
        blueChampions++;
    }
    
    // Champions move faster
    npc.movementDelay = 200; // Less delay between movements
    
    console.log(`Created a ${faction} champion. Total ${faction} champions: ${isRedFaction ? redChampions : blueChampions}`);
    
    return npc;
}

// Update the displayPlayerHealth function to include stamina
function displayPlayerHealth() {
    let statsText = "";
    
    if (sprite1) {
        // Get faction names from campaign
        const redFaction = window.gameCampaign.currentRedFaction;
        const blueFaction = window.gameCampaign.currentBlueFaction;
        
        // Add player health and stamina info
        statsText += `Health: ${sprite1.hitpoints}/${sprite1.maxHitpoints} | Stamina: ${sprite1.stamina}/${sprite1.maxStamina}`;
        
        // Add faction counts to stats
        const counts = countNpcsByFaction();
        statsText += ` | ${redFaction}: ${counts[redFaction]}/${window.gameParams.maxRedCount} | ${blueFaction}: ${counts[blueFaction]}/${window.gameParams.maxBlueCount}`;
        
        // Add champion counts to stats with max from parameters
        statsText += ` | Champions: ${redFaction} ${redChampions}/${window.gameParams.maxRedChampions}, ${blueFaction} ${blueChampions}/${window.gameParams.maxBlueChampions}`;
        
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
        if (particles.length > 0) {
            return;
        }

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
            if (keyPressed === "1") {
                console.log("TRIGGERING ATTACK ONE");
                // Check if player has enough stamina
                if (sprite.stamina >= 2) {
                    // Reduce stamina cost
                    sprite.stamina -= 2;
                    
                    let nearestEnemy = findNearestEnemy(sprite);
                    if (nearestEnemy) {
                        console.log("NEAREST ENEMY FOUND", nearestEnemy);

                        // Get all points in a line to the enemy
                        let steps = getLinePoints(sprite.x, sprite.y, nearestEnemy.x, nearestEnemy.y).slice(1);

                        // Flag to mark this as an area attack (prevents movement to defeated enemies)
                        const isAreaAttack = true;
                        
                        // Check for enemies along the line and damage them
                        for (const step of steps) {
                            // Check if any enemies are at this position and damage them
                            const spritesAtPosition = spriteMap.getSpritesAt(step.x, step.y);
                            for (const targetSprite of spritesAtPosition) {
                                // Only apply damage to enemies (sprites of enemy factions)
                                if (targetSprite !== sprite && 
                                    sprite.enemyFactions && 
                                    sprite.enemyFactions.includes(targetSprite.faction)) {
                                    // Apply 2 damage, pass isAreaAttack flag to prevent movement
                                    applyDamage(sprite, targetSprite, 2, isAreaAttack);
                                }
                            }

                            // Create visual particle effect
                            let randomParticleId = Math.floor(Math.random() * 1000000);

                            let newParticle = {x: step.x, y: step.y, visualX: step.x, visualY: step.y, sprite_x: 15, sprite_y: 0, prev_x: 8, prev_y: 8, animationEndTime: 0, restUntil: 0, 
                                colorSwapR: 0.0,
                                colorSwapG: 1.0,
                                colorSwapB: 1.0,
                                colorSwapA: 1.0,
                                particleId: randomParticleId
                            };
                        
                            particles.push(newParticle);
                            gsap.to(newParticle, {
                                duration: 0.15,
                                ease: "power1.in",
                                repeat: 0,
                                yoyo: true,
                                colorSwapG: 0.0,
                                onComplete: () => {
                                    console.log("animation complete?");
                                    particles = particles.filter(p => p.particleId !== randomParticleId);
                                }
                            });
                        }                                
                    }
                } else {
                    console.log("Not enough stamina for special attack! Need 2 stamina.");
                }
            }
            if (keyPressed === "2") {
                console.log("TRIGGERING ATTACK TWO");
                // Check if player has enough stamina
                if (sprite.stamina >= 2) {
                    // Reduce stamina cost
                    sprite.stamina -= 2;
                    
                    let nearestEnemy = findNearestEnemy(sprite);
                    if (nearestEnemy) {
                        console.log("NEAREST ENEMY FOUND", nearestEnemy);   
                    }
                    let explosionOffsets = [
                        [0,-1],
                        [-1,0],
                        [0,1],
                        [1,0],
                        [-1,1],
                        [-1,-1],
                        [1,-1],
                        [1,1],
                        [2,0],
                        [0,2],
                        [-2,0],
                        [0,-2]
                    ]
                    
                    // Flag to mark this as an area attack (prevents movement to defeated enemies)
                    const isAreaAttack = true;
                    
                    for (const offset of explosionOffsets) {
                        let dist = Math.abs(offset[0]) + Math.abs(offset[1]);
                        let randomParticleId = Math.floor(Math.random() * 1000000);
                        let position = {x: sprite.x + offset[0], y: sprite.y + offset[1]}
                        
                        // Check if any enemies are at this position and damage them
                        const spritesAtPosition = spriteMap.getSpritesAt(position.x, position.y);
                        for (const targetSprite of spritesAtPosition) {
                            // Only apply damage to enemies (sprites of enemy factions)
                            if (targetSprite !== sprite && 
                                sprite.enemyFactions && 
                                sprite.enemyFactions.includes(targetSprite.faction)) {
                                // Apply 2 damage, pass isAreaAttack flag to prevent movement
                                applyDamage(sprite, targetSprite, 2, isAreaAttack);
                            }
                        }

                        let newParticle = {x: position.x, y: position.y, visualX: position.x, visualY: position.y, sprite_x: 15, sprite_y: 0, prev_x: 8, prev_y: 8, animationEndTime: 0, restUntil: 0, 
                            colorSwapR: 1.0,
                            colorSwapG: 1.0,
                            colorSwapB: 0.0,
                            colorSwapA: 1.0,
                            particleId: randomParticleId
                        };
                    
                        particles.push(newParticle);
                        gsap.to(newParticle, {
                            delay: 0,
                            duration: 0.15 + (dist - 1) * 0.05,
                            ease: "power2.inOut",
                            repeat: 0,
                            colorSwapG: 0.5,
                            onComplete: () => {
                                console.log("animation complete?");
                                particles = particles.filter(p => p.particleId !== randomParticleId);
                            }
                        });                
                    }
                } else {
                    console.log("Not enough stamina for special attack! Need 2 stamina.");
                }
            }
            if (keyPressed === "3") {
                console.log("TRIGGERING ATTACK THREE");
                // Check if player has enough stamina
                if (sprite.stamina >= 2) {
                    // Reduce stamina cost
                    sprite.stamina -= 2;
                    
                    let nearestEnemy = findNearestEnemy(sprite);
                    if (nearestEnemy) {
                        console.log("NEAREST ENEMY FOUND", nearestEnemy);
                    }

                    // Flag to mark this as an area attack (prevents movement to defeated enemies)
                    const isAreaAttack = true;

                    let steps = getLinePoints(sprite.x, sprite.y, nearestEnemy.x, nearestEnemy.y).slice(1);
                    let explosionOffsets = [
                        [0,-1],
                        [-1,0],
                        [0,1],
                        [1,0]
                    ]
                    let explosionSteps = explosionOffsets.map(offset => ({x: nearestEnemy.x + offset[0], y: nearestEnemy.y + offset[1]}));
                    let stepsAndOffsets = steps.concat(explosionSteps);
                    
                    for (const step of stepsAndOffsets) {
                        // Check if any enemies are at this position and damage them
                        const spritesAtPosition = spriteMap.getSpritesAt(step.x, step.y);
                        for (const targetSprite of spritesAtPosition) {
                            // Only apply damage to enemies (sprites of enemy factions)
                            if (targetSprite !== sprite && 
                                sprite.enemyFactions && 
                                sprite.enemyFactions.includes(targetSprite.faction)) {
                                // Apply 2 damage, pass isAreaAttack flag to prevent movement
                                applyDamage(sprite, targetSprite, 2, isAreaAttack);
                            }
                        }
                        
                        let dist = Math.abs(step.x - sprite.x) + Math.abs(step.y - sprite.y);
                        let randomParticleId = Math.floor(Math.random() * 1000000);
                        let newParticle = {x: step.x, y: step.y, visualX: step.x, visualY: step.y, sprite_x: 15, sprite_y: 0, prev_x: 8, prev_y: 8, animationEndTime: 0, restUntil: 0, 
                            colorSwapR: 1.0,
                            colorSwapG: 0.0,
                            colorSwapB: 1.0,
                            colorSwapA: 1.0,
                            particleId: randomParticleId
                        }
                        particles.push(newParticle);
                        gsap.to(newParticle, {
                            delay: (dist - 1) * 0.01,
                            duration: 0.15 + (dist - 1) * 0.02,
                            ease: "power2.out",
                            repeat: 0,
                            colorSwapG: 0.5,
                            onComplete: () => {
                                console.log("animation complete?");
                                particles = particles.filter(p => p.particleId !== randomParticleId);
                            }
                        });                
                    }
                } else {
                    console.log("Not enough stamina for special attack! Need 2 stamina.");
                }
            }
            keyPressed = null;
        }
    } else {
        // AI-controlled sprite
        
        // This should only trigger on specials, but it also triggers for damage effects
        // disabling for now
        if (particles.length > 0) {
            return;
        }

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

/**
 * Calculates all grid points along a line between two points using Bresenham's line algorithm.
 * This is an efficient algorithm that determines which grid cells a straight line passes through.
 * 
 * @param x0 - Starting point x-coordinate
 * @param y0 - Starting point y-coordinate
 * @param x1 - Ending point x-coordinate
 * @param y1 - Ending point y-coordinate
 * @returns Array of {x, y} points representing grid cells the line passes through
 */
function getLinePoints(x0: number, y0: number, x1: number, y1: number) {
    const points = [];
    
    // Calculate absolute distances in x and y directions
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    
    // Determine step direction (positive or negative) for both axes
    const sx = (x0 < x1) ? 1 : -1; // Step right if x1 > x0, step left otherwise
    const sy = (y0 < y1) ? 1 : -1; // Step down if y1 > y0, step up otherwise
    
    // Initialize error value - this is used to determine when to step in the y direction
    // The error represents the distance to the ideal line
    let err = dx - dy;
    
    while (true) {
        // Add current point to our results
        points.push({x: x0, y: y0});
        
        // Exit condition: we've reached the end point
        if (x0 === x1 && y0 === y1) break;
        
        // Calculate error value doubled (to avoid floating point arithmetic)
        const e2 = 2 * err;
        
        // Determine whether to step in x direction
        if (e2 > -dy) { // If error value indicates we're "above" the perfect line
            err -= dy;   // Adjust error value to account for this step
            x0 += sx;    // Step in appropriate x direction (left or right)
        }
        
        // Determine whether to step in y direction
        if (e2 < dx) { // If error value indicates we're "left" of the perfect line
            err += dx;   // Adjust error value to account for this step
            y0 += sy;    // Step in appropriate y direction (up or down)
        }
        
        // Note: It's possible to step in both x and y in the same iteration
        // This happens when the line is close to diagonal (45°)
    }
    
    return points;
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
function applyDamage(attacker: Sprite, target: Sprite, amount: number = 1, isAreaAttack: boolean = false) {    
    // Reduce hitpoints
    target.hitpoints -= amount;
    
    // Trigger damage animation
    triggerDamageAnimation(target, amount);

    let randomParticleId = Math.floor(Math.random() * 1000000);

    let newParticle = {x: target.x, y: target.y, visualX: target.x, visualY: target.y, sprite_x: 15, sprite_y: 0, prev_x: 8, prev_y: 8, animationEndTime: 0, restUntil: 0, 
        colorSwapR: 1.0,
        colorSwapG: 0.0,
        colorSwapB: 0.0,
        colorSwapA: 1.0,
        particleId: randomParticleId
    };

    damageParticles.push(newParticle);
    gsap.to(newParticle, {
        duration: 0.30,
        ease: "power1.inOut",
        repeat: 0,
        yoyo: true,
        colorSwapB: 1.0,
        onComplete: () => {
            console.log("animation complete?");
            damageParticles = damageParticles.filter(p => p.particleId !== randomParticleId);
        }
    });


    console.log(`${target.faction} sprite took ${amount} damage! Hitpoints: ${target.hitpoints}/${target.maxHitpoints}`);
    
    // Check if the sprite is defeated
    if (target.hitpoints <= 0) {
        // Check if this was a melee attack (not an area attack and attacker exists)
        if (!isAreaAttack && attacker && !attacker.isStructure) {
            // Determine if attacker and target were adjacent (manhattan distance = 1)
            const distance = Math.abs(attacker.x - target.x) + Math.abs(attacker.y - target.y);
            if (distance === 1) {
                // This was a melee kill - grant stamina before handling defeat
                if (attacker.stamina < attacker.maxStamina) {
                    attacker.stamina += 1;
                    console.log(`${attacker.faction} ${attacker.isPlayer ? "player" : (attacker.isChampion ? "champion" : "unit")} gained 1 stamina for melee kill! (${attacker.stamina}/${attacker.maxStamina})`);
                }
            }
        }
        
        // For area attacks, don't pass the attacker to prevent movement
        handleSpriteDefeat(target, isAreaAttack ? null : attacker);
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
let lizard_sprites = [[10,21],[12,21],[9,22],[11,22],[13,22]]
let siren_sprites = [[3,26],[5,26],[7,26],[4,27],[6,27],[8,27],[5,28],[9,28]]
let dragon_sprites = [[6,37],[10,37],[9,38],[11,38],[7,40],[10,41],[12,41]]
// let dragon_sprites = [[6,37]]
let human_sprites = [[9,15],[11,15],[13,15],[8,16],[10,16],[12,16],[9,17],[11,17]]
let gryphon_sprites = [[7,38],[8,39],[5,46],[4,47],[5,48],[4,49],[6,49]]

// Function to initialize a regular NPC (grunt)
function initializeNpc(faction: string): Sprite {
    let rand_x, rand_y;
    let isValidPosition = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    
    // For NPCs, place them along the edges but not on walls
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
    
    if (!isValidPosition) {
        console.warn("Could not find a valid position for NPC after multiple attempts");
        return null;
    }
    
    let selectedSprite;
    
    // Choose sprite based on faction
    if (faction === "human") {
        selectedSprite = human_sprites[Math.floor(Math.random() * human_sprites.length)];
    } else if (faction === "undead") {
        selectedSprite = undead_sprites[Math.floor(Math.random() * undead_sprites.length)];
        // selectedSprite = dragon_sprites[Math.floor(Math.random() * dragon_sprites.length)];

    } else if (faction === "orc") {
        selectedSprite = orc_sprites[Math.floor(Math.random() * orc_sprites.length)];
        // selectedSprite = gryphon_sprites[Math.floor(Math.random() * gryphon_sprites.length)];
    } else if (faction === "lizard") {
        selectedSprite = lizard_sprites[Math.floor(Math.random() * lizard_sprites.length)];
    } else if (faction === "siren") {
        selectedSprite = siren_sprites[Math.floor(Math.random() * siren_sprites.length)];
    } else if (faction === "dragon") {
        selectedSprite = dragon_sprites[Math.floor(Math.random() * dragon_sprites.length)];
    } else if (faction === "gryphon") {
        selectedSprite = gryphon_sprites[Math.floor(Math.random() * gryphon_sprites.length)];
    } else {
        console.warn(`Unknown faction: ${faction}, defaulting to human`);
        selectedSprite = human_sprites[Math.floor(Math.random() * human_sprites.length)];
        faction = "human";
    }
    
    // Define enemy factions based on this sprite's faction and the current campaign
    let enemyFactions: string[] = [];
    const redFaction = window.gameCampaign.currentRedFaction;
    const blueFaction = window.gameCampaign.currentBlueFaction;

    if (faction === redFaction) {
        enemyFactions = [blueFaction]; // Red faction opposes blue faction
    } else if (faction === blueFaction) {
        enemyFactions = [redFaction]; // Blue faction opposes red faction
    } else {
        enemyFactions = []; // Other factions (like human) are neutral
    }
    
    // Create the NPC sprite
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
        isPlayer: false,
        faction: faction,
        enemyFactions: enemyFactions,
        maxHitpoints: 1,
        hitpoints: 1,
        maxStamina: 0,
        stamina: 0,
        lastMoveTime: Date.now(),
        movementDelay: 200 + Math.floor(Math.random() * 400),
        isStructure: false,
        useBackgroundSpritesheet: false,
        isChampion: false,
        takingDamage: false,
        damageUntil: undefined
    };
    
    // Add sprite to spatial hash
    spriteMap.add(sprite);
    allSprites.push(sprite);
    
    return sprite;
}

// Now let's update the original initializeSpritePosition function to use our new functions
function initializeSpritePosition(faction = "human"): Sprite {
    // Determine if this NPC should be a champion
    let isChampion = false;
    const redFaction = window.gameCampaign.currentRedFaction;
    const blueFaction = window.gameCampaign.currentBlueFaction;
    
    if (faction === redFaction) {
        // Use the parameter for red faction champion spawn chance
        const spawnChance = window.gameParams.redChampionSpawnChance / 100; // Convert to probability
        if (Math.random() < spawnChance && redChampions < window.gameParams.maxRedChampions) {
            isChampion = true;
        }
    } else if (faction === blueFaction) {
        // Use the parameter for blue faction champion spawn chance
        const spawnChance = window.gameParams.blueChampionSpawnChance / 100; // Convert to probability
        if (Math.random() < spawnChance && blueChampions < window.gameParams.maxBlueChampions) {
            isChampion = true;
        }
    }
    
    // Call the appropriate initialization function
    if (isChampion) {
        return initializeChampion(faction);
    } else {
        return initializeNpc(faction);
    }
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

// Add this function to handle regeneration of health and stamina
function handleRegeneration(sprite: Sprite, deltaTime: number) {
    // Skip if the sprite doesn't have regeneration properties
    if (!sprite.healthRegenFrequency && !sprite.staminaRegenFrequency) {
        return;
    }
    
    // Handle health regeneration
    if (sprite.healthRegenFrequency && sprite.healthRegenAmount) {
        // Initialize time elapsed if needed
        if (sprite.healthRegenTimeElapsed === undefined) {
            sprite.healthRegenTimeElapsed = 0;
        }
        
        // Accumulate time
        sprite.healthRegenTimeElapsed += deltaTime;
        
        // Check if enough time has passed to regenerate
        if (sprite.healthRegenTimeElapsed >= sprite.healthRegenFrequency) {
            // Only regenerate if not at max health
            if (sprite.hitpoints < sprite.maxHitpoints) {
                sprite.hitpoints = Math.min(sprite.hitpoints + sprite.healthRegenAmount, sprite.maxHitpoints);
                console.log(`${sprite.faction} ${sprite.isPlayer ? "player" : "entity"} regenerated ${sprite.healthRegenAmount} health. Now at ${sprite.hitpoints}/${sprite.maxHitpoints}`);
            }
            
            // Reset timer (keeping any overflow)
            sprite.healthRegenTimeElapsed %= sprite.healthRegenFrequency;
        }
    }
    
    // Handle stamina regeneration
    if (sprite.staminaRegenFrequency && sprite.staminaRegenAmount) {
        // Initialize time elapsed if needed
        if (sprite.staminaRegenTimeElapsed === undefined) {
            sprite.staminaRegenTimeElapsed = 0;
        }
        
        // Accumulate time
        sprite.staminaRegenTimeElapsed += deltaTime;
        
        // Check if enough time has passed to regenerate
        if (sprite.staminaRegenTimeElapsed >= sprite.staminaRegenFrequency) {
            // Only regenerate if not at max stamina
            if (sprite.stamina < sprite.maxStamina) {
                sprite.stamina = Math.min(sprite.stamina + sprite.staminaRegenAmount, sprite.maxStamina);
                console.log(`${sprite.faction} ${sprite.isPlayer ? "player" : "entity"} regenerated ${sprite.staminaRegenAmount} stamina. Now at ${sprite.stamina}/${sprite.maxStamina}`);
            }
            
            // Reset timer (keeping any overflow)
            sprite.staminaRegenTimeElapsed %= sprite.staminaRegenFrequency;
        }
    }
}

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
    const deltaTime = lastFrameTime ? frameStartTime - lastFrameTime : 0; // Calculate time since last frame

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
        
        // Handle regeneration for player
        if (sprite1) {
            handleRegeneration(sprite1, deltaTime);
        }
        
        // Handle regeneration for other entities (if needed)
        // For example, for fortresses:
        for (const fortress of fortresses) {
            if (fortress.healthRegenFrequency) {
                handleRegeneration(fortress, deltaTime);
            }
        }
    
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
                [1.0, 0.0, 0.0, 1.0]
            );
        }
        
        // If it's the player, optionally draw health indicators
        if (sprite.isPlayer) {

        }

        if (sprite.hitpoints < sprite.maxHitpoints) {
            let healthPercent = sprite.hitpoints / sprite.maxHitpoints;
            let healthBarWidth = 1.5 * healthPercent;
            let healthBarEmptyWidth = 1.5 - healthBarWidth;
            let healthBarXOffset = -0.25;
            let healthBarYOffset = -0.25;
            let healthBarHeight = 0.2;
            
            // Draw background/empty health bar (gray)
            display.drawRect(
                15, 0, // Use a blank/empty sprite
                spritePos.x + healthBarXOffset, 
                spritePos.y + healthBarYOffset,
                1.5, // Full width for background
                healthBarHeight,
                camera_pos_x,
                camera_pos_y,
                true, // Use bg tileset for solid color
                [0.3, 0.3, 0.3, 0.7] // Dark gray with transparency
            );
            
            // Draw current health bar (green to red based on health)
            if (healthBarWidth > 0) {
                // Color transitions from green (full health) to red (low health)                
                display.drawRect(
                    15, 0, // Use a blank/empty sprite
                    spritePos.x + healthBarXOffset, 
                    spritePos.y + healthBarYOffset,
                    healthBarWidth, // Width based on current health
                    healthBarHeight,
                    camera_pos_x,
                    camera_pos_y,
                    true, // Use bg tileset for solid color
                    [1.0, 0.0, 0.0, 0.9] // Red to green based on health percent
                );
            }        
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
        
    
        // Remove from dyingSprites array when animation completes
        if (currentTime >= dyingSprite.damageUntil) {
            dyingSprites.splice(i, 1);
        }
    }

    for (let i =0; i < particles.length; i++) {
        const particle = particles[i];
        display.drawParticle(            
            particle.sprite_x,
            particle.sprite_y,
            particle.visualX,
            particle.visualY,
            camera_pos_x,
            camera_pos_y,
            true,
            [particle.colorSwapR, particle.colorSwapG, particle.colorSwapB, particle.colorSwapA]
        )
    }

    for (let i =0; i < damageParticles.length; i++) {
        const particle = damageParticles[i];
        display.drawParticle(            
            particle.sprite_x,
            particle.sprite_y,
            particle.visualX,
            particle.visualY,
            camera_pos_x,
            camera_pos_y,
            true,
            [particle.colorSwapR, particle.colorSwapG, particle.colorSwapB, particle.colorSwapA]
        )
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
    redChampions = 0;
    blueChampions = 0;
    
    // Clear existing sprites and spatial hash
    spriteMap.clear();
    allSprites = [];
    fortresses = []; // Clear fortresses array
    dyingSprites = []; // Clear dying sprites too
    
    // Re-initialize player sprite with human visuals but proper alliance
    sprite1 = initializePlayerWithAlliance(playerVisualFaction, allianceFaction);
    
    // Make sure player is first in the allSprites array
    allSprites[0] = sprite1;
    
    // First spawn the fortresses so we can position NPCs around them
    console.log("Spawning fortresses before NPCs...");
    spawnFortresses();
    
    // Initialize red faction - MODIFIED LOGIC
    const maxRedCount = window.gameParams.maxRedCount || 5;
    // If player is allied with red, spawn fewer red initially to help player
    const initialRedCount = allianceFaction === window.gameCampaign.currentRedFaction 
        ? Math.ceil(maxRedCount / 2) // Spawn half the max for allied faction
        : maxRedCount;               // Spawn full amount for enemy faction
    
    console.log(`Spawning ${initialRedCount} red around their fortress...`);
    // Spawn red around their fortress instead of random edges
    for (let i = 0; i < initialRedCount; i++) {
        const npc = respawnNpcAdjacentToFortress(window.gameCampaign.currentRedFaction);
        if (npc) {
            npc.movementDelay = 200 + Math.floor(Math.random() * 400);
        }
    }
    
    // Initialize blue faction - MODIFIED LOGIC
    const maxBlueCount = window.gameParams.maxBlueCount || 5;
    // If player is allied with blue, spawn fewer blue initially to help player
    const initialBlueCount = allianceFaction === window.gameCampaign.currentBlueFaction 
        ? Math.ceil(maxBlueCount / 2) // Spawn half the max for allied faction
        : maxBlueCount;               // Spawn full amount for enemy faction
    
    console.log(`Spawning ${initialBlueCount} blue around their fortress...`);
    // Spawn blue around their fortress instead of random edges
    for (let i = 0; i < initialBlueCount; i++) {
        const npc = respawnNpcAdjacentToFortress(window.gameCampaign.currentBlueFaction);
        if (npc) {
            npc.movementDelay = 200 + Math.floor(Math.random() * 400);
        }
    }
    
    // Initialize lastRespawnCheck timestamps
    lastRedRespawnCheck = Date.now();
    lastBlueRespawnCheck = Date.now();
    
    console.log(`Reset complete. Player visual faction: ${playerVisualFaction}, alliance: ${allianceFaction}`);
}

// New function to initialize player with proper visual and alliance faction
function initializePlayerWithAlliance(visualFaction: string, allianceFaction: string): Sprite {
    // Find valid position for player
    let x, y;
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
        if (allianceFaction === window.gameCampaign.currentRedFaction) {
            // Start near red fortress area (upper-left quadrant)
            x = 2 + Math.floor(Math.random() * (Math.floor(window.gameParams.mapWidth / 2) - 4));
            y = 2 + Math.floor(Math.random() * (Math.floor(window.gameParams.mapHeight / 2) - 4));
        } else if (allianceFaction === window.gameCampaign.currentBlueFaction) {
            // Start near blue fortress area (bottom-right quadrant)
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
        enemyFactions: allianceFaction === window.gameCampaign.currentRedFaction ? [window.gameCampaign.currentBlueFaction] : [window.gameCampaign.currentRedFaction], // Enemies based on alliance
        maxHitpoints: 10,
        hitpoints: 10,
        maxStamina: 2,
        stamina: 2,
        lastMoveTime: 0,
        movementDelay: 0,
        isStructure: false,
        isChampion: false,
        healthRegenFrequency: 1000, // Regenerate health every 500ms
        healthRegenTimeElapsed: 0, // Initialize timer
        healthRegenAmount: 1, // Regenerate 1 HP per cycle
        staminaRegenFrequency: 2000, // Regenerate stamina every 1000ms
        staminaRegenTimeElapsed: 0, // Initialize timer
        staminaRegenAmount: 1 // Regenerate 1 stamina per cycle
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
            const npc = initializeSpritePosition("orc");
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
            const npc = initializeSpritePosition("undead");
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

// Update the setup function to use the new NPC placement approach
async function setup(fgTilesetBlobUrl: string, bgTilesetBlobUrl: string | null) {
    // Wait for gameParams to be available if needed
    if (!window.gameParams) {
        console.log("Waiting for gameParams before setup...");
        setTimeout(() => setup(fgTilesetBlobUrl, bgTilesetBlobUrl), 100);
        return;
    }

    // Initialize game with random factions
    initializeGame();
    
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

    // Initialize player sprite as human with neutral alliance
    sprite1 = initializePlayerWithAlliance("human", "human");
    
    // Make sure player is first in the allSprites array
    allSprites[0] = sprite1;
    
    // Spawn fortresses first so NPCs can cluster around them
    console.log("About to spawn fortresses...");
    spawnFortresses();
    
    // Initialize orcs - with REDUCED initial count since no alliance chosen yet
    const maxOrcCount = window.gameParams.maxOrcCount || 5;
    const initialOrcCount = Math.ceil(maxOrcCount / 2); // Only spawn half initially
    console.log(`Spawning ${initialOrcCount} initial orcs around their fortress...`);
    for (let i = 0; i < initialOrcCount; i++) {
        const npc = respawnNpcAdjacentToFortress("orc");
        if (npc) {
            npc.movementDelay = 200 + Math.floor(Math.random() * 400);
        }
    }
    
    // Initialize undead - with REDUCED initial count since no alliance chosen yet
    const maxUndeadCount = window.gameParams.maxUndeadCount || 5;
    const initialUndeadCount = Math.ceil(maxUndeadCount / 2); // Only spawn half initially
    console.log(`Spawning ${initialUndeadCount} initial undead around their fortress...`);
    for (let i = 0; i < initialUndeadCount; i++) {
        const npc = respawnNpcAdjacentToFortress("undead");
        if (npc) {
            npc.movementDelay = 200 + Math.floor(Math.random() * 400);
        }
    }
    
    // Initialize lastRespawnCheck timestamps
    lastRedRespawnCheck = Date.now();
    lastBlueRespawnCheck = Date.now();

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
      maxRedCount: number;      // Was maxOrcCount
      maxBlueCount: number;     // Was maxUndeadCount
      redRespawnRate: number;   // Was orcRespawnRate
      blueRespawnRate: number;  // Was undeadRespawnRate
      maxRedChampions: number;  // Was maxOrcChampions
      maxBlueChampions: number; // Was maxUndeadChampions
      redChampionSpawnChance: number;  // Was orcChampionSpawnChance
      blueChampionSpawnChance: number; // Was undeadChampionSpawnChance
      playerAttackCooldown?: number;
      npcAttackCooldown?: number;
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
    gameCampaign: {
      currentRedFaction: string;
      currentBlueFaction: string;
      currentLevel: number;
      gameHistory: any[];
      selectedFaction: string | null;
    };
    resetGame?: () => void; 
    startGameWithFaction?: (faction: string) => void;
    retryCurrentLevel?: () => void;
    startNewCampaign?: () => void;
  }
}

// Add these functions to handle keyboard input
function handleKeyDown(event: KeyboardEvent) {
    // Prevent default actions like scrolling with arrow keys
    if (['w', 'a', 's', 'd', 'q', 'e', 'z', 'c', "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].includes(event.key.toLowerCase())) {
        event.preventDefault();
    }
    
    switch (event.key.toLowerCase()) {
        case 'w': keyState.w = true; keyPressed = "w"; break;
        case 'a': keyState.a = true; keyPressed = "a"; break;
        case 's': keyState.s = true; keyPressed = "s"; break;
        case 'd': keyState.d = true; keyPressed = "d"; break;
        case 'q': keyState.q = true; keyPressed = "q"; break;
        case 'e': keyState.e = true; keyPressed = "e"; break;
        case 'z': keyState.z = true; keyPressed = "z"; break;
        case 'c': keyState.c = true; keyPressed = "c"; break;
        case '1': keyState.one = true; keyPressed = "1"; break;
        case '2': keyState.two = true; keyPressed = "2"; break;
        case '3': keyState.three = true; keyPressed = "3"; break;
        
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
        case '1': keyState.one = false; break;
        case '2': keyState.two = false; break;
        case '3': keyState.three = false; break;
    }
}

// Update checkGameEndConditions to handle dynamic faction-based win/loss conditions
function checkGameEndConditions() {
    // Get player's faction from UI state
    const playerFaction = window.gameUI.screenData.playerFaction || "human";
    
    // Get current campaign factions
    const redFaction = window.gameCampaign.currentRedFaction;
    const blueFaction = window.gameCampaign.currentBlueFaction;
    
    // Check if any fortress has been destroyed
    const redFortress = fortresses.find(f => f.faction === redFaction);
    const blueFortress = fortresses.find(f => f.faction === blueFaction);
    
    // Different win/loss conditions based on player faction
    if (playerFaction === redFaction) {
        // Player is Red faction - lose if Red fortress destroyed, win if Blue fortress destroyed
        if (redFortress && redFortress.hitpoints <= 0 && window.gameUI.currentScreen === "playing") {
            console.log(`Game over - ${redFaction} fortress destroyed!`);
            
            // Set game over screen with appropriate message
            window.gameUI.currentScreen = "gameOver";
            window.gameUI.screenData = {
                message: "Game Over! Your fortress was destroyed.",
                score: calculateScore(),
                playerFaction: playerFaction,
                isVictory: false
            };
        }
        
        // Victory if enemy fortress is destroyed
        if (blueFortress && blueFortress.hitpoints <= 0 && window.gameUI.currentScreen === "playing") {
            console.log(`Victory - ${blueFaction} fortress destroyed!`);
            
            // Count unique factions that have been used (current + history)
            const usedFactions = new Set<string>();
            window.gameCampaign.gameHistory.forEach(level => {
                usedFactions.add(level.currentRedFaction);
                usedFactions.add(level.currentBlueFaction);
            });
            usedFactions.add(redFaction);
            usedFactions.add(blueFaction);
            
            // Check if all factions have been used (6 total factions)
            const allFactionsUsed = usedFactions.size >= 6;
            
            if (allFactionsUsed) {
                // Campaign victory - all factions have been played
                showCampaignVictory();
            } else {
                // Show level victory screen
                window.gameUI.currentScreen = "levelVictory";
                window.gameUI.screenData = {
                    message: `You destroyed the ${blueFaction} fortress!`,
                    score: calculateScore(),
                    playerFaction: playerFaction,
                    isVictory: true,
                    defeatedFaction: blueFaction
                };
            }
        }
    } else if (playerFaction === blueFaction) {
        // Player is Blue faction - lose if Blue fortress destroyed, win if Red fortress destroyed
        if (blueFortress && blueFortress.hitpoints <= 0 && window.gameUI.currentScreen === "playing") {
            console.log(`Game over - ${blueFaction} fortress destroyed!`);
            
            // Set game over screen with appropriate message
            window.gameUI.currentScreen = "gameOver";
            window.gameUI.screenData = {
                message: "Game Over! Your fortress was destroyed.",
                score: calculateScore(),
                playerFaction: playerFaction,
                isVictory: false
            };
        }
        
        // Victory if enemy fortress is destroyed
        if (redFortress && redFortress.hitpoints <= 0 && window.gameUI.currentScreen === "playing") {
            console.log(`Victory - ${redFaction} fortress destroyed!`);
            
            // Check if there are more factions to play with or if the campaign is complete
            const availableFactions = getAvailableFactions();
            
            if (availableFactions.length >= 2) {
                // Show level victory screen first
                window.gameUI.currentScreen = "levelVictory";
                window.gameUI.screenData = {
                    message: `You destroyed the ${redFaction} fortress!`,
                    score: calculateScore(),
                    playerFaction: playerFaction,
                    isVictory: true,
                    defeatedFaction: redFaction
                };
            } else {
                // Campaign victory - all factions have been played
                showCampaignVictory();
            }
        }
    } else {
        // Player is neutral (human) - we'll show a message for either fortress being destroyed
        if (redFortress && redFortress.hitpoints <= 0 && window.gameUI.currentScreen === "playing") {
            console.log(`Game event - ${redFaction} fortress destroyed!`);
            
            // Set game over screen with appropriate message
            window.gameUI.currentScreen = "gameOver";
            window.gameUI.screenData = {
                message: `The ${redFaction} fortress was destroyed.`,
                score: calculateScore(),
                playerFaction: playerFaction,
                isVictory: playerFaction !== redFaction
            };
        }
        
        if (blueFortress && blueFortress.hitpoints <= 0 && window.gameUI.currentScreen === "playing") {
            console.log(`Game event - ${blueFaction} fortress destroyed!`);
            
            // Set game over screen with appropriate message
            window.gameUI.currentScreen = "gameOver";
            window.gameUI.screenData = {
                message: `The ${blueFaction} fortress was destroyed.`,
                score: calculateScore(),
                playerFaction: playerFaction,
                isVictory: playerFaction !== blueFaction
            };
        }
    }
}

// Helper function to get available (unused) factions
function getAvailableFactions() {
    const allAvailableFactions = ["undead", "orc", "lizard", "siren", "dragon", "gryphon"];
    
    // Get all factions that have appeared in the campaign history
    const usedFactions = new Set<string>();
    
    // Extract all factions from history
    window.gameCampaign.gameHistory.forEach(level => {
        usedFactions.add(level.currentRedFaction);
        usedFactions.add(level.currentBlueFaction);
    });
    
    // If the current level has factions already, add them too
    if (window.gameCampaign.currentRedFaction) {
        usedFactions.add(window.gameCampaign.currentRedFaction);
    }
    if (window.gameCampaign.currentBlueFaction) {
        usedFactions.add(window.gameCampaign.currentBlueFaction);
    }
    
    // Find unused factions
    const unusedFactions = allAvailableFactions.filter(faction => !usedFactions.has(faction));
    
    return unusedFactions;
}

// Function to advance to the next level after victory
function advanceToNextLevel() {
    console.log("Advancing to next level after victory...");
    
    // Reset player health if necessary
    if (sprite1 && sprite1.hitpoints <= 0) {
        sprite1.hitpoints = sprite1.maxHitpoints;
    }
    
    // Increment level number for the next level
    window.gameCampaign.currentLevel++;
    
    // Switch to faction selection screen
    window.gameUI.currentScreen = "factionSelect";
    
    // Clear player faction to force new selection
    window.gameUI.screenData.playerFaction = null;
    window.gameCampaign.selectedFaction = null;
    
    // Select new random factions for the next level
    selectRandomFactions();
    
    console.log("Advancing to level", window.gameCampaign.currentLevel);
}

// Function to show the campaign victory screen
function showCampaignVictory() {
    console.log("Campaign complete! Showing victory screen");
    
    // Set campaign victory screen
    window.gameUI.currentScreen = "campaignVictory";
    window.gameUI.screenData = {
        message: "Congratulations! You have completed the campaign!",
        score: calculateScore(),
        totalLevels: window.gameCampaign.currentLevel,
        isVictory: true
    };
}

// Add a function to handle starting the game with a selected faction
window.startGameWithFaction = function(faction: string) {
    console.log(`Starting game with player allied to faction: ${faction}`);
    
    // Store the player's alliance faction
    window.gameUI.screenData.playerFaction = faction;
    
    // Reset game state, but always give player a human sprite
    resetSpritePositions("human", faction);
};

// Function to randomly select two factions for the campaign that haven't been used before
function selectRandomFactions() {
    const allAvailableFactions = ["undead", "orc", "lizard", "siren", "dragon", "gryphon"];
    
    // Get all factions that have appeared in the campaign history
    const usedFactions = new Set<string>();
    
    // Extract all factions from history
    window.gameCampaign.gameHistory.forEach(level => {
        usedFactions.add(level.currentRedFaction);
        usedFactions.add(level.currentBlueFaction);
    });
    
    // Log the used factions for debugging
    console.log("Used factions so far:", Array.from(usedFactions));
    
    // Find unused factions
    let unusedFactions = allAvailableFactions.filter(faction => !usedFactions.has(faction));
    
    console.log("Unused factions:", unusedFactions);
    
    // If we don't have at least 2 unused factions, this means we've used all factions
    // Instead of resetting, we should trigger campaign victory
    if (unusedFactions.length < 2) {
        console.log("All factions have been used - campaign complete!");
        // Immediately show campaign victory screen
        showCampaignVictory();
        return { redFaction: null, blueFaction: null }; // Return null to indicate campaign end
    }
    
    // Shuffle the remaining factions using Fisher-Yates algorithm
    for (let i = unusedFactions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unusedFactions[i], unusedFactions[j]] = [unusedFactions[j], unusedFactions[i]];
    }
    
    // Take the first two factions from the shuffled array
    const redFaction = unusedFactions[0];
    const blueFaction = unusedFactions[1];
    
    console.log(`Selected new factions: Red=${redFaction}, Blue=${blueFaction}`);
    
    // Update the campaign with the selected factions
    window.gameCampaign.currentRedFaction = redFaction;
    window.gameCampaign.currentBlueFaction = blueFaction;
    
    return { redFaction, blueFaction };
}

// Call this function when initializing the game or resetting
function initializeGame() {
    // Initialize the campaign if it doesn't exist
    if (!window.gameCampaign) {
        window.gameCampaign = {
            currentRedFaction: "orc", // Default, will be overwritten
            currentBlueFaction: "undead", // Default, will be overwritten
            currentLevel: 1,
            gameHistory: [],
            selectedFaction: null
        };
    }
    
    // Select random factions
    selectRandomFactions();
    
    // Continue with game initialization...
    // This would include resetting sprite positions, etc.
}

// Update resetGame function to call initializeGame
window.resetGame = function() {
    console.log("Resetting game after Game Over...");
    
    // Reset player health if they died
    if (sprite1 && sprite1.hitpoints <= 0) {
        sprite1.hitpoints = sprite1.maxHitpoints;
    }
    
    // Switch to faction selection screen
    window.gameUI.currentScreen = "factionSelect";
    
    // Clear player faction to force new selection
    window.gameUI.screenData.playerFaction = null;
    
    // Select new random factions for the next game
    selectRandomFactions();
    
    console.log("Game reset complete - returning to faction select screen");
};

// Function to retry the current level without changing factions or incrementing level
window.retryCurrentLevel = function() {
    console.log("Retrying current level...");
    
    // Reset player health if they died
    if (sprite1 && sprite1.hitpoints <= 0) {
        sprite1.hitpoints = sprite1.maxHitpoints;
    }
    
    // Switch to faction selection screen but keep the same factions and level
    window.gameUI.currentScreen = "factionSelect";
    
    // Clear player faction to force new selection
    window.gameUI.screenData.playerFaction = null;
    window.gameCampaign.selectedFaction = null;
    
    console.log("Retrying level", window.gameCampaign.currentLevel, 
                "with factions:", window.gameCampaign.currentRedFaction, 
                "and", window.gameCampaign.currentBlueFaction);
};

// Function to start a completely new campaign
window.startNewCampaign = function() {
    console.log("Starting new campaign...");
    
    // Reset to level 1
    window.gameCampaign.currentLevel = 1;
    
    // Clear game history
    window.gameCampaign.gameHistory = [];
    
    // Select new random factions for the first level
    selectRandomFactions();
    
    // Reset player's faction selection
    window.gameUI.screenData.playerFaction = null;
    window.gameCampaign.selectedFaction = null;
    
    // Switch to faction selection screen
    window.gameUI.currentScreen = "factionSelect";
    
    console.log("New campaign started at level 1 with factions:", 
                window.gameCampaign.currentRedFaction, "and", 
                window.gameCampaign.currentBlueFaction);
};

// Update resetGame function to advance to the next level (used after victory)
window.resetGame = function() {
    console.log("Advancing to next level after victory...");
    
    // First, add the current level to game history
    window.gameCampaign.gameHistory.push({
        currentLevel: window.gameCampaign.currentLevel,
        currentRedFaction: window.gameCampaign.currentRedFaction,
        currentBlueFaction: window.gameCampaign.currentBlueFaction,
        selectedFaction: window.gameUI.screenData.playerFaction
    });
    
    // Log the updated history
    console.log("Updated game history:", window.gameCampaign.gameHistory);
    
    // Reset player health if necessary
    if (sprite1 && sprite1.hitpoints <= 0) {
        sprite1.hitpoints = sprite1.maxHitpoints;
    }
    
    // Increment level number for the next level
    window.gameCampaign.currentLevel++;
    
    // Switch to faction selection screen
    window.gameUI.currentScreen = "factionSelect";
    
    // Clear player faction to force new selection
    window.gameUI.screenData.playerFaction = null;
    window.gameCampaign.selectedFaction = null;
    
    // Select new random factions for the next level
    selectRandomFactions();
    
    console.log("Advancing to level", window.gameCampaign.currentLevel);
};


