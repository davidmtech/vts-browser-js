
import {vec3 as vec3_, mat4 as mat4_} from '../utils/matrix';
//import GpuDevice_ from './gpu/device';
//import GpuTexture_ from './gpu/texture';
//import GpuFont_ from './gpu/font';
import GpuShaders_ from './shaders';

import * as THREE from './libs/three.module.js';

import Camera_ from './camera';
import RenderInit_ from './init';
import RenderDraw_ from './draw';
import RenderRMap_ from './rmap';

//get rid of compiler mess
const vec3 = vec3_, mat4 = mat4_;
//var GpuDevice = GpuDevice_;
//var GpuTexture = GpuTexture_;
//var GpuFont = GpuFont_;
const Camera = Camera_;
const RenderInit = RenderInit_;
const RenderDraw = RenderDraw_;
const RenderRMap = RenderRMap_;
const GpuShaders = GpuShaders_;

var matCounter = 1;

var Renderer = function(core, div, onUpdate, onResize, config) {
    this.config = config || {};
    this.core = core;
    this.marginFlags = 0;
    this.progTile = null;
    this.progHeightmap = null;
    this.progSkydome = null;
    this.progWireframeTile = null;
    this.progWireframeTile2 = null;
    this.progText = null;
    this.div = div;
    this.onUpdate = onUpdate;
    this.killed = false;
    this.onlyDepth = false;
    this.onlyLayers = false;
    this.onlyHitLayers = false;
    this.onlyAdvancedHitLayers = false;
    this.advancedPassNeeded = false;
    this.hitmapCounter = 0;
    this.geoRenderCounter = 0;
    this.geoHitmapCounter = 0;
    this.frameTime = 0;
    this.geometries = {};
    this.clearStencilPasses = [];
    this.onResizeCall = onResize;
    //this.math = Math;
    this.stencilLineState = null;
    this.drawLabelBoxes = false;
    this.drawGridCells = false;
    this.drawAllLabels = false;
    this.debug = {};
    this.mapHack = null;

    this.geodataSelection = [];
    this.hoverFeatureCounter = 0;
    this.hoverFeatureList = [];

    this.touchSurfaceEvent = [];

    var rect = this.div.getBoundingClientRect();

    this.winSize = [rect.width, rect.height]; //QSize
    this.curSize = [rect.width, rect.height]; //QSize
    this.oldSize = [rect.width, rect.height]; //QSize
    this.dirty = true;
    this.cameraVector = [0,1,0];
    this.viewExtent = 1;
    //this.texelSizeLimit = this.core.mapConfig.texelSize * texelSizeFactor;

//    this.gpu = new GpuDevice(this, div, this.curSize, this.config.rendererAllowScreenshots, this.config.rendererAntialiasing, this.config.rendererAnisotropic);

    this.gpu = {

        createState : (function(){}),
        clear : (function(){}),
        setState : (function(){}),
        setViewport : (function(){}),

    };

    this.draw = {

        getTextSize : (function(){}),
        drawText : (function(){}),
        drawBall : (function(){}),

        clearJobHBuffer : (function(){}),
        clearJobBuffer : (function(){}),
    }


    this.camera = new Camera(this, 45, 2, 1200000.0);

    this.box = new THREE.Box3();
    this.box.setFromCenterAndSize( new THREE.Vector3( 0,0,0 ), new THREE.Vector3( 1,1,1) );

    this.helper = new THREE.Box3Helper( this.box, 0x0000ff );


    this.scene = new THREE.Scene();
    //this.scene.background = new THREE.Color( 0xaaaaaa );
    this.scene.background = new THREE.Color( 0xaa0000 );

    this.camera2 = new THREE.PerspectiveCamera( 45, this.aspectRatio, 0.1, 10000);
    this.camera2.position.set(  0, 200, 0 );
    this.camera2.lookAt( new THREE.Vector3() );

    let widthOrtho = 1024, heightOrtho = 768;
    this.orthoCamera = new THREE.OrthographicCamera( widthOrtho / - 2, widthOrtho / 2, heightOrtho / 2, heightOrtho / - 2, 0.001, 1000 );

    this.models = new THREE.Group();
    this.models.frustumCulled = false;
    this.scene.add(this.models);
    this.scene.add(this.helper);

    //reduce garbage collection
    this.drawTileMatrix = mat4.create();
    this.drawTileMatrix2 = mat4.create();
    this.drawTileVec = [0,0,0];
    this.drawTileWorldMatrix = mat4.create();
    this.pixelTileSizeMatrix = mat4.create();

    this.heightmapMesh = null;
    this.heightmapTexture = null;

    this.skydomeMesh = null;
    this.skydomeTexture = null;

    this.hitmapTexture = null;
    this.geoHitmapTexture = null;
    this.hitmapSize = this.config.mapDMapSize;
    this.hitmapMode = this.config.mapDMapMode;
    this.updateHitmap = true;
    this.updateGeoHitmap = true;

    this.redTexture = null;

    this.rectVerticesBuffer = null;
    this.rectIndicesBuffer = null;
    this.imageProjectionMatrix = null;

    this.font = null;
    this.fonts = {};
    this.fogDensity = 0;

    this.gmap = new Array(2048);
    this.gmap2 = new Array(2048);
    this.gmap3 = new Array(10000);
    this.gmap3Size = new Array(10000);
    this.gmap4 = new Array(10000);
    this.gmapIndex = 0;
    this.gmapTop = new Array(512);
    this.gmapHit = new Array(512);
    this.gmapStore = new Array(512);
    this.fmaxDist = 0;
    this.fminDist = 0;

    this.jobZBuffer = new Array(512);
    this.jobZBufferSize = new Array(512);

    this.jobZBuffer2 = new Array(512);
    this.jobZBuffer2Size = new Array(512);

    this.jobHBuffer = {};
    this.jobHBufferSize = 0;
    this.jobHSortBuffer = new Array(2048);


    for (var i = 0, li = this.jobZBuffer.length; i < li; i++) {
        this.jobZBuffer[i] = [];
        this.jobZBufferSize[i] = 0;
        this.jobZBuffer2[i] = {};
        this.jobZBuffer2Size[i] = 0;
    }

    for (i = 0, li = this.gmap3.length; i < li; i++) {
        this.gmap3[i] = [];
        this.gmap3Size[i] = 0;
    }

    this.radixCountBuffer16 = new Uint16Array(256*4);
    this.radixCountBuffer32 = new Uint32Array(256*4);
    //this.radixOutputBufferUint32 = new Uint32Array(256*256);
    //this.radixOutputBufferFloat32 = new Uint32Array(256*256);

    this.buffFloat32 = new Float32Array(1);
    this.buffUint32 = new Uint32Array(this.buffFloat32.buffer);

    this.layerGroupVisible = [];
    this.bitmaps = {};

    this.cameraPosition = [0,0,0];
    this.cameraOrientation = [0,0,0];
    this.cameraTiltFator = 1;
    this.cameraViewExtent = 1;
    this.distanceFactor = 1;
    this.tiltFactor = 1;
    this.localViewExtentFactor = 1;
    this.cameraVector = [0,0,0];
    this.labelVector = [0,0,0];
    this.drawnGeodataTiles = 0;
    this.drawnGeodataTilesFactor = 0;
    this.drawnGeodataTilesUsed = false;
    this.progMap = {};
    this.gridHmax = 0;
    this.gridHmin = 0;
    this.seCounter = 0;

    //hack for vts maps
    //this.vtsHack = true;
    //this.vtsHack = false;

    //reduce garbage collection
    this.updateCameraMatrix = mat4.create();

    this.seTmpVec = [0,0,0];
    this.seTmpVec2 = [0,0,0];
    this.seTmpVec3 = [0,0,0];

    //debug
    this.lastHitPosition = [0,0,100];
    this.logTilePos = null;
    this.setSuperElevation(0,2,4000,1.5);

    window.addEventListener('resize', (this.onResize).bind(this), false);

    //this.gpu.init();

    //intit resources
    // eslint-disable-next-line
    //this.init = new RenderInit(this);
    this.rmap = new RenderRMap(this, 50);
    //this.draw = new RenderDraw(this);

    this.tileMaterialInjectVersion = this.generateMaterial(new THREE.MeshBasicMaterial({}), {
        uniforms: {  uvTrans : { value: new THREE.Vector4(1,1,0,0) } },
        vertUniforms: 'uniform vec4 uvTrans;\n',
        vertUvCode: 'vUv = vec2(vUv.x * uvTrans.x + uvTrans.z, vUv.y * uvTrans.y + uvTrans.w);',
        onRender: (function(texture, t){

            //texture.needsUpdate = true;
            this.material.map = texture;
            //this.material.needsUpdate = true;

            if (this.material.userData.shader) {
                this.material.userData.shader.uniforms.uvTrans.value.set(t[0],t[1],t[2],t[3]);
                this.material.userData.shader.uniforms.map.value = texture;
                this.material.userData.shader.uniforms.map.needsUpdate = true;
                //this.material.userData.shader.needsUpdate = true;
                //this.material.userData.shader.uniformsNeedUpdate = true;
                this.material.uniformsNeedUpdate = true;
                this.material.isShaderMaterial = true;      // THIS IS HACK, I SHOULD CREATE IT AS SHADER MATERIAL !!!!
            }

        })

     });

     this.tileMaterial = this.generateTileMaterial({

         onRender: (function(texture, t, flags, splitMask){

             //if (this.material.userData.shader) {
                 //this.material.userData.shader.uniforms.uvTrans.value.set(t[0],t[1],t[2],t[3]);
                 //this.material.userData.shader.uniforms.map.value = texture;
                 //this.material.userData.shader.uniforms.map.needsUpdate = true;

                 this.material.uniforms.uvTrans.value.set(t[0],t[1],t[2],t[3]);
                 this.material.uniforms.map.value = texture;
                 this.material.uniforms.map.needsUpdate = true;

                 if (flags & VTS_MAT_FLAG_C4){
                     this.material.uniforms.uClip.value = splitMask.slice();
                     this.material.uniforms.uClip.needsUpdate = true;
                 }


                 this.material.uniformsNeedUpdate = true;
             //}

         })

     });

     this.tileMaterials = new Array(64);
     this.tileMaterials[0] = this.tileMaterial;

     this.bboxMaterial = this.generateBBoxMaterial();
     this.bboxMesh2 = this.createBBox2();

     this.textMaterial = new THREE.ShaderMaterial( {
         uniforms: {},
         vertexShader: GpuShaders.bbox2VertexShader,
         fragmentShader: GpuShaders.bboxFragmentShader
     } );


     this.textBuffer = this.createTextBuffer(3*2*256);
     this.textBufferIndex = 0;

     this.cleanTexts();
     this.addText(100,100,0.5, 255, 0, 255, 50, "aa");

     var factor = 1;
     this.resizeGL(Math.floor(this.curSize[0]*factor), Math.floor(this.curSize[1]*factor));
};


