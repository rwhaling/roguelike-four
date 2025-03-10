#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

in vec2 v_texcoord;
uniform sampler2D u_texture;
uniform vec4 u_sprite_transp;
uniform vec4 u_color_swap;
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
  outColor = texture(u_texture, adjusted_texcoord);

  if (outColor == vec4(1.0,1.0,1.0,1.0)) {
    outColor = u_color_swap;
  }
  
  // Early return if you want to test just the adjusted sampling
  // return;
  
}