
import RendererGeometry_ from '../../geometry';
import WebGLBBox_ from './bbox';
import WebGLMesh_ from './mesh';
import WebGLPixelLine3_ from './pixel-line3';
import WebGLProgram_ from './program';
import WebGLShaders_ from './shaders';
import WebGLTexture_ from './texture';

//get rid of compiler mess
const RendererGeometry = RendererGeometry_;
const WebGLBBox = WebGLBBox_;
const WebGLMesh = WebGLMesh_;
const WebGLPixelLine3 = WebGLPixelLine3_;
const WebGLProgram = WebGLProgram_;
const WebGLShaders = WebGLShaders_;
const WebGLTexture = WebGLTexture_;


const WebGLInit = function(gpu) {
    this.gpu = gpu;
    this.renderer = gpu.renderer;
    this.core = gpu.renderer.core;

    this.initShaders();
    this.initHeightmap();
    this.initSkydome();
    this.initHitmap();
    this.initTextMap();
    this.initImage();
    this.initTestMap();
    this.initBBox();
    this.initLines();
    this.initBaricentricBuffer();
};


WebGLInit.prototype.initShaders = function() {
    const shaders = WebGLShaders;
    //const renderer = this.renderer;
    const gpu = this.gpu;

    gpu.progTile = [new WebGLProgram(gpu, '#define variants\n' +shaders.tileVertexShader, '#define variants\n' + shaders.tileFragmentShader)];
    gpu.progTile2 = [new WebGLProgram(gpu, '#define variants\n#define externalTex\n' + shaders.tileVertexShader, '#define variants\n#define externalTex\n' + shaders.tileFragmentShader.replace('__FILTER__', ''))];
    gpu.progTile3 = [new WebGLProgram(gpu, '#define variants\n#define externalTex\n' + shaders.tileVertexShader, '#define variants\n#define externalTex\n#define mask\n' + shaders.tileFragmentShader.replace('__FILTER__', ''))];

    gpu.progFogTile = [new WebGLProgram(gpu, '#define variants\n#define onlyFog\n' + shaders.tileVertexShader, '#define variants\n#define onlyFog\n' + shaders.tileFragmentShader)];

    const sdExt = '#extension GL_OES_standard_derivatives : enable\n';

    gpu.progFlatShadeTile = [new WebGLProgram(gpu, '#define variants\n#define flatShadeVar\n' + shaders.tileVertexShader, sdExt+'#define variants\n#define flatShadeVar\n#define flatShade\n' + shaders.tileFragmentShader)];
    gpu.progFlatShadeTileSE = [new WebGLProgram(gpu, '#define variants\n#define applySE\n#define flatShadeVar\n' + shaders.tileVertexShader, sdExt+'#define variants\n#define flatShadeVar\n#define flatShade\n' + shaders.tileFragmentShader)];
    gpu.progCFlatShadeTile = new WebGLProgram(gpu, '#define flatShadeVar\n' + shaders.tileVertexShader, (sdExt+'#define flatShadeVar\n#define flatShade\n#define fogAndColor\n' + shaders.tileFragmentShader).replace('mediump', 'highp'));
    gpu.progCFlatShadeTileSE = new WebGLProgram(gpu, '#define applySE\n#define flatShadeVar\n' + shaders.tileVertexShader, (sdExt+'#define flatShadeVar\n#define flatShade\n#define fogAndColor\n' + shaders.tileFragmentShader).replace('mediump', 'highp'));

    gpu.progDepthTile = [new WebGLProgram(gpu, '#define variants\n#define depth\n' + shaders.tileVertexShader, ('#define variants\n#define depth\n' + shaders.tileFragmentShader).replace('mediump', 'highp'))];
    gpu.progDepthHeightmap = new WebGLProgram(gpu, shaders.heightmapDepthVertexShader, (shaders.heightmapDepthFragmentShader).replace('mediump', 'highp'));

    gpu.progWireFrameBasic = [new WebGLProgram(gpu, '#define variants\n' + shaders.tileVertexShader, '#define variants\n' + shaders.tileWireFrameBasicShader)];

    gpu.progShadedTile = new WebGLProgram(gpu, shaders.shadedMeshVertexShader, shaders.shadedMeshFragmentShader);
    gpu.progTShadedTile = new WebGLProgram(gpu, shaders.shadedMeshVertexShader, '#define textured\n' + shaders.shadedMeshFragmentShader);

    gpu.progHeightmap = new WebGLProgram(gpu, shaders.heightmapVertexShader, shaders.heightmapFragmentShader);
    gpu.progPlane = new WebGLProgram(gpu, '#define flat\n' + shaders.planeVertexShader, shaders.planeFragmentShader); //flat
    gpu.progPlane2 = new WebGLProgram(gpu, '#define poles\n' + shaders.planeVertexShader, '#define poles\n' + shaders.planeFragmentShader); //poles
    gpu.progPlane3 = new WebGLProgram(gpu, shaders.planeVertexShader, shaders.planeFragmentShader); // grid
    gpu.progPlaneD = new WebGLProgram(gpu, '#define depth\n#define flat\n' + shaders.planeVertexShader, '#define depth\n' + shaders.planeFragmentShader); //flat
    gpu.progPlane2D = new WebGLProgram(gpu, '#define depth\n#define poles\n' + shaders.planeVertexShader, '#define depth\n#define poles\n' + shaders.planeFragmentShader); //poles
    gpu.progPlane3D = new WebGLProgram(gpu, '#define depth\n' + shaders.planeVertexShader, '#define depth\n' + shaders.planeFragmentShader); // grid

    gpu.progSkydome = new WebGLProgram(gpu, shaders.skydomeVertexShader, shaders.skydomeFragmentShader);
    gpu.progStardome = new WebGLProgram(gpu, shaders.skydomeVertexShader, shaders.stardomeFragmentShader);

    gpu.progAtmo2 = new WebGLProgram(gpu, shaders.atmoVertexShader, shaders.atmoFragmentShader);
    gpu.progAtmo = new WebGLProgram(gpu, shaders.atmoVertexShader3, shaders.atmoFragmentShader3);

    gpu.progPCloud = new WebGLProgram(gpu, shaders.pointsVertexShader, shaders.pointsFragmentShader);

    gpu.progBBox = new WebGLProgram(gpu, shaders.bboxVertexShader, shaders.bboxFragmentShader);
    gpu.progBBox2 = new WebGLProgram(gpu, shaders.bbox2VertexShader, shaders.bboxFragmentShader);

    gpu.progLine = new WebGLProgram(gpu, shaders.lineVertexShader, shaders.lineFragmentShader); //line
    gpu.progLineSE = new WebGLProgram(gpu, '#define applySE\n' + shaders.lineVertexShader, shaders.lineFragmentShader); //line SE
    gpu.progELine = new WebGLProgram(gpu, '#define withElements\n' + shaders.lineVertexShader, '#define withElements\n' + shaders.lineFragmentShader); //line elements
    gpu.progELineSE = new WebGLProgram(gpu, '#define applySE\n#define withElements\n' + shaders.lineVertexShader, '#define withElements\n' + shaders.lineFragmentShader); //line SE elements
    gpu.progLine3 = new WebGLProgram(gpu, '#define pixelLine\n' + shaders.lineVertexShader, shaders.lineFragmentShader); //pixel line
    gpu.progELine3 = new WebGLProgram(gpu, '#define pixelLine\n#define withElements\n' + shaders.lineVertexShader, '#define withElements\n' + shaders.lineFragmentShader); //pixel line elements
    gpu.progLine3SE = new WebGLProgram(gpu, '#define applySE\n#define pixelLine\n' + shaders.lineVertexShader, shaders.lineFragmentShader); //pixel line SE
    gpu.progELine3SE = new WebGLProgram(gpu, '#define applySE\n#define pixelLine\n#define withElements\n' + shaders.lineVertexShader, '#define withElements\n' + shaders.lineFragmentShader); //pixel line SE elements
    gpu.progLine4 = new WebGLProgram(gpu, '#define pixelLine\n#define dataPoints\n' + shaders.lineVertexShader, shaders.lineFragmentShader); //direct linestring pixel line
    gpu.progLine5 = new WebGLProgram(gpu, '#define pixelLine\n#define dataPoints\n#define dataPoints2\n' + shaders.lineVertexShader, shaders.lineFragmentShader); //clipped direct linestring pixel line, physical coords
    gpu.progRLine = new WebGLProgram(gpu, '#define dynamicWidth\n' + shaders.lineVertexShader, shaders.lineFragmentShader); //dynamic width line
    gpu.progRLineSE = new WebGLProgram(gpu, '#define applySE\n#define dynamicWidth\n' + shaders.lineVertexShader, shaders.lineFragmentShader); //dynamic width line
    gpu.progERLine = new WebGLProgram(gpu, '#define dynamicWidth\n#define withElements\n' + shaders.lineVertexShader, '#define withElements\n' + shaders.lineFragmentShader); //dynamic width line elements
    gpu.progERLineSE = new WebGLProgram(gpu, '#define applySE\n#define dynamicWidth\n#define withElements\n' + shaders.lineVertexShader, '#define withElements\n' + shaders.lineFragmentShader); //dynamic width line elements

    gpu.progTLine = new WebGLProgram(gpu, shaders.tlineVertexShader, shaders.tlineFragmentShader); //textured line
    gpu.progTPLine = new WebGLProgram(gpu, shaders.tplineVertexShader, shaders.tlineFragmentShader); //textured pixed line
    gpu.progTBLine = new WebGLProgram(gpu, shaders.tlineVertexShader, shaders.tblineFragmentShader); //textured line with background color
    gpu.progTPBLine = new WebGLProgram(gpu, shaders.tplineVertexShader, shaders.tblineFragmentShader); //textured pixel line with background color
    gpu.progETLine = new WebGLProgram(gpu, shaders.etlineVertexShader, shaders.elineFragmentShader); //textured line elements
    gpu.progETPLine = new WebGLProgram(gpu, shaders.etplineVertexShader, shaders.elineFragmentShader); //textured pixed line elements
    //gpu.progLineWireframe = new WebGLProgram(gpu, shaders.lineWireframeVertexShader, shaders.lineWireframeFragmentShader); //line with wireframe for debugging

    gpu.progText2 = new WebGLProgram(gpu, '#define lineLabel\n' + shaders.lineVertexShader, shaders.text2FragmentShader); //line label
    gpu.progText2SE = new WebGLProgram(gpu, '#define applySE\n#define lineLabel\n' + shaders.lineVertexShader, shaders.text2FragmentShader); //line label

    gpu.progLineLabel16 = new WebGLProgram(gpu, '#define DSIZE 16\n#define lineLabel2\n' + shaders.lineVertexShader, shaders.text2FragmentShader);
    gpu.progLineLabel32 = new WebGLProgram(gpu, '#define DSIZE 32\n#define lineLabel2\n' + shaders.lineVertexShader, shaders.text2FragmentShader);
    gpu.progLineLabel48 = new WebGLProgram(gpu, '#define DSIZE 48\n#define lineLabel2\n' + shaders.lineVertexShader, shaders.text2FragmentShader);
    gpu.progLineLabel64 = new WebGLProgram(gpu, '#define DSIZE 64\n#define lineLabel2\n' + shaders.lineVertexShader, shaders.text2FragmentShader);
    gpu.progLineLabel96 = new WebGLProgram(gpu, '#define DSIZE 96\n#define lineLabel2\n' + shaders.lineVertexShader, shaders.text2FragmentShader);
    gpu.progLineLabel128 = new WebGLProgram(gpu, '#define DSIZE 128\n#define lineLabel2\n' + shaders.lineVertexShader, shaders.text2FragmentShader);

    gpu.progPolygon = new WebGLProgram(gpu, shaders.polygonVertexShader, shaders.polygonFragmentShader);
    gpu.progImage = new WebGLProgram(gpu, shaders.imageVertexShader, shaders.imageFragmentShader);
    gpu.progIcon = new WebGLProgram(gpu, shaders.iconVertexShader, shaders.textFragmentShader); //label or icon
    gpu.progIcon2 = new WebGLProgram(gpu, shaders.icon2VertexShader, shaders.text2FragmentShader); //label

    gpu.progLabel16 = new WebGLProgram(gpu, '#define DSIZE 16\n' + shaders.icon3VertexShader, shaders.text2FragmentShader); //label with singleBuffer
    gpu.progLabel32 = new WebGLProgram(gpu, '#define DSIZE 32\n' + shaders.icon3VertexShader, shaders.text2FragmentShader);
    gpu.progLabel48 = new WebGLProgram(gpu, '#define DSIZE 48\n' + shaders.icon3VertexShader, shaders.text2FragmentShader);
    gpu.progLabel64 = new WebGLProgram(gpu, '#define DSIZE 64\n' + shaders.icon3VertexShader, shaders.text2FragmentShader);
    gpu.progLabel96 = new WebGLProgram(gpu, '#define DSIZE 96\n' + shaders.icon3VertexShader, shaders.text2FragmentShader);
    gpu.progLabel128 = new WebGLProgram(gpu, '#define DSIZE 128\n' + shaders.icon3VertexShader, shaders.text2FragmentShader);
};

