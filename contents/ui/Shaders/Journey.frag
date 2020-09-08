// From https://www.shadertoy.com/view/ldlcRf
// Credits to Shakemayster
/*
	Before you continue reading, feast your eyes on these beautiful Color Schemes (0,1,2)
*/

// Modify the number to 0,1,2 or 3 and press play button at bottom for different schemes.
// TODO: make this modifiable from GUI - @y4my4my4m
#define COLOR_SCHEME 0

/*
	This shader is just a tribute to 'Journey' game by That Game Company. Some answers:
	1) No, I do not have any affiliation with That Game Company.
	2) Yes, Journey is one of the best games ever made
	3) It has taken me around 3-4 months from start to finish, evenings and weekends
	4) Most of the time was spent getting the details right
	5) Yes, the character needs more work. One day I will finish it
	6) Yes, if anybody comes up with something cool to add, I would love to improve :)
	7) There is nothing mathemagically amazing in this shader. I hope you do find it pretty though!
	8) Yes, the code is fairly ugly. But look at the colors - PRETTY!
	9) If you have any other questions, I will be happy to answer

	This shader started as a learning playground, but around January, I finished my second round of Journey
	and thought, well why the hell not, and so here we are.

	Special thanks to Thibault Girard and Jack Hamilton for their artistic input. Also bigs up to Peter Pimley
	for his constant optimism.

	You are hereby granted your wish to follow me on twitter: @shakemayster

	Other authors (With BIG thanks !!!)
	Dave_Hoskins
	Dila
	Maurogik
	FabriceNeyret2
*/

#define RGB vec3
#define mul(a,b) b*a
#define saturate(a) clamp( a, 0.0, 1.0 )


#if COLOR_SCHEME == 0
const float _FogMul = -0.00100 ;
const float _FogPow = 1.82000 ;
const float _IncorrectGammaCorrect = 1.00000 ;
const vec3 _LightDir = vec3(-0.22632, 0.88099, -0.4155) ;
const float _Brightness = 1.00000 ;
const float _Contrast = 1.00000 ;
const float _Saturation = 1.00000 ;
const vec3 _SunStar = vec3(14.7, 1.47, 0.1) ;
const float _SunSize = 26.00000 ;
const float _SunScale = 15.00000 ;
const float _ExposureOffset = 11.10000 ;
const float _ExposurePower = 0.52000 ;
const float _ExposureStrength = 0.09000 ;
const RGB _SunColor = RGB(1, 0.73741, 0.63971) ;
const RGB _Zenith = RGB(0.67128, 0.94118, 0.69204) ;
const float _ZenithFallOff = 1.42000 ;
const RGB _Nadir = RGB(0, 0, 0) ;
const float _NadirFallOff = 1.91000 ;
const RGB _Horizon = RGB(0.80147, 0.80147, 0.80147) ;
const vec3 _CharacterAOParams = vec3(0.03, 7.36, 0) ;
const RGB _CharacterMainColor = RGB(0.57353, 0.1488, 0.067474) ;
const RGB _CharacterTerrainCol = RGB(0.375, 0.21885, 0.15993) ;
const RGB _CharacterCloakDarkColor = RGB(0.38971, 0.10735, 0.054444) ;
const RGB _CharacterYellowColor = RGB(0.64706, 0.35588, 0) ;
const RGB _CharacterWhiteColor = RGB(1, 1, 1) ;
const float _CharacterBloomScale = 0.87000 ;
const float _CharacterDiffScale = 1.50000 ;
const float _CharacterFreScale = 1.77000 ;
const float _CharacterFrePower = 3.84000 ;
const float _CharacterFogScale = 20.00000 ;
const float _CloudTransparencyMul = 0.90000 ;
const RGB _CloudCol = RGB(1, 0.96957, 0.88235) ;
const RGB _BackCloudCol = RGB(0.66176, 0.64807, 0.62284) ;
const RGB _CloudSpecCol = RGB(0.17647, 0.062284, 0.062284) ;
const RGB _BackCloudSpecCol = RGB(0.11029, 0.05193, 0.020275) ;
const float _CloudFogStrength = 0.50000 ;
const RGB _TombMainColor = RGB(0.47735, 0.59559, 0.49705) ;
const RGB _TombScarfColor = RGB(0.45588, 0.093858, 0.093858) ;
const RGB _PyramidCol = RGB(0.30147, 0.28329, 0.21059) ;
const vec2 _PyramidHeightFog = vec2(38.66, 1.05) ;
const RGB _TerrainCol = RGB(0.76863, 0.55294, 0.47059) ;
const RGB _TerrainSpecColor = RGB(0.32353, 0.32123, 0.31877) ;
const float _TerrainSpecPower = 55.35000 ;
const float _TerrainSpecStrength = 1.56000 ;
const float _TerrainGlitterRep = 7.00000 ;
const float _TerrainGlitterPower = 1.94000 ;
const RGB _TerrainRimColor = RGB(0, 0, 0) ;
const float _TerrainRimPower = 5.59000 ;
const float _TerrainRimStrength = 2.00000 ;
const float _TerrainRimSpecPower = 1.46000 ;
const float _TerrainFogPower = 2.11000 ;
const vec4 _TerrainShadowParams = vec4(0.12, 5.2, 88.7, 0.28) ;
const vec3 _TerrainAOParams = vec3(0.01, 0.02, 2) ;
const RGB _TerrainShadowColor = RGB(0.40441, 0.34106, 0.31818) ;
const RGB _TerrainDistanceShadowColor = RGB(1, 0.81471, 0.74265) ;
const float _TerrainDistanceShadowPower = 0.11000 ;
const RGB _FlyingHelperMainColor = RGB(0.80882, 0.11671, 0.017842) ;
const RGB _FlyingHelperCloakDarkColor = RGB(1, 0.090909, 0) ;
const RGB _FlyingHelperYellowColor = RGB(1, 0.56187, 0.0073529) ;
const RGB _FlyingHelperWhiteColor = RGB(1, 1, 1) ;
const float _FlyingHelperBloomScale = 1.91000 ;
const float _FlyingHelperFrePower = 1.00000 ;
const float _FlyingHelperFreScale = 0.85000 ;
const float _FlyingHelperFogScale = 4.00000 ;
#endif

#if COLOR_SCHEME == 1
const float _FogMul = -0.00800 ;
const float _FogPow = 1.00000 ;
const float _IncorrectGammaCorrect = 1.00000 ;
const vec3 _LightDir = vec3(-0.23047, 0.87328, -0.42927) ;
const float _Brightness = 0.40000 ;
const float _Contrast = 0.83000 ;
const float _Saturation = 1.21000 ;
const vec3 _SunStar = vec3(14.7, 1.47, 0.1) ;
const float _SunSize = 26.00000 ;
const float _SunScale = 15.00000 ;
const float _ExposureOffset = 11.10000 ;
const float _ExposurePower = 0.52000 ;
const float _ExposureStrength = 0.09000 ;
const RGB _SunColor = RGB(1, 0.95441, 0.77206) ;
const RGB _Zenith = RGB(0.77941, 0.5898, 0.41263) ;
const float _ZenithFallOff = 2.36000 ;
const RGB _Nadir = RGB(1, 0.93103, 0) ;
const float _NadirFallOff = 1.91000 ;
const RGB _Horizon = RGB(0.96324, 0.80163, 0.38954) ;
const vec3 _CharacterAOParams = vec3(0.03, 7.36, 0) ;
const RGB _CharacterMainColor = RGB(0.60294, 0.1515, 0.062067) ;
const RGB _CharacterTerrainCol = RGB(0.35294, 0.16016, 0.12197) ;
const RGB _CharacterCloakDarkColor = RGB(0.25735, 0.028557, 0.0056769) ;
const RGB _CharacterYellowColor = RGB(0.88971, 0.34975, 0) ;
const RGB _CharacterWhiteColor = RGB(0.9928, 1, 0.47794) ;
const float _CharacterBloomScale = 0.70000 ;
const float _CharacterDiffScale = 1.50000 ;
const float _CharacterFreScale = 1.77000 ;
const float _CharacterFrePower = 3.84000 ;
const float _CharacterFogScale = 4.55000 ;
const float _CloudTransparencyMul = 0.90000 ;
const RGB _CloudCol = RGB(1, 0.84926, 0.69853) ;
const RGB _BackCloudCol = RGB(0.66176, 0.64807, 0.62284) ;
const RGB _CloudSpecCol = RGB(0.17647, 0.062284, 0.062284) ;
const RGB _BackCloudSpecCol = RGB(0.11029, 0.05193, 0.020275) ;
const float _CloudFogStrength = 0.50000 ;
const RGB _TombMainColor = RGB(0.64706, 0.38039, 0.27451) ;
const RGB _TombScarfColor = RGB(0.38971, 0.10029, 0.10029) ;
const RGB _PyramidCol = RGB(0.69853, 0.40389, 0.22086) ;
const vec2 _PyramidHeightFog = vec2(38.66, 1.3) ;
const RGB _TerrainCol = RGB(0.56618, 0.29249, 0.1915) ;
const RGB _TerrainSpecColor = RGB(1, 0.77637, 0.53676) ;
const float _TerrainSpecPower = 55.35000 ;
const float _TerrainSpecStrength = 1.56000 ;
const float _TerrainGlitterRep = 7.00000 ;
const float _TerrainGlitterPower = 3.20000 ;
const RGB _TerrainRimColor = RGB(0.16176, 0.13131, 0.098724) ;
const float _TerrainRimPower = 5.59000 ;
const float _TerrainRimStrength = 1.61000 ;
const float _TerrainRimSpecPower = 2.88000 ;
const float _TerrainFogPower = 2.11000 ;
const vec4 _TerrainShadowParams = vec4(0.12, 5.2, 88.7, 0.28) ;
const vec3 _TerrainAOParams = vec3(0.01, 0.02, 2) ;
const RGB _TerrainShadowColor = RGB(0.48529, 0.13282, 0) ;
const RGB _TerrainDistanceShadowColor = RGB(0.70588, 0.4644, 0.36851) ;
const float _TerrainDistanceShadowPower = 0.11000 ;
const RGB _FlyingHelperMainColor = RGB(0.85294, 0.11759, 0.012543) ;
const RGB _FlyingHelperCloakDarkColor = RGB(1, 0.090909, 0) ;
const RGB _FlyingHelperYellowColor = RGB(1, 0.3931, 0) ;
const RGB _FlyingHelperWhiteColor = RGB(1, 1, 1) ;
const float _FlyingHelperBloomScale = 2.61000 ;
const float _FlyingHelperFrePower = 1.00000 ;
const float _FlyingHelperFreScale = 0.85000 ;
const float _FlyingHelperFogScale = 1.75000 ;
#endif

