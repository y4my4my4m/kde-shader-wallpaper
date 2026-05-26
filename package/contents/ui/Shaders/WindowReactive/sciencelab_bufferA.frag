// BufferA — unused.
//
// The Aperture Science shader is single-pass: all effects (window borders,
// energy beams, portal ring, tile pattern) are computed analytically in
// the image pass (plasma_windows.frag) each frame. No feedback state
// needed → no buffer required.
//
// This file is kept as a no-op so existing user configs that have Buffer A
// enabled don't error out. To save the buffer pass cost entirely, turn
// off Buffer A in the wallpaper config under "Buffer configuration".
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    fragColor = vec4(0.0);
}
