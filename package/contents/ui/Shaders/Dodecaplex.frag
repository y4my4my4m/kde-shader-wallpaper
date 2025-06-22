// url: https://www.shadertoy.com/view/NtBfDc
// by afoksha

//==============================================================================================================================================================
//  Created by Alexander Foksha
//
//  Do with this or without this code whatever you wish at your own risk.
//  You have been warned !!
//==============================================================================================================================================================


#if 0

/* =========================== Binary icosahedral group =========================== */

const vec4 BI[120] = vec4[]
{
    /* 4-vector with components {x, y, z, w} represents quaternion w + xi + yj + zk */

    /* 8 basic unit quaternions :: ±1, ±i, ±j, ±k */
    /* these eight elements form a subgroup S */
    /*               g0 = */ vec4( 0.0,  0.0,  0.0,  1.0),      /* +1, order :: 1  */
    /*               g1 = */ vec4( 0.0,  0.0,  0.0, -1.0),      /* -1, order :: 2  */
    /*               g2 = */ vec4( 1.0,  0.0,  0.0,  0.0),      /* +i, order :: 4  */
    /*               g3 = */ vec4(-1.0,  0.0,  0.0,  0.0),      /* -i, order :: 4  */
    /*               g4 = */ vec4( 0.0,  1.0,  0.0,  0.0),      /* +j, order :: 4  */
    /*               g5 = */ vec4( 0.0, -1.0,  0.0,  0.0),      /* -j, order :: 4  */
    /*               g6 = */ vec4( 0.0,  0.0,  1.0,  0.0),      /* +k, order :: 4  */
    /*               g7 = */ vec4( 0.0,  0.0, -1.0,  0.0),      /* -k, order :: 4  */

    /* 16 unit Hurwitz quaternions */
    /* these 16 elements together with first 8 form a subgroup H (Hurwitz subgroup) */
    /* as a union of right conjugacy classes H = { S * g0, S * g8, S * g16 } */
    /* as a point set they form vertices of the octaplex, self-dual 24-cell in spherical space */

    /*   g8 =   1 *  g8 = */ vec4( 0.5,  0.5,  0.5,  0.5),      /* order :: 6  */
    /*   g9 =  -1 *  g8 = */ vec4(-0.5, -0.5, -0.5, -0.5),      /* order :: 3  */
    /*  g10 =   i *  g8 = */ vec4( 0.5,  0.5, -0.5, -0.5),      /* order :: 3  */
    /*  g11 =  -i *  g8 = */ vec4(-0.5, -0.5,  0.5,  0.5),      /* order :: 6  */
    /*  g12 =   j *  g8 = */ vec4(-0.5,  0.5,  0.5, -0.5),      /* order :: 3  */
    /*  g13 =  -j *  g8 = */ vec4( 0.5, -0.5, -0.5,  0.5),      /* order :: 6  */
    /*  g14 =   k *  g8 = */ vec4( 0.5, -0.5,  0.5, -0.5),      /* order :: 3  */
    /*  g15 =  -k *  g8 = */ vec4(-0.5,  0.5, -0.5,  0.5),      /* order :: 6  */

    /*  g16 =   1 * g16 = */ vec4( 0.5,  0.5,  0.5, -0.5),      /* order :: 3  */
    /*  g17 =  -1 * g16 = */ vec4(-0.5, -0.5, -0.5,  0.5),      /* order :: 6  */
    /*  g18 =   i * g16 = */ vec4(-0.5,  0.5, -0.5, -0.5),      /* order :: 3  */
    /*  g19 =  -i * g16 = */ vec4( 0.5, -0.5,  0.5,  0.5),      /* order :: 6  */
    /*  g20 =   j * g16 = */ vec4(-0.5, -0.5,  0.5, -0.5),      /* order :: 3  */
    /*  g21 =  -j * g16 = */ vec4( 0.5,  0.5, -0.5,  0.5),      /* order :: 6  */
    /*  g22 =   k * g16 = */ vec4( 0.5, -0.5, -0.5, -0.5),      /* order :: 3  */
    /*  g23 =  -k * g16 = */ vec4(-0.5,  0.5,  0.5,  0.5),      /* order :: 6  */

    /* the whole group B is a union of 5 conjugacy classes w.r.t subgroup H
       B = { H * g0, H * g24, H * g48, H * g72, H * g96 } */

    /*  g24 =  g0 * g24 = */ vec4( psi,  0.0,  0.5,  phi),      /* order :: 10 */
    /*  g25 =  g1 * g24 = */ vec4(-psi,  0.0, -0.5, -phi),      /* order :: 5  */
    /*  g26 =  g2 * g24 = */ vec4( phi, -0.5,  0.0, -psi),      /* order :: 5  */
    /*  g27 =  g3 * g24 = */ vec4(-phi,  0.5,  0.0,  psi),      /* order :: 10 */
    /*  g28 =  g4 * g24 = */ vec4( 0.5,  phi, -psi,  0.0),      /* order :: 4  */
    /*  g29 =  g5 * g24 = */ vec4(-0.5, -phi,  psi,  0.0),      /* order :: 4  */
    /*  g30 =  g6 * g24 = */ vec4( 0.0,  psi,  phi, -0.5),      /* order :: 3  */
    /*  g31 =  g7 * g24 = */ vec4( 0.0, -psi, -phi,  0.5),      /* order :: 6  */
    /*  g32 =  g8 * g24 = */ vec4( phi,  psi,  0.5,  0.0),      /* order :: 4  */
    /*  g33 =  g9 * g24 = */ vec4(-phi, -psi, -0.5,  0.0),      /* order :: 4  */
    /*  g34 = g10 * g24 = */ vec4( phi,  0.0, -psi,  0.5),      /* order :: 6  */
    /*  g35 = g11 * g24 = */ vec4(-phi,  0.0,  psi, -0.5),      /* order :: 3  */
    /*  g36 = g12 * g24 = */ vec4( psi, -0.5,  phi,  0.0),      /* order :: 4  */
    /*  g37 = g13 * g24 = */ vec4(-psi,  0.5, -phi,  0.0),      /* order :: 4  */
    /*  g38 = g14 * g24 = */ vec4( psi, -phi,  0.0,  0.5),      /* order :: 6  */
    /*  g39 = g15 * g24 = */ vec4(-psi,  phi,  0.0, -0.5),      /* order :: 3  */
    /*  g40 = g16 * g24 = */ vec4( 0.0,  phi,  0.5,  psi),      /* order :: 10 */
    /*  g41 = g17 * g24 = */ vec4( 0.0, -phi, -0.5, -psi),      /* order :: 5  */
    /*  g42 = g18 * g24 = */ vec4( 0.0,  0.5, -psi,  phi),      /* order :: 10 */
    /*  g43 = g19 * g24 = */ vec4( 0.0, -0.5,  psi, -phi),      /* order :: 5  */
    /*  g44 = g20 * g24 = */ vec4(-0.5,  0.0,  phi,  psi),      /* order :: 10 */
    /*  g45 = g21 * g24 = */ vec4( 0.5,  0.0, -phi, -psi),      /* order :: 5  */
    /*  g46 = g22 * g24 = */ vec4(-0.5, -psi,  0.0,  phi),      /* order :: 10 */
    /*  g47 = g23 * g24 = */ vec4( 0.5,  psi,  0.0, -phi),      /* order :: 5  */

    /*  g48 =  g0 * g48 = */ vec4(-psi,  0.0,  0.5,  phi),      /* order :: 10 */
    /*  g49 =  g1 * g48 = */ vec4( psi,  0.0, -0.5, -phi),      /* order :: 5  */
    /*  g50 =  g2 * g48 = */ vec4( phi, -0.5,  0.0,  psi),      /* order :: 10 */
    /*  g51 =  g3 * g48 = */ vec4(-phi,  0.5,  0.0, -psi),      /* order :: 5  */
    /*  g52 =  g4 * g48 = */ vec4( 0.5,  phi,  psi,  0.0),      /* order :: 4  */
    /*  g53 =  g5 * g48 = */ vec4(-0.5, -phi, -psi,  0.0),      /* order :: 4  */
    /*  g54 =  g6 * g48 = */ vec4( 0.0, -psi,  phi, -0.5),      /* order :: 3  */
    /*  g55 =  g7 * g48 = */ vec4( 0.0,  psi, -phi,  0.5),      /* order :: 6  */
    /*  g56 =  g8 * g48 = */ vec4( 0.5,  0.0,  phi,  psi),      /* order :: 10 */
    /*  g57 =  g9 * g48 = */ vec4(-0.5,  0.0, -phi, -psi),      /* order :: 5  */
    /*  g58 = g10 * g48 = */ vec4( 0.5,  psi,  0.0,  phi),      /* order :: 10 */
    /*  g59 = g11 * g48 = */ vec4(-0.5, -psi,  0.0, -phi),      /* order :: 5  */
    /*  g60 = g12 * g48 = */ vec4( 0.0, -phi,  0.5,  psi),      /* order :: 10 */
    /*  g61 = g13 * g48 = */ vec4( 0.0,  phi, -0.5, -psi),      /* order :: 5  */
    /*  g62 = g14 * g48 = */ vec4( 0.0, -0.5, -psi,  phi),      /* order :: 10 */
    /*  g63 = g15 * g48 = */ vec4( 0.0,  0.5,  psi, -phi),      /* order :: 5  */
    /*  g64 = g16 * g48 = */ vec4(-psi,  0.5,  phi,  0.0),      /* order :: 4  */
    /*  g65 = g17 * g48 = */ vec4( psi, -0.5, -phi,  0.0),      /* order :: 4  */
    /*  g66 = g18 * g48 = */ vec4(-psi,  phi,  0.0,  0.5),      /* order :: 6  */
    /*  g67 = g19 * g48 = */ vec4( psi, -phi,  0.0, -0.5),      /* order :: 3  */
    /*  g68 = g20 * g48 = */ vec4(-phi, -psi,  0.5,  0.0),      /* order :: 4  */
    /*  g69 = g21 * g48 = */ vec4( phi,  psi, -0.5,  0.0),      /* order :: 4  */
    /*  g70 = g22 * g48 = */ vec4(-phi,  0.0, -psi,  0.5),      /* order :: 6  */
    /*  g71 = g23 * g48 = */ vec4( phi,  0.0,  psi, -0.5),      /* order :: 3  */

    /*  g72 =  g0 * g72 = */ vec4( 0.0,  0.5,  psi,  phi),      /* order :: 10 */
    /*  g73 =  g1 * g72 = */ vec4( 0.0, -0.5, -psi, -phi),      /* order :: 5  */
    /*  g74 =  g2 * g72 = */ vec4( phi, -psi,  0.5,  0.0),      /* order :: 4  */
    /*  g75 =  g3 * g72 = */ vec4(-phi,  psi, -0.5,  0.0),      /* order :: 4  */
    /*  g76 =  g4 * g72 = */ vec4( psi,  phi,  0.0, -0.5),      /* order :: 3  */
    /*  g77 =  g5 * g72 = */ vec4(-psi, -phi,  0.0,  0.5),      /* order :: 6  */
    /*  g78 =  g6 * g72 = */ vec4(-0.5,  0.0,  phi, -psi),      /* order :: 5  */
    /*  g79 =  g7 * g72 = */ vec4( 0.5,  0.0, -phi,  psi),      /* order :: 10 */
    /*  g80 =  g8 * g72 = */ vec4( psi,  0.5,  phi,  0.0),      /* order :: 4  */
    /*  g81 =  g9 * g72 = */ vec4(-psi, -0.5, -phi,  0.0),      /* order :: 4  */
    /*  g82 = g10 * g72 = */ vec4( phi,  0.5,  0.0,  psi),      /* order :: 10 */
    /*  g83 = g11 * g72 = */ vec4(-phi, -0.5,  0.0, -psi),      /* order :: 5  */
    /*  g84 = g12 * g72 = */ vec4( 0.0, -psi,  phi,  0.5),      /* order :: 6  */
    /*  g85 = g13 * g72 = */ vec4( 0.0,  psi, -phi, -0.5),      /* order :: 3  */
    /*  g86 = g14 * g72 = */ vec4( 0.5, -psi,  0.0,  phi),      /* order :: 10 */
    /*  g87 = g15 * g72 = */ vec4(-0.5,  psi,  0.0, -phi),      /* order :: 5  */
    /*  g88 = g16 * g72 = */ vec4(-0.5,  phi,  psi,  0.0),      /* order :: 4  */
    /*  g89 = g17 * g72 = */ vec4( 0.5, -phi, -psi,  0.0),      /* order :: 4  */
    /*  g90 = g18 * g72 = */ vec4( 0.0,  phi, -0.5,  psi),      /* order :: 10 */
    /*  g91 = g19 * g72 = */ vec4( 0.0, -phi,  0.5, -psi),      /* order :: 5  */
    /*  g92 = g20 * g72 = */ vec4(-phi,  0.0,  psi,  0.5),      /* order :: 6  */
    /*  g93 = g21 * g72 = */ vec4( phi,  0.0, -psi, -0.5),      /* order :: 3  */
    /*  g94 = g22 * g72 = */ vec4(-psi,  0.0, -0.5,  phi),      /* order :: 10 */
    /*  g95 = g23 * g72 = */ vec4( psi,  0.0,  0.5, -phi),      /* order :: 5  */

    /*  g96 =  g0 * g96 = */ vec4( 0.0, -0.5,  psi,  phi),      /* order :: 10 */
    /*  g97 =  g1 * g96 = */ vec4( 0.0,  0.5, -psi, -phi),      /* order :: 5  */
    /*  g98 =  g2 * g96 = */ vec4( phi, -psi, -0.5,  0.0),      /* order :: 4  */
    /*  g99 =  g3 * g96 = */ vec4(-phi,  psi,  0.5,  0.0),      /* order :: 4  */
    /* g100 =  g4 * g96 = */ vec4( psi,  phi,  0.0,  0.5),      /* order :: 6  */
    /* g101 =  g5 * g96 = */ vec4(-psi, -phi,  0.0, -0.5),      /* order :: 3  */
    /* g102 =  g6 * g96 = */ vec4( 0.5,  0.0,  phi, -psi),      /* order :: 5  */
    /* g103 =  g7 * g96 = */ vec4(-0.5,  0.0, -phi,  psi),      /* order :: 10 */
    /* g104 =  g8 * g96 = */ vec4( phi,  0.0,  psi,  0.5),      /* order :: 6  */
    /* g105 =  g9 * g96 = */ vec4(-phi,  0.0, -psi, -0.5),      /* order :: 3  */
    /* g106 = g10 * g96 = */ vec4( psi,  0.0, -0.5,  phi),      /* order :: 10 */
    /* g107 = g11 * g96 = */ vec4(-psi,  0.0,  0.5, -phi),      /* order :: 5  */
    /* g108 = g12 * g96 = */ vec4( 0.5, -phi,  psi,  0.0),      /* order :: 4  */
    /* g109 = g13 * g96 = */ vec4(-0.5,  phi, -psi,  0.0),      /* order :: 4  */
    /* g110 = g14 * g96 = */ vec4( 0.0, -phi, -0.5,  psi),      /* order :: 10 */
    /* g111 = g15 * g96 = */ vec4( 0.0,  phi,  0.5, -psi),      /* order :: 5  */
    /* g112 = g16 * g96 = */ vec4( 0.0,  psi,  phi,  0.5),      /* order :: 6  */
    /* g113 = g17 * g96 = */ vec4( 0.0, -psi, -phi, -0.5),      /* order :: 3  */
    /* g114 = g18 * g96 = */ vec4(-0.5,  psi,  0.0,  phi),      /* order :: 10 */
    /* g115 = g19 * g96 = */ vec4( 0.5, -psi,  0.0, -phi),      /* order :: 5  */
    /* g116 = g20 * g96 = */ vec4(-psi, -0.5,  phi,  0.0),      /* order :: 4  */
    /* g117 = g21 * g96 = */ vec4( psi,  0.5, -phi,  0.0),      /* order :: 4  */
    /* g118 = g22 * g96 = */ vec4(-phi, -0.5,  0.0,  psi),      /* order :: 10 */
    /* g119 = g23 * g96 = */ vec4( phi,  0.5,  0.0, -psi),      /* order :: 5  */
}

