float distanceToLine(vec2 p1, vec2 p2, vec2 point) {
    float a = p1.y-p2.y;
    float b = p2.x-p1.x;
    return abs(a*point.x+b*point.y+p1.x*p2.y-p2.x*p1.y) / sqrt(a*a+b*b);
}

vec2 midpoint (vec2 p1, vec2 p2)
{
        return vec2((p1.x+p2.x)/2., (p1.y+p2.y) /2.);

}


float clampToLine (vec2 p1, vec2 p2, vec2 point, float line)
{
   vec2 mp = midpoint(p1,p2);
   float maxDistance = distance(mp,p1);
   if (distance(mp,point) > maxDistance)
   {
       return 0.;
   }
   else
   {
       return line;
   }

}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 o1 = vec2(0.5,0.1);
    vec2 o2 = vec2(0.2,0.5);
		vec2 uv = fragCoord.xy / iResolution.xy;
    // get distance to line
    float distance = distanceToLine (o1,o2,uv);
    //line
		float radius =0.01;
    float AA = 0.003;
   	float line =  smoothstep (radius/2.,radius/2.-AA,distance);

    line =  clampToLine(o1,o2,uv,line);


    float outLine = line;

    fragColor = vec4(1.*outLine,1.*outLine,1.*outLine,1.0);

}
