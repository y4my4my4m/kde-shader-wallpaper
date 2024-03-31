// https://www.shadertoy.com/view/ldSBRc
// Credits to amitpanna

float getBox(vec2 st, float left, float bottom, float width, float height) {
    float sm = 0.002;
    float x_range = smoothstep(left - sm, left, st.x) - smoothstep(left + width, left + width + sm, st.x);
    float y_range = smoothstep(bottom - sm, bottom, st.y) - smoothstep(bottom + height,bottom + height + sm, st.y);

    return x_range * y_range;
}

float getCircle(vec2 st, vec2 center, float radius, float thickness, float sm) {
    float distance = distance(st, center);
    return smoothstep(radius, radius + sm, distance) - smoothstep(radius + thickness, radius + thickness + sm, distance);
}

float getDottedCircle(vec2 st, vec2 center, float radius, float thickness, float sm) {
    float distance = distance(st, center);
    float circle = smoothstep(radius, radius + sm, distance) - smoothstep(radius + thickness, radius + thickness + sm, distance);

    vec2 vector = center - st;
    float angle = atan(vector.y, vector.x);
    angle = ((angle * 0.5) + (3.14 * 0.5)) / 3.14;
    circle *= step(8., mod(floor(angle / 0.001), 10.0));

    return circle;
}

mat2 rotate(in float angle) {
    return mat2(
                cos(angle), -sin(angle),
                sin(angle), cos(angle)
            );
}

vec2 getRotation(vec2 st, vec2 origin, float angle) {
    vec2 rotatedCoord = st - vec2(origin);
    rotatedCoord = rotate(angle) * rotatedCoord;
    rotatedCoord += vec2(origin);

    return rotatedCoord;
}

mat2 scale(in float x, in float y) {
    return mat2(
                x, 0.0,
                0.0, y
            );
}

vec2 getScaling(vec2 st, vec2 origin, float x, float y) {
    vec2 scaledCoord = st - vec2(origin);
    scaledCoord = scale(x, y) * scaledCoord;
    scaledCoord += vec2(origin);

    return scaledCoord;
}

float getInnetDial(vec2 st, float center, float radius) {
     float lineThickness = 0.002;
    float sm = 0.003;

    float circle2 = getCircle(st, vec2(center), radius - 0.015, lineThickness, sm);
    circle2 *= step(st.x, -0.254);

    float circle2dash1 = getBox(st, -0.254, 0.134, 0.100, lineThickness);
    circle2 += circle2dash1;
    float circle2dash1_2 = getBox(st, -0.204, 0.134, 0.052, lineThickness * 2.);
    circle2 += circle2dash1_2;
    float circle2dash2 = getBox(st, -0.288, 0.068, 0.031, lineThickness);
    circle2 += circle2dash2;
    float circle2dash2_2 = getBox(st, -0.247, 0.068, 0.096, lineThickness);
    circle2 += circle2dash2_2;
    float circle2dash3 = getBox(st, -0.350, 0.0, 0.215, lineThickness);
    circle2 += circle2dash3;
    float circle2dash3_2 = getBox(st, -0.19, 0.0, 0.055, lineThickness * 2.);
    circle2 += circle2dash3_2;
    float circle2dash3_3 = getBox(st, -0.36, 0.0, lineThickness * 2., lineThickness * 2.);
    circle2 += circle2dash3_3;
    float circle2dash4 = getBox(st, -0.288, -0.068, 0.031, lineThickness);
    circle2 += circle2dash4;
    float circle2dash4_2 = getBox(st, -0.247, -0.068, 0.096, lineThickness);
    circle2 += circle2dash4_2;

    float circle2dash5 = getBox(st, -0.13, 0.0, 0.01, lineThickness);
    circle2 += circle2dash5;
    float circle2dash5_1 = getBox(st, -0.12, -0.03, lineThickness, 0.06);
    circle2 += circle2dash5_1;
    float circle2dash5_2 = getBox(st, -0.118, 0.03, 0.01, lineThickness);
    circle2 += circle2dash5_2;
    float circle2dash5_3 = getBox(st, -0.118, -0.03, 0.01, lineThickness);
    circle2 += circle2dash5_3;

    return circle2;
}

