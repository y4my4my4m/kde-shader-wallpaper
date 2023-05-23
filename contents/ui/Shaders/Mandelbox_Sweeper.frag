// url: https://www.shadertoy.com/view/3lyXDm
// credits: evvvvil

// Mandelbox Sweeper - Result of an improvised live coding session on Twitch
// Thankx to crundle, jeyko aka wrighter and alkama for the hive mind
// LIVE SHADER CODING, SHADER SHOWDOWN STYLE, EVERY TUESDAYS 21:00 Uk time:
// https://www.twitch.tv/evvvvil_

// "Make your friends believe that you have a bowl of limes by painting a bowl of lemons green" - Viz

vec2 z,v,e=vec2(.000035,-.000035);float t,tt,b,g,g2,bb; vec3 np,bp,pp,po,no,al,ld;//global vars. The city of Norwich, pronounced "shit-hole", will be the butt of today's jokes. 
float bo(vec3 p,vec3 r){p=abs(p)-r;return max(max(p.x,p.y),p.z);} //box primitive function // Norwich is the capital of middle class England and home to 142000 boring cyclists.
mat2 r2(float r){return mat2(cos(r),sin(r),-sin(r),cos(r));} //rotate function // People from Norwich actually live in London, they can be found near Bethnal Green, pricing out the locals with their East-Anglian petro Dollars.
vec2 fb( vec3 p, float m)
{ 
  p.y+=bb*.05; //Make those pesky blue lines dash at the top of the fractal. Racing like art students offended by the lack of houmous served on Norwich university campuses.
  vec2 h,t=vec2(bo(p,vec3(5,1,3)),3); //Blue box base, East Anglia's finest shape since Allan Partridge's striped ties.
  t.x=max(t.x,-(length(p)-2.5)); //Dig fucking hole in box base, because sanctions against the city of Norwich for breeding hipsters should be debated in parliament.
  t.x=max(abs(t.x)-.2,(p.y-0.4));  //Onion trick + cut that shit with horizontal plane . 
  h=vec2(bo(p,vec3(5,1,3)),6);  //Another fucking box this time white. Nothing exciting, neither here nor in Norwich. 
  h.x=max(h.x,-(length(p)-2.5)); //Dig another fucking hole, this time in the white box. 
  h.x=max(abs(h.x)-.1,(p.y-0.5)); //Onion trick + cut that shit with horizontal plane.
  t=t.x<h.x?t:h; //Merge geometries while retaining material ID
  h=vec2(bo(p+vec3(0,0.4,0),vec3(5.4,0.4,3.4)),m); //Blue or orange box, material ID passwed in fb function call
  h.x=max(h.x,-(length(p)-2.5)); //Bored of all this digging hole bullshit but had to be this way with the onion trick fucking with my drilling rig
  t=t.x<h.x?t:h; //Merge geometries while retaining material ID
  h=vec2(length(p)-2.,m); //Finally, stick a ball in the hole (that's what she said)
  t=t.x<h.x?t:h; //Merge geometries while retaining material ID
  t.x*=0.7; return t; //Tweak distance field to avoid artifact and return the whole shit
}
vec2 mp( vec3 p )
{ 
  pp=bp=p; //Setup bullshit new postions pp and bp based on p,  
  bp.yz=p.yz*=r2(sin(pp.x*.3-tt*.5)*.4); //add twist along z axis (due to line below bullshit x axis will become z axis. I know, dumb as fuck, but not as dumb as a vegetarian sausage)
  p.yz*=r2(1.57);//This is some real bullshit, whoever thought it was a good fucking idea to rotate the whole fucking thing rather than flip variables in fb, is a fucking bell-end... Ah, yes, that would be me.
  b=sin(pp.x*.2+tt); //Setup animation variable used all over the shop, you gotta punch the math in if you wanna wiggle
  bb=cos(pp.x*.2+tt); //Setup animation variable used all over the shop, the opposite of above, sort of
  p.x=mod(p.x-tt*2.,10.)-5.; //Modulo along z axis (x is now z, yeah I know, still dumb as fuck, but not as dumb as giving 2.5k fines to the homeless. Yeah I'm looking at you, Oxford, you cruel bastard.
  vec4 np=vec4(p*.4,.4); //make new position np a vec4 for fractal so we can track the scale changes in the .w scalar and reuse that shit later to spank the distance field into shape to avoid artifact 
  for(int i=0;i<4;i++){ //"Less is more" when it comes to iterations, same could be said about prison time.
    np.xyz=abs(np.xyz)-vec3(1,1.2,0); //Kaleidoscopic mandelbullshit
    np.xyz = 2.*clamp(np.xyz, -vec3(0), vec3(2,0.,4.3+bb)) - np.xyz; //Adding the box in "mandelbox", thgankx to alkama for the help there
    np=np*(1.3)/clamp(dot(np.xyz,np.xyz),0.1,.92); //each iter with scale and clamp the mess into beauty. Bit like rhinoplasty, but without the black eyes
  }  
  vec2 h,t=fb(abs(np.xyz)-vec3(2,0,0),5.);//Fuck it we still gonna abs symetry kaleidoscope that shit one more time for more details
  t.x/=np.w; //Yeah that's where the trick is to render fractal without artifact by tweaking domain using the .w scaling scalar 
  t.x=max(t.x,bo(p,vec3(5,5,10))); //Contain the fractal within a box, cuts the sides a bit
  np*=0.5; np.yz*=r2(.785); np.yz+=2.5; //reuse np fractal positions to create another bigger orange fractal on the side
  h=fb(abs(np.xyz)-vec3(0,4.5,0),7.); //np on line above was scaled, rotated and shifted a bit, once again another abs symetry to increase amount of geom
  h.x=max(h.x,-bo(p,vec3(20,5,5))); //remove inside bits of bigger orange fractal
  h.x/=np.w*1.5; //Again trik to render fractal without artifact reusing .w scaling scalar
  t=t.x<h.x?t:h; //Merge geometries while retaining material ID
  h=vec2(bo(np.xyz,vec3(0.0,b*20.,0.0)),6); //Mega glowy light sweeper is here broski, time to take your pants off and indulge.
  h.x/=np.w*1.5; //Since we're using fractal position np again but this itme inside box, still we have to do the scaling scalar trick again to improve rendering
  g2+=0.1/(0.1*h.x*h.x*(1000.-b*998.)); //Balkhan's super sick glow trick, with my added sweep along z axis hot sauce. Things are getting too fucking spicy for the pepper!
  t=t.x<h.x?t:h; //Merge geometries while retaining material ID
  h=vec2(0.6*bp.y+sin(p.y*5.)*0.03,6); //Make a terrain out of a frilled horizontal plane, resue bp position to get the twist as well
  t=t.x<h.x?t:h; //Merge geometries while retaining material ID
  h=vec2(length(cos(bp.xyz*.6+vec3(tt,tt,0)))+0.003,6); //Make it fucking rain sparkly little fucking particles. Because everything looks better when sprinkled with glitter, even Norwich city centre.
  g+=0.1/(0.1*h.x*h.x*4000.); //Make the particle glow and pack the glow with that 4000
  t=t.x<h.x?t:h; //Merge geometries while retaining material ID
  return t;
}
vec2 tr( vec3 ro, vec3 rd ) // main trace / raycast / raymarching loop function 
{
  vec2 h,t= vec2(.1); //Near plane because when it all started the hipsters still lived in Norwich and they only wore tweed.
  for(int i=0;i<128;i++){ //Main loop de loop 
    h=mp(ro+rd*t.x); //Marching forward like any good fascist army: without any care for culture theft. (get distance to geom)
    if(h.x<.0001||t.x>40.) break; //conditional break we hit something or gone too far. Don't let the bastards break you down!
    t.x+=h.x;t.y=h.y; //Huge step forward and remember material id. Let me hold the bottle of gin while you count the colours.
  }
  if(t.x>40.) t.y=0.;//If we've gone too far then we stop, you know, like Alexander The Great did when he realised he left his iPhone charger in Greece. (10 points whoever gets the reference)
  return t;
}
#define a(d) clamp(mp(po+no*d).x/d,0.,1.)
#define s(d) smoothstep(0.,1.,mp(po+ld*d).x/d)
void mainImage( out vec4 fragColor, in vec2 fragCoord )//2 lines above are a = ambient occlusion and s = sub surface scattering
{
  vec2 uv=(fragCoord.xy/iResolution.xy-0.5)/vec2(iResolution.y/iResolution.x,1); //get UVs, nothing fancy, 
  tt=mod(iTime,62.8318);  //Time variable, modulo'ed to avoid ugly artifact. Imagine moduloing your timeline, you would become a cry baby straight after dying a bitter old man. Christ, that's some fucking life you've lived, Steve.
  vec3 ro=mix(vec3(1),vec3(-0.5,1,-1),ceil(sin(tt*.5)))*vec3(10,2.8+0.75*smoothstep(-1.5,1.5,1.5*cos(tt+0.2)),cos(tt*0.3)*3.1),//Ro=ray origin=camera position We build camera right here broski. Gotta be able to see, to peep through the keyhole.
  cw=normalize(vec3(0)-ro), cu=normalize(cross(cw,normalize(vec3(0,1,0)))),cv=normalize(cross(cu,cw)),
  rd=mat3(cu,cv,cw)*normalize(vec3(uv,.5)),co,fo;//rd=ray direction (where the camera is pointing), co=final color, fo=fog color
  ld=normalize(vec3(.2,.4,-.3)); //ld=light direction
  co=fo=vec3(.1,.2,.3)-length(uv)*.1-rd.y*.2; //background is blueish with vignette and subtle vertical gradient based on ray direction y axis. It's dark like the heart of people from Norwich.
  z=tr(ro,rd);t=z.x; //Trace the trace in the loop de loop. Sow those fucking ray seeds and reap them fucking pixels.
  if(z.y>0.){ //Yeah we hit something, unlike you trying it with that mediocre looking waitress
    po=ro+rd*t; //Get ray pos, know where you at, be where you is.
    no=normalize(e.xyy*mp(po+e.xyy).x+e.yyx*mp(po+e.yyx).x+e.yxy*mp(po+e.yxy).x+e.xxx*mp(po+e.xxx).x); //Make some fucking normals. You do the maths while I count how many instances of Holly Willoughby there really is.
    al=mix(vec3(0.1,0.2,.4),vec3(0.1,0.4,.7),.5+0.5*sin(bp.y*7.)); //al=albedo=base color, by default it's a mix between blue/turquoise and darker blue. mix is done by reusing bp in a sin, weird I know but not as weird as Norwich's suburban dogging scene
    if(z.y<5.) al=vec3(0); //material ID < 5 makes it black
    if(z.y>5.) al=vec3(1); //material ID > 5 makes it white
    if(z.y>6.) al=mix(vec3(1,.5,0),vec3(.9,.3,.1),.5+.5*sin(bp.y*7.)); //Material ID 7 gives us greadient orange -> red colour, again mixing between colours by reusing bp in a sin
    float dif=max(0.,dot(no,ld)), //Dumb as fuck diffuse lighting
    fr=pow(1.+dot(no,rd),4.), //Fr=fresnel which adds background reflections on edges to composite geometry better
    sp=pow(max(dot(reflect(-ld,no),-rd),0.),40.); //Sp=specular, stolen from Shane, below you will find: mix(vec3(.8),vec3(1),abs(rd))*al is a sick trick by crundle to tweak colour depending on ray direction
    co=mix(sp+mix(vec3(.8),vec3(1),abs(rd))*al*(a(.1)*a(.2)+.2)*(dif+s(2.)),fo,min(fr,.2)); //Building the final lighting result, compressing the fuck outta everything above into an RGB shit sandwich
    co=mix(fo,co,exp(-.0003*t*t*t)); //Fog soften things, but it won't stop failed art students from becoming dictators.
  }
  fragColor = vec4(pow(co+g*.2+g2*mix(vec3(1.,.5,0),vec3(.9,.3,.1),.5+.5*sin(bp.y*3.)),vec3(0.65)),1);// Naive gamma correction and glow applied at the end
}
