// https://www.shadertoy.com/view/lsSXzD
// Credits to P_Malin

// E1M1 - Hangar
// by @P_Malin

// Procedural version of Doom E1M1

// The start area of Doom E1M1.
// Click and drag the mouse to move.
// Where you click relative to the center of the screen sets the view direction.

// This is the single pass version. A multi-pass playable version is here: https://www.shadertoy.com/view/lldGDr

// Also, check out Reinder's excellent Doom2 shader: https://www.shadertoy.com/view/lsB3zD

// The sectors we draw by default
#define ENABLE_NUKAGE_SECTORS
#define ENABLE_START_SECTORS

// Adding this compiles with "Unknown Error" on some machines. Uncomment if you are feeling lucky.
//#define ENABLE_SECTOR_31

// Some additional sectors, may need to comment out some of the default ones
//#define ENABLE_EXTRA_NUKAGE_SECTORS
//#define ENABLE_MISC_SECTORS

#define ENABLE_SPRITES

#define DEMO_CAMERA
#define INTRO_EFFECT
#define DRAW_SKY
#define HEAD_BOB

#define PIXELATE_IMAGE
#define QUANTIZE_FINAL_IMAGE
#define QUANTIZE_TEXTURES
#define PIXELATE_TEXTURES

//#define DISCARD_BACKGROUND

//#define DRAW_COMPASS

// Add walls to close entrances to sectors we are not rendering
#ifndef ENABLE_EXTRA_NUKAGE_SECTORS
	#define CLOSE_NUKAGE_SECTOR
#endif
#ifndef ENABLE_SECTOR_31
	#define CLOSE_START_SECTOR
#endif

#define FAR_CLIP 10000.0

const vec2 vFakeResolution = vec2(320.0, 240.0);

const float kDepthFadeScale = (1.0 / 3500.0);
const float kExtraLight = 0.0;

// Light level adjustment to East-West and North-South walls
const float kC = (1.0 / 16.0);


struct Ray
{
    vec3 vRayOrigin;
    vec3 vRayDir;
    vec2 vSpriteDir;
};

vec3 SampleTexture( const in float fTexture, const in vec2 vUV );
void MapIntersect( out float fClosestT, out vec4 vHitInfo, Ray r );
float hash(float p);

vec3 GetCameraRayDir( const in vec2 vWindow, const in vec3 vCameraPos, const in vec3 vCameraTarget )
{
	vec3 vForward = normalize(vCameraTarget - vCameraPos);
	vec3 vRight = normalize(cross(vec3(0.0, 1.0, 0.0), vForward));
	vec3 vUp = normalize(cross(vForward, vRight));
	
    const float kFOV = 1.8;
    
	vec3 vDir = normalize(vWindow.x * vRight + vWindow.y * vUp + vForward * kFOV);

	return vDir;
}

vec3 Quantize( const in vec3 col )
{
	return floor( col * 48.0 + 0.5 ) * (1.0 / 48.0);
}

float Cross2d( const in vec2 vA, const in vec2 vB )
{   
    //return cross( vec3(vA, 0.0), vec3(vB, 0.0) ).z;
  	return vA.x * vB.y - vA.y * vB.x;

    //return dot(vA * vB.yx, vec2(1.0, -1.0)); 
}

void BeginSector( out vec4 vSectorState, const in vec2 vSectorHeights, Ray r )
{
    // store the infinite floor-ceiling plane intersect depth in vSectorState.xy
    vSectorState.xy = (vSectorHeights - r.vRayOrigin.y) / r.vRayDir.y;   
    vSectorState.zw = vec2(0.0,0.0);
}

// Intersect a sidedef that meets another sector with the same floor and ceiling height
void Null( inout vec4 vSectorState, const in int iAx, const in int iAy, const in int iBx, const in int iBy, Ray r )
{
    vec2 vA = vec2(iAx, iAy);
    vec2 vB = vec2(iBx, iBy);
    
    vec2 vD = vB - vA;
    vec2 vOA = vA - r.vRayOrigin.xz;
	float fDenom = Cross2d( r.vRayDir.xz, vD );
    float fRcpDenom = 1.0 / fDenom;
    float fHitT = Cross2d( vOA, vD ) * fRcpDenom;
    float fHitU = Cross2d( vOA, r.vRayDir.xz ) * fRcpDenom;

   	if((fHitT > 0.0) && (fHitU >= 0.0) && (fHitU < 1.0))
    {
        // If we crossed the sector edge further away than the floor-ceiling intersection
        // then we increment the in-out test value
        // This is like doing a ray-casting point in polygon test 
        // http://en.wikipedia.org/wiki/Point_in_polygon
        // from the floor/ceiling intersection depth to far clip depth
    	vSectorState.zw += step(vSectorState.xy, vec2(fHitT,fHitT));
    }
}

void Wall( inout float fClosestT, inout vec4 vHitInfo, inout vec4 vSectorState, const in int iAx, const in int iAy, const in int iBx, const in int iBy, const in int iLen, const in float fLightLevel, const in vec2 vSectorHeights, const in float fTexture, Ray r )
{
    vec2 vA = vec2(iAx, iAy);
    vec2 vB = vec2(iBx, iBy);
	float fLen = float(iLen);
    
    vec2 vD = vB - vA;
    vec2 vOA = vA - r.vRayOrigin.xz;
	float fDenom = Cross2d( r.vRayDir.xz, vD );
    float fRcpDenom = 1.0 / fDenom;
    float fHitT = Cross2d( vOA, vD ) * fRcpDenom;
    float fHitU = Cross2d( vOA, r.vRayDir.xz ) * fRcpDenom;

    if((fHitT > 0.0) && (fHitU >= 0.0) && (fHitU < 1.0))
    {
        // If we crossed the sector edge further away than the floor-ceiling intersection
        // then we increment the in-out test value
        // This is like doing a ray-casting point in polygon test 
        // http://en.wikipedia.org/wiki/Point_in_polygon
        // from the floor/ceiling intersection depth to far clip depth
        vSectorState.zw += step(vSectorState.xy, vec2(fHitT,fHitT));

        if((fHitT < fClosestT) && (fDenom < 0.0))
        {        
            float fHitY = r.vRayDir.y * fHitT + r.vRayOrigin.y;
            if( (fHitY > vSectorHeights.x) && (fHitY < vSectorHeights.y) )
            {
                fClosestT = fHitT;
                vHitInfo = vec4(fHitU * fLen, fHitY, fLightLevel, fTexture);            
            }
        }
    }
}

void Open( inout float fClosestT, inout vec4 vHitInfo, inout vec4 vSectorState, const in int iAx, const in int iAy, const in int iBx, const in int iBy, const in int iLen, const in float fLightLevel, const in vec2 vSectorHeights, const in int iLowerHeight, const in int iUpperHeight, const in float fLowerTexture, const in float fUpperTexture, Ray r )
{ 
    vec2 vA = vec2(iAx, iAy);
    vec2 vB = vec2(iBx, iBy);
	float fLen = float(iLen);
    float fUpperHeight = float(iUpperHeight);
    float fLowerHeight = float(iLowerHeight);
	
    vec2 vD = vB - vA;
    vec2 vOA = vA - r.vRayOrigin.xz;
	float fDenom = Cross2d( r.vRayDir.xz, vD );
    float fRcpDenom = 1.0 / fDenom;
    float fHitT = Cross2d( vOA, vD ) * fRcpDenom;
    float fHitU = Cross2d( vOA, r.vRayDir.xz ) * fRcpDenom;

    if((fHitT > 0.0) && (fHitU >= 0.0) && (fHitU < 1.0))
    {
        // If we crossed the sector edge further away than the floor-ceiling intersection
        // then we increment the in-out test value
        // This is like doing a ray-casting point in polygon test 
        // http://en.wikipedia.org/wiki/Point_in_polygon
        // from the floor/ceiling intersection depth to far clip depth
        vSectorState.zw += step(vSectorState.xy, vec2(fHitT,fHitT));
        
        if((fHitT < fClosestT) && (fDenom < 0.0))
        {
            float fHitY = r.vRayDir.y * fHitT + r.vRayOrigin.y;
            if( (fHitY > vSectorHeights.x) && (fHitY < vSectorHeights.y) )
            {
                if(fHitY < fLowerHeight)
                {
                    fClosestT = fHitT;
                    vHitInfo = vec4(fHitU * fLen, fHitY - fLowerHeight, fLightLevel, fLowerTexture);                   
                }            
                if(fHitY > fUpperHeight)
                {
                    fClosestT = fHitT;
                    vHitInfo = vec4(fHitU * fLen, fHitY - fUpperHeight, fLightLevel, fUpperTexture);                   
                }
            }
        }
    }
}

void Upper( inout float fClosestT, inout vec4 vHitInfo, inout vec4 vSectorState, const in int iAx, const in int iAy, const in int iBx, const in int iBy, const in int iLen, const in float fLightLevel, const in vec2 vSectorHeights, const in int iUpperHeight, const in float fUpperTexture, Ray r )
{ 
    vec2 vA = vec2(iAx, iAy);
    vec2 vB = vec2(iBx, iBy);
	float fLen = float(iLen);
    float fUpperHeight = float(iUpperHeight);
    
    vec2 vD = vB - vA;
    vec2 vOA = vA - r.vRayOrigin.xz;
	float fDenom = Cross2d( r.vRayDir.xz, vD );
    float fRcpDenom = 1.0 / fDenom;
    float fHitT = Cross2d( vOA, vD ) * fRcpDenom;
    float fHitU = Cross2d( vOA, r.vRayDir.xz ) * fRcpDenom;

    if((fHitT > 0.0) && (fHitU >= 0.0) && (fHitU < 1.0))
    {
        // If we crossed the sector edge further away than the floor-ceiling intersection
        // then we increment the in-out test value
        // This is like doing a ray-casting point in polygon test 
        // http://en.wikipedia.org/wiki/Point_in_polygon
        // from the floor/ceiling intersection depth to far clip depth
        vSectorState.zw += step(vSectorState.xy, vec2(fHitT,fHitT));
        
        if((fHitT < fClosestT) && (fDenom < 0.0))
        {
            float fHitY = r.vRayDir.y * fHitT + r.vRayOrigin.y;
            if( fHitY < vSectorHeights.y )
            {           
                if(fHitY > fUpperHeight)
                {
                    fClosestT = fHitT;
                    vHitInfo = vec4(fHitU * fLen, fHitY - fUpperHeight, fLightLevel, fUpperTexture);                   
                }
            }
        }
    }
}


void Lower( inout float fClosestT, inout vec4 vHitInfo, inout vec4 vSectorState, const in int iAx, const in int iAy, const in int iBx, const in int iBy, const in int iLen, const in float fLightLevel, const in vec2 vSectorHeights, const in int iLowerHeight, const in float fLowerTexture, Ray r )
{ 
    vec2 vA = vec2(iAx, iAy);
    vec2 vB = vec2(iBx, iBy);
	float fLen = float(iLen);
    float fLowerHeight = float(iLowerHeight);
    
    vec2 vD = vB - vA;
    vec2 vOA = vA - r.vRayOrigin.xz;
	float fDenom = Cross2d( r.vRayDir.xz, vD );
    float fRcpDenom = 1.0 / fDenom;
    float fHitT = Cross2d( vOA, vD ) * fRcpDenom;
    float fHitU = Cross2d( vOA, r.vRayDir.xz ) * fRcpDenom;

    if((fHitT > 0.0) && (fHitU >= 0.0) && (fHitU < 1.0))
    {
        // If we crossed the sector edge further away than the floor-ceiling intersection
        // then we increment the in-out test value
        // This is like doing a ray-casting point in polygon test 
        // http://en.wikipedia.org/wiki/Point_in_polygon
        // from the floor/ceiling intersection depth to far clip depth
        vSectorState.zw += step(vSectorState.xy, vec2(fHitT,fHitT));
        
        if((fHitT < fClosestT) && (fDenom < 0.0))
        {
            float fHitY = r.vRayDir.y * fHitT + r.vRayOrigin.y;
            if( fHitY > vSectorHeights.x )
            {           
                if(fHitY < fLowerHeight)
                {
                    fClosestT = fHitT;
                    vHitInfo = vec4(fHitU * fLen, fHitY - fLowerHeight, fLightLevel, fLowerTexture);                   
                }            
            }
        }
    }
}

