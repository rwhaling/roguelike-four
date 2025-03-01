#version 300 es

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec4 a_position;
in vec2 a_texcoord;
out vec2 v_texcoord;

// Grid size uniform
uniform float u_grid_size;

// all shaders have a main function
void main() {
  // Calculate grid unit based on passed-in size
  float grid_unit = 2.0/u_grid_size;
  
  // Transform position to NDC space using the dynamic grid size
  // Use positive Y since we've already flipped the coordinates in JavaScript
  gl_Position = vec4(a_position.x * grid_unit, a_position.y * grid_unit, 0.0, 1.0);
  
  v_texcoord = a_texcoord;
}