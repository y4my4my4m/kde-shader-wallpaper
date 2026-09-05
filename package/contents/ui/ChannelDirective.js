.pragma library
// ChannelDirective.js — a shader declares its own iChannel routing in a
// header comment, so picking it (gallery, file dialog, shaderview) wires the
// engine the way the author meant instead of the generic "Buffer A on 0"
// default:
//
//     // @channels audio, bufferA
//
// One token per iChannel0..3, in order. Tokens (case-insensitive):
//   audio | fft                 20   the FFT/waveform texture
//   bufferA .. bufferD | A..D   10..13
//   self                        the pass's own buffer (only meaningful
//                               inside a _bufferX.frag; in the image pass
//                               it means bufferA)
//   tex0 .. tex3 | image0..3    0..3  static texture slots
//   none | -                    -1
// Missing trailing tokens keep the engine defaults. The directive in the
// main file applies to the image pass AND to every buffer pass that has no
// directive of its own (the usual audio+feedback layout is identical for
// both: audio on 0, the buffer on 1). audioEnabled follows the directive:
// on when any pass names audio, off otherwise.

var CHANNEL_RE = /^[ \t]*\/\/[ \t]*@channels?[ \t]*:?[ \t]*([^\r\n]*)/im;

function tokenValue(tok, selfIndex) {
    var t = tok.trim().toLowerCase();
    if (t === "" ) return null;
    if (t === "none" || t === "-" || t === "off") return -1;
    if (t === "audio" || t === "fft" || t === "music") return 20;
    if (t === "self") return selfIndex;
    var m = t.match(/^buffer([a-d])$/) || t.match(/^([a-d])$/);
    if (m) return 10 + "abcd".indexOf(m[1]);
    m = t.match(/^(?:tex|texture|image)([0-3])$/);
    if (m) return parseInt(m[1]);
    m = t.match(/^-?\d+$/);
    if (m) return parseInt(t);
    return null;   // unknown word: leave that channel alone
}

// parse(code, selfIndex) → { found, channels:[4 × int|null], audio }
// selfIndex: 10..13 for a buffer pass, 10 for the image pass.
function parse(code, selfIndex) {
    var res = { found: false, channels: [null, null, null, null], audio: false };
    if (!code) return res;
    var head = code.split("\n", 60).join("\n");   // header only, never a body comment
    var m = head.match(CHANNEL_RE);
    if (!m) return res;
    res.found = true;
    var toks = m[1].split(/[,\s]+/);
    for (var i = 0; i < 4 && i < toks.length; i++) {
        var v = tokenValue(toks[i], selfIndex === undefined ? 10 : selfIndex);
        res.channels[i] = v;
        if (v === 20) res.audio = true;
    }
    return res;
}
