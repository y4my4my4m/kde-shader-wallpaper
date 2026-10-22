// Overworld — Buffer A: changes to the world, fluids, mobs and events.
// @channels self
// @sim-max-height 64
//
// Layout and the world itself are in overworld_common.frag. Every texel
// derives its update from the previous step only (this pass reads its own
// last output), so the texels that react to one event agree on it: a creeper
// whose fuse reached FUSE_TIME last step blows up this step in the creeper's
// texel, in every block within the blast and in the event texel.
//
// Fluids follow the game's rules on its timing: every WATER_TICK a fluid cell
// is refilled from above (falling, level 8) or from a side neighbour that
// rests on something (level minus 1 for water, minus 2 for lava), else it
// drains. Water and lava touching turn to cobblestone; water reaching a lava
// source turns it to obsidian.

const float GRAVITY = 25.0;   // blocks / s^2
const float JUMP = 7.4;       // blocks / s, clears one block

vec4 mobA(int i) { return texelFetch(iChannel0, ivec2(i, MOB_ROW), 0); }
vec4 mobB(int i) { return texelFetch(iChannel0, ivec2(i, MOB_ROW + 1), 0); }

bool mobPresent(vec4 b) { return b.x > 0.5 && b.w <= 0.0; }

// Creeper that reached the end of its fuse last step; the blast centre.
bool findBlast(out vec2 centre)
{
    for (int i = 0; i < CREEPERS; i++) {
        vec4 b = mobB(i);
        if (mobPresent(b) && b.z >= FUSE_TIME) {
            centre = mobA(i).xy + vec2(0.0, 0.3);
            return true;
        }
    }
    centre = vec2(-100.0);
    return false;
}

// Mob under the cursor (block units), or -1.
int mobAtCursor()
{
    if (!cursorOnScreen() || insideWindow(iMouse.xy)) return -1;
    vec2 c = iMouse.xy / blockSize();
    for (int i = 0; i < NMOB; i++) {
        vec4 b = mobB(i);
        if (!mobPresent(b)) continue;
        vec4 a = mobA(i);
        vec2 sz = mobSize(mobKindOf(i, b));
        if (abs(c.x - a.x) < sz.x * 0.5 + 0.15 && c.y > a.y - 0.1 && c.y < a.y + sz.y + 0.15) return i;
    }
    return -1;
}

// Highest solid block in column c below any tree.
int topSolid(int c)
{
    for (int r = surfaceHeight(c); r > 0; r--) {
        if (isSolid(blockAt(c, r))) return r;
    }
    return 0;
}

bool solidAt(float x, float y)
{
    return isSolid(blockAt(int(floor(x)), int(floor(y))));
}

// Window tops act as platforms. Returns the platform height the mob at x
// lands on when moving from y0 down to y1, or -1.
float windowPlatform(float x, float y0, float y1)
{
    float bs = blockSize();
    float best = -1.0;
    for (int i = 0; i < iWindowCount && i < 16; i++) {
        vec4 r = iWindowRects[i];
        if (r.z < 1.0 || r.w < 1.0) continue;
        float top = (r.y + r.w) / bs;
        if (x >= r.x / bs && x <= (r.x + r.z) / bs && y0 >= top - 0.05 && y1 <= top) {
            best = max(best, top);
        }
    }
    return best;
}

bool standing(vec2 p, float halfW)
{
    if (solidAt(p.x - halfW * 0.8, p.y - 0.05) || solidAt(p.x + halfW * 0.8, p.y - 0.05)) return true;
    return windowPlatform(p.x, p.y + 0.01, p.y - 0.05) >= 0.0;
}

// ------------------------------------------------------------- fluids

