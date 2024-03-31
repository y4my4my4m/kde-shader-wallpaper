// https://www.shadertoy.com/view/XtXBD2
// Credits to Shane

/*
    Cylindrically Mapped Hexagons
    -----------------------------

    Wrapping a honeycomb structure around a winding tunnel is something I've been meaning
    to do for a while. I see a lot of rectangular-block tunnel imagery, so wondered how
    hexagons would fare... The aesthetic is interesting, but I think I'd rather have the
    two hours back that it took me to code. :D Anyway, hopefully, it'll be useful to
    someone out there.

    I have no idea what purpose the weird turret-looking objects serve, but I wanted to
    show that the pylons were independent of one another. Plus, the original looked a
    little static, so I added some animation - It seemed to work for Dila's "SpikeRoom"
    example, but I think the jury's out here. :)

    This runs OK, but not fantastic, that's for sure. Fast computers will run it fine, but
    slower ones will probably lag a bit. As a rule, I won't put something up unless my
    fast computer can run it in fullscreen, and this one is borderline. When I get more
    time, I'll find some ways to rectify that. The problem is the need to render neighbors
    to avoid artefacts.

    Rendering two objects is algorithmically necessary. However, if you want to pack the
    hexagonal pylons up tightly with no artefacts, then you realy have no other choice
    than to render in groups of four. With a simplex setup, you can get	away with three
    all up, but with the added overhead, it's a case of diminishing returns. At some stage,
    I'll look for symmetry opportunities, but none leap out at me, at present.

    I wanted to emphasize the hexagonal geometry, so went for a light and clean look...
    Although, clean is never entirely possible without antialiasing. I'll make a more
    stylized version at some stage. I might also put up a more simple example that's
    easier to decipher and less taxing on the GPU.

    // References:

    // A planar version.
    Hexagonal Blocks - Shane
    https://www.shadertoy.com/view/XdjyWD

    // Very basic hexagonal grid setup.
    Minimal Hexagonal Grid - Shane
    https://www.shadertoy.com/view/Xljczw

    // Other 3D hexagon examples:

    // Hexagonal block traversal.
    Canal Ruins - dr2
    https://www.shadertoy.com/view/4dBfzD
    // Based on:
    hexwaves - mattz
    https://www.shadertoy.com/view/XsBczc

    // Different kind of thing, but still awesome.
    Geodesic tiling - tdhooper
    https://www.shadertoy.com/view/llVXRd

*/

#define FAR 50.
#define TAU 6.2831853

// There are two main ways you can spread objects around the radius of a circular object. One is
// to retrieve the center position, then render a rigid object independent of the circular object's
// curvature, which is kind of a way to say that the blocks will have flat tops, sides, etc.
// The other, which is more fiddly, is to allow for curvature. In this case - but not always, it
// looks a little better, so that's the default. Uncomment below, and get a visual representation.
//
//#define RIGID_BLOCKS

// Standard vec2 to float hash.
float hash21(vec2 p){

    return fract(sin(dot(p, vec2(7.163, 157.247)))*43758.5453);

    // n = floor(n*4.999)/4.; // For quantized heights.
    // n = mod(p.x + p.y, 4.)/4.; // For patterns.
}

// Simple hash.
float hash(float n){ return fract(sin(n)*43758.5453); }

// 2x2 matrix rotation.
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// This is a rewrite of IQ's original. It's self contained, which makes it much
// easier to copy and paste. I've also tried my best to minimize the amount of
// operations to lessen the work the GPU has to do, but I think there's room for
// improvement.
//
float n3D(vec3 p){

    // Just some random figures, analogous to stride. You can change this, if you want.
    const vec3 s = vec3(7, 157, 113);

    vec3 ip = floor(p); // Unique unit cell ID.

    // Setting up the stride vector for randomization and interpolation, kind of.
    // All kinds of shortcuts are taken here. Refer to IQ's original formula.
    vec4 h = vec4(0., s.yz, s.y + s.z) + dot(ip, s);

    p -= ip; // Cell's fractional component.

    // A bit of cubic smoothing, to give the noise that rounded look.
    p = p*p*(3. - 2.*p);

    // Standard 3D noise stuff. Retrieving 8 random scalar values for each cube corner,
    // then interpolating along X. There are countless ways to randomize, but this is
    // the way most are familar with: fract(sin(x)*largeNumber).
    h = mix(fract(sin(h)*43758.5453), fract(sin(h + s.x)*43758.5453), p.x);

    // Interpolating along Y.
    h.xy = mix(h.xz, h.yw, p.y);

    // Interpolating along Z, and returning the 3D noise value.
    return mix(h.x, h.y, p.z); // Range: [0, 1].

}

