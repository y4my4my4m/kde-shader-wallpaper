// URL: shadertoy.com/view/ls3GRr
// By: fizzer


vec2 softPolyOffset;
int softPolyIndex;

float poly(vec2 p, int n, float r)
{
    float d=0.;
    for(int i=0;i<8;++i)
    {
        float a=float(i)/float(n)*acos(-1.)*2.;
        float b=max(0.,dot(p,vec2(cos(a),sin(a)))-r);
        d+=b*b;
    }
    return sqrt(d);
}


float heart(vec2 p,float s)
{
    float d=max(dot(p, vec2(-1., -1.2)*8.), dot(p, vec2(1., -1.2)*8.));
    float u=abs(p.x) + 1.7;
    float v=max(0.0, p.y + .9);
    return length(vec2(d, length(vec2(u, v))))-1.8-s;
}

float softPoly(vec2 p, int n, float r, float s)
{
    if(softPolyIndex==12)
    {
        float d=heart(p,r-s);
        return clamp(smoothstep(0.,s*2.,d),0.,1.);
    }      
    p=abs(p);
    if(p.x>p.y)
        p=p.yx;
    float aa=float(n);
    p*=mat2(cos(aa),sin(aa),-sin(aa),cos(aa));
    p-=softPolyOffset;
    float d=poly(p,n,r-s);
    return clamp(smoothstep(0.,s*2.,d),0.,1.);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 t=(uv-vec2(.5))*1.5;
    t.x*=iResolution.x/iResolution.y;
    vec3 col=vec3(0.2,0.15,0.1)*(cos((t.y*100.+sin(t.x+t.y*5.)*10.*cos(t.x*3.)*sin(t.y*20.))*2.)*.1+.9);
    float depth=0.;
    float shad0=1.,shad1=1.;

    for(int i=0;i<20;++i)
    {
        softPolyIndex=i;
        softPolyOffset=vec2(cos(float(i)+iTime*0.3),sin(float(i)*2.+iTime*0.1))*0.4;
        vec2 p=t.xy;
        vec2 p2=p;
        int n=3+int(mod(float(i),7.));
        float r=0.2;
        float a=1.0-softPoly(p2,n,r,0.003);
        float as0=softPoly(p2+2.0*vec2(0.002,0.005)*(1.0+float(i)-depth),n,r,0.01+0.003*(1.0+float(i)-depth));
        float as1=softPoly(p2,n,r,0.01+0.01*(1.0+float(i)-depth));
        shad0*=as0;
        shad1*=as1;
        shad0=mix(shad0,1.,a);
        shad1=mix(shad1,1.,a);
        vec3 c=(i==12)?vec3(1,.3,.6):vec3(1);
        col=mix(col,c,a);
        depth=mix(depth,float(i+1),a);
    }

    col=(.6*.5*col*mix(0.,1.,shad0)*vec3(1,1,.6)+.5*vec3(.8,.8,1)*col*mix(0.,1.,shad1));

    col+=pow(1.0-smoothstep(0.,3.,-t.y+1.),4.)*vec3(1,1,.6)*.3;

    fragColor.rgb=sqrt(col);
}
 
