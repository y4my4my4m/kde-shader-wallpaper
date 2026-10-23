// url: https://framagit.org/13FF/nova-bougie-audio
// credits: J-François Martin & Nova
// @channels audio
//
// MIT License
//
// Copyright (c) 2026 J-François Martin & Nova
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Nova Candle — Une bougie dont la flamme danse avec la musique 🕯️
// A candle whose flame dances to your music — created for Shader Wallpaper
//
// Créée de toutes pièces pour Shader Wallpaper (v4+, PipeWire)
// Created from scratch for Shader Wallpaper (v4+, PipeWire)
//
// Le plugin expose l'audio système dans iChannel0 (texture 512x2) :
// The plugin exposes system audio in iChannel0 (512x2 texture) :
//   - ligne y=0.25 : spectre FFT (0..1, déjà lissé par le plugin)
//   - row y=0.25   : FFT spectrum (0..1, already smoothed by the plugin)
//
// Effets :
// Effects:
//   - basses  : la flamme s'étire et se penche (la danse)
//   - basses  : the flame stretches and leans (it dances)
//   - médiums : le tremblement de la flamme s'accélère
//   - mids    : the flame flicker speeds up
//   - aigus   : des étincelles montent de la flamme
//   - treble  : sparks rise from the flame
//   - volume  : le halo de lumière de la pièce respire avec le son
//   - volume  : the room's light halo breathes with the sound
//   - grosse basse : une phrase apparaît au-dessus de la flamme, puis se
//     dissout en petites particules. Les phrases s'alternent :
//   - big bass: a phrase appears above the flame, then dissolves into
//     little particles. The phrases rotate:
//       1. "JE T'AIME"
//       2. "JE PENSE À TOI !"
//       3. "JE PRIE POUR TOI !"
//   - étoiles : un ciel d'étoiles scintille en arrière-plan
//   - stars  : a starry sky twinkles in the background
//
// CENTRAGE (centering) — important :
// Le plugin peut rendre le FBO plus large que l'écran (parallaxe
// expérimentale / overscan). Le centre VISIBLE de l'écran n'est alors
// PAS iResolution.x/2. On le calcule : l'écran occupe une largeur
// écran = iResolution.x / (iResolution.x/iResolution.y / 16.0/9.0)...
// En pratique : visibleCenterX = iResolution.x * (16.0/9.0) / (2.0 * iResolution.x/iResolution.y)
// = iResolution.y * (16.0/9.0) / 2.0  — indépendant de l'overscan.
// Si pas d'overscan, visibleCenterX = iResolution.x/2 (idempotent).

#define t iTime

// Échantillonne le spectre (ligne 0.25) en une fréquence normalisée x (0..1)
// Samples the spectrum (row 0.25) at normalized frequency x (0..1)
float spec(float x){
    return texture(iChannel0, vec2(x, 0.25)).r;
}

// --- Bruit 1D (tremblement de flamme, fumée) ---
// 1D noise (flame flicker, smoke)
float hash(float n){ return fract(sin(n)*43758.5453123); }
float vnoise(float x){
    float i = floor(x), f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(hash(i), hash(i+1.0), f);
}
float fbm(float x){
    float v = 0.0, a = 0.5;
    for(int i=0;i<4;i++){ v += a*vnoise(x); x = x*2.17 + 13.7; a *= 0.5; }
    return v;
}

// --- Bruit 2D (dissolution du texte, étoiles) ---
// 2D noise (text dissolution, stars)
float hash2(vec2 n){ return fract(sin(dot(n, vec2(127.1, 311.7)))*43758.5453123); }
float noise2d(vec2 x){
    vec2 i = floor(x), f = fract(x);
    f = f*f*(3.0-2.0*f);
    float a = hash2(i), b = hash2(i+vec2(1.0,0.0));
    float c = hash2(i+vec2(0.0,1.0)), d = hash2(i+vec2(1.0,1.0));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}

// --- Distance à un segment (dessin des lettres en traits) ---
// Distance to a segment (to draw letters as strokes)
float sdSeg(vec2 p, vec2 a, vec2 b){
    vec2 pa = p-a, ba = b-a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa - ba*h);
}

