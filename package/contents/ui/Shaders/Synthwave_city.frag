// Title: Synthwave city
// Url: https://www.shadertoy.com/view/fdffz2
// By: nyiro0
const int FSAA = 2;
const float EPS = 0.01;
const float FOVH = 70.0;
const float D = 0.1;
const float L = 200.0;
const int MAX_ITER = 100;
const float ROAD_RADIUS = 4.;
const float SPEED = 2.;

const vec3 CYAN = vec3(0.4,.95,1);
const vec3 PINK = vec3(1,.2,.9);
const vec3 BLACK = vec3(0,0,0);

// From https://www.shadertoy.com/view/Msf3WH
vec2 hashv( vec2 p )
{
	p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
	return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}
float noise( in vec2 p )
{
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;

	vec2  i = floor( p + (p.x+p.y)*K1 );
    vec2  a = p - i + (i.x+i.y)*K2;
    float m = step(a.y,a.x); 
    vec2  o = vec2(m,1.0-m);
    vec2  b = a - o + K2;
	vec2  c = a - 1.0 + 2.0*K2;
    vec3  h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
	vec3  n = h*h*h*h*vec3( dot(a,hashv(i+0.0)), dot(b,hashv(i+o)), dot(c,hashv(i+1.0)));
    return dot( n, vec3(70.0) );
}

// Minimum of distance wit hcolor.
vec4 min_sdf(vec4 a, vec4 b) {
    return a.w < b.w ? a : b;
}

// From https://www.shadertoy.com/view/WttXWX
uint hash(uint x)
{
    x ^= x >> 16;
    x *= 0x7feb352dU;
    x ^= x >> 15;
    x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}

//vec4 hash_vec4(uint x)
//{
//    uint hash_ = hash(x);
//    return vec4(
//        hash_ & 0xffU,
//        (hash_ >> 8) & 0xffU,
//        (hash_ >> 16) & 0xffU,
//        (hash_ >> 24) & 0xffU
//    ) / float(0xffU);
//}

vec4 sdf_building( vec3 p, vec3 col, vec3 b, bool get_color)
{
  vec3 q = abs(p) - b;
  float sdf_ = length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
  if(get_color) {
      vec3 bdv = smoothstep(vec3(-.6), vec3(-.4), q);
      float bd = max(bdv.x*bdv.y, max(bdv.x*bdv.z, bdv.y*bdv.z));
      col = mix(col, CYAN, bd);
  }
  return vec4(col,sdf_);
}
float sdf_box( vec3 p, vec3 b)
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

// Color in xyz and sdf in w.
vec4 sdf(in vec3 pos, bool get_color) {
    vec4 sdf_ = vec4(0,0,0,1000);

    const float R_0_X = 32.;
    const float R_0_Z = 32.;
    const float R_0_D = 100.;
    const int GM = 2;
    const int GN = 2;
    const float w = R_0_X/float(GN);
    const float we = .325*w;
    vec3 col;
    if(get_color) {
        uint col_hash = hash(uint(.6*abs(pos.x)) + (uint(1.5*abs(pos.y))<<12) + (uint(.6*abs(pos.z))<<16) + (pos.x > 0. ? 13u : 0u));
        int col_idx = int(col_hash % 16u);
        col = col_idx == 0 ? CYAN : (col_idx == 1 ? PINK : BLACK);
    } else {
        col = BLACK;
    }
    const float heights[4] = float[](42., 34., 34., 32.);
    for(int i = 0; i < GM; i++) {
        for(int j = 0; j < GN; j++) {
            int idx = GN * i + j;
            float height = heights[idx];
            vec3 c = vec3(-R_0_X/2.+w*(0.5+float(j)), 0.0, -R_0_Z/2.+w*(0.5+float(i)));
            vec3 pos0 = pos - c;
            pos0.x += sign(pos.x) * 15.;
            pos0.x = pos0.x-R_0_X*(clamp(round(pos0.x/R_0_X),pos.x > 0. ? 1. : -8.,pos.x > 0. ? 8. : -1.));
            pos0.z += R_0_D;
            pos0.z = pos0.z-R_0_Z*clamp(round(pos0.z/R_0_Z),-16.,0.);
            sdf_ = min_sdf(sdf_, 
                sdf_building(pos0, col, vec3(we, height, we), get_color)
            );
        }
    }
    
    //sdf_ = min_sdf(sdf_, vec4(1,1,1,length(pos-vec3(0,1,-5))-1.));
    {
        vec3 pos1 = pos;
        pos1.x -= ROAD_RADIUS;
        pos1.x = mod(pos1.x+ROAD_RADIUS, 2.*ROAD_RADIUS)-ROAD_RADIUS;
        sdf_ = min_sdf(sdf_, vec4(CYAN, sdf_box(pos1, vec3(0.05,0.05,400.))));
    }
    {
        vec3 pos2 = pos;
        pos2.x = abs(pos2.x);
        pos2.z -= SPEED * iTime;
        pos2.z = mod(pos2.z+ROAD_RADIUS, 2.*ROAD_RADIUS)-ROAD_RADIUS;
        sdf_ = min_sdf(sdf_, vec4(CYAN, sdf_box(pos2 - vec3(ROAD_RADIUS+200.,0,0), vec3(200.,.05,.05))));
    }
    
    return sdf_;
}

