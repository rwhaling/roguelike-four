import React, { useState } from "react";
import { createRoot } from "react-dom/client";

// Create campaign object to map colors to factions
window.gameCampaign = {
  currentRedFaction: "orc",
  currentBlueFaction: "undead",
  currentLevel: 1,
  redFactionReward: "test",
  blueFactionReward: "test", 
  selectedFaction: null,
  gameHistory: []
};

// Create a global object to allow test.ts to access and modify game parameters
// This is the single source of truth for initialization
window.gameParams = {
  moveSpeed: 100,
  lightingEnabled: false,
  performanceStats: "Initializing...",
  zoom: 20.0,
  mapSize: 16,
  mapWidth: 16,
  mapHeight: 16,
  maxRedCount: 20,   // Was maxOrcCount
  maxBlueCount: 20,  // Was maxUndeadCount
  redRespawnRate: 300,   // Was orcRespawnRate
  blueRespawnRate: 300,  // Was undeadRespawnRate
  // Champion-related parameters
  maxRedChampions: 2,    // Was maxOrcChampions
  maxBlueChampions: 2,   // Was maxUndeadChampions
  redChampionSpawnChance: 10,  // Was orcChampionSpawnChance
  blueChampionSpawnChance: 10  // Was undeadChampionSpawnChance
};

// Create a separate UI state object to manage game screens
window.gameUI = {
  currentScreen: "factionSelect", // Start with faction selection: "factionSelect", "playing", "gameOver"
  screenData: {
    message: "Game Over!",
    score: 0,
    playerFaction: null, // Track which faction the player chooses
    // Other screen-specific data can be added here
  }
};

// Now import test.ts after initialization
import "./test";