#endif

const float phi = 0.8090169943749474f;  /* (sqrt(5) + 1) / 4 = psi + 0.5 */
const float psi = 0.3090169943749474f;  /* (sqrt(5) - 1) / 4 */

const float pi = 3.14159265358979324f;
const float two_pi = 6.28318530717958648f;

/* const vec4 g24 = vec4( psi,  0.0,  0.5,  phi); */
/* const vec4 g48 = vec4(-psi,  0.0,  0.5,  phi); */
/* const vec4 g72 = vec4( 0.0,  0.5,  psi,  phi); */
/* const vec4 g96 = vec4( 0.0, -0.5,  psi,  phi); */

/* right multiplications by basic quaternions i, j, k */
vec4 mulr_i(vec4 p) { return vec4(p.wz, -p.yx); }
vec4 mulr_j(vec4 p) { return vec4(-p.z, p.wx, -p.y); }
vec4 mulr_k(vec4 p) { return vec4(p.y, -p.x, p.w, -p.z); }

/*             | vertices | edges |        2-faces |        3-cells  | */
/* SIMPLEX     |        5 |    10 |   10 triangles |   5 tetrahedra  | */
/* TESSERACT   |       16 |    32 |   24 squares   |   8 cubes       | */
/* ORTHOPLEX   |        8 |    24 |   32 triangles |  16 tetrahedra  | */
/* OCTAPLEX    |       24 |    96 |   96 triangles |  24 octahedra   | */
/* DODECAPLEX  |      600 |  1200 |  720 pentagons | 120 dodecahedra | */
/* TETRAPLEX   |      120 |   720 | 1200 triangles | 600 icosahedra  | */

