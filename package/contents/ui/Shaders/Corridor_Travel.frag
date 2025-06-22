// URL: https://www.shadertoy.com/view/3sXyRN
// By: NuSan

// Inspired by "past racer" by jetlab

// Lower this if too slow
float steps = 30.0;

float time=0.0;

mat2 rot(float a) {
  float ca=cos(a);
  float sa=sin(a);
  return mat2(ca,sa,-sa,ca);  
}

// Camera rotation
void cam(inout vec3 p, float t) {
  t*=0.3;
  p.xz *= rot(sin(t)*0.3);
  p.xy *= rot(sin(t*0.7)*0.4);
}

float hash(float t) {
  return fract(sin(t*788.874));
}

float curve(float t, float d) {
  t/=d;
  return mix(hash(floor(t)), hash(floor(t)+1.0), pow(smoothstep(0.0,1.0,fract(t)),10.0));
}

float tick(float t, float d) {
  t/=d;
  float m=fract(t);
  m=smoothstep(0.0,1.0,m);
  m=smoothstep(0.0,1.0,m);
  return (floor(t)+m)*d;
}

float hash2(vec2 uv) {
  return fract(dot(sin(uv*425.215+uv.yx*714.388),vec2(522.877)));
}

vec2 hash22(vec2 uv) {
  return fract(sin(uv*425.215+uv.yx*714.388)*vec2(522.877));
}

vec3 hash3(vec2 id) {
  return fract(sin(id.xyy*vec3(427.544,224.877,974.542)+id.yxx*vec3(947.544,547.847,652.454))*342.774);
}

float camtime(float t) {
  
  return t*1.9 + tick(t, 1.9)*1.0;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  time=mod(iTime, 300.0);
    
  vec2 uv = vec2(fragCoord.x / iResolution.x, fragCoord.y / iResolution.y);
  uv -= 0.5;
  uv /= vec2(iResolution.y / iResolution.x, 1);

  vec3 col=vec3(0);
  
  vec3 size = vec3(0.9,0.9,1000);
  
  float dof = 0.02;
  float dofdist = 1.0/5.0;
  
    // Path tracing
  for(float j=0.0; j<steps; ++j) {
      
    // DOF offset
    vec2 off=hash22(uv+j*74.542+35.877)*2.0-1.0;
      
    // Motion blur offset
    float t2=camtime(time + j*0.05/steps);
    
    vec3 s=vec3(0,0,-1);
    s.xy += off*dof;
    vec3 r=normalize(vec3(-uv-off*dof*dofdist, 2));
    
    cam(s,t2);
    cam(r,t2);
    
    vec3 alpha=vec3(1);
      
    // Bounces
    for(float i=0.0; i<3.0; ++i) {
        
      // box collision
      vec3 boxmin = (size-s)/r;
      vec3 boxmax = (-size-s)/r;
      
      vec3 box=max(boxmin,boxmax);
        
      // only check box x and y axis
      float d = min(box.x,box.y);
      vec3 p=s+r*d;
      vec2 cuv = p.xz;
      vec3 n=vec3(0,sign(box.y),0);
        
      if(box.x<box.y) {
         
        cuv=p.yz;
        cuv.x+=1.0;
        n=vec3(sign(box.x),0.0,0.0);
			
      }
     
      vec3 p2 = p;
      p2.z += t2*3.0;
      cuv.y += t2*3.0;
      cuv *= 3.0;
      vec2 id = floor(cuv);
      
      float rough = min(1.0,0.85+0.2*hash2(id+100.5));
      
      vec3 addcol = vec3(0);
      //addcol += max(vec3(0),vec3(0.0,sin(cuv.y*0.12 + time*1.7),0.4 + 0.4*sin(cuv.y*0.07 + time*2.3))*4.0*step(hash2(id),0.1));
      //addcol += max(vec3(0),sin(cuv.y*vec3(0.12,0.07,0.02)*0.5 + 1.0*t2*vec3(1.7,2.3,3.7))) * step(hash2(id),0.1);
      addcol += vec3(1.0+max(0.0,cos(cuv.y*0.025)*0.9),0.5,0.2+max(0.0,sin(cuv.y*0.05)*0.5))*2.0;
      addcol *= smoothstep(0.5*curve(time+id.y*0.01+id.x*0.03, 0.3),0.0,hash2(id));
      //addcol *= 0.5+curve(t2+cuv.y*0.3, 0.3);
      //addcol *= step(0.5,sin(p2.x)*sin(p2.z*0.4+curve(t2, 0.1)*1.0));
      addcol *= step(0.5,sin(p2.x)*sin(p2.z*0.4));
      addcol += vec3(0.7,0.5,1.2)*step(p2.y,-0.9)*max(0.0,curve(time,0.2)*2.0-1.0)*step(hash2(id+.7),0.2);
      col += addcol * alpha;
      
      float fre = pow(1.0-max(0.0,dot(n,r)),3.0);
      alpha *= fre*0.9;
      
      vec3 pure=reflect(r,n);
      
      r=normalize(hash3(uv+j*74.524+i*35.712)-0.5);
      float dr=dot(r,n);
      if(dr<0.0) r=-r;
      r=normalize(mix(r,pure,rough));
      
      s=p;
    }

  }
  col /= steps;
  
  col *= 2.0;
  
  col=smoothstep(0.0,1.0,col);
  col=pow(col, vec3(0.4545));
  
    
  fragColor = vec4(col, 1);
}
