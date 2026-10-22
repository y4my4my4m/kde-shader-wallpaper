.pragma library
.import "ChannelDirective.js" as ChannelDirective
// Shared shader-selection logic. Every entry point that switches shaders
// (gallery, file dialog, drag and drop, playlist timer, presets, onboarding,
// shuffle, imports) builds the full set of config values here, keyed by the
// main.xml entry name, and writes them in one pass. Callers own the write:
// applyMap(target, map, prefix) with prefix "cfg_" for the settings page or
// "" for a KConfigPropertyMap.
//
// Channel routing values (main.xml): -1 none, 0..3 image slot, 10..13 buffer
// A..D previous frame, 20 audio spectrum.

var PASSES = ["A", "B", "C", "D"];

// configVersion 2: a non-empty selectedShaderCode overrides
// selectedShaderPath (version 1: the path won).
var CONFIG_VERSION = 2;

// Current-state keys forPath / forImported read to retire images the
// previous shader declared.
var TEXTURE_STATE_KEYS = ["selectedShaderPath", "selectedShaderCode",
                          "iChannel0", "iChannel1", "iChannel2", "iChannel3"];

// User preferences a shader can switch on; automatic changes (playlist,
// shuffle) leave them alone.
var INPUT_KEYS = ["mouseEnabled", "windowsEnabled", "audioEnabled"];

var ROUTING_KEYS = (function() {
    var keys = [];
    for (var c = 0; c < 4; c++) keys.push("imageChannel" + c);
    for (var b = 0; b < 4; b++)
        for (var k = 0; k < 4; k++) keys.push("buffer" + PASSES[b] + "Channel" + k);
    return keys;
})();

// Keys "Apply to all screens" carries.
var SCREEN_SYNC_KEYS = [
    "selectedShaderPath", "selectedShaderCode",
    "commonCode", "bufferACode", "bufferBCode", "bufferCCode", "bufferDCode",
    "useBufferA", "useBufferB", "useBufferC", "useBufferD",
    "iChannel0", "iChannel0Enabled", "iChannel1", "iChannel1Enabled",
    "iChannel2", "iChannel2Enabled", "iChannel3", "iChannel3Enabled",
    "audioEnabled", "audioChannel", "mouseEnabled", "windowsEnabled",
    "shaderSpeed", "targetFps", "resolutionScale", "dither", "configVersion"
].concat(ROUTING_KEYS);

// Keys a preset stores (format version 2).
var PRESET_KEYS = SCREEN_SYNC_KEYS.concat([
    "mouseBias", "audioSensitivity", "bufferSimulationMaxHeight"
]);

function defaultRouting() {
    var m = {};
    for (var c = 0; c < 4; c++) m["imageChannel" + c] = c;
    for (var b = 0; b < 4; b++)
        for (var k = 0; k < 4; k++) m["buffer" + PASSES[b] + "Channel" + k] = -1;
    return m;
}

// Generic multi-pass layout: each buffer feeds back into itself on input 0,
// the image pass reads Buffer A on input 0.
function bufferDefaultRouting(m) {
    if (m.useBufferA) {
        m.bufferAChannel0 = 10;
        m.imageChannel0 = 10;
    }
    if (m.useBufferB) m.bufferBChannel0 = 11;
    if (m.useBufferC) m.bufferCChannel0 = 12;
    if (m.useBufferD) m.bufferDChannel0 = 13;
}

// Absolute file URL for any stored form: "Shaders/X.frag", "/abs/X.frag",
// "file:///abs/X.frag". Relative paths resolve in the user data root first.
function toFileUrl(lib, path) {
    var s = String(path || "");
    if (s.length === 0) return "";
    if (s.indexOf("file://") === 0) return s;
    if (s.charAt(0) === "/") return "file://" + s;
    return lib.userFileUrl(s) || ("file://" + lib.libraryPath + "/" + s);
}

function displayName(path) {
    var s = String(path || "");
    var slash = s.lastIndexOf("/");
    var base = slash < 0 ? s : s.substring(slash + 1);
    return base.replace(/\.(frag\.qsb|frag|glsl)$/i, "");
}

function routingUsesAudio(m) {
    var passes = [["image", true]];
    for (var b = 0; b < 4; b++) passes.push([PASSES[b], !!m["useBuffer" + PASSES[b]]]);
    for (var p = 0; p < passes.length; p++) {
        if (!passes[p][1]) continue;
        for (var c = 0; c < 4; c++) {
            var key = passes[p][0] === "image" ? "imageChannel" + c
                                               : "buffer" + passes[p][0] + "Channel" + c;
            if (m[key] === 20) return true;
        }
    }
    return false;
}

