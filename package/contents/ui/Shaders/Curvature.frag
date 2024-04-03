// URL: https://www.shadertoy.com/view/XlfXR4
// By: iq

// The MIT License
// Copyright © 2015 Inigo Quilez
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


//
// Computes the curvature of a parametric curve f(x) as 
//
// c(f) = |f'|^3 / | f' x f''|
//
// More info here: https://en.wikipedia.org/wiki/Curvature
//


//----------------------------------------

vec3 a, b, c, m, n;

// curve
vec3 mapD0(float t)
{
    return 0.25 + a*cos(t+m)*(b+c*cos(t*7.0+n));
}
// curve derivative (velocity)
vec3 mapD1(float t)
{
    return -7.0*a*c*cos(t+m)*sin(7.0*t+n) - a*sin(t+m)*(b+c*cos(7.0*t+n));
}
// curve second derivative (acceleration)
vec3 mapD2(float t)
{
    return 14.0*a*c*sin(t+m)*sin(7.0*t+n) - a*cos(t+m)*(b+c*cos(7.0*t+n)) - 49.0*a*c*cos(t+m)*cos(7.0*t+n);
}

//----------------------------------------

float curvature( float t )
{
    vec3 r1 = mapD1(t); // first derivative
    vec3 r2 = mapD2(t); // second derivative
    return pow(length(r1),3.0) / length(cross(r1,r2));
}

//-----------------------------------------

// unsigned squared distance between point and segment
vec2 usqdPointSegment( in vec3 p, in vec3 a, in vec3 b )
{
	vec3  pa = p - a;
	vec3  ba = b - a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	vec3  q = pa - ba*h;
	return vec2( dot(q,q), h );
}


// unsigned squared distance between ray and segment
vec2 usqdLineSegment( vec3 a, vec3 b, vec3 o, vec3 d )
{
#if 1
	vec3 oa = a-o;
    vec3 ob = b-o;
	vec3 va = oa-d*dot(oa,d);
    vec3 vb = ob-d*dot(ob,d);
    
    vec3 ba = va-vb;
    float h = clamp( dot(va,ba)/dot(ba,ba), 0.0, 1.0 );
    vec3  q = va - ba*h;
    return vec2( dot(q,q), h );
#else
    return usqdPointSegment( vec3(0.0), o+d*dot(a-o,d)-a, o+d*dot(b-o,d)-b );
#endif
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    a = vec3(1.85,1.25,1.85) + 0.1*cos(5.0+0.7*iTime + vec3(0.5,1.0,2.0) );
    b = vec3(0.60,0.60,0.60) + 0.1*cos(4.0+0.5*iTime + vec3(2.5,5.0,3.0) );
    c = vec3(0.40,0.40,0.40) + 0.1*cos(1.0+0.3*iTime + vec3(6.0,2.0,4.2) );
    m = cos( 0.11*iTime + vec3(2.0,0.0,5.0) );
    n = cos( 0.17*iTime + vec3(3.0,1.0,4.0) );

	vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
 
    vec3 ro = vec3( 0.0, 0.0, 4.0 );
    vec3 rd = normalize( vec3(p.xy, -2.0) );

    vec3 col = vec3(0.0);
    
    vec3  gp = vec3(0.0);
    float pt = (-1.0-ro.y)/rd.y;
    vec3 gc = vec3(0.0);
    if( pt>0.0 )
    {
        gp = ro + pt*rd;
        gc = vec3(1.0) * (0.2 + 0.1*smoothstep(-0.01,0.01,sin(4.0*gp.x)*sin(4.0*gp.z)));
        col = 0.3*gc*exp(-0.05*pt);
    }
    
    const int kNum = 150;
    
    float dt = 6.2831/float(kNum);
	float t = 0.0;
    vec3  xb = mapD0(t); t += dt;
    for( int i=0; i<kNum; i++ )
    {
        vec3 xc = mapD0(t);
        xc.y = max(-1.0,xc.y); // clip to ground
        vec2 ds = usqdLineSegment( xb, xc, ro, rd );

        // compute curvature
        float h = t - dt + dt*ds.y;
        float c = curvature( h );

        vec3  cc = clamp( 0.25 + 0.75*cos( -clamp(3.0*c,0.0,2.0) + 1.0 + vec3(0.0,1.5,2.0) ), 0.0, 1.0 );
        
        col += 1.0*cc*exp2( -800.0*ds.x );
        col += 0.1*cc*exp2( -40.0*ds.x );

        // light ground
        if( pt > 0.0 )
        {
            vec2 sd = usqdPointSegment( gp, xb, xc );
            col += gc*0.8*cc*exp(-2.0*sd.x)*exp( -0.05*pt );
        }
        
        xb = xc; t += dt;
	}    
    
	fragColor = vec4( col, 1.0 );
}
