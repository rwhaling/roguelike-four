#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

in vec2 v_texcoord;
uniform sampler2D u_texture;
uniform vec4 u_sprite_transp;
uniform vec4 u_aura_color;
uniform float t;
uniform float t_raw;
// Add uniforms for sprite sheet dimensions
uniform vec2 u_spritesheet_dims; // Number of sprites in width and height
uniform float u_sprite_size; // Size of one sprite in pixels (16.0)

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
  // Adjust texture sampling with small inset to prevent seams
  vec2 adjusted_texcoord = v_texcoord;
  
  // Calculate pixel sizes based on uniforms
  float sheet_width_px = u_spritesheet_dims.x * u_sprite_size;
  float sheet_height_px = u_spritesheet_dims.y * u_sprite_size;
  
  // Calculate sprite grid position
  vec2 sprite_pos = floor(v_texcoord * vec2(sheet_width_px, sheet_height_px) / u_sprite_size);
  
  // Calculate position within sprite (0-1 range)
  vec2 sprite_local_pos = fract(v_texcoord * vec2(sheet_width_px, sheet_height_px) / u_sprite_size);
  
  // Apply small inset to avoid texture bleeding (0.01-0.99 instead of 0-1)
  sprite_local_pos = mix(vec2(0.01), vec2(0.99), sprite_local_pos);
  
  // Recombine to get adjusted texture coordinates
  adjusted_texcoord = (sprite_pos + sprite_local_pos) * u_sprite_size / vec2(sheet_width_px, sheet_height_px);
  
  // Use adjusted coordinates for the main texture sample
  outColor = texture(u_texture, adjusted_texcoord) * u_sprite_transp;
  
  // Define the off-black color from the sprite sheet (#0F0425)
  vec4 offBlack = vec4(0.059, 0.016, 0.145, 1.0);
  
  // Generate the noise with faster movement
  float noiseValue = abs(noise(vec3(
    floor(v_texcoord.x * sheet_width_px),
    floor(v_texcoord.y * sheet_height_px),
    t_raw * 3.5 // Fast animation
  )));

  // Check if the pixel is NOT the off-black background color
  // Using a small threshold to handle color variations
  bool isColored = length(outColor.rgb - offBlack.rgb) >= 0.1 && outColor.a > 0.1;

  // Apply aura effect only to colored pixels
  if (isColored) {
    
    // Apply aura color if noise value is above threshold
    if (noiseValue > 0.7 && u_aura_color.a > 0.0) {
      // Blend between original color and aura color based on aura alpha
//      outColor = mix(outColor, vec4(u_aura_color.rgb, outColor.a), u_aura_color.a);
    }
    // Otherwise keep the original color (already set to outColor)
  } else {
    if (noiseValue > 0.9 && u_aura_color.a > 0.0) {
      outColor = mix(outColor, vec4(u_aura_color.rgb, outColor.a), u_aura_color.a);
    } else if (noiseValue > 0.8 && u_aura_color.a > 0.0) {
      outColor = mix(outColor, vec4(u_aura_color.rgb, outColor.a), u_aura_color.a * 0.5);
    }
  }
  // For off-black pixels, keep the original color (already set to outColor)
}