WebGLInit.prototype.initProceduralShaders = function() {
    const shaders = WebGLShaders;
    const gpu = this.gpu;
    gpu.progHmapPlane = new WebGLProgram(gpu, shaders.planeVertex4Shader, shaders.planeFragmentShader2);
    gpu.progHmapPlane2 = new WebGLProgram(gpu, shaders.planeVertex4Shader, '#define grid\n' + shaders.planeFragmentShader2);
    gpu.progHmapPlane3 = new WebGLProgram(gpu, shaders.planeVertex4Shader, '#define exmap\n' + shaders.planeFragmentShader2);
    gpu.progHmapPlane4 = new WebGLProgram(gpu, shaders.planeVertex4Shader, '#define flat\n' + shaders.planeFragmentShader2);
    gpu.progHmapPlane5 = new WebGLProgram(gpu, shaders.planeVertex4Shader, '#define normals\n' + shaders.planeFragmentShader2);
    gpu.progHmapPlane6 = new WebGLProgram(gpu, shaders.planeVertex4Shader, '#define nmix\n#define normals\n' + shaders.planeFragmentShader2);
    gpu.progHmapPlane7 = new WebGLProgram(gpu, shaders.planeVertex4Shader, '#define nmix\n' + shaders.planeFragmentShader2);
    gpu.progHmapPlane8 = new WebGLProgram(gpu, shaders.planeVertex4Shader, '#define exmap\n#define classmap\n' + shaders.planeFragmentShader2);
}