Renderer.prototype.cleanTexts = function() {
    this.textBufferIndex = 0;
}


Renderer.prototype.addText = function(x,y,z,r,g,b, size, text) {
    const index = this.textBufferIndex;
    const vertices = this.textBuffer.geometry.attributes.position.array;
    const colors = this.textBuffer.geometry.attributes.color.array;

    const sizeX = size - 1;
    const sizeY = size;
    const sizeX2 = Math.round(size*0.5);

    //var texelX = 1 / 256;
    //var texelY = 1 / 128;

    const lx = this.draw.getTextSize(size, text) + 2;

    //draw black line before text
    let char = 0;
    let charPosX = (char & 15) << 4;
    let charPosY = (char >> 4) << 4;
    let x1,x2,y1,y2,u1,u2,v1,v2;

    x1 = x-2, y1 = y-2, u1 = (charPosX * texelX), v1 = (charPosY * texelY);
    x2 = x-2 + lx, u2 = ((charPosX+15) * texelX);
    y2 = y + sizeY+1, v2 = ((charPosY+15) * texelY);

    //black box
    for (let i = index, li = i+18; i < li; i+=3) {
        colors[i] = 0;
        colors[i+1] = 0;
        colors[i+2] = 0;
    }

    //same color for all letters
    for (let i = index + 18, li = i + text.length * 18; i < li; i+=3) {
        colors[index] = r;
        colors[index+1] = g;
        colors[index+2] = b;
    }

    for (let i = -1, li = text.length; i < li; i++) {

        if (i != -1) {
            char = text.charCodeAt(i) - 32;
            charPosX = (char & 15) << 4;
            charPosY = (char >> 4) << 4;

            switch(char) {
            case 12:
            case 14:
            case 27: //:
            case 28: //;
            case 64: //'
            case 73: //i
            case 76: //l
            case 84: //t

                x1 = x, y1 = y,  u1 = (charPosX * texelX), y1 = (charPosY * texelY),
                x2 = x + sizeX2, u2 = ((charPosX+8) * texelX),
                y2 = y + sizeY, v2 = ((charPosY+16) * texelY);
                x += sizeX2;
                break;

            default:

                x1 = x, y1 = y,  u1 = (charPosX * texelX), y1 = (charPosY * texelY);
                x2 = x + sizeX, u2 = ((charPosX+15) * texelX);
                y2 = y + sizeY, v2 = ((charPosY+16) * texelY);
                x += sizeX;
                break;
            }
        }

        vertices[index] = x1;
        vertices[index+1] = y1;
        vertices[index+2] = z;
        vertices[index+3] = x2;
        vertices[index+4] = y1;
        vertices[index+5] = z;
        vertices[index+6] = x2;
        vertices[index+7] = y2;
        vertices[index+8] = z;

        vertices[index+9] = x2;
        vertices[index+10] = y2;
        vertices[index+11] = z;
        vertices[index+12] = x1;
        vertices[index+13] = y2;
        vertices[index+14] = z;
        vertices[index+15] = x1;
        vertices[index+16] = y1;
        vertices[index+17] = z;

        index += 18;
    }

    this.textBufferIndex = index;
};


