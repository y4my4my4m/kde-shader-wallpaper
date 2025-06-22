// https://www.shadertoy.com/view/Wsc3W4
// Credits to evilryu
// Created by evilryu
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

#define PI 3.14
#define AA 0
#define FAR 20.

float rnd=0.;

float hash12(vec2 p)
{
    p=fract(p*vec2(5.3983, 5.4427));
    p+=dot(p.yx, p.xy + vec2(21.5351, 14.3137));
	return fract(p.x * p.y * 95.4337);
}

mat2 rot(float t)
{
    float c=cos(t), s=sin(t);
    return mat2(c,-s,s,c);
}

float box(vec3 p, vec3 b)
{
    vec3 d=abs(p)-b;
    return length(max(d,0.0))+min(max(d.x,max(d.y,d.z)),0.0);
}

float infi_box(vec2 p, vec2 b)
{
    vec2 d=abs(p)-b;
    return length(max(d,0.0))+min(max(d.x,d.y),0.0);
}

float oct(vec3 p, float s)
{
    p=abs(p);
    return (p.x+p.y+p.z-s)*0.57735027;
}

vec3 kifs(vec3 p)
{
    float s=1.;
    float scale=3.5;
    for(int i=0;i<4;++i)
    {
        p=scale*abs(p)-(scale-1.);
        p.xy*=rot(-0.4);
        p.yz*=rot(0.23);
        s*=scale;
    }
    p/=s;
    return p;
}

vec3 kifs2(vec3 p)
{
    float s=.7;
    for(int i=0;i<5;++i)
    {
        if(p.x+p.y<0.){p.xy = -p.yx;}
        if(p.x+p.z<0.){p.xz = -p.zx;}
        if(p.y+p.z<0.){p.yz = -p.zy;}
		p = p*2.-1.+0.3*sin(iTime);
        p.xy*=rot(iTime);
        p.yz*=rot(iTime);

    }
    p*=pow(2.,-5.);
    return p;
}

int obj=0;

vec3 tri(vec3 p){ return abs(fract(p)-0.5);}
float tri_surf(vec3 p)
{
    return dot(tri(p*0.5+tri(p.yxz*0.25+tri(p.xzy*0.125))), vec3(0.6666));
}


float acc0=0., acc1=0.;

float core(vec3 p)
{
    vec3 q=p;
    p=kifs2(p*0.5);
    float d0=infi_box(q.xy,vec2(0.1));
    float d1=box(p,vec3(0.05));
    float d=d1*2.;

    q=q+vec3(0.,3.,0.);
    float d2=infi_box(abs(q.xz)-4.,vec2(0.3));

    d=min(d,d2);

    acc0+=0.2/(0.15+abs(d));
    acc1+=0.2/(0.15+abs(d));
    return d;
}

float map(vec3 p)
{
    vec3 q=p;
    p=kifs(p);
    float d1=abs(p.y+1.5);

    obj=1;

    float d=d1;
    d-=tri_surf(p)*0.2;

    vec3 r=q;
    r.xz=abs(r.xz*rot(2.*iTime))-1.9;
    r.yz=abs(r.yz*rot(2.*iTime))-1.9;

    float d3=oct(r,0.5);
    d=min(d,d3);

    float d0=core(q);
    if(d0<d){obj=0;d=d0;}

    return d*0.8;
}

vec3 get_normal(vec3 p)
{
    vec2 eps=vec2(0.001,0.);
    return normalize(vec3(map(p+eps.xyy)-map(p-eps.xyy),
                    map(p+eps.yxy)-map(p-eps.yxy),
                    map(p+eps.yyx)-map(p-eps.yyx)));
}


float intersect(vec3 ro, vec3 rd)
{
    float t=0.1;
    for(int i=0;i<128;++i)
    {
        float d=map(ro+t*rd);
        if(obj==0)d*=rnd;
        t+=d;
        if(d<0.005 || t>=FAR)
            break;
    }

    return t;
}

vec3 firecolor(float f)
{
    f=f*f*(3.0-2.0*f);
    return  min(vec3(f+.8, f*f*1.4+.1, f*f*f*.7)*f, 1.0);
}

vec3 lightcolor(float t)
{
    return mix(firecolor(0.4), vec3(0.,1.0,0.5)*0.5, pow(abs(t),8.));
}