void EndSector( inout float fClosestT, inout vec4 vHitInfo, in vec4 vSectorState, const in float fLightLevel, const in vec2 vFloorCeilingTextures, Ray r )
{
    // Test the even-odd state of our sector floor/ceiling in-out values
    vec2 vInOutTest = fract( vSectorState.zw * 0.5 ) * 2.0;

    if( fClosestT > vSectorState.x )
    {
        if((vInOutTest.x > 0.5) && (vSectorState.x > 0.0))
        {
            vec3 vFloorPos = r.vRayOrigin + r.vRayDir * vSectorState.x;        
            if( r.vRayOrigin.y > vFloorPos.y )
            {
                fClosestT = vSectorState.x;
                vHitInfo = vec4( vFloorPos.xz, fLightLevel, vFloorCeilingTextures.x);
            }
        }
    }

    if( fClosestT > vSectorState.y )
    {
        if((vInOutTest.y > 0.5) && (vSectorState.y > 0.0))
        {
            vec3 vCeilingPos = r.vRayOrigin + r.vRayDir * vSectorState.y;        
            if( r.vRayOrigin.y < vCeilingPos.y )
            {
                fClosestT = vSectorState.y;
                vHitInfo = vec4( vCeilingPos.xz, fLightLevel, vFloorCeilingTextures.y);
            }
        }            
    }
}

#ifdef ENABLE_SPRITES

void Sprite( out float fClosestT, out vec4 vHitInfo, const in vec2 vSpriteDir, const in int iX, const in int iY, const in int iZ, vec2 vSize, float fLightLevel, float fTexture, Ray r )
{
	vec3 vPos = vec3(iX, iY, iZ);
	fClosestT = FAR_CLIP;
	vHitInfo = vec4(0.0,0.0,0.0,0.0);
	vec2 vA = vPos.xz - vSpriteDir * 0.5 * vSize.x;
	vec2 vB = vPos.xz + vSpriteDir * 0.5 * vSize.x;
    vec2 vD = vB - vA;
    vec2 vOA = vA - r.vRayOrigin.xz;
    float rcpdenom = 1.0 / Cross2d( r.vRayDir.xz, vD ); 
    float fHitT = Cross2d( vOA, vD ) * rcpdenom;

    if(fHitT > 0.0)
    {
	    float fHitU = Cross2d( vOA, r.vRayDir.xz ) * rcpdenom;
        if((fHitU >= 0.0) && (fHitU < 1.0))
        {
            float fHitY = r.vRayDir.y * fHitT + r.vRayOrigin.y;
            if( (fHitT < fClosestT) && (fHitY > vPos.y) && (fHitY < (vPos.y + vSize.y)) )
            {
                fClosestT = fHitT;
                vHitInfo = vec4(fHitU * vSize.x, fHitY - vPos.y, fLightLevel, fTexture);            
            }
        }
    }
}

bool MaskBarrel(vec2 vTexCoord)
{
	vec2 vSize = vec2(23.0, 32.0);
	
	vTexCoord = floor(vTexCoord);
	
	// remove corner pixels
	vec2 vWrapCoord = fract((vTexCoord + vec2(2.0, 1.0) ) / vSize) * vSize;
	
	return ( (vWrapCoord.x >= 4.0) || (vWrapCoord.y >= 2.0) );
}


vec4 CosApprox( vec4 x )
{
	x = abs(fract(x * (0.5))*2.0 - 1.0);
	vec4 x2 = x*x;
	return( ( x2 * 3.0) - ( 2.0 * x2*x) );
}

bool MaskCorpseSprite(vec2 vTexCoord)
{
	//vTexCoord = floor(vTexCoord);
    
    vec2 vUV = vTexCoord.xy / vec2(57.0, 22.0);
    vec2 vOffset = vUV;
    vOffset = vOffset * 2.0 -vec2(1.0, 0.8);
    float fDist = dot(vOffset, vOffset);
    fDist += dot(CosApprox(vTexCoord.xyxy * vec4(0.55, 0.41, 0.25, 0.1)), vec4(0.2 * -vOffset.yyyy));
	return fDist < 0.4;
}

#define TEX_BAR1A 32.0
#define TEX_PLAYW 33.0

void BarrelSprite(inout float fClosestT, inout vec4 vHitInfo, const in vec2 vSpriteDir, const in int iX, const in int iY, const in int iZ, const in float fLightLevel, Ray r )
{
	float fSpriteT;
	vec4 vSpriteHitInfo;		
	Sprite( fSpriteT, vSpriteHitInfo, vSpriteDir, iX, iY, iZ, vec2(23.0, 32.0), fLightLevel, TEX_BAR1A, r);
	
	if(fSpriteT < fClosestT)
	{
		if(MaskBarrel(vSpriteHitInfo.xy))
		{
			fClosestT = fSpriteT;
			vHitInfo = vSpriteHitInfo;
		}
	}
}

void CorpseSprite(inout float fClosestT, inout vec4 vHitInfo, const in vec2 vSpriteDir, const in int iX, const in int iY, const in int iZ, const in float fLightLevel, Ray r )
{
	float fSpriteT;
	vec4 vSpriteHitInfo;		
	Sprite( fSpriteT, vSpriteHitInfo, vSpriteDir, iX, iY, iZ, vec2(57.0, 22.0), fLightLevel, TEX_PLAYW, r );

	if(fSpriteT < fClosestT)
	{
		if(MaskCorpseSprite(vSpriteHitInfo.xy))
		{
			fClosestT = fSpriteT;
			vHitInfo = vSpriteHitInfo;
		}
	}
}
#endif

vec3 DrawScene(vec3 vForwards, vec2 vUV, Ray r )
{
    
    vec4 vHitInfo;
    float fClosestT;
	float fNoFog = 0.0;

	
    MapIntersect( fClosestT, vHitInfo, r );


    #ifdef ENABLE_SPRITES
	vec2 vSpriteDir = -normalize(vec2(-vForwards.z, vForwards.x));
    BarrelSprite(fClosestT, vHitInfo, vSpriteDir, 1088, 0, -2944, 0.565, r);
    BarrelSprite(fClosestT, vHitInfo, vSpriteDir, 864, 0, -3328, 0.565, r);
    BarrelSprite(fClosestT, vHitInfo, vSpriteDir, 1312, -16, -3264, 0.878, r);
    CorpseSprite(fClosestT, vHitInfo, vSpriteDir, 1024, -16, -3264, 0.878, r);
    #endif	
	
	vHitInfo.z = clamp(vHitInfo.z + kExtraLight, 0.0, 1.0);

    // sky
    #ifdef DRAW_SKY
    float fDoSky = step(0.9, vHitInfo.w) * step(vHitInfo.w, 1.1);
    
    fNoFog = max(fNoFog, fDoSky);
    float fSkyU = (atan(vForwards.x, vForwards.z) * 512.0 / radians(180.0)) + vUV.x * 320.0;
    float fSkyV = vUV.y * 240.0;
    vHitInfo = mix(vHitInfo, vec4(fSkyU, fSkyV, 1.0, 1.0), fDoSky);
    #endif
    
    // fade in effect
	#ifdef INTRO_EFFECT
    float fEffectOffset = max(iTime - 1.0, 0.0) - hash(vUV.x);
    vec2 vEffectUV = vUV;
    vEffectUV.y += clamp(fEffectOffset, 0.0, 1.0);
    
    float fDoEffect = step(vEffectUV.y, 1.0);       
    vHitInfo = mix(vHitInfo, vec4(vEffectUV * 128.0, 1.0, 3.0), fDoEffect);
    fNoFog = max(fNoFog, fDoEffect);
    #endif    

	#ifdef DISCARD_BACKGROUND    
    if(vHitInfo.w == 0.0) discard;
	#endif
    
    float fLightLevel = clamp( vHitInfo.z, 0.0, 1.0 );
    float fDepth = dot(r.vRayDir, vForwards) * fClosestT;
    float fDepthFade = fDepth * kDepthFadeScale;
    float fApplyFog = 1.0 - fNoFog;
    fLightLevel = clamp( fLightLevel - fDepthFade * fApplyFog, 0.0, 1.0 );
    
    vec3 vResult = SampleTexture( vHitInfo.w, vHitInfo.xy ) * fLightLevel;
    
    vResult = clamp(vResult * 1.2, 0.0, 1.0);
    
    #ifdef QUANTIZE_FINAL_IMAGE
    vResult = Quantize(vResult);
    #endif    
    
    return vResult;
}

