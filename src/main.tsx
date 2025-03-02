import React, { useState } from "react";
import { createRoot } from "react-dom/client";

// Create a global object to allow test.ts to access and modify game parameters
// This is the single source of truth for initialization
window.gameParams = {
  moveSpeed: 50,
  lightingEnabled: false,
  performanceStats: "Initializing...",
  zoom: 20.0,
  mapSize: 16,
  mapWidth: 16,
  mapHeight: 16,
  maxOrcCount: 20,
  maxUndeadCount: 20,
  orcRespawnRate: 200,
  undeadRespawnRate: 200
};

// Now import test.ts after initialization
import "./test";

function GameParametersApp() {
  const [gameParameters, setGameParameters] = useState(window.gameParams);
  
  // Update game parameters state when the window object changes
  React.useEffect(() => {
    const updateGameParams = () => {
      setGameParameters({...window.gameParams});
    };
    
    // Update every 100ms to reflect changes from test.ts
    const intervalId = setInterval(updateGameParams, 100);
    
    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Handler for map size to update both width and height
  const handleMapSizeChange = (value) => {
    window.gameParams.mapSize = value;
    window.gameParams.mapWidth = value;
    window.gameParams.mapHeight = value;
    setGameParameters({
      ...window.gameParams, 
      mapSize: value,
      mapWidth: value,
      mapHeight: value
    });
  };
  
  // Parse the performance stats string into an object for structured display
  const parsePerformanceStats = (statsString) => {
    const stats = {
      renderTime: "N/A",
      fps: "N/A",
      playerHealth: "N/A",
      orcCount: "N/A",
      undeadCount: "N/A",
      orcFortress: "N/A",
      undeadFortress: "N/A"
    };
    
    if (!statsString || statsString === "Initializing...") return stats;
    
    // Extract render time
    const renderMatch = statsString.match(/Render time: ([\d.]+)ms/);
    if (renderMatch) stats.renderTime = renderMatch[1] + "ms";
    
    // Extract FPS
    const fpsMatch = statsString.match(/FPS: ([\d.]+)/);
    if (fpsMatch) stats.fps = fpsMatch[1];
    
    // Extract player health
    const healthMatch = statsString.match(/Health: (\d+)\/(\d+)/);
    if (healthMatch) stats.playerHealth = `${healthMatch[1]}/${healthMatch[2]}`;
    
    // Extract faction counts
    const orcMatch = statsString.match(/Orcs: (\d+)\/(\d+)/);
    if (orcMatch) stats.orcCount = `${orcMatch[1]}/${orcMatch[2]}`;
    
    const undeadMatch = statsString.match(/Undead: (\d+)\/(\d+)/);
    if (undeadMatch) stats.undeadCount = `${undeadMatch[1]}/${undeadMatch[2]}`;
    
    // Extract fortress info
    const orcFortressMatch = statsString.match(/orc fortress: \(([\d]+),([\d]+)\) HP: (\d+)\/(\d+)/);
    if (orcFortressMatch) stats.orcFortress = `Pos: (${orcFortressMatch[1]},${orcFortressMatch[2]}) HP: ${orcFortressMatch[3]}/${orcFortressMatch[4]}`;
    
    const undeadFortressMatch = statsString.match(/undead fortress: \(([\d]+),([\d]+)\) HP: (\d+)\/(\d+)/);
    if (undeadFortressMatch) stats.undeadFortress = `Pos: (${undeadFortressMatch[1]},${undeadFortressMatch[2]}) HP: ${undeadFortressMatch[3]}/${undeadFortressMatch[4]}`;
    
    return stats;
  };
  
  const stats = parsePerformanceStats(gameParameters.performanceStats);
  
  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-6 text-gray-700">Game Parameters</h2>
      
      {/* Movement Speed */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Move Speed</label>
        <input
          type="range"
          min="10"
          max="500"
          step="10"
          value={gameParameters.moveSpeed}
          className="flex-grow"
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            window.gameParams.moveSpeed = value;
            setGameParameters({...window.gameParams, moveSpeed: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.moveSpeed}
        </span>
      </div>
      
      {/* Max Orc Count */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Max Orcs</label>
        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={gameParameters.maxOrcCount}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.maxOrcCount = value;
            setGameParameters({...window.gameParams, maxOrcCount: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.maxOrcCount}
        </span>
      </div>
      
      {/* Max Undead Count */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Max Undead</label>
        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={gameParameters.maxUndeadCount}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.maxUndeadCount = value;
            setGameParameters({...window.gameParams, maxUndeadCount: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.maxUndeadCount}
        </span>
      </div>
      
      {/* Orc Respawn Rate */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Orc Respawn</label>
        <input
          type="range"
          min="100"
          max="10000"
          step="100"
          value={gameParameters.orcRespawnRate}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.orcRespawnRate = value;
            setGameParameters({...window.gameParams, orcRespawnRate: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.orcRespawnRate}ms
        </span>
      </div>
      
      {/* Undead Respawn Rate */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Undead Respawn</label>
        <input
          type="range"
          min="100"
          max="10000"
          step="100"
          value={gameParameters.undeadRespawnRate}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.undeadRespawnRate = value;
            setGameParameters({...window.gameParams, undeadRespawnRate: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.undeadRespawnRate}ms
        </span>
      </div>
      
      {/* Map Size - map regenerates immediately when this changes */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Map Size</label>
        <input
          type="range"
          min="10"
          max="50"
          step="1"
          value={gameParameters.mapSize}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            handleMapSizeChange(value);
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.mapSize}×{gameParameters.mapSize}
        </span>
      </div>
      
      {/* Lighting Toggle */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Lighting</label>
        <div className="flex-grow">
          <input
            type="checkbox"
            checked={gameParameters.lightingEnabled}
            onChange={(e) => {
              const value = e.target.checked;
              window.gameParams.lightingEnabled = value;
              setGameParameters({...window.gameParams, lightingEnabled: value});
            }}
          />
          <span className="ml-2 text-gray-600">Enable lighting effects</span>
        </div>
      </div>
      
      {/* Camera Zoom */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Camera Zoom</label>
        <input
          type="range"
          min="4.0"
          max="32.0"
          step="0.5"
          value={gameParameters.zoom}
          className="flex-grow"
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            window.gameParams.zoom = value;
            setGameParameters({...window.gameParams, zoom: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.zoom.toFixed(1)}
        </span>
      </div>
      
      {/* Game Status (Read-only fields) */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-3 text-gray-700">Game Status</h3>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Performance metrics */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="font-medium text-sm text-gray-600 mb-2">Performance</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm text-gray-700">Render Time:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.renderTime} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600" 
              />
              
              <div className="text-sm text-gray-700">FPS:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.fps} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600" 
              />
            </div>
          </div>
          
          {/* Player stats */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="font-medium text-sm text-gray-600 mb-2">Player</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm text-gray-700">Health:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.playerHealth} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600" 
              />
            </div>
          </div>
          
          {/* Faction stats */}
          <div className="col-span-2">
            <h4 className="font-medium text-sm text-gray-600 mb-2">Faction Status</h4>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-sm text-gray-700">Orcs:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.orcCount} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600" 
              />
              
              <div className="text-sm text-gray-700">Undead:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.undeadCount} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600" 
              />
            </div>
          </div>
          
          {/* Fortress stats */}
          <div className="col-span-2">
            <h4 className="font-medium text-sm text-gray-600 mb-2">Fortresses</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-sm text-gray-700">Orc Fortress:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.orcFortress} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600 col-span-2" 
              />
              
              <div className="text-sm text-gray-700">Undead Fortress:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.undeadFortress} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600 col-span-2" 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Render Game parameters to the game-params-container
const gameParamsContainer = document.getElementById("game-params-container");
if (gameParamsContainer) {
  const gameParamsRoot = createRoot(gameParamsContainer);
  gameParamsRoot.render(<GameParametersApp />);
} else {
  console.error("Cannot find element #game-params-container");
}

// Add TypeScript declaration for window.gameParams
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

// The test.ts script will automatically create and append its canvas to the document body
// No additional container is needed as test.ts creates and appends its own elements