function detectInputs(m, allCode) {
    if (/\biWindow(Count|Rects|Velocities)\b/.test(allCode)) m.windowsEnabled = true;
    if (/\biMouse\b/.test(allCode)) m.mouseEnabled = true;
}

// Images a shader declares: @textureN header lines, overridden per slot
// by a package manifest's channels.iChannelN.
function declaredTextures(lib, path, code) {
    var main = code && code.length > 0 ? code
             : (path ? (lib.loadShaderCode(toFileUrl(lib, path)) || "") : "");
    var res = ChannelDirective.parseTextures(main);
    if (path) {
        var manifest = (lib.loadBufferCodes(toFileUrl(lib, path)) || {}).channels || {};
        for (var t = 0; t < 4; t++) {
            var stored = manifest["iChannel" + t];
            if (typeof stored === "string" && stored.length > 0) res[t] = stored;
        }
    }
    return res;
}

// A slot the previous shader filled from its own declaration, and that the
// new config leaves alone, is cleared; a slot the user changed since keeps
// the user's image. `current`: TEXTURE_STATE_KEYS values, or null.
function retirePreviousTextures(lib, m, current) {
    if (!current) return;
    var prev = declaredTextures(lib, current.selectedShaderPath || "", current.selectedShaderCode || "");
    for (var t = 0; t < 4; t++) {
        if (m["iChannel" + t] !== undefined || !prev[t]) continue;
        if (current["iChannel" + t] !== prev[t]) continue;
        m["iChannel" + t] = "";
        m["iChannel" + t + "Enabled"] = false;
    }
}

// Full config for a shader file. `lib` is ShaderLibrarySingleton;
// `current` (optional) is the state being replaced, see
// retirePreviousTextures().
function forPath(lib, path, current) {
    var url = toFileUrl(lib, path);
    var m = defaultRouting();
    m.configVersion = CONFIG_VERSION;
    m.selectedShaderPath = lib.toRelativeShaderPath(url);
    m.selectedShaderCode = "";

    var bd = lib.loadBufferCodes(url) || {};
    m.commonCode = bd.commonCode || "";
    for (var b = 0; b < 4; b++) {
        var X = PASSES[b];
        m["buffer" + X + "Code"] = bd["buffer" + X + "Code"] || "";
        m["useBuffer" + X] = !!bd["useBuffer" + X];
    }
    bufferDefaultRouting(m);

    // A package manifest is authoritative for the passes it describes; a
    // header directive in its main.frag does not override it.
    var manifestImage = false, manifestBuffers = false;
    if (bd.channels) {
        for (var c = 0; c < 4; c++) {
            var v = bd.channels["imageChannel" + c];
            if (v !== undefined && v !== null) { m["imageChannel" + c] = Number(v); manifestImage = true; }
        }
    }
    if (bd.bufferChannels) {
        for (var bi = 0; bi < 4; bi++)
            for (var ci = 0; ci < 4; ci++) {
                var mk = "buffer" + PASSES[bi] + "Channel" + ci;
                var mv = bd.bufferChannels[mk];
                if (mv !== undefined && mv !== null) { m[mk] = Number(mv); manifestBuffers = true; }
            }
    }

    var mainCode = lib.loadShaderCode(url) || "";
    var directive = ChannelDirective.parse(mainCode, 10);
    var wantsAudio = false;
    if (directive.found) {
        wantsAudio = directive.audio;
        if (!manifestImage) {
            for (var dc = 0; dc < 4; dc++)
                if (directive.channels[dc] !== null) m["imageChannel" + dc] = directive.channels[dc];
        }
        if (!manifestBuffers) {
            for (var db = 0; db < 4; db++) {
                var Y = PASSES[db];
                if (!m["useBuffer" + Y]) continue;
                var bdir = ChannelDirective.parse(m["buffer" + Y + "Code"], 10 + db);
                if (!bdir.found) bdir = directive;
                for (var bc = 0; bc < 4; bc++)
                    if (bdir.channels[bc] !== null) m["buffer" + Y + "Channel" + bc] = bdir.channels[bc];
                if (bdir.audio) wantsAudio = true;
            }
        }
    }
    var allCode = [mainCode, m.commonCode, m.bufferACode, m.bufferBCode,
                   m.bufferCCode, m.bufferDCode].join("\n");
    // Audio follows the shader wherever that is decidable: a directive, an
    // audio route, or no iChannel use at all. Otherwise it stays as is.
    if (routingUsesAudio(m)) wantsAudio = true;
    if (directive.found || wantsAudio) m.audioEnabled = wantsAudio;
    else if (!/\biChannel[0-3]\b/.test(allCode)) m.audioEnabled = false;

    // Images the shader ships with. Undeclared slots keep the user's images.
    var declared = declaredTextures(lib, url, mainCode);
    for (var t = 0; t < 4; t++) {
        if (!declared[t]) continue;
        m["iChannel" + t] = declared[t];
        m["iChannel" + t + "Enabled"] = true;
    }
    retirePreviousTextures(lib, m, current);

    detectInputs(m, allCode);
    return m;
}

