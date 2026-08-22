// Hive_Spectrum buffer — 6-band state + hive dynamics + BEE TABLE (v24 layout).
// iChannel0 = audio, iChannel1 = self. 60 columns, read row y=.5:
//   c0: b0-b3 | c1: b4,b5,press,centroidSm | c2: kick,prevGate,treFlash,treSpread
//   c3: fillFine [0,1), ripplePhase, fillCoarse (64ths), MAGIC
//   honey fill = (fillCoarse + fillFine)/64 — SPLIT against the FP16 stall:
//   a single half-float fill froze at exactly .25 (ulp doubles there and the
//   quiet-music increment ~7e-5 drops below ulp/2 — user caught it live);
//   fine stays in [0,1) where increments are 64x the ulp
//   c4: crackT, crackSeed, beeCoarse, beeFine — bee clock in LAPS around a
//   cell perimeter, integrated from pressure (bees fly faster when the music
//   is loud); fine/coarse split (FP16), coarse wraps at 96 (multiple of the
//   4-unit epoch so re-homing stays seamless at the wrap)
//   c5: bassMean, bassSpread, bassSwell, trebleMean — the FFT is dB-mapped, so
//   the raw bass LEVEL barely moves on real music (Ysin lesson, measured
//   .81-.82 all track); the visible axis is the normalized DEVIATION from
//   the bass's own running mean (~3.5 s), swelling in .25 s, settling .6 s
//   54 bees: 14 convoys x 3 (convoy 0 = the queen's, pinned to the core)
//   + 12 scouts; measured cost ~0.04 W/bee
//   c6..c59: BEE TABLE (54 bees, v24) — one vec4 per bee: pos.xy, heading
//   angle, fade. Bee positions are per-FRAME constants, so they are computed
//   HERE once per bee instead of 27x per image pixel (the v12 image loop
//   evaluated 2 beePath + ~5 hashes per bee per pixel — the single biggest
//   cost in the demo).
// ROW-BAND EARLY-OUT: every consumer samples this buffer at y=.5 only, so
// all rows outside a ±4 px band around the center exit immediately — the
// engine substeps buffers ~240/s at full screen resolution, and this trims
// that fixed cost by ~three orders of magnitude.
// CRACK: when the comb fills (~1.0) the wax CRACKS — crackT replays a 2.2 s
// burst (shake, golden flash, per-cell fissures in the image pass) while the
// honey drains fast to .12; then the cycle rebuilds. Fill ~20 s of loud
// music = a slow dramaturgy loop with a climax.
// ripplePhase: hex-ring radius of the kick wave (resets to 0 on kick edge).
// License: GPL-3.0 (shaderlib original).

#define MAGIC 7.77
#define COLS 60.

