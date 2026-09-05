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
//   bees              <- 27 striped workers read from the BUFFER BEE TABLE
//                        (columns 6..32: pos, heading, fade) — positions are
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
// honey gamut (v19): a RAMP between two golds — dark amber and pale gold.
// The earlier cosine palette left the family at phase extremes (red-brown,
// greenish-gold, user-visible); a two-point ramp cannot leave it, ever.
vec3 honeyGold(float t){
    // k is FLOORED at .18 and the dark endpoint is lifted (v21): the outer
    // rings' saturated phase parked the cos at the dark end, turning the
    // upper half of a full comb into flat mud-brown — the darkest legal
    // honey must still read as amber
    float k = .18 + .82*(.5 + .5*cos(6.2831*t));
    return mix(vec3(.60,.38,.11), vec3(.95,.70,.26), k);
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
    float hd = hexD(l);
    // pixel-scaled edges (v14): the old constant-width smoothsteps spanned
    // ~13-16 px on screen and read as an upscaled low-res image. The cell
    // RIM now resolves in ~3 px (analytic footprint — dFdx kills the whole
    // program in this engine), while wax bevel and interior dome keep their
    // soft shading. aa = one screen pixel expressed in hd units.
    float aa = 2. / (R * iResolution.y);
    float rim = smoothstep(.80 - 1.5*aa, .80 + 1.5*aa, hd);
    float inner  = (1. - rim) * (1. - .30*smoothstep(.40, .80, hd));
    float border = smoothstep(.72, .866, hd);

    vec3 col = vec3(.045, .028, .012);                 // dark wax background
    float lvlLine = (p.y + 1.) * .5;                   // 0 bottom .. 1 top
    // shade shimmer (v17): the ORIGINAL identity stays — rose crown, amber
    // honey (v16's explicit rose/blue ramp read as a green/yellow core with
    // pink honey and was reverted by the user). The life comes from a hue
    // WAVE instead: a small pal-phase modulation (±.09, ±.16 at the crown)
    // TRAVELS OUTWARD through the rings (-ring*.55 = propagation), clocked
    // by the bee clock (music pace; 1.7017 = 2pi*26/96, seamless at the
    // wrap), staggered per cell (h*2) — every cell flickers within its own
    // shade family and the flicker ripples across the whole comb. honeyPal
    // inherits tArg, so the honey shimmers within the AMBER gamut for free.
    float coreW = smoothstep(3.5, .5, ring);
    // outward phase SATURATES at .52 (v20): unbounded ring*.06 (+ a high
    // centroid) ran the palette past green into YELLOW at rings 10-14 —
    // screen corners read "honeyed" above the honey line. Capping the
    // ring+centroid sum ends the outward gradient on green/teal for any
    // music; the per-cell jitter is added AFTER the cap so the corners
    // stay multifloral instead of collapsing to one uniform tone
    float tBase = min(ring*.06 + centS*.45, .52) + h*.06; // unshimmed phase —
    // the honey keeps THIS one (v18): honeyPal was tuned for it, and the
    // wave pushed the honey out of the amber gamut into green; the field
    // wave is also halved (.05) so dry greens stay green — the crown keeps
    // the stronger swing (.14) where the life belongs
    // crown swing is biased NEGATIVE (toward magenta): the positive palette
    // direction runs rose->orange->yellow (probed), and the user ruled out
    // an orange center; kick/treble phase flicks removed for the same reason
    float shim = (.05 + .04*coreW)
               * sin((s4.z + s4.w)*1.7017 - ring*.55 + h*2.)
               - .04*coreW;
    float tArg = tBase + shim;                         // cell palette phase
    vec3 cellCol = pal(tArg);                          // walls borrow it too

    // every cell-interior term below carries a factor of `inner`, so wax
    // border pixels (inner == 0, spatially coherent bands) skip it exactly
    if (inner > 0.){
        // cell glow: ring+centroid palette, pressure gain, ripple boost
        // concentric low-end choreography (v30): the BEAT shakes the seven
        // core cells (fast brightness flutter, per-cell phase so they don't
        // tremble in lockstep, alive only while the kick envelope rings),
        // and the BASS swell lifts the ring around them (rings 2-5) — the
        // dry-disk extension of the honey's bass breath
        float crown7 = smoothstep(1.5, .5, ring);
        float diskW  = smoothstep(1.5, 2.5, ring) * smoothstep(5.5, 4., ring);
        col += cellCol * inner * (g * (.22 + .80*press) + wave*.40 + .008
                   + crown7 * kick * .22 * sin(iTime*70. + h*40.)
                   + diskW * .20 * bass);

        // honey: rises bottom-up across the whole comb (per-cell hash offset).
        // MULTIFLORAL: each cell's nectar keeps the hue of its flower (the
        // same palette the dry comb shows — rose/green/blue), anchored to
        // amber so it still reads as honey; per-cell maturity varies depth
        float honeyIn = step(lvlLine, fill + (h - .5)*.06);
        // empty cells: a whisper of SKY shows through the dry comb
        col += vec3(.05, .09, .17) * inner * .55 * (1. - honeyIn)
               * smoothstep(.0, .4, lvlLine);
        // nectar shade = the cell's palette phase mapped into the honey gamut
        vec3 honeyBase = honeyGold(tBase) * (.75 + .45*h); // always gold —
        // no shim: the amber gamut is not to be modulated
        // the COMB CENTER is always RICH WARM GOLD (v29): the ramp's pale
        // end happens to land at the central phases, which drained the
        // warm golden heart the old palette had there ("znikł złocisto
        // miodowy w środku") — coreW pulls it back, ramp variety survives
        // outward
        honeyBase = mix(honeyBase, vec3(.88, .52, .10) * (.80 + .40*h),
                        coreW * .65);
        // (per-cell maturity)
        // the whole honey mass BREATHES with the bass envelope (v21) — the
        // per-cell bass pulse was invisible under the .85 honey mix, so the
        // bass gets its own explicit axis here
        vec3 honey = honeyBase * (.14 + .45*g + .25*wave + .30*bass);
        col = mix(col, honey * inner + col * .25, honeyIn * inner * .85);
        // meniscus: bright line, tinted by the local nectar
        col += mix(vec3(1., .75, .25), honeyBase, .45) * inner *
               exp(-abs(lvlLine - (fill + (h - .5)*.06)) * 130.)
               * (.18 + .60*bass) * step(.02, fill);   // meniscus rides bass
    }

    // CRACK: golden flash + exact-voronoi fissure network + honey vapors
    if (crackT < .999){
        float seed = s4.y * 17.31;
        float low = smoothstep(1., .2, lvlLine);       // honey region weight
        col += vec3(1., .78, .28) * inner * crackE * .35 * low;

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
        col += vec3(1., .58, .12) * exp(-bd * 26.) * exp(-crackT * 2.5) * low;

        // honey vapors: four puffs rise from the old surface and thin out
        for (int i = 0; i < 4; i++){
            float hp = hash12(vec2(float(i) * 9.1, seed));
            vec2 vc = vec2(-1.5 + 3.0*hp,
                           (fill + .55) - 1. + crackT*(.45 + .35*hp));
            float vr = .16 + .30*crackT;
            float r2v = dot(p - vc, p - vc) / (vr*vr);
            if (r2v < 1.){
                float prof = (1. - r2v); prof *= prof;   // (1-r^2)^2 density
                col += vec3(.95, .78, .45) * prof * (1. - crackT) * .35;
            }
        }
    }

    // bees: 54 striped workers (v24) — FOURTEEN convoys (3 bees each;
    // convoy 0 = the queen's, always the pink core; the rest draw random
    // central flower homes; landings fanned along the honey line, routes
    // weave) + 12 lone scouts roaming the whole comb. All path/mission math lives in
    // the buffer's BEE TABLE now; here each bee is one (cached) texel read,
    // a distance cull, and a stripe gaussian.
    for (int k = 0; k < 54; k++){
        vec4 B = texture(iChannel1, vec2((float(k) + 6.5)/COLS, .5));
        vec2 d = p - B.xy;
        if (dot(d,d) < .002){                          // skip far pixels
            vec2 dirB = vec2(cos(B.z), sin(B.z));      // stored heading
            vec2 nB = vec2(-dirB.y, dirB.x);
            float lu = dot(d, dirB), lv = dot(d, nB);
            // striped body: yellow ellipse, dark bands across the axis
            float body = exp(-(lu*lu/1.1e-4 + lv*lv/3.5e-5));
            float stripes = .18 + .82*smoothstep(-.25,.25, sin(lu*700.));
            vec3 beeCol = vec3(1., .80, .22) * stripes;
            col = mix(col, beeCol, min(body*1.5, 1.)*B.w);
            // soft warm halo, treble-lifted
            col += vec3(1.,.85,.35) * exp(-dot(d,d)*800.)
                   * .16 * B.w * (.6 + .6*treF);
        }
    }

    // wax borders: warm amber TINTED by the owning cell (walls two-tone at
    // cell boundaries — restores the color variation the crisp v14 rim took
    // away), treble sparkle gated PER WALL SEGMENT (edge index from the
    // local angle), not per cell — glints run along individual walls
    float eI = floor(mod(atan(l.y, l.x)*.9549297 + .5, 6.)); // /60deg
    // second half of the v27 saturation: loud music also shrinks the SHARE
    // of wall segments eligible per flash (.62 calm -> ~.77 at full press).
    // v28: the segment set reshuffles 10x per flash unit, not 60x — the
    // fast reshuffle strobed the whole lattice ("explosion"); and glints
    // PREFER quiet cells (x 1-.7g): the tremble lives where the colors are
    // changing weakly, active cells stay clean
    // v32: the glints form a TRAVELING HALO — the flash is born at the
    // core (treF=1 -> radius 0) and the ring of sparkle moves OUTWARD as
    // the flash fades, so glints never cover the whole screen at once,
    // they wash across it ("błyskające halo")
    float haloR = (1. - treF) * 9.;
    float haloW = exp(-abs(ring - haloR) * .55);
    float spark = step(.62 + .15*press, hash12(id + eI*vec2(3.7, 9.1)
                                   + floor(vec2(0., 10.*treF))))
                * treF * haloW * (1. - .70*g);
    vec3 waxCol = mix(vec3(.85, .55, .18), cellCol, .25);
    col += waxCol * border * (.05 + .16*press);
    // glint REPLACES the wall color (additive died in tanh on bright cells)
    // and picks its tone from the wall's brightness (v26): dark honey on a
    // bright wall, light gold on a dark one — contrast on ANY background,
    // always inside the honey family
    float wl = dot(col, vec3(.33, .5, .17));
    vec3 glintCol = mix(vec3(1., .82, .38), vec3(.58, .38, .10),
                        smoothstep(.22, .58, wl));
    col = mix(col, glintCol, min(border * spark, 1.) * .50);

    // edge FOG OF WAR (v31, experimental): a mist band ~1.5 cells deep at
    // the top/bottom and ~3.5 cells at the sides, thickening with the BASS
    // swell — Ysin_Ring_Spectrum's mist idea on a rectangular rim. The
    // billow drifts on the bee clock; shallow by design (cap .70), every
    // effect underneath stays readable.
    {
        float asp = iResolution.x / iResolution.y;
        float fogM = max(smoothstep(.25, 0., 1. - abs(p.y)),
                         smoothstep(.67, 0., asp - abs(p.x)));
        float bil = .80 + .20*sin(p.x*6.3 + (s4.z + s4.w)*.9)
                        * sin(p.y*8.1 - (s4.z + s4.w)*.6);
        // gated by PRESENCE (v31b): the normalized swell parks at .5 in
        // silence (zero deviation = mid-scale), so without the press gate
        // the fog would hang there forever — silence = no fog, quiet music
        // = a faint veil, each bass swell thickens it
        float fogD = (.10 + .50*bass) * smoothstep(.02, .10, press);
        col = mix(col, vec3(.70, .63, .50), min(fogM * bil * fogD, .70));
    }

    // vignette + tone
    col *= 1. - .22 * dot(p, p);
    col = tanh(col);
    col = pow(col, vec3(1./2.2));
    col += (ign(fragCoord) - .5) / 255.;
    fragColor = vec4(col, 1.);
}
