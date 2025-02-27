#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

in vec2 v_texcoord;
uniform sampler2D u_texture;
uniform float t;
uniform float t_raw;
uniform vec2 u_lightcoords[2];
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
  int i;
  for (i = 0; i < 2; i++) {
      float this_dist = length((round((v_texcoord) * 16.0) - round((u_lightcoords[i]) * 16.0)) / 16.0);
      if (this_dist < dist) {
        dist = this_dist;
      }
  }
//   float dist = length(floor((v_texcoord - u_lightcoords[0]) * 16.0) / 16.0);
//   float dist = min_dist;
  float trans = 0.0;
  if (dist < 0.30) {
    trans = 0.0;
  } else if (dist < 0.50) {
    trans = (dist - 0.30) * 1.5;
    trans = trans + (trans * abs(noise(vec3(round(v_texcoord.x * 16.0),round(v_texcoord.y * 16.0),round(t_raw * 50.0) / 10.0))));    
  } else {
    trans = 0.30 + (dist - 0.50) * 0.6;
    trans = trans + (trans * abs(noise(vec3(round(v_texcoord.x * 16.0),round(v_texcoord.y * 16.0),round(t_raw * 50.0) / 10.0))));
  }
  outColor = vec4(0.0,0.0,0.0,trans);
}