// Level a cell would receive from its neighbours for fluid `kind`
// (0 water, 1 lava).
float flowLevel(int c, int r, int kind)
{
    ivec2 up = fluidAt(c, r + 1);
    if (up.x > 0 && up.y == kind) return 8.0;
    int decay = kind == 0 ? 1 : 2;
    int best = 0;
    for (int d = -1; d <= 1; d += 2) {
        ivec2 n = fluidAt(c + d, r);
        if (n.x <= 0 || n.y != kind) continue;
        ivec2 under = fluidAt(c + d, r - 1);
        bool rests = isSource(c + d, r) || isSolid(blockAt(c + d, r - 1))
                     || (under.x > 0 && under.y == kind);
        if (rests) best = max(best, n.x - decay);
    }
    return float(max(best, 0));
}

bool touches(int c, int r, int kind)
{
    ivec2 n0 = fluidAt(c - 1, r);
    ivec2 n1 = fluidAt(c + 1, r);
    ivec2 n2 = fluidAt(c, r + 1);
    ivec2 n3 = fluidAt(c, r - 1);
    return (n0.x > 0 && n0.y == kind) || (n1.x > 0 && n1.y == kind)
        || (n2.x > 0 && n2.y == kind) || (n3.x > 0 && n3.y == kind);
}

bool nearGrass(int c, int r)
{
    for (int dy = -1; dy <= 1; dy++) {
        if (blockAt(c - 1, r + dy) == GRASS || blockAt(c + 1, r + dy) == GRASS) return true;
    }
    return false;
}

// ------------------------------------------------------------- mobs

int passiveKind(float seed)
{
    return PIG + int(hash11(seed) * 2.999);
}

// Seconds until a mob that left (or died) comes back.
float awayTime(int kind, float seed)
{
    if (kind == CREEPER) return RETURN_TIME * (clockNight() ? 8.0 + 10.0 * hash11(seed) : 35.0 + 40.0 * hash11(seed));
    return RETURN_TIME * (10.0 + 25.0 * hash11(seed));
}

