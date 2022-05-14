// 
// refer to https://www.youtube.com/watch?v=3CycKKJiwis&list=PLGmrMu-IwbguU_nY2egTFmlg691DN7uE5&index=19
// 


// return the distance from point uv to the line ab.
float distLine2D(vec2 uv, vec2 a, vec2 b) {
    vec2 uv_a = uv - a;
    vec2 ab = b - a;
    float t = clamp(dot(uv_a, ab)/dot(ab, ab), 0., 1.);  //t is the proportion of projection (line uv_a) to line ab.
    return length(uv_a - t * ab);
}

float line(vec2 p, vec2 a, vec2 b){
    float d = distLine2D(p, a, b);
    float m = smoothstep(0.03, 0.01, d);
    m *= smoothstep(1.6, 0.0, length(b-a))+smoothstep(0.09, 0.04, abs(length(b-a)-0.75)); // if length(b-a) > 1.5, return 0.
    return m;
}

// noise 0~1
// you can try this function "fract(cos(x*375.3434134)*0.3245*25.1247)" in https://graphtoy.com/ to understand it.
float noise21(vec2 p){
    //p = fract(p * vec2(556.0862, 298.5618));
    //p += dot(p, p + 25.34);     //cos() in here
    //return fract(p.x*p.y);
    float noi = fract(sin(dot(p, vec2(124.4134, 514.43123)))*556.0862);
    return noi;
    
}

vec2 noise22(vec2 p){
    float n = noise21(p);
    return vec2(n, noise21(p+n));
}


vec2 getPos(vec2 id, vec2 off){
    vec2 n = noise22(id+off)*(iTime+16.1616);
    return off+sin(n)*.4;
}


float layer(vec2 uv){
    vec2 gv = fract(uv)-0.5;//
    vec2 id = floor(uv);
    
    vec2 p[9];
    int i = 0;
    for(float y = -1.; y <= 1.; y++){
        for(float x = -1.; x <= 1.; x++){
            p[i++] = getPos(id, vec2(x,y));
        }
    }
    
    
    float m = 0.;
    for(int i = 0; i < 9; i++){
        m += line(gv, p[4], p[i]);
        
        // spark
        vec2 d = (p[i] - gv)*40.;
        m += (1./dot(d, d))*(sin(p[i].x*10.+iTime*5.)*.5+.5);
    }
    m += line(gv, p[1], p[3]);
    m += line(gv, p[1], p[5]);
    m += line(gv, p[3], p[7]);
    m += line(gv, p[5], p[7]);
    
    return m;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.x;
    
    uv*=10.;
    
    
    float m = 0.;
    for(float i = 0. ; i < 1.;i += 1./4.){
        float z = fract(i+iTime*.3);
        float size = mix(1.5, .5, z);
        float fade = smoothstep(0., .2, z);
        m += layer(uv*size+i*20.) * fade;
    }
    
    
    vec3 col = vec3(0.);
    vec3 base = sin(iTime*vec3(.234325, .398579, .53783))*.5+.5;
    col += vec3(m)*base;
    col += uv.y*0.08*base;
    
    // ----------------------
    // vec2 gv = fract(uv)-0.5;
    // col.gb = gv.xy;
    // if(gv.x>.48|| gv.y>.48)col=vec3(1., 0., .0);
    // --------------------------------------------
    
    fragColor = vec4(col, 1.0);
}
