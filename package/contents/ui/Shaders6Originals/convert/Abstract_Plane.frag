// property Image iChannel0: Image { source: "./Shadertoy_Organic_3.jpg" }
// from Shane
// url https://www.shadertoy.com/view/4sGSRV
/*
  Abstract Plane
  --------------

	Performing 2nd order distance checks on randomized 3D tiles to add some pronounced
	surfacing to a warped plane... Verbose description aside, it's a pretty simple process. :)

	I put this example together some time ago, but couldn't afford a reflective pass, so
	forgot about it. Anyway, I was looking at XT95's really nice "UI" example - plus a
	couple of my own - and realized that a little bit of environment mapping would work
	nicely. I'm using a less sophisticated environment mapping function than XT95's, but
	it produces the desired effect.

    By the way, XT95's is really worth taking a look at. It gives off a vibe of surrounding
	area lights. I tested it on other surfaces and was pretty pleased with the results. The
	link is below.

	As for the geometry itself, it's just a variation of 3D repetitive tiling. I colored in
	some of the regions - Greyscale with a splash of color is on page five of the "Tired Old
	Cliche Design" handbook. :) However, I also to wanted to show that it's possible to
	identify certain regions within the tile in a similar way to which it is done with regular
	Voronoi.

	Other examples:

	// Excellent environment mapping example.
	UI easy to integrate - XT95
	https://www.shadertoy.com/view/ldKSDm

	// As abstact terrain shaders go, this is my favorite. :)
	Somewhere in 1993 - nimitz
	https://www.shadertoy.com/view/Md2XDD
*/


#define FAR 40.

// 2x2 matrix rotation. Note the absence of "cos." It's there, but in disguise, and comes courtesy
// of Fabrice Neyret's "ouside the box" thinking. :)
mat2 rot2( float a ){ vec2 v = sin(vec2(1.570796, 0) - a);	return mat2(v, -v.y, v.x); }



float drawObject(in vec3 p){

    // Anything that wraps the domain will work. The following looks pretty intereting.
    //p = cos(p*3.14159)*0.5;
    //p = abs(cos(p*3.14159)*0.5);

    // Try this one for a regular, beveled Voronoi looking pattern. It's faster to
    // hone in on too, which is a bonus.
    //p = fract(p)-.5;
    //return dot(p, p);

    p = abs(fract(p)-.5);
    return dot(p, vec3(.5));

    //p = abs(fract(p)-.5);
    //return max(max(p.x, p.y), p.z);

    //p = cos(p*3.14159)*0.5;
    //p = abs(cos(p*3.14159)*0.5);
    //p = abs(fract(p)-.5);
    //return max(max(p.x - p.y, p.y - p.z), p.z - p.x);
    //return min(min(p.x - p.y, p.y - p.z), p.z - p.x);

}

// The 3D tiling process. I've explained it in the link below, if you're interested in the process.
//
// Cellular Tiled Tunnel
// https://www.shadertoy.com/view/MscSDB
float cellTile(in vec3 p){

    p /= 5.5;
    // Draw four overlapping objects at various positions throughout the tile.
    vec4 v, d;
    d.x = drawObject(p - vec3(.81, .62, .53));
    p.xy = vec2(p.y-p.x, p.y + p.x)*.7071;
    d.y = drawObject(p - vec3(.39, .2, .11));
    p.yz = vec2(p.z-p.y, p.z + p.y)*.7071;
    d.z = drawObject(p - vec3(.62, .24, .06));
    p.xz = vec2(p.z-p.x, p.z + p.x)*.7071;
    d.w = drawObject(p - vec3(.2, .82, .64));

    v.xy = min(d.xz, d.yw), v.z = min(max(d.x, d.y), max(d.z, d.w)), v.w = max(v.x, v.y);

    d.x =  min(v.z, v.w) - min(v.x, v.y); // Maximum minus second order, for that beveled Voronoi look. Range [0, 1].
    //d.x =  min(v.x, v.y); // First order.

    return d.x*2.66; // Normalize... roughly.

}