Renderer.prototype.generateMaterial = function(material, options) {

    material.onBeforeCompile = function ( shader ) {

        if (options.uniforms) {

            for (let key in options.uniforms) {
                shader.uniforms[key] = options.uniforms[key];
            }

        }

        material.userData.shader = shader;

        if (options.vertUniforms) {
            shader.vertexShader = options.vertUniforms + shader.vertexShader;
        }

        if (options.vertUvCode) {
            shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>',
                                                              '#include <uv_vertex>\n\t' + options.vertUvCode);
        }

    };

    material.customProgramCacheKey = function () {
        return matCounter++;
    };

    if (options.onRender) {
        material.userData.onRender = options.onRender;
    }

    return material;
};

Renderer.prototype.generateTileMaterial = function(options) {

    const defines = (options.defines || {});

    const uniforms = {

        uvTrans : { value: new THREE.Vector4(1,1,0,0) },
        map : { value: null }

    };

    //str += '#define TMIN ' + (0.5-this.map.config.mapSplitMargin) + '\n' + '#define TMAX ' + (0.5+this.map.config.mapSplitMargin) + '\n';

    if (options.flags) {
        if (options.flags & VTS_MAT_FLAG_C4){
            defines.clip4 = true;
            defines.TMIN = (0.5-this.config.mapSplitMargin);
            defines.TMAX = (0.5+this.config.mapSplitMargin);
            uniforms.uClip = { value: [1,1,1,1] };
         }
        if (options.flags & VTS_MAT_FLAG_C8) defines.clip8 = true;
        if (options.flags & VTS_MAT_FLAG_FLAT) defines.flatShade = true;
    }

    const material = new THREE.ShaderMaterial( {

        defines : defines,
        uniforms: uniforms,
        vertexShader: GpuShaders.tileVertexShader,
        fragmentShader: GpuShaders.tileFragmentShader

    } );

    if (options.onRender) {
        material.userData.onRender = options.onRender;
    }

    return material;

}