void DemoCamera( float time, inout vec3 vCameraPos, inout vec3 vCameraTarget )
{
    vCameraPos = vec3(1050, 30, -3616);
    vCameraTarget = vec3(1050, 30, -3500);

    #ifdef DEMO_CAMERA
    float fCamTime = time - 5.0;
    if(fCamTime > 0.0) fCamTime = mod(fCamTime, 33.0 - 5.0) + 5.0;
    if(iTime==10.0) fCamTime = 0.0; // hack for shadertoy preview screen
    vCameraTarget = mix( vCameraTarget, vec3(1834, 30, -3264), smoothstep(5.0, 10.0, fCamTime));
    vCameraPos = mix( vCameraPos, vec3(1280, 30, -3350), smoothstep(8.0, 13.0, fCamTime));

    vCameraTarget = mix( vCameraTarget, vec3(1280, 30, -2976), smoothstep(11.0, 16.0, fCamTime));
    vCameraPos = mix( vCameraPos, vec3(1280, 30, -2976), smoothstep(13.0, 19.0, fCamTime));

    vCameraTarget = mix( vCameraTarget, vec3(768, 30, -3050), smoothstep(16.0, 20.0, fCamTime));
    vCameraPos = mix( vCameraPos, vec3(832, 30, -3020), smoothstep(19.0, 23.0, fCamTime));

    vCameraTarget = mix( vCameraTarget, vec3(1256, 30, -3648), smoothstep(20.0, 25.0, fCamTime));
    vCameraPos = mix( vCameraPos, vec3(768, 30, -3424), smoothstep(23.0, 28.0, fCamTime));

    vCameraPos = mix( vCameraPos, vec3(1050, 30, -3616), smoothstep(25.0, 30.0, fCamTime));
    vCameraTarget = mix( vCameraTarget, vec3(1050, 30, -3500), smoothstep(28.0, 33.0, fCamTime));
    #endif    
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 vOrigUV = fragCoord.xy / iResolution.xy;
    
    #ifdef PIXELATE_IMAGE
    vec2 vUV = floor(vOrigUV * vFakeResolution + 0.5) * (1.0 / vFakeResolution);
    #else
    vec2 vUV = vOrigUV;
    #endif
    
	vec3 vCameraPos = vec3(0.0);
	vec3 vCameraTarget = vec3(0.0);
        
    vec2 vMouse = (iMouse.xy / iResolution.xy);
	
	const vec2 vStart = vec2(1050, -3616);

	if(iMouse.z > 0.0)
    {
        vec2 vDir = normalize((abs(iMouse.zw) / iResolution.xy) - 0.5);
        vec2 vOffset = (iMouse.xy - abs(iMouse.zw)) / iResolution.xy;
		vCameraPos.y = 30.0;
    	vCameraPos.xz = (vDir.yx * vec2(1.0, -1.0) * vOffset.x + vDir * vOffset.y) * 5000.0;
        vCameraPos.xz += vStart;
        vCameraTarget.xz = vCameraPos.xz + vDir * 10.0;
	    vCameraTarget.y = vCameraPos.y;
    }
    else
    {
		DemoCamera( iTime, vCameraPos, vCameraTarget );
    }
    
    #ifdef HEAD_BOB
	float fBob = sin(length(vCameraPos.xz - vStart) * 0.04) * 4.0; // head bob
    vCameraPos.y += fBob;
    vCameraTarget.y += fBob;
    #endif

    vec2 vWindowCoord =	(vUV * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
	
    Ray r;
    
    
    r.vRayOrigin = vCameraPos;
    r.vRayDir = GetCameraRayDir( vWindowCoord, vCameraPos, vCameraTarget );

    vec3 vForwards = normalize(vCameraTarget - vCameraPos); 
    
	vec3 vResult = DrawScene(vForwards, vUV, r);
    
    #ifdef DRAW_COMPASS
    // a hack - assume we have never clicked the mouse before if coordinate is zero
    if((iMouse.x > 0.5) && (iMouse.y > 0.5))
    {
        if(iMouse.z <= 0.0)
        {
            vec2 vCompassUV = vOrigUV - 0.5;
            vCompassUV.x *= iResolution.x / iResolution.y;
            float fDistNS = ((abs(vCompassUV.x) * 10.0) + abs(vCompassUV.y) - 0.05);
            float fDistEW = ((abs(vCompassUV.y) * 10.0) + abs(vCompassUV.x) - 0.025);
            float fDistCircle = abs(0.045 - length(vCompassUV)) * 10.0;
            float fDist = min(min(fDistNS, fDistEW), fDistCircle);
            
            float fAmount = clamp(fDist * 20.0, 0.0, 1.0);
            float fCol = step(fract((floor(vCompassUV.x) + floor(vCompassUV.y)) * 0.5), 0.25);
            vResult = mix(vec3(fCol * 0.75 + 0.25), vResult, fAmount);
        }
    }
    #endif
    
	fragColor = vec4(vResult, 1.0);
}

// Generated code follows
// ----------------- 8< -------------------------- 8< -------------------------- 8< --------------

// Textures
#define TEX_X 0.0
#define TEX_F_SKY1 1.0
#define TEX_NUKAGE3 2.0
#define TEX_FLOOR7_1 3.0
#define TEX_FLAT5_5 4.0
#define TEX_FLOOR4_8 5.0
#define TEX_CEIL3_5 6.0
#define TEX_TLITE6_4 7.0
#define TEX_FLAT14 8.0
#define TEX_FLOOR7_2 9.0
#define TEX_STEP2 10.0
#define TEX_TLITE6_1 11.0
#define TEX_DOOR3 12.0
#define TEX_LITE3 13.0
#define TEX_STARTAN3 14.0
#define TEX_BROWN1 15.0
#define TEX_DOORSTOP 16.0
#define TEX_COMPUTE2 17.0
#define TEX_STEP6 18.0
#define TEX_BROWN144 19.0
#define TEX_SUPPORT2 20.0
#define TEX_STARG3 21.0
#define TEX_DOORTRAK 22.0
#define TEX_SLADWALL 23.0
#define TEX_TEKWALL4 24.0
#define TEX_SW1COMP 25.0
#define TEX_BIGDOOR2 26.0

// Sectors

void Sector0( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=1.000;
    const vec2 vSH=vec2(-80.0, 216.0);

    BeginSector( vSS, vSH, r );
    Lower( fT, vInf, vSS, 1520, -3168, 1672, -3104, 164, fLt, vSH, -56, TEX_BROWN144, r );
    Lower( fT, vInf, vSS, 1672, -3104, 1896, -3104, 224, fLt-kC, vSH, -56, TEX_BROWN144, r );
    Lower( fT, vInf, vSS, 1896, -3104, 2040, -3144, 149, fLt, vSH, -56, TEX_BROWN144, r );
    Lower( fT, vInf, vSS, 2040, -3144, 2128, -3272, 155, fLt, vSH, -56, TEX_BROWN144, r );
    Lower( fT, vInf, vSS, 2128, -3272, 2064, -3408, 150, fLt, vSH, -56, TEX_BROWN144, r );
    Lower( fT, vInf, vSS, 2064, -3408, 1784, -3448, 282, fLt, vSH, -56, TEX_BROWN144, r );
    Lower( fT, vInf, vSS, 1784, -3448, 1544, -3384, 248, fLt, vSH, -56, TEX_BROWN144, r );
    Lower( fT, vInf, vSS, 1544, -3384, 1520, -3168, 217, fLt, vSH, -56, TEX_BROWN144, r );
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_NUKAGE3, TEX_F_SKY1), r );
}

void Sector1( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=1.000;
    const vec2 vSH=vec2(-56.0, 216.0);
	// merge walls from ultimate doom secret

    BeginSector( vSS, vSH, r );
    Open( fT, vInf, vSS, 1376, -3200, 1376, -3104, 96, fLt+kC, vSH, 8, 192, TEX_STARTAN3, TEX_STARTAN3, r );
    Open( fT, vInf, vSS, 1376, -3360, 1376, -3264, 96, fLt+kC, vSH, 8, 192, TEX_STARTAN3, TEX_STARTAN3, r );
    Wall( fT, vInf, vSS, 1376, -3264, 1376, -3200, 64, fLt+kC, vSH, TEX_STARTAN3, r);
	Wall( fT, vInf, vSS, 1376, -3104, 1376, -2944, 160, fLt+kC, vSH, TEX_STARTAN3, r);
    Wall( fT, vInf, vSS, 1376, -2944, 1472, -2880, 115, fLt, vSH, TEX_STARTAN3, r);
    Wall( fT, vInf, vSS, 1856, -2880, 1920, -2920, 75, fLt, vSH, TEX_STARTAN3, r);
    Null( vSS, 1520, -3168, 1672, -3104, r );
    Null( vSS, 1672, -3104, 1896, -3104, r );
    Null( vSS, 1896, -3104, 2040, -3144, r );
    Null( vSS, 2040, -3144, 2128, -3272, r );
    Null( vSS, 2128, -3272, 2064, -3408, r );
    Null( vSS, 2064, -3408, 1784, -3448, r );
    Null( vSS, 1784, -3448, 1544, -3384, r );
    Null( vSS, 1544, -3384, 1520, -3168, r );
    Wall( fT, vInf, vSS, 2736, -3360, 2736, -3648, 288, fLt+kC, vSH, TEX_STARTAN3, r);
#ifdef CLOSE_NUKAGE_SECTOR
    Wall( fT, vInf, vSS, 2736, -3648, 1376, -3648, 2736-1376, fLt, vSH, TEX_STARTAN3, r);
#else
	Null( vSS, 2736, -3648, 2240, -3648, r );
    Null( vSS, 2240, -3648, 1984, -3648, r );
    Null( vSS, 1984, -3648, 1376, -3648, r );
#endif 
    Wall( fT, vInf, vSS, 2240, -2920, 2272, -3008, 93, fLt, vSH, TEX_STARTAN3, r);
    Wall( fT, vInf, vSS, 2272, -3008, 2432, -3112, 190, fLt, vSH, TEX_STARTAN3, r);
    Wall( fT, vInf, vSS, 2432, -3112, 2736, -3112, 304, fLt-kC, vSH, TEX_STARTAN3, r);
    Open( fT, vInf, vSS, 2736, -3112, 2736, -3360, 248, fLt+kC, vSH, 0, 136, TEX_STARTAN3, TEX_STARTAN3, r );
    
	// Merge walls from Ultimate Doom secret
	Wall( fT, vInf, vSS, 1376, -3648, 1376, -3360, 3648-3360, fLt+kC, vSH, TEX_STARTAN3, r);
	//Wall( fT, vInf, vSS, 1376, -3648, 1376, -3520, 128, fLt+kC, vSH, TEX_STARTAN3);
    //Wall( fT, vInf, vSS, 1376, -3392, 1376, -3360, 32, fLt+kC, vSH, TEX_STARTAN3);
    //Wall( fT, vInf, vSS, 1376, -3520, 1376, -3392, 128, fLt+kC, vSH, TEX_STARTAN3);
    
	// Merge walls from Ultimate Doom secret
	Wall( fT, vInf, vSS, 1472, -2880, 1856, -2880, 1856-1472, fLt-kC, vSH, TEX_STARTAN3, r);
    //Wall( fT, vInf, vSS, 1472, -2880, 1664, -2880, 192, fLt-kC, vSH, TEX_STARTAN3);
    //Wall( fT, vInf, vSS, 1664, -2880, 1856, -2880, 192, fLt-kC, vSH, TEX_STARTAN3);
	
	// Merge walls
    Wall( fT, vInf, vSS, 1920, -2920, 2240, -2920, 2240-1920, fLt-kC, vSH, TEX_STARTAN3, r);
    //Wall( fT, vInf, vSS, 1920, -2920, 2176, -2920, 256, fLt-kC, vSH, TEX_STARTAN3);
    //Wall( fT, vInf, vSS, 2176, -2920, 2240, -2920, 64, fLt-kC, vSH, TEX_STARTAN3);
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLOOR7_1, TEX_F_SKY1), r );
}

void Sector3( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=1.000;
    const vec2 vSH=vec2(8.0, 192.0);

    BeginSector( vSS, vSH, r );
    Null( vSS, 1344, -3264, 1344, -3360, r );
    Null( vSS, 1376, -3360, 1376, -3264, r );
    Wall( fT, vInf, vSS, 1344, -3264, 1376, -3264, 32, fLt-kC, vSH, TEX_DOORSTOP, r);
    Wall( fT, vInf, vSS, 1376, -3360, 1344, -3360, 32, fLt-kC, vSH, TEX_DOORSTOP, r);
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLAT5_5, TEX_FLAT5_5), r );
}

void Sector5( inout float fT, inout vec4 vInf, Ray r)
{
    vec4 vSS;
    const float fLt=1.000;
    const vec2 vSH=vec2(8.0, 192.0);

    BeginSector( vSS, vSH, r );
    Null( vSS, 1344, -3104, 1344, -3200, r );
    Null( vSS, 1376, -3200, 1376, -3104, r );
    Wall( fT, vInf, vSS, 1376, -3200, 1344, -3200, 32, fLt-kC, vSH, TEX_DOORSTOP, r);
    Wall( fT, vInf, vSS, 1344, -3104, 1376, -3104, 32, fLt-kC, vSH, TEX_DOORSTOP, r);
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLAT5_5, TEX_FLAT5_5), r );
}

void Sector11( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=1.000;
    const vec2 vSH=vec2(-56.0, 24.0);

    BeginSector( vSS, vSH, r );
    Wall( fT, vInf, vSS, 1528, -3680, 1376, -3648, 155, fLt, vSH, TEX_BROWN144, r);
    Wall( fT, vInf, vSS, 1672, -3744, 1528, -3680, 157, fLt, vSH, TEX_BROWN144, r);
    Wall( fT, vInf, vSS, 1984, -3776, 1672, -3744, 313, fLt, vSH, TEX_BROWN144, r);
    Null( vSS, 1984, -3648, 1376, -3648, r );
    Null( vSS, 1984, -3648, 1984, -3776, r );
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLOOR7_1, TEX_F_SKY1), r );
}

void Sector12( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=1.000;
    const vec2 vSH=vec2(-56.0, 64.0);

    BeginSector( vSS, vSH, r );
    Wall( fT, vInf, vSS, 2240, -3776, 2208, -3680, 101, fLt, vSH, TEX_BROWN1, r);
    Wall( fT, vInf, vSS, 2208, -3680, 2176, -3680, 32, fLt-kC, vSH, TEX_BROWN1, r);
    Wall( fT, vInf, vSS, 2016, -3680, 1984, -3776, 101, fLt, vSH, TEX_BROWN1, r);
    Wall( fT, vInf, vSS, 2048, -3680, 2016, -3680, 32, fLt-kC, vSH, TEX_BROWN1, r);
    Upper( fT, vInf, vSS, 2176, -3680, 2048, -3680, 128, fLt-kC, vSH, 16, TEX_BROWN1, r );
    Null( vSS, 2240, -3648, 1984, -3648, r );
    Null( vSS, 1984, -3648, 1984, -3776, r );
    Null( vSS, 2240, -3776, 2240, -3648, r );
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLOOR7_1, TEX_F_SKY1), r );
}

