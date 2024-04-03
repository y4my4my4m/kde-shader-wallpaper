// url: https://www.shadertoy.com/view/7t2fWc
// by: QuantumShader

float sdBox(vec2 testPosition, vec2 boxPosition, vec2 boxDim, float roundness)
{
    roundness = min(roundness, min(boxDim.x, boxDim.y));
    
    vec2 q = abs(testPosition - boxPosition) - (boxDim - vec2(roundness));
    // changed the last max function to min
    return length(max(q, vec2(0.))) + min(min(q.x, q.y), 0.) - roundness;
}

vec3 rgbColor(float r, float g, float b)
{
    return vec3(r, g, b) / 255.;
}

mat2 rot2D(float angle)
{
    return mat2(cos(angle), -sin(angle),
                    sin(angle), cos(angle));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = (2.* fragCoord - iResolution.xy) / iResolution.y;
    vec2 m = (2.* iMouse.xy - iResolution.xy) / iResolution.y;
    
       
    // initial rotation rotates the entire grid
    float angle = sin(iTime);
    uv = rot2D(angle) * uv;
    
    // creates the grid
    uv = sin(uv * 3.*sin(iTime));
    
    // rotates each tile in the grid
    angle = cos(iTime);
    uv = rot2D(angle) * uv;
    
    // get distance to box
    vec2 boxPos = vec2(0.0, 0.0);
    vec2 boxDim = vec2(0.5, 0.5);
    
    float d = sdBox(uv, boxPos, boxDim, m.y);
    
    // separate inner and outer regions
    vec3 outerColor = rgbColor(43., 45., 66.);
    vec3 innerColor = rgbColor(239., 35., 60.);
    
    vec3 col = outerColor  + sign(d) * (outerColor - innerColor);
    
    // make colors darker periodically based on distance 
    col *= 1. + 0.2*cos(100. * d + 10.*iTime);
    
    // dark area for small d (multiply with <1 for small d)
    col *=  1. - exp(-20.*abs(d));
    
    // draw white outline where d = 0 (mix only in that region)
    col = mix(col, vec3(1.), 1.-smoothstep(0., 0.01, abs(d)));
    
    
    // Output to screen
    fragColor = vec4(col,1.0);
}