Renderer.prototype.generateBBoxMaterial = function() {

    const points = new Array(32);

    for (let i = 0; i < 32; i++) {
        points[i] = 0;
    }

    const uniforms = {
        uPoints : { value: points }
    };

    const material = new THREE.ShaderMaterial( {
        uniforms: uniforms,
        vertexShader: GpuShaders.bbox2VertexShader,
        fragmentShader: GpuShaders.bboxFragmentShader

    } );

    material.userData.onRender = (function(v){

        this.material.uniforms.uPoints.value = v;
        this.material.uniforms.uPoints.needsUpdate = true;
        this.material.uniformsNeedUpdate = true;

    });

    return material;

}

Renderer.prototype.startRender = function(options) {

    this.scene.updateMatrixWorld();
    this.models.clear();

    this.camera2.position.fromArray(this.camera.position);
    this.camera2.setRotationFromMatrix( new THREE.Matrix4().fromArray(this.camera.rotationview).invert());
    this.camera2.near = this.camera.near;
    this.camera2.far = this.camera.far;
    this.camera2.updateProjectionMatrix();
}

Renderer.prototype.addSceneObject = function(object) {

    this.models.add(object);

}

Renderer.prototype.finishRender = function(options) {

    this.gpu2.render( this.scene, this.camera2 );

}


Renderer.prototype.createTexture = function(options) {

    this.renderer.camera2.setPosition();

}

Renderer.prototype.createTexture = function(options) {

    const texture = new THREE.Texture(options.image);
    texture.width = options.width;
    texture.height = options.height;
    texture.gpuSize = texture.width * texture.height * 4;
    texture.needsUpdate = true;

    return texture;
};

Renderer.prototype.createBBox = function(bbox) {

    const box = new THREE.Box3();
    //box.setFromCenterAndSize( new THREE.Vector3(0,0,0),
    //                          new THREE.Vector3(1,1,1) );
    //new THREE.Vector3( (bbox.max[0] - bbox.min[0]), (bbox.max[1] - bbox.min[1]), (bbox.max[2] - bbox.min[2])) );

    const helper = new THREE.Box3Helper( box, 0x0000ff );
    helper.frustumCulled = false;

    return helper;
};


Renderer.prototype.createBBox2 = function(bbox) {

    const geometry = new THREE.BufferGeometry();
    const vertices = new Uint16Array([0,1,1,2,2,3,3,0,
                                      4,5,5,6,6,7,7,4,
                                      0,4,1,5,2,6,3,7]);

    geometry.setAttribute( 'position', new THREE.Uint16BufferAttribute( vertices, 1 ) );

    const lines = new THREE.LineSegments( geometry, this.bboxMaterial);
    lines.frustumCulled = false;

    return lines;
};


Renderer.prototype.createTextBuffer = function(size) {

    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(size*3);
    const colors = new Uint8Array(size*3);

    const att = new THREE.Float32BufferAttribute( vertices, 3, false )
    geometry.setAttribute( 'position', att );

    const att2 = new THREE.Uint8BufferAttribute( colors, 3, true )
    geometry.setAttribute( 'color', att2 );

    const mesh = new THREE.Mesh( geometry, this.textMaterial);
    mesh.frustumCulled = false;

    return mesh;
};


Renderer.prototype.createMesh = function(options) {
/*
    {
        bbox: this.bbox,
        vertices: this.vertices,
        uvs: this.internalUVs,
        uvs2: this.externalUVs,
        indices: this.indices,
        use16bit: this.use16bit
    }
*/
    const geometry = new THREE.BufferGeometry();

    if (options.vertices) {
        if (options.use16bit) {
            geometry.setAttribute( 'position', new THREE.Uint16BufferAttribute( options.vertices, 3, true ) );
        } else {
            geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( options.vertices, 3 )/*.onUpload( disposeArray )*/ );
        }
    }

    const uv = options.uvs || options.uvs2;

    if (uv) {
        if (options.use16bit) {
            geometry.setAttribute( 'uv', new THREE.Uint16BufferAttribute( uv, 2, true ) );
        } else {
            geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uv, 2 )/*.onUpload( disposeArray )*/ );
        }
    }

    if (options.indices) {
        geometry.setIndex(options.indices);
    }

    const mesh = new THREE.Mesh( geometry, this.tileMaterial);

    const bbox = options.bbox;

    if (bbox) {
        mesh.bbox = options.bbox;
        mesh.scale.set( bbox.max[0] - bbox.min[0], bbox.max[1] - bbox.min[1], bbox.max[2] - bbox.min[2] );
    }

    mesh.frustumCulled = false;

    return mesh;
};

Renderer.prototype.initProceduralShaders = function() {
    this.init.initProceduralShaders();
};


Renderer.prototype.onResize = function() {
    if (this.killed){
        return;
    }

    var rect = this.div.getBoundingClientRect();
    this.resizeGL(Math.floor(rect.width), Math.floor(rect.height));

    if (this.onResizeCall) {
        this.onResizeCall();
    }
};