float get_ao(vec3 p, vec3 n)
{
    float r=0.0, w=1.0, d;
    for(float i=1.; i<5.0+1.1; i++)
    {
        d=i/5.0;
        r+=w*(d-map(p+n*d));
        w*=0.5;
    }
    return 1.0-clamp(r,0.0,1.0);
}

vec3 lighting(vec3 ro, vec3 rd, vec3 n, vec3 p)
{
    vec3 l1d=normalize(-p);
    vec3 l1c=lightcolor(rd.x)*10.;

    float ao=get_ao(p,n);

    float dif=max(dot(n,l1d),0.)*ao;
    float bac=max(dot(n,-l1d),0.)*ao;
    float amb=clamp(0.3+0.7*n.y,0.0,1.0);
    float spe=pow(max(dot(reflect(-l1d,n),normalize(-l1d-rd)),0.), 32.);

    map(p);

    vec3 mate;
    if(obj==0)mate=lightcolor(rd.x);
    else mate=vec3(0.1,0.2,0.3)*0.5;

    vec3 lin=(l1c*(4.*dif+1.*bac)+amb*vec3(1.))*mate.xyz+4.*spe*vec3(1.);

    return lin*0.2;
}

vec3 tonemap(vec3 x)
{
    const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
    return (x*(a*x+b))/(x*(c*x+d)+e);
}

mat3 cam(vec3 ro, vec3 ta)
{
    vec3 f=normalize(ta-ro);
    vec3 r=normalize(cross(f,vec3(0.,1.,0.)));
    vec3 u=normalize(cross(r,f));
    return mat3(r,u,f);
}

vec3 get_reflection(vec3 ro, vec3 rd, vec3 n)
{
    vec3 new_rd=reflect(rd,n);
    ro+=0.1*n;

    acc1=0.;
    float t=0.1;
    for(int i=0;i<20;++i)
    {
        float d=core(ro+t*new_rd);
        d*=rnd; t+=d;
        if(d<0.1 || t>=FAR)
            break;
    }
    vec3 col=vec3(0);
    if(t<FAR)
        col=acc1*0.1*lightcolor(rd.x);
    return col;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 q=fragCoord/iResolution.xy;
    vec2 p=q*2.-1.;
    p.x*=iResolution.x/iResolution.y;

    rnd=hash12(fragCoord)*0.1+0.9;

    vec3 ro=vec3(0.,-1.,10.+cos(iTime));
    vec3 ta=vec3(0.,1.,0.);

    ro.xz*=rot(.5*iTime);
     // debugging camera
    float x_rot=-iMouse.x/iResolution.x*PI*2.0;
    float y_rot=iMouse.y/iResolution.y*3.14*0.5 + PI/2.0;
    if(iMouse.z>0.||iMouse.w>0.)
        ro=vec3(0.,0,-3)+vec3(cos(y_rot)*cos(x_rot),cos(y_rot)*cos(x_rot),cos(y_rot)*sin(x_rot))*12.;

    vec3 tot=vec3(0.0);

    vec3 rd;

#if AA>1
    for(int m=0; m<AA; m++)
    for(int n=0; n<AA; n++)
    {
		vec2 o = vec2(float(m),float(n)) / float(AA) - 0.5;
        p=(-iResolution.xy + 2.0*(fragCoord+o))/iResolution.y;
#else
        p=(-iResolution.xy + 2.0*fragCoord)/iResolution.y;
#endif
        rd = cam(ro,ta)*normalize(vec3(p.xy,1.8));
        vec3 col=vec3(0.);

        float t=intersect(ro,rd);
        if(t<FAR)
        {
            vec3 pos=ro+t*rd;
            vec3 n=get_normal(pos);
            col=lighting(ro,rd,n,pos);

            if(obj>0)
            {
            float fre=0.04+(1.-0.04)*pow(1.-max(dot(n,-rd),0.),3.);
            col+=fre*get_reflection(pos,rd,n);
            }
        }

        col=mix(col,vec3(0.), 1.0-exp(-0.005*t*t));

        tot+=col;
#if AA>1
    }
    tot/=float(AA*AA);
    acc0/=float(AA*AA);
#endif

    tot+=acc0*0.1*lightcolor(rd.x);
    tot=tonemap(tot);
    tot=pow(clamp(tot,0.,1.0),vec3(0.45));
    tot=clamp(tot*0.5+0.5*tot*tot*1.3,0.0,1.0);
    tot*=0.5+0.5*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.7);
    fragColor = vec4(tot,1.0);
}