/* dot products are maximal when distances between points are minimal */

/*
   returns maximal dot product of p with the vertices of the octaplex
   which, as a point set, coincide with the Hurwitz subgroup of the
   binary icosahedral group

   24 points
*/
vec4 octaplex_max_dp4(vec4 p)
{
    /* (xi + yj + zk + w) * g8 =
       (xi + yj + zk + w) * (i + j + k + 1) / 2 =
        { +xi +yj +zk +w } +
        { +wi +zj -yk -x } +
        { -zi +wj +xk -y } +
        { +yi -xj +wk -z } =  p + s
    */
    vec4 s = mulr_i(p) + mulr_j(p) + mulr_k(p);
    vec4 p8 = 0.5 * (s + p);

    /* (xi + yj + zk + w) * g16 =
       (xi + yj + zk + w) * (i + j + k - 1) / 2 =
       -{ +xi +yj +zk +w }
        { +wi +zj -yk -x } +
        { -zi +wj +xk -y } +
        { +yi -xj +wk -z } = -p + s
    */
    vec4 p16 = 0.5 * (s - p);

    /* taking absolute value of the dot product computes minimum
       distance to the pair of opposite points on the sphere */
    return max(abs(p), max(abs(p8), abs(p16)));
}

float octaplex_max_dp1(vec4 p)
{
    vec4 s = mulr_i(p) + mulr_j(p) + mulr_k(p);
    vec4 p8 = 0.5 * (s + p);
    vec4 p16 = 0.5 * (s - p);

    vec4 dp = max(abs(p), max(abs(p8), abs(p16)));
    dp.xy = max(dp.xy, dp.zw);
    return max(dp.x, dp.y);
}