WebGLInit.prototype.initHeightmap = function() {
    const use16Bit = this.renderer.core.config.map16bitMeshes;
    const gpu = this.gpu;

    // initialize heightmap geometry
    let meshData = RendererGeometry.buildHeightmap(5, true);
    //gpu.heightmapMesh = new WebGLMesh(gpu, meshData, null, this.core, true, use16Bit);

    meshData = RendererGeometry.buildPlane(16, true);
    gpu.planeMesh = new WebGLMesh(gpu, meshData, null, this.core, true, use16Bit, true);

    meshData = RendererGeometry.buildPlane(128, true);
    gpu.planeMesh2 = new WebGLMesh(gpu, meshData, null, this.core, true, use16Bit, true);

    // create heightmap texture
    const size = 64;
    const halfLineWidth = 1;
    const data = new Uint8Array( size * size * 4 );

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {

            const index = (i*size+j)*4;

            if (i < halfLineWidth || i >= size-halfLineWidth || j < halfLineWidth || j >= size-halfLineWidth) {
                data[index] = 255;
                data[index + 1] = 255;
                data[index + 2] = 255;
            } else {
                data[index] = 32;
                data[index + 1] = 32;
                data[index + 2] = 32;
            }

            data[index + 3] = 255;
        }
    }


    gpu.heightmapTexture = new WebGLTexture(gpu);
    gpu.heightmapTexture.createFromData(size, size, data, 'trilinear', true);
};