void updateMob(int i, out vec4 outA, out vec4 outB)
{
    int cols = columns();
    float dt = iTimeDelta;
    float t = iTime;
    vec4 a = mobA(i);
    vec4 b = mobB(i);

    if (b.x < 0.5) {
        int kind = i < CREEPERS ? CREEPER : passiveKind(float(i) * 5.7 + 1.3);
        float x = (float(i) + 0.5) / float(NMOB) * float(cols - 4) + 2.0;
        float y = float(max(surfaceHeight(int(x)), SEA) + 1);
        outA = vec4(x, y, 0.0, 0.0);
        outB = vec4(float(kind + 1), 1.0, 0.0, 0.0);
        return;
    }

    int kind = mobKindOf(i, b);
    vec2 sz = mobSize(kind);
    float halfW = sz.x * 0.5;
    vec2 pos = a.xy;
    vec2 vel = a.zw;
    float facing = b.y;
    float timer = b.z;
    float away = b.w;

    // Away: count down, then walk in from one side of the screen.
    if (away > 0.0) {
        away -= dt;
        if (away <= 0.0) {
            float seed = floor(t * 7.0) + float(i) * 13.0;
            bool fromLeft = hash11(seed) < 0.5;
            int col = fromLeft ? 0 : cols - 1;
            pos = vec2(fromLeft ? -0.45 : float(cols) + 0.45, float(max(topSolid(col), SEA) + 1));
            vel = vec2(0.0);
            facing = fromLeft ? 1.0 : -1.0;
            timer = 0.0;
            away = 0.0;
            if (i >= CREEPERS) kind = passiveKind(seed + 3.1);
        }
        outA = vec4(pos, vel);
        outB = vec4(float(kind + 1), facing, timer, away);
        return;
    }

    float seed = floor(t) + float(i) * 17.0;

    // Lava is fatal; walking off screen means leaving for a while.
    bool burnt = blockAt(int(floor(pos.x)), int(floor(pos.y + 0.2))) == LAVA;
    bool gone = pos.x < -0.55 || pos.x > float(cols) + 0.55;
    if (burnt || gone) {
        outA = vec4(pos, 0.0, 0.0);
        outB = vec4(float(kind + 1), facing, 0.0, awayTime(kind, seed));
        return;
    }

    // Blast: the creeper that blew up leaves, everything near is thrown.
    vec2 blast;
    if (findBlast(blast)) {
        if (kind == CREEPER && timer >= FUSE_TIME) {
            outA = vec4(pos, 0.0, 0.0);
            outB = vec4(float(kind + 1), facing, 0.0, awayTime(kind, seed));
            return;
        }
        vec2 d = pos + vec2(0.0, sz.y * 0.5) - blast;
        float dist = length(d);
        if (dist < 5.0) {
            vel += normalize(d + vec2(0.0, 0.5)) * 9.0 * (1.0 - dist / 5.0) + vec2(0.0, 3.0);
        }
    }

    bool grounded = standing(pos, halfW);
    float speed = kind == CHICKEN ? 1.3 : (kind == CREEPER ? 1.0 : 0.8);

    // Wander: a new idea every ~3 s.
    float slot = floor((t + float(i) * 2.3) / 3.0);
    float choice = hash11(slot * 7.1 + float(i) * 13.0);
    float walk = choice < 0.35 ? 0.0 : (choice < 0.67 ? -1.0 : 1.0);
    // Just arrived: walk on screen first.
    if (pos.x < 0.8) walk = 1.0;
    if (pos.x > float(cols) - 0.8) walk = -1.0;

    bool pressStart = iMouse.z > 0.0 && texelFetch(iChannel0, ivec2(2, EVENT_ROW), 0).x < 0.5;
    ivec2 cur = cursorCell();
    if (kind == CREEPER) {
        // Stalk the cursor when it is on bare desktop nearby; the fuse runs
        // while it is close.
        bool chasing = false;
        if (cur.x >= 0) {
            vec2 c = iMouse.xy / blockSize();
            float dx = c.x - pos.x;
            if (abs(dx) < 9.0 && abs(c.y - pos.y) < 7.0) {
                chasing = true;
                walk = abs(dx) > 0.5 ? sign(dx) : 0.0;
                speed = 1.7;
                float dist = length(c - (pos + vec2(0.0, 0.85)));
                timer = dist < 1.9 ? timer + dt : max(timer - 2.0 * dt, 0.0);
            }
        }
        if (!chasing) timer = max(timer - 2.0 * dt, 0.0);
        if (timer > 0.0) walk *= 0.4;
    } else {
        // Click an animal: hearts and happy hops for three seconds.
        if (pressStart && mobAtCursor() == i) timer = 3.0;
        if (timer > 0.0) {
            timer = max(timer - dt, 0.0);
            walk = 0.0;
            if (grounded && fract(t * 1.3 + float(i) * 0.37) < 0.1) vel.y = 4.5;
        }
    }

    if (walk != 0.0) facing = walk;

    // Swimming: float up, slow down.
    bool inWater = blockAt(int(floor(pos.x)), int(floor(pos.y + 0.3))) == WATER;
    if (inWater) {
        vel.y = mix(vel.y, 2.2, 1.0 - exp(-6.0 * dt));
        speed *= 0.6;
    } else {
        vel.y -= GRAVITY * dt;
    }

    // Horizontal: knockback decays, walking sets the pace on the ground.
    vel.x = mix(vel.x, walk * speed, 1.0 - exp(-(grounded ? 14.0 : 2.0) * dt));
    if (abs(vel.x) > 0.01) {
        float dir = sign(vel.x);
        float nx = pos.x + vel.x * dt;
        float frontX = nx + dir * halfW;
        bool blockedLow = solidAt(frontX, pos.y + 0.05);
        bool blockedHigh = sz.y > 1.0 && solidAt(frontX, pos.y + 1.05);
        bool stepFree = !solidAt(frontX, pos.y + 1.05) && !solidAt(frontX, pos.y + sz.y + 1.0);
        // Ledges over two blocks, water and lava are avoided unless chasing.
        bool dropAhead = grounded && kind != CREEPER
            && !solidAt(frontX, pos.y - 0.5) && !solidAt(frontX, pos.y - 1.5) && !solidAt(frontX, pos.y - 2.5)
            && windowPlatform(frontX, pos.y, pos.y - 2.5) < 0.0;
        int below = blockAt(int(floor(frontX)), int(floor(pos.y - 0.5)));
        int level = blockAt(int(floor(frontX)), int(floor(pos.y + 0.1)));
        bool fluidAhead = grounded && (below == LAVA || level == LAVA || (kind != CREEPER && below == WATER));
        if (blockedLow || blockedHigh) {
            if (grounded && blockedLow && !blockedHigh && stepFree) vel.y = JUMP;
            else facing = -facing;
            vel.x = 0.0;
        } else if (dropAhead || fluidAhead) {
            facing = -facing;
            vel.x = 0.0;
        } else {
            pos.x = nx;
        }
    }

    // Vertical: land on blocks or window tops, bump heads.
    float ny = pos.y + vel.y * dt;
    if (vel.y <= 0.0) {
        bool hit = solidAt(pos.x - halfW * 0.8, ny) || solidAt(pos.x + halfW * 0.8, ny);
        float plat = windowPlatform(pos.x, pos.y, ny);
        if (hit) {
            ny = floor(ny) + 1.0;
            vel.y = 0.0;
        }
        if (plat >= 0.0 && plat >= ny - 0.001) {
            ny = plat;
            vel.y = 0.0;
        }
    } else if (solidAt(pos.x, ny + sz.y)) {
        ny = pos.y;
        vel.y = 0.0;
    }
    pos.y = ny;

    // Fell out of the world or got buried: back up to the surface.
    if (pos.y < 0.5 || pos.y > float(ROWS) + 6.0 || solidAt(pos.x, pos.y + 0.4)) {
        int col = clamp(int(floor(pos.x)), 0, cols - 1);
        pos = vec2(pos.x, float(max(topSolid(col), SEA) + 1));
        vel = vec2(0.0);
    }

    outA = vec4(pos, vel);
    outB = vec4(float(kind + 1), facing, timer, 0.0);
}