// Game UI Screen Components
function GameModals() {
  const [currentScreen, setCurrentScreen] = useState(window.gameUI.currentScreen);
  const [screenData, setScreenData] = useState(window.gameUI.screenData);
  
  // Update UI state when window.gameUI changes
  React.useEffect(() => {
    const updateGameUI = () => {
      setCurrentScreen(window.gameUI.currentScreen);
      setScreenData({...window.gameUI.screenData});
    };
    
    // Update every 100ms to reflect changes from test.ts
    const intervalId = setInterval(updateGameUI, 100);
    
    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Render different screens based on currentScreen value
  if (currentScreen === "factionSelect") {
    return <FactionSelectScreen />;
  }
  
  if (currentScreen === "gameOver") {
    return <GameOverScreen data={screenData} />;
  }
  
  if (currentScreen === "levelVictory") {
    return <LevelVictoryScreen data={screenData} />;
  }
  
  if (currentScreen === "campaignVictory") {
    return <CampaignVictoryScreen data={screenData} />;
  }
  
  // Return null when playing (no modal)
  return null;
}

function GameOverScreen({ data }) {
  const isVictory = data.isVictory;
  
  return (
    <div className={`game-modal ${isVictory ? 'game-victory' : 'game-over'}`}>
      <div className="modal-content">
        <h2 className={`text-4xl font-bold mb-4 text-center ${isVictory ? 'text-green-600' : 'text-red-600'}`}>
          {data.message}
        </h2>
        {data.score > 0 && <p className="text-xl mb-6 text-center">Score: {data.score}</p>}
        
        <div className="flex flex-col space-y-4 items-center">
          {/* Retry current level button */}
          <button 
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg w-64"
            onClick={() => retryCurrentLevel()}
          >
            Retry Current Level
          </button>
          
          {/* Start new campaign button */}
          <button 
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg w-64"
            onClick={() => startNewCampaign()}
          >
            New Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

// Function to retry the current level
function retryCurrentLevel() {
  // Reset game UI state to faction selection
  window.gameUI.currentScreen = "factionSelect";
  
  // Call retry function in test.ts if it exists
  if (typeof window.retryCurrentLevel === "function") {
    window.retryCurrentLevel();
  } else {
    console.error("retryCurrentLevel function not found in test.ts");
  }
}

// Function to start a new campaign
function startNewCampaign() {
  // Reset game UI state
  window.gameUI.currentScreen = "factionSelect";
  
  // Call new campaign function in test.ts if it exists
  if (typeof window.startNewCampaign === "function") {
    window.startNewCampaign();
  } else {
    console.error("startNewCampaign function not found in test.ts");
  }
}

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
      playerStamina: "N/A",
      redCount: "N/A",
      blueCount: "N/A",
      redFortress: "N/A",
      blueFortress: "N/A",
      redChampions: "N/A",
      blueChampions: "N/A"
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
    
    // Extract player stamina
    const staminaMatch = statsString.match(/Stamina: (\d+)\/(\d+)/);
    if (staminaMatch) stats.playerStamina = `${staminaMatch[1]}/${staminaMatch[2]}`;
    
    // Extract faction counts
    const redMatch = statsString.match(/Red: (\d+)\/(\d+)/);
    if (redMatch) stats.redCount = `${redMatch[1]}/${redMatch[2]}`;
    
    const blueMatch = statsString.match(/Blue: (\d+)\/(\d+)/);
    if (blueMatch) stats.blueCount = `${blueMatch[1]}/${blueMatch[2]}`;
    
    // Extract fortress info
    const redFortressMatch = statsString.match(/red fortress: \(([\d]+),([\d]+)\) HP: (\d+)\/(\d+)/);
    if (redFortressMatch) stats.redFortress = `Pos: (${redFortressMatch[1]},${redFortressMatch[2]}) HP: ${redFortressMatch[3]}/${redFortressMatch[4]}`;
    
    const blueFortressMatch = statsString.match(/blue fortress: \(([\d]+),([\d]+)\) HP: (\d+)\/(\d+)/);
    if (blueFortressMatch) stats.blueFortress = `Pos: (${blueFortressMatch[1]},${blueFortressMatch[2]}) HP: ${blueFortressMatch[3]}/${blueFortressMatch[4]}`;
    
    // Extract champion counts
    const championMatch = statsString.match(/Champions: Red (\d+)\/(\d+), Blue (\d+)\/(\d+)/);
    if (championMatch) {
      stats.redChampions = `${championMatch[1]}/${championMatch[2]}`;
      stats.blueChampions = `${championMatch[3]}/${championMatch[4]}`;
    }
    
    return stats;
  };
  
  const stats = parsePerformanceStats(gameParameters.performanceStats);
  
  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-6 text-gray-700">Game Parameters</h2>
      
      {/* Game Status (Read-only fields) - MOVED UP */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
          
          {/* Player stats - MODIFIED TO SINGLE ROW */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="font-medium text-sm text-gray-600 mb-2">Player</h4>
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-700">Health:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.playerHealth} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600 w-16" 
              />
              
              <div className="text-sm text-gray-700 ml-3">Stamina:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.playerStamina} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600 w-16" 
              />
            </div>
          </div>
          
          {/* Faction stats */}
          <div className="col-span-2">
            <h4 className="font-medium text-sm text-gray-600 mb-2">Faction Status</h4>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-sm text-gray-700">Red:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.redCount} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600" 
              />
              
              <div className="text-sm text-gray-700">Blue:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.blueCount} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600" 
              />
              
              {/* Add champion status */}
              <div className="text-sm text-gray-700">Red Champions:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.redChampions} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600" 
              />
              
              <div className="text-sm text-gray-700">Blue Champions:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.blueChampions} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600" 
              />
            </div>
          </div>
          
          {/* Fortress stats */}
          <div className="col-span-2">
            <h4 className="font-medium text-sm text-gray-600 mb-2">Fortresses</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-sm text-gray-700">Red Fortress:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.redFortress} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600 col-span-2" 
              />
              
              <div className="text-sm text-gray-700">Blue Fortress:</div>
              <input 
                type="text" 
                readOnly 
                value={stats.blueFortress} 
                className="text-sm bg-gray-100 px-2 py-1 rounded read-only:text-gray-600 col-span-2" 
              />
            </div>
          </div>
        </div>
      </div>
      
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
      
      {/* Max Red Count (formerly Max Orc Count) */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Max {window.gameCampaign.currentRedFaction}</label>
        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={gameParameters.maxRedCount}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.maxRedCount = value;
            setGameParameters({...window.gameParams, maxRedCount: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.maxRedCount}
        </span>
      </div>
      
      {/* Max Blue Count (formerly Max Undead Count) */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Max {window.gameCampaign.currentBlueFaction}</label>
        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={gameParameters.maxBlueCount}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.maxBlueCount = value;
            setGameParameters({...window.gameParams, maxBlueCount: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.maxBlueCount}
        </span>
      </div>
      
      {/* Red Respawn Rate (formerly Orc Respawn Rate) */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">{window.gameCampaign.currentRedFaction} Respawn</label>
        <input
          type="range"
          min="100"
          max="10000"
          step="100"
          value={gameParameters.redRespawnRate}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.redRespawnRate = value;
            setGameParameters({...window.gameParams, redRespawnRate: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.redRespawnRate}ms
        </span>
      </div>
      
      {/* Blue Respawn Rate */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Blue Respawn</label>
        <input
          type="range"
          min="100"
          max="10000"
          step="100"
          value={gameParameters.blueRespawnRate}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.blueRespawnRate = value;
            setGameParameters({...window.gameParams, blueRespawnRate: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.blueRespawnRate}ms
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
      
      {/* Max Red Champions */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Max Red Champions</label>
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={gameParameters.maxRedChampions}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.maxRedChampions = value;
            setGameParameters({...window.gameParams, maxRedChampions: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.maxRedChampions}
        </span>
      </div>
      
      {/* Max Blue Champions */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Max Blue Champions</label>
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={gameParameters.maxBlueChampions}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.maxBlueChampions = value;
            setGameParameters({...window.gameParams, maxBlueChampions: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.maxBlueChampions}
        </span>
      </div>
      
      {/* Red Champion Spawn % */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Red Champion %</label>
        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={gameParameters.redChampionSpawnChance}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.redChampionSpawnChance = value;
            setGameParameters({...window.gameParams, redChampionSpawnChance: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.redChampionSpawnChance}%
        </span>
      </div>
      
      {/* Blue Champion Spawn % */}
      <div className="mb-4 flex items-center gap-4">
        <label className="w-32 font-medium text-gray-700">Blue Champion %</label>
        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={gameParameters.blueChampionSpawnChance}
          className="flex-grow"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            window.gameParams.blueChampionSpawnChance = value;
            setGameParameters({...window.gameParams, blueChampionSpawnChance: value});
          }}
        />
        <span className="w-16 text-right text-gray-600">
          {gameParameters.blueChampionSpawnChance}%
        </span>
      </div>
    </div>
  );
}

// New component for faction selection
function FactionSelectScreen() {
  const selectFaction = (faction) => {
    // Store player's faction choice
    window.gameUI.screenData.playerFaction = faction;
    
    // Switch to playing screen
    window.gameUI.currentScreen = "playing";
    
    // Call function in test.ts to set up game with selected faction
    if (typeof window.startGameWithFaction === "function") {
      window.startGameWithFaction(faction);
    } else {
      console.error("startGameWithFaction function not found in test.ts");
    }
  };

  // Get current factions and rewards directly from campaign
  const redFaction = window.gameCampaign.currentRedFaction;
  const blueFaction = window.gameCampaign.currentBlueFaction;
  const redReward = window.gameCampaign.redFactionReward;
  const blueReward = window.gameCampaign.blueFactionReward;

  // Styles for fortress sprites - using inline styles for compatibility
  const fortressStyle: React.CSSProperties = {
    width: '16px',
    height: '16px',
    backgroundImage: 'url(bg_edits_1.png)',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated' as 'pixelated',
    backgroundSize: '256px 1536px', // Actual size of the spritesheet
    margin: '0 auto',
    transform: 'scale(4)'
  };
  
  const redFortressStyle = {
    ...fortressStyle,
    backgroundPosition: '-160px -336px' // 10,21 in a 16x16 grid
  };
  
  const blueFortressStyle = {
    ...fortressStyle,
    backgroundPosition: '-160px -352px' // 10,22 in a 16x16 grid
  };

  // Get a list of previously used factions for display
  const usedFactions = new Set<string>();
  window.gameCampaign.gameHistory.forEach(level => {
    usedFactions.add(level.currentRedFaction);
    usedFactions.add(level.currentBlueFaction);
  });
  const usedFactionsList = Array.from(usedFactions).join(", ");

  return (
    <div className="game-modal faction-select">
      <div className="modal-content">
        <h2 className="text-4xl font-bold mb-6 text-center">Choose Your Faction</h2>
        <p className="text-xl mb-6 text-center">Level {window.gameCampaign.currentLevel}</p>
        
        {/* Add history display */}
        {window.gameCampaign.gameHistory.length > 0 && (
          <p className="text-sm mb-4 text-center text-gray-600">
            Previous factions: {usedFactionsList}<br/>
            (Completed {window.gameCampaign.gameHistory.length} levels)
          </p>
        )}
        
        <div className="flex justify-center gap-8">
          <div 
            className="faction-choice p-4 border-4 border-red-500 rounded-lg cursor-pointer hover:bg-red-100 transition-all"
            onClick={() => selectFaction(redFaction)}
          >
            <h3 className="text-2xl font-bold text-red-700 mb-2">{redFaction.charAt(0).toUpperCase() + redFaction.slice(1)}</h3>
            <p className="mb-2">Red warrior faction with strong melee units.</p>
            <p className="mb-4 text-sm font-semibold">Reward: {redReward}</p>
            <div className="text-center p-4 bg-red-200 rounded flex justify-center items-center" style={{ minHeight: '100px' }}>
              <div style={redFortressStyle}></div>
            </div>
          </div>
          
          <div 
            className="faction-choice p-4 border-4 border-blue-500 rounded-lg cursor-pointer hover:bg-blue-100 transition-all"
            onClick={() => selectFaction(blueFaction)}
          >
            <h3 className="text-2xl font-bold text-blue-700 mb-2">{blueFaction.charAt(0).toUpperCase() + blueFaction.slice(1)}</h3>
            <p className="mb-2">Blue undead faction with necromantic powers.</p>
            <p className="mb-4 text-sm font-semibold">Reward: {blueReward}</p>
            <div className="text-center p-4 bg-blue-200 rounded flex justify-center items-center" style={{ minHeight: '100px' }}>
              <div style={blueFortressStyle}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add the campaign victory screen component
function CampaignVictoryScreen({ data }) {
  return (
    <div className="game-modal campaign-victory">
      <div className="modal-content">
        <h2 className="text-4xl font-bold mb-4 text-center text-yellow-600">CAMPAIGN VICTORY!</h2>
        <p className="text-2xl mb-6 text-center">{data.message}</p>
        {data.score > 0 && <p className="text-xl mb-2 text-center">Final Score: {data.score}</p>}
        <p className="text-lg mb-6 text-center">Levels Completed: {data.totalLevels}</p>
        
        <div className="flex justify-center">
          {/* Start new campaign button */}
          <button 
            className="px-8 py-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg text-xl"
            onClick={() => startNewCampaign()}
          >
            Start New Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

// Add the level victory screen component
function LevelVictoryScreen({ data }) {
  return (
    <div className="game-modal level-victory">
      <div className="modal-content">
        <h2 className="text-4xl font-bold mb-4 text-center text-green-600">VICTORY!</h2>
        <p className="text-2xl mb-6 text-center">{data.message}</p>
        {data.score > 0 && <p className="text-xl mb-2 text-center">Level Score: {data.score}</p>}
        <p className="text-lg mb-6 text-center">Level {window.gameCampaign.currentLevel} completed!</p>
        
        <div className="flex justify-center">
          {/* Proceed to next level button */}
          <button 
            className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg text-xl"
            onClick={() => proceedToNextLevel()}
          >
            Proceed to Next Level
          </button>
        </div>
      </div>
    </div>
  );
}

// Function to proceed to the next level
function proceedToNextLevel() {
  // Reset game UI state to faction selection
  window.gameUI.currentScreen = "factionSelect";
  
  // Call resetGame function in test.ts which handles advancing to next level
  if (typeof window.resetGame === "function") {
    window.resetGame();
  } else {
    console.error("resetGame function not found in test.ts");
  }
}

// Main App component to organize the UI structure
function App() {
  return (
    <>
      <GameModals />
      <GameParametersApp />
    </>
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

// Render Game UI modals to the game-ui-container
const gameUIContainer = document.getElementById("game-ui-container");
if (gameUIContainer) {
  const gameUIRoot = createRoot(gameUIContainer);
  gameUIRoot.render(<GameModals />);
} else {
  console.error("Cannot find element #game-ui-container");
}

// Update TypeScript declaration for window
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
      redFactionReward: string;
      blueFactionReward: string;
      selectedFaction: string | null;
      gameHistory: any[];
    };
    resetGame?: () => void;
    retryCurrentLevel?: () => void;
    startNewCampaign?: () => void;
    startGameWithFaction?: (faction: string) => void;
  }
}

// The test.ts script will automatically create and append its canvas to the document body
// No additional container is needed as test.ts creates and appends its own elements