vec3 cellTileColor(in vec3 p){


    int cellID = 0;

    p/=5.5;

    vec3 d = (vec3(.75)); // Set the maximum.


    // Draw four overlapping shapes using the darken blend
    // at various positions on the tile.
    d.z = drawObject(p - vec3(.81, .62, .53)); if(d.z<d.x)cellID = 1;
    d.y = max(d.x, min(d.y, d.z)); d.x = min(d.x, d.z);

    p.xy = vec2(p.y-p.x, p.y + p.x)*.7071;
    d.z = drawObject(p - vec3(.39, .2, .11)); if(d.z<d.x)cellID = 2;
    d.y = max(d.x, min(d.y, d.z)); d.x = min(d.x, d.z);

    p.yz = vec2(p.z-p.y, p.z + p.y)*.7071;
    d.z = drawObject(p - vec3(.62, .24, .06)); if(d.z<d.x)cellID = 3;
    d.y = max(d.x, min(d.y, d.z)); d.x = min(d.x, d.z);

    p.xz = vec2(p.z-p.x, p.z + p.x)*.7071;
    d.z = drawObject(p - vec3(.2, .82, .64)); if(d.z<d.x)cellID = 4;
    d.y = max(d.x, min(d.y, d.z)); d.x = min(d.x, d.z);



    vec3 col = vec3(.25);//vec3(.7, .8, 1);


    if (cellID == 3) col = vec3(1, .05, .15);
    //vec3(.1, .8, .0);//vec3(.4, .7, 1.);//vec3(.8, .4, .2);//vec3(1, .05, .15)//

    // Extra color, if desired.
    //if (cellID == 4) col = vec3(.1, .8, .0);//vec3(.5, .4, .35);

    // Interesting, but probably a little to abstract for this example.
    //col *= (vec3(clamp(sin(d.x*24.*6.283)*2., 0., 1.)) + .5);

    return col;



    //return (1.-sqrt(d.x)*1.33);

}


// Standard setup for a plane at zero level with a perturbed surface on it.
float map(vec3 p){

    float n = (.5-cellTile(p))*1.5;
    return p.y + dot(sin(p/2. + cos(p.yzx/2. + 3.14159/2.)), vec3(.5)) + n;

}


// Standard raymarching routine.
float trace(vec3 ro, vec3 rd){

    float t = 0.0;

    for (int i = 0; i < 96; i++){

        float d = map(ro + rd*t);

        if(abs(d)<0.0025*(t*.125 + 1.) || t>FAR) break;

        t += d*.7;  // Using more accuracy, in the first pass.
    }

    return min(t, FAR);
}


// Standard normal function. It's not as fast as the tetrahedral calculation, but more symmetrical. Due to
// the intricacies of this particular scene, it's kind of needed to reduce jagged effects.
vec3 getNormal(in vec3 p) {
	const vec2 e = vec2(0.005, 0);
	return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy),	map(p + e.yyx) - map(p - e.yyx)));
}

/*
// Tetrahedral normal, to save a couple of "map" calls. Courtesy of IQ.
vec3 getNormal( in vec3 p ){

    // Note the larger than usual sampline distance (epsilon value). It's an old trick to give
    // rounded edges, and with the right objects it gives a slightly blurred antialiased look.
    vec2 e = vec2(0.015, -0.015);
    return normalize( e.xyy*map(p+e.xyy ) + e.yyx*map(p+e.yyx ) + e.yxy*map(p+e.yxy ) + e.xxx*map(p+e.xxx ));
}
*/


// I keep a collection of occlusion routines... OK, that sounded really nerdy. :)
// Anyway, I like this one. I'm assuming it's based on IQ's original.
float calculateAO(in vec3 pos, in vec3 nor)
{
	float sca = 2.0, occ = 0.0;
    for( int i=0; i<5; i++ ){

        float hr = 0.01 + float(i)*0.5/4.0;
        float dd = map(nor * hr + pos);
        occ += (hr - dd)*sca;
        sca *= 0.7;
    }
    return clamp( 1.0 - occ, 0.0, 1.0 );
}

// Tri-Planar blending function. Based on an old Nvidia tutorial.
vec3 tex3D( sampler2D tex, in vec3 p, in vec3 n ){

    //return cellTileColor(p);

    n = max((abs(n) - 0.2)*7., 0.001); // n = max(abs(n), 0.001), etc.
    n /= (n.x + n.y + n.z );
	return (texture(tex, p.yz)*n.x + texture(tex, p.zx)*n.y + texture(tex, p.xy)*n.z).xyz;
}