/*
const vec4 simplex[5] = vec4[]
(
    vec4(  gamma,  gamma,  gamma, -0.25),
    vec4(  gamma, -gamma, -gamma, -0.25),
    vec4( -gamma,  gamma, -gamma, -0.25),
    vec4( -gamma, -gamma,  gamma, -0.25),
    vec4(    0.0,    0.0,    0.0,   1.0)
);
*/
const float gamma = 0.5590169943749474f;  /* sqrt(5) / 4 */

/*
   returns maximal dot product of p with the vertices of the simplex,
   which does not fit into general scheme of working with binary icosahedral
   group and quaternions, so we just compute distances directly, also note that
   simplex is not symmetric about the origin, e.g if v is the vertex,
   then -v is not, so absolute values of the dot products should not be taken

   5 points
*/
float simplex_max_dp(vec4 p)
{
    float qw = 0.25f * p.w;
    float gx = gamma * p.x;
    float gy = gamma * p.y;
    float gz = gamma * p.z;

    /* four dot products */
    vec4 dp = vec4(
         gx +  gy +  gz - qw,
         gx + -gy + -gz - qw,
        -gx +  gy + -gz - qw,
        -gx + -gy +  gz - qw
    );

    dp.xy = max(dp.xy, dp.zw);

    /* the 5th dot product is simply p.w */
    return max(max(dp.x, dp.y), p.w);
}

