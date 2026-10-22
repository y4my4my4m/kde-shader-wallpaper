// Hive_Spectrum — hexagonal honeycomb where every cell listens to its own slice
// @channels audio, bufferA
// of the spectrum (the Audio3D per-element lesson, own implementation):
// frequency grows with the hex ring distance from the center (bass core,
// treble rim) and a per-cell hash jitter decorrelates neighbors so the comb
// never moves as one block. Audio is read directly in THIS pass (iChannel0 —
// wiring verified with Spec_Debug); the spatial ensemble of ~200 cells
// replaces temporal smoothing.
// Control map (7 axes, cross-coupled):
//   cell brightness   <- FFT at ring-mapped frequency (per cell)
//   honey fill        <- leaky energy INTEGRAL (loud fills ~20 s, quiet drains)
//   kick ripple       <- wave expanding over hex rings from the center
//   palette           <- ring distance + smoothed centroid tilts all hues
//   wax border sparkle<- treble flash, hash-gated per cell
//   global glow gain  <- pressure
//   comb swell        <- kick envelope (gentle zoom)
//   wax caps          <- per-cell depth below the honey line
//   bees              <- 54 striped workers read from the BUFFER BEE TABLE
//                        (columns 6..59: pos, heading, fade) — positions are
//                        per-frame constants, so the buffer computes each
//                        once and this pass does one texel read + a gaussian
//                        per bee instead of 2 beePath + ~5 hashes per PIXEL
//   CRACK climax      <- honey reaching full: shake + golden flash +
//                        an EXACT-VORONOI fissure network (T14: distance to
//                        the perpendicular bisector — constant-width cracks,
//                        new network every crack via crackSeed) + rising
//                        honey-vapor puffs (T13's fog idea in 2D) + shockwave
// Shadertoy: https://www.shadertoy.com/view/NfdXDf
// PAIRED with Hive_Spectrum_bufferA.frag - the engine finds it BY NAME,
// so a copy must rename both.
// License: GPL-3.0 (shaderlib original).

#define TAU 6.2831853