#if COLOR_SCHEME == 2
const float _FogMul = -0.00100 ;
const float _FogPow = 1.68000 ;
const float _IncorrectGammaCorrect = 1.00000 ;
const vec3 _LightDir = vec3(-0.23047, 0.87328, -0.42927) ;
const float _Brightness = 0.40000 ;
const float _Contrast = 0.82000 ;
const float _Saturation = 1.21000 ;
const vec3 _SunStar = vec3(14.7, 1.47, 0.1) ;
const float _SunSize = 26.00000 ;
const float _SunScale = 15.00000 ;
const float _ExposureOffset = 11.10000 ;
const float _ExposurePower = 0.52000 ;
const float _ExposureStrength = 0.09000 ;
const RGB _SunColor = RGB(0.97059, 0.97059, 0.97059) ;
const RGB _Zenith = RGB(0.98039, 0.83137, 0.53725) ;
const float _ZenithFallOff = 2.36000 ;
const RGB _Nadir = RGB(0, 0, 0) ;
const float _NadirFallOff = 1.91000 ;
const RGB _Horizon = RGB(0.84559, 0.77688, 0.6031) ;
const vec3 _CharacterAOParams = vec3(0.03, 7.36, 0) ;
const RGB _CharacterMainColor = RGB(0.60294, 0.1515, 0.062067) ;
const RGB _CharacterTerrainCol = RGB(0.5, 0.3404, 0.12868) ;
const RGB _CharacterCloakDarkColor = RGB(0.31618, 0.14042, 0.039522) ;
const RGB _CharacterYellowColor = RGB(0.64706, 0.30233, 0) ;
const RGB _CharacterWhiteColor = RGB(1, 1, 1) ;
const float _CharacterBloomScale = 0.87000 ;
const float _CharacterDiffScale = 1.50000 ;
const float _CharacterFreScale = 1.77000 ;
const float _CharacterFrePower = 3.84000 ;
const float _CharacterFogScale = 12.47000 ;
const float _CloudTransparencyMul = 0.80000 ;
const RGB _CloudCol = RGB(0.99216, 0.9451, 0.76471) ;
const RGB _BackCloudCol = RGB(0.66176, 0.64807, 0.62284) ;
const RGB _CloudSpecCol = RGB(0.17647, 0.062284, 0.062284) ;
const RGB _BackCloudSpecCol = RGB(0.11029, 0.05193, 0.020275) ;
const float _CloudFogStrength = 0.50000 ;
const RGB _TombMainColor = RGB(0.94118, 0.82759, 0.45675) ;
const RGB _TombScarfColor = RGB(0.44118, 0.19989, 0.14922) ;
const RGB _PyramidCol = RGB(0.92647, 0.73579, 0.3338) ;
const vec2 _PyramidHeightFog = vec2(38.66, 4.65) ;
const RGB _TerrainCol = RGB(0.71324, 0.5076, 0.236) ;
const RGB _TerrainSpecColor = RGB(0.32353, 0.32123, 0.31877) ;
const float _TerrainSpecPower = 55.35000 ;
const float _TerrainSpecStrength = 0.03000 ;
const float _TerrainGlitterRep = 7.00000 ;
const float _TerrainGlitterPower = 3.20000 ;
const RGB _TerrainRimColor = RGB(0, 0, 0) ;
const float _TerrainRimPower = 5.59000 ;
const float _TerrainRimStrength = 1.61000 ;
const float _TerrainRimSpecPower = 0.38000 ;
const float _TerrainFogPower = 2.11000 ;
const vec4 _TerrainShadowParams = vec4(0.12, 5.2, 88.7, 0.28) ;
const vec3 _TerrainAOParams = vec3(0.01, 0.02, 2) ;
const RGB _TerrainShadowColor = RGB(0.66912, 0.52969, 0.369) ;
const RGB _TerrainDistanceShadowColor = RGB(1, 0.75466, 0.43382) ;
const float _TerrainDistanceShadowPower = 0.11000 ;
const RGB _FlyingHelperMainColor = RGB(0.91912, 0.30412, 0.21626) ;
const RGB _FlyingHelperCloakDarkColor = RGB(1, 0.090909, 0) ;
const RGB _FlyingHelperYellowColor = RGB(0.98529, 0.60477, 0.12316) ;
const RGB _FlyingHelperWhiteColor = RGB(1, 1, 1) ;
const float _FlyingHelperBloomScale = 1.91000 ;
const float _FlyingHelperFrePower = 1.00000 ;
const float _FlyingHelperFreScale = 0.85000 ;
const float _FlyingHelperFogScale = 4.00000 ;
#endif

#if COLOR_SCHEME == 3
const float _FogMul = -0.00100 ;
const float _FogPow = 1.82000 ;
const float _IncorrectGammaCorrect = 1.00000 ;
const vec3 _LightDir = vec3(-0.29644, 0.6859, -0.66458) ;
const float _Brightness = 1.00000 ;
const float _Contrast = 1.00000 ;
const float _Saturation = 1.00000 ;
const vec3 _SunStar = vec3(20.45, 1.49, 0.5) ;
const float _SunSize = 26.09000 ;
const float _SunScale = 15.04000 ;
const float _ExposureOffset = 13.72000 ;
const float _ExposurePower = 0.60000 ;
const float _ExposureStrength = 0.02000 ;
const RGB _SunColor = RGB(0.51471, 0.79919, 1) ;
const RGB _Zenith = RGB(0, 0.053922, 0.16176) ;
const float _ZenithFallOff = 1.42000 ;
const RGB _Nadir = RGB(0.21569, 0.2549, 0.36078) ;
const float _NadirFallOff = 1.91000 ;
const RGB _Horizon = RGB(0.35191, 0.30223, 0.47794) ;
const vec3 _CharacterAOParams = vec3(0.03, 7.36, 0) ;
const RGB _CharacterMainColor = RGB(0.36765, 0.097656, 0.045956) ;
const RGB _CharacterTerrainCol = RGB(0.083261, 0.11379, 0.16176) ;
const RGB _CharacterCloakDarkColor = RGB(0.073529, 0.011604, 0) ;
const RGB _CharacterYellowColor = RGB(0.60294, 0.33162, 0) ;
const RGB _CharacterWhiteColor = RGB(1, 1, 1) ;
const float _CharacterBloomScale = 0.87000 ;
const float _CharacterDiffScale = 1.50000 ;
const float _CharacterFreScale = 1.77000 ;
const float _CharacterFrePower = 19.83000 ;
const float _CharacterFogScale = 60.00000 ;
const float _CloudTransparencyMul = 0.90000 ;
const RGB _CloudCol = RGB(0.0069204, 0.15969, 0.23529) ;
const RGB _BackCloudCol = RGB(0, 0.10969, 0.15441) ;
const RGB _CloudSpecCol = RGB(0.11765, 0.11765, 0.11765) ;
const RGB _BackCloudSpecCol = RGB(0.080882, 0.080882, 0.080882) ;
const float _CloudFogStrength = 0.50000 ;
const RGB _TombMainColor = RGB(0.23789, 0.27707, 0.40441) ;
const RGB _TombScarfColor = RGB(0.066176, 0, 0.034229) ;
const RGB _PyramidCol = RGB(0, 0, 0) ;
const vec2 _PyramidHeightFog = vec2(38.66, 1.92) ;
const RGB _TerrainCol = RGB(0, 0.058832, 0.10294) ;
const RGB _TerrainSpecColor = RGB(0.24622, 0.29188, 0.33824) ;
const float _TerrainSpecPower = 55.35000 ;
const float _TerrainSpecStrength = 1.56000 ;
const float _TerrainGlitterRep = 7.00000 ;
const float _TerrainGlitterPower = 1.94000 ;
const RGB _TerrainRimColor = RGB(0.091021, 0.057093, 0.16176) ;
const float _TerrainRimPower = 5.59000 ;
const float _TerrainRimStrength = 2.00000 ;
const float _TerrainRimSpecPower = 1.46000 ;
const float _TerrainFogPower = 2.11000 ;
const vec4 _TerrainShadowParams = vec4(0.12, 5.2, 88.7, 0.37) ;
const vec3 _TerrainAOParams = vec3(0.01, 0.02, 2) ;
const RGB _TerrainShadowColor = RGB(0.11029, 0.11029, 0.11029) ;
const RGB _TerrainDistanceShadowColor = RGB(0.0034061, 0.073181, 0.15441) ;
const float _TerrainDistanceShadowPower = 0.06000 ;
const RGB _FlyingHelperMainColor = RGB(0.12661, 0.004109, 0.13971) ;
const RGB _FlyingHelperCloakDarkColor = RGB(1, 0.090909, 0) ;
const RGB _FlyingHelperYellowColor = RGB(0.48529, 0.2711, 0) ;
const RGB _FlyingHelperWhiteColor = RGB(1, 1, 1) ;
const float _FlyingHelperBloomScale = 1.91000 ;
const float _FlyingHelperFrePower = 1.00000 ;
const float _FlyingHelperFreScale = 0.85000 ;
const float _FlyingHelperFogScale = 5.51000 ;
#endif

//==========================================================================================
// Play with these at your own risk. Expect, unexpected results!
//==========================================================================================

const mat4 _CameraInvViewMatrix = mat4( 1, 0, 0, 1.04,
0, 0.9684963, 0.2490279, 2.2,
0, 0.2490279, -0.9684963, 18.6,
0, 0, 0, 1 ) ;
const vec3 _CameraFOV = vec3(1.038, 0.78984, -1) ;
const vec3 _CameraPos = vec3(1.0, 2.2, 18.6) ;
const vec4 _CameraMovement = vec4(0.15, 0.1, 0.2, 0.25) ;

const vec3 _WindDirection = vec3(-0.27, -0.12, 0) ;

const float _DrawDistance = 70.00000 ;
const float _MaxSteps = 64.00000 ;

