// property Image iChannel0: Image { source: "./Shadertoy_Rusty_Metal.jpg" }

// https://www.shadertoy.com/view/MsySWK
// Credits to Shane

/*

	Raymarched 2D Sierpinski
	------------------------

	Raymarching a 2D Sierpinski Carpet pattern. The raymarching process is pretty straight
	forward. Basically, Sierpinski height values are added to a plane. Height maps with
	sharp edges don't raymarch particularly well, so a little edge smoothing was necessary,
	but that's about it.

	The rest is just lighting. Most of it is made up. A bit of diffuse, specular, fake
	environment mapping, etc.


*/

#define FAR 5.

// Tri-Planar blending function. Based on an old Nvidia writeup:
// GPU Gems 3 - Ryan Geiss: https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch01.html
vec3 tex3D( sampler2D tex, in vec3 p, in vec3 n ){

    n = max((abs(n) - .2)*7., .001);
    n /= (n.x + n.y + n.z );

	p = (texture(tex, p.yz)*n.x + texture(tex, p.zx)*n.y + texture(tex, p.xy)*n.z).xyz;

    return p*p;
}

// Compact, self-contained version of IQ's 3D value noise function.
float n3D(vec3 p){

	const vec3 s = vec3(7, 157, 113);
	vec3 ip = floor(p); p -= ip;
    vec4 h = vec4(0., s.yz, s.y + s.z) + dot(ip, s);
    p = p*p*(3. - 2.*p); //p *= p*p*(p*(p * 6. - 15.) + 10.);
    h = mix(fract(sin(h)*43758.5453), fract(sin(h + s.x)*43758.5453), p.x);
    h.xy = mix(h.xz, h.yw, p.y);
    return mix(h.x, h.y, p.z); // Range: [0, 1].
}

// Sierpinski Carpet heightmap - Essentially, space is divided into 3 each iteration,
// and a shape of some kind is rendered. In this case, it's a smooth edged rectangle (w)
// with a bit of curvature (l) around the sides.
//
// There are some opportunites to optimize, but I'll leave it partly readable for now.
//
float heightMap(vec2 p){

    p /= 2.; // Extra scaling.

    float  h = 0., a = 1., sum = 0.; // Height, amplitude, sum.

    for(int i=0; i<4; i++){

        p = fract(p)*3.; // Subdividing space.
        // Far more interesting, mutated subdivision, courtesy of Aiekick.
        //p = fract(p+sin(p.yx*9.)*0.025 + cos(p.yx*9.)*0.025)*3.;
        // Another one with a time component.
        //p = fract(p + sin(p*9. + cos(p.yx*13. + iTime*2.))*0.02)*3.;

        vec2 w = .5 - abs(p - 1.5); // Prepare to make a square. Other shapes are also possible.
        float l = sqrt( max(16.0*w.x*w.y*(1.0-w.x)*(1.0-w.y), 0.))*.5+.5; // Edge shaping.
        w = smoothstep(0., .05, w); // Smooth edge stepping.
        h = max(h, w.x*w.y*a*l); // Producing the smooth edged, shaped square.
        //h += w.x*w.y*a*l;
        //h = max(h, abs(abs(w.x)-abs(w.y))*a*l);
        sum += a; // Keep a total... This could be hardcoded to save cycles.
        a *= .4; // Lower the amplitude for the next subdivision, just because it looks tidier.
        //if(i==2)a*=.75;
    }

    return h/sum;

}

// Raymarching a heightmap on an XY-plane. Pretty standard.
float map(vec3 p){

    // Cheap, lame distortion, if you wanted it.
    //p.xy += sin(p.xy*7. + cos(p.yx*13. + iTime))*.01;

    // Back plane, placed at vec3(0, 0, 1), with plane normal vec3(0., 0., -1).
    // Adding some height to the plane from the heightmap. Not much else to it.
    return 1. - p.z - heightMap(p.xy)*.125;

}

// Texture bump mapping. Four tri-planar lookups, or 12 texture lookups in total. I tried to
// make it as concise as possible. Whether that translates to speed, or not, I couldn't say.
vec3 doBumpMap( sampler2D tx, in vec3 p, in vec3 n, float bf){

    const vec2 e = vec2(0.001, 0);

    // Three gradient vectors rolled into a matrix, constructed with offset greyscale texture values.
    mat3 m = mat3( tex3D(tx, p - e.xyy, n), tex3D(tx, p - e.yxy, n), tex3D(tx, p - e.yyx, n));

    vec3 g = vec3(0.299, 0.587, 0.114)*m; // Converting to greyscale.
    g = (g - dot(tex3D(tx,  p , n), vec3(0.299, 0.587, 0.114)) )/e.x; g -= n*dot(n, g);

    return normalize( n + g*bf ); // Bumped normal. "bf" - bump factor.

}


// Standard normal function.
vec3 getNormal(in vec3 p) {
	const vec2 e = vec2(0.0025, 0);
	return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy),	map(p + e.yyx) - map(p - e.yyx)));
}

// I keep a collection of occlusion routines... OK, that sounded really nerdy. :)
// Anyway, I like this one. I'm assuming it's based on IQ's original.
float calculateAO(in vec3 pos, in vec3 nor)
{
	float sca = 3., occ = 0.;
    for(int i=0; i<5; i++){

        float hr = .01 + float(i)*.5/4.;
        float dd = map(nor * hr + pos);
        occ += (hr - dd)*sca;
        sca *= 0.7;
    }
    return clamp(1.0 - occ, 0., 1.);
}