// Texture bump mapping. Four tri-planar lookups, or 12 texture lookups in total. I tried to
// make it as concise as possible. Whether that translates to speed, or not, I couldn't say.
vec3 texBump( sampler2D tx, in vec3 p, in vec3 n, float bf){

    const vec2 e = vec2(0.002, 0);

    // Three gradient vectors rolled into a matrix, constructed with offset greyscale texture values.
    mat3 m = mat3( tex3D(tx, p - e.xyy, n), tex3D(tx, p - e.yxy, n), tex3D(tx, p - e.yyx, n));

    vec3 g = vec3(0.299, 0.587, 0.114)*m; // Converting to greyscale.
    g = (g - dot(tex3D(tx,  p , n), vec3(0.299, 0.587, 0.114)) )/e.x; g -= n*dot(n, g);

    return normalize( n + g*bf ); // Bumped normal. "bf" - bump factor.

}

// Cool curve function, by Shadertoy user, Nimitz.
//
// I think it's based on a discrete finite difference approximation to the continuous
// Laplace differential operator? Either way, it gives you the curvature of a surface,
// which is pretty handy. I used it to do a bit of fake shadowing.
//
// Original usage (I think?) - Cheap curvature: https://www.shadertoy.com/view/Xts3WM
// Other usage: Xyptonjtroz: https://www.shadertoy.com/view/4ts3z2
float curve(in vec3 p, in float w){

    vec2 e = vec2(-1., 1.)*w;

    float t1 = map(p + e.yxx), t2 = map(p + e.xxy);
    float t3 = map(p + e.xyx), t4 = map(p + e.yyy);

    return 0.125/(w*w) *(t1 + t2 + t3 + t4 - 4.*map(p));
}


// Very basic pseudo environment mapping... and by that, I mean it's fake. :) However, it
// does give the impression that the surface is reflecting the surrounds in some way.
//
// Anyway, the idea is very simple. Obtain the reflected ray at the surface hit point, then
// pass it into a 3D function. If you wanted, you could convert the 3D ray coordinates (p)
// to polar coordinates and index into a repeat texture. It can be pretty convincing (in an
// abstract way) and allows environment mapping without the need for a cube map, or a
// reflective pass.
//
// More sophisticated environment mapping:
// UI easy to integrate - XT95
// https://www.shadertoy.com/view/ldKSDm
vec3 envMap(vec3 p){

    // Some functions work, and others don't. The surface is created with the function
    // below, so that makes it somewhat believable.
    float c = cellTile(p*6.);
    c = smoothstep(0.2, 1., c); // Contract gives it more of a lit look... kind of.

    return vec3(pow(c, 8.), c*c, c); // Icy glow... for whatever reason. :)
    // Alternate firey glow.
    //return vec3(min(c*1.5, 1.), pow(c, 2.5), pow(c, 12.));

}

// Simple sinusoidal path, based on the z-distance.
vec2 path(in float z){ float s = sin(z/36.)*cos(z/18.); return vec2(s*16., 0.); }