/*
   returns maximal dot product of p with the vertices of the orthoplex, which,
   as a point set, coincide with basic quaternions { ±1, ±i, ±j, ±k }

   8 points
*/
float orthoplex_max_dp(vec4 p)
{
    vec4 d = abs(p);
    d.xy = max(d.xy, d.zw);
    return max(d.x, d.y);
}

/*
   returns maximal dot product of p with the vertices of the tesseract, which,
   as a point set, coincide with half-integral Hurwitz quaternions

   16 points
*/
float tesseract_max_dp(vec4 p)
{
    vec4 s = mulr_i(p) + mulr_j(p) + mulr_k(p);
    vec4 p8 = 0.5 * (s + p);
    vec4 p16 = 0.5 * (s - p);
    vec4 dp = max(abs(p8), abs(p16));
    dp.xy = max(dp.xy, dp.zw);
    return max(dp.x, dp.y);
}

/*
   returns maximal dot product of p with the vertices of the tetraplex
   which, as a point set, coincide with the elements of the whole binary
   icosahedral group

   120 points
*/

float tetraplex_max_dp(vec4 p)
{
    /* p * g24 =  psi * (p * i) + 0.5 * (p * k) + phi * p */
    /* p * g48 = -psi * (p * i) + 0.5 * (p * k) + phi * p */
    /* p * g72 =  0.5 * (p * j) + psi * (p * k) + phi * p */
    /* p * g96 = -0.5 * (p * j) + psi * (p * k) + phi * p */

    vec4 psi_p = psi * p;
    vec4 half_p = 0.5f * p;

    vec4 psi_pi = mulr_i(psi_p);
    vec4 half_pj = mulr_j(half_p);
    vec4 half_pk = mulr_k(half_p);
    vec4 psi_pk = mulr_k(psi_p);
    vec4 phi_p = psi_p + half_p;

    vec4 p24 = phi_p + half_pk + psi_pi;
    vec4 p48 = phi_p + half_pk - psi_pi;
    vec4 p72 = phi_p + psi_pk  + half_pj;
    vec4 p96 = phi_p + psi_pk  - half_pj;

    vec4 q0 = octaplex_max_dp4(p);
    vec4 q1 = octaplex_max_dp4(p24);
    vec4 q2 = octaplex_max_dp4(p48);
    vec4 q3 = octaplex_max_dp4(p72);
    vec4 q4 = octaplex_max_dp4(p96);

    vec4 d = max(q0, max(q1, max(q2, max(q3, q4))));
    d.xy = max(d.xy, d.zw);
    return max(d.x, d.y);
}