const vec3 _SunPosition = vec3(0.2, 56, -40.1) ;
const float _CharacterRotation = 0.17000 ;
const vec3 _CharacterPosition = vec3(0.52, 2.35, 17.6) ;
const vec3 _CharacterScale = vec3(0.4, 0.53, 0.38) ;
const float _MainClothRotation = 0.30000 ;
const vec3 _MainClothScale = vec3(0.3, 0.68, 0.31) ;
const vec3 _MainClothPosition = vec3(0, -0.12, 0) ;
const vec3 _MainClothBotCutPos = vec3(0, -0.52, 0) ;
const vec3 _MainClothDetail = vec3(6, 0.04, 1.3) ;
const float _HeadScarfRotation = -0.19000 ;
const vec3 _HeadScarfPosition = vec3(-0.005, -0.16, -0.01) ;
const vec3 _HeadScarfScale = vec3(0.18, 0.2, 0.03) ;
const float _HeadRotationX = -0.30000 ;
const float _HeadRotationY = 0.29000 ;
const float _HeadRotationZ = 0.00000 ;
const vec3 _HeadPos = vec3(0, -0.04, 0.01) ;
const vec3 _LongScarfPos = vec3(0.01, -0.15, 0.09) ;
const vec3 _LongScarfScale = vec3(0.05, 1.25, 0.001) ;
const vec4 _LongScarfWindStrength = vec4(0.3, 4.52, 5.2, 0.02) ;
const float _LongScarfRotX = 1.43000 ;
const float _LongScarfMaxRad = 1.99000 ;
const vec3 _FacePosition = vec3(0, -0.01, 0.05) ;
const vec3 _FaceSize = vec3(0.038, 0.05, 0.03) ;
const vec3 _UpperLeftLegA = vec3(-0.02, -0.37, 0.01) ;
const vec3 _UpperLeftLegB = vec3(-0.02, -0.67, -0.059999) ;
const vec3 _UpperLeftLegParams = vec3(0.026, 1, 1) ;
const vec3 _LowerLeftLegA = vec3(-0.02, -0.67, -0.059999) ;
const vec3 _LowerLeftLegB = vec3(-0.02, -0.77, 0.12) ;
const vec3 _LowerLeftLegParams = vec3(0.028, 0.03, 0.01) ;
const vec3 _UpperRightLegA = vec3(0.07, -0.5, 0.02) ;
const vec3 _UpperRightLegB = vec3(0.07, -0.61, 0.09) ;
const vec3 _UpperRightLegParams = vec3(0.026, 1, 1) ;
const vec3 _LowerRightLegA = vec3(0.07, -0.61, 0.09) ;
const vec3 _LowerRightLegB = vec3(0.07, -0.91, 0.22) ;
const vec3 _LowerRightLegParams = vec3(0.028, 0.03, 0.01) ;
const vec3 _BodyPos = vec3(0, -0.45, -0.03) ;
const vec3 _CharacterTrailOffset = vec3(0.72, 0.01, 0.06) ;
const vec3 _CharacterTrailScale = vec3(0.001, 0, 0.5) ;
const vec3 _CharacterTrailWave = vec3(1.97, 0, 0.34) ;
const vec2 _CharacterHeightTerrainMix = vec2(1.95, -30) ;
const vec3 _CloudNoiseStrength = vec3(0.2, 0.16, 0.1) ;
const vec3 _FrontCloudsPos = vec3(9.91, 8.6, -12.88) ;
const vec3 _FrontCloudsOffsetA = vec3(-9.1, 3.04, 0) ;
const vec3 _FrontCloudsOffsetB = vec3(-2.97, 3.72, -0.05) ;
const vec3 _FrontCloudParams = vec3(5.02, 3.79, 5) ;
const vec3 _FrontCloudParamsA = vec3(3.04, 0.16, 2) ;
const vec3 _FrontCloudParamsB = vec3(1.34, 0.3, 3.15) ;
const vec3 _BackCloudsPos = vec3(29.99, 13.61, -18.8) ;
const vec3 _BackCloudsOffsetA = vec3(24.87, -1.49, 0) ;
const vec3 _BackCloudParams = vec3(7.12, 4.26, 1.68) ;
const vec3 _BackCloudParamsA = vec3(6.37, 2.23, 2.07) ;
const vec3 _PlaneParams = vec3(7.64, 10.85, 3.76) ;
const vec3 _CloudGlobalParams = vec3(0.123, 2.1, 0.5) ;
const vec3 _CloudBackGlobalParams = vec3(0.16, 1.4, -0.01) ;
const vec3 _CloudNormalMod = vec3(0.26, -0.13, 1.22) ;
const float _CloudSpecPower = 24.04000 ;
const float _CloudPyramidDistance = 0.14500 ;
const vec3 _TombPosition = vec3(5, 5, 9.28) ;
const vec3 _TombScale = vec3(0.07, 0.5, 0.006) ;
const vec3 _TombBevelParams = vec3(0.44, 0.66, 0.01) ;
const float _TombRepScale = 0.79000 ;
const vec3 _TombCutOutScale = vec3(0.39, 0.06, -14.92) ;
const vec3 _TombScarfOffset = vec3(0, 0.46, 0) ;
const vec3 _TombScarfWindParams = vec3(-1.61, 6, 0.05) ;
const vec3 _TombScarfScale = vec3(0.03, 0.002, 0.5) ;
const float _TombScarfRot = -0.88000 ;
const mat4 _TombScarfMat = mat4( 0.9362437, 0, -0.3513514, 0,
0, 1, 0, 0,
0.3513514, 0, 0.9362437, 0,
0, 0, 0, 1 ) ;
const vec3 _PyramidPos = vec3(0, 10.9, -50) ;
const vec3 _PyramidScale = vec3(34.1, 24.9, 18) ;
const vec3 _PrismScale = vec3(1, 1.9, 1) ;
const vec3 _PyramidNoisePrams = vec3(1.5, 1, 1) ;
const vec3 _PrismEyeScale = vec3(0.7, 1.9, 51.5) ;
const vec3 _PyramidEyeOffset = vec3(2.0, -4.9, 0) ;
const float _PrismEyeWidth = 5.86000 ;
const float _TerrainMaxDistance = 30.04000 ;
const float _SmallDetailStrength = 0.00600 ;
const vec3 _SmallWaveDetail = vec3(3.19, 16, 6.05) ;
const vec2 _WindSpeed = vec2(2, 0.6) ;
const float _MediumDetailStrength = 0.05000 ;
const vec2 _MediumWaveDetail = vec2(2, 50) ;
const vec3 _MediumWaveOffset = vec3(0.3, -2, 0.1) ;
const vec2 _LargeWaveDetail = vec2(0.25, 0.73) ;
const vec3 _LargeWavePowStre = vec3(0.6, 2.96, -2.08) ;
const vec3 _LargeWaveOffset = vec3(-3.65, 4.41, -11.64) ;
const vec3 _FlyingHelperPos = vec3(2.15, 4.68, 14.4) ;
const vec3 _FlyingHelperScale = vec3(0.25, 0.001, 0.3) ;
const vec3 _FlyingHelperMovement = vec3(0.44, 1.44, -2.98) ;
const vec3 _FlyingHelperScarfScale = vec3(0.1, 0.001, 1.5) ;
const vec3 _FlyingHelperScarfWindParams = vec3(-0.06, 0.31, 0.47) ;
const vec3 _FlyingHelperScarfWindDetailParams = vec3(3.93, 0.005, -45.32) ;
const vec3 _FlyingHelperSideScarfOffset = vec3(0.16, -0.01, 0) ;
const vec3 _FlyingHelperSideScarfScale = vec3(0.06, 0.001, 0.8) ;
const vec4 _FlyingScarfSideWindParams = vec4(2.46, -1.59, -0.05, 0.21) ;

// Material ID definitions
#define MAT_PYRAMID 1.0

#define MAT_TERRAIN 10.0
#define MAT_TERRAIN_TRAIL 11.0

#define MAT_BACK_CLOUDS 20.0
#define MAT_FRONT_CLOUDS 21.0

#define MAT_TOMB 30.0
#define MAT_TOMB_SCARF 31.0

#define MAT_FLYING_HELPERS 40.0
#define MAT_FLYING_HELPER_SCARF 41.0

#define MAT_CHARACTER_BASE 50.0
#define MAT_CHARACTER_MAIN_CLOAK 51.0
#define MAT_CHARACTER_NECK_SCARF 52.0
#define MAT_CHARACTER_LONG_SCARF 53.0
#define MAT_CHARACTER_FACE 54.0

#define TEST_MAT_LESS( a, b ) a < (b + 0.1)
#define TEST_MAT_GREATER( a, b ) a > (b - 0.1)

//==========================================================================================
// Primitive functions by IQ
//==========================================================================================
float sdRoundBox(vec3 p, vec3 b, float r)
{
	return length( max( abs(p) - b, 0.0) ) - r;
}

float sdSphere(vec3 p, float s)
{
	return length(p) - s;
}

float sdPlane( vec3 p )
{
	return p.y;
}

float sdBox(vec3 p, vec3 b)
{
	vec3 d = abs(p) - b;
	return min(max(d.x, max(d.y, d.z)), 0.0) +
		length(max(d, 0.0));
}

