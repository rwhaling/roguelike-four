#version 300 es

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec4 a_position;
in vec2 a_texcoord;
out vec2 v_texcoord;

// Grid size uniform is still passed but we don't scale the position
uniform float u_grid_size;

// all shaders have a main function
void main() {
  // Pass through position directly - keep the quad fullscreen
  gl_Position = a_position;
  
  // Pass texcoords through to fragment shader
  v_texcoord = a_texcoord;
}