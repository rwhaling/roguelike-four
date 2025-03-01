#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

in vec2 v_texcoord;
uniform sampler2D u_texture;
uniform float t;
uniform float t_raw;
uniform vec2 u_lightcoords[2];
uniform float u_grid_size; // Add grid size uniform
// we need to declare an output for the fragment shader
out vec4 outColor;

float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}

void main() {
  float dist = 1.0;
  
  // Fixed pixelation resolution - this keeps the light quantization consistent 
  // regardless of zoom level
  float pixelationResolution = 64.0;
  
  for (int i = 0; i < 2; i++) {
      // Calculate pixelated distance with fixed resolution
      float this_dist = length(
          (floor(v_texcoord * pixelationResolution) / pixelationResolution) - 
          (floor(u_lightcoords[i] * pixelationResolution) / pixelationResolution)
      );
      
      if (this_dist < dist) {
          dist = this_dist;
      }
  }

  // Scale light radius based on zoom
  float lightRadius = 0.20 * (8.0 / u_grid_size);
  float fadeRadius = 0.40 * (8.0 / u_grid_size);
  
  // Fixed noise scale that doesn't change with zoom
  float noiseScale = 16.0;
  
  float trans = 0.0;
  if (dist < lightRadius) {
      trans = 0.0;
  } else if (dist < fadeRadius) {
      // Create a step function effect for the blocky transition
      // Use more steps at larger zoom levels for better detail
      int steps = 8;  // Fixed number of transition steps
      float step = floor((dist - lightRadius) / (fadeRadius - lightRadius) * float(steps)) / float(steps);
      trans = step * 0.6;
      
      // Scale world coordinates to fixed-size noise cells
      vec2 noiseCoord = floor(v_texcoord * noiseScale * u_grid_size / 8.0) / noiseScale;
      
      float noiseVal = noise(vec3(
          noiseCoord.x * 8.0, 
          noiseCoord.y * 8.0, 
          floor(t_raw * 5.0)
      ));
      
      trans = trans + step * abs(noiseVal) * 0.3;
  } else {
      trans = 0.6 + step(fadeRadius, dist) * 0.2;
      
      vec2 noiseCoord = floor(v_texcoord * noiseScale * u_grid_size / 8.0) / noiseScale;
      
      float noiseVal = noise(vec3(
          noiseCoord.x * 8.0, 
          noiseCoord.y * 8.0, 
          floor(t_raw * 5.0)
      ));
      
      trans = trans + abs(noiseVal) * 0.1;
      trans = min(trans, 0.95);
  }
  
  outColor = vec4(0.0, 0.0, 0.0, trans);
}