void Sector24( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=0.565;
    const vec2 vSH=vec2(0.0, 144.0);

    BeginSector( vSS, vSH ,r);
    Wall( fT, vInf, vSS, 1216, -2880, 1248, -2528, 353, fLt, vSH, TEX_STARTAN3,r);
    Wall( fT, vInf, vSS, 1384, -2592, 1344, -2880, 290, fLt, vSH, TEX_STARTAN3,r);
    Wall( fT, vInf, vSS, 1472, -2560, 1384, -2592, 93, fLt, vSH, TEX_STARTAN3,r);
    Wall( fT, vInf, vSS, 1248, -2528, 1472, -2432, 243, fLt, vSH, TEX_STARTAN3,r);
    Upper( fT, vInf, vSS, 1344, -2880, 1216, -2880, 128, fLt-kC, vSH, 72, TEX_STARTAN3 ,r);
    Upper( fT, vInf, vSS, 1472, -2432, 1472, -2560, 128, fLt+kC, vSH, 88, TEX_STARTAN3 ,r);
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLOOR4_8, TEX_CEIL3_5) ,r);
}

void Sector25( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=1.000;
    const vec2 vSH=vec2(0.0, 88.0);

    BeginSector( vSS, vSH , r);
    Null( vSS, 1472, -2432, 1472, -2560 , r);
    Wall( fT, vInf, vSS, 1536, -2432, 1536, -2560, 128, fLt+kC, vSH, TEX_BIGDOOR2, r);
    Wall( fT, vInf, vSS, 1536, -2560, 1472, -2560, 64, fLt-kC, vSH, TEX_STARTAN3, r);
    Wall( fT, vInf, vSS, 1472, -2432, 1536, -2432, 64, fLt-kC, vSH, TEX_STARTAN3, r);
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLOOR4_8, TEX_TLITE6_4) , r);
}

void Sector27( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=0.878;
    const vec2 vSH=vec2(-16.0, 200.0);

    BeginSector( vSS, vSH ,r);
    Wall( fT, vInf, vSS, 1216, -3392, 1216, -3360, 32, fLt+kC, vSH, TEX_BROWN1,r);
    Wall( fT, vInf, vSS, 1216, -3360, 1184, -3360, 32, fLt-kC, vSH, TEX_BROWN1,r);
    Wall( fT, vInf, vSS, 1184, -3104, 1216, -3104, 32, fLt-kC, vSH, TEX_BROWN1,r);
    Wall( fT, vInf, vSS, 1216, -3104, 1216, -3072, 32, fLt+kC, vSH, TEX_BROWN1,r);
    Open( fT, vInf, vSS, 1344, -3264, 1344, -3360, 96, fLt+kC, vSH, 8, 192, TEX_STARTAN3, TEX_STARTAN3 ,r);
    Wall( fT, vInf, vSS, 1344, -3200, 1344, -3264, 64, fLt+kC, vSH, TEX_STARTAN3,r);
    Open( fT, vInf, vSS, 1344, -3104, 1344, -3200, 96, fLt+kC, vSH, 8, 192, TEX_STARTAN3, TEX_STARTAN3 ,r);
    Open( fT, vInf, vSS, 1344, -3360, 1216, -3392, 131, fLt, vSH, 0, 72, TEX_STEP6, TEX_STARTAN3 ,r);
    Open( fT, vInf, vSS, 1216, -3072, 1344, -3104, 131, fLt, vSH, 0, 72, TEX_STEP6, TEX_STARTAN3 ,r);
    Open( fT, vInf, vSS, 928, -3104, 1184, -3104, 256, fLt-kC, vSH, -8, 120, TEX_STEP6, TEX_STARTAN3 ,r);
    Open( fT, vInf, vSS, 1184, -3360, 928, -3360, 256, fLt-kC, vSH, -8, 120, TEX_STEP6, TEX_STARTAN3 ,r);
    Open( fT, vInf, vSS, 928, -3360, 928, -3104, 256, fLt+kC, vSH, -8, 120, TEX_STEP6, TEX_STARTAN3 ,r);
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLAT14, TEX_CEIL3_5) ,r);
}

void Sector28( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=0.753;
    const vec2 vSH=vec2(-8.0, 120.0);

    BeginSector( vSS, vSH , r);
    Wall( fT, vInf, vSS, 928, -3392, 928, -3360, 32, fLt+kC, vSH, TEX_BROWN1, r);
    Wall( fT, vInf, vSS, 928, -3360, 896, -3360, 32, fLt-kC, vSH, TEX_BROWN1, r);
    Wall( fT, vInf, vSS, 1184, -3360, 1184, -3392, 32, fLt+kC, vSH, TEX_BROWN1, r);
    Wall( fT, vInf, vSS, 896, -3104, 928, -3104, 32, fLt-kC, vSH, TEX_BROWN1, r);
    Wall( fT, vInf, vSS, 928, -3104, 928, -3072, 32, fLt+kC, vSH, TEX_BROWN1, r);
    Wall( fT, vInf, vSS, 1184, -3072, 1184, -3104, 32, fLt+kC, vSH, TEX_BROWN1, r);
    Open( fT, vInf, vSS, 1184, -3392, 928, -3392, 256, fLt-kC, vSH, 0, 72, TEX_STEP6, TEX_COMPUTE2 , r);
    Null( vSS, 928, -3104, 1184, -3104 , r);
    Null( vSS, 1184, -3360, 928, -3360 , r);
    Null( vSS, 928, -3360, 928, -3104 , r);
    Open( fT, vInf, vSS, 896, -3360, 896, -3104, 256, fLt+kC, vSH, 0, 72, TEX_STEP6, TEX_COMPUTE2 , r);
    Open( fT, vInf, vSS, 928, -3072, 1184, -3072, 256, fLt-kC, vSH, 0, 72, TEX_STEP6, TEX_COMPUTE2 , r);
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLAT14, TEX_CEIL3_5) , r);
}

void Sector29( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=0.565;
    const vec2 vSH=vec2(0.0, 72.0);

    BeginSector( vSS, vSH ,r);
    Wall( fT, vInf, vSS, 1152, -3648, 1088, -3648, 64, fLt-kC, vSH, TEX_STARTAN3,r);
    Wall( fT, vInf, vSS, 1024, -3648, 960, -3648, 64, fLt-kC, vSH, TEX_STARTAN3,r);
    Wall( fT, vInf, vSS, 1280, -3552, 1152, -3648, 160, fLt, vSH, TEX_STARTAN3,r);
    Wall( fT, vInf, vSS, 960, -3648, 832, -3552, 160, fLt, vSH, TEX_STARTAN3,r);
    Wall( fT, vInf, vSS, 1344, -3552, 1280, -3552, 64, fLt-kC, vSH, TEX_STARTAN3,r);
    Wall( fT, vInf, vSS, 832, -3552, 704, -3552, 128, fLt-kC, vSH, TEX_STARTAN3,r);
    Wall( fT, vInf, vSS, 896, -3392, 928, -3392, 32, fLt-kC, vSH, TEX_BROWN1,r);
    Wall( fT, vInf, vSS, 896, -3360, 896, -3392, 32, fLt+kC, vSH, TEX_BROWN1,r);
    Wall( fT, vInf, vSS, 1184, -3392, 1216, -3392, 32, fLt-kC, vSH, TEX_BROWN1,r);
    Wall( fT, vInf, vSS, 896, -3072, 896, -3104, 32, fLt+kC, vSH, TEX_BROWN1,r);
    Wall( fT, vInf, vSS, 928, -3072, 896, -3072, 32, fLt-kC, vSH, TEX_BROWN1,r);
    Wall( fT, vInf, vSS, 1216, -3072, 1184, -3072, 32, fLt-kC, vSH, TEX_BROWN1,r);
    Wall( fT, vInf, vSS, 1344, -2880, 1344, -3104, 224, fLt+kC, vSH, TEX_STARTAN3,r);
    Null( vSS, 1184, -3392, 928, -3392 ,r);
    Null( vSS, 1344, -3360, 1216, -3392 ,r);
    Null( vSS, 1216, -3072, 1344, -3104 ,r);
    Wall( fT, vInf, vSS, 704, -2944, 832, -2944, 128, fLt-kC, vSH, TEX_STARTAN3,r);
    Wall( fT, vInf, vSS, 832, -2944, 968, -2880, 150, fLt, vSH, TEX_STARTAN3,r);
    Wall( fT, vInf, vSS, 968, -2880, 1216, -2880, 248, fLt-kC, vSH, TEX_STARTAN3,r);
    Null( vSS, 1088, -3648, 1024, -3648 ,r);
    Null( vSS, 896, -3360, 896, -3104 ,r);
    Null( vSS, 928, -3072, 1184, -3072 ,r);
#ifdef CLOSE_START_SECTOR	
    Wall( fT, vInf, vSS, 704, -3552, 704, -2944, 3552-2944, fLt+kC, vSH, TEX_STARTAN3,r);
#else
    Wall( fT, vInf, vSS, 704, -3552, 704, -3360, 192, fLt+kC, vSH, TEX_STARTAN3,r);
    Wall( fT, vInf, vSS, 704, -3104, 704, -2944, 160, fLt+kC, vSH, TEX_STARTAN3,r);
    Null( vSS, 704, -3104, 704, -3360,r );
#endif
    Null( vSS, 1344, -2880, 1216, -2880,r );
    Wall( fT, vInf, vSS, 1344, -3360, 1344, -3392, 32, fLt+kC, vSH, TEX_STARTAN3,r);
    
	// Merge walls from Ultimate Doom secret
	Wall( fT, vInf, vSS, 1344, -3392, 1344, -3552, 3552 - 3392, fLt+kC, vSH, TEX_STARTAN3,r);
	//Wall( fT, vInf, vSS, 1344, -3520, 1344, -3552, 32, fLt+kC, vSH, TEX_STARTAN3);
    //Wall( fT, vInf, vSS, 1344, -3392, 1344, -3520, 128, fLt+kC, vSH, TEX_STARTAN3);
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLOOR4_8, TEX_CEIL3_5),r );
}

void Sector30( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    float fLt=(hash(floor(iTime * 10.0)) > 0.3) ? 0.565 : 1.0;
    const vec2 vSH=vec2(0.0, 72.0);

    BeginSector( vSS, vSH ,r);
    Wall( fT, vInf, vSS, 1088, -3680, 1024, -3680, 64, fLt-kC, vSH, TEX_DOOR3,r);
    Wall( fT, vInf, vSS, 1024, -3680, 1024, -3648, 32, fLt+kC, vSH, TEX_LITE3,r);
    Wall( fT, vInf, vSS, 1088, -3648, 1088, -3680, 32, fLt+kC, vSH, TEX_LITE3,r);
    Null( vSS, 1088, -3648, 1024, -3648 ,r);
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLOOR4_8, TEX_CEIL3_5) ,r);
}

