import React, { useState } from "react";
import { createRoot } from "react-dom/client";

// Create a global object to allow test.ts to access and modify game parameters
// This is the single source of truth for initialization
window.gameParams = {
  moveSpeed: 50,
  lightingEnabled: false,
  performanceStats: "Initializing...",
  zoom: 12.0,
  mapSize: 10,
  mapWidth: 10,
  mapHeight: 10,
  npcCount: 10
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
      
      {/* NPC Count */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">NPC Count</label>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={gameParameters.npcCount}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.npcCount = value;
            setGameParameters({...window.gameParams, npcCount: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.npcCount}
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
          max="16.0"
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
      
      {/* Performance Stats */}
      <div className="mt-6 p-3 bg-gray-100 rounded text-sm font-mono">
        {gameParameters.performanceStats}
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
      npcCount: number;
    };
  }
}

// The test.ts script will automatically create and append its canvas to the document body
// No additional container is needed as test.ts creates and appends its own elements
