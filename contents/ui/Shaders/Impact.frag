// https://www.shadertoy.com/view/ltj3zR
// Credits to cabbibo

// Mostly taken from
// http://www.iquilezles.org/www/index.htm
// https://www.shadertoy.com/user/iq


const float MAX_TRACE_DISTANCE = 6.0;           // max trace distance
const float INTERSECTION_PRECISION = 0.00001;        // precision of the intersection
const int NUM_OF_TRACE_STEPS = 100;


const float loopSpeed   = .1;
const float loopTime    = 5.;
const float impactTime  = 1.;
const float impactFade  = .3;
const float fadeOutTime = .01;
const float fadeInTime  = .2;
const float whiteTime   = .3; // fade to white




// Trying to sync by using AND's code from
// https://www.shadertoy.com/view/4sSSWz
#define WARMUP_TIME     (2.0)

// Shadertoy's sound is a bit out of sync every time you run it :(
#define SOUND_OFFSET    (-0.0)



const int NUM_PLANETS = 1;
vec3 planet = vec3( 0. );

const vec3 sun = vec3( 0. );

float impactLU[ 58 ];



float planetNoise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
f = f*f*(3.0-2.0*f);

vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
//vec2 rg = textureLod( iChannel0, (uv+ 0.5)/256.0, 0.0 ).yx;
//return mix( rg.x, rg.y, f.z );
return f.z;
}


float displacement( vec3 p )
{
    p += vec3(1.0,0.0,0.8);

    const mat3 m = mat3( 0.00,  0.80,  0.60,
                        -0.80,  0.36, -0.48,
                        -0.60, -0.48,  0.64 );
    //float m = .1412;
    float f;
    f  = 0.5000*planetNoise( p ); p = m*p*2.02;
    f += 0.2500*planetNoise( p ); p = m*p*2.03;
    f += 0.1250*planetNoise( p ); p = m*p*2.01;
    f += 0.0625*planetNoise( p );

float n = planetNoise( p*3.5 );
    f += 0.03*n*n;

    return f;
}



//-------
// Extra Util Functions
//-------


vec3 hsv(float h, float s, float v)
{

  return mix( vec3( 1.0 ), clamp( ( abs( fract(
    h + vec3( 3.0, 2.0, 1.0 ) / 3.0 ) * 6.0 - 3.0 ) - 1.0 ), 0.0, 1.0 ), s ) * v;
}




float hash (float n)
{
    return fract(sin(n)*43758.5453);
}

float noise (in vec3 x)
{
    vec3 p = floor(x);
    vec3 f = fract(x);

    f = f*f*(3.0-2.0*f);

    float n = p.x + p.y*57.0 + 113.0*p.z;

    float res = mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
                        mix( hash(n+ 57.0), hash(n+ 58.0),f.x),f.y),
                    mix(mix( hash(n+113.0), hash(n+114.0),f.x),
                        mix( hash(n+170.0), hash(n+171.0),f.x),f.y),f.z);
    return res;
}





// Taken from https://www.shadertoy.com/view/4ts3z2
float tri(in float x){return abs(fract(x)-.5);}
vec3 tri3(in vec3 p){return vec3( tri(p.z+tri(p.y*1.)), tri(p.z+tri(p.x*1.)), tri(p.y+tri(p.x*1.)));}


// Taken from https://www.shadertoy.com/view/4ts3z2
float triNoise3D(in vec3 p, in float spd)
{
    float z=1.4;
    float rz = 0.;
    vec3 bp = p;
    for (float i=0.; i<=3.; i++ )
    {
        vec3 dg = tri3(bp*2.);
        p += (dg+iTime*.1*spd);

        bp *= 1.8;
        z *= 1.5;
        p *= 1.2;
        //p.xz*= m2;

        rz+= (tri(p.z+tri(p.x+tri(p.y))))/z;
        bp += 0.14;
    }
    return rz;
}



//----
// Camera Stuffs
//----
mat3 calcLookAtMatrix( in vec3 ro, in vec3 ta, in float roll )
{
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(sin(roll),cos(roll),0.0) ) );
    vec3 vv = normalize( cross(uu,ww));
    return mat3( uu, vv, ww );
}

void doCamera( out vec3 camPos, out vec3 camTar, in float time , in float timeInLoop, in float mouseX )
{
    float an = 0.3 + 10.0*mouseX;
    float r = time;

    float extraSweep =  pow((clamp( timeInLoop , 1. , 3. ) - 3.), 2.);
    float x = ( timeInLoop/2. + 2. ) *cos( 1.3 + .4 * timeInLoop - .3 * extraSweep );
    float z = ( timeInLoop/2. + 2. ) *sin( 1.3 + .4 * timeInLoop - .3 * extraSweep );

    vec3 offset = vec3( hash( time ) -.5 , hash( time * 2. )-.5 , hash( time * 3.)-.5 );

    camPos = vec3(x,.7,z) +.1 * offset * pow( extraSweep * .4 , 10. );
    camTar = vec3(timeInLoop / 2.,0.0,0.0);
}