void Sector31( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=0.502;
    const vec2 vSH=vec2(-8.0, 120.0);

    BeginSector( vSS, vSH , r);
    Open( fT, vInf, vSS, 704, -3104, 704, -3360, 256, fLt+kC, vSH, 0, 72, TEX_STEP6, TEX_STARTAN3 , r);
    Wall( fT, vInf, vSS, 512, -3328, 512, -3304, 24, fLt+kC, vSH, TEX_STARTAN3, r);
    Wall( fT, vInf, vSS, 512, -3160, 512, -3136, 24, fLt+kC, vSH, TEX_STARTAN3, r);
    Wall( fT, vInf, vSS, 512, -3136, 680, -3104, 171, fLt, vSH, TEX_STARTAN3, r);
    Wall( fT, vInf, vSS, 680, -3104, 704, -3104, 24, fLt-kC, vSH, TEX_SUPPORT2, r);
    Wall( fT, vInf, vSS, 704, -3360, 680, -3360, 24, fLt-kC, vSH, TEX_SUPPORT2, r);
    Wall( fT, vInf, vSS, 680, -3360, 512, -3328, 171, fLt, vSH, TEX_STARTAN3, r);
    Null( vSS, 496, -3160, 496, -3304 , r);
    Wall( fT, vInf, vSS, 512, -3304, 496, -3304, 16, fLt-kC, vSH, TEX_DOORTRAK, r);
    Wall( fT, vInf, vSS, 496, -3160, 512, -3160, 16, fLt-kC, vSH, TEX_DOORTRAK, r);
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLOOR4_8, TEX_CEIL3_5) , r);
}

void Sector32( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=0.502;
    const vec2 vSH=vec2(-8.0, 224.0);

    BeginSector( vSS, vSH , r);
    Upper( fT, vInf, vSS, 496, -3160, 496, -3304, 144, fLt+kC, vSH, 120, TEX_STARG3 , r);
    Wall( fT, vInf, vSS, 496, -3304, 496, -3328, 24, fLt+kC, vSH, TEX_STARG3, r);
    Wall( fT, vInf, vSS, 496, -3328, 448, -3456, 136, fLt, vSH, TEX_STARG3, r);
    Wall( fT, vInf, vSS, 448, -3456, 128, -3456, 320, fLt-kC, vSH, TEX_STARG3, r);
    Wall( fT, vInf, vSS, 128, -3008, 448, -3008, 320, fLt-kC, vSH, TEX_STARG3, r);
    Wall( fT, vInf, vSS, 496, -3136, 496, -3160, 24, fLt+kC, vSH, TEX_STARG3, r);
    Wall( fT, vInf, vSS, 448, -3008, 496, -3136, 136, fLt, vSH, TEX_STARG3, r);
    Lower( fT, vInf, vSS, 128, -3264, 160, -3264, 32, fLt-kC, vSH, 88, TEX_SLADWALL , r);
    Lower( fT, vInf, vSS, 160, -3264, 192, -3264, 32, fLt-kC, vSH, 72, TEX_SLADWALL , r);
    Lower( fT, vInf, vSS, 192, -3264, 224, -3264, 32, fLt-kC, vSH, 56, TEX_SLADWALL , r);
    Lower( fT, vInf, vSS, 224, -3264, 256, -3264, 32, fLt-kC, vSH, 40, TEX_SLADWALL , r);
    Lower( fT, vInf, vSS, 256, -3264, 288, -3264, 32, fLt-kC, vSH, 24, TEX_SLADWALL , r);
    Lower( fT, vInf, vSS, 288, -3264, 320, -3264, 32, fLt-kC, vSH, 8, TEX_SLADWALL , r);
    Lower( fT, vInf, vSS, 320, -3264, 320, -3200, 64, fLt+kC, vSH, 8, TEX_STEP6 , r);
    Lower( fT, vInf, vSS, 320, -3200, 288, -3200, 32, fLt-kC, vSH, 8, TEX_SLADWALL , r);
    Lower( fT, vInf, vSS, 288, -3200, 256, -3200, 32, fLt-kC, vSH, 24, TEX_SLADWALL , r);
    Lower( fT, vInf, vSS, 256, -3200, 224, -3200, 32, fLt-kC, vSH, 40, TEX_SLADWALL , r);
    Lower( fT, vInf, vSS, 224, -3200, 192, -3200, 32, fLt-kC, vSH, 56, TEX_SLADWALL , r);
    Lower( fT, vInf, vSS, 192, -3200, 160, -3200, 32, fLt-kC, vSH, 72, TEX_SLADWALL , r);
    Lower( fT, vInf, vSS, 160, -3200, 128, -3200, 32, fLt-kC, vSH, 88, TEX_SLADWALL , r);
    Open( fT, vInf, vSS, 128, -3200, 64, -3072, 143, fLt, vSH, 104, 192, TEX_STARG3, TEX_STARG3 , r);
    Wall( fT, vInf, vSS, 64, -3072, 128, -3008, 90, fLt, vSH, TEX_STARG3, r);
    Wall( fT, vInf, vSS, 128, -3456, 64, -3392, 90, fLt, vSH, TEX_STARG3, r);
    Open( fT, vInf, vSS, 64, -3392, 128, -3264, 143, fLt, vSH, 104, 192, TEX_STARG3, TEX_STARG3 , r);
    Open( fT, vInf, vSS, 256, -3136, 320, -3136, 64, fLt-kC, vSH, 40, 184, TEX_TEKWALL4, TEX_TEKWALL4 , r);
    Open( fT, vInf, vSS, 320, -3136, 320, -3072, 64, fLt+kC, vSH, 40, 184, TEX_TEKWALL4, TEX_TEKWALL4 , r);
    Open( fT, vInf, vSS, 320, -3072, 256, -3072, 64, fLt-kC, vSH, 40, 184, TEX_SW1COMP, TEX_TEKWALL4 , r);
    Open( fT, vInf, vSS, 256, -3072, 256, -3136, 64, fLt+kC, vSH, 40, 184, TEX_TEKWALL4, TEX_TEKWALL4 , r);
    Open( fT, vInf, vSS, 256, -3392, 320, -3392, 64, fLt-kC, vSH, 40, 184, TEX_TEKWALL4, TEX_TEKWALL4 , r);
    Open( fT, vInf, vSS, 320, -3392, 320, -3328, 64, fLt+kC, vSH, 40, 184, TEX_TEKWALL4, TEX_TEKWALL4 , r);
    Open( fT, vInf, vSS, 320, -3328, 256, -3328, 64, fLt-kC, vSH, 40, 184, TEX_TEKWALL4, TEX_TEKWALL4 , r);
    Open( fT, vInf, vSS, 256, -3328, 256, -3392, 64, fLt+kC, vSH, 40, 184, TEX_TEKWALL4, TEX_TEKWALL4 , r);
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLOOR4_8, TEX_FLOOR7_2) , r);
}

void Sector35( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=1.000;
    const vec2 vSH=vec2(40.0, 184.0);

    BeginSector( vSS, vSH, r );
    Null( vSS, 256, -3392, 320, -3392, r );
    Null( vSS, 320, -3392, 320, -3328, r );
    Null( vSS, 320, -3328, 256, -3328, r );
    Null( vSS, 256, -3328, 256, -3392, r );
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_STEP2, TEX_TLITE6_1), r );
}

void Sector36( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=1.000;
    const vec2 vSH=vec2(40.0, 184.0);

    BeginSector( vSS, vSH, r );
    Null( vSS, 256, -3136, 320, -3136, r );
    Null( vSS, 320, -3136, 320, -3072, r );
    Null( vSS, 320, -3072, 256, -3072, r );
    Null( vSS, 256, -3072, 256, -3136, r );
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_STEP2, TEX_TLITE6_1), r );
}

void Sector63( inout float fT, inout vec4 vInf, Ray r )
{
    vec4 vSS;
    const float fLt=1.000;
    const vec2 vSH=vec2(-56.0, 24.0);

    BeginSector( vSS, vSH, r );
    Wall( fT, vInf, vSS, 2736, -3648, 2488, -3744, 265, fLt, vSH, TEX_BROWN144, r);
    Wall( fT, vInf, vSS, 2488, -3744, 2240, -3776, 250, fLt, vSH, TEX_BROWN144, r);
    Null( vSS, 2736, -3648, 2240, -3648, r );
    Null( vSS, 2240, -3776, 2240, -3648, r );
    EndSector( fT, vInf, vSS, fLt, vec2(TEX_FLOOR7_1, TEX_F_SKY1), r );
}

void MapIntersect( out float fClosestT, out vec4 vHitInfo, Ray r )
{
    vHitInfo = vec4(0.0);
    fClosestT = 10000.0;

#ifdef ENABLE_NUKAGE_SECTORS
    Sector0( fClosestT, vHitInfo, r );
    Sector1( fClosestT, vHitInfo, r );
#endif
#ifdef ENABLE_START_SECTORS
    Sector3( fClosestT, vHitInfo, r );
    Sector5( fClosestT, vHitInfo, r );
#endif
#ifdef ENABLE_EXTRA_NUKAGE_SECTORS
    Sector11( fClosestT, vHitInfo, r );
    Sector12( fClosestT, vHitInfo, r );
#endif
#ifdef ENABLE_START_SECTORS
    Sector24( fClosestT, vHitInfo, r );
#endif
#ifdef ENABLE_MISC_SECTORS	
    Sector25( fClosestT, vHitInfo, r );
#endif
#ifdef ENABLE_START_SECTORS
	Sector27( fClosestT, vHitInfo, r );
    Sector28( fClosestT, vHitInfo, r );
    Sector29( fClosestT, vHitInfo, r );
    Sector30( fClosestT, vHitInfo, r );
#endif
#ifdef ENABLE_SECTOR_31
    Sector31( fClosestT, vHitInfo, r );
#endif
#ifdef ENABLE_MISC_SECTORS
    Sector32( fClosestT, vHitInfo, r );
    Sector35( fClosestT, vHitInfo, r );
    Sector36( fClosestT, vHitInfo, r );
#endif
#ifdef ENABLE_EXTRA_NUKAGE_SECTORS
    Sector63( fClosestT, vHitInfo, r );
#endif
}



// ----------------- 8< -------------------------- 8< -------------------------- 8< --------------
// End of generated code

//////////////////////////////////////////////////////////////
// Texture Helpers
//////////////////////////////////////////////////////////////

float hash(float p)
{
	vec2 p2 = fract(vec2(p * 5.3983, p * 5.4427));
    p2 += dot(p2.yx, p2.xy + vec2(21.5351, 14.3137));
	return fract(p2.x * p2.y * 95.4337);
}

float hash2D(vec2 p)
{
	return hash( dot( p, vec2(1.0, 41.0) ) );	
}

float noise1D( float p )
{
	float fl = floor(p);
	
	float h0 = hash( fl );
	float h1 = hash( fl + 1.0 );
	
	float fr = p - fl;
	float fr2 = fr * fr;
	float fr3 = fr2 * fr;
	
	float t1 = 3.0 * fr2 - 2.0 * fr3;	
	float t0 = 1.0 - t1;
	
	return h0 * t0
		 + h1 * t1;
}

float noise2D( vec2 p, float r )
{
	vec2 fl = floor(p);

	float h00 = hash2D( mod(fl + vec2(0.0, 0.0), r) );
	float h10 = hash2D( mod(fl + vec2(1.0, 0.0), r) );
	float h01 = hash2D( mod(fl + vec2(0.0, 1.0), r) );
	float h11 = hash2D( mod(fl + vec2(1.0, 1.0), r) );
	
	vec2 fr = p - fl;
	
	vec2 fr2 = fr * fr;
	vec2 fr3 = fr2 * fr;
	
	vec2 t1 = 3.0 * fr2 - 2.0 * fr3;	
	vec2 t0 = 1.0 - t1;
	
	return h00 * t0.x * t0.y
		 + h10 * t1.x * t0.y
		 + h01 * t0.x * t1.y
		 + h11 * t1.x * t1.y;
}