float non_zero(float x) {
    return x + (x >= 0. ? 0.0001 : -0.0001);
}

// Ray marching engine.
void rayMarcher(in vec3 cameraPos, in vec3 lookDir, in vec2 screenDim, in vec2 uv,
                inout vec3 col, in bool mirror) {
    vec3 up = vec3(0, 1, 0);
    vec3 lookPerH = normalize(cross(lookDir, up));
    vec3 lookPerV = normalize(cross(-lookDir, lookPerH));
    vec3 screenCenter = cameraPos + lookDir;
    vec3 screenPos = screenCenter + 0.5 * screenDim.x * uv.x * lookPerH
                     + 0.5 * screenDim.y * uv.y * lookPerV;
    
    vec3 rayDir = normalize(screenPos - cameraPos);
    
    // Simple way of doing the reflections, inaccurate if lookDir is not parallel to the ground.
    float diffuse;
    if(mirror) {
        // Noise in function of where the ray intersects the reflective surface.
        float s = -cameraPos.y / non_zero(rayDir.y);
        vec3 surf_inter = cameraPos + s * rayDir;
        if(s < 0.) return;
        vec2 surf_uv = (surf_inter.xz - vec2(0, SPEED*iTime));
        float noise_ = noise(5.*surf_uv);
        diffuse = abs(surf_uv.x) < ROAD_RADIUS ? 0.1 : 0.2;
    
        float noise_coef = abs(surf_uv.x) < ROAD_RADIUS ? 0.05 : 0.2;
        //cameraPos.y = -cameraPos.y;
        cameraPos = surf_inter;
        rayDir.y = -rayDir.y+noise_coef*noise_;
    }
    
    float t = 0.0;
    vec4 dist;
    vec3 pos;
    int iter = 0;
    do {
        pos = cameraPos + t * rayDir;
        dist = sdf(pos, false);
        t += dist.w;
        iter++;
    } while(t < L && iter < MAX_ITER && dist.w > EPS);
    
    if(pos.y < 0.) return;
    
    if(dist.w <= EPS && (!mirror || pos.z > -200.)) {
        dist = sdf(pos, true);
        float v = 1.0 - t / L;
        col = dist.xyz;
    } else {
        float s = (40.-cameraPos.z) / rayDir.z;
        vec2 sky_uv = (cameraPos + s*rayDir).xy;
        float stars_noise = noise(sky_uv);
        float white_intensity = smoothstep(0.6, 1.0, stars_noise);
        col = mix(col, vec3(1,1,1), white_intensity);
    }
    
    if(mirror) {
        col = mix(col, vec3(.5,0,.7), diffuse);
    }
}

vec4 sampleColor(in vec2 sampleCoord )
{
    float aspectRatio = iResolution.x / iResolution.y;
    float screenWidth = 2.0 * D * atan(0.5 * FOVH);

    vec3 cameraPos = vec3(0, 2.5, 0);
    vec3 lookDir = vec3(0, 0., -D);
    vec2 screenDim = vec2(screenWidth, screenWidth / aspectRatio);

    // Normalized pixel coordinates (from -1 to 1)
    vec2 uv = 2.0 * sampleCoord / iResolution.xy - 1.0;
    //vec2 uvf = 2.0* (sampleCoord - iResolution.xy / 2.0) / iResolution.y;
    
    // TODO: anti aliasing
    vec3 col = BLACK;
    rayMarcher(cameraPos, lookDir, screenDim, uv, col, true);
    rayMarcher(cameraPos, lookDir, screenDim, uv, col, false);
    
    // Very useful visual debugging
    //float sdf_2d = sdf(12.*vec3(uvf.x, 0., uvf.y-4.));
    //if(sdf_2d < 0.) col = vec3(cos(60.*sdf_2d), 0, 0);
    //else col = vec3(0, 0, cos(60.*sdf_2d));

    // Output to screen
    return vec4(col, 1.0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec4 colSum = vec4(0);
    for(int i = 0; i < FSAA; i++) {
        for(int j = 0; j < FSAA; j++) {
            colSum += sampleColor(fragCoord + vec2(float(i) / float(FSAA), float(j) / float(FSAA)));
        }
    }
    fragColor = colSum / colSum.w;
}