// Approximating - very roughly - the metallic Shadertoy texture. I handcoded this to
// keep algorithmic art purists - like Dr2 - happy. :)
vec3 tex(in vec3 p){

    float ns = n3D(p)*.57 + n3D(p*2.)*.28 + n3D(p*4.)*.15;

    // Some fBm noise based bluish red coloring.
    vec3 n = mix(vec3(.33, .11, .022), vec3(.385, .55, .715), ns);
    n *= mix(vec3(1, .9, .8), vec3(0, .1, .2), n3D(p*32.))*.6 + .4;

    //n =  n*.3 + min(n.zyx*vec3(1.3, .6, .2)*.75, 1.)*.7;

    return clamp(n, 0., 1.);

}

// Tri-Planar blending function. Based on an old Nvidia tutorial.
vec3 tex3D( sampler2D t, in vec3 p, in vec3 n ){

    n = max(abs(n) - .2, 0.001); // n = max(abs(n), 0.001), etc.
    n /= dot(n, vec3(1));
    vec3 tx = texture(t, p.yz).xyz;
    vec3 ty = texture(t, p.zx).xyz;
    vec3 tz = texture(t, p.xy).xyz;

    // Textures are stored in sRGB (I think), so you have to convert them to linear space
    // (squaring is a rough approximation) prior to working with them... or something like that. :)
    // Once the final color value is gamma corrected, you should see correct looking colors.
    return (tx*tx*n.x + ty*ty*n.y + tz*tz*n.z);
}

// The path is a 2D sinusoid that varies over time, depending upon the frequencies, and amplitudes.
vec2 path(in float z){

    //return vec2(0); // Straight path.
    return vec2(sin(z*.085)*7., cos(z*.085)*4.); // Windy path.

}

// One of many ways to blink something on and off smoothly. Here it's used to pop some of
// the pylons up and down, and to change the color shades.
float blinkFunc(float n){

    //return step(.666, n); // No animation.
    return smoothstep(.85, .95, sin(n*TAU + iTime*1.5)); // Animation.
}

// Hacky globals to hold hexagon pylon values, the spike values, and the pylon's random ID. Putting
// these in a struct, or "mat4,"  might be neater, but I'm never quite sure how the compiler will deal with it.
// Chances are, it won't make a difference, so I probably should.
vec4 sh;
vec4 spike4;
vec4 rnd;

// The pylon object. Hacked away on the spot, but basically a hexagonal box, with a hexagonal
// spike and some hacky sinusoidal decoration.
float objectDetail(vec3 p, vec3 b, float rnd, inout float spike){

    // X: Height. YZ: Cross section - Not intuitive, but that's how things fell out.

    // Standard hexagonal conversion.
    p = abs(p);
    p.yz = vec2(p.y*.866 + p.z*.5, p.z);

    // Using the hexagonal field for a bit of decoration.
    float lines = clamp(-cos(max(p.y, p.z)*TAU*3.)*4. + 3.95, 0., 1.);

    // Gets rid of the central dot on the face, but I prefer it as is.
    //if(length(p.yz)<.1) lines = 1.;

    // Moving the colored pylons up and down every once so often. The blink function
    // is coordinated with the color in the rendering section.
    float blink = blinkFunc(rnd);
    b.x += (blink)/6.;

    // Pylon dimensions.
    p -= b;

    // Main hexagonal pylon.
    float h1 = min(max(max(p.x, p.y), p.z), 0.) + length(max(p, 0.)) - .01;

    // Spike object - Just a resized hexagonal pylon.
    p += vec3(-.25, .225, .225);
    float h2 = min(max(max(p.x, p.y), p.z), 0.) + length(max(p, 0.)) - .0;

    // Spike identification.
    spike = h1<h2? 0. : 1.;

    // Mix the spike into the main pylon according to the "blink" function. When
    // the blink function is zero, there is no spike. When it's "1," the spike is
    // fully extended (and the block is colored), and there's a smooth
    // transition in between.
    h1 = mix(h1, min(h1, h2), blink);

    // Adding the edge decoration.
    h1 += lines*.01;

    // Return the object.
    return h1;

}

