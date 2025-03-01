import * as Crypto from "crypto-js";
import { WebGLDisplay } from "./display/WebGLDisplay";
import * as glu from "./display/GLUtils";

// Then use the global noise variable
// You may need to add a declaration to make TypeScript happy
declare const noise: any;

function init() {
    console.log(noise);
    // var picture = document.getElementById("picture");
    console.log("about to retrieve encrypted image")
    var data = new XMLHttpRequest();

    let req_url = "tiny_dungeon_world_3_dark_test_7.png.enc.b64"
    if (req_url.endsWith(".png")) {
        console.log("unencrypted png")
        data.responseType = 'blob';
        data.open('GET', req_url, true);
        data.onreadystatechange = load;
        data.send(null);
    } else {
        data.open('GET', req_url, true);
        data.onreadystatechange = load_encrypted;
        data.send(null);
    }
}

function load() {
    console.log("ready?");
    if(this.readyState == 4 && this.status==200){
        console.log(this.responseURL,"got back data", this.response.length, "bytes")
        if (this.responseURL.endsWith("png")) {
            console.log("unencrypted", this.response)
            var reader = new FileReader();
            reader.onloadend = function() {
                console.log("reader returned", reader.result)
                setup(reader.result as string).catch(console.error);
            }
            reader.readAsDataURL(this.response);
        }
    } else {
        console.log("sad path",this);
    }
}

function load_encrypted() {
    console.log("ready?");
    if(this.readyState == 4 && this.status==200){
        console.log(this.responseURL,"got back data", this.response.length, "bytes")
        console.log("encrypted")
        console.log("Crypto:",Crypto);
        var dec = Crypto.AES.decrypt(this.responseText, import.meta.env.VITE_ASSET_KEY);
        var plain = Crypto.enc.Base64.stringify( dec );

        let bytes = atob(plain)
        const binary = new Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
            binary[i] = bytes.charCodeAt(i);
        }
        const byteArray = new Uint8Array(binary);

        const blob = new Blob([byteArray])
        const url = URL.createObjectURL(blob)    
        setup(url).catch(console.error);
    } else {
        console.log("sad path",this);
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

// Spatial hash implementation
class SpatialHash {
    private grid: Map<string, Array<any>> = new Map();
    
    // Get a unique key for a grid position
    private getKey(x: number, y: number): string {
        return `${Math.floor(x)},${Math.floor(y)}`;
    }
    
    // Add a sprite to the spatial hash
    add(sprite: any): void {
        // Add to current position
        this.addToPosition(sprite, sprite.x, sprite.y);
        
        // Also reserve target position if it's different
        if (sprite.target_x !== sprite.x || sprite.target_y !== sprite.y) {
            this.addToPosition(sprite, sprite.target_x, sprite.target_y);
        }
    }
    
    // Add sprite to a specific position in the hash
    private addToPosition(sprite: any, x: number, y: number): void {
        const key = this.getKey(x, y);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key).push(sprite);
    }
    
    // Remove a sprite from the spatial hash
    remove(sprite: any): void {
        // Remove from current position
        this.removeFromPosition(sprite, sprite.x, sprite.y);
        
        // Also remove from target position if it's different
        if (sprite.target_x !== sprite.x || sprite.target_y !== sprite.y) {
            this.removeFromPosition(sprite, sprite.target_x, sprite.target_y);
        }
    }
    
    // Remove sprite from a specific position in the hash
    private removeFromPosition(sprite: any, x: number, y: number): void {
        const key = this.getKey(x, y);
        const sprites = this.grid.get(key);
        if (sprites) {
            const index = sprites.indexOf(sprite);
            if (index !== -1) {
                sprites.splice(index, 1);
            }
            if (sprites.length === 0) {
                this.grid.delete(key);
            }
        }
    }
    
    // Update a sprite's position in the hash
    update(sprite: any, oldX: number, oldY: number, oldTargetX: number, oldTargetY: number): void {
        // Remove from old positions
        this.removeFromPosition(sprite, oldX, oldY);
        if (oldTargetX !== oldX || oldTargetY !== oldY) {
            this.removeFromPosition(sprite, oldTargetX, oldTargetY);
        }
        
        // Add to new positions
        this.add(sprite);
    }
    
    // Check if a position is occupied
    isPositionOccupied(x: number, y: number, excludeSprite: any): boolean {
        const key = this.getKey(x, y);
        const sprites = this.grid.get(key);
        return sprites && sprites.some(sprite => sprite !== excludeSprite);
    }
    
    // Get all sprites at a position
    getSpritesAt(x: number, y: number): Array<any> {
        const key = this.getKey(x, y);
        return this.grid.get(key) || [];
    }
    
    // Clear the entire spatial hash
    clear(): void {
        this.grid.clear();
    }
}

// Create a global spatial hash
let spriteMap = new SpatialHash();
let allSprites: any[] = [];

