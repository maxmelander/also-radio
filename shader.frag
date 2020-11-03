/*
// Author: Max Melander
// Written in a month in bits and pieces after work to learn about ray marching!
// Most of the actual ray marching was written following Inigo Quilez's
// Youtube deconstruction of his Happy Jumping shader https://www.youtube.com/watch?v=Cfe5UQ-1L9Q&t=7113s
//
// The starry sky was inspired by The Art of Code' Making a Starfield
// series https://www.youtube.com/watch?v=rvDo9LvfoVE&t=1158s
//
// Lastely, the sand rendering is of course inspired by
// That Game Company's Journey, and Alan Zucconi's blog series
// on Journey's sand rendering https://www.alanzucconi.com/2019/10/08/journey-sand-shader-1/
*/

precision highp float;
uniform float u_time;
uniform float u_currentTime; // The audio element's currentTime
uniform vec2 u_resolution;
uniform sampler2D u_texture; // Also Radio Logo

// Frequency banded amplitudes
uniform float u_bass;
uniform float u_mid;
uniform float u_high;

uniform float u_tod; // time of day mix from 0 -> 1
uniform float u_distort; // mix in field distortion effect

// Color distorion effects
uniform float u_distort_2;
uniform float u_distort_3;
uniform float u_distort_4;

uniform float u_ballSpeed;
uniform float u_playing;

vec3 _CameraPosition = vec3(0.0, 0.6, 0.0);

/* COLORS */

// Day
vec3 _SkyTopColor_0 = vec3(0.18, 0.55, 1.0);
vec3 _SkyBottomColor_0 = vec3(0.95, 0.95, 0.9);
vec3 _SunColor_0 = vec3(5.4, 3.1, 2.0);
vec3 _SkyColor_0 = vec3(0.5, 0.6, 0.9);
vec3 _BounceColor_0 = vec3(0.6, 0.1, 0.1);
vec3 _GlitterColor_0 = vec3(0.5, 0.5, 0.3);
vec3 _OceanColor_0 = vec3(10.0, 10.0, 5.0);
vec3 _DistanceColor_0 = vec3(0.3, 0.3, 0.35);
vec3 _SphereSpecColor_0 = vec3(3.0, 3.0, 2.0);
vec3 _FresnelColor_0 = vec3(0.8, 0.8, 1.2);

// Night
vec3 _SkyTopColor_1 = vec3(0.00, 0.00, 0.01);
vec3 _SkyBottomColor_1 = vec3(0.01, 0.01, 0.02);
vec3 _SunColor_1 = vec3(0.1, 0.2, 0.6);
vec3 _SkyColor_1 = vec3(0.0, 0.0, 0.1);
vec3 _BounceColor_1 = vec3(0.04, 0.0, 0.0);
vec3 _GlitterColor_1 = vec3(0.2, 0.1, 0.2);
vec3 _OceanColor_1 = vec3(1.9, 0.9, 0.9);
vec3 _DistanceColor_1 = vec3(0.03, 0.03, 0.05);
vec3 _SphereSpecColor_1 = vec3(0.5, 0.2, 0.5);
vec3 _FresnelColor_1 = vec3(0.15, 0.05, 0.05);

vec3 _SkyTopColor = mix(_SkyTopColor_0, _SkyTopColor_1, u_tod);
vec3 _SkyBottomColor =  mix(_SkyBottomColor_0, _SkyBottomColor_1, u_tod);
vec3 _SunColor = mix(_SunColor_0, _SunColor_1, u_tod);
vec3 _SkyColor = mix(_SkyColor_0, _SkyColor_1, u_tod);
vec3 _BounceColor = mix(_BounceColor_0, _BounceColor_1, u_tod);
vec3 _GlitterColor = mix(_GlitterColor_0, _GlitterColor_1, u_tod);
vec3 _OceanColor = mix(_OceanColor_0, _OceanColor_1, u_tod);
vec3 _DistanceColor = mix(_DistanceColor_0, _DistanceColor_1, u_tod);
vec3 _SphereSpecColor = mix(_SphereSpecColor_0, _SphereSpecColor_1, u_tod);
vec3 _FresnelColor = mix(_FresnelColor_0, _FresnelColor_1, u_tod);