Renderer.prototype.kill = function() {
    if (this.killed){
        return;
    }

    this.killed = true;

    if (this.heightmapMesh) this.heightmapMesh.kill();
    if (this.heightmapTexture) this.heightmapTexture.kill();
    if (this.skydomeMesh) this.skydomeMesh.kill();
    if (this.skydomeTexture) this.skydomeTexture.kill();
    if (this.hitmapTexture) this.hitmapTexture.kill();
    if (this.geoHitmapTexture) this.geoHitmapTexture.kill();
    if (this.redTexture) this.redTexture.kill();
    if (this.whiteTexture) this.whiteTexture.kill();
    if (this.blackTexture) this.blackTexture.kill();
    if (this.lineTexture) this.lineTexture.kill();
    if (this.textTexture2) this.textTexture2.kill();
    if (this.atmoMesh) this.atmoMesh.kill();
    if (this.bboxMesh) this.bboxMesh.kill();
    if (this.font) this.font.kill();
    if (this.plines) this.plines.kill();
    if (this.plineJoints) this.plineJoints.kill();

    this.gpu.kill();
    //this.div.removeChild(this.gpu.getCanvas());
};


Renderer.prototype.resizeGL = function(width, height, skipCanvas, skipPaint) {
    this.camera.setAspect(width / height);
    this.curSize = [width, height];
    this.oldSize = [width, height];
    //this.gpu.resize(this.curSize, skipCanvas);

    //if (skipPaint !== true) { //remove this??
       // this.draw.paintGL();
    //}

    var m = new Float32Array(16);
    m[0] = 2.0/width; m[1] = 0; m[2] = 0; m[3] = 0;
    m[4] = 0; m[5] = -2.0/height; m[6] = 0; m[7] = 0;
    m[8] = 0; m[9] = 0; m[10] = 1; m[11] = 0;
    m[12] = -width*0.5*m[0]; m[13] = -height*0.5*m[5]; m[14] = 0; m[15] = 1;

    this.imageProjectionMatrix = m;

    this.camera2.aspect = width / height;
    this.camera2.updateProjectionMatrix();

    /*
    this.camera2D.left = width / -2;
    this.camera2D.right = width / 2;
    this.camera2D.top = height / -2;
    this.camera2D.bottom = height / 2;
    this.camera2D.updateProjectionMatrix();
    */

   if (!this.gpu2) {
       this.gpu2 = new THREE.WebGLRenderer( { antialias: false } );

       this.gpu2.autoClear = false;
       this.gpu2.autoUpdateScene = false;
       this.gpu2.outputEncoding = THREE.sRGBEncoding;
       this.gpu2.setPixelRatio( window.devicePixelRatio );
       this.gpu2.setSize( width, height );

       //    this.gpu = new GpuDevice(this, div, this.curSize, this.config.rendererAllowScreenshots, this.config.rendererAntialiasing, this.config.rendererAnisotropic);

       this.div.appendChild( this.gpu2.domElement );
   }

   this.gpu2.setSize( width, height );
};


Renderer.prototype.project2 = function(point, mvp, cameraPos, includeDistance) {
    var p = [0, 0, 0, 1];

    if (cameraPos) {
        p = mat4.multiplyVec4(mvp, [point[0] - cameraPos[0], point[1] - cameraPos[1], point[2] - cameraPos[2], 1 ]);
    } else {
        p = mat4.multiplyVec4(mvp, [point[0], point[1], point[2], 1 ]);
    }

    //project point coords to screen
    if (p[3] != 0) {
        var sp = [0,0,0];

        //x and y are in screen pixels
        sp[0] = ((p[0]/p[3])+1.0)*0.5*this.curSize[0];
        sp[1] = (-(p[1]/p[3])+1.0)*0.5*this.curSize[1];

        //depth in meters
        sp[2] = p[2]/p[3];

        if (includeDistance) {
            sp[3] = p[2];
        }

        return sp;
    } else {
        return [0, 0, 0];
    }
};


Renderer.prototype.setSuperElevationState = function(state) {
    if (this.useSuperElevation != state) {
        this.useSuperElevation = state;
        this.seCounter++;
    }
};


Renderer.prototype.getSuperElevationState = function() {
    return this.useSuperElevation;
};


Renderer.prototype.setSuperElevation = function(h1, f1, h2, f2) {
    if (f1 == 1 && f2 == 1) {
        if (this.useSuperElevation != false) {
            this.useSuperElevation = false;
            this.seCounter++;
        }

        if (h1 == h2) { h2 = h1 + 1; }
        this.superElevation = [h1, f1, h2, f2, h2-h1, f2-f1, 1.0 / (h2-h1)];
        return;
    }

    if (h1 == h2) { h2 = h1 + 1; }
    this.superElevation = [h1, f1, h2, f2, h2-h1, f2-f1, 1.0 / (h2-h1)];
    this.seCounter++;
};


Renderer.prototype.getSuperElevation = function() {
    return this.superElevation.slice();
};


Renderer.prototype.getSuperElevatedHeight = function(height) {
    var se = this.superElevation, h = height;

    if (h < se[0]) {  // 0 - h1, 1 - f1, 2 - h2, 3 - f2, 4 - dh, 5 - df, 6 - invdh
        h = se[0];
    }

    if (h > se[2]) {
        h = se[2];
    }

    return height * (se[1] + ((h - se[0]) * se[6]) * se[5]);
};

