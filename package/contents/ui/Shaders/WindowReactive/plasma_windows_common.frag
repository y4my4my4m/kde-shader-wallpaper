// Plasma Windows — code shared by Buffer A and the image pass.
//
// Coordinates are pixels of the pass being rendered (Buffer A runs on a
// coarser grid; the engine scales iMouse / iWindowRects to it). Lengths that
// should look the same on every monitor are multiples of `unitPx()`, one
// thousandth of the pass height.

const float PI = 3.14159265;

float unitPx() { return iResolution.y / 1000.0; }

float hash11(float p)
{
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Signed 1D value noise in [-1, 1].
float snoise1(float x)
{
    float i = floor(x);
    float f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hash11(i), hash11(i + 1.0), u) * 2.0 - 1.0;
}

// Jagged lightning profile: high octaves keep their weight (H ~ 0.6) so the
// path stays crooked at every scale.
float jag(float x, float seed)
{
    float v = 0.0;
    float a = 0.55;
    float f = 1.0;
    for (int i = 0; i < 5; i++) {
        v += a * snoise1(x * f + seed * 17.13 + float(i) * 3.7);
        f *= 2.1;
        a *= 0.62;
    }
    return v;
}

float sdRoundBox(vec2 p, vec2 center, vec2 halfSize, float r)
{
    vec2 q = abs(p - center) - halfSize + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Closest point on a window rect (x, y, w, h) to `target`.
vec2 rectAnchor(vec4 r, vec2 target)
{
    return clamp(target, r.xy, r.xy + r.zw);
}

// Arc between a and b. Returns (core, glow) for pixel p.
// The path is re-rolled `rate` times per second; `seed` separates arcs.
vec2 arc(vec2 p, vec2 a, vec2 b, float seed, float rate, float widthPx)
{
    vec2 ab = b - a;
    float L = length(ab);
    if (L < 2.0) return vec2(0.0);
    vec2 dir = ab / L;
    vec2 nrm = vec2(-dir.y, dir.x);
    vec2 ap = p - a;
    float along = dot(ap, dir);
    float across = dot(ap, nrm);
    float amp = L * 0.16 + 8.0 * unitPx();

    // Bounding region of the path plus the halo; the halo is faded to zero
    // at its edge so the early-out leaves no visible box.
    float pad = widthPx * 75.0;
    float outside = max(max(-along, along - L), abs(across) - amp * 1.6);
    if (outside > pad) return vec2(0.0);
    float fade = smoothstep(pad, pad * 0.4, outside);

    float slot = floor(iTime * rate);
    float s = seed + slot * 1.618;
    float t = clamp(along / L, 0.0, 1.0);
    float taper = sin(PI * t);
    float off = jag(t * (2.0 + L / (180.0 * unitPx())), s) * amp * pow(taper, 0.7);
    float d = abs(across - off);
    if (along < 0.0 || along > L) d = min(length(p - a), length(p - b));

    // Strikes are not continuous: a slot can be dark or dim.
    float energy = hash11(s * 7.1 + 0.3);
    energy = energy < 0.18 ? 0.0 : 0.55 + 0.45 * energy;

    float core = exp(-d * d / (widthPx * widthPx));
    float glow = exp(-d / (widthPx * 6.0)) + 0.3 * exp(-d / (widthPx * 15.0));
    return vec2(core, glow * fade) * energy;
}

// Strongest arc field from the window set and the cursor at pixel p.
// Returns (core, glow, cursorContact).
vec3 arcField(vec2 p, float widthPx, float windowRange, float cursorRange)
{
    vec2 acc = vec2(0.0);
    float contact = 0.0;
    int n = min(iWindowCount, 16);

    // Window to window, nearest anchors, when the gap is small enough.
    for (int i = 0; i < n; i++) {
        vec4 ri = iWindowRects[i];
        if (ri.z < 2.0 || ri.w < 2.0) continue;
        for (int j = i + 1; j < n; j++) {
            vec4 rj = iWindowRects[j];
            if (rj.z < 2.0 || rj.w < 2.0) continue;
            vec2 ci = ri.xy + ri.zw * 0.5;
            vec2 cj = rj.xy + rj.zw * 0.5;
            vec2 ai = rectAnchor(ri, cj);
            vec2 aj = rectAnchor(rj, ai);
            ai = rectAnchor(ri, aj);
            float gap = distance(ai, aj);
            if (gap < 4.0 * unitPx() || gap > windowRange) continue;
            float k = smoothstep(windowRange, windowRange * 0.3, gap);
            float sd = float(i * 16 + j);
            acc += arc(p, ai, aj, sd, 13.0, widthPx) * k;
            acc += arc(p, ai, aj, sd + 0.5, 9.0, widthPx * 0.7) * k * 0.6;
        }
    }

    // Cursor: the nearest window edge reaches for it, plasma-globe style.
    vec2 m = iMouse.xy;
    bool cursorOn = m.x > 1.0 || m.y > 1.0;
    if (cursorOn && n > 0) {
        float best = 1e9;
        vec2 anchor = m;
        bool inside = false;
        for (int i = 0; i < n; i++) {
            vec4 r = iWindowRects[i];
            if (r.z < 2.0 || r.w < 2.0) continue;
            vec2 q = rectAnchor(r, m);
            float d = distance(q, m);
            if (d < 0.5) inside = true;
            if (d < best) { best = d; anchor = q; }
        }
        if (!inside && best < cursorRange) {
            float k = smoothstep(cursorRange, cursorRange * 0.35, best);
            acc += arc(p, anchor, m, 101.0, 16.0, widthPx) * k;
            acc += arc(p, anchor, m, 107.0, 11.0, widthPx * 0.6) * k * 0.6;
            acc += arc(p, anchor, m, 113.0, 7.0, widthPx * 0.5) * k * 0.4;
            contact = k;
        }
    }
    return vec3(acc, contact);
}