// Wrapping the non-rigid coordinate. Note the hacky figure on the end... It seems to be dependent
// on the setting for the tunnel radius. There's some tunnel wall mutation involved, so it's
// fudged a little.
float convert(float a, float aNum){

    return (mod(a/TAU, 1./aNum) - .5/aNum)*TAU*1.6;

}

// Cylindrically mapping a grid of overlapping hexagonal pylons to a warped, rounded square tube -
// Otherwise known as a hexagon tiled tunnel. :)
//
// I've done my best to explain the process, but if you're anything like me, you don't enjoy
// trying to decipher other people's custom esoteric functions. Plenty of people on here could
// probably code this in their sleep, but if you're not sure how go about it, start by rendering a
// square grid of overlapping square columns to a flat - or undulating - plane, then progress to
// hexagons.

// Afterward, map the square pylons to a cylinder, and finally, the hexagonal ones. If any of it
// troubles you, use this as a guide... and if you find ways to improve it along the way, feel
// free to let me know. :)
//
float map(vec3 p){

    // Wrap the tunnel (polar mapped hexagonal pylons) around the path.
    p.xy -= path(p.z);

    // Scaling along Z. Changing this value requires tile diameter, tile number and
    // tunnel width adjustments.
    const float zScale = 1.5;

    // Number of pylon segments spread around the tunnel. Actually, the final count is
    // twice this amount, due to rendering two pylons side by side. The other two are
    // rendered in front in the X direction.
    const float aNum = 8.;

    // Radius of the tunnel. The radial polar coordinate with be edged out by that amount.
    const float tunRad = 1.63;

    // Effectively the length of the blocks. Set to something deep enough to block out all
    // the light. Set it to something like ".1" to see thin tiles.
    const float blockRad = 1.;

    // Just an extra factor that controls random height.
    float rndFactor = .5;

    // Hexagonal block dimensions. Play around with them to see what they do.
    const vec3 wd = vec3(blockRad, .235*zScale, .235*zScale);

    // Holding vector for the cylindrical coordinates.
    vec3 pC;

    // A cheap way to polar map a squarish tunnel. Simply mutate the the regular tunnel
    // wall positions a bit. If you warp things too much, the blocks will get too
    // distorted, but this here isn't too noticeable.
    //vec2 mut = pow(abs(p.xy), vec2(4))*.125 + .875; // Etc.
    vec2 mut = p.xy*p.xy*.125 + .875;
    p.xy *= mut*vec2(1, 1.2);

    //p += sin(p*2. + cos(p.yzx*2.))*.1; // Adding bumps. Too much for this example.

    // Scaling Z... This gave me more trouble than I care to admit. Scale here, then
    // scale back when doing the repetition. Simple... now. :)
    p.z /= zScale;

    // Relative Z distances of the four tiles. The bit on the end belongs there, but
    // I can't remember why. Some kind of correction in order to get the get correct height
    // values for wall tiling... or something. I should write these things down. :D
    vec4 fPz = floor(vec4(0, .5, .25, .75) + p.z) - vec4(0, .5, .25, .75);

    // Angle and angular index.
    float a, ia;

    //// Hexagon 1.
    // Standard polar mapping stuff.
    a = atan(p.y, p.x);
    ia = floor(a/TAU*aNum);
    rnd.x = hash21(vec2(ia, fPz.x));
    #ifdef RIGID_BLOCKS
    p.xy = rot2((ia + .5)*TAU/aNum)*p.xy;
    pC = vec3(p.xy, p.z);
    //pp = vec3(length(p.xy)*vec2(cos((ia + .5)*TAU/aNum), sin((ia + .5)*TAU/aNum)), p.z);
    #else
    p.xy = rot2(a)*p.xy;
    pC = vec3(p.xy, p.z); pC.y = convert(a, aNum);
    #endif
    // First entry when you perform: pp.x = mod(pp.x, rad) - rad/2.;
    pC.x -= tunRad - rnd.x*rndFactor + blockRad; // Base tunnel width.
    pC.z = (mod(pC.z, 1.) - .5)*zScale; // Repetition along the tunnel.

    sh.x = objectDetail(pC, wd, rnd.x, spike4.x); // The hexagon pylon object and spike.

    //// Hexagon 2.
    rnd.y = hash21(vec2(ia + .5, fPz.y));
    #ifdef RIGID_BLOCKS
    pC = vec3(p.xy, p.z + .5);
    #else
    pC = vec3(p.xy, p.z  + .5); pC.y = convert(a, aNum);
    #endif
    pC.x -= tunRad - rnd.y*rndFactor + blockRad; // Tunnel width.
    pC.z = (mod(pC.z, 1.) - .5)*zScale;

    sh.y = objectDetail(pC, wd, rnd.y, spike4.y);

    //p.xy = q.xy;
    //// Hexagon 3.
    #ifdef RIGID_BLOCKS
    //p.xy = q.xy;
    p.xy = rot2(-(ia + .5)*TAU/aNum + 3.14159/aNum)*p.xy;
    #else
    p.xy = rot2(-a + 3.14159/aNum)*p.xy;
    #endif
    a = atan(p.y, p.x);
    ia = floor(a/TAU*aNum);

    rnd.z = hash21(vec2(ia, fPz.z));
    #ifdef RIGID_BLOCKS
    p.xy = rot2((ia + .5)*TAU/aNum)*p.xy;
    pC = vec3(p.xy, p.z + .25);
    #else
    p.xy = rot2(a)*p.xy;
    pC = vec3(p.xy, p.z + .25); pC.y = convert(a, aNum);
    #endif
    pC.x -= tunRad - rnd.z*rndFactor + blockRad; // Tunnel width.
    pC.z = (mod(pC.z, 1.) - .5)*zScale;
    sh.z = objectDetail(pC, wd, rnd.z, spike4.z);

    //// Hexagon 4.
    rnd.w = hash21(vec2(ia + .5, fPz.w));
    #ifdef RIGID_BLOCKS
    pC = vec3(p.xy, p.z + .75);
    #else
    pC = vec3(p.xy, p.z + .75); pC.y = convert(a, aNum);
    #endif
    pC.x -= tunRad - rnd.w*rndFactor + blockRad; // Tunnel width.
    pC.z = (mod(pC.z, 1.) - .5)*zScale;
    sh.w = objectDetail(pC, wd, rnd.w, spike4.w);

    // Determining the minimum hexagon pylon distance, then returning it.
    vec2 hx2 = min(sh.xy, sh.zw);
    return min(hx2.x, hx2.y)*.85;

}