WebGLInit.prototype.initHitmap = function() {
    const gpu = this.gpu;
    const renderer = this.renderer
    const size = renderer.hitmapSize;
    const data = new Uint8Array( size * size * 4 );

    if (this.renderer.hitmapMode > 2) {
        this.renderer.hitmapData = data;
    }

    renderer.hitmapTexture = new WebGLTexture(this.gpu);
    renderer.hitmapTexture.createFromData(size, size, data);
    renderer.hitmapTexture.createFramebuffer(size, size);

    renderer.geoHitmapTexture = new WebGLTexture(this.gpu);
    renderer.geoHitmapTexture.createFromData(size, size, data);
    renderer.geoHitmapTexture.createFramebuffer(size, size);

    renderer.geoHitmapTexture2 = new WebGLTexture(this.gpu);
    renderer.geoHitmapTexture2.createFromData(size, size, data);
    renderer.geoHitmapTexture2.createFramebuffer(size, size);
};


WebGLInit.prototype.initTestMap = function() {
    const gpu = this.gpu;

   // create red texture
    const size = 16;
    let i, j, index;
    let data = new Uint8Array( size * size * 4 );

    for (i = 0; i < size; i++) {
        for (j = 0; j < size; j++) {
            index = (i*size+j)*4;
            data[index] = 255;
            data[index + 1] = 0;
            data[index + 2] = 0;
            data[index + 3] = 255;
        }
    }

    gpu.redTexture = new WebGLTexture(gpu);
    gpu.redTexture.createFromData(size, size, data);

    data = new Uint8Array( size * size * 4 );

    for (i = 0; i < size; i++) {
        for (j = 0; j < size; j++) {
            index = (i*size+j)*4;
            data[index] = 255;
            data[index + 1] = 255;
            data[index + 2] = 255;
            data[index + 3] = 255;
        }
    }

    gpu.whiteTexture = new WebGLTexture(gpu);
    gpu.whiteTexture.createFromData(size, size, data);

    data = new Uint8Array( size * size * 4 );

    for (i = 0; i < size; i++) {
        for (j = 0; j < size; j++) {
            index = (i*size+j)*4;
            data[index] = 0;
            data[index + 1] = 0;
            data[index + 2] = 0;
            data[index + 3] = 255;
        }
    }

    gpu.blackTexture = new WebGLTexture(gpu);
    gpu.blackTexture.createFromData(size, size, data);
};