void mainImage( out vec4 fragColor, in vec2 fragCoord ){

	// Screen coordinates.
	vec2 uv = (fragCoord - iResolution.xy*.5)/iResolution.y;

	// Camera Setup.
	vec3 lk = vec3(0, 3.5, iTime*6.);  // "Look At" position.
	vec3 ro = lk + vec3(0, .25, -.25); // Camera position, doubling as the ray origin.

    // Light positioning. One is just in front of the camera, and the other is in front of that.
 	vec3 lp = ro + vec3(0, .75, 2);// Put it a bit in front of the camera.
	vec3 lp2 = ro + vec3(0, .75, 9);// Put it a bit in front of the camera.

	// Sending the camera, "look at," and two light vectors across the plain. The "path" function is
	// synchronized with the distance function.
	lk.xy += path(lk.z);
	ro.xy += path(ro.z);
	lp.xy += path(lp.z);
	lp2.xy += path(lp2.z);

    // Using the above to produce the unit ray-direction vector.
    float FOV = 1.57; // FOV - Field of view.
    vec3 fwd = normalize(lk-ro);
    vec3 rgt = normalize(vec3(fwd.z, 0., -fwd.x ));
    // "right" and "forward" are perpendicular, due to the dot product being zero. Therefore, I'm
    // assuming no normalization is necessary? The only reason I ask is that lots of people do
    // normalize, so perhaps I'm overlooking something?
    vec3 up = cross(fwd, rgt);

    // rd - Ray direction.
    vec3 rd = normalize(fwd + FOV*uv.x*rgt + FOV*uv.y*up);

    // Swiveling the camera about the XY-plane (from left to right) when turning corners.
    // Naturally, it's synchronized with the path in some kind of way.
	rd.xy *= rot2( path(lk.z).x/64. );

    /*
    // Mouse controls, as per TambakoJaguar's suggestion.
    // Works better if the line above is commented out.
	vec2 ms = vec2(0);
    if (iMouse.z > 1.0) ms = (2.*iMouse.xy - iResolution.xy)/iResolution.xy;
    vec2 a = sin(vec2(1.5707963, 0) - ms.x);
    mat2 rM = mat2(a, -a.y, a.x);
    rd.xz = rd.xz*rM;
    a = sin(vec2(1.5707963, 0) - ms.y);
    rM = mat2(a, -a.y, a.x);
    rd.yz = rd.yz*rM;
	*/

    // Raymarch to the scene.
    float t = trace(ro, rd);

    // Initiate the scene color to black.
	vec3 sceneCol = vec3(0.);

	// The ray has effectively hit the surface, so light it up.
	if(t < FAR){

    	// Surface position and surface normal.
	    vec3 sp = ro + rd*t;
	    vec3 sn = getNormal(sp);

        // Texture scale factor.
        const float tSize0 = 1./2.;
        // Texture-based bump mapping.
	    sn = texBump(iChannel0, sp*tSize0, sn, 0.01);

        // Obtaining the texel color.
	    vec3 texCol = tex3D(iChannel0, sp*tSize0, sn);

	    // Ambient occlusion.
	    float ao = calculateAO(sp, sn);

    	// Light direction vectors.
	    vec3 ld = lp-sp;
	    vec3 ld2 = lp2-sp;

        // Distance from respective lights to the surface point.
	    float lDist = max(length(ld), 0.001);
	    float lDist2 = max(length(ld2), 0.001);

    	// Normalize the light direction vectors.
	    ld /= lDist;
	    ld2 /= lDist2;

	    // Light attenuation, based on the distances above.
	    float atten = 1./(1. + lDist*lDist*0.025);
	    float atten2 = 1./(1. +lDist2*lDist2*0.025);

    	// Ambient light.
	    float ambience = 0.1;

    	// Diffuse lighting.
	    float diff = max( dot(sn, ld), 0.0);
	    float diff2 = max( dot(sn, ld2), 0.0);

    	// Specular lighting.
	    float spec = pow(max( dot( reflect(-ld, sn), -rd ), 0.0 ), 8.);
	    float spec2 = pow(max( dot( reflect(-ld2, sn), -rd ), 0.0 ), 8.);

    	// Curvature.
	    float crv = clamp(curve(sp, 0.125)*0.5+0.5, .0, 1.);

	    // Fresnel term. Good for giving a surface a bit of a reflective glow.
        float fre = pow( clamp(dot(sn, rd) + 1., .0, 1.), 1.);


    	// Darkening the crevices. Otherse known as cheap, scientifically-incorrect shadowing.
	    float shading =  crv*0.5+0.5; //smoothstep(-.05, .1, cellTile(sp));//
        shading *= smoothstep(-.1, .15, cellTile(sp));


        // I got a reminder looking at XT95's "UI" shader that there are cheaper ways
        // to produce a hint of reflectivity than an actual reflective pass. :)
        vec3 env = envMap(reflect(rd, sn))*.5;


        // Combining the above terms to procude the final color.
        vec3 rCol = cellTileColor(sp)*dot(texCol, vec3(.299, .587, .114));
        sceneCol += (rCol*(diff + ambience) + vec3(.8, .95, 1)*spec*1.5 + env)*atten;
        sceneCol += (rCol*(diff2 + ambience) + vec3(.8, .95, 1)*spec2*1.5 + env)*atten2;

        // Cube mapping, for those who want more believable environment mapping.
        //vec3 rfCol = texture(iChannel1, reflect(rd, sn)).xyz; // Forest scene.
        //sceneCol += rfCol*rfCol*.25;


        // Shading.
        sceneCol *= shading*ao;



	}

    // Simple dark fog. It's almost black, but I left a speck of blue in there to account for
    // the blue reflective glow... Although, it still doesn't explain where it's coming from. :)
    sceneCol = mix(sceneCol, vec3(.0, .003, .01), smoothstep(0., FAR-5., t));


	fragColor = vec4(sqrt(clamp(sceneCol, 0., 1.)), 1.0);

}
