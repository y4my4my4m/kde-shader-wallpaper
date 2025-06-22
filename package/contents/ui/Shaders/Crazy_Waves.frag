// https://www.shadertoy.com/view/XtsXRX
// Credits to Alkama

void mainImage(out vec4 o,vec2 i )
{
	i /= iResolution.xy;
	float w,t = iTime;
	i  = -3. + i+i;
	for(float j = 0.; j < 29.; j++)
		i.y += .2+(.9*sin(t*.4) * sin(i.x + j/3. + 3. *t )),
        i.x += 1.7* sin(t*.4),
		w = abs(1. / (2e2*abs(cos(t)) * i.y)),
		o += vec4(w *( .4+((j+1.)/18.)), w * (j / 9.), w * ((j+1.)/ 8.) * 1.9,1);
}