// Shadertoy input id → routing value. Buffer outputs are identified by
// numeric id (legacy API: 257..260) or string id (current API).
var SHADERTOY_BUFFER_IDS = {
    "257": 10, "258": 11, "259": 12, "260": 13,
    "4dXGR8": 10, "XsXGR8": 11, "4sXGR8": 12, "XdfGR8": 13
};

function _shadertoyBufferIndex(ref) {
    if (!ref) return -1;
    var v = SHADERTOY_BUFFER_IDS[String(ref.id)];
    if (v !== undefined) return v - 10;
    var s = /buffer0?([0-3])\b/i.exec(String(ref.src || ref.filepath || ""));
    if (s) return parseInt(s[1]);
    var n = /buffer\s*([a-d])/i.exec(String(ref.name || ""));
    if (n) return "abcd".indexOf(n[1].toLowerCase());
    return -1;
}

// Raw Shadertoy JSON (ShadertoyAPI.shaderFetched) → per-pass routing
// { image: [4], A: [4], ... }; null entries keep the defaults.
function routingFromShadertoy(shader) {
    var out = {};
    var passes = (shader && shader.renderpass) || [];
    for (var i = 0; i < passes.length; i++) {
        var p = passes[i];
        var key;
        if (p.type === "image") key = "image";
        else if (p.type === "buffer") {
            var idx = _shadertoyBufferIndex((p.outputs && p.outputs[0]) || null);
            if (idx < 0) idx = _shadertoyBufferIndex({ name: p.name });
            if (idx < 0) continue;
            key = PASSES[idx];
        } else continue;
        var r = [null, null, null, null];
        var inputs = p.inputs || [];
        for (var j = 0; j < inputs.length; j++) {
            var inp = inputs[j];
            var ch = Number(inp.channel);
            if (!(ch >= 0 && ch < 4)) continue;
            var t = String(inp.ctype || inp.type || "").toLowerCase();
            if (t === "buffer") {
                var bidx = _shadertoyBufferIndex(inp);
                r[ch] = bidx >= 0 ? 10 + bidx : -1;
            } else if (t === "music" || t === "musicstream" || t === "mic" || t === "microphone") {
                r[ch] = 20;
            } else if (t === "texture") {
                r[ch] = ch;
            } else {
                r[ch] = -1;
            }
        }
        out[key] = r;
    }
    return out;
}

// Full config for inline (imported / pasted) code. bufferCodes keys may be
// "BufferA" or "Buffer A". routing is routingFromShadertoy() output or null.
function forImported(mainCode, bufferCodes, commonCode, routing, lib, current) {
    var m = defaultRouting();
    m.configVersion = CONFIG_VERSION;
    m.selectedShaderPath = "";
    m.selectedShaderCode = mainCode || "";
    m.commonCode = commonCode || "";
    var codes = {};
    var bc = bufferCodes || {};
    for (var k in bc) {
        var mm = /buffer\s*([a-d])/i.exec(k);
        if (mm && bc[k]) codes[mm[1].toUpperCase()] = String(bc[k]);
    }
    for (var b = 0; b < 4; b++) {
        var X = PASSES[b];
        m["buffer" + X + "Code"] = codes[X] || "";
        m["useBuffer" + X] = !!codes[X];
    }
    bufferDefaultRouting(m);
    if (routing) {
        var all = ["image"].concat(PASSES);
        for (var p = 0; p < all.length; p++) {
            var r = routing[all[p]];
            if (!r) continue;
            for (var c = 0; c < 4; c++) {
                if (r[c] === null || r[c] === undefined) continue;
                var key = all[p] === "image" ? "imageChannel" + c : "buffer" + all[p] + "Channel" + c;
                m[key] = r[c];
            }
        }
    }
    if (routingUsesAudio(m)) m.audioEnabled = true;
    if (lib) retirePreviousTextures(lib, m, current);
    detectInputs(m, [m.selectedShaderCode, m.commonCode, m.bufferACode, m.bufferBCode,
                     m.bufferCCode, m.bufferDCode].join("\n"));
    return m;
}