Renderer.prototype.getUnsuperElevatedHeight = function(height) {
    var se = this.superElevation, s = height;

    if (se[1] == se[3]) {
        return s / se[1];
    }

    if (s <= se[0] * se[1]) {  // 0 - h1, 1 - f1, 2 - h2, 3 - f2, 4 - dh, 5 - df, 6 - invdh
        return s / se[1];
    }

    if (s >= se[2] * se[3]) {
        return s / se[3];
    }


    var h1 = se[0], f1 = se[1], h2 = se[2], f2 = se[3];

    // and f1!=f2 and h1!=h2

    return -(Math.sqrt(-2*f2*(f1*h1*h2 + 2*h1*s - 2*h2*s) + f1*(f1*h2*h2 + 4*h1*s - 4*h2*s) + f2*f2*h1*h1) - f1*h2 + f2*h1)/(2*(f1 - f2));
};


Renderer.prototype.getEllipsoidHeight = function(pos, shift) {
    var p, p2;
    this.seTmpVec3 = [0,0,0];

    if (shift) {
        p = this.seTmpVec;
        p2 = [pos[0] + shift[0], pos[1] + shift[1], (pos[2] + shift[2]) * this.earthERatio];
    } else {
        p = pos;
        p2 = [p[0], p[1], p[2] * this.earthERatio];
    }

    var l = Math.sqrt(p2[0] * p2[0] + p2[1] * p2[1] + p2[2] * p2[2]);

    return l - this.earthRadius;
};


Renderer.prototype.transformPointBySE = function(pos, shift) {
    var p = pos, p2;
    this.seTmpVec3 = [0,0,0];

    if (shift) {
        p2 = [pos[0] + shift[0], pos[1] + shift[1], (pos[2] + shift[2]) * this.earthERatio];
    } else {
        p2 = [p[0], p[1], p[2] * this.earthERatio];
    }

    var l = Math.sqrt(p2[0] * p2[0] + p2[1] * p2[1] + p2[2] * p2[2]);
    var v = this.seTmpVec2;

    var m = (1.0/(l+0.0001));
    v[0] = p2[0] * m;
    v[1] = p2[1] * m;
    v[2] = p2[2] * m;

    var h = l - this.earthRadius;
    var h2 = this.getSuperElevatedHeight(h);
    m = (h2 - h);

    p2[0] = p[0] + v[0] * m;
    p2[1] = p[1] + v[1] * m;
    p2[2] = p[2] + v[2] * m;

    return p2;
};


Renderer.prototype.transformPointBySE2 = function(pos, shift) {
    var p = pos, p2;
    this.seTmpVec3 = [0,0,0];

    if (shift) {
        p2 = [pos[0] + shift[0], pos[1] + shift[1], (pos[2] + shift[2]) * this.earthERatio];
    } else {
        p2 = [p[0], p[1], p[2] * this.earthERatio];
    }

    var l = Math.sqrt(p2[0] * p2[0] + p2[1] * p2[1] + p2[2] * p2[2]);
    var v = this.seTmpVec2;

    var m = (1.0/(l+0.0001));
    v[0] = p2[0] * m;
    v[1] = p2[1] * m;
    v[2] = p2[2] * m;

    var h = l - this.earthRadius;
    var h2 = this.getSuperElevatedHeight(h);
    m = (h2 - h);// * 10;

    pos = pos.slice();

    pos[0] = p[0] + v[0] * m;
    pos[1] = p[1] + v[1] * m;
    pos[2] = p[2] + v[2] * m;

    pos[13] = v[0] * m;
    pos[14] = v[1] * m;
    pos[15] = v[2] * m;

    return pos;
};


Renderer.prototype.project = function(point) {
    //get mode-view-projection matrix
    var mvp = this.camera.getMvpMatrix();

    //get camera position relative to position
    var cameraPos2 = this.camera.getPosition();

    //get global camera position
    var cameraPos = this.cameraPosition();

    //get point coords relative to camera
    var p = [point[0] - cameraPos[0] + cameraPos2[0], point[1] - cameraPos[1] + cameraPos2[1], point[2] - cameraPos[2] + cameraPos2[2], 1 ];

    //project point coords to screen
    var p2 = [0, 0, 0, 1];
    p2 = mat4.multiplyVec4(mvp, p);

    if (p2[3] != 0) {

        var sp = [0,0,0];

        //x and y are in screen pixels
        sp[0] = ((p2[0]/p2[3])+1.0)*0.5*this.curSize[0];
        sp[1] = (-(p2[1]/p2[3])+1.0)*0.5*this.curSize[1];

        //depth in meters
        sp[2] = p2[2]/p2[3];

        return sp;
    } else {
        return [0, 0, 0];
    }
};


