import p5 from "p5";

// Parameter definitions moved from main.tsx to here
export const numericParameterDefs = {
  "timeMultiplier": {
    "min": 0,
    "max": 0.01,
    "step": 0.00001,
    "defaultValue": 0.00005, // Set to match initial value
  },
  "noiseSize": {
    "min": 0,
    "max": 100,
    "step": 1,
    "defaultValue": 80,
  },
  "noiseScale": {
    "min": 0,
    "max": 10,
    "step": 0.1,
    "defaultValue": 5,
  },
  "noiseDetailOctave": {
    "min": 0,
    "max": 10,
    "step": 1,
    "defaultValue": 5,
  },
  "noiseDetailFalloff": {
    "min": 0,
    "max": 1,
    "step": 0.05,
    "defaultValue": 0.5,
  },
  "noiseOffset": {
    "min": 0,
    "max": 360,
    "step": 4,
    "defaultValue": 10, // Set to match initial value
  },
  "numberOfCircles": {
    "min": 1,
    "max": 10,
    "step": 1,
    "defaultValue": 3,
  },
  "blurAmount": {
    "min": 0,
    "max": 255,
    "step": 1,
    "defaultValue": 24, // Default to match original value (0x18 = 24)
  }
};

// This type represents the parameter store structure
export type ParameterStore = {
  [K in keyof typeof numericParameterDefs]: number;
};

// Create initialization function here too
export function initParameterStore(): ParameterStore {
  // Initialize from default values in the parameter definitions
  const store = {} as ParameterStore;
  
  Object.entries(numericParameterDefs).forEach(([key, def]) => {
    store[key as keyof ParameterStore] = def.defaultValue;
  });
  
  return store;
}

// This function creates the p5 sketch
export function createSketch(parameterStore: ParameterStore) {
  return function sketch(p: p5) {
    let font: p5.Font;
    
    p.preload = function() {
      // can preload assets here...
      font = p.loadFont(
        new URL("/public/fonts/inconsolata.otf", import.meta.url).href
      );
    };
    
    p.setup = function() {
      p.createCanvas(500, 500, p.WEBGL);
      p.background(0);
      // ...
    };
    
    p.draw = function() {
      let timeMultiplier = parameterStore.timeMultiplier;
      let noiseSize = parameterStore.noiseSize;
      let noiseScale = parameterStore.noiseScale;
      let falloff = parameterStore.noiseDetailFalloff;
      let octaves = parameterStore.noiseDetailOctave;
      let noiseOffsetParam = parameterStore.noiseOffset;
      let numberOfCircles = parameterStore.numberOfCircles;
      let blurAmount = parameterStore.blurAmount;

      p.noiseDetail(
        // number of 'octaves'
        octaves, 
        // scale per-octave
        falloff
      );

      // Instead of clearing, draw a semi-transparent black rectangle
      // that partially obscures previous frames
      p.push();
      p.translate(-p.width/2, -p.height/2); // Move to top-left in WEBGL mode
      
      // Convert blurAmount to hex and use it for the alpha value
      let alphaHex = Math.floor(blurAmount).toString(16).padStart(2, '0');
      p.fill(`#640D5F${alphaHex}`); // Purple with dynamic opacity
      
      p.noStroke();
      p.rect(0, 0, p.width, p.height);
      p.pop();
      
      // get the current time
      let time = p.millis() * timeMultiplier;

      // draw a circle by stepping through in radians in small increments
      let shrinkFactor = 1;
      for (let c = 0; c < numberOfCircles; c++ ) {
        // Store the first point's coordinates to reference when closing the circle
        let firstPointX = 0;
        let firstPointY = 0;
        let firstCalculated = false;
        
        for (let i = 0; i < 2 * Math.PI; i += 0.005) {
          p.push();
          let size = Math.min(p.width, p.height) / 2.5 * shrinkFactor;
          
          // Calculate the regular noise values
          let xNoise = p.noise((i + 0.005 * c * noiseOffsetParam) * noiseScale, time);
          let yNoise = p.noise(time, (i + 0.005 * c * noiseOffsetParam) * noiseScale);
          
          // Calculate position based on the noise
          let x = size * Math.cos(i) + xNoise * noiseSize;
          let y = size * Math.sin(i) + yNoise * noiseSize;
          
          // Store the first point for reference
          if (!firstCalculated) {
            firstPointX = x;
            firstPointY = y;
            firstCalculated = true;
          }
          
          // Create a smooth transition as we approach the end of the circle
          // Define the transition zone (last 5% of the circle)
          const transitionStart = 2 * Math.PI * 0.95;
          if (i > transitionStart) {
            // Calculate how far we are into the transition (0 to 1)
            const transitionProgress = (i - transitionStart) / (2 * Math.PI - transitionStart);
            
            // Smoothly interpolate between current position and the first point
            x = x * (1 - transitionProgress) + firstPointX * transitionProgress;
            y = y * (1 - transitionProgress) + firstPointY * transitionProgress;
          }

          let noiseOffset = noiseSize / 2;
          p.translate(x, y);
          p.noStroke();
          p.circle(-noiseOffset, -noiseOffset, 2);
          p.pop();
        }

        shrinkFactor -= 0.04;
      }
    };
  };
}