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

out vec4 outColor;

void main() {
  // outColor = texture(u_texture, v_texcoord);

  vec4 tilemap_coords = texture(u_tilemap, v_position);
//  vec2 tilemap_offset = 1.0 - fract(v_position.xy * 10.0); // 10.0 = map_size_x = map_size_y // TODO separate
//  vec2 tilemap_offset = 1.0 - fract(v_position.xy * vec2(20.0,20.0)); // 10.0 = map_size_x = map_size_y // TODO separate
  vec2 tilemap_offset = 1.0 - fract(v_position.xy * u_map_grid_size); // 10.0 = map_size_x = map_size_y // TODO separate


//  vec2 lookup_1 = floor(tilemap_coords.xy * 256.0); // 256 = 8 * 16 = screen_grid_size * pixel grid size I think?
  vec2 lookup_1 = floor(tilemap_coords.xy * 256.0); // 256 = 8 * 16 = screen_grid_size * pixel grid size I think?

//   vec2 lookup_2 = vec2((lookup_1.x + tilemap_offset.x) / 49.0, (lookup_1.y + tilemap_offset.y) / 22.0);
  vec2 lookup_2 = vec2((lookup_1.x + tilemap_offset.x) / 32.0, (lookup_1.y + tilemap_offset.y) / 48.0);

  // HACK
//   outColor = texture(u_texture,lookup_2) * vec4(0.5,0.5,0.5,1.0);
  outColor = texture(u_texture,lookup_2);
  return;
  if (length(outColor) <= 1.0) {
    outColor = vec4(0.274,0.521,0.521,1.0);
  } else {
    outColor = vec4(0.313,0.705,0.596, 1.0);
  }
}