// Normal calculation, with some edging and curvature bundled in.
vec3 getNormal(vec3 p, inout float edge, inout float crv, float ef) {

    // Roughly two pixel edge spread, but increased slightly with larger resolution.
    vec2 e = vec2(ef/mix(450., iResolution.y, .5), 0);

    float d1 = map(p + e.xyy), d2 = map(p - e.xyy);
    float d3 = map(p + e.yxy), d4 = map(p - e.yxy);
    float d5 = map(p + e.yyx), d6 = map(p - e.yyx);
    float d = map(p)*2.;

    edge = abs(d1 + d2 - d) + abs(d3 + d4 - d) + abs(d5 + d6 - d);
    //edge = abs(d1 + d2 + d3 + d4 + d5 + d6 - d*3.);
    edge = smoothstep(0., 1., sqrt(edge/e.x*2.));

    /*
    // Wider sample spread for the curvature.
    e = vec2(12./450., 0);
    d1 = map(p + e.xyy), d2 = map(p - e.xyy);
    d3 = map(p + e.yxy), d4 = map(p - e.yxy);
    d5 = map(p + e.yyx), d6 = map(p - e.yyx);
    crv = clamp((d1 + d2 + d3 + d4 + d5 + d6 - d*3.)*32. + .5, 0., 1.);
    */

    e = vec2(.0015, 0); //iResolution.y - Depending how you want different resolutions to look.
    d1 = map(p + e.xyy), d2 = map(p - e.xyy);
    d3 = map(p + e.yxy), d4 = map(p - e.yxy);
    d5 = map(p + e.yyx), d6 = map(p - e.yyx);

    return normalize(vec3(d1 - d2, d3 - d4, d5 - d6));
}