// ------------------------------------------------------------- main

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 ic = ivec2(fragCoord);
    int cols = columns();
    float dt = iTimeDelta;
    bool pressed = iMouse.z > 0.0;

    vec4 ticks = texelFetch(iChannel0, ivec2(3, EVENT_ROW), 0);
    float waterStep = floor(iTime / WATER_TICK);
    float lavaStep = floor(iTime / LAVA_TICK);
    float slowStep = floor(iTime / SLOW_TICK);
    bool waterTick = waterStep != ticks.x;
    bool lavaTick = lavaStep != ticks.y;
    bool slowTick = slowStep != ticks.z;

    // World cells.
    if (ic.y < ROWS && ic.x < cols) {
        int c = ic.x;
        int r = ic.y;
        vec4 s = cellState(c, r);
        int o = overrideOf(s);
        int nb = naturalBlock(c, r);
        float progress = s.y;
        float z = s.z;
        float changed = s.w;

        // Healing: changed blocks drift back to the generated world.
        if (slowTick && HEAL_DELAY > 0.0 && (o == 1 || o == 2 || o == 3) && iTime - changed > HEAL_DELAY
            && abs(z) < 0.5 && hash12(vec2(c, r) + slowStep * 0.37) < 0.08) {
            o = 0;
            changed = iTime;
        }
        // Grass creeps onto bare dirt next to grass.
        if (slowTick && o == 0 && nb == DIRT && blockAt(c, r + 1) == AIR
            && hash12(vec2(c, r) * 1.7 + slowStep) < 0.12 && nearGrass(c, r)) {
            o = 4;
            changed = iTime;
        }

        vec2 blast;
        if (nb != BEDROCK && findBlast(blast) && length(vec2(ic) + 0.5 - blast) < BLAST_RADIUS) {
            o = 1;
            z = 0.0;
            changed = iTime;
        }

        int b = blockAt(c, r);
        if (pressed && ic == cursorCell() && isSolid(b) && hardness(b) > 0.0 && mobAtCursor() < 0) {
            progress += dt / hardness(b);
            if (progress >= 1.0) {
                o = 1;
                z = 0.0;
                changed = iTime;
                progress = 0.0;
            }
        } else {
            progress = 0.0;
        }

        // A lava source that water reaches turns to obsidian.
        if (o == 0 && nb == LAVA && waterTick && touches(c, r, 0)) {
            o = 3;
            changed = iTime;
        }

        // Flowing fluid in cells that are open.
        if (o == 1 || (o == 0 && nb == AIR)) {
            float wc = waterTick ? flowLevel(c, r, 0) : -1.0;
            float lc = lavaTick ? flowLevel(c, r, 1) : -1.0;
            if (z > 0.5) {
                if (wc >= 0.0) z = wc;
            } else if (z < -0.5) {
                if (lc >= 0.0) z = -lc;
            } else {
                if (wc > 0.0) z = wc;
                else if (lc > 0.0) z = -lc;
            }
            // Water and lava meeting set into cobblestone.
            if ((waterTick || lavaTick) && ((z > 0.5 && touches(c, r, 1)) || (z < -0.5 && touches(c, r, 0)))) {
                o = 2;
                z = 0.0;
                changed = iTime;
            }
        } else {
            z = 0.0;
        }

        fragColor = vec4(float(o), progress, z, changed);
        return;
    }

    // Mobs.
    if ((ic.y == MOB_ROW || ic.y == MOB_ROW + 1) && ic.x < NMOB) {
        vec4 a, b;
        updateMob(ic.x, a, b);
        fragColor = ic.y == MOB_ROW ? a : b;
        return;
    }

    // Events.
    if (ic.y == EVENT_ROW && ic.x < 5) {
        vec4 e = texelFetch(iChannel0, ic, 0);
        if (ic.x == 0) {
            vec2 blast;
            fragColor = findBlast(blast) ? vec4(blast, 0.0, 1.0) : vec4(e.xy, e.z + dt, e.w);
        } else if (ic.x == 1) {
            ivec2 cur = cursorCell();
            bool broke = false;
            if (pressed && cur.x >= 0 && cur.y < ROWS) {
                vec4 s = cellState(cur.x, cur.y);
                int b = blockAt(cur.x, cur.y);
                float hd = hardness(b);
                broke = isSolid(b) && hd > 0.0 && mobAtCursor() < 0 && s.y + dt / hd >= 1.0;
                if (broke) fragColor = vec4(vec2(cur), 0.0, float(b + 1));
            }
            if (!broke) fragColor = vec4(e.xy, e.z + dt, e.w);
        } else if (ic.x == 2) {
            fragColor = vec4(pressed ? 1.0 : 0.0, 0.0, 0.0, 0.0);
        } else if (ic.x == 3) {
            fragColor = vec4(waterStep, lavaStep, slowStep, 1.0);
        } else {
            // Mob lost to lava this step: smoke where it stood.
            fragColor = vec4(e.xy, e.z + dt, e.w);
            for (int i = 0; i < NMOB; i++) {
                vec4 b = mobB(i);
                if (!mobPresent(b)) continue;
                vec4 a = mobA(i);
                if (blockAt(int(floor(a.x)), int(floor(a.y + 0.2))) == LAVA) {
                    fragColor = vec4(a.xy + vec2(0.0, 0.5), 0.0, 1.0);
                }
            }
        }
        return;
    }

    fragColor = vec4(0.0);
}
