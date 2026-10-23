//
// A simplified water effect by Tom@2016
//
// Based on: http://freespace.virgin.net/hugo.elias/graphics/x_water.htm
// A very old Hugo Elias water tutorial :)
//
// Using the same technique as:
//  https://www.shadertoy.com/view/4sd3WB by overlii
// A clever trick to utilize two channels
// and keep buffer A in x/r and buffer B in y/g.
//
// However, now it is twice as slower as my original:
//  https://www.shadertoy.com/view/Xsd3DB
//
// @channels self

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
   vec3 e = vec3(vec2(1.)/iResolution.xy,0.);
   vec2 q = fragCoord.xy/iResolution.xy;
   
   vec4 c = texture(iChannel0, q);
   
   float p11 = c.y;
   
   float p10 = texture(iChannel0, q-e.zy).x;
   float p01 = texture(iChannel0, q-e.xz).x;
   float p21 = texture(iChannel0, q+e.xz).x;
   float p12 = texture(iChannel0, q+e.zy).x;
   
   float d = 0.;
    
   if (iMouse.z > 0.) 
   {
      // Mouse interaction:
      d = smoothstep(4.5,.5,length(iMouse.xy - fragCoord.xy));
   }
   else
   {
      // Simulate rain drops
      float t = iTime*2.;
      vec2 pos = fract(floor(t)*vec2(0.456665,0.708618))*iResolution.xy;
      float amp = 1.-step(.05,fract(t));
      d = -amp*smoothstep(2.5,.5,length(pos - fragCoord.xy));
   }

   // The actual propagation:
   d += -(p11-.5)*2. + (p10 + p01 + p21 + p12 - 2.);
   d *= .99; // dampening
   d *= float(iFrame>=2); // clear the buffer at iFrame < 2
   d = d*.5 + .5;
   
   // Put previous state as "y":
   fragColor = vec4(d, c.x, 0, 0);
}
