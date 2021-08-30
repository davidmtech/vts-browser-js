
const ThreeShaders = {};

ThreeShaders.tileVertexShader =

    '#ifdef onlyFog\n'+
        'varying float vFogFactor;\n'+
    '#endif\n'+

    '#ifdef clip4\n'+
        'varying vec2 vClipCoord;\n'+
    '#endif\n'+

    '#ifdef clip8\n'+
        'varying vec3 vClipCoord;\n'+

        'uniform mat4 uParams;\n'+  //[zfactor, fogDensity, scale.xy][camVec.xyzw][transform.xyzw][scale.z, trans.xyz]
        'uniform mat4 uParamsC8;\n'+  //c,x,y,z

        'float getLinePointParametricDist(vec3 c, vec3 v, vec3 p) {\n'+
            'vec3 w = p - c;\n'+
            'float c1 = dot(w,v);\n'+
            'if (c1 <= 0.0) return 0.0;\n'+
            'float c2 = dot(v,v);\n'+
            'if (c2 <= c1) return 1.0;\n'+
            'return c1 / c2;\n'+
        '}\n'+

    '#endif\n'+

    '#ifdef depth\n'+
        'varying float vDepth;\n'+
    '#endif\n'+

    '#ifdef flatShadeVar\n'+
        'varying vec3 vBarycentric;\n'+
    '#endif\n'+

    '#ifndef depth\n'+
        'uniform vec4 uvTrans;\n'+
        'varying vec2 vUv;\n'+
    '#endif\n'+

    '#ifdef uvs\n'+
        'attribute vec2 uv2;\n'+
    '#endif\n'+

                             //0-3                            4-7          8-11            12-15
    //'uniform mat4 uParams;\n'+  //[zfactor, fogDensity, scale.xy][camVec.xyzw][transform.xyzw][scale.z, trans.xyz]

    '#ifdef applySE\n'+
        'uniform mat4 uParamsSE;\n'+
    '#endif\n'+

    'void main() {\n'+

        '#ifdef applySE\n'+
            'vec3 geoPos2 = position*vec3(uParamsSE[0][3],uParamsSE[1][0],uParamsSE[1][1]);\n'+
            'vec3 geoPos = geoPos2+vec3(uParamsSE[0][0],uParamsSE[0][1],uParamsSE[0][2]);\n'+
            'geoPos.z *= uParamsSE[3][3];\n'+
            'float ll = length(geoPos);\n'+
            'vec3 v = geoPos * (1.0/(ll+0.0001));\n'+
            'float h = ll - uParamsSE[3][2];\n'+
            'float h2 = clamp(h, uParamsSE[2][1], uParamsSE[2][3]);\n'+
            'float h3 = h;\n'+
            'h *= (uParamsSE[2][2] + ((h2 - uParamsSE[2][1]) * uParamsSE[3][0]) * uParamsSE[3][1]);\n'+
            'geoPos2.xyz += v * (h - h3);\n'+
            'vec4 camSpacePos = uMV * vec4(geoPos2, 1.0);\n'+
            'float l = dot(v, vec3(uParams[1][0],uParams[1][1],uParams[1][2]));\n'+
        '#else\n'+
            'vec4 camSpacePos = modelViewMatrix * vec4(position, 1.0);\n'+
            /*
            'vec3 worldPos = vec3(position.x * uParams[0][2] + uParams[3][1], position.y * uParams[0][3] + uParams[3][2], position.z * uParams[3][0] + uParams[3][3]);\n'+
            'float l = dot(normalize(worldPos.xyz), vec3(uParams[1][0],uParams[1][1],uParams[1][2]));\n'+
            */
        '#endif\n'+

        'gl_Position = projectionMatrix * camSpacePos;\n'+

        '#ifdef depth\n'+
            'float camDist = length(camSpacePos.xyz);\n'+
            'vDepth = camDist;\n'+
        '#endif\n'+

        '#ifdef flatShadeVar\n'+
            'vBarycentric = camSpacePos.xyz;\n'+
        '#endif\n'+

        /*
        'float fogFactor = 1.0-exp(uParams[0][1] * camDist);\n'+
        'fogFactor = clamp((1.0-abs(l))*uParams[1][3] + fogFactor, 0.0, 1.0);\n'+

        '#ifdef onlyFog\n'+
            'vFogFactor = fogFactor;\n'+
        '#else\n'+
            'vTexCoord.z = fogFactor;\n'+

            '#ifdef externalTex\n'+
                'vTexCoord.xy = vec2(uParams[2][0] * aTexCoord2[0] + uParams[2][2], uParams[2][1] * aTexCoord2[1] + uParams[2][3]);\n'+
            '#else\n'+
                'vTexCoord.xy = aTexCoord;\n'+
            '#endif\n'+

        '#endif\n'+
        */

        //'vUv = uv;\n'+

        '#ifndef depth\n'+
            'vUv = vec2(uv.x * uvTrans.x + uvTrans.z, uv.y * uvTrans.y + uvTrans.w);\n' +
        '#endif\n'+

        '#ifdef clip4\n'+
            '#ifdef uvs\n'+
                'vClipCoord.xy = uv2.xy;\n'+
            '#else\n'+
                'vClipCoord.xy = uv.xy;\n'+
            '#endif\n'+
        '#endif\n'+

        '#ifdef clip8\n'+
            'vec3 worldPos2 = vec3(position.x * uParams[0][2] + uParamsC8[0][3], position.y * uParams[0][3] + uParamsC8[1][3], position.z * uParams[3][0] + uParamsC8[2][3]);\n'+
            'vClipCoord.x = getLinePointParametricDist(vec3(uParamsC8[0][0],uParamsC8[0][1],uParamsC8[0][2]), vec3(uParamsC8[1][0],uParamsC8[1][1],uParamsC8[1][2]), worldPos2.xyz);\n'+
            'vClipCoord.y = getLinePointParametricDist(vec3(uParamsC8[0][0],uParamsC8[0][1],uParamsC8[0][2]), vec3(uParamsC8[2][0],uParamsC8[2][1],uParamsC8[2][2]), worldPos2.xyz);\n'+
            'vClipCoord.z = 1.0-getLinePointParametricDist(vec3(uParamsC8[0][0],uParamsC8[0][1],uParamsC8[0][2]), vec3(uParamsC8[3][0],uParamsC8[3][1],uParamsC8[3][2]), worldPos2.xyz);\n'+
        '#endif\n'+
    '}';

