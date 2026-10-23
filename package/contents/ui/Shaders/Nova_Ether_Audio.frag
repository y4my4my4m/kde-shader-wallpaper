// url: https://framagit.org/13FF/ether-audio
// credits: J-François Martin & Nova (audio & Nova editions), nimitz (Ether)
// @channels audio
// Nova Ether Audio — Shader réactif à l'audio pour Shader Wallpaper
// Audio-reactive "Ether" shader (Nova edition) for Shader Wallpaper for Plasma
//
// Base : "Ether" by nimitz (Shadertoy MsjSW3, 2014)
//   https://www.shadertoy.com/view/MsjSW3
//   License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported
//   (contact the author for other licensing options)
//
// Édition Nova — différences avec Ether_Audio :
// Nova edition — differences from Ether_Audio:
//   - rotation d'hue pilotée par le volume + les basses : la teinte
//     glisse avec la musique (les couleurs *vivent*, ne font pas que tourner)
//   - hue rotation driven by volume + bass: the hue glides with the music
//     (the colors *live*, they don't just spin)
//   - lumière du cœur adoucie + pulsation bornée plus bas : le cœur ne
//     « blanchit » plus, il change de couleur
//   - softened core light + lower-capped pulsation: the core stops blowing
//     out to white and shifts color instead
//   - au silence : dérive d'hue très lente (le champ respire doucement)
//   - when silent: a very slow hue drift (the field breathes gently)
//
// (le reste est identique à Ether_Audio : lecture iChannel0, genou doux)
// (the rest is identical to Ether_Audio: iChannel0 reading, soft knee)
//
// Le plugin expose l'audio système dans iChannel0 (texture 512x2) :
// The plugin exposes system audio in iChannel0 (512x2 texture) :
//   - ligne y=0.25 : spectre FFT (0..1, déjà lissé par le plugin)
//   - row y=0.25   : FFT spectrum (0..1, already smoothed by the plugin)
//   - ligne y=0.75 : forme d'onde normalisée
//   - row y=0.75   : normalized waveform

// Tweak-panel constants (added for Shader Wallpaper); the defaults reproduce
// the original edition.
const float SPEED        = 1.0;  // @range(0.1, 3.0, 0.05) @label("Speed")
const float SENSITIVITY  = 1.0;  // @range(0.0, 3.0, 0.05) @label("Audio sensitivity")
const float SWIRL        = 1.0;  // @range(0.0, 3.0, 0.05) @label("Bass swirl")
const float RIPPLE       = 1.0;  // @range(0.0, 3.0, 0.05) @label("Mid ripples")
const float SPARKLE      = 1.0;  // @range(0.0, 3.0, 0.05) @label("Treble sparkle")
const float HUE_DRIFT    = 0.06; // @range(0.0, 0.5, 0.01) @label("Colour drift")
const float HUE_REACTION = 1.0;  // @range(0.0, 3.0, 0.05) @label("Colour reaction")
const float PULSE        = 1.0;  // @range(0.0, 2.0, 0.05) @label("Brightness pulse")
const vec3  BASE_COLOR   = vec3(0.1, 0.3, 0.4); // @color @label("Base colour")

#define t (iTime*SPEED)

mat2 m(float a){float c=cos(a), s=sin(a);return mat2(c,-s,s,c);}

// Échantillonne le spectre (ligne 0.25) en une fréquence normalisée x (0..1)
// Samples the spectrum (row 0.25) at normalized frequency x (0..1)
float spec(float x){
    return texture(iChannel0, vec2(x, 0.25)).r;
}

// Genou doux (soft knee) : courbe la croissance d'un gain pour éviter la
// saturation. Linéaire sous le seuil (retour = x), puis la pente baisse
// progressivement et tend vers 0 au-dessus. C1 continu, jamais de cassure.
// Soft knee: bends a gain's growth to avoid blow-out. Linear below the
// threshold (returns x), then the slope smoothly decays toward 0 above it.
float softKnee(float x, float thr, float knee){
    float over = max(x - thr, 0.0);
    return x - over + knee*(1.0 - exp(-over/knee));
}

// Rotation d'hue : fait tourner la couleur autour de l'axe (1,1,1)
// (formule de Rodrigues). angle=0 → couleur inchangée.
// Hue rotation: rotates the color around the (1,1,1) axis (Rodrigues'
// formula). angle=0 -> color unchanged.
vec3 hueRotate(vec3 c, float a){
    const vec3 k = vec3(0.57735026919); // 1/sqrt(3)
    float cs = cos(a), sn = sin(a);
    return c*cs + cross(k, c)*sn + k*dot(k, c)*(1.0 - cs);
}