float fbm( vec2 p, float per )
{
	float val = 0.0;
	float tot = 0.0;
	float mag = 0.5;

	p += 0.5;
	p = p * (1.0 / 8.0);
	val += noise2D(p, 4.0) * mag; tot+=mag; p=p*2.0 + 1.234; mag*=per;	
	val += noise2D(p, 8.0) * mag; tot+=mag; p=p*2.0 + 2.456; mag*=per;
	val += noise2D(p, 16.0) * mag; tot+=mag; p=p*2.0 + 3.678; mag*=per;
	val += noise2D(p, 32.0) * mag; tot+=mag;

	return val * (1.0 / tot);
}

float Indent(vec2 vTexCoord, vec2 vHigh, vec2 vLow, float fHighIntensity, float fLowIntensity)
{
	vec2 vMin = min(vLow, vHigh);
	vec2 vMax = max(vLow, vHigh);
	if((vTexCoord.x < vMin.x) || (vTexCoord.x > vMax.x) || (vTexCoord.y < vMin.y) || (vTexCoord.y > vMax.y))
		return 1.0;

	if((vTexCoord.x == vHigh.x) || (vTexCoord.y == vHigh.y))
	{
		return fHighIntensity;
	}
	
	if((vTexCoord.x == vLow.x) || (vTexCoord.y == vLow.y))
	{
		return fLowIntensity;
	}
	
	return 1.0;
}

vec4 SmoothBump(const in vec2 vTexCoord, const in vec2 vMin, const in vec2 vMax, const in vec2 vLightDir, const in float fSize)
{
	vec2 vNearest = min( max(vTexCoord, vMin), vMax );
	vec2 vDelta = vNearest - vTexCoord;
    float fDeltaLen = length(vDelta);
	float fDist = (fDeltaLen - fSize) / fSize;
	vec2 vDir = vDelta;
    if(fDeltaLen > 0.0) vDir = vDir / fDeltaLen;
	float fShade = dot(vDir, vLightDir);
	//return clamp(1.0 - (fDist / fSize), 0.0, 1.0) * fShade;
	fShade *= clamp(1.0 - abs((fDist)), 0.0, 1.0);
	return vec4( fShade, fDist, (vTexCoord - vMin + fSize) / (vMax - vMin + fSize * 2.0) );
}


float wrap( const in float x , const in float r )
{
	return fract( x * (1.0 / r) ) * r;
}

vec4 Hexagon( vec2 vUV )
{
	vec2 vIndex;
	
	float fRow = floor(vUV.y);
	
	vec2 vLocalUV = vUV;
	float fRowEven = wrap(fRow, 2.0);
	if(fRowEven < 0.5)
	{
		vLocalUV.x += 0.5;
	}
	
	vIndex = floor(vLocalUV);
	
	vec2 vTileUV = fract(vLocalUV);
	{
		float m = 2.0 / 3.0;
		float c = 2.0 / 3.0;
		if((vTileUV.x *m + c) < vTileUV.y)
		{
			if(fRowEven < 0.5)
			{
				vIndex.x -= 1.0;
			}
			fRowEven = 1.0 - fRowEven;				
			vIndex.y += 1.0;
		}
	}
	
	{
		float m = -2.0 / 3.0;
		float c = 4.0 / 3.0;
		if((vTileUV.x *m + c) < vTileUV.y)
		{
			if(fRowEven >= 0.5)
			{
				vIndex.x += 1.0;
			}
			fRowEven = 1.0 - fRowEven;				
			vIndex.y += 1.0;
		}
	}
	
	vec2 vCenter = vIndex - vec2(0.0, -1.0 / 3.0);
	if(fRowEven > 0.5)
	{
		vCenter.x += 0.5;
	}
	
	vec2 vDelta = vUV - vCenter;
	
	//vDelta = abs(vDelta);
	
	float d1 = vDelta.x;
	float d2 = dot(vDelta, normalize(vec2(2.0/3.0, 1.0)));
	float d3 = dot(vDelta, normalize(vec2(-2.0/3.0, 1.0)));
	
	d2 *= 0.9;
	d3 *= 0.9;
	
	float fDist = max( abs(d1), abs(d2) );
	fDist = max( fDist, abs(d3) );
	
	float fTest = max(max(-d1, -d2), d3);
	
	return vec4(vIndex, abs(fDist), fTest);
}


//////////////////////////
// Textures
//////////////////////////

vec3 TexNukage3( vec2 vTexCoord, float fRandom)
{
	float fBlend = 0.0;
	fBlend = smoothstep(0.8, 0.0, fRandom);
	fBlend = min(fBlend, smoothstep(1.0, 0.8, fRandom));
	fBlend *= 1.5;
	vec3 col = mix( vec3(11.0, 23.0, 7.0), vec3(46.0, 83, 39.0), fBlend) / 255.0;
	
	return col;
}

void AddMountain( inout float fShade, const in vec2 vUV, const in float fRandom, const in float fHRandom, const in float fXPos, const in float fWidth, const in float fHeight, const in float fFog)
{
	float fYPos = 1.0 - smoothstep( 0.0, 1.0, abs(fract(fXPos - vUV.x + vUV.y * 0.05 + 0.5) - 0.5) * fWidth );
	fYPos += fHRandom * 0.05 + fRandom * 0.05;
	fYPos *= fHeight;
	float fDist = fYPos - vUV.y;
	if(fDist > 0.0)
	{
		fShade = fRandom * ((1.0 - clamp(sqrt(fDist) * 2.0, 0.0, 1.0)) * 0.3 + 0.1);
		fShade = mix(fShade, 0.6 + 0.1 * fRandom, fFog);
	}	
}

vec3 TexFSky1(vec2 vTexCoord, float fRandom, float fHRandom)
{
	float fShade = 0.6 + 0.1 * fRandom;
	
	vec2 vUV = vTexCoord * (1.0 / vec2(256.0, 128.0));
	vUV.y = 1.0 - vUV.y;
	
	AddMountain( fShade, vUV, fRandom, fHRandom, 0.25, 1.0, 0.85, 0.5 );
	AddMountain( fShade, vUV, fRandom, fHRandom, 1.5, 4.0, 0.78, 0.2 );
	AddMountain( fShade, vUV, fRandom, fHRandom, 1.94, 2.51, 0.8, 0.0 );

	
	return vec3(fShade);
}

vec3 TexFloor7_1( vec2 vTexCoord, float fRandom )
{
	vec3 col = mix( vec3(51.0, 43.0, 19.0), vec3(79.0, 59, 35.0), fRandom * fRandom * 2.5) / 255.0;
	
	return col;
}

vec3 TexFlat5_5( vec2 vTexCoord, float fRandom )
{
	vec3 col = mix( vec3(63.0, 47.0, 23.0), vec3(147.0, 123.0, 99.0), fRandom) / 255.0;
	
	col *= mod(vTexCoord.x, 2.0) * 0.15 + 0.85;
	
	return col;
}

vec3 TexFloor4_8( vec2 vTexCoord, float fRandom )
{
	vec3 col = mix( vec3(30.0, 30.0, 30.0), vec3(150.0, 150.0, 150.0), fRandom * fRandom) / 255.0;

	vec4 vHex = Hexagon( vTexCoord.yx / 32.0 );
    
    float fShadow = (clamp((0.5 - vHex.z) * 15.0, 0.0, 1.0) * 0.5 + 0.5);
    float fHighlight = 1.0 + clamp(1.0 - (abs(0.45 - vHex.w)) * 32.0, 0.0, 1.0) * 0.5;
    
	col = col * (clamp((0.5 - vHex.z) * 2.0, 0.0, 1.0) * 0.25 + 0.75);
    col = col * fHighlight;
	col = col * fShadow;
	
	return col;
}

vec3 TexCeil3_5( vec2 vTexCoord, float fRandom )
{
	vec3 col = vec3(1.0);
	
	vec2 vTileCoord = vTexCoord;
	vTileCoord.x -= 17.0;
	if( (vTileCoord.x >= 0.0) && (vTileCoord.x < 32.0) ) 
		vTileCoord.y -= 58.0;
	else 
		vTileCoord.y -= 11.0;
	vTileCoord.x = mod(vTileCoord.x, 32.0);
	vTileCoord.y = mod(vTileCoord.y, 64.0);
		
	vec2 vBoxClosest = clamp(vTileCoord, vec2(4.0, 4.0), vec2(28.0, 60.0));
	vec2 vDelta = vTileCoord - vBoxClosest;
	float fDist2 = dot(vDelta, vDelta);

	const float fLight1 = 59.0 / 255.0;
	const float fMed1 = 55.0 / 255.0;
	const float fDark1 = 47.0 / 255.0;
	const float fDark2 = 39.0 / 255.0;

	float fShade = fMed1;	
	fShade = mix( fShade, fLight1, smoothstep(0.6, 0.45, fRandom) );
	fShade = mix( fShade, fDark1, smoothstep(0.45, 0.35, fRandom) );
	
	fShade = mix( fShade, fDark1, step(1.5, fDist2) );
	fShade = mix( fShade, fDark2, step(13.5, fDist2) );
		
	col *= fShade;
	
	if((vTileCoord.x < 12.0) || (vTileCoord.x > 20.0) || (vTileCoord.y < 12.0) || (vTileCoord.y > 52.0))
	{
		float fRRow = floor(mod(vTileCoord.y - 3.5, 7.5));
		float fRColumn = mod(vTileCoord.x - 15.0, 10.0);
		if((fRRow == 2.0) && (fRColumn == 0.0))
		{
			col -= 0.05;
		}
		if((fRRow <= 2.0) && (fRColumn <= 2.0))
		{
			vec2 vOffset = vec2(fRRow - 1.0, fRColumn - 1.0);
			float fDist2 = dot(vOffset, vOffset) / 2.0;
			col += clamp(1.0 - fDist2, 0.0, 1.0) * 0.05;
		}
	}
	
	return col;
}

vec3 TexFlat14( vec2 vTexCoord, float fRandom )
{
	return mix( vec3(0.0, 0.0, 35.0 / 255.0), vec3(0.0, 0.0, 200.0 / 255.0), fRandom * fRandom);
}

vec3 TexDoor3(vec2 vTexCoord, float fRandom, float fHRandom)
{
	float fVNoise = fHRandom + fRandom;
	float fStreak = clamp(abs(fract(fVNoise) - 0.5) * 3.0, 0.0, 1.0);
	fStreak = fStreak * fStreak;
	
	float fShade = 1.0;
	
	fShade = 1.0 - abs((vTexCoord.y / 72.0) - 0.5) * 2.0;
	fShade = fShade * fShade;
	fShade = fShade * 0.2 + 0.3;
	
	fShade = fShade * (fHRandom * 0.2 + 0.8);
	
	fShade *= Indent( vTexCoord, vec2(8.0, 8.0), vec2(64.0 - 8.0, 72.0 - 16.0), 0.8, 1.2);
	fShade *= Indent( vTexCoord, vec2(8.0, 72.0 - 15.0), vec2(64.0 - 8.0, 72.0 - 8.0), 0.8, 1.2);
	
	fShade *= Indent( vTexCoord, vec2(64.0 - 11.0, 46.0), vec2(46.0, 32.0), 0.8, 1.2);
	fShade *= Indent( vTexCoord, vec2(64.0 - 11.0, 56.0), vec2(46.0, 52.0), 0.8, 1.2);
	
	fShade += fRandom * 0.1;

	float fStreakTopAmount = smoothstep( 32.0, 0.0, vTexCoord.y );
	float fStreakBottomAmount = smoothstep( 72.0 -32.0, 72.0, vTexCoord.y );
	
	fShade *= 1.0 - fStreak * max(fStreakTopAmount, fStreakBottomAmount) * 0.2;
	
	if( (vTexCoord.x > 8.0) && (vTexCoord.x < 52.0) )
	{
		vec2 vRepeatCoord = mod( vTexCoord, vec2( 8.0, 48.0 ) );
		vRepeatCoord += vec2(4.0, -12.0);
		if( vRepeatCoord.x == 4.0 )
		{
			if(vRepeatCoord.y == 0.0)
			{
				fShade += 0.1;
			}
			if(vRepeatCoord.y > 0.0)
			{
				fShade *= clamp(vRepeatCoord.y / 16.0, 0.0, 1.0) * 0.3 + 0.7;
			}
		}
	}
	
	return vec3(fShade);
}