//----
// Distance Functions
// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
//----



float sdSphere( vec3 p, float s )
{
  return length(p)- s;//+ .1 * sin( p.x * p.y * p.z * 10. + iTime );//* (1.+ .4 * triNoise3D( p * .1 ,.3 ) + .2* triNoise3D( p * .3 ,.3 )) ;
}

float sdPlanet( vec3 p, float s )
{

    return length(p)- s + .1 * triNoise3D( p * .5 , .01 )+ .04 * sin( p.x * p.y * p.z * 10. + iTime );;//+ .03 * noise( sin(p) * 10. + p ) + .03 * sin( p.x * p.y * p.z * 10. + iTime )+ .02 * sin( p.x + p.y + p.z * 2. + iTime );//* (1.+ .4 * triNoise3D( p * .1 ,.3 ) + .2* triNoise3D( p * .3 ,.3 ))

}

// checks to see which intersection is closer
// and makes the y of the vec2 be the proper id
vec2 opU( vec2 d1, vec2 d2 ){

    return (d1.x<d2.x) ? d1 : d2;

}






//--------------------------------
// Modelling
//--------------------------------
vec2 map( vec3 pos ){

    vec3 rot = vec3( 0. );//vec3( iTime * .05 + 1., iTime * .02 + 2. , iTime * .03  );
    // Rotating box
       //vec2 res = vec2( rotatedBox( pos , rot , vec3( 0.7 ) , .1 ) , 1.0 );

    vec2 res = vec2( sdPlanet( pos , .8 ) , 1. );

   // for( int i = 0; i < NUM_PLANETS; i++){
        vec2 res2 = vec2( sdSphere( pos - planet , .1 ), 2. );
            res = opU( res , res2 );
    //}

    return res;

}



vec2 calcIntersection( in vec3 ro, in vec3 rd ){


    float h =  INTERSECTION_PRECISION*2.0;
    float t = 0.0;
    float res = -1.0;
    float id = -1.;

    for( int i=0; i< NUM_OF_TRACE_STEPS ; i++ ){

        if( h < INTERSECTION_PRECISION || t > MAX_TRACE_DISTANCE ) break;
            vec2 m = map( ro+rd*t );
        h = m.x;
        t += h;
        id = m.y;

    }

    if( t < MAX_TRACE_DISTANCE ) res = t;
    if( t > MAX_TRACE_DISTANCE ) id =-1.0;

    return vec2( res , id );

}

// Calculates the normal by taking a very small distance,
// remapping the function, and getting normal for that
vec3 calcNormal( in vec3 pos ){

    vec3 eps = vec3( 0.001, 0.0, 0.0 );
    vec3 nor = vec3(
        map(pos+eps.xyy).x - map(pos-eps.xyy).x,
        map(pos+eps.yxy).x - map(pos-eps.yxy).x,
        map(pos+eps.yyx).x - map(pos-eps.yyx).x );
    return normalize(nor);

}



//------
// Volumetric funness
//------

float posToFloat( vec3 p ){

    float f = triNoise3D( p * .2 + vec3( iTime * .01 , 0. , 0.), .1 );
    return f;

}



// box rendering for title at end
float inBox( vec2 p , vec2 loc , float boxSize ){

    if(
        p.x < loc.x + boxSize / 2. &&
        p.x > loc.x - boxSize / 2. &&
        p.y < loc.y + boxSize / 2. &&
        p.y > loc.y - boxSize / 2.
    ){

    return 1.;

    }

    return 0.;

}


vec2 getTextLookup( float lu ){

    float posNeg = abs( lu ) / lu;

    float x = floor( abs( lu ) / 100. );
    float y = abs( lu ) - (x * 100.);

    y = floor( y / 10. );
    y *= ((abs( lu ) - (x * 100.) - (y * 10. )) -.5) * 2.;

    return vec2( x * posNeg , y  );

}


float impact( vec2 p , float stillness ){


    float f = 0.;

    for( int i = 0; i < 58; i++ ){

        for( int j = 0; j < 3; j++ ){

            float size = (-5.+( 10. * float( j ))) * stillness + 10.;
            vec2 lu = getTextLookup( impactLU[ i ] )* size;
            f += inBox( p , vec2( iResolution / 2. ) + lu , size );

        }

    }

    return f/3.;


}

