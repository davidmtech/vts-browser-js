
import {vec3 as vec3_, mat4 as mat4_} from '../utils/matrix';
//import GpuTexture_ from './gpu/texture';

import ThreeDevice_ from './devices/three/device';
import WebGLDevice_ from './devices/webgl/device';

import RendererFont_ from './font';
import Camera_ from './camera';
import RenderRMap_ from './rmap2';


//get rid of compiler mess
const vec3 = vec3_, mat4 = mat4_;
const RendererFont = RendererFont_;
const Camera = Camera_;
const RenderRMap = RenderRMap_;
const ThreeDevice = ThreeDevice_;
const WebGLDevice = WebGLDevice_;


const Renderer = function(core, div, onUpdate, onResize, config) {
    this.config = config || {};
    this.device = config.rendererDevice === 'three' ? VTS_DEVICE_THREE : VTS_DEVICE_WEBGL;
    //this.device = VTS_DEVICE_THREE;
    this.core = core;
    this.map = core.map;
    this.marginFlags = 0;
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

    const rect = this.div.getBoundingClientRect();

    this.winSize = [rect.width, rect.height]; //QSize
    this.curSize = [rect.width, rect.height]; //QSize
    this.oldSize = [rect.width, rect.height]; //QSize
    this.dirty = true;
    this.cameraVector = [0,1,0];
    this.viewExtent = 1;
    //this.texelSizeLimit = this.core.mapConfig.texelSize * texelSizeFactor;

    if (this.device === VTS_DEVICE_THREE) {
        this.gpu = new ThreeDevice(this, div, this.curSize, this.config.rendererAllowScreenshots, this.config.rendererAntialiasing, this.config.rendererAnisotropic);
    } else {
        this.gpu = new WebGLDevice(this, div, this.curSize, this.config.rendererAllowScreenshots, this.config.rendererAntialiasing, this.config.rendererAnisotropic);
    }

    this.draw = this.gpu.draw;

    this.camera = new Camera(this, 45, 2, 1200000.0);

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


    for (let i = 0, li = this.jobZBuffer.length; i < li; i++) {
        this.jobZBuffer[i] = [];
        this.jobZBufferSize[i] = 0;
        this.jobZBuffer2[i] = {};
        this.jobZBuffer2Size[i] = 0;
    }

    for (let i = 0, li = this.gmap3.length; i < li; i++) {
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

    //intit resources
    // eslint-disable-next-line
    this.rmap = new RenderRMap(this, 50);

    this.gpu.init();

    const factor = 1;
    this.resizeGL(Math.floor(this.curSize[0]*factor), Math.floor(this.curSize[1]*factor));
};


Renderer.prototype.initProceduralShaders = function() {
    this.init.initProceduralShaders();
};


Renderer.prototype.onResize = function() {
    if (this.killed){
        return;
    }

    const rect = this.div.getBoundingClientRect();
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

    this.gpu.kill();
};


// eslint-disable-next-line
Renderer.prototype.resizeGL = function(width, height, skipCanvas, skipPaint) {
    this.camera.setAspect(width / height);
    this.curSize = [width, height];
    this.oldSize = [width, height];
    //this.gpu.resize(this.curSize, skipCanvas);

    //if (skipPaint !== true) { //remove this??
       // this.draw.paintGL();
    //}

    const m = new Float32Array(16);
    m[0] = 2.0/width; m[1] = 0; m[2] = 0; m[3] = 0;
    m[4] = 0; m[5] = -2.0/height; m[6] = 0; m[7] = 0;
    m[8] = 0; m[9] = 0; m[10] = 1; m[11] = 0;
    m[12] = -width*0.5*m[0]; m[13] = -height*0.5*m[5]; m[14] = 0; m[15] = 1;

    this.imageProjectionMatrix = m;

    this.gpu.setSize( width, height );
};


Renderer.prototype.project2 = function(point, mvp, cameraPos, includeDistance) {
    let p = [0, 0, 0, 1];

    if (cameraPos) {
        p = mat4.multiplyVec4(mvp, [point[0] - cameraPos[0], point[1] - cameraPos[1], point[2] - cameraPos[2], 1 ]);
    } else {
        p = mat4.multiplyVec4(mvp, [point[0], point[1], point[2], 1 ]);
    }

    //project point coords to screen
    if (p[3] != 0) {
        const sp = [0,0,0];

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
    const se = this.superElevation;
    let h = height;

    if (h < se[0]) {  // 0 - h1, 1 - f1, 2 - h2, 3 - f2, 4 - dh, 5 - df, 6 - invdh
        h = se[0];
    }

    if (h > se[2]) {
        h = se[2];
    }

    return height * (se[1] + ((h - se[0]) * se[6]) * se[5]);
};

Renderer.prototype.getUnsuperElevatedHeight = function(height) {
    const se = this.superElevation, s = height;

    if (se[1] == se[3]) {
        return s / se[1];
    }

    if (s <= se[0] * se[1]) {  // 0 - h1, 1 - f1, 2 - h2, 3 - f2, 4 - dh, 5 - df, 6 - invdh
        return s / se[1];
    }

    if (s >= se[2] * se[3]) {
        return s / se[3];
    }

    const h1 = se[0], f1 = se[1], h2 = se[2], f2 = se[3];

    // and f1!=f2 and h1!=h2

    return -(Math.sqrt(-2*f2*(f1*h1*h2 + 2*h1*s - 2*h2*s) + f1*(f1*h2*h2 + 4*h1*s - 4*h2*s) + f2*f2*h1*h1) - f1*h2 + f2*h1)/(2*(f1 - f2));
};


Renderer.prototype.getEllipsoidHeight = function(pos, shift) {
    let p, p2;
    this.seTmpVec3 = [0,0,0];

    if (shift) {
        p = this.seTmpVec;
        p2 = [pos[0] + shift[0], pos[1] + shift[1], (pos[2] + shift[2]) * this.earthERatio];
    } else {
        p = pos;
        p2 = [p[0], p[1], p[2] * this.earthERatio];
    }

    const l = Math.sqrt(p2[0] * p2[0] + p2[1] * p2[1] + p2[2] * p2[2]);

    return l - this.earthRadius;
};


Renderer.prototype.transformPointBySE = function(pos, shift) {
    let p = pos, p2;
    this.seTmpVec3 = [0,0,0];

    if (shift) {
        p2 = [pos[0] + shift[0], pos[1] + shift[1], (pos[2] + shift[2]) * this.earthERatio];
    } else {
        p2 = [p[0], p[1], p[2] * this.earthERatio];
    }

    const l = Math.sqrt(p2[0] * p2[0] + p2[1] * p2[1] + p2[2] * p2[2]);
    const v = this.seTmpVec2;

    let m = (1.0/(l+0.0001));
    v[0] = p2[0] * m;
    v[1] = p2[1] * m;
    v[2] = p2[2] * m;

    const h = l - this.earthRadius;
    const h2 = this.getSuperElevatedHeight(h);
    m = (h2 - h);

    p2[0] = p[0] + v[0] * m;
    p2[1] = p[1] + v[1] * m;
    p2[2] = p[2] + v[2] * m;

    return p2;
};


Renderer.prototype.transformPointBySE2 = function(pos, shift) {
    let p = pos, p2;
    this.seTmpVec3 = [0,0,0];

    if (shift) {
        p2 = [pos[0] + shift[0], pos[1] + shift[1], (pos[2] + shift[2]) * this.earthERatio];
    } else {
        p2 = [p[0], p[1], p[2] * this.earthERatio];
    }

    const l = Math.sqrt(p2[0] * p2[0] + p2[1] * p2[1] + p2[2] * p2[2]);
    const v = this.seTmpVec2;

    let m = (1.0/(l+0.0001));
    v[0] = p2[0] * m;
    v[1] = p2[1] * m;
    v[2] = p2[2] * m;

    const h = l - this.earthRadius;
    const h2 = this.getSuperElevatedHeight(h);
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
    const mvp = this.camera.getMvpMatrix();

    //get camera position relative to position
    const cameraPos2 = this.camera.getPosition();

    //get global camera position
    const cameraPos = this.cameraPosition();

    //get point coords relative to camera
    const p = [point[0] - cameraPos[0] + cameraPos2[0], point[1] - cameraPos[1] + cameraPos2[1], point[2] - cameraPos[2] + cameraPos2[2], 1 ];

    //project point coords to screen
    let p2 = [0, 0, 0, 1];
    p2 = mat4.multiplyVec4(mvp, p);

    if (p2[3] != 0) {

        const sp = [0,0,0];

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
    const x = (2.0 * screenX) / this.curSize[0] - 1.0;
    const y = 1.0 - (2.0 * screenY) / this.curSize[1];

    const rayNormalizeDeviceSpace = [x, y, 1.0];

    const rayClipCoords = [rayNormalizeDeviceSpace[0], rayNormalizeDeviceSpace[1], -1.0, 1.0];

    let invProjection = mat4.create();
    invProjection = mat4.inverse(this.camera.getProjectionMatrix());

    //console.log("--" + JSON.stringify(rayClipCoords));
    //console.log("----" + JSON.stringify(invProjection));

    const rayEye = [0,0,0,0];
    mat4.multiplyVec4(invProjection, rayClipCoords, rayEye); //inverse (projectionmatrix) * rayClipCoords;
    rayEye[2] = -1.0;
    rayEye[3] = 0.0;

    let invView = mat4.create();
    invView = mat4.inverse(this.camera.getModelviewMatrix());

    let rayWorld = [0,0,0,0];
    mat4.multiplyVec4(invView, rayEye, rayWorld); //inverse (projectionmatrix) * rayClipCoords;

    // don't forget to normalise the vector at some point
    rayWorld = vec3.normalize([rayWorld[0], rayWorld[1], rayWorld[2]]); //normalise (raywor);

    return rayWorld;
};


Renderer.prototype.hitTestGeoLayers = function(screenX, screenY, secondTexture) {
    //const gl = this.gpu.gl;

    //probably not needed
    //if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      //  return [false, 0,0,0,0];
    //}

    let surfaceHit = false, pixel;

    if (screenX >= 0 && screenX < this.curSize[0] &&
        screenY >= 0 && screenY < this.curSize[1]) {

        //convert screen coords to texture coords
        const x = Math.floor(screenX * (this.hitmapSize / this.curSize[0]));
        const y = Math.floor(screenY * (this.hitmapSize / this.curSize[1]));

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

    if (this.device === VTS_DEVICE_THREE) {
        return;
    }

    const gl = this.gpu.gl;
    let size, width, height;

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
    //const gl = this.gpu.gl;

    //get screen ray
    const screenRay = this.getScreenRay(screenX, screenY);
    const cameraPos = this.camera.getPosition();

    //probably not needed
    //if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      //  return [0, 0, 0, null, screenRay, Number.MAX_VALUE, cameraPos];
    //}

    //convert screen coords to texture coords

    //get screen coords
    const x = Math.floor(screenX * (this.hitmapSize / this.curSize[0]));
    const y = Math.floor(screenY * (this.hitmapSize / this.curSize[1]));

    let pixel;

    //get pixel value from framebuffer
    if (this.device === VTS_DEVICE_THREE) {
        pixel = new Uint8Array( 4 );
        this.gpu.gpu2.readRenderTargetPixels( this.gpu.textureRenderTarget, x, this.hitmapSize - y - 1, 1, 1, pixel );
    } else {
        pixel = this.hitmapTexture.readFramebufferPixels(x, this.hitmapSize - y - 1, 1, 1);
    }

    //convert rgb values into depth
    const depth = (pixel[0] * (1.0/255)) + (pixel[1]) + (pixel[2]*255.0) + (pixel[3]*65025.0);// + (pixel[3]*16581375.0);

    //console.log('' + pixel[0] + ' ' + pixel[1] + ' ' + pixel[2]);

    const surfaceHit = !(pixel[0] == 255 && pixel[1] == 255 && pixel[2] == 255 && pixel[3] == 255);

    //compute hit postion
    this.lastHitPosition = [cameraPos[0] + screenRay[0]*depth, cameraPos[1] + screenRay[1]*depth, cameraPos[2] + screenRay[2]*depth];

    return [this.lastHitPosition[0], this.lastHitPosition[1], this.lastHitPosition[2], surfaceHit, screenRay, depth, cameraPos];
};


Renderer.prototype.copyHitmap = function() {
    if (this.device === VTS_DEVICE_THREE) {
        this.gpu.gpu2.readRenderTargetPixels( this.gpu.textureRenderTarget, 0,0,this.hitmapSize,this.hitmapSize, false, this.hitmapData);
    } else {
        this.hitmapTexture.readFramebufferPixels(0,0,this.hitmapSize,this.hitmapSize, false, this.hitmapData);
    }
};


Renderer.prototype.getDepth = function(screenX, screenY) {
    const x = Math.floor(screenX * (this.hitmapSize / this.curSize[0]));
    const y = Math.floor(screenY * (this.hitmapSize / this.curSize[1]));
    let depth, surfaceHit, pixel;

    if (this.hitmapMode <= 2) {
        //get pixel value from framebuffer

        if (this.device === VTS_DEVICE_THREE) {
            pixel = new Uint8Array( 4 );
            this.gpu.readRenderTargetPixels( this.textureRenderTarget, x, this.hitmapSize - y - 1, 1, 1, pixel );
        } else {
            pixel = this.hitmapTexture.readFramebufferPixels(x, this.hitmapSize - y - 1, 1, 1, (this.hitmapMode == 2));
        }

        //convert rgb values into depth
        depth = (pixel[0] * (1.0/255)) + (pixel[1]) + (pixel[2]*255.0) + (pixel[3]*65025.0);// + (pixel[3]*16581375.0);
        surfaceHit = !(pixel[0] == 255 && pixel[1] == 255 && pixel[2] == 255 && pixel[3] == 255);

    } else {
        const pixels = this.hitmapData;
        const index = (x + (this.hitmapSize - y - 1) * this.hitmapSize) * 4;
        const r = pixels[index], g = pixels[index+1], b = pixels[index+2], a = pixels[index+3];

        depth = (r * (1.0/255)) + (g) + (b*255.0) + (a*65025.0);// + (pixel[3]*16581375.0);
        surfaceHit = !(r == 255 && g == 255 && b == 255 && a == 255);
    }

    return [surfaceHit, depth];
};


Renderer.prototype.getZoffsetFactor = function(params) {
    return (params[0] + params[1]*this.distanceFactor + params[2]*this.tiltFactor)*0.0001;
};


Renderer.prototype.saveScreenshot = function(output, filename, filetype) {
    const gl = this.gpu.gl;

    //get current screen size
    const width = this.curSize[0];
    const height = this.curSize[1];

    //read rgba data from frame buffer
    //works only when webgl context is initialized with preserveDrawingBuffer: true
    const data2 = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data2);

    //flip image vertically
    const data = new Uint8Array(width * height * 4);
    let index = 0;

    for (let y = 0; y < height; y++) {

        let index2 = ((height-1) - y) * width * 4;

        for (let x = 0; x < width; x++) {
            data[index] = data2[index2];
            data[index+1] = data2[index2+1];
            data[index+2] = data2[index2+2];
            data[index+3] = data2[index2+3];
            index+=4;
            index2+=4;
        }
    }

    // Create a 2D canvas to store the result
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    // Copy the pixels to a 2D canvas
    const imageData = context.createImageData(width, height);
    imageData.data.set(data);
    context.putImageData(imageData, 0, 0);

    filetype = filetype || 'jpg';

    if (output == 'file') {
        const a = document.createElement('a');
        const dataURI= canvas.toDataURL('image/' + filetype);
        const byteString = atob(dataURI.split(',')[1]);

        // write the bytes of the string to an ArrayBuffer
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }

        const file = new Blob([ab], {type: filetype});

        const url = URL.createObjectURL(file);
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
    const id = (useHash ? hash : url) + '*' + filter + '*' + tiled;

    let texture = this.bitmaps[id];
    if (!texture && url) {
        //texture = new GpuTexture(this.gpu, url, this.core, null, null, tiled, filter);
        texture = this.gpu.createTexture({ path: url, tiled: tiled, filter: filter});
        this.bitmaps[id] = texture;
    }

    return texture;
};


Renderer.prototype.getFont = function(url) {
    let font = this.fonts[url];
    if (!font) {
        font = new RendererFont(this, this.core, null, null, url);
        this.fonts[url] = font;
    }

    return font;
};


export default Renderer;