vec3 TexLite3( vec2 vTexCoord )
{
	vec2 vLocalCoord = vTexCoord;
	vLocalCoord.y = mod(vLocalCoord.y, 8.0 );
	
	vec2 vClosest = min( max( vLocalCoord, vec2(4.0, 3.5) ), vec2(32.0 - 5.0, 3.5) );
	vec2 vDelta = vLocalCoord - vClosest;
	float fDist = max(abs(vDelta.x), abs(vDelta.y)) / 3.9;
	
	return vec3(1.0 - fDist * 0.65);
}

vec3 TexStartan3( vec2 vTexCoord, float fRandom )
{
	vec3 col = vec3(0.6);
	
	float fVNoise = noise1D(vTexCoord.x * 0.5) - ((vTexCoord.y) / 128.0) + fRandom;
	float fStreak = clamp(abs(fract(fVNoise) - 0.5) * 3.0, 0.0, 1.0);
	fStreak = fStreak * fStreak;
		
	float fBlend2 = smoothstep( 0.0, 32.0, abs(vTexCoord.x - 64.0) );
	fBlend2 *= fBlend2;
	fBlend2 *= fStreak * 0.5 + 0.5;
	col = mix( col, vec3(119.0, 79.0, 43.0) / 255.0, fBlend2 * 0.5);
	
	float fBlend = smoothstep( 24.0, 56.0, abs(vTexCoord.x - 64.0) );
	fBlend *= fBlend;
	fBlend *= fStreak * 0.7 + 0.3;
	col = mix( col, vec3(119.0, 79.0, 43.0) * 1.1 / 255.0, fBlend);
	
	col *= fRandom * fRandom * 0.3 + 0.7;

	vec2 vCoord = vTexCoord;
	vCoord.x = mod(vCoord.x, 32.0);
	
	float fStreakHL = fStreak * 0.075 + 0.075;
	
	float fDistMin = 1.0;
	float fShade = 0.0;
	
	vec4 vBump = SmoothBump( vCoord, vec2(6.0, 8.0), vec2(32.0 - 5.0, 9.0), normalize(vec2(0.0, 1.0)), 3.0 );
	fShade += vBump.x * 0.1;
	fDistMin = min(fDistMin, vBump.y);
	fShade += ((vBump.w >= 0.0) && (vBump.w <= 1.0)) ? (1.0 - vBump.w) * fStreakHL : 0.0;
	vBump = SmoothBump( vCoord, vec2(6.0, 20.0), vec2(32.0 - 6.0, 40.0), normalize(vec2(0.0, 1.0)), 3.0 ); 
	fShade += vBump.x * 0.1;
	fShade += ((vBump.w >= 0.0) && (vBump.w <= 1.0)) ? (1.0 - vBump.w) * fStreakHL : 0.0;
	fDistMin = min(fDistMin, vBump.y);

	vBump = SmoothBump( vCoord, vec2(6.0, 64.0), vec2(32.0 - 6.0, 65.0), normalize(vec2(0.0, 1.0)), 3.0 );
	fShade += vBump.x * 0.1;
	fShade += ((vBump.w >= 0.0) && (vBump.w <= 1.0)) ? (1.0 - vBump.w) * fStreakHL : 0.0;
	fDistMin = min(fDistMin, vBump.y);
	vBump = SmoothBump( vCoord, vec2(6.0, 76.0), vec2(32.0 - 6.0, 110.0), normalize(vec2(0.0, 1.0)), 3.0 ) ;
	fShade += vBump.x * 0.1;
	fShade += ((vBump.w >= 0.0) && (vBump.w <= 1.0)) ? (1.0 - vBump.w) * fStreakHL : 0.0;
	fDistMin = min(fDistMin, vBump.y);

	vBump = SmoothBump( vTexCoord, vec2(-16.0, 50.0), vec2(256.0, 52.0), normalize(vec2(0.0, 1.0)), 3.0 );
	fShade += vBump.x * 0.1;
	fShade += ((vBump.w >= 0.0) && (vBump.w <= 1.0)) ? (1.0 - vBump.w) * fStreakHL : 0.0;
	fDistMin = min(fDistMin, vBump.y);
	vBump = SmoothBump( vTexCoord, vec2(-16.0, 122.0), vec2(256.0, 200.0), normalize(vec2(0.0, 1.0)), 3.0 );
	fShade += vBump.x * 0.05;
	fDistMin = min(fDistMin, vBump.y);

	col *= 1.0 + fShade * 3.0;

	col *= clamp((1.0 - fDistMin) * 1.0, 0.0, 1.0) * 0.3 + 0.7;

	return col;
}

vec3 TexBrown1( vec2 vTexCoord, float fRandom, float fHRandom )
{
	vec3 col = mix( vec3(119.0, 95.0, 63.0), vec3(147.0, 123.0, 99.0), fRandom * fRandom) / 255.0;

	if(vTexCoord.x >= 64.0)
	{
		col = col * vec3(1.0, 0.848, 0.646);
		
		col = mix( col, vec3( 0.111, 0.414, 0.3), clamp((fRandom -0.5) * 2.0, 0.0, 1.0)); // green bits
	}
	
	float fVNoise = fHRandom + fRandom;
	
	float fStreak = clamp(abs(fract(fVNoise) - 0.5) * 3.0, 0.0, 1.0);
	fStreak = fStreak * fStreak;

	vec2 vRepeatCoord = vTexCoord;
	vRepeatCoord.x = mod(vRepeatCoord.x, 13.0);
	
	vec4 vBump = SmoothBump( vRepeatCoord, vec2( 5.0, 6.0 ), vec2( 5.0, 12.0), vec2(0.0, 1.0), 1.5);
	float fMask = clamp(1.0 - vBump.y, 0.0, 1.0);
	
	float fStreakAmount = 1.0;
	fStreakAmount *= smoothstep( 0.0, 8.0, vRepeatCoord.y );
	float fStreakWidth = smoothstep( 64.0, 12.0, vRepeatCoord.y );
	float fBase1Dist = smoothstep( 24.0, 75.0, vRepeatCoord.y ) * step(vRepeatCoord.y, 75.0);
	float fBase2Dist = smoothstep( 96.0, 127.0, vRepeatCoord.y );// * step(75.0, vRepeatCoord.y);
	float fBaseDist = max(fBase1Dist, fBase2Dist);
	fStreakWidth = max( fStreakWidth, fBaseDist);
	float fTop2Dist = smoothstep( 127.0, 75.0, vRepeatCoord.y ) * step(75.0, vRepeatCoord.y);
	fStreakWidth = max(fStreakWidth, fTop2Dist);
	float fStreakX = abs(vRepeatCoord.x - 5.0) / 8.0;
	fStreakAmount *= fStreakWidth;
	fStreakAmount *= smoothstep( fStreakWidth, 0.0, fStreakX);
	fStreakAmount = max(fStreakAmount, (fBaseDist - 0.75) * 4.0);
	fStreakAmount *= 1.0 - fMask; 
	col = mix(col, vec3(0.3, 0.2, 0.1), fStreakAmount * (fStreak * 0.5 + 0.5) );
	
	col += ((vBump.w >= 0.0) && (vBump.w <= 1.0)) ? (vBump.w) * (1.0-vBump.y) * 0.05 : 0.0;
	
	if((vTexCoord.y == 17.0) || (vTexCoord.y == 73.0)) col *= 0.9;
	if((vTexCoord.y == 19.0) || (vTexCoord.y == 75.0)) col *= 1.2;

	col *= 1.0 + clamp(vBump.x, -1.0, 0.0) * 0.6;
		
	return col;
}

vec3 TexDoorstop( vec2 vTexCoord, float fRandom )
{
	float fShade = 1.0 - abs(vTexCoord.x - 3.4) / 4.0;
	
	fShade = fShade * 0.2 + 0.2;
	
	float fSin = sin((vTexCoord.y - 16.0) * 3.14150 * 4.0 / 128.0) * 0.5 + 0.5;
	fShade *= 0.8 + fRandom * 1.2 * fSin;
	
	return vec3(fShade);
}

void DrawScreen(inout vec3 col, const in vec2 vTexCoord, const in vec2 vPos, const in vec2 vSize, const in vec3 vCol)
{
	vec2 vScreenCoord = vTexCoord - vPos;
	col *= Indent( vScreenCoord, vSize, vec2(-1.0), 1.2, 0.5);

	if((vScreenCoord.x >= 0.0) && (vScreenCoord.y >= 0.0) && (vScreenCoord.x < vSize.x) && (vScreenCoord.y < vSize.y))
	{
		col = vCol;
	}
}

vec3 TexCompute2( vec2 vTexCoord, float fRandom )
{
    fRandom = 1.0 - fRandom * fRandom;
	vec3 col = vec3(35.0 / 255.0);
	
	col *= Indent( vTexCoord, vec2( -8.0, 0.0), vec2(300.0, 10.0), 1.3, 0.5);
	col *= Indent( vTexCoord, vec2( -8.0, 11.0), vec2(300.0, 27.0), 1.3, 0.5);
	col *= Indent( vTexCoord, vec2( -8.0, 28.0), vec2(300.0, 43.0), 1.3, 0.5);
	{
		vec2 vLocalCoord = vTexCoord;
		vLocalCoord.x = mod(vLocalCoord.x, 21.0);
		col *= Indent( vLocalCoord, vec2( 0.0, 44.0), vec2(20.0, 55.0), 1.3, 0.5);
	}

	if(vTexCoord.y < 40.0)
	{
		vec2 vTileSize = vec2(48.0, 14.0);
		vec2 vIndex = floor(vTexCoord / vTileSize);

		float fIndex = vIndex.x + vIndex.y * 13.0;
		vec2 vMin = vIndex * vTileSize + vec2(hash(fIndex) * 32.0, 4.0);
		vec2 vSize = vec2(8.0 + hash(fIndex + 1.0) * 32.0, 4.0);

		vec3 vCol = vec3(0.0);
		float iIndex = floor(mod(fIndex, 5.0));
		if( iIndex < 0.5 ) 
		{
			vCol = mix(vec3(0.0, 0.5, 0.0), vec3(0.0, 0.25, 0.0), fRandom);
		}
		else if(iIndex < 1.5)
		{
			vCol = mix(vec3(1.0, 0.6, 0.02), vec3(0.1), fRandom);
		}
		else if(iIndex < 2.5)
		{
			vCol = vec3(fRandom * 0.5);
		}
		else if(iIndex < 3.5)
		{
			vCol = vec3(fRandom * 0.25);
		}
		else if(iIndex < 4.5)
		{
			vCol = mix(vec3(0.0, 0.0, 0.5), vec3(0.1), fRandom);
		}
		DrawScreen(col, vTexCoord, vMin, vSize, vCol);
	}

	return col;
}

vec3 TexStep6( vec2 vTexCoord, float fRandom, float fHRandom )
{
	vec3 col = mix( vec3(87.0, 67.0, 51.0), vec3(119.0, 95.0, 75.0), fRandom) / 255.0;

	col *= Indent( vTexCoord, vec2(-1.0, 3.0), vec2(32.0, 1.0), 1.3, 0.7);
	col *= Indent( vTexCoord, vec2(-1.0, 8.0), vec2(32.0, 0.0), 1.3, 0.9);

	float fStreak = clamp((vTexCoord.y / 16.0) * 1.5 - fHRandom, 0.0, 1.0);

	col *= fStreak * 0.3 + 0.7;
	
	return col;
}