// I keep a collection of occlusion routines... OK, that sounded really nerdy. :)
// Anyway, I like this one. I'm assuming it's based on IQ's original.
float calculateAO(in vec3 p, in vec3 n)
{
    float sca = 2., occ = 0.0;
    for( int i=0; i<6; i++ ){

        float hr = .01 + float(i)*.5/5.;
        float dd = map(p + hr*n);
        occ += (hr - dd)*sca;
        sca *= .7;
    }
    return clamp(1. - occ, 0., 1.);

}

// Using a variation of IQ's AO function to calculate thickness, but with the normal flipped.
// IQ uses a similar setup to calculate SSS... Subsurface AO, I guess you'd call it.
float thickness(in vec3 p, in vec3 n){

    const float sNum = 4.;
    float sca = 1., occ = 0.;
    for(float i=0.; i<sNum + .001; i++ ){

        float hr = 0.05 + .4*i/sNum;
        //vec3 rn = normalize(n + RandomHemisphereDir(n, hr)*rad*.5);
        float dd = map(p - n*hr);
        occ += (hr - min(dd, 0.))*sca;
        sca *= .9;
    }
    return 1. - max(occ/sNum, 0.);

}

// Simple environment mapping. Pass the reflected vector in and create some colored noise with it.
vec3 envMap(vec3 rd){


    float c = n3D(rd*4.)*.66 + n3D(rd*8.)*.34; // Noise value.
    c = smoothstep(.3, 1., c); // Darken and add contast for more of a spotlight look.

    return vec3(c*c*c, c*c, c); // Simple, cool coloring.

}