#define FOG_STEPS 20
vec4 overlayFog( vec3 ro , vec3 rd , vec2 screenPos , float hit ){

    float lum = 0.;
    vec3 col = vec3( 0. );

    //float nSize = .000002 * hit;
       //float n = (noise(vec3(2.0*screenPos, abs(sin(iTime * 10. ))*.1))*nSize) -.5* nSize;
    for( int i = 0; i < FOG_STEPS; i++ ){

        vec3 p = ro * ( 1. )  + rd  * ( MAX_TRACE_DISTANCE / float( FOG_STEPS))  * float( i );

        vec2 m  = map( p );

        if( m.x < 0.0 ){ return vec4( col , lum ) / float( FOG_STEPS ); }


        // Fading the fog in, so that we dont get banding
        float ss = pow( clamp(pow( m.x * 10. , 3.)  , 0. , 5. )/5. , 1. );//m.x;// smoothstep( m.x , 0.2, .5 ) / .5;


        float planetFog = 0.;
        planetFog += (10./ (length( p-planet ) * length( planet )));

        //Check to see if we are in the corona
        if( length( p ) < 1.4 && length( p ) > .8 ){

            float d = (1.4 - length( p )) / .6;
            lum += ss * 20. * posToFloat( p * (3. / length( p )) ) * d;//30. / length( p );
            col += ss * vec3( 1. , .3 , 0.1 ) * 50. *  d* posToFloat( p* (3. / length( p )) );//* lum;

        }

        // TODO: MAKE THIS BETTER!!!!
        //float fleck = noise((1./ pow(length(p), 6.)) * p * 3.);// * noise( length(p) * p * 3.);
        //if( fleck > .8 ){return vec4( vec3(.2,0.,0.) * col / float( i ) , lum ); }

        lum += ss * pow( planetFog , 2. ) * .3 * posToFloat( p * .3 * planetFog + vec3( 100. ));//// + sin( p.y * 3. ) + sin( p.z * 5.);
        col += ss * planetFog * hsv( lum * .7 * (1. / float( FOG_STEPS))+ .5 , 1. , 1. );
    }

    return vec4( col , lum ) / float(FOG_STEPS);

}





/*vec3 doLighting( vec3 ro , vec3 rd ){



}*/