/* exchanges the values if necessary so on return we have v0 <= v1 */
void order(inout float v0, inout float v1)
{
    float vm = max(v0, v1);
    v0 = min(v0, v1);
    v1 = vm;
}

/*
    returns pair of maximal dot products of p with the vertices of the tetraplex
    such pair of maximal dot products always belong to different octaplex subsets
*/
vec2 tetraplex_max_dp2(vec4 p)
{
    vec4 psi_p = psi * p;
    vec4 half_p = 0.5f * p;

    vec4 psi_pi = mulr_i(psi_p);
    vec4 half_pj = mulr_j(half_p);
    vec4 half_pk = mulr_k(half_p);
    vec4 psi_pk = mulr_k(psi_p);
    vec4 phi_p = psi_p + half_p;

    vec4 p24 = phi_p + half_pk + psi_pi;
    vec4 p48 = phi_p + half_pk - psi_pi;
    vec4 p72 = phi_p + psi_pk  + half_pj;
    vec4 p96 = phi_p + psi_pk  - half_pj;

    float q0 = octaplex_max_dp1(p);
    float q1 = octaplex_max_dp1(p24);
    float q2 = octaplex_max_dp1(p48);
    float q3 = octaplex_max_dp1(p72);
    float q4 = octaplex_max_dp1(p96);

    order(q0, q1);
    order(q1, q2);
    order(q2, q3);
    order(q3, q4);      /* q4 is now maximal */

    q1 = max(q0, q1);
    q3 = max(q2, q3);
    q3 = max(q1, q3);   /* q3 is now second maximal */

    return vec2(q3, q4);
}

//#define RENDER_SIMPLEX
//#define RENDER_ORTHOPLEX
//#define RENDER_TESSERACT
//#define RENDER_OCTAPLEX
//#define RENDER_TETRAPLEX
#define RENDER_DODECAPLEX

/*
   removing spheres in the centers of 3-cells of a 3-polyhedron is
   the same as removing spheres around vertices of the dual polyhedron,
   so to render dodecaplex we use distance-to-vertices function of the
   dual polyhedron, the tetraplex
*/