// Function to check if a position is occupied or reserved by a sprite
function isPositionOccupied(x: number, y: number, excludeSprite: any): boolean {
    return spriteMap.isPositionOccupied(x, y, excludeSprite);
}

function updateSpritePosition(sprite: any, now: number, interval: number) {
    // Store old positions for spatial hash update
    const oldX = sprite.x;
    const oldY = sprite.y;
    const oldTargetX = sprite.target_x;
    const oldTargetY = sprite.target_y;
    
    let progress = 1 - ((sprite.target_time - now) / interval);
    
    // For player-controlled sprite, handle input
    if (sprite.isPlayer) {
        if (progress >= 1) {
            // Player has reached target position, check for new input direction
            progress = 0;
            
            // Update position and spatial hash when movement completes
            if (sprite.x !== sprite.target_x || sprite.y !== sprite.target_y) {
                sprite.x = sprite.target_x;
                sprite.y = sprite.target_y;
                // Update spatial hash to reflect completed movement
                spriteMap.update(sprite, oldX, oldY, oldTargetX, oldTargetY);
            }
            
            let moved = false;
            
            // Check keys in priority order
            for (const key of MOVEMENT_PRIORITY) {
                if (keyState[key]) {
                    const newPos = calculateNewPosition(sprite.x, sprite.y, DIRECTIONS[key]);
                    
                    // Check for collision before moving
                    if (!isPositionOccupied(newPos.x, newPos.y, sprite)) {
                        sprite.target_x = newPos.x;
                        sprite.target_y = newPos.y;
                        moved = true;
                        break; // Only take the highest priority direction
                    }
                }
            }
            
            // Only update target time if we actually moved
            if (moved) {
                sprite.target_time = now + interval;
                // Update sprite in spatial hash again for the new movement
                spriteMap.update(sprite, sprite.x, sprite.y, oldTargetX, oldTargetY);
            }
        }
    } else {
        // AI-controlled sprite with random movement
        if (progress >= 1) {
            // NPC has reached target position
            progress = 0;
            
            // Update position and spatial hash when movement completes
            if (sprite.x !== sprite.target_x || sprite.y !== sprite.target_y) {
                sprite.x = sprite.target_x;
                sprite.y = sprite.target_y;
                // Update spatial hash to reflect completed movement
                spriteMap.update(sprite, oldX, oldY, oldTargetX, oldTargetY);
            }
            
            // Check if the NPC is in a rest state
            if (!sprite.restUntil || now >= sprite.restUntil) {
                // Try up to 8 random directions if needed to find a valid move
                let foundValidMove = false;
                let attempts = 0;
                
                while (!foundValidMove && attempts < 8) {
                    // Generate random direction (-1, 0, or 1 for both x and y)
                    const randomDirection = {
                        dx: -1 + Math.floor(Math.random() * 3),
                        dy: -1 + Math.floor(Math.random() * 3)
                    };
                    
                    // Apply the same bounds-checking logic as player movement
                    const newPos = calculateNewPosition(sprite.x, sprite.y, randomDirection);
                    
                    // Check for collision before moving
                    if (!isPositionOccupied(newPos.x, newPos.y, sprite)) {
                        sprite.target_x = newPos.x;
                        sprite.target_y = newPos.y;
                        sprite.target_time = now + interval;
                        foundValidMove = true;
                    }
                    
                    attempts++;
                }
                
                // After this move, rest for 250ms
                if (foundValidMove) {
                    sprite.restUntil = now + interval + 250;
                    // Update sprite in spatial hash for the new movement
                    spriteMap.update(sprite, sprite.x, sprite.y, oldTargetX, oldTargetY);
                } else {
                    // If no valid move was found, try again later
                    sprite.restUntil = now + 250;
                }
            }
        }
    }

    return {
        x: (sprite.x * (1 - progress)) + (sprite.target_x * progress),
        y: (sprite.y * (1 - progress)) + (sprite.target_y * progress)
    };
}