ThreeShaders.tileFragmentShader = 'precision mediump float;\n'+

    '#ifdef clip4\n'+
        'uniform float uClip[4];\n'+
        'varying vec2 vClipCoord;\n'+
    '#endif\n'+

    '#ifdef clip8\n'+
        'uniform float uClip[8];\n'+
        'varying vec3 vClipCoord;\n'+
    '#endif\n'+


    '#ifdef onlyFog\n'+
        'varying float vFogFactor;\n'+
    '#else\n'+

        '#ifdef mask\n'+
            'uniform sampler2D uSampler2;\n'+
        '#endif\n'+

    '#endif\n'+

    '#ifdef depth\n'+
        'varying float vDepth;\n'+
    '#endif\n'+

    '#ifdef flatShadeVar\n'+
        'varying vec3 vBarycentric;\n'+

        '#ifdef fogAndColor\n'+
            'uniform vec4 uColor;\n'+
        '#endif\n'+

    '#endif\n'+

    '#ifndef depth\n'+
        'varying vec2 vUv;\n'+
    '#endif\n'+

    'uniform sampler2D map;\n'+

    /*'uniform vec4 uParams2;\n'+*/

    'void main() {\n'+

        '#ifdef clip4_nomargin\n'+
            'if (vClipCoord.y > 0.5){\n'+
                'if (vClipCoord.x > 0.5){\n'+
                    'if (uClip[3] == 0.0) discard;\n'+
                '} else {\n'+
                    'if (uClip[2] == 0.0) discard;\n'+
                '}\n'+
            '} else {\n'+
                'if (vClipCoord.x > 0.5){\n'+
                    'if (uClip[1] == 0.0) discard;\n'+
                '} else {\n'+
                    'if (uClip[0] == 0.0) discard;\n'+
                '}\n'+
            '}\n'+
        '#endif\n'+

        '#ifdef clip4\n'+
            'if (vClipCoord.y > 0.5){\n'+
                'if (vClipCoord.x > 0.5){\n'+
                    'if (uClip[3] == 0.0 && !(vClipCoord.x < TMAX && uClip[2] != 0.0) && !(vClipCoord.y < TMAX && uClip[1] != 0.0)) discard;\n'+
                '} else {\n'+
                    'if (uClip[2] == 0.0 && !(vClipCoord.x > TMIN && uClip[3] != 0.0) && !(vClipCoord.y < TMAX && uClip[0] != 0.0)) discard;\n'+
                '}\n'+
            '} else {\n'+
                'if (vClipCoord.x > 0.5){\n'+
                    'if (uClip[1] == 0.0 && !(vClipCoord.x < TMAX && uClip[0] != 0.0) && !(vClipCoord.y > TMIN && uClip[3] != 0.0)) discard;\n'+
                '} else {\n'+
                    'if (uClip[0] == 0.0 && !(vClipCoord.x > TMIN && uClip[1] != 0.0) && !(vClipCoord.y > TMIN && uClip[2] != 0.0)) discard;\n'+
                '}\n'+
            '}\n'+
        '#endif\n'+

        '#ifdef clip8\n'+
            'if (vClipCoord.z <= 0.5){\n'+
                'if (vClipCoord.y <= 0.5){\n'+
                    'if (vClipCoord.x > 0.5){\n'+
                        'if (uClip[5] == 0.0) discard;\n'+
                    '} else {\n'+
                        'if (uClip[4] == 0.0) discard;\n'+
                    '}\n'+
                '} else {\n'+
                    'if (vClipCoord.x > 0.5){\n'+
                        'if (uClip[7] == 0.0) discard;\n'+
                    '} else {\n'+
                        'if (uClip[6] == 0.0) discard;\n'+
                    '}\n'+
                '}\n'+
            '} else {\n'+
                'if (vClipCoord.y <= 0.5){\n'+
                    'if (vClipCoord.x > 0.5){\n'+
                        'if (uClip[1] == 0.0) discard;\n'+
                    '} else {\n'+
                        'if (uClip[0] == 0.0) discard;\n'+
                    '}\n'+
                '} else {\n'+
                    'if (vClipCoord.x > 0.5){\n'+
                        'if (uClip[3] == 0.0) discard;\n'+
                    '} else {\n'+
                        'if (uClip[2] == 0.0) discard;\n'+
                    '}\n'+
                '}\n'+
            '}\n'+
        '#endif\n'+

        '#ifdef flatShadeVar\n'+

            '#ifdef flatShadeVarFallback\n'+
                'vec4 flatShadeData = vec4(1.0);\n'+
            '#else\n'+
                //clip8'#ifdef GL_OES_standard_derivatives\n'+
                    'vec3 nx = dFdx(vBarycentric);\n'+
                    'vec3 ny = dFdy(vBarycentric);\n'+
                    'vec3 normal=normalize(cross(nx,ny));\n'+
                    'vec4 flatShadeData = vec4(vec3(max(0.0,normal.z*(204.0/255.0))+(32.0/255.0)),1.0);\n'+
                //'#else\n'+
                //    'vec4 flatShadeData = vec4(1.0);\n'+
                //'#endif\n'+
            '#endif\n'+

        '#endif\n'+

        '#ifdef flatShade\n'+

            '#ifdef fogAndColor\n'+
               // 'gl_FragColor = vec4(mix(uColor.xyz * flatShadeData.xyz, uParams2.xyz, vTexCoord.z), uColor.w);\n'+
                'gl_FragColor = vec4(uColor.xyz * flatShadeData.xyz, uColor.w);\n'+
            '#else\n'+
                'gl_FragColor = vec4(flatShadeData.xyz, 1.0);\n'+
            '#endif\n'+

        '#else\n'+

            '#ifdef depth\n'+
                'gl_FragColor = fract(vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0) * vDepth) + (-0.5/255.0);\n'+
            '#else\n'+
                'gl_FragColor = texture2D(map, vUv.xy);\n'+
                //'gl_FragColor = vec4(vUv.x,vUv.y,1.0,1.0);\n'+
                'gl_FragColor.w = 1.0;\n'+
            '#endif\n'+


            /*
            'vec4 fogColor = vec4(uParams2.xyz, 1.0);\n'+

            '#ifdef onlyFog\n'+
                'gl_FragColor = vec4(fogColor.xyz, vFogFactor);\n'+
            '#else\n'+

                '#ifdef depth\n'+
                    'gl_FragColor = fract(vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0) * vDepth) + (-0.5/255.0);\n'+
                '#else\n'+

                    '#ifdef externalTex\n'+
                        'vec4 c = texture2D(uSampler, vTexCoord.xy);\n'+'__FILTER__' +
                        'vec4 cc = mix(c, fogColor, vTexCoord.z);\n'+
                        '#ifdef mask\n'+
                            'vec4 c2 = texture2D(uSampler2, vTexCoord.xy);\n'+
                            'cc.w = c.w * uParams2.w * c2.x;\n'+
                        '#else\n'+
                            'cc.w = c.w * uParams2.w;\n'+
                        '#endif\n'+

                        'gl_FragColor = cc;\n'+
                    '#else\n'+
                        'gl_FragColor = mix(texture2D(uSampler, vTexCoord.xy), fogColor, vTexCoord.z);\n'+
                    '#endif\n'+

                '#endif\n'+

            '#endif\n'+
            */

        '#endif\n'+
    '}';


    ThreeShaders.bbox2VertexShader =
        //'attribute float position;\n'+
        'uniform float uPoints[8*3];\n'+
        'void main(){ \n'+
            'int index = int(position) * 3; \n'+
            'gl_Position =  projectionMatrix * modelViewMatrix * vec4(uPoints[index], uPoints[index+1], uPoints[index+2], 1.0);\n'+
        '}';


    ThreeShaders.bboxFragmentShader = 'precision mediump float;\n'+
        'void main() {\n'+
            'gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);\n'+
        '}';


    ThreeShaders.textVertexShader =
        'uniform mat4 uProj;\n'+
        'attribute vec3 color;\n'+
        //'attribute vec2 uv;\n'+
        'varying vec3 vColor;\n'+
        'varying vec2 vUv;\n'+
        'void main(){ \n'+
            'vColor = color;\n'+
            'vUv = uv;\n'+
            'gl_Position =  uProj * vec4(position.x, position.y, position.z, 1.0);\n'+
        '}';


    ThreeShaders.textFragmentShader = 'precision mediump float;\n'+
        'uniform sampler2D map;\n'+
        'varying vec3 vColor;\n'+
        'varying vec2 vUv;\n'+
        'void main() {\n'+
            'gl_FragColor.xyz = vColor * texture2D(map, vUv.xy * vec2(1.0/256.0, 1.0/128.0)).xyz;\n'+
            'gl_FragColor.w = 1.0;\n'+
        '}';


export default ThreeShaders;