// Basic raymarcher.
float trace(in vec3 ro, in vec3 rd){

    // Note that the ray is starting just above the raised plane, since nothing is
    // in the way. It's normal practice to start at zero.
    float d, t = 0.75;
    for(int j=0;j<32;j++){

        d = map(ro + rd*t); // distance to the function.
        // The plane "is" the far plane, so no far=plane break is needed.
        if(abs(d)<0.001*(t*.125 + 1.) || t>FAR) break;

        t += d*.7; // Total distance from the camera to the surface.

    }

    return min(t, FAR);

}

// Cool curve function, by Shadertoy user, Nimitz.
//
// It gives you a scalar curvature value for an object's signed distance function, which
// is pretty handy for all kinds of things. Here's it's used to darken the crevices.
//
// From an intuitive sense, the function returns a weighted difference between a surface
// value and some surrounding values - arranged in a simplex tetrahedral fashion for minimal
// calculations, I'm assuming. Almost common sense... almost. :)
//
// Original usage (I think?) - Cheap curvature: https://www.shadertoy.com/view/Xts3WM
// Other usage: Xyptonjtroz: https://www.shadertoy.com/view/4ts3z2
float curve(in vec3 p){

    const float eps = 0.02, amp = 8., ampInit = 0.6;

    vec2 e = vec2(-1., 1.)*eps; //0.05->3.5 - 0.04->5.5 - 0.03->10.->0.1->1.

    float t1 = map(p + e.yxx), t2 = map(p + e.xxy);
    float t3 = map(p + e.xyx), t4 = map(p + e.yyy);

    return clamp((t1 + t2 + t3 + t4 - 4.*map(p))*amp + ampInit, 0., 1.);
}


// Simple environment mapping. Pass the reflected vector in and create some
// colored noise with it. The normal is redundant here, but it can be used
// to pass into a 3D texture mapping function to produce some interesting
// environmental reflections.
vec3 envMap(vec3 rd, vec3 sn){

    vec3 sRd = rd; // Save rd, just for some mixing at the end.

    // Add a time component, scale, then pass into the noise function.
    rd.xy -= iTime*.25;
    rd *= 3.;

    float c = n3D(rd)*.57 + n3D(rd*2.)*.28 + n3D(rd*4.)*.15; // Noise value.
    c = smoothstep(0.4, 1., c); // Darken and add contast for more of a spotlight look.

    vec3 col = vec3(c, c*c, c*c*c*c); // Simple, warm coloring.
    //vec3 col = vec3(min(c*1.5, 1.), pow(c, 2.5), pow(c, 12.)); // More color.

    // Mix in some more red to tone it down and return.
    return mix(col, col.yzx, sRd*.25+.25);

}

void mainImage( out vec4 fragColor, in vec2 fragCoord ){


    // Unit directional ray with no divide, courtesy of Coyote.
    vec3 rd = normalize(vec3(2.*fragCoord - iResolution.xy, iResolution.y));

    // Rotating the XY-plane back and forth, for a bit of variance.
    // 2D rotation with fewer instructions, courtesy of Fabrice Neyret.
    vec2 a = sin(vec2(1.570796, 0) - sin(iTime/4.)*.3);
    rd.xy = rd.xy*mat2(a, -a.y, a.x);


    // Ray origin. Moving in the X-direction to the right.
    vec3 ro = vec3(iTime, cos(iTime/4.), 0.);


    // Light position, hovering around camera.
    vec3 lp = ro + vec3(cos(iTime/2.)*.5, sin(iTime/2.)*.5, -.5);

    // Standard raymarching segment. Because of the straight forward setup, not many
    // iterations are needed.
 	float t = trace(ro, rd);


    // Surface postion, surface normal and light direction.
    vec3 sp = ro + rd*t;
    vec3 sn = getNormal(sp);


	// Texture scale factor.
    const float tSize0 = 1./2.;
    // Texture-based bump mapping.
	sn = doBumpMap(iChannel0, sp*tSize0, sn, 0.002);


    // Point light.
    vec3 ld = lp - sp; // Light direction vector.
    float lDist = max(length(ld), 0.001); // Light distance.
    float atten = 1./(1. + lDist*lDist*.125); // Light attenuation.
    ld /= lDist; // Normalizing the light direction vector.

   // Obtaining the surface texel, then ramping up the contrast a bit.
    vec3 oC = smoothstep(0., 1., tex3D(iChannel0, sp*tSize0, sn));
    // Using the height map to highlight the raised squares. Not for any particular reason.
    oC *= smoothstep(0., .125, heightMap(sp.xy))*1.5 + .5;


    float diff = max(dot(ld, sn), 0.); // Diffuse.
    float spec = pow(max( dot( reflect(-ld, sn), -rd ), 0.0 ), 32.); // Specular.
    float fre = clamp(dot(sn, rd) + 1., .0, 1.); // Fake fresnel, for the glow.

    // Shading. Note, there are no actual shadows. The camera is front on, so the following
    // two functions are enough to give a shadowy appearance.
    float crv = curve(sp); // Curve value, to darken the crevices.
    float ao = calculateAO(sp, sn); // Ambient occlusion, for self shadowing.


    // Combining the terms above to light the texel.
    vec3 col = (oC*(diff + .25) + vec3(1, .7, .3)*spec) + vec3(.1, .3, 1)*pow(fre, 4.)*4.;

    col += (oC*.5+.5)*envMap(reflect(rd, sn), sn)*6.; // Fake environment mapping.
    //col += envMap(reflect(rd, sn), sn)*4.;

    // Applying the shades.
    col *= (atten*crv*ao);

    // Vignette.
    vec2 uv = fragCoord/iResolution.xy;
    col *= pow(16.*uv.x*uv.y*(1.-uv.x)*(1.-uv.y), 0.125);


    // Presenting to the screen.
	fragColor = vec4(sqrt(clamp(col, 0., 1.)), 1.);
}