float aTap(float x){
    return ( texture(iChannel0, vec2(x*.72, .25)).r
           + texture(iChannel0, vec2(x,     .25)).r
           + texture(iChannel0, vec2(x*1.38,.25)).r ) / 3.;
}
float hash12(vec2 p){
    vec3 q = fract(vec3(p.xyx) * .1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}
// bee mission path, v in [0,4): one lap around the flower cell (nectar),
// flight to the honey surface H (sinusoidal wiggle), a crawl along the
// meniscus, flight back, short rest (fade window). C0-continuous at joints.
vec2 beePath(float v, vec2 cen, float Rr, vec2 H){
    if (v < 1.){
        float ei = floor(v*6.), et = fract(v*6.);
        float a0 = (30. + 60.*ei)*.0174533, a1 = a0 + 1.0471976;
        return mix(cen + Rr*vec2(cos(a0), sin(a0)),
                   cen + Rr*vec2(cos(a1), sin(a1)), et);
    }
    vec2 P0 = cen + Rr*vec2(cos(.5236), sin(.5236));
    if (v < 2.){
        float t = smoothstep(0., 1., v - 1.);
        vec2 dir = H - P0;
        vec2 pn = normalize(vec2(-dir.y, dir.x) + 1e-6);
        return mix(P0, H, t) + pn*sin((v-1.)*18.)*.04*(1.-t)*(v-1.);
    }
    if (v < 2.5)
        return H + vec2((v-2.)*.25, .006*sin(v*40.));
    vec2 H2 = H + vec2(.125, 0.);
    if (v < 3.5){
        float t = smoothstep(0., 1., v - 2.5);
        vec2 dir = P0 - H2;
        vec2 pn = normalize(vec2(-dir.y, dir.x) + 1e-6);
        return mix(H2, P0, t) + pn*sin((v-2.5)*18.)*.03*(1.-t);
    }
    return P0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    // only the center rows are ever read back (all consumers sample y=.5)
    if (abs(fragCoord.y - .5*iResolution.y) > 4.){
        fragColor = vec4(0.); return; }

    vec4 s0 = texture(iChannel1, vec2( .5/COLS, .5));
    vec4 s1 = texture(iChannel1, vec2(1.5/COLS, .5));
    vec4 s2 = texture(iChannel1, vec2(2.5/COLS, .5));
    vec4 s3 = texture(iChannel1, vec2(3.5/COLS, .5));
    vec4 s4 = texture(iChannel1, vec2(4.5/COLS, .5));
    vec4 s5 = texture(iChannel1, vec2(5.5/COLS, .5));
    if (iFrame == 0 || abs(s3.w - MAGIC) > .01 || isnan(s3.x) ||
        s3.z < -.5 || s3.z > 65. || s3.x < -.01 || s3.x > 1.01){
        s0=vec4(0.); s1=vec4(0.); s2=vec4(0.); s3=vec4(0.,9.,0.,MAGIC);
        s4=vec4(1.,0.,0.,0.); s5=vec4(0.); }

    float dt = clamp(iTimeDelta, .0002, .1);
    float rel = exp(-dt/.35);

    float raw[6];
    raw[0]=aTap(.03); raw[1]=aTap(.10); raw[2]=aTap(.18);
    raw[3]=aTap(.30); raw[4]=aTap(.45); raw[5]=aTap(.65);
    float env[6];
    env[0]=max(raw[0], s0.x*rel); env[1]=max(raw[1], s0.y*rel);
    env[2]=max(raw[2], s0.z*rel); env[3]=max(raw[3], s0.w*rel);
    env[4]=max(raw[4], s1.x*rel); env[5]=max(raw[5], s1.y*rel);

    float press = (env[0]+env[1]+env[2]+env[3]+env[4]+env[5]) / 6.;
    float treRaw = (raw[4]+raw[5]) * .5;
    float wsum=0., csum=0.;
    for (int i=0;i<6;i++){ wsum+=env[i]; csum+=float(i)*env[i]; }
    float cent = (wsum > .01) ? csum/(5.*wsum) : .5;
    float centroidSm = mix(cent, s1.w, exp(-dt/.9));

    // bass SWELL: normalized deviation from the bass's own running mean —
    // the dB-mapped FFT level itself barely moves on real music, so a
    // level-driven term is a CONSTANT, not a pulse (that bug shipped in
    // v21 and the user asked where the bass reaction went). Mean/spread
    // track at ~3.5 s and are seeded on the first frame.
    float k4 = clamp(dt/3.5, 0., 1.);
    bool seedB = (s5.x + s5.y) < 1e-4;
    float bMean = seedB ? env[0] : mix(s5.x, env[0], k4);
    float bSpr  = seedB ? .05    : mix(s5.y, abs(env[0] - bMean), k4);
    float bDrv  = clamp(.5 + .5*(env[0] - bMean)/max(2.*bSpr, .02), 0., 1.);
    float bassS = mix(s5.z, bDrv,
                      clamp(dt / ((bDrv > s5.z) ? .25 : .60), 0., 1.));
    // treble ACCENT trigger (v26): fixed step(.60, level) never fired on
    // mellow dB-mapped material — flash on crossing the treble's own ~4 s
    // running mean. v27 SATURATION: the margin is the treble's own SPREAD
    // (~2.2 sigma), so the flash rate is a roughly constant top-few-percent
    // of accents on ANY material — energetic music no longer fires nonstop
    float tMean = (s5.w < 1e-4) ? treRaw : mix(s5.w, treRaw, clamp(dt/4., 0., 1.));
    float tSpr  = (s2.w < 1e-4) ? .03
                : mix(s2.w, abs(treRaw - tMean), clamp(dt/4., 0., 1.));

    float gate = step(.62, raw[0]);
    float edge = gate * step(s2.y, .5);
    float kick = max(s2.x * exp(-dt/.18), edge);
    float treFlash = max(s2.z * exp(-dt/.12),
                         step(tMean + max(2.2*tSpr, .05), treRaw));

    // kick wave: hex-ring radius, expands ~7 rings/s, parks beyond the comb
    float ripple = min(s3.y + 7. * dt, 9.);
    if (edge > .5) ripple = 0.;

    // honey: rises while the music is loud, drains in silence;
    // at ~full the comb CRACKS and dumps most of the honey
    float crackT = min(s4.x + dt / 2.2, 1.);
    float fFine = s3.x, fCoarse = s3.z;                // fill*64 = fC + fF
    if (crackT < 1.){
        // burst drain: big steps, safe to do on the combined value
        float total = max(fCoarse + fFine - .55*64.*dt, .12*64.);
        fCoarse = floor(total); fFine = total - fCoarse;
    } else {
        // sqrt growth (v11) in 64ths — increments now ~64x the FP16 ulp
        float grow  = (press > .03) ? .055 * sqrt(press) * 64. : 0.;
        float drain = (press < .03) ? .015 * 64. : 0.;
        fFine += (grow - drain) * dt;
        if (fFine >= 1.){ fFine -= 1.; fCoarse = min(fCoarse + 1., 64.); }
        if (fFine < 0.){
            if (fCoarse > 0.){ fFine += 1.; fCoarse -= 1.; } else fFine = 0.; }
    }
    float fill = (fCoarse + fFine) / 64.;
    float seed = s4.y;
    // bee clock: laps per second ride the pressure (v22: +60% — the honey
    // outpaced the bees, "miód zasuwa a one leniwie latają")
    float bf = s4.w + (.16 + .80*press) * dt;
    float bc = s4.z;
    if (bf >= 1.){ bf -= 1.; bc = mod(bc + 1., 96.); }
    if (fill >= .98 && crackT >= 1.){
        crackT = 0.;                                   // CRACK!
        ripple = 0.;                                   // shockwave rides the ripple
        seed = mod(seed + 1., 64.);                    // new fissure network
    }

    int k = int(fragCoord.x / (iResolution.x/COLS));
    vec4 outv = vec4(0.);
    if (k == 0) outv = vec4(env[0], env[1], env[2], env[3]);
    if (k == 1) outv = vec4(env[4], env[5], press, centroidSm);
    if (k == 2) outv = vec4(kick, gate, treFlash, tSpr);
    if (k == 3) outv = vec4(fFine, ripple, fCoarse, MAGIC);
    if (k == 4) outv = vec4(crackT, seed, bc, bf);
    if (k == 5) outv = vec4(bMean, bSpr, bassS, tMean);

    // ---- bee table: columns 6..32 each own ONE bee (v12 image-loop math
    // verbatim — 27 striped workers: 7 convoys of 3 homed on the pink core
    // with fanned honey landings, + 6 lone scouts over the whole comb) ----
    if (k >= 6 && k < 60){
        int b = k - 6;
        float R = .11;                                 // hex circumradius
        float beeU = bc + bf;                          // global mission clock
        bool scout = (b >= 42);
        int conv = b / 3;                              // 0..6 = convoy id
        float hk = hash12(vec2(float(b)*7.7, 3.1));
        float u, sel;
        if (!scout){
            float spdC = .58 + .03*float(conv);        // per-convoy pace
            u = beeU*spdC - float(b - conv*3)*.24 + float(conv)*13.7;
            sel = float(conv) + .5;                    // route seed per convoy
        } else {
            u = beeU*(.55 + .50*hk) + hk*61.;
            sel = float(b) + .5;
        }
        float epoch = floor(u/4.);
        float v = u - epoch*4.;                        // 4-phase mission
        float hq = hash12(vec2(epoch, sel));
        float hr = hash12(vec2(epoch+13.7, sel));
        vec2 idB;
        if (!scout && conv == 0){
            // the QUEEN'S convoy (v23): convoy 0 always works the pink core
            int nb = int(hq*6.999);
            vec2 NB[7] = vec2[7](vec2(0.,0.), vec2(1.,0.), vec2(-1.,0.),
                                 vec2(0.,1.), vec2(0.,-1.),
                                 vec2(1.,-1.), vec2(-1.,1.));
            idB = NB[nb];
        } else if (!scout){
            // other convoys: a RANDOM flower cell in the central disk,
            // ring <= 4 (v22 — rose/mauve/lavender zone, stops before the
            // green band at ring ~5, so a green home is impossible).
            // All 3 bees of a convoy share the draw (sel = convoy id).
            float qh = floor(hq*9.) - 4.;
            float rmin = max(-4., -4. - qh), rmax = min(4., 4. - qh);
            idB = vec2(qh, rmin + floor(hr*(rmax - rmin + .999)));
        } else {                                       // scouts: whole comb
            idB = vec2(floor(hq*14.)-7., floor(hr*8.)-4.);
        }
        vec2 cenB = vec2(R*1.7320508*(idB.x + idB.y*.5), R*1.5*idB.y);
        // landing: convoys get a FAN of evenly spaced honey targets
        float hx = scout ? (hash12(vec2(epoch+7.1, sel))-.5)*2.8
                         : -1.45 + .225*float(conv)
                           + (hash12(vec2(epoch+7.1, sel))-.5)*.30;
        vec2 H = vec2(hx, fill*2. - 1. + .015);
        float fade = smoothstep(.0,.10,v)*smoothstep(4.,3.82,v);
        vec2 bp  = beePath(v, cenB, R, H);
        vec2 bp2 = beePath(min(v+.03, 3.99), cenB, R, H);
        bp += vec2(0., .005*kick*sin((u + hk)*60.));   // tiny kick hop
        vec2 dirB = bp2 - bp + vec2(1e-5, 0.);
        outv = vec4(bp, atan(dirB.y, dirB.x), fade);
    }
    fragColor = outv;
}