float getSideLine(vec2 st, float left, float top, float lineThickness) {
    float lineEdgeLength = 0.008;
    float sideLine = getBox(st, left, top, lineThickness, 0.236);
    sideLine += getBox(st, left + lineThickness, top + 0.234, lineEdgeLength, lineThickness);
    sideLine += getBox(st, left + lineThickness, top, lineEdgeLength, lineThickness);
    sideLine += getBox(st, left + lineThickness + 0.006, 0.0, lineThickness, lineThickness);

    return sideLine;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 st = fragCoord.xy / iResolution.xy;
    st -= 0.5;
    st.x *= iResolution.x/iResolution.y;
    fragColor = vec4(st,0.5+0.5*sin(iTime),1.0);

    float center = 0.0;
    float radius = 0.3;
    float sm = 0.003;
    float lineThickness = 0.002;
    float angle = atan(st.y, st.x);
    angle = (angle + 3.1416) / (2.0 * 3.1416);

    vec3 color = vec3(0.);

    st = getRotation(st, vec2(center), -iTime);
    float circle1 = getCircle(st, vec2(0.), radius, lineThickness, sm);
    circle1 *= (step(st.x, -0.25) + step(0.25, st.x));
    st = getRotation(st, vec2(center), iTime);



    float dottedCircle = getDottedCircle(st, vec2(center), radius + 0.015, lineThickness + 0.002, sm);
    dottedCircle *= (
        (step(0.02, angle) - step(0.08, angle)) +
        (step(0.09, angle) - step(0.16, angle)) +
        (step(0.32, angle) - step(0.4, angle)) +
        (step(0.41, angle) - step(0.48, angle)) +

        (step(0.52, angle) - step(0.59, angle)) +
        (step(0.6, angle) - step(0.66, angle)) +
        (step(0.83, angle) - step(0.89, angle)) +
        (step(0.9, angle) - step(0.98, angle))
    );

    float timeFactor = 3.14 * 0.2 * cos(iTime * 0.5);
    st = getRotation(st, vec2(center), timeFactor);
    float dial1 = getDottedCircle(st, vec2(center), radius + 0.04, lineThickness + 0.01, sm);

    float dial2 = getDottedCircle(st, vec2(center), radius + -0.04, lineThickness + 0.01, sm);
    dial2 += getDottedCircle(st, vec2(center), radius + -0.02, lineThickness + 0.001, sm);
    st = getRotation(st, vec2(center), -timeFactor);


    dial1 *= (step(0.662, angle) - step(0.84, angle));
    dial2 *= (step(0.682, angle) - step(0.82, angle));


    float sideLine = getSideLine(st, -0.4, -0.116, 0.002);
    st = getScaling(st, vec2(0.0), -1.0, 1.0);
    sideLine += getSideLine(st, -0.4, -0.116, 0.002);
    st = getScaling(st, vec2(0.0), -1.0, 1.0);

    st = getRotation(st, vec2(center), 3.14 * 0.1 * sin(iTime));

    float innerDial = getInnetDial(st, center, radius);
    st = getScaling(st, vec2(0.0), -1.0, 1.0);
    innerDial += getInnetDial(st, center, radius);
    st = getScaling(st, vec2(0.0), -1.0, 1.0);


    st = getRotation(st, vec2(center), 3.14 / 4.);
    float box = getBox(st, -0.068, -0.057, 0.004, 0.115);
    box += getBox(st, 0.066, -0.057, 0.004, 0.115);
    box += getBox(st, -0.057, 0.070, 0.115, 0.004);
    box += getBox(st, -0.057, -0.070, 0.115, 0.004);
    box -= getBox(st, -0.036, -0.036, 0.072, 0.072);

    box += getBox(st, -0.05, -0.05, 0.006, 0.006);
    box += getBox(st, 0.048, -0.05, 0.006, 0.006);
    box += getBox(st, 0.048, 0.046, 0.006, 0.006);
    box += getBox(st, -0.05, 0.046, 0.006, 0.006);

    float innerBox = getBox(st, -0.04, -0.04, 0.08, 0.08);
    innerBox -= getBox(st, -0.036, -0.036, 0.072, 0.072);
    innerBox += getBox(st, -0.07, -0.07, 0.006, 0.006);
    innerBox += getBox(st, 0.066, -0.07, 0.006, 0.006);
    innerBox += getBox(st, 0.066, 0.066, 0.006, 0.006);
    innerBox += getBox(st, -0.07, 0.066, 0.006, 0.006);
    st = getRotation(st, vec2(center), -3.14 / 4.);

    st = getRotation(st, vec2(center), -3.14 * 0.1 * sin(iTime));

    float sideMarks = step(18., mod(floor((st.y + 0.1 * sin(iTime)) / 0.002), 20.0));
    sideMarks *= (
        (step(-0.44, st.x) - step(-0.415, st.x)) +
        (step(0.415, st.x) - step(0.44, st.x))
    );
    sideMarks *= (step(-0.12, st.y) - step(0.12, st.y));

    float sideMarksBox = getBox(st, -0.45, -0.015, 0.04, 0.03);
    sideMarksBox -= getBox(st, -0.448, -0.013, 0.036, 0.026);
    st = getScaling(st, vec2(0.0), -1.0, 1.0);
    sideMarksBox += getBox(st, -0.45, -0.015, 0.04, 0.03);
    sideMarksBox -= getBox(st, -0.448, -0.013, 0.036, 0.026);
    st = getScaling(st, vec2(0.0), -1.0, 1.0);

    sideMarksBox += getBox(st, -0.0025, 0.33, 0.005, 0.005);
    sideMarksBox += getBox(st, -0.0025, 0.25, 0.005, 0.005);

    box *= (0.2 + 0.8 * pow(abs(sin(iTime * 4.)), 2.));

    color += vec3(1.000,0.345,0.287) * circle1;
    color += vec3(0.39,0.61,0.65) * dottedCircle;
    color += vec3(0.39,0.61,0.65) * dial1;
    color += vec3(0.39,0.61,0.65) * dial2;
    color += vec3(0.39,0.61,0.65) * innerDial;
    color += vec3(0.39,0.61,0.65) * sideLine;
    color += vec3(0.39,0.61,0.65) * sideMarks;
    color += vec3(0.39,0.61,0.65) * sideMarksBox;
    color += vec3(0.995,0.425,0.003) * box;
    color += vec3(0.96, 0.98, 0.8) * innerBox;

    fragColor = vec4(color,1.0);
}