// Champ de distance — les paramètres audio pilotent rotation & respiration
// Distance field — audio params drive rotation & breathing
float map(vec3 p, float spin, float spin2, float bass, float mids, float vol){
    p.xz *= m(spin);
    p.xy *= m(spin2);
    vec3 q = p*2. + t;
    // le champ "respire" avec le volume, les basses gonflent le cœur
    // the field "breathes" with volume, bass inflates the core
    float breathe = 1. + vol*0.4 + bass*0.6;
    // amplitude des ondulations : médiums
    // wave amplitude: mids
    float amp = 0.5 + mids*0.35*RIPPLE;
    return length(p + vec3(sin(t*0.7))*breathe)*log(length(p)+1.)
         + sin(q.x + sin(q.z + sin(q.y)))*amp - 1.;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    // --- Analyse des bandes (alignées sur les bandes du plugin) ---
    // Band analysis (aligned with the plugin's own bands).
    // Spectre lissé 0..1, x = fréquence normalisée. Moyenne de quelques
    // texels par bande pour un lissage plus stable qu'un seul point.
    // Smoothed 0..1 spectrum, x = normalized frequency. Averages a few
    // texels per band for a steadier result than a single point.
    float bass   = (spec(0.004) + spec(0.010) + spec(0.018)) / 3.0; // bas du spectre (low end)
    float mids   = (spec(0.10)  + spec(0.20)  + spec(0.30))  / 3.0; // milieu du spectre (mid range)
    float treble = (spec(0.50)  + spec(0.70)  + spec(0.90))  / 3.0; // haut du spectre (high end)
    bass *= SENSITIVITY; mids *= SENSITIVITY; treble *= SENSITIVITY;
    float vol    = bass*0.6 + mids*0.3 + treble*0.1;

    // Phases de rotation : les basses accélèrent le tourbillon
    // (ajout de phase proportionnel au son, pas de saut de temps)
    // Rotation phases: bass speeds up the swirl
    // (phase added proportional to sound, no time jumps)
    float spin  = t*0.4 + bass*1.5*SWIRL;
    float spin2 = t*0.3 + bass*0.8*SWIRL;

    // Teinte qui glisse avec la musique : dérive lente + poussée du volume
    // et des basses. Au silence, hue ≈ dérive lente (le champ respire).
    // Hue that glides with the music: slow drift + a push from volume and
    // bass. When silent, hue ≈ slow drift (the field breathes).
    float hue = t*HUE_DRIFT + (vol*0.7 + bass*1.8)*HUE_REACTION;

    vec2 p = fragCoord.xy/iResolution.y - vec2(.9,.5);
    vec3 cl = vec3(0.);
    float d = 2.5;
    for(int i=0; i<=5; i++){
        vec3 pp = vec3(0,0,5.) + normalize(vec3(p, -1.))*d;
        float rz = map(pp, spin, spin2, bass, mids, vol);
        float f  = clamp((rz - map(pp+.1, spin, spin2, bass, mids, vol))*0.5, -.1, 1. );
        // Lumière : base d'origine adoucie (le cœur ne sature plus en
        // blanc) + lueur bleue sur les basses + étincelles violettes sur
        // les aigus, puis rotation d'hue pour faire vivre la teinte.
        // Light: softened original base (the core no longer blows out to
        // white) + blue glow on bass + violet sparkles on treble, then a
        // hue rotation to make the color live.
        vec3 l = BASE_COLOR
               + vec3(3.2, 1.8, 2.3)*f
               + vec3(0.15, 0.4, 0.8)*bass*1.6
               + vec3(0.3, 0.15, 0.55)*treble*2.2*SPARKLE;
        l = hueRotate(l, hue);
        cl = cl*l + smoothstep(2.5, .0, rz)*.7*l;
        d += min(rz, 1.);
    }
    // Pulsation finale adoucie : bornée plus bas que dans Ether_Audio
    // pour que les gros morceaux éclairent sans tout blanchir.
    // Softer final pulsation: capped lower than in Ether_Audio so loud
    // passages brighten without blowing everything to white.
    float pulse = (vol*0.42 + bass*0.18)*PULSE;
    cl *= 1.0 + softKnee(pulse, 0.40, 0.26);

    fragColor = vec4(cl, 1.);
}