float ign(vec2 p){
    return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715))));
}
float hash12(vec2 p){
    vec3 q = fract(vec3(p.xyx) * .1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}
vec3 pal(float t){
    return vec3(.55,.40,.25) + vec3(.45,.42,.38) *
           cos(TAU * (vec3(1.,.95,.9)*t + vec3(.05,.32,.6)));
}
// honey gamut (v19): a ramp between two ambers; a two-point ramp cannot
// leave the honey family. Linear light: sRGB ~(.74,.44,.13) .. (.97,.75,.30).
// Phases past ring 5 saturate at .52, where k sits on its .18 floor (v21),
// so the dark end is a red amber, not brown; depth shading supplies the
// darks.
vec3 honeyGold(float t){
    float k = .18 + .82*(.5 + .5*cos(6.2831*t));
    return mix(vec3(.50, .16, .014), vec3(.93, .52, .075), k);
}
#define COLS 60.
// pointy-top hex distance in units of circumradius (edge at .866)
float hexD(vec2 l){
    l = abs(l);
    return max(l.x, l.x*.5 + l.y*.8660254);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 p = (2.*fragCoord - iResolution.xy) / iResolution.y;

    vec4 s1 = texture(iChannel1, vec2(1.5/COLS, .5)); // b4,b5,press,centSm
    vec4 s2 = texture(iChannel1, vec2(2.5/COLS, .5)); // kick,gate,treF,raw0
    vec4 s3 = texture(iChannel1, vec2(3.5/COLS, .5)); // fFine,ripple,fCoarse,MAGIC
    vec4 s4 = texture(iChannel1, vec2(4.5/COLS, .5)); // crackT,seed,beeC,beeF

    float press = s1.z, centS = s1.w;
    // bass = the SWELL from c5 (normalized deviation, 0..1), not the raw
    // dB-mapped level — the level is nearly constant on real music (v25)
    float bass = texture(iChannel1, vec2(5.5/COLS, .5)).z;
    float kick = s2.x, treF = s2.z;
    float ripple = s3.y, fill = clamp((s3.z + s3.x)/64., 0., 1.);
    float crackT = clamp(s4.x, 0., 1.);
    float crackE = exp(-crackT * 5.) * step(crackT, .999);   // burst envelope

    p *= 1. - .03 * kick;                              // comb swell
    p += .012 * crackE * vec2(sin(crackT*90.), cos(crackT*73.));  // shake
    float R = .11;                                     // hex circumradius

    // axial coords + cube rounding
    float qa = (.5773503*p.x - .3333333*p.y) / R;
    float ra = (.6666667*p.y) / R;
    float x = qa, z = ra, y = -x - z;
    float rx = floor(x+.5), ry = floor(y+.5), rz = floor(z+.5);
    float dx = abs(rx-x), dy = abs(ry-y), dz = abs(rz-z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz)       ry = -rx - rz;
    else                    rz = -rx - ry;
    vec2 id = vec2(rx, rz);
    vec2 cen = vec2(R*1.7320508*(id.x + id.y*.5), R*1.5*id.y);
    vec2 l = (p - cen) / R;                            // local, edge at .866

    float ring = (abs(rx) + abs(ry) + abs(rz)) * .5;   // hex ring distance
    float h = hash12(id + 7.3);

    // ---- per-cell spectrum tap: bass core -> treble rim + hash jitter ----
    float nf = clamp(ring / 8., 0., 1.);               // quadratic compression:
    float fx = clamp(.02 + .38*nf*nf + (h - .5)*.03, .02, .60);  // busy low half
    float lvl = texture(iChannel0, vec2(fx, .25)).r;
    float g = smoothstep(.18, .68, lvl);               // sigmoid gate
    g = g*g*(3. - 2.*g);

    // kick ripple crossing this ring
    float wave = exp(-abs(ring - ripple) * .9) * step(ripple, 8.5);

    // ---- compose ----
    // Colours below are linear light; the tone stage gamma-encodes once.
    // pal() is sRGB-picked and squared into linear here: fed through the
    // encode as-is it lifts the wax gaps to ~.24 grey and pales the honey.
    float hd = hexD(l);
    // cell rim resolves in ~3 px (analytic footprint; dFdx is unavailable
    // in this engine). aa = one screen pixel in hd units.
    float aa = 2. / (R * iResolution.y);
    float rim = smoothstep(.80 - 1.5*aa, .80 + 1.5*aa, hd);
    float inner  = 1. - rim;
    float dome   = 1. - smoothstep(.0, .80, hd);       // 1 at cell center
    float border = smoothstep(.72, .866, hd);

    vec3 col = vec3(.010, .006, .0025);                // wax gap
    float lvlLine = (p.y + 1.) * .5;                   // 0 bottom .. 1 top
    // shade shimmer (v17): a small pal-phase wave travels outward through
    // the rings (-ring*.55), clocked by the bee clock (1.7017 = 2pi*26/96,
    // seamless at the wrap), staggered per cell (h*2). Crown swing biased
    // negative (toward magenta); the positive direction runs to orange.
    float coreW = smoothstep(3.5, .5, ring);
    // outward phase saturates at .52 (v20): past it the palette runs into
    // yellow at rings 10-14. Per-cell jitter is added after the cap.
    float tBase = min(ring*.06 + centS*.45, .52) + h*.06;
    float shW = sin((s4.z + s4.w)*1.7017 - ring*.55 + h*2.);
    float shim = (.05 + .04*coreW) * shW - .04*coreW;
    float tArg = tBase + shim;                         // cell palette phase
    vec3 cellCol = pal(tArg);
    cellCol *= cellCol;                                // sRGB-picked -> linear

    // honey: rises bottom-up across the whole comb (per-cell offset)
    float surf = fill + (h - .5)*.06;
    float honeyIn = step(lvlLine, surf);

    // every cell-interior term carries `inner`; wall pixels skip the block
    if (inner > 0.){
        // concentric low end (v30): the beat flutters the seven core cells
        // (per-cell phase), the bass swell lifts rings 2-5
        float crown7 = smoothstep(1.5, .5, ring);
        float diskW  = smoothstep(1.5, 2.5, ring) * smoothstep(5.5, 4., ring);
        // idle floor breathes with the shimmer wave, so the comb stays
        // alive in silence; the crown holds a brighter idle glow
        float lift = g * (.22 + .80*press) + wave*.40
                   + (.050 + .040*coreW) * (1. + .55*shW)
                   + crown7 * kick * .22 * sin(iTime*70. + h*40.)
                   + diskW * .20 * bass;
        // backlit cell: bright center, dark toward the wall
        col += cellCol * inner * (.30 + 1.10*dome) * lift * 1.7;

        // empty cells: a whisper of sky through the dry comb
        col += vec3(.008, .016, .040) * inner * (1. - honeyIn)
               * smoothstep(.0, .4, lvlLine);
        // multifloral nectar: the cell's unshimmed phase mapped into the
        // amber gamut (no shim: the gamut is not modulated)
        vec3 honeyBase = honeyGold(tBase) * (.75 + .45*h);
        // comb center stays rich warm gold (v29)
        honeyBase = mix(honeyBase, vec3(.80, .30, .022) * (.80 + .40*h),
                        coreW * .65);
        // depth: old honey at the bottom is dark amber, fresh honey under
        // the surface glows; 0 at the surface, 1 at ~.6 screen below it
        float depth = clamp((surf - lvlLine) * 1.6, 0., 1.);
        // the honey mass breathes with the bass swell (v21)
        float glow = .40 + .55*g + .25*wave + .45*bass;
        vec3 honey = honeyBase * glow * mix(1., .42, depth)
                   * (.22 + 1.25*dome);
        // fresh honey under the surface glows
        honey += honeyBase * glow * .50 * exp(-depth * 6.) * dome;
        // refraction ring inside the wall and a gloss spot (upper left)
        honey += honeyBase * glow * .30 * exp(-abs(hd - .72) * 34.);
        vec2 sl = l - vec2(-.25, .30);
        float gloss = exp(-dot(sl, sl) * 30.);
        honey += vec3(1., .78, .45) * gloss * (.05 + .14*bass) * (1. - .5*depth);
        // capped cells: matured honey under a dark wax cap, decided per CELL
        // (center depth) so a cap never splits along the scan line; the
        // share grows with depth (none near the surface, ~45% at the bottom)
        float cDepth = clamp((surf - (cen.y + 1.)*.5) * 1.6, 0., 1.);
        float h2 = hash12(id + 31.7);
        float cap = step(h2, cDepth*.60 - .15);
        vec2 cl = l - vec2(-.22, .26);
        vec3 capCol = vec3(.20, .085, .012) * (.80 + .40*h2)
                    * (.35 + .80*dome) * (.75 + .45*glow)
                    + vec3(.55, .36, .14) * exp(-dot(cl, cl) * 16.) * .22;
        honey = mix(honey, capCol, cap);
        col = mix(col, honey, honeyIn * inner);
        // meniscus: bright line tinted by the nectar, rides the bass
        col += mix(vec3(1., .55, .12), honeyBase, .40) * inner *
               exp(-abs(lvlLine - surf) * 130.)
               * (.22 + .75*bass) * step(.02, fill);
    }

    // CRACK: golden flash + exact-voronoi fissure network + honey vapors
    if (crackT < .999){
        float seed = s4.y * 17.31;
        float low = smoothstep(1., .2, lvlLine);       // honey region weight
        col += vec3(1., .55, .08) * inner * crackE * .30 * low;

        // fissures: exact border distance (T14), sites seeded per crack
        vec2 vp = p * 2.6;
        vec2 vn = floor(vp), vf = vp - vn;
        vec2 mg, mr; float f1 = 8.;
        for (int j = -1; j <= 1; j++)
        for (int i = -1; i <= 1; i++){
            vec2 g = vec2(float(i), float(j));
            vec2 o = vec2(hash12(vn + g + seed), hash12(vn + g + seed + 41.7));
            vec2 r = g + o - vf;
            float d2 = dot(r, r);
            if (d2 < f1){ f1 = d2; mr = r; mg = g; }
        }
        float bd = 8.;
        for (int j = -2; j <= 2; j++)
        for (int i = -2; i <= 2; i++){
            vec2 g = mg + vec2(float(i), float(j));
            vec2 o = vec2(hash12(vn + g + seed), hash12(vn + g + seed + 41.7));
            vec2 r = g + o - vf;
            if (dot(mr - r, mr - r) > 1e-5)
                bd = min(bd, dot(.5*(mr + r), normalize(r - mr)));
        }
        col += vec3(1., .40, .03) * exp(-bd * 26.) * exp(-crackT * 2.5) * low;

        // honey vapors: four puffs rise from the old surface and thin out
        for (int i = 0; i < 4; i++){
            float hp = hash12(vec2(float(i) * 9.1, seed));
            vec2 vc = vec2(-1.5 + 3.0*hp,
                           (fill + .55) - 1. + crackT*(.45 + .35*hp));
            float vr = .16 + .30*crackT;
            float r2v = dot(p - vc, p - vc) / (vr*vr);
            if (r2v < 1.){
                float prof = (1. - r2v); prof *= prof;   // (1-r^2)^2 density
                col += vec3(.90, .52, .14) * prof * (1. - crackT) * .25;
            }
        }
    }

    // bees: 54 workers from the buffer's BEE TABLE (columns 6..59: pos,
    // heading, fade) — one cached texel read, a distance cull, then a drop
    // shadow, flapping wings and a striped body. The shadow keeps a gold
    // bee legible over gold honey.
    for (int k = 0; k < 54; k++){
        vec4 B = texture(iChannel1, vec2((float(k) + 6.5)/COLS, .5));
        vec2 d = p - B.xy;
        if (dot(d,d) < .0036){                         // skip far pixels
            vec2 dirB = vec2(cos(B.z), sin(B.z));      // stored heading
            vec2 nB = vec2(-dirB.y, dirB.x);
            float lu = dot(d, dirB), lv = dot(d, nB);
            vec2 ds = d - vec2(.008, -.012);
            col *= 1. - .60 * B.w * exp(-dot(ds, ds) * 1500.);
            float flap = .55 + .45*sin(iTime*95. + float(k)*1.7);
            vec2 wv = vec2(lu + .004, abs(lv) - .0100*flap);
            float wing = exp(-(wv.x*wv.x/5.5e-5 + wv.y*wv.y/2.2e-5));
            col = mix(col, vec3(.55, .60, .66), wing * .40 * B.w);
            float body = exp(-(lu*lu/2.2e-4 + lv*lv/6.5e-5));
            float stripes = .06 + .94*smoothstep(-.3, .3, sin(lu*500.));
            vec3 beeCol = vec3(.95, .52, .05) * stripes;
            col = mix(col, beeCol, min(body*1.6, 1.) * B.w);
            // warm halo, treble-lifted
            col += vec3(1., .62, .18) * exp(-dot(d,d)*900.)
                   * .08 * B.w * (.6 + .6*treF);
        }
    }

    // wax walls: amber tinted by the owning cell (two-tone at boundaries),
    // bevelled: the inner face whose normal (-l) points up-left catches
    // the light. Treble sparkle is gated per wall segment (edge index from
    // the local angle).
    float eI = floor(mod(atan(l.y, l.x)*.9549297 + .5, 6.)); // /60deg
    // saturation (v27-v28): loud music shrinks the eligible share of wall
    // segments (.62 -> ~.77), the set reshuffles 10x per flash unit, and
    // glints prefer quiet cells (x 1-.7g).
    // v32: the glints form a halo born at the core that travels outward
    // as the flash fades
    float haloR = (1. - treF) * 9.;
    float haloW = exp(-abs(ring - haloR) * .55);
    float spark = step(.62 + .15*press, hash12(id + eI*vec2(3.7, 9.1)
                                   + floor(vec2(0., 10.*treF))))
                * treF * haloW * (1. - .70*g);
    vec3 waxCol = mix(vec3(.55, .26, .045), cellCol, .25 - .25*honeyIn);
    float bev = .45 + .55*dot(-normalize(l + 1e-5), vec2(-.6, .8));
    col += waxCol * border * (.05 + .20*press) * max(bev, .15);
    // glint replaces the wall colour (additive saturates in tanh on bright
    // cells), tone picked from the wall brightness (v26): dark honey on a
    // bright wall, light gold on a dark one
    float wl = dot(col, vec3(.33, .5, .17));
    vec3 glintCol = mix(vec3(1., .66, .16), vec3(.34, .14, .012),
                        smoothstep(.10, .40, wl));
    col = mix(col, glintCol, min(border * spark, 1.) * .55);

    // edge smoke (v31 fog of war): a band ~1.5 cells deep at the top and
    // bottom and ~3.5 cells at the sides, thickening with the bass swell,
    // billowing on the bee clock. Dark smoke, not v31's light veil
    // (.70,.63,.50), which greys every edge cell.
    {
        float asp = iResolution.x / iResolution.y;
        float fogM = max(smoothstep(.25, 0., 1. - abs(p.y)),
                         smoothstep(.67, 0., asp - abs(p.x)));
        float bil = .80 + .20*sin(p.x*6.3 + (s4.z + s4.w)*.9)
                        * sin(p.y*8.1 - (s4.z + s4.w)*.6);
        // gated by presence (v31b): the swell parks at .5 in silence
        float fogD = (.10 + .50*bass) * smoothstep(.02, .10, press);
        vec3 smoke = vec3(.014, .008, .003) * (.6 + .8*bil);
        col = mix(col, smoke, min(fogM * bil * fogD, .70));
    }

    // vignette (clamped: 21:9 and wider would go negative) + tone
    col *= max(1. - .20 * dot(p, p), .05);
    col = tanh(col);
    col = pow(col, vec3(1./2.2));
    col += (ign(fragCoord) - .5) / 255.;
    fragColor = vec4(col, 1.);
}
