import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./test"; // Import the test module

// Create a global object to allow test.ts to access and modify game parameters
window.gameParams = {
  moveSpeed: 1000,
  mapUpdateInterval: 3000,
  lightingEnabled: false,
  performanceStats: "Initializing..."
};

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
  
  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-6 text-gray-700">Game Parameters</h2>
      
      {/* Movement Speed */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Move Speed</label>
        <input
          type="range"
          min="200"
          max="2000"
          step="100"
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
      
      {/* Map Update Interval */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Map Update</label>
        <input
          type="range"
          min="1000"
          max="10000"
          step="500"
          value={gameParameters.mapUpdateInterval}
          className="flex-grow"
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            window.gameParams.mapUpdateInterval = value;
            setGameParameters({...window.gameParams, mapUpdateInterval: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.mapUpdateInterval}
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
      mapUpdateInterval: number;
      lightingEnabled: boolean;
      performanceStats: string;
    };
  }
}

// The test.ts script will automatically create and append its canvas to the document body
// No additional container is needed as test.ts creates and appends its own elements