// Une lettre dans une boîte unitaire (y vers le haut)
// A letter in a unit box (y up)
// id : 0=J 1=E 2=T 3=' 4=A 5=I 6=M 7=P 8=R 9=O 10=U 11=À 12=É 13=!
float letter(int id, vec2 p){
    if(id==0){ // J
        return min(sdSeg(p, vec2(0.55,1.0), vec2(0.55,0.30)),
                   min(sdSeg(p, vec2(0.55,0.30), vec2(0.35,0.05)),
                       sdSeg(p, vec2(0.35,0.05), vec2(0.10,0.15))));
    }
    if(id==1){ // E
        return min(sdSeg(p, vec2(0.2,1.0), vec2(0.2,0.0)),
                   min(sdSeg(p, vec2(0.2,1.0), vec2(0.8,1.0)),
                       min(sdSeg(p, vec2(0.2,0.5), vec2(0.7,0.5)),
                           sdSeg(p, vec2(0.2,0.0), vec2(0.8,0.0)))));
    }
    if(id==2){ // T
        return min(sdSeg(p, vec2(0.0,1.0), vec2(1.0,1.0)),
                   sdSeg(p, vec2(0.5,1.0), vec2(0.5,0.0)));
    }
    if(id==3){ // '
        return sdSeg(p, vec2(0.4,1.0), vec2(0.3,0.6));
    }
    if(id==4){ // A
        return min(sdSeg(p, vec2(0.0,0.0), vec2(0.5,1.0)),
                   min(sdSeg(p, vec2(0.5,1.0), vec2(1.0,0.0)),
                       sdSeg(p, vec2(0.2,0.35), vec2(0.8,0.35))));
    }
    if(id==5){ // I
        return min(sdSeg(p, vec2(0.5,1.0), vec2(0.5,0.0)),
                   min(sdSeg(p, vec2(0.25,1.0), vec2(0.75,1.0)),
                       sdSeg(p, vec2(0.25,0.0), vec2(0.75,0.0))));
    }
    if(id==6){ // M
        return min(sdSeg(p, vec2(0.0,0.0), vec2(0.0,1.0)),
                   min(sdSeg(p, vec2(0.0,1.0), vec2(0.5,0.35)),
                       min(sdSeg(p, vec2(0.5,0.35), vec2(1.0,1.0)),
                           sdSeg(p, vec2(1.0,1.0), vec2(1.0,0.0)))));
    }
    if(id==7){ // P
        return min(sdSeg(p, vec2(0.2,1.0), vec2(0.2,0.0)),
                   min(sdSeg(p, vec2(0.2,1.0), vec2(0.75,1.0)),
                       min(sdSeg(p, vec2(0.75,1.0), vec2(0.75,0.55)),
                           sdSeg(p, vec2(0.75,0.55), vec2(0.2,0.55)))));
    }
    if(id==8){ // R
        return min(sdSeg(p, vec2(0.2,1.0), vec2(0.2,0.0)),
                   min(sdSeg(p, vec2(0.2,1.0), vec2(0.75,1.0)),
                       min(sdSeg(p, vec2(0.75,1.0), vec2(0.75,0.55)),
                           min(sdSeg(p, vec2(0.75,0.55), vec2(0.2,0.55)),
                               sdSeg(p, vec2(0.5,0.55), vec2(0.85,0.0))))));
    }
    if(id==9){ // O
        return abs(length(p-vec2(0.5,0.5))-0.38);
    }
    if(id==10){ // U
        return min(sdSeg(p, vec2(0.2,1.0), vec2(0.2,0.4)),
                   min(sdSeg(p, vec2(0.8,1.0), vec2(0.8,0.4)),
                       min(sdSeg(p, vec2(0.2,0.4), vec2(0.3,0.0)),
                           min(sdSeg(p, vec2(0.3,0.0), vec2(0.7,0.0)),
                               sdSeg(p, vec2(0.7,0.0), vec2(0.8,0.4))))));
    }
    if(id==11){ // À (grave accent falls left to right; the original drew an acute)
        return min(min(sdSeg(p, vec2(0.0,0.0), vec2(0.5,1.0)),
                       min(sdSeg(p, vec2(0.5,1.0), vec2(1.0,0.0)),
                           sdSeg(p, vec2(0.2,0.35), vec2(0.8,0.35)))),
                   sdSeg(p, vec2(0.3,1.28), vec2(0.6,1.15)));
    }
    if(id==14){ // N
        return min(sdSeg(p, vec2(0.15,0.0), vec2(0.15,1.0)),
                   min(sdSeg(p, vec2(0.15,1.0), vec2(0.85,0.0)),
                       sdSeg(p, vec2(0.85,0.0), vec2(0.85,1.0))));
    }
    if(id==15){ // S (en zigzag)
        return min(sdSeg(p, vec2(0.8,1.0), vec2(0.2,1.0)),
                   min(sdSeg(p, vec2(0.2,1.0), vec2(0.2,0.55)),
                       min(sdSeg(p, vec2(0.2,0.55), vec2(0.8,0.55)),
                           min(sdSeg(p, vec2(0.8,0.55), vec2(0.8,0.0)),
                               sdSeg(p, vec2(0.8,0.0), vec2(0.2,0.0))))));
    }
    if(id==12){ // É
        return min(min(sdSeg(p, vec2(0.2,1.0), vec2(0.2,0.0)),
                       min(sdSeg(p, vec2(0.2,1.0), vec2(0.8,1.0)),
                           min(sdSeg(p, vec2(0.2,0.5), vec2(0.7,0.5)),
                               sdSeg(p, vec2(0.2,0.0), vec2(0.8,0.0))))),
                   sdSeg(p, vec2(0.4,1.15), vec2(0.7,1.28)));
    }
    // id==13 : !
    return min(sdSeg(p, vec2(0.5,1.0), vec2(0.5,0.3)),
               abs(length(p-vec2(0.5,0.1))-0.08));
}