function initializeSpritePosition() {
    let rand_x, rand_y;
    let isValidPosition = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 10; // Limit the number of attempts to find a position
    
    // Keep trying until we find a position that doesn't overlap with existing sprites
    while (!isValidPosition && attempts < MAX_ATTEMPTS) {
        // Use actual map dimensions instead of hardcoded values
        rand_x = Math.floor(Math.random() * (window.gameParams.mapWidth - 2)) + 1;
        rand_y = Math.floor(Math.random() * (window.gameParams.mapHeight - 2)) + 1;
        
        // Check if position is already occupied
        isValidPosition = !isPositionOccupied(rand_x, rand_y, null);
        attempts++;
    }
    
    // Return null if we couldn't find a valid position
    if (!isValidPosition) {
        console.warn("Could not find a valid position for sprite after multiple attempts");
        return null;
    }
    
    const sprite = {
        x: rand_x,
        y: rand_y,
        sprite_x: Math.floor(Math.random() * 16),
        sprite_y: Math.floor(Math.random() * 32),
        target_x: rand_x,
        target_y: rand_y,
        target_time: 250,
        restUntil: 0,  // Track when NPC should start moving again
        isPlayer: false // Add this flag to distinguish player-controlled sprites
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
    if (lastNpcCount === null) {
        lastNpcCount = window.gameParams.npcCount;
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

    // Check if NPC count has changed and update accordingly
    if (lastNpcCount !== window.gameParams.npcCount) {
        updateNpcCount();
        lastNpcCount = window.gameParams.npcCount;
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
        let spritePos = updateSpritePosition(allSprites[i], now, window.gameParams.moveSpeed / 2);
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
    
    // Draw all sprites
    for (let i = 0; i < allSprites.length; i++) {
        const sprite = allSprites[i];
        const spritePos = spritePositions[i];
        display.drawForeground(sprite.sprite_x, sprite.sprite_y, 
                              spritePos.x, spritePos.y, 
                              camera_pos_x, camera_pos_y);
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

// Add a new function to update NPCs based on the current count
function updateNpcCount() {
    console.log(`Updating NPC count to ${window.gameParams.npcCount}`);
    
    // Keep the player sprite (first in the array)
    const playerSprite = allSprites[0];
    
    // Remove all NPCs from spatial hash
    for (let i = 1; i < allSprites.length; i++) {
        spriteMap.remove(allSprites[i]);
    }
    
    // Reset allSprites to only contain the player
    allSprites = [playerSprite];
    
    // Create new NPCs based on the current count
    const npcCount = window.gameParams.npcCount || 0;
    let successfullyCreated = 0;
    
    for (let i = 0; i < npcCount; i++) {
        const npc = initializeSpritePosition();
        if (npc) {
            npc.sprite_y = Math.floor(Math.random() * 32); // Randomize appearance
            npc.movementDelay = 200 + Math.floor(Math.random() * 400); // Random delay
            successfullyCreated++;
        } else {
            // Stop trying if we can't place more NPCs
            console.warn(`Could only place ${successfullyCreated} NPCs out of ${npcCount} requested - map is too full`);
            break;
        }
    }
    
    // Update the gameParams to reflect the actual number created
    window.gameParams.npcCount = successfullyCreated;
    lastNpcCount = successfullyCreated;
    
    console.log(`Created ${successfullyCreated} NPCs. Total sprites: ${allSprites.length}`);
}

// Add a function to reset sprite positions when map changes
function resetSpritePositions() {
    // Clear existing sprites and spatial hash
    spriteMap.clear();
    allSprites = [];

    // Re-initialize player sprite
    sprite1 = initializeSpritePosition();
    sprite1.isPlayer = true;
    
    // Make sure player is first in the allSprites array
    allSprites[0] = sprite1;
    
    // Re-initialize NPCs
    const npcCount = window.gameParams.npcCount || 5;
    for (let i = 0; i < npcCount; i++) {
        const npc = initializeSpritePosition();
        if (npc) {
            npc.sprite_y = Math.floor(Math.random() * 32);
            npc.movementDelay = 200 + Math.floor(Math.random() * 400);
        }
    }
    
    // Update lastNpcCount to match
    lastNpcCount = allSprites.length - 1; // Subtract 1 for player
}

async function setup(tilesetBlobUrl: string) {
    // Wait for gameParams to be available if needed
    if (!window.gameParams) {
        console.log("Waiting for gameParams before setup...");
        setTimeout(() => setup(tilesetBlobUrl), 100);
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

    // Initialize WebGLDisplay
    display = new WebGLDisplay(canvas, {});
    await display.initialize(tilesetBlobUrl);

    console.log("WebGLDisplay initialized");

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

    // Initialize player sprite
    sprite1 = initializeSpritePosition();
    sprite1.isPlayer = true; // Mark sprite1 as the player
    
    // Make sure player is first in the allSprites array
    allSprites[0] = sprite1;
    
    // Initialize NPCs
    const npcCount = window.gameParams.npcCount || 5;
    for (let i = 0; i < npcCount; i++) {
        const npc = initializeSpritePosition();
        npc.sprite_y = Math.floor(Math.random() * 32);
        npc.movementDelay = 200 + Math.floor(Math.random() * 400);
    }
    
    // Initialize lastNpcCount to track changes
    lastNpcCount = npcCount;

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
            map.push(22,5)
        } else if (i <= mapWidth-1 || i >= grid_size - mapWidth) {
            map.push(17,5);                
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
      mapUpdateInterval: number;
      lightingEnabled: boolean;
      performanceStats: string;
      zoom: number;
      mapWidth: number;
      mapHeight: number;
      mapSize: number;
      npcCount: number;
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


