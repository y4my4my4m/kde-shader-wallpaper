// Rainy Window — Buffer C: the city behind the glass, out of focus.
// @channels bufferA, tex1
//
// rgb: the street at uv = fragCoord / iResolution with its lights blurred
// to bokeh; w 1. Only the image pass reads it, so it is drawn on the last
// step of each frame and every other step is discarded. Discarded entirely
// while a wallpaper is bound or on grids under CITY_ROWS rows; the image
// pass draws its backdrop itself then. iChannel0 is Buffer A of this step,
// for the animation clock.

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    if (iChannelResolution[1].x > 0.0 || iResolution.y < CITY_ROWS || iSubstep < iSubsteps - 1) discard;
    cityBegin(texelFetch(iChannel0, ivec2(0, 0), 0).x);
    fragColor = vec4(city(fragCoord / iResolution.y, cBl, 1.0 / iResolution.y), 1.0);
}
