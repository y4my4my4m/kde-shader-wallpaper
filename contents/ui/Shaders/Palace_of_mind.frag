// https://www.shadertoy.com/view/wttXDl
// credits to butadiene

vec2 rot(vec2 p,float r) {
    mat2 m = mat2(cos(r),sin(r),-sin(r),cos(r));
    return m*p;
}

float cube(vec3 p,vec3 s) {
    vec3 q = abs(p);
    vec3 m = max(s - q,0.0);
    return length(max(q - s,0.0)) - min(min(m.x,m.y),m.z);
}


float hasira(vec3 p,vec3 s) {
    vec2 q = abs(p.xy);
    vec2 m = max(s.xy - q.xy,vec2(0.0,0.0));
    return length(max(q.xy - s.xy,0.0)) - min(m.x,m.y);
}

float closs(vec3 p,vec3 s) {
    float d1 = hasira(p,s);
    float d2 = hasira(p.yzx,s.yzx);
    float d3 = hasira(p.zxy,s.zxy);
    return min(min(d1,d2),d3);
}
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));


    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float dist(vec3 p) {
    float k = 1.2;
    vec3 sxyz = floor((p.xyz - 0.5 * k) / k) * k;
    float sz = rand(sxyz.xz);
    float t = iTime*0.05+50.0;
    p.xy = rot(p.xy, t*sign(sz-0.5) * (sz * 0.5 + 0.7));
    p.z += t*sign(sz - 0.5)*(sz*0.5+0.7);
    p = mod(p, k) - 0.5*k;
    float s = 7.0;
    p *= s;
    p.yz = rot(p.yz, 0.76);
    for (int i = 0; i < 4; i++) {
        p = abs(p) - 0.4+(0.25+0.1*sz)*sin(t*(0.5+sz));
        p.xy = rot(p.xy, t*(0.7+sz));
        p.yz = rot(p.yz, 1.3*t+sz);
    }

    float d1 = closs(p,vec3(0.06,0.06,0.06));

    return d1/s;
}

vec3 gn(vec3 p) {

    const float h = 0.001;
    const vec2 k = vec2(1.0, -1.0);
    return normalize(k.xyy * dist(p + k.xyy * h) +
                     k.yyx * dist(p + k.yyx * h) +
                     k.yxy * dist(p + k.yxy * h) +
                     k.xxx * dist(p + k.xxx * h));

}
vec3 light(vec3 p,vec3 view) {
    vec3 normal = gn(p);
    float vn = clamp(dot(-view, normal),0.0,1.0);
    vec3 ld = normalize(vec3(-1,0.9*sin(iTime*0.5)-0.1,0));
    float NdotL = max(dot(ld, normal), 0.0);
    vec3 R = normalize(-ld + NdotL * normal * 2.0);
    float spec = pow(max(dot(-view, R), 0.0), 20.0) * clamp(sign(NdotL),0.0,1.0);
    vec3 col = vec3(1, 1, 1) * (pow(vn,2.0)*0.9 +spec * 0.3);
    float  k = 0.5;
    float ks = 0.9;
    vec2 sxz = floor((p.xz - 0.5 * ks) / ks) * ks;
    float sx = rand(sxz);
    float sy = rand(sxz+100.1);
    float emissive = clamp(0.001/abs((mod(abs(p.y*sx+p.x*sy)+iTime*sign(sx-0.5)*0.4, k) - 0.5 * k)),0.0,1.0);
    return clamp(col * vec3(0.3,0.5,0.9)*0.7 +emissive*vec3(0.2,0.2,1.0),0.0,1.0);
}



void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = (fragCoord.xy * 2.0 - iResolution.xy) / iResolution.yy;
    vec3 tn = iTime*vec3(0.0,0.0,1.0)*0.3;
    float tk = iTime*0.3;
    vec3 ro = vec3(1.*cos(tk),0.2*sin(tk),1.*sin(tk))+tn;
    vec3 ta = vec3(0.0,0.0,0.0)+tn;
    vec3 cdir = normalize(ta-ro);
    vec3 up =vec3(0.,1.,0.);
    vec3 side = cross(cdir,up);
    up = cross(side,cdir);
    float fov = 1.3;
    vec3 rd = normalize(p.x*side+p.y*up+cdir*fov);
    float d = 0.0;
    float t = 0.1;
    float far = 18.;
    float near = t;
    float hit = 0.0001;
    for(int i =0;i<100;i++){
      d = dist(ro+rd*t);
      t += d;
      if (hit>d) break;
    }
	vec3 bcol = vec3(0.1, 0.1, 0.8);
    vec3 col = light(ro + rd * t, rd);

    col = mix(bcol, col, pow(clamp((far - t) / (far - near), 0.0, 1.0),2.0));

   	col.x = pow(col.x,2.2);
    col.y = pow(col.y,2.2);
    col.z = pow(col.z,2.2);
	col *= 2.0;
    fragColor = vec4(col,1.1-t);
}


