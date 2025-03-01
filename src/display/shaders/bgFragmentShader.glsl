#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

in vec2 v_texcoord;
in vec2 v_position;
uniform sampler2D u_texture;
uniform sampler2D u_tilemap;
uniform vec2 u_map_grid_size;
uniform vec2 u_screen_grid_size;
uniform vec2 u_spritesheet_dims;

out vec4 outColor;

void main() {
  // outColor = texture(u_texture, v_texcoord);

  vec4 tilemap_coords = texture(u_tilemap, v_position);
  
  // Apply a small epsilon to avoid rounding errors
  vec2 tilemap_offset = 1.0 - fract(v_position.xy * u_map_grid_size);
  
  // Use a more precise calculation for tile lookup
  vec2 sprite_index = floor(tilemap_coords.xy * 255.99);
  
  // Calculate the texture coordinate in the tileset with a small inset to avoid seams
  vec2 lookup_2 = vec2(
    (sprite_index.x + tilemap_offset.x * 0.99) / u_spritesheet_dims.x,
    (sprite_index.y + tilemap_offset.y * 0.99) / u_spritesheet_dims.y
  );

  outColor = texture(u_texture, lookup_2);
  return;
  if (length(outColor) <= 1.0) {
    outColor = vec4(0.274,0.521,0.521,1.0);
  } else {
    outColor = vec4(0.313,0.705,0.596, 1.0);
  }
}