// The map without the input preferences (automatic shader changes).
function withoutInputs(m) {
    var out = {};
    for (var k in m) if (INPUT_KEYS.indexOf(k) < 0) out[k] = m[k];
    return out;
}

// Routing subset of forPath/forImported for "Reset to shader defaults".
function routingOnly(m) {
    var r = {};
    for (var i = 0; i < ROUTING_KEYS.length; i++) r[ROUTING_KEYS[i]] = m[ROUTING_KEYS[i]];
    return r;
}

function _copy(v) {
    if (v !== null && typeof v === "object" && typeof v.length === "number")
        return Array.prototype.slice.call(v);
    return v;
}

// Writes `map` into a cfg_* page (prefix "cfg_") or a KConfigPropertyMap
// (prefix ""). The shader identity field that ends up non-empty is written
// first, so path and code are never both empty in between: with both empty
// the wallpaper loads its default file, which resets the engine's buffer
// flags.
function applyMap(target, map, prefix) {
    var pre = prefix || "";
    // QQmlPropertyMap answers `in` with true for any name.
    var known = typeof target.keys === "function" ? target.keys() : null;
    var has = function(k) { return known ? known.indexOf(pre + k) >= 0 : (pre + k) in target; };
    var first = map.selectedShaderCode ? ["selectedShaderCode", "selectedShaderPath"]
                                       : ["selectedShaderPath", "selectedShaderCode"];
    var order = first.filter(function(k) { return k in map; });
    for (var k in map) if (order.indexOf(k) < 0) order.push(k);
    for (var i = 0; i < order.length; i++) {
        var key = order[i];
        if (!has(key)) continue;
        var v = _copy(map[key]);
        if (target[pre + key] !== v) target[pre + key] = v;
    }
}

function collect(source, keys, prefix) {
    var pre = prefix || "";
    var out = {};
    for (var i = 0; i < keys.length; i++) {
        var v = source[pre + keys[i]];
        if (v !== undefined) out[keys[i]] = _copy(v);
    }
    return out;
}

// Preset file content (version 2). The legacy top-level fields stay so
// version-1 readers still find the shader, speed and inputs.
function presetFromConfig(source, prefix) {
    var pre = prefix || "";
    var g = function(k) { return source[pre + k]; };
    return {
        version: 2,
        shaderConfig: collect(source, PRESET_KEYS, pre),
        shaderPath: g("selectedShaderPath"),
        shaderCode: g("selectedShaderCode"),
        speed: g("shaderSpeed"),
        targetFps: g("targetFps"),
        resolutionScale: g("resolutionScale"),
        mouseEnabled: g("mouseEnabled"),
        mouseBias: g("mouseBias"),
        audioEnabled: g("audioEnabled"),
        audioChannel: g("audioChannel"),
        audioSensitivity: g("audioSensitivity")
    };
}

// Config map for a preset of either version.
function configFromPreset(lib, preset) {
    if (!preset) return {};
    if (preset.shaderConfig) {
        var out = {};
        for (var k in preset.shaderConfig) out[k] = _copy(preset.shaderConfig[k]);
        out.configVersion = CONFIG_VERSION;
        return out;
    }
    var m = {};
    if (preset.shaderPath) {
        m = forPath(lib, preset.shaderPath);
    } else if (preset.shaderCode) {
        m = forImported(preset.shaderCode, {}, "", null);
    }
    m.configVersion = CONFIG_VERSION;
    var legacy = {
        speed: "shaderSpeed", targetFps: "targetFps", resolutionScale: "resolutionScale",
        mouseEnabled: "mouseEnabled", mouseBias: "mouseBias", audioEnabled: "audioEnabled",
        audioChannel: "audioChannel", audioSensitivity: "audioSensitivity"
    };
    for (var lk in legacy)
        if (preset[lk] !== undefined && preset[lk] !== null) m[legacy[lk]] = preset[lk];
    var ch = preset.channels;
    if (ch) {
        for (var c = 0; c < 4; c++) {
            if (ch["channel" + c] !== undefined) m["iChannel" + c] = String(ch["channel" + c] || "");
            if (ch["channel" + c + "Enabled"] !== undefined) m["iChannel" + c + "Enabled"] = !!ch["channel" + c + "Enabled"];
        }
    }
    return m;
}