/* smoothed minimum function */
float smin(float a, float b, float k)
{
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

#if defined(RENDER_TETRAPLEX)
float id = 1.0f;
#else
float id = 0.0f;
#endif

float sdf(vec4 p)
{
#if defined(RENDER_SIMPLEX)
    /* simplex is self-dual */
    float dp = clamp(simplex_max_dp(p), -1.0f, 1.0f);
    float s = acos(dp);
    return 1.108f - s;
#elif defined(RENDER_ORTHOPLEX)
    /* dual to orthoplex is tesseract */
    float dp = clamp(tesseract_max_dp(p), 0.0f, 1.0f);
    float s = acos(dp);
    return 0.761f - s;
#elif defined(RENDER_TESSERACT)
    /* dual to tesseract is orthoplex */
    float dp = clamp(orthoplex_max_dp(p), 0.0f, 1.0f);
    float s = acos(dp);
    return 0.914f - s;
#elif defined(RENDER_OCTAPLEX)
    /* octaplex is self-dual */
    vec4 dp4 = octaplex_max_dp4(p);
    dp4.xy = max(dp4.xy, dp4.zw);
    float dp = clamp(max(dp4.x, dp4.y), 0.0f, 1.0f);
    float s = acos(dp);
    return 0.604f - s;
#elif defined(RENDER_TETRAPLEX)
    /*
       here we do not want to compute the distance-to-600-points function, so we use different idea
       that in the vicinity of tetraplex edges the sum of the two minimal distances will be slightly
       greater than the length of the tetraplex edge, and is substantially greater everywhere else
    */
    vec2 dp = clamp(tetraplex_max_dp2(p), 0.0f, 1.0f);
    float a1 = acos(dp.x);
    float a2 = acos(dp.y);
    float e_sdf = 0.7071f * (a1 + a2 - 0.631f);                   /* 
                                                                     1 / sqrt(2) factor guaranties that 
                                                                     gradient of the sum is no longer than 1 
                                                                  */
    float v_sdf = a2 - 0.091f;
    return smin(e_sdf, v_sdf, 0.005f);                            /* tetraplex sdf */
#elif defined(RENDER_DODECAPLEX)
    /* dual to dodecaplex is tetraplex */
    float dp = clamp(tetraplex_max_dp(p), 0.0f, 1.0f);
    float s = acos(dp);
    return 0.351f - s;
#else /* RENDER BOTH */
    vec2 dp = clamp(tetraplex_max_dp2(p), 0.0f, 1.0f);
    float a1 = acos(dp.x);
    float a2 = acos(dp.y);
    float e_sdf = 0.7071f * (a1 + a2 - 0.631f);                   
    float v_sdf = a2 - 0.091f;
    float sdf1 = smin(e_sdf, v_sdf, 0.005f);                      /* tetraplex sdf */

    float sdf2 = 0.351f - a2;                                     /* dodecaplex sdf */
    id = step(sdf1, sdf2);
    return min(sdf1, sdf2);
#endif
}


//==============================================================================================================================================================
//   SDF gradient :: 4-point tetrahedral evaluation
//
//   A good thing is that 3-sphere is a parallelizable manifold, so that at any point
// one can explicitly specify tangent basis triple, which smoothly varies with the point
//
//   Such a basis for example is: { p*i, p*j, p*k }
//==============================================================================================================================================================
vec4 spherical_gradient4(vec4 p)
{
    const float eps = 0.0525f;

    vec4 pi = mulr_i(p);
    vec4 pj = mulr_j(p);
    vec4 pk = mulr_k(p);

    float v0 = sdf(normalize(p + eps * (+ pi - pj - pk)));
    float v1 = sdf(normalize(p + eps * (- pi - pj + pk)));
    float v2 = sdf(normalize(p + eps * (- pi + pj - pk)));
    float v3 = sdf(normalize(p + eps * (+ pi + pj + pk)));

    vec3 g = normalize(
        vec3(
              v0 - v1 - v2 + v3,
            - v0 - v1 + v2 + v3,
            - v0 + v1 - v2 + v3
        )
    );

    return g.x * pi + g.y * pj + g.z * pk;
}

//==============================================================================================================================================================
//   SDF gradient :: standard 6-point evaluation
//==============================================================================================================================================================
vec4 spherical_gradient6(vec4 p)
{
    const float eps = 0.0525f;

    vec4 pi = mulr_i(p);
    vec4 pj = mulr_j(p);
    vec4 pk = mulr_k(p);

    float norm = sqrt(1.0 + eps * eps);
    float inv_norm = 1.0f / norm;
    float f = eps * inv_norm;
    vec4 pn = inv_norm * p;


    float di = sdf(pn + f * pi) - sdf(pn - f * pi);
    float dj = sdf(pn + f * pj) - sdf(pn - f * pj);
    float dk = sdf(pn + f * pk) - sdf(pn - f * pk);

    vec3 g = normalize(vec3(di, dj, dk));
    return g.x * pi + g.y * pj + g.z * pk;
}

vec4 raymarch(vec4 origin, vec4 ray, out float dist)
{
    const float eps = 0.00005f;
    dist = -1.0f;

    vec4 p = origin;
    float d = sdf(p);
    float t = 0.0f;

    while (t < two_pi && d > eps)
    {
        t += d;
        p = cos(t) * origin + sin(t) * ray;
        d = sdf(p);
    }

    if (d < eps)
        dist = t;

    return p;
}

const int LIGHT_COUNT = 8;

const vec4 light_ws[LIGHT_COUNT] = vec4[]
(
    vec4( 0.0f,  0.0f,  0.0f,  1.0f),
    vec4( 1.0f,  0.0f,  0.0f,  0.0f),
    vec4( 0.0f,  1.0f,  0.0f,  0.0f),
    vec4( 0.0f,  0.0f,  1.0f,  0.0f),
    vec4( 0.0f,  0.0f,  0.0f, -1.0f),
    vec4(-1.0f,  0.0f,  0.0f,  0.0f),
    vec4( 0.0f, -1.0f,  0.0f,  0.0f),
    vec4( 0.0f,  0.0f, -1.0f,  0.0f)
);

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = 1.83f * (fragCoord - 0.5f * iResolution.xy) / iResolution.y;

    float t = 0.5f * iTime;

    float t0 = 0.375f * t -  0.213f;
    float t1 = 0.151f * t +  2.091f;
    float t2 = 0.253f * t - 11.512f;
    float t3 = 0.853f * t +  3.277f;

    float c0 = cos(t0);
    float s0 = sin(t0);
    float c1 = cos(t1);
    float s1 = sin(t1);
    float c2 = cos(t2);
    float s2 = sin(t2);
    float c3 = cos(t3);
    float s3 = sin(t3);

    /* if anyone knows how to smoothly fly through without entering areas
       with sdf < 0 let me know */

    vec4 camera_ws = vec4(-0.2f * c1 * s0, 0.1f * s1 *  c0 * s2, c0 * c2, s0 * s1);
    camera_ws = normalize(camera_ws);

    vec4 X = mulr_i(camera_ws);
    vec4 Y = mulr_j(camera_ws);

    vec4 camera_X =  c3 * X + s3 * Y;
    vec4 camera_Y = -s3 * X + c3 * Y;
    vec4 camera_Z = mulr_k(camera_ws);

    vec4 view_ray = uv.x * camera_X + uv.y * camera_Y - camera_Z;
    view_ray = normalize(view_ray);

    float dist;
    vec4 position = raymarch(camera_ws, view_ray, dist);
    vec3 color = vec3(0.0f);

    if (dist >= 0.0f)
    {
        /*
           normal, view, and light vectors should be tangent at 'position' point on the sphere
           for the light calculations to make sense, which actually means that they must be normal
           to 'position' viewed as 4-vectors

           !! view_ray can not be used as a view vector because it is tangent at 'camera_ws'
           point, but we need a vector tangent at 'position' point
        */

        vec2 uv0 = 8.0 * (position.xy + position.zw);
        vec2 uv1 = 8.0 * (position.yz + position.wx);
        vec3 rgb0 = texture(iChannel0, uv0).rgb;
        vec3 rgb1 = texture(iChannel1, uv1).rgb;
        vec3 rgb = mix(rgb0, rgb1, id);

        vec4 normal = spherical_gradient6(position);
        vec4 view = normalize(camera_ws - dot(camera_ws, position) * position);

        color = 0.125f * rgb;                      /* ambient */

        for (int i = 0; i < LIGHT_COUNT; ++i)
        {
            vec4 light = light_ws[i];
            float dp = dot(light, position);
            light = light - dp * position;
            light = normalize(light);

            /* close to 1 if light is close to the fragment */
            float d = 0.5f + 0.5f * dp;
            float a = 2.24f * d * d * exp(-0.97f * dist);

            float cos_theta = max(dot(light, normal), 0.0f);
            vec4 h = normalize(light + view);

            float cos_alpha = max(dot(h, normal), 0.0f);
            vec3 diffuse  = (0.875f * cos_theta) * rgb;
            vec3 specular = vec3(0.562f) * pow(cos_alpha, 88.0f);

            color += a * (diffuse + specular);
        }
    }
    
    fragColor = vec4(color, 1.0f);
}
