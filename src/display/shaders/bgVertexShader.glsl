#version 300 es

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec4 a_position;
in vec2 a_texcoord;
out vec2 v_texcoord;
out vec2 v_position;

// all shaders have a main function
void main() {

  // gl_Position is a special variable a vertex shader
  // is responsible for setting
  gl_Position = a_position;
  v_texcoord = a_texcoord;
//   v_position = (1.0 + a_position.xy) / 2.0;
  v_position = a_texcoord;
}
