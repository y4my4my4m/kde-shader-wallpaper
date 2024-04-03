vec3 erot(vec3 p,vec3 ax,float t){
    return mix(dot(ax,p)*ax,p,cos(t))+cross(ax,p)*sin(t);
 }
float box3(vec3 p,vec3 b){
  vec3 q = abs(p)-b;
  return length(max(vec3(0.),q))+min(0.,max(q.x,max(q.y,q.z)));
}
vec2 sdf(vec3 p){

  vec2 h;
  h.x = 100.;
  vec4 pp = vec4(p,1.);
  pp*=.5;
  
  for(float i=0.;i<6.;i++){
    
      pp *=1.3;
       pp.xyz = erot(pp.xyz,normalize(vec3(sin(iTime*.1+i*pp.a),.1+cos(pp.a),.2)),i+iTime*.1);
     h.x = min((length(pp.xy)-.01)/pp.a,h.x);
    h.x = min((length(pp.xz)-.01)/pp.a,h.x);
    h.x = min((length(pp.yz)-.01)/pp.a,h.x);
      h.x = min(h.x,abs(box3(pp.xyz,vec3(1.75)/pp.a)/pp.a));
  }
  h.y = 1.;
  return h;
}
float hash31( vec3 p ) {
	float h = dot(p,vec3(17, 1527, 113));	
    return fract(sin(h)*43758.5453123);
}
#define q(s) s*sdf(p+s).x
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;

	vec3 col = vec3(.1);
  vec3 ro = vec3(0.,0.,-7.);
  
  vec3 rt = vec3(0,0.,0);
 
  
  vec3 rd = normalize(vec3(uv,1.-.8*sqrt(length(uv))));
  vec3 rp = ro;
  
  float dd = 0.;
  vec3 acc = vec3(0.);
  for(float i=0.;i<128.;i++){
    
      vec2 d = sdf(rp);
      acc +=vec3(.5,sin(length(rp*2.))*.5+.5,cos(length(rp*2.))*.5+.5)*exp(-abs(d.x))/(160.+clamp(asin(cos(length(rp)-iTime*4.-hash31(floor(rp*2.)/2.))),-1.,1.)*130.);
      d.x = max(.001,abs(d.x));
      dd+=d.x ;
      if(dd>60.) break;
      rp+=rd*d.x;
    
  }

    // Output to screen
    fragColor = vec4(col+acc,1.0);
}