Renderer.prototype.getScreenRay = function(screenX, screenY) {
    if (this.camera == null) {
        return [0,0,1.0];
    }

    this.camera.dirty = true; //???? why is projection matrix distored so I have to refresh

    //convert screen coords
    var x = (2.0 * screenX) / this.curSize[0] - 1.0;
    var y = 1.0 - (2.0 * screenY) / this.curSize[1];

    var rayNormalizeDeviceSpace = [x, y, 1.0];

    var rayClipCoords = [rayNormalizeDeviceSpace[0], rayNormalizeDeviceSpace[1], -1.0, 1.0];

    var invProjection = mat4.create();
    invProjection = mat4.inverse(this.camera.getProjectionMatrix());

    //console.log("--" + JSON.stringify(rayClipCoords));
    //console.log("----" + JSON.stringify(invProjection));

    var rayEye = [0,0,0,0];
    mat4.multiplyVec4(invProjection, rayClipCoords, rayEye); //inverse (projectionmatrix) * rayClipCoords;
    rayEye[2] = -1.0;
    rayEye[3] = 0.0;

    var invView = mat4.create();
    invView = mat4.inverse(this.camera.getModelviewMatrix());

    var rayWorld = [0,0,0,0];
    mat4.multiplyVec4(invView, rayEye, rayWorld); //inverse (projectionmatrix) * rayClipCoords;

    // don't forget to normalise the vector at some point
    rayWorld = vec3.normalize([rayWorld[0], rayWorld[1], rayWorld[2]]); //normalise (raywor);

    return rayWorld;
};


Renderer.prototype.hitTestGeoLayers = function(screenX, screenY, secondTexture) {
    var gl = this.gpu.gl;

    //probably not needed
    //if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      //  return [false, 0,0,0,0];
    //}

    var surfaceHit = false, pixel;

    if (screenX >= 0 && screenX < this.curSize[0] &&
        screenY >= 0 && screenY < this.curSize[1]) {

        //convert screen coords to texture coords
        var x = 0, y = 0;

        //get screen coords
        x = Math.floor(screenX * (this.hitmapSize / this.curSize[0]));
        y = Math.floor(screenY * (this.hitmapSize / this.curSize[1]));

        //get pixel value from framebuffer

        if (secondTexture) {
            pixel = this.geoHitmapTexture2.readFramebufferPixels(x, this.hitmapSize - y - 1, 1, 1);
        } else {
            pixel = this.geoHitmapTexture.readFramebufferPixels(x, this.hitmapSize - y - 1, 1, 1);
        }

        surfaceHit = !(pixel[0] == 255 && pixel[1] == 255 && pixel[2] == 255 && pixel[3] == 255);
    }

    if (surfaceHit) {
        return [true, pixel[0], pixel[1], pixel[2], pixel[3]];
    }

    return [false, 0,0,0,0];
};