vec3 _SandColor = vec3(0.18, 0.16, 0.13);

vec3 _SphereColor_Black = vec3(0.002, 0.001, 0.004);
vec3 _SphereColor = vec3(0.2, 0.1, 0.4);

// Simplex 2D noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
            -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
        dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

// Fast noise
float hash21(vec2 p) {
    p = fract(p*vec2(123.34, 456.21));
    p += dot(p, p+45.32);
    return fract(p.x * p.y);
}

// NVIDIA Sine wave approximation
// https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models
float smoothCurve( float x, float smoothingFactor ) {
    return x * x *( (3.0 - smoothingFactor) - (2.0 - smoothingFactor) * x );
}

float triangleWave( float x ) {
    return abs( fract( x + 0.5 ) * 2.0 - 1.0 );
}

float sharpTriangleWave( float x ) {
    return smoothCurve( triangleWave( x ), 0.5 );
}

float smoothTriangleWave( float x ) {
    return smoothCurve( triangleWave( x ), 0.0 );
}

float smin( float a, float b, float k ) {
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

// SD Functions
//
// Desert plane
float sdDesert(vec3 pos)
{
    float amp = u_bass / 3.;

    float fh = -1.0 + (0.6 + amp) * (sharpTriangleWave(-0.2 + (0.1*pos.x) + 0.17*smoothTriangleWave(pos.x*0.1) + 0.3*smoothTriangleWave(pos.x*0.02)) + smoothTriangleWave(0.06*pos.z + 0.01*smoothTriangleWave(pos.z*0.2)));
    fh += pow(abs(fh), 1.7);

    float hf = smoothTriangleWave(3.6*(pos.z + 0.02*smoothTriangleWave((pos.x + (u_time * 0.9)) * 2.6)));
    float hf2 = smoothTriangleWave(2.*pos.x + (u_time * 1.));

    float d = pos.y - (fh + ((0.138*(u_high*2.4))* hf * (clamp(-pos.y + 0.2, 0., 1.))) + (0.0026 * hf2 * (pos.y)));

    return d;
}

float sdSphere(vec3 pos, float radius) {

    float z = -4.5- (mod(u_currentTime, 16.5) - (u_mid * 1.0));
    float y = -0.1 + ((0.6 + (smoothTriangleWave(u_time * 0.1)) ) * 0.7);
    vec3 cen = vec3(mix(-0.3, 0.3, smoothTriangleWave(u_time * 0.015)), y, z);

    return length(pos - cen) - (radius + (u_mid/ 6.));
}

float sdMetaballs(vec3 pos, vec3 mb_p_2, vec3 mb_p_3) {
        // Floating spheres
    float result = sdSphere(pos, 0.5);

    vec3 pos_2 = vec3(pos.x + mb_p_2.x, pos.y - mb_p_2.y, pos.z + mb_p_2.z);
    vec3 pos_3 = vec3(pos.x + mb_p_3.x, pos.y + mb_p_3.y, pos.z + mb_p_3.z);

    float ball_2 = sdSphere(pos_2, 0.4);
    float ball_3 = sdSphere(pos_3, 0.3);

    result = smin(result, ball_2, 0.5);
    result = smin(result, ball_3, 0.5);

    return result;
}

vec2 map(vec3 pos, vec3 mb_p_2, vec3 mb_p_3) {
    // Metaballs
    vec3 ball_pos = pos;
    if (u_distort == 1.) {
        ball_pos.x = mod(abs(ball_pos.x), 5.0) - 1.5;
        ball_pos.z += 0.3 * (((smoothTriangleWave(abs(ball_pos.z * 0.5)) + 1.) / 2.) - 0.5);
    }
    float d1 = sdMetaballs(ball_pos, mb_p_2, mb_p_3);

    // Ground
    float d2 = sdDesert(pos);

    // Combine
    float d = smin(d1, d2, 0.5);

    if (d1 < d2) {
        return vec2(d, 1.7);
    } else {
        return vec2(d, 1.0);
    }
}


float calcOcclusion(vec3 pos, vec3 nor, vec3 mb_p_2, vec3 mb_p_3)
{
    float occ = 0.0;
    float sca = 1.0;
    for( int i=0; i<5; i++ )
    {
        float h = 0.01 + 0.11*float(i)/4.0;
        vec3 opos = pos + h*nor;
        float d = map(opos, mb_p_2, mb_p_3).x;
        occ += (h-d)*sca;
        sca *= 0.95;
    }
    return clamp( 1.0 - 2.0*occ, 0.0, 1.0 );
}

vec3 calcNormal(vec3 pos, vec3 mb_p_2, vec3 mb_p_3) {
    vec2 e = vec2(0.0001, 0.0);
    return normalize( vec3( map(pos+e.xyy, mb_p_2, mb_p_3).x-map(pos-e.xyy, mb_p_2, mb_p_3).x,
                            map(pos+e.yxy, mb_p_2, mb_p_3).x-map(pos-e.yxy, mb_p_2, mb_p_3).x,
                            map(pos+e.yyx, mb_p_2, mb_p_3).x-map(pos-e.yyx, mb_p_2, mb_p_3).x));
}

vec2 textureMapping(vec3 pos) {
    return pos.xz*vec2(0.03,0.07);
}

vec2 castRay(vec3 ro, vec3 rd, vec3 mb_p_2, vec3 mb_p_3) {
    vec2 res = vec2(-1.0, -1.0);
    float tmin = 0.5;
    float tmax = 30.0;

    float t = tmin;

    for (int i = 0; i < 450; i++) {
        vec2 h = map(ro+rd*t, mb_p_2, mb_p_3);
        if (abs(h.x) < 0.01) {
            res = vec2(t, h.y);
            break;
        }
        t += h.x;

        if (t>tmax) {
            break;
        }

    }

    return res;
}

float castShadow(vec3 ro, vec3 rd, vec3 mb_p_2, vec3 mb_p_3) {
    float res = 1.0;

    float t = 0.001;
    for (int i = 0; i < 70; i++) {
        vec3 pos = ro + t*rd;
        float h = map(pos, mb_p_2, mb_p_3).x;

        res = min( res, 16.0*h / t );

        if ( h < 0.0005 ) break;

        t += h;

        if (t > 20.0) break;
    }

    return res;
}


vec3 nlerp(vec3 n1, vec3 n2, float t){
    return normalize(mix(n1, n2, t));
}


float diffuse(vec3 n, vec3 l) {
    n.y *= 0.3;
    float nDotL = clamp(4. * dot(n, l), 0.0, 1.0);
    return nDotL;
}

vec3 rim(vec3 N, vec3 I) {
    vec3 F0 = vec3(0.0);
    return F0 + (1.0 - F0) * pow(1.0 - (dot(N, I)), 36.0);
}

float oceanSpecular(vec3 n, vec3 l, vec3 v) {
    // Blinn-Phong
    vec3 h = normalize(v + l); // Half direction
    float NdotH = max(0., dot(n, h));
    float specular = pow(NdotH, 600.0) * 2.7;
    return specular;
}

float glitterSpecular(vec2 uv, vec3 l, vec3 v, float threshold, vec3 noise) {

    vec3 R = reflect(l, noise);

    float rDotV = max(0.0, dot(R, v));

    if (rDotV < threshold) {
        return 0.0;
    }
    return rDotV;
}

vec3 sandNormal(vec2 uv, vec3 n) {
    float noise = hash21(uv * 1000.);
    vec3 random = vec3(noise, fract(noise * 10.), fract(noise * 20.));
    vec3 s = normalize(random);

    vec3 Ns = nlerp(n, s, 0.08);
    return Ns;
}

vec4 blur(sampler2D image, vec2 uv) {
    const float pi = 6.28318530718; // Pi*2

    const float directions = 12.0;
    const float quality = 4.0;
    const float size = 12.0;

    vec2 radius = size/u_resolution.xy;

    vec4 color = texture2D(image, uv);

    for( float d=0.0; d<pi; d+=pi/directions)
    {
        for(float i=1.0/quality; i<=1.0; i+=1.0/quality)
        {
            color += texture2D(image, uv+vec2(cos(d),((smoothTriangleWave(d * 0.2) * 2.0) - 1.))*radius*i);
        }
    }

    color /= quality * directions - 15.0;
    return color;
}

vec3 fresnelSchlick(vec3 N, vec3 I){
    vec3 F0 = vec3(0.0);
    return F0 + (1.0 - F0) * pow(1.0 - (dot(N, I)), 5.0);
}

vec3 starColor(vec2 uv) {
    vec2 star_uv = uv  * 12.;

    float s = sin(u_time * .03 * (1.-u_tod));
    float c = cos(u_time * .03 * (1.-u_tod));
    mat2 m = mat2(c, -s, s, c);
    star_uv *= m;
                         
    vec2 star_gv = fract(star_uv) - .5; 
    vec2 star_id = floor(star_uv);

    float star_noise = hash21(star_id);
    float star_noise_2 = fract(star_noise * 94.281)-.5;
    float star_distance = length(vec2(star_gv.x + ((star_noise - .5)), star_gv.y + star_noise_2)) * 7.;
    float star_strength = smoothstep(.15, .05, star_distance);
    float star_glow = smoothstep(2.35, .005, star_distance);

    float star_value = star_strength*((star_noise * .1) + (u_mid * 0.8));

    return vec3(star_value * (star_noise * 2.), star_value, star_value * (star_noise_2 * 2.)) + (0.0015 * vec3(star_glow)) * vec3(star_noise);
}                        

vec3 logoColor(vec2 uv) {
    vec2 logo_uv = uv * 1.8;
    logo_uv.x += 0.5;
    logo_uv.y += 0.36;

    vec3 logo_hue = vec3(1.2, 1.0, 1.0);

    vec3 logo_blur = clamp(blur(u_texture, logo_uv), 0., 1.).rgb;
    vec3 logo = clamp(texture2D(u_texture, logo_uv), 0., 1.).rgb;

    return clamp(logo * (0.05 + u_bass) + (logo_blur * (u_bass * 0.4)), 0.0 , 1.0) * logo_hue;
}

vec3 moonColor(vec2 uv, float pos_sin) {
    vec2 moon_uv = uv;
    moon_uv.x += 0.02 - (0.1 * pos_sin);
    float d = length(moon_uv);
    float m = .01 / d;

    return min(m, 0.9) * vec3(0.2 + (u_mid * 0.6), 0.2, 0.4);
}

void main() {
    vec2 p = (2.0 * gl_FragCoord.xy - u_resolution.xy) / u_resolution.y;

    // Reset camera position every 16.5s to avoid unstable ray marching with large numbers
    _CameraPosition.z -= mod(u_currentTime, 16.5);
    //_CameraPosition.z -= u_time * u_playing;

    // Camera target
    vec3 ta = _CameraPosition - vec3(0., 0.5, 800.);
    // Ray origin
    vec3 ro = _CameraPosition;

    // Camera vectors
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0., 1., 0.)));
    vec3 vv = normalize(cross(uu,ww));

    // Ray direction
    float fov = 1.6;
    vec3 rd = normalize(p.x * uu + p.y * vv + fov * ww);

    // Color = sky gradient to start, then more stuff is added as we
    // march through our scene
    vec3 col = mix(_SkyTopColor, _SkyBottomColor, exp(-10.0*rd.y));

    // Render sky
    vec2 sky_uv = (gl_FragCoord.xy-0.5*u_resolution.xy) / u_resolution.y;
    col += starColor(sky_uv);
    col += logoColor(sky_uv);

    float sun_pos_wave = (smoothTriangleWave(u_time * 0.1) * 2.) - 1.; // Used to animate sun/moon position
    col += moonColor(sky_uv, sun_pos_wave);

    // Metaball positions
    // We only want to calculate these once, not every time we call map
    vec3 mb_p_2 = vec3((0.2 * u_mid * ((smoothTriangleWave(u_time * 0.5) * 2.) - 1.)) + ((smoothTriangleWave(u_time * (0.05 * u_ballSpeed)) * 2.) - 1.), (0.2* u_bass) * smoothTriangleWave(u_time * 0.4) -(0.3 * ((smoothTriangleWave(u_time * (0.033 * u_ballSpeed)) * 2.) - 1.)), ( 0.8 * cos(u_time * (0.5 * u_ballSpeed))));
    vec3 mb_p_3 = vec3((0.1 * u_mid * ((smoothTriangleWave(u_time * 0.6) * 2.) - 1.)) - ((smoothTriangleWave(u_time * (0.01 * u_ballSpeed)) * 2.) - 1.), (0.3* u_bass) * smoothTriangleWave(u_time * 0.05) - (0.5 * ((smoothTriangleWave(u_time * (0.08 * u_ballSpeed)) * 2.) - 1.)), ( 0.8 * cos(u_time * (0.5 * u_ballSpeed))));


    // We don't need to raymarch the sky
    vec2 tm = castRay(ro, rd, mb_p_2, mb_p_3);

    if (tm.y > 0.0) {
        float t = tm.x;
        vec3 pos = ro + t*rd;
        vec3 nor = calcNormal(pos, mb_p_2, mb_p_3);
        vec2 uv = fract(textureMapping(pos) * 4.);

        vec3 sand_nor = sandNormal(uv, nor);

        // Lights
        vec3 ocean_light = normalize(vec3(0., 2., -3.));
        vec3 sun_dir = normalize(vec3(0. + 4.* sun_pos_wave, 5.6, -3.2));

        // Lighting calculations
        float occ = calcOcclusion(pos, sand_nor, mb_p_2, mb_p_3);
        float sun_sha = clamp(castShadow(pos+sand_nor*0.01, sun_dir, mb_p_2, mb_p_3), 0.0 ,1.0);
        float sky_dif = 0.9 * diffuse(sand_nor, vec3(0.0, 1.0, 0.0));
        float bounce_dif = clamp(0.5 + 0.3*dot(sand_nor, vec3(0.0, -1.0, 0.0)), 0.0, 1.0);
        float sun_dif = diffuse(sand_nor, sun_dir);
        vec3 rim = rim(sand_nor, -rd);
        float spec = oceanSpecular(sand_nor, ocean_light, -rd) / (t/ 2.);;

        vec3 glitterNoise = vec3(snoise(uv*300.), snoise(uv*400.), snoise(uv*440.));
        float glitterSpec = glitterSpecular(uv, sun_dir, -rd, 0.9, glitterNoise) / (t/ 1.5);
        float glitterSpecLots = glitterSpecular(uv, sun_dir, -rd, 0.3, glitterNoise) / (t / 1.5);

        vec3 mate = _SandColor;
        if (tm.y > 1.5) {
            vec3 sphereColor = mix(_SphereColor, _SphereColor_Black, u_distort_4);
            mate = sphereColor;
        }

        // Light color
        vec3 li = vec3(0.0);
        li += sun_dif * _SunColor * sun_sha * occ;
        li += sky_dif * _SkyColor * occ;
        li += bounce_dif * _BounceColor * occ;

        // Material color
        col = li * mate;
        if (tm.y < 1.5) { // Sand
            _GlitterColor = vec3(_GlitterColor.r + (u_mid * 0.8), _GlitterColor.g, _GlitterColor.b + (u_mid * 0.3));
            _OceanColor = vec3(_OceanColor.r + (u_mid * 0.4), _OceanColor.g, _OceanColor.b + (u_mid * 0.1));
            col += (glitterSpec * sun_dif * _GlitterColor * sun_sha);
            col += (spec * glitterSpecLots * _OceanColor * sun_sha);
            col += ((rim * _OceanColor * sun_sha * 0.3) / (t / 2.));
        } else { // Sphere
            vec3 fresnel = fresnelSchlick(sand_nor, -rd);
            col += _SphereSpecColor * spec;
            col += fresnel * _FresnelColor;
        }

        // Distance fog
        float distance = clamp((t-15.) / 20., 0.0, 1.0);
        col = mix(col, _DistanceColor, distance);
    }

    col = pow( col, vec3(0.4545) );

    col.b = mix(col.b, 0.4 - col.r, u_distort_2 * (u_bass * 0.7));
    col.g = mix(col.g, 0.1 - col.g, u_distort_3 * (u_bass * 0.7));

    gl_FragColor = vec4(col, 1.0);