WebGLInit.prototype.initTextMap = function() {
    //font texture
    const texture = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAACACAMAAADTa0c4AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAAZQTFRFAAAA////pdmf3QAABIFJREFUeNrsnNuyqzAIhsP7v/Se6Yxra0L4OUVNCzetVqP5DAQItrVOiLg95739NnfOaR99RDj6esBw+CKZXiMK4PiuBkAcANoHAP3J5fzzAV2jePQIt6f4Ndb/MIChlVcCEFpAACZPfN4KUAF0/ufboDW3AuBMFgBwHTCfg2ftYgDUKBuA1ABuHKvA2P+5XdONIEt7BO2o2MdlAJoTQOsV6GEAswt0Zq/bsBhdeQQkqEDMwmIAnJHzA8i3ASkWRFKBbADyLGB3mlYD6DyhA4DfBlgsBDtirUPcBgC5woStYMgVtgKATWcB6DskKUEkGFLYrGw3+l3ydR16wKbbPDlWp4Xfo9vZwR1jtOMA6GkABrdvNmt1Vluy6pyvxu4Xt62fquyTggCTsIkCoIuv8gAA08w+ATBXAdSRY56xPDFPx/VPWFZp5v65kFMPgFjP70YASMfRsDn01xLPcwkRq1HLMoK647hR8v+nId74MQBjvIbUQePra42ZVXVcBCR3mIY89mYAlNGLflqA0V1seosCQNMg80B0bsLGAIDNwvFyiqu66ngVGGMGVBwyWwIwpty2DqEr/qf0Bq+DbjYkkcr4VUoOxiRjrYn3YY5SC4BQB/cF0Lq4kD1RCJ+tN4g6Jps5zfWu+QmSz9sUABkA0BIAXocmBwCJ99MDIASATkmtLQAIft4IgE/ZDStZ59yQbOQQAGZWYMbZ3FFCAGRHnwHQznegGAE+zwxNi8kALCOgS9tzAC4jYG1Qo0myRm0Ae/z8eleqewBoZLwfUswCsbT1KgBZD6QAzAEoXUe3K+xxVf2uLf5U3nBeMPRyACW/LtrwVX989id3PRQOG5Io6vh9XwC6stHIdGdJozun03lxNlwvH4u6UgDM8/LmJyx7ak12feEebaXmUwCOYJWk1JcYKsl74HL74wAaH93NqkE1FSKXc4cv0AjaPEEPgE4ru/ieWdvzVq/4psG3AYDFHlEAioQCuEgMgPjK1VDrqlkbTABAiQBGK38B0BlBSf9xtiAJQDM4NtDqMlaeyduTtkDjHgAtEQBj5ZGK2QE0aCcMAIxLSw0WVYlGDgOQXWE+afouAM0S398O4Nej3wIQf4cIHSfz9pbWugyep4MFIAFARvspbm8BcE2DOdvWnCJQAWFhJ/hKzh4AaB2A7NxedKmLPc+6PN4cL2S8GYC1QMIEQJvmFsJfxdvkEQAoLV4AogBS8/kNvdXlWe5GKhABvQUAZASDALJffY1XfsrToFXFbvYD1gBo6wC8LR7/uvj9CwHcfWuoUJItsVl5nwWAnhxxqsXatUq0OYCcaS/fkbK61u5H8jwAuUIEZXHNL1Jmub5oSKZWiDR9FttM4HEAigqRpn8TeB2AuWNiByAXSHCGbB7/3qYCfgCgPgADEEskbjCCaJDB/+kR6wP4P1Obl8jsBwDUB4yAxqKkthaATjX0KmCtDyCxm+yIMLjCbwBgrg94FYC3h8vLPPmfAVBSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlLy9fJPgAEAvWMULbGsSjwAAAAASUVORK5CYII=';
    this.gpu.textTexture2 = new WebGLTexture(this.gpu, texture, this.core, null, true);
};