Renderer.prototype.switchToFramebuffer = function(type, texture) {
    var gl = this.gpu.gl, size, width, height;

    switch(type) {
    case 'base':
        width = this.oldSize[0];
        height = this.oldSize[1];

        gl.clearColor(0.0, 0.0, 0.0, 1.0);

        gl.viewport(0, 0, width, height);
        this.gpu.setFramebuffer(null);

        this.camera.setAspect(width / height);
        this.curSize = [width, height];
        this.gpu.resize(this.curSize, true);
        this.camera.update();
            //this.updateCamera();
        this.onlyDepth = false;
        this.onlyHitLayers = false;
        this.onlyAdvancedHitLayers = false;
        this.advancedPassNeeded = false;
        break;

    case 'depth':
        //set texture framebuffer
        this.gpu.setFramebuffer(this.hitmapTexture);

        this.oldSize = [ this.curSize[0], this.curSize[1] ];

        gl.clearColor(1.0,1.0, 1.0, 1.0);
        gl.enable(gl.DEPTH_TEST);

        size = this.hitmapSize;

        //clear screen
        gl.viewport(0, 0, size, size);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.curSize = [size, size];

        //this.gpu.clear();
        this.camera.update();
        this.onlyDepth = true;
        this.onlyHitLayers = false;
        this.onlyAdvancedHitLayers = false;
        this.advancedPassNeeded = false;
        break;

    case 'geo':
    case 'geo2':

        this.hoverFeatureCounter = 0;
        size = this.hitmapSize;

        //set texture framebuffer
        this.gpu.setFramebuffer(type == 'geo' ? this.geoHitmapTexture : this.geoHitmapTexture2);

        width = size;
        height = size;

        gl.clearColor(1.0,1.0, 1.0, 1.0);
        gl.enable(gl.DEPTH_TEST);

        //clear screen
        gl.viewport(0, 0, size, size);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.curSize = [width, height];

        //render scene
        this.onlyHitLayers = true;
        this.advancedPassNeeded = false;
        this.onlyAdvancedHitLayers = (type == 'geo2');

        //this.gpu.clear();
        this.camera.update();
        break;

    case 'texture':
        //set texture framebuffer
        this.gpu.setFramebuffer(texture);

        this.oldSize = [ this.curSize[0], this.curSize[1] ];

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.enable(gl.DEPTH_TEST);

        //clear screen
        gl.viewport(0, 0, this.gpu.canvas.width, this.gpu.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.curSize = [this.gpu.canvas.width, this.gpu.canvas.height];

        //this.gpu.clear();
        this.camera.update();
        this.onlyDepth = false;
        this.onlyHitLayers = false;
        this.onlyAdvancedHitLayers = false;
        this.advancedPassNeeded = false;
        break;
    }
};


Renderer.prototype.hitTest = function(screenX, screenY) {
    var gl = this.gpu.gl;

    //get screen ray
    var screenRay = this.getScreenRay(screenX, screenY);
    var cameraPos = this.camera.getPosition();

    //probably not needed
    //if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      //  return [0, 0, 0, null, screenRay, Number.MAX_VALUE, cameraPos];
    //}

    //convert screen coords to texture coords
    var x = 0, y = 0;

    //get screen coords
    x = Math.floor(screenX * (this.hitmapSize / this.curSize[0]));
    y = Math.floor(screenY * (this.hitmapSize / this.curSize[1]));

    //get pixel value from framebuffer
    var pixel = this.hitmapTexture.readFramebufferPixels(x, this.hitmapSize - y - 1, 1, 1);

    //convert rgb values into depth
    var depth = (pixel[0] * (1.0/255)) + (pixel[1]) + (pixel[2]*255.0) + (pixel[3]*65025.0);// + (pixel[3]*16581375.0);

    var surfaceHit = !(pixel[0] == 255 && pixel[1] == 255 && pixel[2] == 255 && pixel[3] == 255);

    //compute hit postion
    this.lastHitPosition = [cameraPos[0] + screenRay[0]*depth, cameraPos[1] + screenRay[1]*depth, cameraPos[2] + screenRay[2]*depth];

    return [this.lastHitPosition[0], this.lastHitPosition[1], this.lastHitPosition[2], surfaceHit, screenRay, depth, cameraPos];
};


Renderer.prototype.copyHitmap = function() {
    this.hitmapTexture.readFramebufferPixels(0,0,this.hitmapSize,this.hitmapSize, false, this.hitmapData);
};


Renderer.prototype.getDepth = function(screenX, screenY) {
    var x = Math.floor(screenX * (this.hitmapSize / this.curSize[0]));
    var y = Math.floor(screenY * (this.hitmapSize / this.curSize[1]));

    if (this.hitmapMode <= 2) {
        //get pixel value from framebuffer
        var pixel = this.hitmapTexture.readFramebufferPixels(x, this.hitmapSize - y - 1, 1, 1, (this.hitmapMode == 2));

        //convert rgb values into depth
        var depth = (pixel[0] * (1.0/255)) + (pixel[1]) + (pixel[2]*255.0) + (pixel[3]*65025.0);// + (pixel[3]*16581375.0);
        var surfaceHit = !(pixel[0] == 255 && pixel[1] == 255 && pixel[2] == 255 && pixel[3] == 255);

    } else {
        var pixels = this.hitmapData;
        var index = (x + (this.hitmapSize - y - 1) * this.hitmapSize) * 4;
        var r = pixels[index], g = pixels[index+1], b = pixels[index+2], a = pixels[index+3];

        var depth = (r * (1.0/255)) + (g) + (b*255.0) + (a*65025.0);// + (pixel[3]*16581375.0);
        var surfaceHit = !(r == 255 && g == 255 && b == 255 && a == 255);
    }

    return [surfaceHit, depth];
};


Renderer.prototype.getZoffsetFactor = function(params) {
    return (params[0] + params[1]*this.distanceFactor + params[2]*this.tiltFactor)*0.0001;
};


Renderer.prototype.saveScreenshot = function(output, filename, filetype) {
    var gl = this.gpu.gl;

    //get current screen size
    var width = this.curSize[0];
    var height = this.curSize[1];

    //read rgba data from frame buffer
    //works only when webgl context is initialized with preserveDrawingBuffer: true
    var data2 = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data2);

    //flip image vertically
    var data = new Uint8Array(width * height * 4);
    var index = 0;

    for (var y = 0; y < height; y++) {

        var index2 = ((height-1) - y) * width * 4;

        for (var x = 0; x < width; x++) {
            data[index] = data2[index2];
            data[index+1] = data2[index2+1];
            data[index+2] = data2[index2+2];
            data[index+3] = data2[index2+3];
            index+=4;
            index2+=4;
        }
    }

    // Create a 2D canvas to store the result
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext('2d');

    // Copy the pixels to a 2D canvas
    var imageData = context.createImageData(width, height);
    imageData.data.set(data);
    context.putImageData(imageData, 0, 0);

    filetype = filetype || 'jpg';

    if (output == 'file') {
        var a = document.createElement('a');

        var dataURI= canvas.toDataURL('image/' + filetype);

        var byteString = atob(dataURI.split(',')[1]);

        // write the bytes of the string to an ArrayBuffer
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }

        var file = new Blob([ab], {type: filetype});

        var url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    } if (output == 'tab') {
        //open image in new window
        window.open(canvas.toDataURL('image/' + filetype));
    }

    return imageData;
};


Renderer.prototype.getBitmap = function(url, filter, tiled, hash, useHash) {
    var id = (useHash ? hash : url) + '*' + filter + '*' + tiled;

    var texture = this.bitmaps[id];
    if (!texture && url) {
        texture = new GpuTexture(this.gpu, url, this.core, null, null, tiled, filter);
        this.bitmaps[id] = texture;
    }

    return texture;
};


Renderer.prototype.getFont = function(url) {
    var font = this.fonts[url];
    if (!font) {
        font = new GpuFont(this.gpu, this.core, null, null, url);
        this.fonts[url] = font;
    }

    return font;
};


export default Renderer;