float sdCylinder(vec3 p, vec2 h)
{
	vec2 d = abs(vec2(length(p.xz), p.y)) - h;
	return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdPlane(vec3 p, vec4 n)
{
	// n must be normalized
	return dot(p, n.xyz) + n.w;
}

vec2 sdSegment( in vec3 p, vec3 a, vec3 b )
{
	vec3 pa = p - a, ba = b - a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return vec2( length( pa - ba*h ), h );
}

float sdEllipsoid(in vec3 p, in vec3 r)
{
	return (length(p / r) - 1.0) * min(min(r.x, r.y), r.z);
}

float sdTriPrism( vec3 p, vec2 h )
{
    vec3 q = abs(p);
#if 0
    return max(q.z-h.y,max(q.x*0.866025+p.y*0.5,-p.y)-h.x*0.5);
#else
    float d1 = q.z-h.y;
    float d2 = max(q.x*0.866025+p.y*0.5,-p.y)-h.x*0.5;
    return length(max(vec2(d1,d2),0.0)) + min(max(d1,d2), 0.);
#endif
}

//==========================================================================================
// distance field operations
//==========================================================================================
vec2 min_mat( vec2 d1, vec2 d2 )
{
	return (d1.x<d2.x) ? d1 : d2;
}

float smin( float a, float b, float k )
{
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

vec2 smin_mat( vec2 a, vec2 b, float k, float c )
{
    float h = clamp( 0.5+0.5*(b.x-a.x)/k, 0.0, 1.0 );
    float x = mix( b.x, a.x, h ) - k*h*(1.0-h);
    return vec2( x, ( h < c ) ? b.y : a.y);
}

float smax( float a, float b, float k )
{
	float h = clamp( 0.5 + 0.5*(b-a)/k, 0.0, 1.0 );
	return mix( a, b, h ) + k*h*(1.0-h);
}

//==========================================================================================
// Rotations
//==========================================================================================
void rX(inout vec3 p, float a) {
    vec3 q = p;
    float c = cos(a);
    float s = sin(a);
    p.y = c * q.y - s * q.z;
    p.z = s * q.y + c * q.z;
}

void rY(inout vec3 p, float a) {
    vec3 q = p;
    float c = cos(a);
    float s = sin(a);
    p.x = c * q.x + s * q.z;
    p.z = -s * q.x + c * q.z;
}

void rZ(inout vec3 p, float a) {
    vec3 q = p;
    float c = cos(a);
    float s = sin(a);
    p.x = c * q.x + s * q.y;
    p.y = -s * q.x + c * q.y;
}

//==========================================================================================
// Value noise and its derivatives: https://www.shadertoy.com/view/MdX3Rr
//==========================================================================================
vec3 noised( in vec2 x )
{
    vec2 f = fract(x);
    vec2 u = f*f*(3.0-2.0*f);

#if 0
    // texel fetch version
    ivec2 p = ivec2(floor(x));
    float a = texelFetch( iChannel0, (p+ivec2(0,0))&255, 0 ).x;
	float b = texelFetch( iChannel0, (p+ivec2(1,0))&255, 0 ).x;
	float c = texelFetch( iChannel0, (p+ivec2(0,1))&255, 0 ).x;
	float d = texelFetch( iChannel0, (p+ivec2(1,1))&255, 0 ).x;
#else
    // texture version
    vec2 p = floor(x);
	float a = textureLod( iChannel0, (p+vec2(0.5,0.5))/256.0, 0.0 ).x;
	float b = textureLod( iChannel0, (p+vec2(1.5,0.5))/256.0, 0.0 ).x;
	float c = textureLod( iChannel0, (p+vec2(0.5,1.5))/256.0, 0.0 ).x;
	float d = textureLod( iChannel0, (p+vec2(1.5,1.5))/256.0, 0.0 ).x;
#endif

	return vec3(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y,
				6.0*f*(1.0-f)*(vec2(b-a,c-a)+(a-b-c+d)*u.yx));
}

//==========================================================================================
// Noise function: https://www.shadertoy.com/view/4sfGRH
//==========================================================================================
float pn(vec3 p) {
    vec3 i = floor(p);
	vec4 a = dot(i, vec3(1., 57., 21.)) + vec4(0., 57., 21., 78.);
    vec3 f = cos((p-i)*3.141592653589793)*(-.5) + .5;
	a = mix(sin(cos(a)*a), sin(cos(1.+a)*(1.+a)), f.x);
    a.xy = mix(a.xz, a.yw, f.y);
	return mix(a.x, a.y, f.z);
}

//==========================================================================================
// Sin Wave approximation http://http.developer.nvidia.com/GPUGems3/gpugems3_ch16.html
//==========================================================================================
vec4  SmoothCurve( vec4 x ) {
  return x * x * ( 3.0 - 2.0 * x );
}

vec4 TriangleWave( vec4 x ) {
  return abs( fract( x + 0.5 ) * 2.0 - 1.0 );
}

vec4 SmoothTriangleWave( vec4 x ) {
  return SmoothCurve( TriangleWave( x ) );
}

float SmoothTriangleWave( float x )
{
  return SmoothCurve( TriangleWave( vec4(x,x,x,x) ) ).x;
}

void Bend(inout vec3 vPos, vec2 vWind, float fBendScale)
{
	float fLength = length(vPos);
	float fBF = vPos.y * fBendScale;
	fBF += 1.0;
	fBF *= fBF;
	fBF = fBF * fBF - fBF;
	vec3 vNewPos = vPos;
	vNewPos.xz += vWind.xy * fBF;
	vPos.xyz = normalize(vNewPos.xyz)* fLength;
}

//==========================================================================================
// Modified cone versions for scarf and main cloak
//==========================================================================================
float sdScarfCone( in vec3 p, in float h, in float r1, in float r2 )
{
    float d1 = -p.y - h;
    float q = (p.y - h);
    float si = 0.5*(r1-r2)/h;
    p.z = mix(p.z, p.z * 0.2, q);
    float d2 = max( sqrt( dot(p.xz,p.xz)*(1.0-si*si)) + q*si - r2, q );
    return length(max(vec2(d1,d2),0.0)) + min(max(d1,d2), 0.);
}

vec2 sdCloakCone( in vec3 p, in float h, in float r1, in float r2 )
{
    float d1 = -p.y - h;
    float q = (p.y - h);
    r2 = (q * r2) + 0.08;
    float si = 0.5*(r1-r2)/h;
    float d2 = max( sqrt( dot(p.xz,p.xz)*(1.0-si*si)) + q*si - r2, q );
    return vec2(length(max(vec2(d1,d2),0.0)) + min(max(d1,d2), 0.), q);
}

//==========================================================================================
// Character
//==========================================================================================
vec3 headScarfMatUVW;
float sdHeadScarf(vec3 pos)
{

    vec3 headScarfPos = pos - _HeadScarfPosition;
    rX( headScarfPos, _HeadScarfRotation );

    float distanceToTop =  min(0.0,(pos.y + 0.01));

    // Put a slight twist in the middle. Gives the feel that the head scarf
    // is sitting on shoulders. Very subtle, but I can see it :D
    float midBend = abs( fract( distanceToTop + 0.5 ) * 2.0 - 1.0 );
    headScarfPos.x += (cos( 2.0 + headScarfPos.y * 50.0 ) * 0.05 * midBend);
    headScarfPos.z += (sin( 2.0 + headScarfPos.y * 50.0 ) * 0.03 * midBend);

    // Apply wind to head Scarf
    headScarfPos += SmoothTriangleWave(vec4(pos.xyz * 5.0+ iTime,1.0) ).xyz * 0.05 * distanceToTop;

    // Scarf shape
    float headScarf = sdScarfCone(headScarfPos, _HeadScarfScale.x, _HeadScarfScale.y, _HeadScarfScale.z );
    headScarf = max(headScarf, -sdScarfCone(headScarfPos, _HeadScarfScale.x, _HeadScarfScale.y, _HeadScarfScale.z - 0.011));

    // Cut out the bottom of the head scarf. I have no idea what I was thinking, when I wrote this
    vec3 cutOutPos = headScarfPos - vec3( 0.0, 0.08, 0.0);
    vec3 r = vec3(0.12, 0.8, 0.2);
    float smallestSize = min(min(r.x,r.y),r.z);
	vec3 dp = cutOutPos/r;
    float h = min(1.0, abs(1.0 - abs(dp.y)) );

    // Apply some crazy power until it looks like a scarf sitting on shoulders
    h =  pow(h, 5.5);

    float rad = h ;
    float d = length( cutOutPos/r );

    float cutOut = (d - rad) * smallestSize;
    headScarf	= max(headScarf, cutOut);

    // material information
    float materialVal = 1.0 - pow(d - rad, 0.02);
	headScarfMatUVW = smoothstep( -1.0, 1.0, materialVal / _HeadScarfScale);

	// Chop the top off, to make room for head
    vec3 headPos = pos - vec3(0.0, 0.25, 0.0);
    float head   = sdBox(headPos, vec3(0.2, 0.19, 0.2));
    headScarf = max(headScarf, -head);

    return headScarf;
}
vec3 mainCloakMatUVW;
float sdMainCloak(vec3 pos)
{
    vec3 cloakPos = pos - _MainClothPosition;
    float q =  min(0.0,(cloakPos.y + 0.05));
    rX( cloakPos, _MainClothRotation );

    // Apply detailing
    cloakPos += SmoothTriangleWave(vec4(pos.xyz * _MainClothDetail.x + iTime,1.0) ).xyz * _MainClothDetail.y * q;

    // Add main Wind direction
    Bend(cloakPos, _WindDirection.xy, _MainClothDetail.z);

    vec2 cloak = sdCloakCone( cloakPos, _MainClothScale.y, _MainClothScale.x, _MainClothScale.z);
    // Cut out the internals of the cloak
    cloak.x = max( cloak.x, -sdCloakCone( cloakPos, _MainClothScale.y * 1.05, _MainClothScale.x * 0.95, _MainClothScale.z * 1.01).x);

    // UV Information
    mainCloakMatUVW = smoothstep( -1.0, 1.0, cloakPos / _MainClothScale);

    // Cut out the top section
    vec3 headPos = cloakPos - vec3(0.0, 0.69, 0.0);
    float head   = sdBox(headPos, vec3(0.2, 0.67, 0.2));
	cloak.x = max(cloak.x, -head);

    // Cut the bottom
    float bottomCut   = sdPlane(cloakPos - _MainClothBotCutPos);
    cloak.x = max(cloak.x, -bottomCut);

    return cloak.x;
}

float earWigs(in vec3 pos)
{
	// Symmetrical ear wigs. Is that even a word... Ear Wigs!
    pos.x = abs(pos.x);

    vec2  earWig = sdSegment( pos, vec3(0.02, 0.11, 0.0), vec3(0.07, 0.16, 0.05));
    float ear  = earWig.x - 0.026  + (earWig.y * 0.03);
    return ear;
}


float sdHead( vec3 pos )
{
    vec3 headPos = pos - _HeadPos;

    // Slight tilt
    rY(headPos, _HeadRotationY ); // 1.2
    rX(headPos, _HeadRotationX );

    float head = sdCylinder( headPos, vec2(0.05, 0.13) );
    head = smin(earWigs(headPos), head, 0.04 );
    return head;
}

vec3 longScarfMatUVW;
float sdScarf(vec3 pos)
{
    vec3 scarfPos = pos - _LongScarfPos;
    vec3 scale 	= _LongScarfScale;


    float distanceToPoint = max(0.0,length(scarfPos) - 0.04);
    scarfPos.x += (sin( scarfPos.z * _LongScarfWindStrength.x + iTime ) * 0.1 * distanceToPoint);
    scarfPos.y += (sin( scarfPos.z * _LongScarfWindStrength.y + iTime ) * 0.1 * distanceToPoint);

    // Apply detailing
    scarfPos += SmoothTriangleWave(vec4(pos.xyz * _LongScarfWindStrength.z + iTime,1.0) ).xyz * _LongScarfWindStrength.w * distanceToPoint;

    // Essentially a box pivoted at a specific point
    vec3 scarfOffset = vec3(0.0, 0.0, -scale.y);

    rX(scarfPos, _LongScarfRotX) ;
    float scarf = sdBox(scarfPos - scarfOffset.xzy , scale);

    longScarfMatUVW = smoothstep(-1.0, 1.0, ( scarfPos - scarfOffset.xzy ) / scale);

    return max(scarf, sdSphere( scarfPos, _LongScarfMaxRad ));
}

float sdLegs( in vec3 pos  )
{
    vec2  upperLeftLeg = sdSegment( pos, _UpperLeftLegA, _UpperLeftLegB );
    float leftLeg  = upperLeftLeg.x - _UpperLeftLegParams.x;
    vec2 lowerLeftLeg = sdSegment( pos, _LowerLeftLegA, _LowerLeftLegB );
    leftLeg  = smin( leftLeg, lowerLeftLeg.x - _LowerLeftLegParams.x + (lowerLeftLeg.y * _LowerLeftLegParams.y), _LowerLeftLegParams.z);

    // cut bottom of left leg otherwise looks nasty with harsh tip
    leftLeg = max( leftLeg, -(length( pos - _LowerLeftLegB) - 0.06 ) );

    vec2  upperRightLeg = sdSegment( pos, _UpperRightLegA, _UpperRightLegB );
    float rightLeg  = upperRightLeg.x - _UpperRightLegParams.x;
    vec2 lowerRightLeg = sdSegment( pos, _LowerRightLegA, _LowerRightLegB );
    rightLeg  = smin( rightLeg, lowerRightLeg.x - _LowerRightLegParams.x + (lowerRightLeg.y * _LowerRightLegParams.y), _LowerRightLegParams.z);

    return min( leftLeg, rightLeg );
}

vec2 sdFace( vec3 pos, vec2 currentDistance )
{
    vec3 headPos = pos - vec3(0.0, -0.05, 0.0);
    rX( headPos, _HeadRotationX );
    rY(headPos, _HeadRotationY );

    // head hole - Fire in the hole!
    // OK this does not look right. Actually looks like there was 'fire in the hole' for
    // the poor travellers face. Need to come back to it one day and finish it. Maybe!
    vec3 headHole = headPos - vec3(0.0, 0.1, -0.07);
    float hole = sdEllipsoid( headHole,vec3(0.05, 0.03, 0.04) );
    hole  = smin ( hole, sdEllipsoid( headHole - vec3(0.0, -0.03, 0.0), vec3(0.03,0.03, 0.04)), 0.05 );

    // Cut it OUT!
    float character =  smax( currentDistance.x, -hole, 0.001);

    // face. Meh just an ellipsoid. Need to add eyes and bandana
    float face = sdEllipsoid( headHole - _FacePosition.xyz, _FaceSize );
    return smin_mat( vec2(face, MAT_CHARACTER_FACE), vec2(character,currentDistance.y), 0.01, 0.2 );
}

vec2 sdCharacter( vec3 pos )
{
    // Now we are in character space - Booo YA! - I never ever say Boooo YA!. Peter Pimley
    // says that. Peter: have you been putting comments in my code?
    pos -= _CharacterPosition;
    vec3 scale = _CharacterScale;
    float scaleMul = min(scale.x, min(scale.y, scale.z));

    rY(pos, _CharacterRotation);

    pos /= scale;

    float mainCloak = sdMainCloak( pos );
    vec2  mainCloakMat = vec2(mainCloak, MAT_CHARACTER_MAIN_CLOAK );

    float headScarf = sdHeadScarf(pos);
    vec2  headScarfMat = vec2(headScarf, MAT_CHARACTER_NECK_SCARF );

    float longScarf = sdScarf(pos);
    vec2  longScarfMat = vec2( longScarf, MAT_CHARACTER_LONG_SCARF );
    headScarfMat = smin_mat( headScarfMat, longScarfMat, 0.02, 0.1 );

    float head      = sdHead( pos );
    vec2  headMat	= vec2( head, MAT_CHARACTER_BASE );
    headScarfMat    = smin_mat(headScarfMat, headMat, 0.05, 0.75);

    vec2  characterMat = min_mat(mainCloakMat, headScarfMat);
    characterMat = sdFace( pos, characterMat );

    vec2 legsMat = vec2( sdLegs(pos), MAT_CHARACTER_BASE );
    characterMat = min_mat( characterMat, legsMat );

    // chope the bottom. This is to chop the bottom of right leg. Though
    // I have positioned the character so that the right leg is hidden by terrain.
    // Commenting it out for now
//    characterMat.x = max( characterMat.x, -sdPlane( pos - vec3(0.0, -0.85, 0.0) ) );
    characterMat.x *= scaleMul;


    return characterMat;
}

//==========================================================================================
// Clouds
//==========================================================================================
float sdCloud( in vec3 pos, vec3 cloudPos, float rad, float spread, float phaseOffset, vec3 globalParams)
{
	// Clouds are simple. A bunch of spheres with varying phase offset, size and
	// frequency values. They are also scaled along the z-Axis so more like circles
	// than spheres. With additional noise to make them look fluffy.
	// While rendering them we 'perturb' #SpellCheck the normals to get strong specular
	// highlights

	// Add noise to the clouds
	pos += pn( pos ) * _CloudNoiseStrength;
	pos = pos - cloudPos;

	// Make us 2d-ish - My artists have confirmed me: 2D is COOL!
	pos.z /= globalParams.x;

	// Repeat the space
	float repitition = rad * 2.0 + spread;
	vec3  repSpace = pos - mod( pos - repitition * 0.5, repitition);

	// Create the overall shape to create clouds on
	pos.y +=  sin(phaseOffset + repSpace.x * 0.23  )  * globalParams.y ;

	// Creates clouds with offset on the main path
	pos.y +=  sin(phaseOffset + repSpace.x * 0.9 ) * globalParams.z;

	// repeated spheres
	pos.x = fract( (pos.x + repitition * 0.5) / repitition ) * repitition - repitition * 0.5;

	// return the spheres
	float sphere = length(pos)- rad;
	return sphere * globalParams.x;
}

vec2 sdClouds( in vec3 pos )
{
	// Two layers of clouds. A layer in front of the big pyramid
    float c1 = sdCloud( pos, _FrontCloudsPos, _FrontCloudParams.x, _FrontCloudParams.y, _FrontCloudParams.z, _CloudGlobalParams );
    float c2 = sdCloud( pos, _FrontCloudsPos + _FrontCloudsOffsetA, _FrontCloudParamsA.x, _FrontCloudParamsA.y, _FrontCloudParamsA.z, _CloudGlobalParams );
    float c3 = sdCloud( pos, _FrontCloudsPos + _FrontCloudsOffsetB, _FrontCloudParamsB.x, _FrontCloudParamsB.y, _FrontCloudParamsB.z, _CloudGlobalParams);
    float frontClouds = min(c3, min(c1, c2));

    // This plane hides the empty spaces between the front cloud spheres. Not needed
    // for back spheres, they are covered by front spheres
  	float mainPlane = length(pos.z - _FrontCloudsPos.z) / _CloudGlobalParams.x + (pos.y - _PlaneParams.y  + sin(_PlaneParams.x + pos.x * 0.23 ) * _PlaneParams.z);// - rad;
  	frontClouds = min(mainPlane * _CloudGlobalParams.x, frontClouds);

	// Second layer behind the big Pyramid
    float c4 = sdCloud( pos, _BackCloudsPos, _BackCloudParams.x, _BackCloudParams.y, _BackCloudParams.z, _CloudBackGlobalParams );
    float c5 = sdCloud( pos, _BackCloudsPos + _BackCloudsOffsetA, _BackCloudParamsA.x, _BackCloudParamsA.y, _BackCloudParamsA.z, _CloudBackGlobalParams );
    float backClouds = min(c4,c5);
    return min_mat(vec2(frontClouds,MAT_FRONT_CLOUDS), vec2(backClouds,MAT_BACK_CLOUDS));
}

//==========================================================================================
// This should really be called Kites. No such thing as Flying Helplers...
//==========================================================================================
vec3 helperScarfMatUVW;
float sdHelperScarf(vec3 pos, vec3 scarfOffset, vec3 originalPos )
{
    vec3 scarfPos = pos - scarfOffset;

    vec3 scale = _FlyingHelperScarfScale;

    // How far are we from pivot of scarf
    float distanceToPoint = length(scarfPos );

    // Apply some motion
    scarfPos += SmoothTriangleWave(vec4(pos.xyz * _FlyingHelperScarfWindDetailParams.x + iTime,1.0) ).xyz * _FlyingHelperScarfWindDetailParams.y * distanceToPoint;

    vec2 wave;
    wave.x = SmoothTriangleWave( scarfPos.z * _FlyingHelperScarfWindParams.x  );
    wave.y = SmoothTriangleWave( scarfPos.z * _FlyingHelperScarfWindParams.z  );

    scarfPos.xy += ( wave * _FlyingHelperScarfWindParams.y * distanceToPoint);
    vec3  pivotOffset = vec3(0.0, 0.0, scale.z);
    float scarf = sdBox(scarfPos - pivotOffset, scale);

    // Move us along the z-axis because we chop a sphere in the box. Shows borders otherwise
    vec3 UVWOffset = vec3(0.0, 0.0, 1.0);
    helperScarfMatUVW = smoothstep(-1.0, 1.0, ( scarfPos + UVWOffset - pivotOffset.xzy ) / scale);

    // Two scarf on each side of the big'un
    pivotOffset.z = _FlyingHelperSideScarfScale.z;

	wave.y = originalPos.x > 0.0 ? wave.y * _FlyingScarfSideWindParams.x : wave.y * _FlyingScarfSideWindParams.y;
	scarfPos.xy += scarfPos.x > 0.0 ? wave * _FlyingScarfSideWindParams.z : wave * _FlyingScarfSideWindParams.w;

	// legit mirroring!
	scarfPos.x = -abs(scarfPos.x);
	float sideScarfs = sdBox(scarfPos - pivotOffset + _FlyingHelperSideScarfOffset, _FlyingHelperSideScarfScale);

	// Just override the helperScarfMatUVW value for side scarfs. Too tired to create another variable and use that, not too tired
	// to write this long comment of no value
    helperScarfMatUVW = scarf < sideScarfs ? helperScarfMatUVW : smoothstep(-1.0, 1.0, ( scarfPos - pivotOffset + _FlyingHelperSideScarfOffset ) / _FlyingHelperSideScarfScale);

    // Combine'em
    scarf = min( scarf, sideScarfs );
    return scarf;
}

vec2 sdFlyingHelpers( vec3 pos )
{
	vec3 originalPos = pos;
	float flyingHelper = _DrawDistance;

	// Using pos.x to determine, whether we are rendering left or right scarf.
	vec3 helperPos = _FlyingHelperPos;
	helperPos = pos.x > 0.0 ? helperPos - _FlyingHelperMovement : helperPos;

	// Rest is just mirroring
	pos.x = abs(pos.x);
	pos = pos - helperPos;

	float helperScarf = sdHelperScarf( pos, vec3(0.0, 0.0, 0.0), originalPos);

	// Main helper is a box with a cutout sphere at back. In-game it is more sophisticated. But
	// I am running out of time. Maybe will do a proper one, one day!
	float helper = sdBox( pos, _FlyingHelperScale );
	helper	= max( helper, -sdSphere( pos - vec3(0.0, 0.0, _FlyingHelperScale.z ), _FlyingHelperScale.z) );

	// Material and combine scarf with main body
	vec2 helperMat = smin_mat( vec2(helper,MAT_FLYING_HELPERS), vec2(helperScarf,MAT_FLYING_HELPER_SCARF), 0.01, 0.1);
	helperScarfMatUVW = helper < helperScarf ? smoothstep(-1.0, 1.0, (pos + vec3(0.0,0.0,_FlyingHelperScale.z*0.5)) / _FlyingHelperScale) : helperScarfMatUVW;

	return helperMat;
}

//==========================================================================================
// The big mountain in the distance. Again, not a pyramid
//==========================================================================================
float sdBigMountain( in vec3 pos )
{
    float scaleMul = min(_PyramidScale.x, min(_PyramidScale.y, _PyramidScale.z));
    vec3 posPyramid	= pos - _PyramidPos;

    // Apply noise derivative, then we can use a blocky looking texture to make the mountain
    // look edgy (for lack of better word)
    float derNoise		= sin(noised(posPyramid.xz * _PyramidNoisePrams.x).x) * _PyramidNoisePrams.y;
    posPyramid.x		= posPyramid.x + derNoise;

    posPyramid /= _PyramidScale;
    float pyramid = sdTriPrism(  posPyramid, _PrismScale.xy ) * scaleMul;

    // The piercing eye. Which is just an inverted pyrmaid on top of main pyramid.
    float eyeScale = _PyramidScale.x;

    vec3 posEye = pos;
    posEye.y = _PrismEyeScale.z - pos.y;
    posEye.x = pos.x * _PrismEyeWidth;

	float eye = sdTriPrism(  (posEye -_PyramidEyeOffset) / eyeScale, _PrismEyeScale.xy ) * eyeScale;
	return max(pyramid, -eye);
}

//==========================================================================================
// Main desert shape
//==========================================================================================
float sdLargeWaves( in vec3 pos )
{
	// The main shape of terrain. Just sin waves, along X and Z axis, with a power
	// curve to make the shape more pointy

    // Manipulate the height as we go in the distance
    // We want terrain to be a specific way closer to character, showing a path, but the path
    // gets muddier as wo go in the distance.

    float distZ = abs(pos.z - _CameraPos.z);
    float distX = abs(pos.x - _CameraPos.x);
    float dist = (distZ ) + (distX * 0.1);
    dist = dist * dist * 0.01;

    float detailNoise = noised(pos.xz).x * -2.5;
	float largeWaves = (sin(_LargeWaveOffset.z + pos.z * _LargeWaveDetail.y + pos.z * 0.02)
					  * sin((_LargeWaveOffset.x + dist) + (pos.x * _LargeWaveDetail.x) ) * 0.5) + 0.5;
    largeWaves = -_LargeWaveOffset.y + pow( largeWaves, _LargeWavePowStre.x) *  _LargeWavePowStre.y - detailNoise * 0.1 ;// - (-pos.z*_LargeWavePowStre.z);//

    // Smoothly merge with the bottom plane of terrain
    largeWaves = smin(largeWaves, _LargeWavePowStre.z, 0.2);
    largeWaves = (largeWaves - dist);
    return largeWaves * 0.9;
}

float sdSmallWaves( in vec3 pos )
{
	// The small waves are used for adding detail to the main shape of terrain
	float distanceToCharacter = length( pos.xz - _CharacterPosition.xz );

    // movement to give feel of wind blowing
    float detailNoise = noised(pos.xz).x * _SmallWaveDetail.z;
	float smallWaves = sin(pos.z * _SmallWaveDetail.y + detailNoise + iTime * _WindSpeed.y ) *
					   sin(pos.x * _SmallWaveDetail.x + detailNoise + iTime * _WindSpeed.x ) * _SmallDetailStrength;// * min(1.0, distanceToCharacter);

	return smallWaves * 0.9;
}

float sdTerrain( in vec3 pos)
{
	float smallWaves = sdSmallWaves( pos );
	float largeWaves = sdLargeWaves( pos );

    return (smallWaves + largeWaves);
}

vec2 sdDesert( in vec3 pos, in float terrain )
{
    float distanceToPos = length(pos.xz - _CameraPos.xz);
    if( distanceToPos > _TerrainMaxDistance)
        return vec2(_DrawDistance, 0.0);

   	float mat = 9.0;//length(pos.xyz) > 9.0 ? 10.0 : 40.0;
    return vec2( pos.y + terrain, MAT_TERRAIN );
}

//==========================================================================================
// Character trail in the sand
//==========================================================================================
float sdCharacterTrail( vec3 pos, in float terrain )
{
	vec3 trailOffset = (_CharacterPosition);
	trailOffset.yz  += (_CharacterTrailOffset).yz;
    trailOffset.y = -terrain + _CharacterTrailOffset.y;

    vec3 trailPos = pos - trailOffset;
    float distanceToPoint = length(trailPos);
    trailPos.x -= _CharacterTrailOffset.x * distanceToPoint;

    // Make it wavy
    trailPos.x += (SmoothTriangleWave( trailPos.z * _CharacterTrailWave.x  ) * _CharacterTrailWave.z * distanceToPoint);

    float trail = sdBox(trailPos - vec3(0.0, 0.0, _CharacterTrailScale.z) , _CharacterTrailScale);
    return trail;
}

//==========================================================================================
// The tombs
//==========================================================================================
float sdTombScarf(vec3 pos, vec3 scarfOffset, float t )
{
	//  scarfs, done same as other scarfs

    vec3 scarfPos = pos - scarfOffset;

    scarfPos =  (mul(  _TombScarfMat, vec4(scarfPos,1.0) )).xyz;

    vec3 scale = _TombScarfScale;
    scale.z  += (t + 1.0 ) * 0.2;

    // How far are we from pivot of scarf
    float distanceToPoint = max(0.0,length(scarfPos) - 0.1);

    // Make the scarf thicker as it goes out
    scale.x += distanceToPoint * 0.04;

    // Apply some motion
    scarfPos.x += (sin( pos.z * _TombScarfWindParams.x + iTime) * _TombScarfWindParams.z * distanceToPoint);
    scarfPos.y += (sin( pos.z * _TombScarfWindParams.y + iTime) * _TombScarfWindParams.z * distanceToPoint);

     vec3 pivotOffset = vec3(0.0, 0.0, scale.z);
    rX(scarfPos, _TombScarfRot + ((t - 0.5)* 0.15) + SmoothTriangleWave((iTime + 1.45) * 0.1) * 0.3 );

    float scarf = sdBox(scarfPos - pivotOffset , scale);
    return scarf;
}

vec2 sdTombs( in vec3 p )
{
	vec2 mainTomb = vec2(_DrawDistance, MAT_TOMB);

	// We draw two tombs, t goes -1 -> 1 so we can use negative and positive values
	// to mainpulate them both individually
	for( float t = -1.0; t <= 1.0; t += 2.0 )
	{
		vec3 tombPos = (_TombPosition + vec3(-0.25 * t, t * 0.05, 0.1 * t ));

		vec3 pos = p - tombPos;
		rZ( pos, 0.1 * t );

		float tombScarf = sdTombScarf( pos, _TombScarfOffset, t + 1.0);

		pos.x = abs(pos.x);

		// Taper them beyond a certain height. Rest is just a rounded box
		pos.x += abs( pos.y > _TombBevelParams.x  ? (pos.y - _TombBevelParams.x) * _TombBevelParams.y: 0.0 );
		float tTomb = sdRoundBox( pos, _TombScale, _TombBevelParams.z);

		// Cut out a sphere at top
		tTomb = max( tTomb, -sdSphere( pos - vec3(0.0, _TombCutOutScale.x, 0.0), _TombCutOutScale.y ) );

		// create scarfs at cut off points
		vec2 tTombMat = min_mat( vec2(tTomb, MAT_TOMB), vec2(tombScarf, MAT_TOMB_SCARF));
		mainTomb = min_mat( mainTomb, tTombMat);
	}
	return mainTomb;
}

//==========================================================================================
// The main map function
//==========================================================================================
vec2 map( in vec3 pos )
{
	vec2 character = sdCharacter(pos);
	vec2 res = character;

	// I am assuming that since character covers a large portion of screen
	// This early out should help and same with the terrain. Assumption only,
	// need to look into it
    if( res.x > 0.01 )
    {
    	float desert = sdTerrain(pos);
	    vec2 terrain   = sdDesert( pos, desert );
	    vec2 trail	   = vec2(-sdCharacterTrail(pos, desert), MAT_TERRAIN_TRAIL );
	    terrain.y		= terrain.x > trail.x ? terrain.y : trail.y;
		terrain.x		= smax( terrain.x, trail.x, 0.05);

		res	= min_mat( res, terrain);
        if( terrain.x > 0.01 )
        {
			vec2 tombs	   =  sdTombs(pos);
            res = smin_mat( res, tombs, 0.2, 0.15 );

            vec2 pyramid   = vec2(sdBigMountain(pos), MAT_PYRAMID);
            res = min_mat( res, pyramid );

            vec2 clouds	   = sdClouds(pos);
            res = min_mat( res, clouds );

            vec2 flyingHelpers = sdFlyingHelpers( pos );
            res = min_mat( res, flyingHelpers );
        }
	}
    return res;
}


//==========================================================================================
// Used for generating normals. As it turns out that only the big mountain doesn't need
// normals. Everything else does. Hey Ho!
//==========================================================================================
vec2 mapSimple( in vec3 pos )
{
	return map( pos );
	/*
    vec2 character = sdCharacter(pos);
    vec2 flyingHelpers = vec2( sdFlyingHelpers( pos ), 50.0 );
    vec2 clouds	   = sdClouds(pos);
   	float desert   = sdTerrain(pos);
    vec2 terrain   = sdDesert( pos, desert );
    terrain.x = smax( terrain.x, -sdCharacterTrail(pos, desert), 0.1 );
    vec2 tombs	   =  vec2(sdTombs(pos), 50.0);

    vec2 res = character;
    min_mat( res, flyingHelpers );
	res = min_mat( res, clouds );
    res	= min_mat( res, terrain);
    res	= min_mat( res, flyingHelpers);
    res = smin_mat( res, tombs, 0.2, 0.15 );
    return res;
    */
}

//==========================================================================================
// Raycasting: https://www.shadertoy.com/view/Xds3zN
//==========================================================================================
vec3 castRay(vec3 ro, vec3 rd)
{
    float tmin = 0.1;
    float tmax = _DrawDistance;

    float t = tmin;
    float m = -1.0;
    float p = 0.0;
    float maxSteps = _MaxSteps;
    float j = 0.0;
    for( float i = 0.0; i < _MaxSteps; i += 1.0 )
    {
        j = i;
	    float precis = 0.0005*t;
	    vec2 res = map( ro+rd*t );
        if( res.x<precis || t>tmax )
        	break;
        t += res.x;
	    m = res.y;
    }
	p = j / maxSteps;
    if( t>tmax ) m=-1.0;
    return vec3( t, m, p );
}

vec3 calcNormal( in vec3 pos )
{
    vec2 e = vec2(1.0,-1.0)*0.5773*0.0005;
    return normalize( e.xyy*mapSimple( pos + e.xyy ).x +
					  e.yyx*mapSimple( pos + e.yyx ).x +
					  e.yxy*mapSimple( pos + e.yxy ).x +
					  e.xxx*mapSimple( pos + e.xxx ).x );
}

//==========================================================================================
// Ambient Occlusion, only applied to the Traveller
//==========================================================================================
float AmbientOcclusion(vec3 p, vec3 N, float stepSize, float k)
{
    float r = 0.0;
    float t = 0.0;

    for(int i = 0; i < 2; i++)
    {
        t += stepSize;
        r += (1.0 / pow(2.0, t)) * (t - sdCharacter(p + (N * t)).x);
    }
    return max(0.0, 1.0 - (k * r));
}

//==========================================================================================
// Simplified version of Traveller for shadow casting
//==========================================================================================
float sdCharacterShadow( vec3 pos )
{
    pos -= _CharacterPosition;
    vec3 scale = _CharacterScale;
    float scaleMul = min(scale.x, min(scale.y, scale.z));

    rY(pos, _CharacterRotation);

    pos /= scale;

    float mainCloak = sdMainCloak( pos );
    float longScarf = sdScarf(pos);

    return min( mainCloak, longScarf) * scaleMul;
}

//==========================================================================================
// Only character, flying helpers and tombs cast shadows. Only terrain recieves shadows
//==========================================================================================
float softShadow( in vec3 ro, in vec3 rd, float mint, float maxt, float k )
{
    float res = 1.0;
    float t = mint;
    for(int i = 0; i < 100; ++i)
    {
        if (t >= maxt) {
            break;
        }
    	float flyingHelpers = sdFlyingHelpers( ro + rd * t).x;
    	float tombs = sdTombs( ro + rd * t ).x;
        float h = min( sdCharacterShadow( ro + rd*t), min(flyingHelpers, tombs) );
        if( h<0.001 )
            return 0.1;
        res = min( res, k*h/t );
        t += h;
    }
	return res;
}

//==========================================================================================
// Hi Hussain!
// Again, somebody wrote Hi Hussain here. It wasn't me, but hi back atcha!
// Sky
//==========================================================================================
vec3 sky( vec3 ro, vec3 rd )
{
    // Sun calculation
    float sunDistance = length( _SunPosition );

    vec3 delta = _SunPosition.xyz - (ro + rd * sunDistance);
    float dist 	= length(delta);

    // Turn Sun into a star, because the big mountain has a star like shape
    // coming from top
    delta.xy *= _SunStar.xy;
    float sunDist = length(delta);
    float spot = 1.0 - smoothstep(0.0, _SunSize, sunDist);
    vec3 sun = clamp(_SunScale * spot * spot * spot, 0.0, 1.0) * _SunColor.rgb;

	// Changing color on bases of distance from Sun. To get a strong halo around
	// the sun
   	float expDist = clamp((dist - _ExposureOffset)  * _ExposureStrength, 0.0, 1.0);
   	float expControl = pow(expDist,_ExposurePower);

    // Sky colors
    float y = rd.y;
    float zen = 1.0 - pow (min (1.0, 1.0 - y), _ZenithFallOff);
    vec3 zenithColor	= _Zenith.rgb  * zen;
    zenithColor = mix( _SunColor.rgb, zenithColor, expControl );

    float nad = 1.0 - pow (min (1.0, 1.0 + y), _NadirFallOff);
    vec3 nadirColor	= _Nadir.rgb * nad;

    float hor = 1.0 - zen - nad;
    vec3 horizonColor	= _Horizon.rgb * hor;

    // Add stars for Color Scheme 3
float stars  = 0.0;
#if COLOR_SCHEME == 3
    vec3 starPos = ro + ( (rd + vec3(iTime * 0.001, 0.0, 0.0) ) * sunDistance);
    starPos.xyz += iTime*0.01 + noised(starPos.xy) * 3.0;

    starPos      = mod( starPos, 1.5) - 0.75;
    stars  		 = length(starPos);

	float starsA 	= (step( 0.9, 1.0 - stars) * 1.0 - (stars)) * 2.0;
	float starsB	= (step( 0.93, 1.0 - stars) * 1.0 - (stars)) * 1.5;
	stars = starsA + starsB;

    stars = stars * pow(zen * expControl, 5.0);
    stars = step( 0.01, stars) * stars * 2.0;
#endif
    return stars + (sun * _SunStar.z + zenithColor + horizonColor + nadirColor);
}

//==========================================================================================
// The rendering, based on: https://www.shadertoy.com/view/Xds3zN
//==========================================================================================
vec3 render( in vec3 ro, in vec3 rd )
{
	// res.z contains the iteration count / max iterations. This gives kind of a nice glow
	// effect around foreground objects. Looks particularly nice on sky, with clouds in
	// front and also on terrain. Gives rim kind of look!
	vec3 res	= castRay(ro,rd);
	vec3 skyCol = sky( ro, rd );
	vec3 col	= skyCol;

	#if defined (DEBUG_PERFORMANCE)
	return (res.z);
	#endif

	float t = res.x;
	float m = res.y;

	vec3 pos = ro + t*rd;

	// Return sky
	if( m < 0.0 )
	{
		// Bloom for the background clouds. We want Big Mountain to be engulfed with fog. So just chop out
		// areas around right and left side of BigMountain for creating fake bloom for background clouds by
		// using the iteration count needed to generate the distance function
		float rightSideCloudDist = length( (ro + rd * length(_SunPosition)) - vec3(45.0, -5.0, _SunPosition.z));
		float leftSideCloudDist = length( (ro + rd * length(_SunPosition)) - vec3(-50.0, -5.0, _SunPosition.z));
		if( rightSideCloudDist < 40.0 )
		{
			float smoothCloudBloom = 1.0 - smoothstep( 0.8, 1.0, rightSideCloudDist / 40.0);
			return col + res.z * res.z * 0.2 * smoothCloudBloom;
		}
		else if( leftSideCloudDist < 40.0 )
		{
			float smoothCloudBloom = 1.0 - smoothstep( 0.8, 1.0, leftSideCloudDist / 40.0);
			return col + res.z * res.z * 0.2 * smoothCloudBloom;
		}
        else
			return col;
	}

	float skyFog = 1.0-exp( _FogMul * t * pow(pos.y, _FogPow) );
	#if defined (DEBUG_FOG)
	return (skyFog);
	#endif

	// Render the big mountain. Keep track of it's color, so we can use it for transparency for clouds later
	vec3 pyramidCol = vec3(0.0, 0.0, 0.0);
	pyramidCol		= mix( _PyramidCol, skyCol, skyFog * 0.5  );

	if( TEST_MAT_LESS( m, MAT_PYRAMID) )
	{
		// Height fog, with strong fade to sky
		float nh = (pos.y / _PyramidHeightFog.x);
		nh = nh*nh*nh*nh*nh;
		float heightFog = pow(clamp(1.0 - (nh), 0.0, 1.0), _PyramidHeightFog.y);
		heightFog		= clamp( heightFog, 0.0, 1.0 );
		pyramidCol		= mix( pyramidCol, skyCol, heightFog );
		return pyramidCol;
	}

	// Calculate normal after calculating sky and big mountain
	vec3 nor = calcNormal(pos);
	// Terrain: https://archive.org/details/GDC2013Edwards
	if( TEST_MAT_LESS (m, MAT_TERRAIN_TRAIL ) )
	{
		float shadow = softShadow( pos - (rd * 0.01), _LightDir.xyz, _TerrainShadowParams.x, _TerrainShadowParams.y, _TerrainShadowParams.z);
		shadow		 = clamp( shadow + _TerrainShadowParams.w, 0.0, 1.0 );

		vec3 shadowCol = mix( shadow * _TerrainShadowColor, _TerrainDistanceShadowColor, pow(skyFog, _TerrainFogPower * _TerrainDistanceShadowPower) );

		// Strong rim lighting
		float rim	= (1.0 - saturate(dot( nor , -rd )));
		rim			= saturate(pow( rim, _TerrainRimPower)) *_TerrainRimStrength ;
		vec3 rimColor	= rim * _TerrainRimColor;

		// Specular highlights
		vec3 ref		= reflect(rd, nor);
	    vec3 halfDir	= normalize(_LightDir + rd);

	    // The strong ocean specular highlight
	    float mainSpec = clamp( dot( ref, halfDir ), 0.0, 1.0 );
	    if ( TEST_MAT_LESS( m, MAT_TERRAIN ) )
	        mainSpec = pow( mainSpec, _TerrainSpecPower ) * _TerrainSpecStrength * 2.0 ;
	    else
	        mainSpec = pow( mainSpec, _TerrainSpecPower ) * _TerrainSpecStrength * 4.0;

	    float textureGlitter  = textureLod(iChannel1,pos.xz * _TerrainGlitterRep, 2.2).x * 1.15;
	    textureGlitter	= pow(textureGlitter , _TerrainGlitterPower);
	    mainSpec 		*= textureGlitter;

		// The glitter around terrain, looks decent based on rim value
	    float rimSpec	= (pow(rim, _TerrainRimSpecPower)) * textureGlitter;
	    vec3 specColor	= (mainSpec + rimSpec) * _TerrainSpecColor;
		vec3 terrainCol	= mix( (rimColor + specColor * shadow) + _TerrainCol, skyCol, pow(skyFog, _TerrainFogPower) ) + res.z * 0.2;

		// maybe add a fake AO from player, just a sphere should do!
		return mix( shadowCol, terrainCol, shadow );
	}

	// Clouds
	if( TEST_MAT_LESS (m, MAT_FRONT_CLOUDS ) )
	{
		// Modify the normals so that they create strong specular highlights
		// towards the top edge of clouds
		nor				= normalize( nor + _CloudNormalMod);
		float dotProd	= dot( nor, vec3(1.0,-3.5,1.0) );

		float spec		=  1.0 -  clamp( pow(dotProd, _CloudSpecPower), 0.0, 1.0 );
		spec 			*= 2.0;
		vec3 cloudCol	= spec * _CloudSpecCol + _CloudCol;

		// Transparency for mountain
		if( sdBigMountain( pos + (rd * t * _CloudPyramidDistance)) < 0.2 )
	 	{
	 		cloudCol = mix( pyramidCol, cloudCol, _CloudTransparencyMul );
		}

		// Mixing for backdrop mountains. Backdrop mountains take more color from Sky. Foreground mountains
		// retain their own color values, so I can adjust their darkness
		vec3 inCloudCol = mix(cloudCol, _BackCloudCol + skyCol * 0.5 + spec * _BackCloudSpecCol, MAT_FRONT_CLOUDS - m);
		return mix( inCloudCol , skyCol, skyFog * _CloudFogStrength );
	}

	// Tombs
	if( TEST_MAT_LESS(m, MAT_TOMB_SCARF ) )
	{
		// Simple strong diffuse
		float diff	= clamp(dot(nor,_LightDir) + 1.0, 0.0, 1.0);
		vec3 col	= mix( _TombMainColor, _TombScarfColor * 2.0, m - MAT_TOMB );
		return mix( diff * col, skyCol, skyFog);
	}

	// Flying Helpers
	if( TEST_MAT_LESS(m, MAT_FLYING_HELPER_SCARF ) )
	{
		float fres	= pow( clamp(1.0+dot(nor,rd) + 0.75,0.0,1.0), _FlyingHelperFrePower ) * _FlyingHelperFreScale;
		float diff	= clamp(dot(nor,_LightDir) + 1.5,0.0,1.0);
		vec3 col = _FlyingHelperYellowColor;

		// The main head
		if ( TEST_MAT_LESS( m, MAT_FLYING_HELPERS ) )
		{
			col = _FlyingHelperMainColor;

			// Yellow borders
			float outerBorder = step( 0.95, abs(helperScarfMatUVW.x * 2.0 - 1.0) );
			col  = mix( col * diff, _FlyingHelperYellowColor,  outerBorder );

			// cubes in middle
			float rectsY = abs(helperScarfMatUVW.z * 2.0 - 1.0);
			float rectsX = abs(helperScarfMatUVW.x * 2.0 - 1.0);

			float circles = 1.0 - (length( vec2(rectsY, rectsX) ) - 0.1);
			circles = step( 0.5, circles );

			// Ideally want to do a separate bass for bloom. maybe one day
			float bloomCircle = 1.0 - (length( vec2(rectsY, rectsX) ) - 0.1);
			float bloom  = max( bloomCircle - 0.5, 0.0);

			rectsY = step( 0.5, abs(rectsY * 2.0 - 1.0) );
			rectsX = 1.0 - step( 0.5, abs(helperScarfMatUVW.x * 2.0 - 1.0) );

			float rects = min(rectsX, rectsY);

			float symbolsX = fract(rects/(helperScarfMatUVW.z * 20.0) * 20.0);
			float symbolsY = fract(rects/(helperScarfMatUVW.x * 2.0) * 2.0);
			float symbolsZ = fract(rects/((helperScarfMatUVW.z + 0.1) * 16.0) * 16.0);
			float symbolsW = fract(rects/((helperScarfMatUVW.x + 0.1) * 3.0) * 3.0);

			float symbols = symbolsY;
			symbols = max( symbols, symbolsZ );
			symbols = min(symbols , max(symbolsX, symbolsW));
			symbols = step( 0.5, symbols );

			symbols = min( symbols, circles );

			//  float rects = min(rectsX, max(circles,rectsY));

			col = mix( col, _FlyingHelperYellowColor, circles);
			col = mix( col, _FlyingHelperWhiteColor * 2.0, symbols)  + bloom  * _FlyingHelperBloomScale;
		}
		else
		{
			// The scarfs, just have a yellow border
			float outerBorder = step( 0.9, abs(helperScarfMatUVW.x * 2.0 - 1.0) );
			col 	= mix( _FlyingHelperMainColor * diff, _FlyingHelperYellowColor,  outerBorder );
		}
		return mix( fres * col, skyCol, skyFog * _FlyingHelperFogScale );
	}

	// Character
	if( TEST_MAT_GREATER (m, MAT_CHARACTER_BASE ) )
	{
		float diff = _CharacterDiffScale * clamp( dot( nor, _LightDir ), 0.0, 1.0 );

		// Why did I fudge these normals, I can't remember. It does look good though, so keep it :)
		nor		= normalize( nor + vec3(0.3,-0.1,1.0));
		nor.y	*= 0.3;

		float fres	= pow( clamp( 1.0 + dot(nor,rd) + 0.75, 0.0, 1.0), _CharacterFrePower ) * _CharacterFreScale;
		vec3 col	= _CharacterMainColor;

		// Just base color
		if( TEST_MAT_LESS( m, MAT_CHARACTER_BASE) )
		{
			// Add sand fade to legs. Mixing terrain color at bottom of legs
			float heightTerrainMix	= pow((pos.y / _CharacterHeightTerrainMix.x), _CharacterHeightTerrainMix.y);
			heightTerrainMix		= clamp( heightTerrainMix, 0.0, 1.0 );
			col	= mix( _CharacterMainColor, _CharacterTerrainCol, heightTerrainMix );
		}
		// Main Cloak
		else if( TEST_MAT_LESS( m,MAT_CHARACTER_MAIN_CLOAK) )
		{
			// Cone kind of shapes
			float rectsX	= fract(atan(mainCloakMatUVW.x/ mainCloakMatUVW.z) * 7.0) ;
			rectsX			= abs(rectsX * 2.0 - 1.0);
			float rects		= rectsX;
			rects			= step( 0.5, rects * (1.0 - mainCloakMatUVW.y*3.5) );
			col = mix( col, _CharacterCloakDarkColor, rects );

			// Yellow borders, two lines
			float outerBorder		= step( 0.915, abs(mainCloakMatUVW.y * 2.0 - 1.0) );
			float betweenBorders	= step( 0.88, abs(mainCloakMatUVW.y * 2.0 - 1.0) );
			float innerBorder		= step( 0.87, abs(mainCloakMatUVW.y * 2.0 - 1.0) );

			innerBorder = min( innerBorder, 1.0 - betweenBorders );

			col  = mix( col, _CharacterCloakDarkColor,  betweenBorders );
			col  = mix( col, _CharacterYellowColor,  outerBorder );
			col  = mix( col, _CharacterYellowColor,  innerBorder);

			// The verticle cubes/lines running across the bottom of cloak
			float cubes = abs(fract(atan(mainCloakMatUVW.x/ mainCloakMatUVW.z) * 10.0)  * 2.0 - 1.0);
			cubes		= min(betweenBorders, step( 0.9, cubes) );
			col			= mix( col, _CharacterYellowColor,  cubes);
		}
		// headscarf
		else if( TEST_MAT_LESS( m, MAT_CHARACTER_NECK_SCARF) )
		{
			col = mix( col, _CharacterYellowColor, step( 0.7, headScarfMatUVW.y) );
		}
		// Long Scarf
		else if( TEST_MAT_LESS( m, MAT_CHARACTER_LONG_SCARF) )
		{
			col = _CharacterYellowColor;

			// Yellow borders, two lines
			float outerBorder = step( 0.9, abs(longScarfMatUVW.x * 2.0 - 1.0) );
			float innerBorder = step( 0.7, abs(longScarfMatUVW.x * 2.0 - 1.0) );

			innerBorder = min( innerBorder, 1.0 - step( 0.8, abs(longScarfMatUVW.x * 2.0 - 1.0) ) );

			// Mix borders
			col  = mix( col, _CharacterMainColor,  outerBorder );
			col  = mix( col, _CharacterMainColor,  innerBorder);

			// cubes in middle
			float rectsY = abs(fract( longScarfMatUVW.y/ 0.10 ) * 2.0 - 1.0);// - 0.5 * 0.10;
			float rectsX = abs(longScarfMatUVW.x * 2.0 - 1.0);

			float circles = 1.0 - (length( vec2(rectsY, rectsX) ) - 0.1);
			circles = step( 0.5, circles );

			float bloomCircle	= 1.0 - (length( vec2(rectsY, rectsX * 0.7) ) - 0.1);
			float bloom 		= max( bloomCircle - 0.45, 0.0);

			rectsY = step( 0.5, abs(rectsY * 2.0 - 1.0) );
			rectsX = 1.0 - step( 0.5, abs(longScarfMatUVW.x * 2.0 - 1.0) );

			float rects = min(rectsX, rectsY);

			// There are better ways of doing symbols. Spend some time on it, buddy!
			float symbolsX = fract(rects/(longScarfMatUVW.y * 0.17) * 10.0);
			float symbolsY = fract(rects/(longScarfMatUVW.x * 18.5) * 10.0);

			float symbols	= symbolsX;
			symbols			= max( symbols, symbolsY );
			symbols			= step( 0.5, symbols );

			symbols = min( symbols, circles );

			//        float rects = min(rectsX, max(circles,rectsY));
			col = mix( col, _CharacterMainColor, circles);
			col = mix( col, _CharacterWhiteColor * 2.0, symbols)  + bloom * _CharacterBloomScale;

			// White glow and disintegrating the scarf, showing depleting scarf energy. Needs bloom effect :(
			col = mix( col, _CharacterMainColor, 1.0 - smoothstep(0.4, 0.6, longScarfMatUVW.y));
			vec3 whiteMiddle = mix( col, _CharacterWhiteColor + bloom * _CharacterBloomScale, step(0.48, longScarfMatUVW.y));
			col = mix( whiteMiddle, col, step(0.5, longScarfMatUVW.y));
		}
		// Face
		else if( TEST_MAT_LESS( m, MAT_CHARACTER_FACE)  )
		{
			col = vec3(0,0,0);
		}
		float ao = AmbientOcclusion(pos - (rd * 0.01), nor, _CharacterAOParams.x, _CharacterAOParams.y);
		return ao * mix( (fres + diff) * col, skyCol, skyFog * _CharacterFogScale );
	}
	return vec3( clamp(col * 0.0,0.0,1.0) );
}


float rand(float n)
{
	return fract(sin(n) * 43758.5453123);
}

float noise(float p)
{
	float fl = floor(p);
	float fc = fract(p);
    fc = fc*fc*(3.0-2.0*fc);
    return mix(rand(fl), rand(fl + 1.0), fc);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	// Move camera using noise. This is probably quite expensive way of doing it :(
	float unitNoiseX = (noise(iTime * _CameraMovement.w ) * 2.0)  - 1.0;
	float unitNoiseY = (noise((iTime * _CameraMovement.w ) + 32.0) * 2.0)  -1.0;
	float unitNoiseZ = (noise((iTime * _CameraMovement.w ) + 48.0) * 2.0)  -1.0;
	vec3 ro = _CameraPos + vec3(unitNoiseX, unitNoiseY, unitNoiseZ) * _CameraMovement.xyz;


	vec3 screenRay		= vec3(fragCoord / iResolution.xy, 1.0);
	vec2 screenCoord	= screenRay.xy * 2.0 - 1.0;

	// Screen ray frustum aligned
	screenRay.xy = screenCoord * _CameraFOV.xy;
    screenRay.x			*= 1.35;
	screenRay.z  = -_CameraFOV.z;
	screenRay /= abs( _CameraFOV.z);

    // In camera space
	vec3 rd = normalize(mul( _CameraInvViewMatrix, vec4(screenRay,0.0))).xyz;

	// Do the render
	vec4 col = vec4(render(ro, rd), 0.0);

	// No it does not need gamma correct or tone mapping or any other effect that you heard about
	// and thought was cool. This is not realistic lighting

	// vignette
	float vig = pow(1.0 - 0.4 * dot(screenCoord, screenCoord), 0.6) * 1.25;
	vig = min( vig, 1.0);
	col *= vig;

	// Final color
	fragColor =  col;
}