WebGLInit.prototype.initImage = function() {
    const gl = this.gpu.gl;
    const gpu = this.gpu;

    //create vertices buffer for rect
    gpu.rectVerticesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.rectVerticesBuffer);

    const vertices = [ 0, 0, 0, 1,   1, 0, 0, 1,   2, 0, 0, 1,   3, 0, 0, 1 ];

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gpu.rectVerticesBuffer.itemSize = 4;
    gpu.rectVerticesBuffer.numItems = 4;

    //create indices buffer for rect
    gpu.rectIndicesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpu.rectIndicesBuffer);

    const indices = [ 0, 2, 1,    0, 3, 2 ];

    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    gpu.rectIndicesBuffer.itemSize = 1;
    gpu.rectIndicesBuffer.numItems = 6;

    gpu.textBuff16 = new Float32Array(16 * 4);
    gpu.textBuff32 = new Float32Array(32 * 4);
    gpu.textBuff48 = new Float32Array(48 * 4);
    gpu.textBuff64 = new Float32Array(64 * 4);

    gpu.textQuads16 = this.generateTextQuads(16);
    gpu.textQuads32 = this.generateTextQuads(32);
    gpu.textQuads48 = this.generateTextQuads(48);
    gpu.textQuads64 = this.generateTextQuads(64);
    gpu.textQuads96 = this.generateTextQuads(96);
    gpu.textQuads128 = this.generateTextQuads(128);
};