// --- Phrases qui s'alternent sur les grosses basses ---
// Phrases that rotate on big bass hits
// Phrase 0 : "JE T'AIME"          (8 lettres,  largeur 9.7)
// Phrase 1 : "JE PENSE À TOI !"   (13 lettres, largeur 15.7)
// Phrase 2 : "JE PRIE POUR TOI !" (14 lettres, largeur 18.3)
float phraseLetter(int phrase, int idx, out float xoff){
    if(phrase==0){ // JE T'AIME
        int ids[8] = int[8](0,1,2,3,4,5,6,1);
        float xs[8] = float[8](0.0,1.3,2.9,4.1,4.8,6.1,7.4,8.7);
        if(idx<8){ xoff=xs[idx]; return float(ids[idx]); }
    } else if(phrase==1){ // JE PENSE À TOI !
        int ids[12] = int[12](0,1,7,1,14,15,1,11,2,9,5,13);
        float xs[12] = float[12](0.0,1.3,3.5,4.8,6.1,7.4,8.7,10.9,13.1,14.4,15.7,17.9);
        if(idx<12){ xoff=xs[idx]; return float(ids[idx]); }
    } else { // JE PRIE POUR TOI !
        int ids[14] = int[14](0,1,7,8,5,1,7,9,10,8,2,9,5,13);
        float xs[14] = float[14](0.0,1.3,3.5,4.8,6.1,7.4,9.6,10.9,12.2,13.5,15.7,17.0,18.3,20.5);
        if(idx<14){ xoff=xs[idx]; return float(ids[idx]); }
    }
    xoff = 1e3; return -1.0;
}
int phraseCount(int phrase){
    if(phrase==0) return 8;
    if(phrase==1) return 12;
    return 14;
}
float phraseWidth(int phrase){
    if(phrase==0) return 9.7;
    if(phrase==1) return 18.9;
    return 21.5;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    // --- Analyse des bandes ---
    // Band analysis
    float bass   = (spec(0.004) + spec(0.010) + spec(0.018)) / 3.0; // bas du spectre (low end)
    float mids   = (spec(0.10)  + spec(0.20)  + spec(0.30))  / 3.0; // milieu du spectre (mid range)
    float treble = (spec(0.50)  + spec(0.70)  + spec(0.90))  / 3.0; // haut du spectre (high end)
    // --- Plancher de silence ---
    // Le spectre du plugin est normalisé en dB : le bruit ambiant ne descend
    // jamais à 0. On coupe ce plancher puis on renormalise en 0..1 :
    // au silence, tout est à 0 ; la musique repart de 0.
    // (Si le texte apparaît encore au silence, monter FLOOR.)
    const float FLOOR = 0.60;
    bass   = clamp((bass   - FLOOR) / (1.0 - FLOOR), 0.0, 1.0);
    mids   = clamp((mids   - FLOOR) / (1.0 - FLOOR), 0.0, 1.0);
    treble = clamp((treble - FLOOR) / (1.0 - FLOOR), 0.0, 1.0);
    float vol    = bass*0.6 + mids*0.3 + treble*0.1;

    // --- CENTRAGE ROBUSTE ---
    // Robust centering: the visible screen center in FBO coordinates.
    // If the plugin overscans (FBO wider than the screen), iResolution.x/2
    // is NOT the visible center. We compute it from the aspect ratio:
    // screenWidthPx = iResolution.y * (16/9); center = screenWidthPx/2.
    // Without overscan this equals iResolution.x/2 (idempotent).
    // Deviation from the original: it treated any aspect wider than 16:9 as
    // parallax overscan and centred at iResolution.y*16/9/2, which put the
    // candle a quarter of the way across ultrawide screens. The engine's
    // parallax overscan is symmetric, so the visible centre is the FBO centre.
    vec2 screenCenter = iResolution.xy*0.5;
    // uv : origine au centre VISIBLE de l'écran, en unités de iResolution.y
    // (scène décalée vers le bas pour la composer)
    vec2 uv = (fragCoord - screenCenter) / iResolution.y + vec2(0.0, +0.14);

    // --- Géométrie (flamme au centre de l'écran) ---
    // Geometry (flame at screen center)
    float candleTop = -0.02;               // sommet de la bougie (juste sous la flamme)
    float candleBot = -0.46;               // base de la bougie
    float cw        =  0.09;               // demi-largeur de la bougie
    vec2  wickTop   = vec2(0.0, -0.002);   // base de la flamme (flamme remontée, au-dessus de la mèche)

    // La flamme : hauteur pilotée par les basses, tremblement par les médiums
    // The flame: height driven by bass, flicker by mids
    float H     = 0.16 + bass*0.09 + vol*0.04;
    float W     = 0.044 + bass*0.008;
    float flick = 0.85 + 0.30*fbm(t*(2.5 + mids*5.0));
    float sway  = (fbm(t*0.6 + 3.1) - 0.5)*0.03 + bass*0.02*sin(t*10.0);

    // --- Centre lumineux : il suit la flamme (le halo danse avec elle) ---
    // The light source follows the flame (the halo dances with it)
    vec2  lightPos = vec2(sway*0.7, wickTop.y + H*0.45);
    float gd = length(uv - lightPos);

    // --- Fond : la nuit ---
    // Background: the night
    vec3 col = vec3(0.012, 0.011, 0.020);
    // léger dégradé chaud autour de la bougie (la pièce est tiède) — doux et resserré
    // subtle warm gradient around the candle (the room is warm) — soft and tight
    col += vec3(0.016, 0.008, 0.004) * exp(-gd*gd*40.0);

    // --- Étoiles en arrière-plan (scintillement lent) ---
    // Stars in the background (slow twinkle)
    {
        vec2 sp = uv*12.0;
        vec2 cell = floor(sp);
        vec2 fp = fract(sp)-0.5;
        float h1 = hash2(cell);
        float star = step(0.90, h1);
        float tw = 0.45 + 0.55*sin(t*(0.5+1.6*hash2(cell+vec2(3.1,1.7))) + h1*40.0);
        vec2 off = (vec2(hash2(cell+vec2(7.0,2.0)), hash2(cell+vec2(5.0,9.0)))-0.5)*0.75;
        float d = length(fp - off);
        float s = star * tw * (1.0-smoothstep(0.02,0.06,d)) * 0.55;
        // moins d'étoiles près de la flamme (la lumière les masque)
        // fewer stars near the flame (the light hides them)
        s *= smoothstep(0.18, 0.55, length(uv - vec2(0.0,0.15)));
        col += vec3(0.85,0.88,1.0) * s;
    }

    // --- Le halo de lumière : la pièce respire avec le son (vif et présent) ---
    // The light halo: the room breathes with the sound (lively and present)
    float pulse = 0.60 + 0.80*fbm(t*(5.0 + vol*8.0));
    float glow = exp(-gd*gd*(16.0 + bass*8.0))
               * (0.08 + vol*0.8 + bass*0.9) * pulse;
    col += vec3(1.0, 0.5, 0.2) * glow * 0.35;
    // flash net sur les grosses basses (sharp flash on big bass)
    float flash = pow(bass, 3.0);
    col += vec3(1.0, 0.6, 0.3) * flash * 0.30 * exp(-gd*gd*8.0);

    // --- La flamme est dessinée APRÈS la bougie (voir plus bas) pour qu'elle
    //     paraisse devant le sommet de la cire, pas derrière. ---
    // The flame is drawn AFTER the candle body (below) so it appears in front
    // of the wax top, not behind it.

    // --- Le corps de la bougie ---
    // The candle body
    float bodyMask = smoothstep(cw, cw-0.01, abs(uv.x))
                   * smoothstep(candleTop, candleTop-0.015, uv.y)
                   * smoothstep(candleBot, candleBot+0.015, uv.y);
    vec2 tc = uv - vec2(0.0, candleTop);
    float topMask = smoothstep(1.0, 0.92, length(tc/vec2(cw, cw*0.30)));
    float wax = max(bodyMask, topMask);
    if (wax > 0.0) {
        float isTop = step(0.0, tc.y) * topMask;
        float shade = 1.0 - 0.45*smoothstep(0.0, cw, abs(uv.x))
                        - 0.25*smoothstep(candleTop, candleBot, uv.y);
        shade = max(shade, 0.95*isTop);
        vec3 waxc = vec3(0.88, 0.82, 0.68) * shade;
        // la flamme éclaire la cire (doux, pour éviter le blanc pur)
        // the flame lights the wax (soft, to avoid pure white)
        waxc += vec3(1.0, 0.55, 0.2) * glow * 0.35;
        col = mix(col, waxc, wax);
    }
    // --- La flamme (devant la bougie) ---
    // The flame (in front of the candle)
    vec2 f  = uv - wickTop;
    float hn = f.y/H;
    float xc = sway*(hn*hn + 0.3*hn);
    float r  = W * pow(max(1.0-hn, 0.0), 0.8) * flick;
    float dx = abs(f.x - xc);
    float body  = smoothstep(1.0, 0.85, hn) * smoothstep(-0.012, 0.02, f.y);
    float outer = smoothstep(r, r-0.05, dx) * body;
    float mid   = smoothstep(r*1.35, r*0.55, dx) * body;
    float core  = smoothstep(r*0.55, r*0.15, dx) * body * smoothstep(0.6, 0.25, hn);

    col += vec3(0.40, 0.07, 0.02) * outer;   // rouge profond (deep red)
    col += vec3(0.95, 0.38, 0.05) * mid;      // orange (orange)
    col += vec3(1.0, 0.85, 0.42) * core * 0.95; // cœur chaud (hot core)
    // base bleue au niveau de la mèche (blue base at the wick)
    float base = smoothstep(0.05, 0.0, length(f*vec2(1.0, 2.5)));
    col += vec3(0.2, 0.4, 1.0) * base * 0.7;

    // --- La mèche (the wick) — dessinée APRÈS la flamme : le bout charbonné
    //     reste visible dans la base brillante, comme sur une vraie bougie.
    //     Drawn AFTER the flame: the charred tip stays visible in the bright
    //     base, like a real candle.
    //     Épaisse et haute : elle remonte bien dans la base de la flamme.
    float wick = smoothstep(0.013, 0.0065, abs(uv.x))
               * smoothstep(wickTop.y+0.004, wickTop.y-0.002, uv.y)
               * smoothstep(candleTop, candleTop+0.002, uv.y);
    // bout plus foncé (charbon) vers le sommet de la mèche
    float wickChar = smoothstep(candleTop, wickTop.y+0.004, uv.y);
    col = mix(col, mix(vec3(0.10,0.07,0.045), vec3(0.045,0.03,0.02), wickChar), wick);

    // --- Phrases qui s'alternent sur une grosse basse ---
    // Phrases that rotate on a big bass hit
    // Le mot apparaît quand les basses sont fortes, se dissout en
    // petites particules quand le son retombe.
    // The word appears when the bass is strong, dissolves into little
    // particles when the sound falls.
    float presence = smoothstep(0.35, 0.6, bass);
    if (presence > 0.01) {
        // Quelle phrase ? On alterne toutes les ~1.5s (régulier, sans état).
        // Which phrase? Rotate every ~1.5s (even, stateless).
        int phrase = int(mod(floor(t/1.5), 3.0));

        const float wScale  = 0.034;   // taille d'une lettre (unités écran) — plus grande, plus lisible
        const vec2  wCenter = vec2(0.0, 0.42);  // au-dessus de la flamme, centré
        vec2 wp = (uv - wCenter)/wScale;
        wp.x += 0.5 * phraseWidth(phrase);  // centre le mot (xoff va de 0 à largeur)

        float wordMask = 0.0;
        float glowMask = 0.0;   // halo large autour des lettres (pas tout l'écran)
        int n = phraseCount(phrase);
        for(int i=0; i<14; i++){
            if(i >= n) break;
            float xoff;
            int id = int(phraseLetter(phrase, i, xoff));
            if(id < 0) continue;
            float d = letter(id, wp - vec2(xoff, 0.0));
            wordMask = max(wordMask, 1.0 - smoothstep(0.03, 0.09, d));
            glowMask = max(glowMask, 1.0 - smoothstep(0.05, 0.55, d));
        }
        // dissolution : un motif de bruit « mange » le mot quand il s'éteint
        // dissolution: a noise pattern "eats" the word as it fades out
        float n2 = noise2d(wp*0.8 + vec2(0.0, t*0.6));
        float dissolve = 1.0 - presence;
        float eaten = smoothstep(0.0, 1.0, n2 - (1.0 - dissolve*1.3));
        float word = wordMask * (1.0 - eaten) * presence;
        float wordGlow = glowMask * (1.0 - eaten) * presence * 0.30;
        col += vec3(1.0, 0.85, 0.55) * word * 1.1;
        col += vec3(1.0, 0.6, 0.3) * wordGlow;

        // petites particules : elles s'envolent pendant la dissolution
        // little particles: they fly away during the dissolution
        float burst = presence*(1.0-presence)*4.0;
        for(int i=0; i<20; i++){
            float fi = float(i);
            vec2 seed = vec2(hash(fi), hash(fi+10.0));
            float px0 = (seed.x*phraseWidth(phrase) - 0.5*phraseWidth(phrase))*wScale;
            float py0 = wCenter.y + (seed.y - 0.5)*wScale*1.5;
            float ang  = hash(fi+20.0)*6.2831;
            vec2 vel   = vec2(cos(ang), abs(sin(ang))*0.4 + 0.7);
            float life = fract(t*0.6 + hash(fi+30.0));
            vec2 pos   = vec2(px0, py0) + vel*life*0.35;
            float sz   = 0.004 + 0.005*hash(fi+40.0);
            float d    = length(uv - pos);
            float p    = (1.0 - smoothstep(0.0, sz, d)) * burst * (1.0-life);
            col += vec3(1.0, 0.8, 0.4) * p;
        }
    }

    // --- Étincelles (aigus) : des miettes de lumière qui s'envolent ---
    // Sparks (treble): motes of light that fly away
    for(int i=0; i<7; i++){
        float ph  = float(i)*0.61803 + hash(float(i))*3.0;
        float spd = 0.10 + 0.10*hash(float(i)+1.0);
        float life = fract(t*spd + ph);
        float sx = (hash(float(i)+2.0)-0.5)*0.14 + sin(t*1.7 + ph*7.0)*0.02*life;
        float sy = wickTop.y + 0.05 + life*0.35;
        float s = smoothstep(0.008, 0.002, length(uv - vec2(sx, sy)))
                * max(treble-0.1, 0.0)*2.0 * (1.0-life);
        col += vec3(1.0, 0.7, 0.25) * s * 1.5;
    }

    // --- Fil de fumée (plus visible quand la musique se calme) ---
    // Smoke wisp (more visible when the music calms down)
    float smokeY = uv.y - (wickTop.y + H);
    if (smokeY > 0.0) {
        float sm = fbm(uv.x*6.0 + smokeY*3.0 + t*0.35) - 0.5;
        float wisp = smoothstep(0.10, 0.0, abs(uv.x + sm*0.15*smokeY))
                   * smoothstep(0.5, 0.0, smokeY) * 0.05;
        col += vec3(0.5, 0.5, 0.55) * wisp * (0.6 + (1.0-vol)*0.4);
    }

    // --- Vignette douce ---
    // Soft vignette
    float vig = smoothstep(1.1, 0.3, length(uv*vec2(0.7, 1.0)));
    col *= 0.65 + 0.35*vig;

    fragColor = vec4(col, 1.);
}
