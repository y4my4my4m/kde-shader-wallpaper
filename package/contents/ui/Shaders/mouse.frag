
void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord / iResolution.xy * 2.0 - vec2(1.0, 1.0);
    vec2 mouse = iMouse.xy / iResolution.xy * 2.0 - vec2(1.0, 1.0);
    vec2 disMouse = uv - mouse;
    
    float r = 0.1+0.01*sin(atan(disMouse.x,disMouse.y)*8.0);
    //num8 decide how many leafs this cicle has. Amazing!
    
    vec3 col =  vec3(1.0,1.0,1.0);
    vec3 colCircle = vec3(0.2,0.9,0.0);
    vec3 colBackground = vec3(0.24,0.25,0.1);
    
    col *= smoothstep(r,r+0.01,length(disMouse));
    col = mix(colCircle,colBackground,col);
    
    //col =  vec3(1.0,1.0,1.0)*sin(atan(disMouse.x,disMouse.y)*8.0);
       
    fragColor = vec4(col,1.0);
}