WebGLInit.prototype.generateTextQuads = function(num) {
    const gl = this.gpu.gl;

    const buffer = new Float32Array(num * 2 * 6);
    let index, j;

    for (let i = 0; i < num; i++) {
        index = i * 6 * 2;

        j = 0;
        buffer[index] = i;
        buffer[index+1] = j;

        j = 1;
        buffer[index+2] = i;
        buffer[index+3] = j;

        j = 2;
        buffer[index+4] = i;
        buffer[index+5] = j;

        j = 2;
        buffer[index+6] = i;
        buffer[index+7] = j;

        j = 3;
        buffer[index+8] = i;
        buffer[index+9] = j;

        j = 0;
        buffer[index+10] = i;
        buffer[index+11] = j;
    }

    //create vertices buffer for rect
    const vbuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuffer);

    gl.bufferData(gl.ARRAY_BUFFER, buffer, gl.STATIC_DRAW);
    vbuffer.itemSize = 2;
    vbuffer.numItems = num * 6;

    return vbuffer;
};

WebGLInit.prototype.initSkydome = function() {
    const use16Bit = this.renderer.core.config.map16bitMeshes;
    let meshData = RendererGeometry.buildSkydome(32, 64, use16Bit);
    this.gpu.skydomeMesh = new WebGLMesh(this.gpu, meshData, null, this.core, true, use16Bit);
    //this.skydomeTexture = new WebGLTexture(this.gpu, "./skydome.jpg", this.core);

    meshData = RendererGeometry.buildSkydome(128, 256, use16Bit, true);
    this.gpu.atmoMesh = new WebGLMesh(this.gpu, meshData, null, this.core, true, use16Bit);
};


WebGLInit.prototype.initBBox = function() {
    const gpu = this.gpu;
    gpu.bboxMesh = new WebGLBBox(gpu);
    gpu.bboxMesh2 = new WebGLBBox(gpu, true);
};


WebGLInit.prototype.initLines = function() {
    const gpu = this.gpu;
    gpu.plineBuffer = new Float32Array(32*3);
    gpu.plines = new WebGLPixelLine3(gpu, this.core, true, 64, true, 8);
    gpu.plineJoints = new WebGLPixelLine3(gpu, this.core, false, 64, true, 8);

    gpu.stencilLineState = gpu.createState({blend:true, stencil:true, culling: false});
    gpu.lineLabelState = gpu.createState({blend:true, culling: false, zequal: true, zwrite:false});
    gpu.labelState = gpu.createState({blend:true, culling: false, zequal: true});
    gpu.stencilLineHitState = gpu.createState({blend:false, stencil:true, culling: false});
    gpu.lineLabelHitState = gpu.createState({blend:false, culling: false});

    gpu.polygonB1S1C1tate = gpu.createState({blend:true, stencil:true, culling: true, zequal: true});
    gpu.polygonB1S0C1tate = gpu.createState({blend:true, stencil:false, culling: true, zequal: true});
    gpu.polygonB1S1C0tate = gpu.createState({blend:true, stencil:true, culling: false, zequal: true});
    gpu.polygonB1S0C0tate = gpu.createState({blend:true, stencil:false, culling: false, zequal: true});

    gpu.polygonB0S1C1tate = gpu.createState({blend:false, stencil:true, culling: true, zequal: true});
    gpu.polygonB0S0C1tate = gpu.createState({blend:false, stencil:false, culling: true, zequal: true});
    gpu.polygonB0S1C0tate = gpu.createState({blend:false, stencil:true, culling: false, zequal: true});
    gpu.polygonB0S0C0tate = gpu.createState({blend:false, stencil:false, culling: false, zequal: true});

};


WebGLInit.prototype.initBaricentricBuffer = function() {
    const gpu = this.gpu;
    const buffer = new Array(65535*3);

    for (let i = 0; i < 65535*3; i+=9) {
        buffer[i] = 1.0;
        buffer[i+1] = 0;
        buffer[i+2] = 0;

        buffer[i+3] = 0;
        buffer[i+4] = 1.0;
        buffer[i+5] = 0;

        buffer[i+6] = 0;
        buffer[i+7] = 0;
        buffer[i+8] = 1.0;
    }

    const gl = gpu.gl;
    gpu.barycentricBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.barycentricBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(buffer), gl.STATIC_DRAW);
    gpu.barycentricBuffer.itemSize = 3;
    gpu.barycentricBuffer.numItems = buffer.length / 3;
};


export default WebGLInit;