vec3 TexSupport2( vec2 vTexCoord, float fRandom )
{
	vec3 col;
	float fShade = 0.5;
	
	float f1 = abs(fract((vTexCoord.y + 32.0) / 70.0) - 0.5) * 2.0;
	float f2 = abs(fract((vTexCoord.x + 16.0) / 16.0) - 0.5) * 2.0;
	fShade += f1 * 0.75 + f2 * 0.25;
	fShade = fShade * fShade;

	fShade = fShade * 0.2 + 0.05;
	fShade *= 1.0 + fRandom * 0.4;

	vec2 vLocalCoord = vTexCoord;
	if((vLocalCoord.y < 64.0) || (vLocalCoord.y > 75.0))
	{
		if(vLocalCoord.y > 64.0) vLocalCoord.y -= 8.0;
		vLocalCoord = mod( vLocalCoord, vec2(20.0, 16.0));
		float fIndent = Indent( vLocalCoord, vec2(8.0, 8.0), vec2(16.0, 15.0), 0.9, 1.1);
		fShade += fIndent - 1.0;
	}
	
	col = vec3(fShade);
	
	return col;
}

vec3 TexDoorTrak( vec2 vTexCoord, float fRandom )
{
	float fShade = fRandom * 0.5;
	fShade *= mod(vTexCoord.x, 2.0) * 0.6 + 0.4;
	return vec3(fShade);
}

vec3 TexBrown144( vec2 vTexCoord, float fRandom, float fHRandom )
{
	vec3 col = mix( vec3(39.0, 39.0, 39.0), vec3(51.0, 43.0, 19.0), fRandom) / 255.0;
	
	float fBlend = fHRandom - 0.1;
	fBlend = clamp(fBlend, 0.0, 1.0);
	col = mix( col, col * 2.0 * vec3(0.893, 0.725, 0.161), fBlend);
	return col;
}

#ifdef ENABLE_SPRITES

vec3 TexBar1A( vec2 vTexCoord, float fRandom, float fHRandom )
{
	vec3 col = vec3(123.0, 127.0, 99.0) / 255.0;
	
	float fBrownStreakBlend = smoothstep( 2.0, 1.0, abs(vTexCoord.x - 3.5));
	col = mix(col, vec3(0.724, 0.736, 0.438), fBrownStreakBlend);
	
	if( (vTexCoord.y == 1.0) && (vTexCoord.x > 3.0) && (vTexCoord.x < 18.0) )
	{
		col = col * clamp(((vTexCoord.x / 18.0)), 0.0, 1.0);		
	}
	else
	{
		col = col * clamp((1.0 - (vTexCoord.x / 18.0)), 0.0, 1.0);		
	}
	
	float fNukageBlend = 0.0;
	if( (vTexCoord.y == 1.0) && (vTexCoord.x > 8.0) && (vTexCoord.x < 14.0) )
	{
		fNukageBlend = 1.0;
	}	
	if( (vTexCoord.y == 2.0) && (vTexCoord.x > 2.0) && (vTexCoord.x < 20.0) )
	{
		fNukageBlend = 1.0;
	}	
	col = mix(col, vec3(0.172, 0.560, 0.144) * fRandom, fNukageBlend);
	
	
	if(vTexCoord.x < 1.0)
	{
		col += 0.1;
	}
	
	float fBlend = clamp(((vTexCoord.x - 20.0) / 3.0), 0.0, 1.0);
	col += fBlend * 0.2;
	
	float fBumpY = 8.0;
	if(vTexCoord.y > 14.0) fBumpY += 9.0;
	if(vTexCoord.y > 23.0) fBumpY += 8.0;

	vec4 vBump = SmoothBump( vTexCoord, vec2(2.0, fBumpY), vec2(23.0 - 2.0, fBumpY), normalize(vec2(-0.2, 1.0)), 1.25 );	
	col += vBump.x * 0.2;

	// rim highlights
	{
		vec2 vOffset = (vTexCoord - vec2(17.0, 0.0)) / vec2(8.0, 2.0);
		col += clamp(1.0 - dot(vOffset, vOffset), 0.0, 1.0) * 0.2;
	}	
	{
		vec2 vOffset = (vTexCoord - vec2(20.0, 1.0)) / vec2(4.0, 1.0);
		col += clamp(1.0 - dot(vOffset, vOffset), 0.0, 1.0) * 0.2;
	}	
	{
		vec2 vOffset = (vTexCoord - vec2(3.0, 2.0)) / vec2(4.0, 2.0);
		col += clamp(1.0 - dot(vOffset, vOffset), 0.0, 1.0) * 0.2;
	}	
	
	col *= 0.5 + fRandom * 0.5;
	
	return col;
}

vec3 TexPlayW( vec2 vTexCoord, float fRandom, float fHRandom )
{
    vec3 col = mix(vec3(190.0, 10.0, 10.0), vec3(50, 16.0, 16.0 ), fRandom * vTexCoord.y/18.0) / 255.0;
	return col;
}

#endif 

vec3 SampleTexture( const in float fTexture, const in vec2 _vUV )
{
    vec3 col = vec3(1.0, 0.0, 1.0);
    vec2 vUV = _vUV;
    
    vec2 vSize = vec2(64.0);
    float fPersistence = 0.8;
	float fNoise2Freq = 0.5;

	if(fTexture == TEX_NUKAGE3)
	{
        float fTest = fract(floor(iTime * 6.0) * (1.0 / 3.0));
        if( fTest < 0.3 )
        {
	        vUV += 0.3 * vSize;
        }
        else if(fTest < 0.6)
        {
            vUV = vUV.yx - 0.3; 
        }
        else
        {
            vUV = vUV + 0.45;
        }
	}
	
	     if(fTexture == TEX_NUKAGE3) { fPersistence = 1.0; }
	else if(fTexture == TEX_F_SKY1) { vSize = vec2(256.0, 128.0); fNoise2Freq = 0.3; }
    else if(fTexture == TEX_FLOOR7_1) { vSize = vec2(64.0, 32.0); fPersistence = 1.0; }	
    else if(fTexture == TEX_FLAT5_5) { fPersistence = 3.0; }
    else if(fTexture == TEX_FLOOR4_8) { fPersistence = 0.3; }
    else if(fTexture == TEX_CEIL3_5) { fPersistence = 0.9; }	
    else if(fTexture == TEX_FLAT14) { fPersistence = 2.0; }
    else if(fTexture == TEX_DOOR3) { vSize = vec2(64.0, 72.0); }	
    else if(fTexture == TEX_LITE3) { vSize = vec2(32.0, 128.0); }	
    else if(fTexture == TEX_STARTAN3) { vSize = vec2(128.0); fPersistence = 1.0; }	
	else if(fTexture == TEX_BROWN1) { vSize = vec2(128.0); fPersistence = 0.7; }	
    else if(fTexture == TEX_DOORSTOP) { vSize = vec2(8.0, 128.0); fPersistence = 0.7; }
    else if(fTexture == TEX_COMPUTE2) { vSize = vec2(256.0, 56.0); fPersistence = 1.5; }
    else if(fTexture == TEX_STEP6) { vSize = vec2(32.0, 16.0); fPersistence = 0.9; }
    else if(fTexture == TEX_SUPPORT2) { vSize = vec2(64.0, 128.0); }
    else if(fTexture == TEX_DOORTRAK) { vSize = vec2(8.0, 128.0); }
#ifdef ENABLE_SPRITES	
	else if(fTexture == TEX_BAR1A) { vSize = vec2(23.0, 32.0); }
	else if(fTexture == TEX_PLAYW) { vSize = vec2(57.0, 22.0); fPersistence = 1.0; }
#endif
	
#ifdef PREVIEW
	     if(fTexture == TEX_DOOR3) {	vSize = vec2(128.0, 128.0); }	
	else if(fTexture == TEX_COMPUTE2) { vSize = vec2(256.0, 64.0); }
#ifdef ENABLE_SPRITES	
	else if(fTexture == TEX_BAR1A) { vSize = vec2(32.0, 32.0); }
	else if(fTexture == TEX_PLAYW) { vSize = vec2(64.0, 32.0); }	
#endif
#endif
	
	
#ifdef PREVIEW
    vec2 vTexCoord = floor(fract(vUV) * vSize);
#else
    vec2 vTexCoord = fract(vUV / vSize) * vSize;
    #ifdef PIXELATE_TEXTURES
    vTexCoord = floor(vTexCoord);
    #endif
    vTexCoord.y = vSize.y - vTexCoord.y - 1.0;
#endif
	float fRandom = fbm( vTexCoord, fPersistence );
	float fHRandom = noise1D(vTexCoord.x * fNoise2Freq) - ((vTexCoord.y) / vSize.y);
    
	     if(fTexture == TEX_NUKAGE3) 	col = TexNukage3( vTexCoord, fRandom );
	else if(fTexture == TEX_F_SKY1) 	col = TexFSky1( vTexCoord, fRandom, fHRandom );
    else if(fTexture == TEX_FLOOR7_1) 	col = TexFloor7_1( vTexCoord, fRandom );
    else if(fTexture == TEX_FLAT5_5) 	col = TexFlat5_5( vTexCoord, fRandom );
    else if(fTexture == TEX_FLOOR4_8) 	col = TexFloor4_8( vTexCoord, fRandom );
    else if(fTexture == TEX_CEIL3_5) 	col = TexCeil3_5( vTexCoord, fRandom );
	else if(fTexture == TEX_FLAT14) 	col = TexFlat14( vTexCoord, fRandom );
	else if(fTexture == TEX_DOOR3) 		col = TexDoor3( vTexCoord, fRandom, fHRandom );
	else if(fTexture == TEX_LITE3) 		col = TexLite3( vTexCoord );
    else if(fTexture == TEX_STARTAN3) 	col = TexStartan3( vTexCoord, fRandom );
    else if(fTexture == TEX_BROWN1) 	col = TexBrown1( vTexCoord, fRandom, fHRandom );
    else if(fTexture == TEX_DOORSTOP) 	col = TexDoorstop( vTexCoord, fRandom );
    else if(fTexture == TEX_COMPUTE2) 	col = TexCompute2( vTexCoord, fRandom );
    else if(fTexture == TEX_STEP6) 		col = TexStep6( vTexCoord, fRandom, fHRandom );
    else if(fTexture == TEX_SUPPORT2) 	col = TexSupport2( vTexCoord, fRandom );
	else if(fTexture == TEX_DOORTRAK) 	col = TexDoorTrak( vTexCoord, fRandom );
	else if(fTexture == TEX_BROWN144) 	col = TexBrown144( vTexCoord, fRandom, fHRandom );
#ifdef ENABLE_SPRITES	
	else if(fTexture == TEX_BAR1A) 		col = TexBar1A( vTexCoord, fRandom, fHRandom );
	else if(fTexture == TEX_PLAYW) 		col = TexPlayW( vTexCoord, fRandom, fHRandom );	
#endif
	
    #ifdef QUANTIZE_TEXTURES
    col = Quantize(col);
    #endif

    return col;
}

void mainVR( out vec4 fragColor, in vec2 fragCoord, in vec3 fragRayOri, in vec3 fragRayDir )
{
	const vec2 vStart = vec2(1050, -3616);
    
    fragRayOri.z *= -1.0;
    fragRayDir.z *= -1.0;
    
    fragRayOri *= 48.0;
    
    vec3 vCameraPos;
    vec3 vCameraTarget;
	DemoCamera( iTime * 0.25, vCameraPos, vCameraTarget );
    
    if ( false )
    {
    	fragRayOri += vCameraPos;
    }
    else
    {
    	fragRayOri.xz += vStart;
    	fragRayOri.y += 48.0;        
    }
    
    Ray r;
    r.vRayOrigin = fragRayOri;
    r.vRayDir = fragRayDir;
    
    vec3 vForwards = fragRayDir; 
    
	vec3 vResult = DrawScene(vForwards, fragCoord / iResolution.xy,r);
    
    fragColor = vec4( vResult, 1.0 );
}