void mainImage( out vec4 fragColor, in vec2 fragCoord ){

    // 1000 and 100 are the x positions
    // 10 is y position
    // 1 is y sign
    // I
    impactLU[0] = -1621.;
    impactLU[1] = -1611.;
    impactLU[2] = -1600.;
    impactLU[3] = -1610.;
    impactLU[4] = -1620.;


    // M
    impactLU[5] = -1221.;
    impactLU[6] = -1211.;
    impactLU[7] = -1201.;
    impactLU[8] = -1210.;
    impactLU[9] = -1220.;

    impactLU[10] = -1021.;
    impactLU[11] = -1011.;
    impactLU[12] = -1001.;
    impactLU[13] = -1010.;
    impactLU[14] = -1020.;

    impactLU[15] = -821.;
    impactLU[16] = -811.;
    impactLU[17] = -801.;
    impactLU[18] = -810.;
    impactLU[19] = -820.;

    // P
    impactLU[20] = -421.;
    impactLU[21] = -411.;
    impactLU[22] = -401.;
    impactLU[23] = -410.;
    impactLU[24] = -420.;

    impactLU[25] = -221.;
    impactLU[26] = -211.;
    impactLU[27] = -201.;


    // A
    impactLU[28] = 221.;
    impactLU[29] = 211.;
    impactLU[30] = 201.;
    impactLU[31] = 210.;
    impactLU[32] = 220.;

    impactLU[33] = 321.;

    impactLU[34] = 421. ;
    impactLU[35] = 411. ;
    impactLU[36] = 401. ;
    impactLU[37] = 410. ;
    impactLU[38] = 420. ;


    // extra hooks for p and m...
    impactLU[39] = -321.;
    impactLU[40] = -1121.;
    impactLU[41] = -921.;


     // C

    impactLU[42] = 821.;
    impactLU[43] = 811.;
    impactLU[44] = 801.;
    impactLU[45] = 810.;
    impactLU[46] = 820.;

    impactLU[47] = 921. ;
    impactLU[48] = 1021.;

    impactLU[49] = 920. ;
    impactLU[50] = 1020.;


      // T

    impactLU[51] = 1521.;
    impactLU[52] = 1511.;
    impactLU[53] = 1501.;
    impactLU[54] = 1510.;
    impactLU[55] = 1520.;

    impactLU[56] = 1421.;
    impactLU[57] = 1621.;




    vec2 p = (-iResolution.xy + 2.0*fragCoord.xy)/iResolution.y;
    vec2 m = iMouse.xy/iResolution.xy;


    float time = max(0.0, iTime - WARMUP_TIME);

    float tInput = time;
    float timeInLoop = loopTime - time * loopSpeed;


    //float r = 5. - mod( tInput , 5. );


    float extraSweep =  pow((clamp( timeInLoop , 1. , 3. ) - 3.), 2.);
    //float extraSweep = 2. - clamp( timeInLoop , 1. , 2. );
    float r = 4.  - extraSweep * 1. ;


    planet.x = r *(cos( .3 + .03 * timeInLoop));
    planet.z = r *(sin( .3 + .03 * timeInLoop ));


    //-----------------------------------------------------
    // camera
    //-----------------------------------------------------

    // camera movement
    vec3 ro, ta;
    doCamera( ro, ta, tInput , timeInLoop , m.x );

    // camera matrix
    mat3 camMat = calcLookAtMatrix( ro, ta, 0.0 );  // 0.0 is the camera roll

    // create view ray
    vec3 rd = normalize( camMat * vec3(p.xy,2.0) ); // 2.0 is the lens length

    //vec2 res = calcIntersection( ro , rd  );

    vec3 col = vec3( 0. ,0.,0. );

    if( timeInLoop > impactTime ){

        vec2 res = calcIntersection( ro, rd );

        if( res.y == 1. || res.y == 2. ){

            vec3 pos = ro + rd * res.x;
            vec3 nor = calcNormal( pos );

            vec3 lightDir = pos - planet.xyz;

            float lightL = length( lightDir );
            lightDir = normalize( lightDir );


            float match = max(  0. , dot( -nor , lightDir ));

            vec3 refl = reflect( lightDir , nor );
            float reflMatch = max( 0. , dot( -rd , refl ) );
            float eyeMatch = 1. - max( 0. , dot( -rd , nor ) );


           //float

            vec3 ambi = vec3( .1 , 0.1 ,0.1 );
            vec3 lamb = vec3( 1. , .5 , .3 ) * match;
            vec3 spec = vec3( 1. , .3 , .2 ) * pow(reflMatch,20.);
            vec3 rim = vec3( 1. , .3 , .1 )  * pow( eyeMatch , 3. );
            col =  rim + ( ( ambi + lamb + spec) * 3. / lightL); //nor  * .5 + .5;

        }else{


          // background
          float neb = pow(triNoise3D( (sin(rd) - vec3( 156.29)) * 1. , .1) , 3.);
          col = neb * hsv( neb + .6 , 1. , 2. );

        }

        float hit = 0.;
        if( res.y == 1. || res.y == 2. ){ hit = 1.; }

        vec4 fog = overlayFog( ro , rd , fragCoord.xy , hit );
        col += .6 * fog.xyz * fog.w;

    }


    // Fading in / fading out
    float fadeIn = ((loopTime - clamp( timeInLoop , loopTime - fadeInTime , loopTime ))) / fadeInTime;

    float fadeOut = ((loopTime - clamp( (loopTime- timeInLoop) , loopTime - fadeOutTime , loopTime ))) / fadeOutTime;


    // Gives us a straight fade to white
    // to hide some weird noise we were
    // seeing
    if( timeInLoop < impactTime + whiteTime ){ col += vec3( 10. * (impactTime + whiteTime - timeInLoop) ); }



    // TEXT
    if( timeInLoop < impactTime ){

        col = vec3( 1. );

        float imp = impact( fragCoord.xy , max( 0.2 , timeInLoop - fadeOutTime) -.2 );
        float textFade = pow( max( 0. , timeInLoop - (impactTime - impactFade) ) / impactFade , 2. );
        col = vec3( textFade );

        vec3 ro, ta;
        doCamera( ro, ta, 0.,  0. , m.x );

        // camera matrix
        mat3 camMat = calcLookAtMatrix( ro, ta, 0.0 );  // 0.0 is the camera roll

        // create view ray
        vec3 rd = normalize( camMat * vec3(p.xy,2.0) ); // 2.0 is the lens length

        // getting color for text
        float neb = pow(triNoise3D( (sin(rd) - vec3( 156.29)) * 1. , 1.4) , 2.);
        col += (1. - textFade ) * imp * 4. * neb * hsv( neb - .1 , 1. , 2. );
        col += ( 1. - textFade ) * neb * hsv( neb + .8 , 1. , 2. );
       // col = vec3( fragCoord.x ,  , 1. );
        //col = texture( iChannel0 , sin(fragCoord.xy * 10. )).xyz;// vec3( 1. , 1. ,1. );
    }

    fragColor = min( fadeOut , fadeIn )  * vec4(col,1.0);

}