void mainImage( out vec4 fragColor, in vec2 fragCoord ){

    // Screen coordinates.
    vec2 uv = (fragCoord - iResolution.xy*0.5)/iResolution.y;

    // Camera Setup.
    vec3 camPos = vec3(0, 0, iTime*4.); // Camera position, doubling as the ray origin.
    vec3 lookAt = camPos + vec3(0, 0, .5);  // "Look At" position.

    // Light positioning. Both are behind the camera, and placed in a rough headlight
    // position. One light probably would have done the same thing.
    vec3 light_pos = camPos + vec3(-.35, 0, -.25);// Left light.
    vec3 light_pos2 = camPos + vec3(.35, 0, -.25);// Right light.

    // Using the Z-value to perturb the XY-plane.
    // Sending the camera, "look at," and two light vectors down the tunnel. The "path" function is
    // synchronized with the distance function.
    lookAt.xy += path(lookAt.z);
    camPos.xy += path(camPos.z);
    light_pos.xy += path(light_pos.z);
    light_pos2.xy += path(light_pos2.z);

    // Using the above to produce the unit ray-direction vector.
    float FOV = 3.14159265/3.; // FOV - Field of view.
    vec3 forward = normalize(lookAt-camPos);
    vec3 right = normalize(vec3(forward.z, 0., -forward.x ));
    vec3 up = cross(forward, right);

    // rd - Ray direction.
    //vec3 rd = normalize(forward + FOV*uv.x*right + FOV*uv.y*up);

    // Slight bulbous scene warp.
    vec3 rd = (forward + FOV*uv.x*right + FOV*uv.y*up);
    rd = normalize(vec3(rd.xy, rd.z - length(rd.xy)*.15));

    // Swiveling the camera from left to right when turning corners.
    rd.xy = rot2( path(lookAt.z).x/32. )*rd.xy;
/*

    // Mouse controls, as per Dave Hoskins's suggestion. A bit hacky, but I'll fix them.
    vec2 ms = vec2(0);
    //if (iMouse.z > 1.0)
    ms = (2.*iMouse.xy - iResolution.xy)/iResolution.xy;
    vec2 a = sin(vec2(1.5707963, 0) - ms.x);
    mat2 rM = mat2(a, -a.y, a.x);
    rd.xz = rd.xz*rM;
    a = sin(vec2(1.5707963, 0) - ms.y);
    rM = mat2(a, -a.y, a.x);
    rd.yz = rd.yz*rM;
*/

    // Standard ray marching routine. I find that some system setups don't like anything other than
    // a "break" statement (by itself) to exit.
    float t = 0., dt;
    for(int i=0; i<96; i++){
        dt = map(camPos + rd*t);
        if(abs(dt)<.001*(t*.125 + 1.) || t>FAR){ break; }
        t += dt;
    }

    t = min(t, FAR);

    // Obtaining the random ID and spike ID, in a very lazy fashion.
    float rndID = (sh.x<sh.y && sh.x<sh.z && sh.x<sh.w)? rnd.x : (sh.y<sh.z && sh.y<sh.w)? rnd.y : (sh.z<sh.w)? rnd.z : rnd.w;
    float svSpike = (sh.x<sh.y && sh.x<sh.z && sh.x<sh.w)? spike4.x : (sh.y<sh.z && sh.y<sh.w)? spike4.y : (sh.z<sh.w)? spike4.z : spike4.w;

    // The final scene color. Initated to black.
    vec3 sceneCol = vec3(0.);

    // The ray has effectively hit the surface, so light it up.
    if(t<FAR){

        // Surface position and surface normal.
        vec3 sp = t * rd+camPos;
        float edge = 0., crv = 1., ef = 6.;
        vec3 sn = getNormal(sp, edge, crv, ef);//getNormal(sp);

        // Texture scale factor.
        const float tSize0 = 1./2.;
        const float tSize1 = 1./2.;


        // Ambient occlusion.
        float ao = calculateAO(sp, sn);

        // Light direction vectors.
        vec3 ld = light_pos-sp;
        vec3 ld2 = light_pos2-sp;

        // Distance from respective lights to the surface point.
        float distlpsp = max(length(ld), 0.001);
        float distlpsp2 = max(length(ld2), 0.001);

        // Normalize the light direction vectors.
        ld /= distlpsp;
        ld2 /= distlpsp2;

        // Light attenuation, based on the distances above. In case it isn't obvious, this
        // is a cheap fudge to save a few extra lines. Normally, the individual light
        // attenuations would be handled separately... No one will notice, nor care. :)
        float atten1 = 1./(1. + distlpsp*.125 + distlpsp*distlpsp*.025);
        float atten2 = 1./(1. + distlpsp2*.125 + distlpsp2*distlpsp2*.025);

        // Ambient light.
        float ambience = 0.25;

        // Diffuse lighting.
        float diff = max( dot(sn, ld), 0.0);
        float diff2 = max( dot(sn, ld2), 0.0);
        //diff = diff*diff*2.;
        //diff2 = diff2*diff2*2.;

        // Specular lighting.
        float spec = pow(max( dot( reflect(-ld, sn), -rd ), 0.0 ), 8.);
        float spec2 = pow(max( dot( reflect(-ld2, sn), -rd ), 0.0 ), 8.);

        // Fresnel term. Good for giving a surface a bit of a reflective glow.
        //float fre = pow( clamp(dot(sn, rd) + 1., .0, 1.), 1.);

        // Obtaining the texel color.
        //
        vec3 tP = sp;
        //tP.xy -= path(sp.z); // Wrapping the texture around the path.

        vec3 texCol = tex(tP*tSize0*3.);
        texCol = smoothstep(0., .5, texCol);
        texCol = mix(texCol, vec3(1), .7);

        // Blink function. It's off (zero) mostly, then spikes to on (one) smoothly, just
        // for a split second. Hence, a blink of sorts. Anyway, color the hexagonal pylon
        // (main part and spike) when it's in blink mode.
        float blink = blinkFunc(rndID);;

        // If it's a moving pylon, but not the spike part, color it up and give it a tiny
        // bit of glow.
        if(svSpike<.5) {

            float th = thickness(sp, sn);
            vec3 thCol = texCol*vec3(1, .3, .0)*pow(th, 4.)*8.;

            float blend = dot(sin(sp*TAU/6. - cos(sp.yzx*TAU/6.)*TAU/2.), vec3(.166)) + .5;
            vec3 blinkCol = vec3(1, .1, .2);
            blinkCol = mix(blinkCol, blinkCol.zyx, hash(rndID + .37));
            //thCol = mix(thCol, thCol.zyx, hash(rndID + .37));

            if(hash(rndID)>.66) texCol = mix(texCol*.5*2., (texCol*blinkCol*3. + thCol), blink);
            else texCol = mix(texCol*.5*2., texCol*vec3(1.3, .8, .4) + thCol, blink);

        }
        else if(blink > 0.){ // If it's the spike part of the moving pylon, darken the shade.
            texCol *= .7;
        }

        // Combining the above terms to produce the final color.
        //
        sceneCol = (texCol*(diff*vec3(1) + ao*0.35) + spec*vec3(.5, .7, 1)*2.)*atten1;
        sceneCol += (texCol*(diff2*vec3(1) + ao*0.35) + spec2*vec3(.5, .7, 1)*2.)*atten2;

        // Fake environment mapping: It doesn't make a great deal of physical sense in this scenario,
        // but it gives the impression that some mild reflection is happening.
        sceneCol += envMap(reflect(rd, sn))*(atten1 + atten2)*.5;

        // Applying the ambient occlusion and dark edges.
        sceneCol *= ao*(1. - edge*.9);

        // Very basic grey tone - for debugging purposes.
        //sceneCol = vec3(1)*2./(1.+ t*t*.25)*(1. - edge*.9);

    }

    // Blending in some distance fog.
    sceneCol = mix(sceneCol, mix(vec3(1), vec3(.5, .6, 1), rd.y*.5 + .5), smoothstep(0., .9, t/FAR));

/*
    // Cheap cross hatching. Borrowed from one of my other shaders.
    vec2 oP = uv;
    const float sc = 1.25;
    // Cheap postprocess hash. Interesting, and looks cool with other examples, but
    // possibly a little too much grunge, in this instance. Anyway, I've left it here
    // for anyone who's like to take a look.
    float gr = dot(sceneCol, vec3(.299, .587, .114))*1.;
    sceneCol *= vec3(1.5);
    oP = rot2(3.14159/3.)*oP;
    if(gr<.125) sceneCol *= clamp(sin((oP.x - oP.y)*6.283*96./sc)*1. + .95, 0., 1.)*.7 + .3;
    oP = rot2(3.14159/3.)*oP;
    if(gr<.25) sceneCol *= clamp(sin((oP.x - oP.y)*6.283*96./sc)*1. + .95, 0., 1.)*.7 + .3;
    oP = rot2(3.14159/3.)*oP;
    if(gr<.5) sceneCol *= clamp(sin((oP.x - oP.y)*6.283*96./sc)*1. + .95, 0., 1.)*.7 + .3;
*/

    // Rough gamma correction.
    fragColor = vec4(sqrt(max(sceneCol, 0.)), 1);

}
