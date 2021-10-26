
//import {mat4 as mat4_} from '../../../utils/matrix';
//import ThreeDraw_ from './draw';
import ThreeShaders_ from './shaders';
import ThreeGroup_ from './group';

import * as THREE_ from './libs/three.module.js';
//import * as THREE from './libs/three.module.js';

//get rid of compiler mess
//const mat4 = mat4_;
const ThreeShaders = ThreeShaders_;
//const ThreeInit = ThreeInit_;
//const ThreeDraw = ThreeDraw_;
const ThreeGroup = ThreeGroup_;
const THREE = THREE_;

var matCounter = 1;

const ThreeDevice = function(renderer, div, size, keepFrameBuffer, antialias, aniso) {
    this.renderer = renderer;
    this.div = div;
    this.config = renderer.config;
    this.canvas =  null;
    this.curSize = size;

    this.keepFrameBuffer = (keepFrameBuffer == null) ? false : keepFrameBuffer;
    this.antialias = antialias ? true : false;
    this.anisoLevel = aniso;

    //compatibility stuff
    this.createState = (function(){});
    this.clear = (function(){});
    this.setState = (function(){});
    this.setViewport = (function(){});

    this.draw = {

        getTextSize : (function(size, text){
            return this.getTextSize(size, text);
        }).bind(this),

        drawText : (function(x, y, size, text, color, depth){
            this.addText(x,y,depth, color[0]*255, color[1]*255, color[2]*255, size, text);
        }).bind(this),

        drawBall : (function(){}),

        drawGpuJobs : (function(){}),

        clearJobHBuffer : (function(){}),
        clearJobBuffer : (function(){}),
    }


};


ThreeDevice.prototype.init = function() {

    this.box = new THREE.Box3();
    this.box.setFromCenterAndSize( new THREE.Vector3( 0,0,0 ), new THREE.Vector3( 1,1,1) );

    this.helper = new THREE.Box3Helper( this.box, 0x0000ff );

    this.scene = new THREE.Scene();
    //this.scene.background = new THREE.Color( 0xaaaaaa );
    this.scene.background = new THREE.Color( 0xaa0000 );

    this.scene2 = new THREE.Scene();
    this.scene2D = new THREE.Scene();

    this.camera2 = new THREE.PerspectiveCamera( 45, this.aspectRatio, 0.1, 10000);
    this.camera2.position.set(  0, 200, 0 );
    this.camera2.lookAt( new THREE.Vector3() );

    let widthOrtho = 1024, heightOrtho = 768;
    //this.orthoCamera = new THREE.OrthographicCamera( widthOrtho / - 2, widthOrtho / 2, heightOrtho / 2, heightOrtho / - 2, 0.001, 1000 );
    this.orthoCamera = new THREE.OrthographicCamera( widthOrtho / - 2, widthOrtho / 2, heightOrtho / 2, heightOrtho / - 2, 0, 1000 );

    this.models = new THREE.Group();
    this.models.frustumCulled = false;
    this.scene.add(this.models);

    this.models2 = new THREE.Group();
    this.models2.frustumCulled = false;
    this.scene.add(this.models2);

    this.scene.add(this.helper);

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

         onRender: (function(texture, t, flags, splitMask, params, paramsC8){

             //if (this.material.userData.shader) {
                 //this.material.userData.shader.uniforms.uvTrans.value.set(t[0],t[1],t[2],t[3]);
                 //this.material.userData.shader.uniforms.map.value = texture;
                 //this.material.userData.shader.uniforms.map.needsUpdate = true;

                 if (texture) {
                     this.material.uniforms.uvTrans.value.set(t[0],t[1],t[2],t[3]);
                     this.material.uniforms.map.value = texture;
                     this.material.uniforms.map.needsUpdate = true;
                 }

                 if (flags & VTS_MAT_FLAG_C4){
                     this.material.uniforms.uClip.value = splitMask.slice();
                     this.material.uniforms.uClip.needsUpdate = true;
                 }

                 if (flags & VTS_MAT_FLAG_C8){
                     this.material.uniforms.uClip.value = splitMask.slice();
                     this.material.uniforms.uClip.needsUpdate = true;

                     this.material.uniforms.uParams.value.fromArray(params);
                     this.material.uniforms.uParams.needsUpdate = true;

                     this.material.uniforms.uParamsC8.value.fromArray(paramsC8);
                     this.material.uniforms.uParamsC8.needsUpdate = true;
                 }

                 this.material.uniformsNeedUpdate = true;
             //}

         })

     });

     this.tileMaterials = new Array(128);
     this.tileMaterials[0] = this.tileMaterial;

     this.bboxMaterial = this.generateBBoxMaterial();
     this.bboxMesh2 = this.createBBox2();

     this.textTexture = (new THREE.TextureLoader()).load('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAACACAMAAADTa0c4AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAAZQTFRFAAAA////pdmf3QAABIFJREFUeNrsnNuyqzAIhsP7v/Se6Yxra0L4OUVNCzetVqP5DAQItrVOiLg95739NnfOaR99RDj6esBw+CKZXiMK4PiuBkAcANoHAP3J5fzzAV2jePQIt6f4Ndb/MIChlVcCEFpAACZPfN4KUAF0/ufboDW3AuBMFgBwHTCfg2ftYgDUKBuA1ABuHKvA2P+5XdONIEt7BO2o2MdlAJoTQOsV6GEAswt0Zq/bsBhdeQQkqEDMwmIAnJHzA8i3ASkWRFKBbADyLGB3mlYD6DyhA4DfBlgsBDtirUPcBgC5woStYMgVtgKATWcB6DskKUEkGFLYrGw3+l3ydR16wKbbPDlWp4Xfo9vZwR1jtOMA6GkABrdvNmt1Vluy6pyvxu4Xt62fquyTggCTsIkCoIuv8gAA08w+ATBXAdSRY56xPDFPx/VPWFZp5v65kFMPgFjP70YASMfRsDn01xLPcwkRq1HLMoK647hR8v+nId74MQBjvIbUQePra42ZVXVcBCR3mIY89mYAlNGLflqA0V1seosCQNMg80B0bsLGAIDNwvFyiqu66ngVGGMGVBwyWwIwpty2DqEr/qf0Bq+DbjYkkcr4VUoOxiRjrYn3YY5SC4BQB/cF0Lq4kD1RCJ+tN4g6Jps5zfWu+QmSz9sUABkA0BIAXocmBwCJ99MDIASATkmtLQAIft4IgE/ZDStZ59yQbOQQAGZWYMbZ3FFCAGRHnwHQznegGAE+zwxNi8kALCOgS9tzAC4jYG1Qo0myRm0Ae/z8eleqewBoZLwfUswCsbT1KgBZD6QAzAEoXUe3K+xxVf2uLf5U3nBeMPRyACW/LtrwVX989id3PRQOG5Io6vh9XwC6stHIdGdJozun03lxNlwvH4u6UgDM8/LmJyx7ak12feEebaXmUwCOYJWk1JcYKsl74HL74wAaH93NqkE1FSKXc4cv0AjaPEEPgE4ru/ieWdvzVq/4psG3AYDFHlEAioQCuEgMgPjK1VDrqlkbTABAiQBGK38B0BlBSf9xtiAJQDM4NtDqMlaeyduTtkDjHgAtEQBj5ZGK2QE0aCcMAIxLSw0WVYlGDgOQXWE+afouAM0S398O4Nej3wIQf4cIHSfz9pbWugyep4MFIAFARvspbm8BcE2DOdvWnCJQAWFhJ/hKzh4AaB2A7NxedKmLPc+6PN4cL2S8GYC1QMIEQJvmFsJfxdvkEQAoLV4AogBS8/kNvdXlWe5GKhABvQUAZASDALJffY1XfsrToFXFbvYD1gBo6wC8LR7/uvj9CwHcfWuoUJItsVl5nwWAnhxxqsXatUq0OYCcaS/fkbK61u5H8jwAuUIEZXHNL1Jmub5oSKZWiDR9FttM4HEAigqRpn8TeB2AuWNiByAXSHCGbB7/3qYCfgCgPgADEEskbjCCaJDB/+kR6wP4P1Obl8jsBwDUB4yAxqKkthaATjX0KmCtDyCxm+yIMLjCbwBgrg94FYC3h8vLPPmfAVBSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlLy9fJPgAEAvWMULbGsSjwAAAAASUVORK5CYII=');
     this.textTexture.magFilter = THREE.NearestFilter;
     this.textTexture.minFilter = THREE.NearestFilter;
     this.textTexture.flipY = false;


     this.textMaterial = new THREE.ShaderMaterial( {
         uniforms: {
            map : { value: this.textTexture },
            uProj : { value : new THREE.Matrix4() }
         },
         vertexShader: ThreeShaders.textVertexShader,
         fragmentShader: ThreeShaders.textFragmentShader
     } );

     this.textMaterial.side = THREE.DoubleSide;

     this.textBuffers = [];
     this.textBufferIndex = 0;
     this.textBufferSize = 3*2*256;

     this.wireferameMaterial = new THREE.MeshBasicMaterial({color:0x000000,wireframe:true, /*depthTest:false*/ });

     this.testScreenPlane = new THREE.Mesh( new THREE.PlaneGeometry( this.renderer.hitmapSize*0.25, this.renderer.hitmapSize*0.25 ), new THREE.MeshBasicMaterial( { /*color: 0xffffff,*/ depthTest: false, depthWrite: false, side: THREE.DoubleSide } ));
     this.testScreenPlane.material.map = this.textTexture;
     //this.testScreenPlane.needsUpdate = true;

     this.textureRenderTarget = this.createRenderTarget( this.renderer.hitmapSize, this.renderer.hitmapSize, false);

     //this.testScreenPlane.material.uniforms.map.value = this.textureRenderTarget.texture;
     this.testScreenPlane.material.map = this.textureRenderTarget.texture;

};


ThreeDevice.prototype.kill = function() {

};


ThreeDevice.prototype.contextLost = function() {
};


ThreeDevice.prototype.contextRestored = function() {
};


ThreeDevice.prototype.setSize = function(width, height) {

    this.textMaterial.uniforms.uProj.value = (new THREE.Matrix4()).fromArray(this.renderer.imageProjectionMatrix),
    this.textMaterial.uniforms.uProj.needsUpdate = true;

    if (!this.gpu2) {
       this.gpu2 = new THREE.WebGLRenderer( { antialias: false } );

       this.gpu2.autoClear = false;
       this.gpu2.autoUpdateScene = false;
       this.gpu2.outputEncoding = THREE.sRGBEncoding;
       this.gpu2.setPixelRatio( window.devicePixelRatio );
       this.gpu2.setSize( width, height );

       //    this.gpu = new GpuDevice(this, div, this.curSize, this.config.rendererAllowScreenshots, this.config.rendererAntialiasing, this.config.rendererAnisotropic);

       this.div.appendChild( this.gpu2.domElement );
   } else {
       this.gpu2.setSize( width, height );
   }

    this.camera2.aspect = width / height;
    this.camera2.updateProjectionMatrix();

    this.orthoCamera.left = width / -2;
    this.orthoCamera.right = width / 2;
    this.orthoCamera.top = height / -2;
    this.orthoCamera.bottom = height / 2;
    this.orthoCamera.updateProjectionMatrix();

};


ThreeDevice.prototype.cleanTexts = function() {

    for (let i = 0, li = this.textBufferIndex + 1; i < li; i++) {
        let buffer = this.textBuffers[i];
        if (buffer) {
            buffer.index = 0;
            buffer.index2 = 0;
        }
    }

    this.textBufferIndex = 0;
}


ThreeDevice.prototype.addText = function(x,y,z,r,g,b, size, text) {

    const memorySize = (text.length + 1) * 18;

    let buffer = this.textBuffers[this.textBufferIndex];

    if (!buffer) {
        buffer = { mesh:this.createTextBuffer(this.textBufferSize), index:0, index2:0 };
        this.textBuffers[this.textBufferIndex] = buffer;
    }

    if (buffer.index + memorySize > this.textBufferSize) {
        this.textBufferIndex++

        buffer = this.textBuffers[this.textBufferIndex];

        if (!buffer) {
            buffer = { mesh:this.createTextBuffer(this.textBufferSize), index:0, index2:0 };
            this.textBuffers[this.textBufferIndex] = buffer;
        }
    }

    const vertices = buffer.mesh.geometry.attributes.position.array;
    const colors = buffer.mesh.geometry.attributes.color.array;
    const uvs = buffer.mesh.geometry.attributes.uv.array;

    const sizeX = size - 1;
    const sizeY = size;
    const sizeX2 = Math.round(size*0.5);

    let index = buffer.index;
    let index2 = buffer.index2;

    const lx = this.getTextSize(size, text) + 2;

    //draw black line before text
    let char = 0;
    let charPosX = (char & 15) << 4;
    let charPosY = (char >> 4) << 4;
    let x1,x2,y1,y2,u1,u2,v1,v2;

    x1 = x-2, y1 = y-2, u1 = charPosX, v1 = charPosY;
    x2 = x-2 + lx, u2 = charPosX+15;
    y2 = y + sizeY+1, v2 = charPosY+15;

    //black box
    for (let i = index, li = i+18; i < li; i+=3) {
        colors[i] = 0;
        colors[i+1] = 0;
        colors[i+2] = 0;
    }

    //same color for all letters
    for (let i = index + 18, li = i + text.length * 18; i < li; i+=3) {
        colors[i] = r;
        colors[i+1] = g;
        colors[i+2] = b;
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

                x1 = x, y1 = y,  u1 = charPosX, v1 = charPosY,
                x2 = x + sizeX2, u2 = charPosX+8,
                y2 = y + sizeY, v2 = charPosY+16;
                x += sizeX2;
                break;

            default:

                x1 = x, y1 = y,  u1 = charPosX, v1 = charPosY;
                x2 = x + sizeX, u2 = charPosX+15;
                y2 = y + sizeY, v2 = charPosY+16;
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

        uvs[index2] = u1;
        uvs[index2+1] = v1;
        uvs[index2+2] = u2;
        uvs[index2+3] = v1;
        uvs[index2+4] = u2;
        uvs[index2+5] = v2;

        uvs[index2+6] = u2;
        uvs[index2+7] = v2;
        uvs[index2+8] = u1;
        uvs[index2+9] = v2;
        uvs[index2+10] = u1;
        uvs[index2+11] = v1;

        index += 18;
        index2 += 12;
    }

    buffer.index = index;
    buffer.index2 = index2;
};


ThreeDevice.prototype.getTextSize = function(size, text) {

    const sizeX = size - 1;
    const sizeX2 = Math.round(size*0.5);
    let x = 0;

    for (let i = 0, li = text.length; i < li; i++) {
        const char = text.charCodeAt(i) - 32;

        switch(char) {
        case 12:
        case 14:
        case 27: //:
        case 28: //;7
        case 64: //'
        case 73: //i
        case 76: //l
        case 84: //t
            x += sizeX2;
            break;

        default:
            x += sizeX;
            break;
        }
    }

    return x;
};

// eslint-disable-next-line
ThreeDevice.prototype.createRenderTarget = function(width, height, depthTexture) {

    const target = new THREE.WebGLRenderTarget( width, height );

/*
    target.texture.format = THREE.RGBAFormat;
    target.texture.minFilter = THREE.NearestFilter;
    target.texture.magFilter = THREE.NearestFilter;
    target.texture.generateMipmaps = false;
    target.stencilBuffer = true;
    target.depthBuffer = true;

    if (depthTexture) {
        target.depthTexture = new THREE.DepthTexture();
        target.depthTexture.format = THREE.DepthStencilFormat;
        target.depthTexture.type = THREE.UnsignedInt248Type;
    }
*/
    return target;
};


ThreeDevice.prototype.generateMaterial = function(material, options) {

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


ThreeDevice.prototype.generateTileMaterial = function(options) {

    const defines = (options.defines || {});

    const uniforms = {

        uvTrans : { value: new THREE.Vector4(1,1,0,0) },
        map : { value: null }

    };

    //str += '#define TMIN ' + (0.5-map.config.mapSplitMargin) + '\n' + '#define TMAX ' + (0.5+map.config.mapSplitMargin) + '\n';

    if (options.flags) {

        if (options.flags & VTS_MAT_FLAG_DEPTH){
            defines.depth = true;
        }

        if (options.flags & VTS_MAT_FLAG_C4){
            defines.clip4 = true;
            defines.TMIN = (0.5-this.config.mapSplitMargin);
            defines.TMAX = (0.5+this.config.mapSplitMargin);
            uniforms.uClip = { value: [1,1,1,1] };
        }

        if (options.flags & VTS_MAT_FLAG_C8){
            defines.clip8 = true;
            uniforms.uClip = { value: [1,1,1,1, 1,1,1,1] };
            uniforms.uParams = { value: new THREE.Matrix4() };
            uniforms.uParamsC8 = { value: new THREE.Matrix4() };
        }

        if (options.flags & VTS_MAT_FLAG_FLAT) defines.flatShade = true, defines.flatShadeVar = true;
        if (options.flags & VTS_MAT_FLAG_UVS) defines.uvs = true;
    }

    const material = new THREE.ShaderMaterial( {

        defines : defines,
        uniforms: uniforms,
        vertexShader: ThreeShaders.tileVertexShader,
        fragmentShader: ThreeShaders.tileFragmentShader

    } );

    if (options.onRender) {
        material.userData.onRender = options.onRender;
    }

    return material;

}


ThreeDevice.prototype.generateBBoxMaterial = function() {

    const points = new Array(32);

    for (let i = 0; i < 32; i++) {
        points[i] = 0;
    }

    const uniforms = {
        uPoints : { value: points }
    };

    const material = new THREE.ShaderMaterial( {
        uniforms: uniforms,
        vertexShader: ThreeShaders.bbox2VertexShader,
        fragmentShader: ThreeShaders.bboxFragmentShader

    } );

    material.userData.onRender = (function(v){

        this.material.uniforms.uPoints.value = v;
        this.material.uniforms.uPoints.needsUpdate = true;
        this.material.uniformsNeedUpdate = true;

    });

    return material;

}

// eslint-disable-next-line
ThreeDevice.prototype.startRender = function(options) {

    this.scene.updateMatrixWorld();
    this.models.clear();

    this.camera2.position.fromArray(this.renderer.camera.position);
    this.camera2.setRotationFromMatrix( new THREE.Matrix4().fromArray(this.renderer.camera.rotationview).invert());
    this.camera2.fov = this.renderer.camera.fov * 2;
    this.camera2.near = this.renderer.camera.near;
    this.camera2.far = this.renderer.camera.far;
    this.camera2.updateProjectionMatrix();

    this.cleanTexts();
}


ThreeDevice.prototype.addSceneObject = function(object) {

    this.models.add(object);

}

// eslint-disable-next-line
ThreeDevice.prototype.finishRender = function(options) {

    if (this.onBeforeFinish) {
        this.onBeforeFinish();
    }

    if (this.renderer.core.map.draw.drawChannel == 1) {
        this.scene.background = new THREE.Color( 0xffffff );
        this.gpu2.setRenderTarget( this.textureRenderTarget );
        this.gpu2.render( this.scene, this.camera2 );
        this.gpu2.setRenderTarget( null );
        return;
    }

    if (this.renderer.core.map.draw.debug.drawWireframe == 1) {
        this.scene.background = new THREE.Color( 0xf9f9f9 );
    } else {
        this.scene.background = new THREE.Color( 0x000000 );
    }

    this.gpu2.setRenderTarget( null );
    this.gpu2.render( this.scene, this.camera2 );


    /*
    const drawWireframe = this.core.map.draw.debug.drawWireframe;

    if (drawWireframe == 1 || drawWireframe == 2) {

        const models = this.models.children;

        for (let i = 0, li = models.length; i < li; i++) {
            const model = models[i];

            if (model.geometry) {
                const model2 = new THREE.Mesh(model.geometry, this.wireferameMaterial);

                this.scene2.clear();
                this.scene2.add(model2);
                this.gpu2.render(this.scene2, this.camera2 );
            }

        }
    }*/


    if (this.textBuffers.length && this.textBuffers[0].index > 0) {
        this.scene2D.clear();

        for (let i = 0, li = this.textBufferIndex + 1; i < li; i++) {
            const buffer = this.textBuffers[i];
            buffer.mesh.geometry.attributes.position.needsUpdate = true;
            buffer.mesh.geometry.attributes.color.needsUpdate = true;
            buffer.mesh.geometry.attributes.uv.needsUpdate = true;

            buffer.mesh.geometry.setDrawRange(0, Math.floor(buffer.index / 3));
            this.scene2D.add(buffer.mesh);
        }

        this.gpu2.render( this.scene2D, this.orthoCamera );
    }


    /*this.scene2D.clear();
    this.scene2D.add(this.testScreenPlane);
    this.gpu2.render( this.scene2D, this.orthoCamera );*/

}


ThreeDevice.prototype.createRenderGroup = function(id, bbox, origin) {
    return new ThreeGroup(id, bbox, origin, this, this.renderer);
};


ThreeDevice.prototype.createTexture = function(options) {

    const texture = new THREE.Texture(options.image);
    texture.width = options.width;
    texture.height = options.height;
    //texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    texture.flipY = false;
    texture.gpuSize = texture.width * texture.height * 4;
    texture.needsUpdate = true;


    return texture;
};

ThreeDevice.prototype.createDataTexture = function(options) {

    const texture = new THREE.DataTexture( options.data, options.width, options.height, THREE.RGBFormat );
    //texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.gpuSize = texture.width * texture.height * 4;
    texture.needsUpdate = true;

    return texture;
};

// eslint-disable-next-line
ThreeDevice.prototype.createBBox = function(bbox) {

    const box = new THREE.Box3();
    //box.setFromCenterAndSize( new THREE.Vector3(0,0,0),
    //                          new THREE.Vector3(1,1,1) );
    //new THREE.Vector3( (bbox.max[0] - bbox.min[0]), (bbox.max[1] - bbox.min[1]), (bbox.max[2] - bbox.min[2])) );

    const helper = new THREE.Box3Helper( box, 0x0000ff );
    helper.frustumCulled = false;

    return helper;
};

// eslint-disable-next-line
ThreeDevice.prototype.createBBox2 = function(bbox) {

    const geometry = new THREE.BufferGeometry();
    const vertices = new Uint16Array([0,1,1,2,2,3,3,0,
                                      4,5,5,6,6,7,7,4,
                                      0,4,1,5,2,6,3,7]);

    geometry.setAttribute( 'position', new THREE.Uint16BufferAttribute( vertices, 1 ) );

    const lines = new THREE.LineSegments( geometry, this.bboxMaterial);
    lines.frustumCulled = false;

    return lines;
};


ThreeDevice.prototype.createTextBuffer = function(size) {

    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(size*3);
    const colors = new Uint8Array(size*3);
    const uvs = new Uint8Array(size*2);

    const att = new THREE.Float32BufferAttribute( vertices, 3, false )
    geometry.setAttribute( 'position', att );

    const att2 = new THREE.Uint8BufferAttribute( colors, 3, true )
    geometry.setAttribute( 'color', att2 );

    const att3 = new THREE.Uint8BufferAttribute( uvs, 2, false )
    geometry.setAttribute( 'uv', att3 );

    const mesh = new THREE.Mesh( geometry, this.textMaterial);
    mesh.frustumCulled = false;

    return mesh;
};

ThreeDevice.prototype.createWiredMesh = function(mesh) {

    const mesh2 = new THREE.Mesh(mesh.geometry, this.wireferameMaterial);//gpuSubmesh.clone();
    //gpuSubmesh.userData.wiredMesh.material = renderer.wireferameMaterial;
    //mesh2.onBeforeRender = (function(){});
    mesh2.frustumCulled = false;
    mesh2.bbox = mesh.bbox;
    mesh2.scale.set(mesh.scale.x,mesh.scale.y,mesh.scale.z);


    return mesh2;
};


ThreeDevice.prototype.createMesh = function(options) {
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

            if (options.uvs && options.uvs2) {
                geometry.setAttribute( 'uv2', new THREE.Uint16BufferAttribute( options.uvs2, 2, true ) );
            }
        } else {
            geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uv, 2 )/*.onUpload( disposeArray )*/ );

            if (options.uvs && options.uvs2) {
                geometry.setAttribute( 'uv2', new THREE.Float32BufferAttribute( options.uvs2, 2 ) );
            }
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


ThreeDevice.prototype.drawTileSubmesh = function (cameraPos, index, texture, type, alpha, layer, surface, splitMask, splitSpace, submesh, gpuSubmesh) {
    const renderer = this.renderer;
    const map = renderer.core.map;
    const stats = map.stats;
    let drawWireframe = map.draw.debug.drawWireframe;
    let gpuTexture = null, t = null;

    if (texture) {
        gpuTexture = texture.getGpuTexture();
        t = texture.getTransform();
    }


    let flags = 0;
    let material = null;
    let params, paramsC8;

    if (map.draw.drawChannel == 1) {
        type = VTS_MATERIAL_DEPTH;
        drawWireframe = 0;
    }

    if (drawWireframe == 1) {
        gpuSubmesh.material = this.wireferameMaterial;
        gpuSubmesh.onBeforeRender = (function(){});

        /*if (!gpuSubmesh.userData.wiredMesh) {
            gpuSubmesh.userData.wiredMesh = renderer.createWiredMesh(gpuSubmesh);
            gpuSubmesh.userData.wiredMesh.renderOrder = 10;
        }

        renderer.addSceneObject(gpuSubmesh.userData.wiredMesh);

        return;*/

    } else {

        if (drawWireframe == 2 || drawWireframe == 3) {
            flags |= VTS_MAT_FLAG_FLAT;
        }

        switch(type) {
        case VTS_MATERIAL_DEPTH:
            flags |= VTS_MAT_FLAG_DEPTH;
            break;
        case VTS_MATERIAL_INTERNAL:
        case VTS_MATERIAL_INTERNAL_NOFOG:
            flags |= VTS_MAT_FLAG_UVS;
            break;
        case VTS_MATERIAL_FLAT:
            flags |= VTS_MAT_FLAG_FLAT;
            break;
        }

        //splitMask = [1,0,0,0];

        if (splitMask) {
            if (splitMask.length == 4) {
                flags |= VTS_MAT_FLAG_C4;
            } else {
                flags |= VTS_MAT_FLAG_C8;

                const p = map.camera.position;
                const s = splitSpace;

                params = new Array(16);
                paramsC8 = new Array(16);

                const m = paramsC8;

                m[0] = s[0][0] - p[0]; m[1] = s[0][1] - p[1]; m[2] = s[0][2] - p[2]; //c
                m[4] = s[1][0] - s[0][0]; m[5] = s[1][1] - s[0][1]; m[6] = s[1][2] - s[0][2]; //px
                m[8] = s[2][0] - s[1][0]; m[9] = s[2][1] - s[1][1]; m[10] = s[2][2] - s[1][2]; //py
                m[12] = s[4][0] - s[0][0]; m[13] = s[4][1] - s[0][1]; m[14] = s[4][2] - s[0][2]; m[15] = 0; //pz

                const bmin = submesh.bbox.min, bmax = submesh.bbox.max;

                m[3] = bmin[0] - p[0];
                m[7] = bmin[1] - p[1];
                m[11] = bmin[2] - p[2];

                const m2 = params;

                m2[0] = 0, m2[1] = 0, m2[2] = bmax[0] - bmin[0], m2[3] = bmax[1] - bmin[1];
                m2[4] = 0, m2[5] = 0, m2[6] = 0, m2[7] = 0;
                m2[8] = 0, m2[9] = 0, m2[10] = 0, m2[11] = 0;
                m2[12] = bmax[2] - bmin[2], m2[13] = bmin[0], m2[14] = bmin[1], m2[15] = bmin[2];
            }
        }

        material = this.tileMaterials[flags];

        if (!material) {
            material = this.generateTileMaterial({ flags: flags, onRender: this.tileMaterial.userData.onRender });
            this.tileMaterials[flags] = material;
        }

        if (drawWireframe == 2) {
            material.polygonOffset = true;
            material.polygonOffsetFactor = 1;
        } else {
            material.polygonOffset = false;
        }

        gpuSubmesh.material = material;
        gpuSubmesh.onBeforeRender = gpuSubmesh.material.userData.onRender.bind(gpuSubmesh, gpuTexture, t, flags, splitMask, params, paramsC8);

    }


    const bbox = gpuSubmesh.bbox;

    if (bbox) {
        gpuSubmesh.position.set( bbox.min[0] - cameraPos[0], bbox.min[1] - cameraPos[1], bbox.min[2] - cameraPos[2] );
    }

    if (submesh.statsCoutner != stats.counter) {
        submesh.statsCoutner = stats.counter;
        stats.gpuRenderUsed += gpuSubmesh.gpuSize;

        if (gpuTexture) {
            stats.gpuRenderUsed += gpuTexture.gpuSize;
        }
    }

    this.addSceneObject(gpuSubmesh);

    if (drawWireframe == 2) {
        if (!gpuSubmesh.userData.wiredMesh) {
            gpuSubmesh.userData.wiredMesh = this.createWiredMesh(gpuSubmesh);
            gpuSubmesh.userData.wiredMesh.renderOrder = 10;
        }

        if (bbox) {
            gpuSubmesh.userData.wiredMesh.position.set( bbox.min[0] - cameraPos[0], bbox.min[1] - cameraPos[1], bbox.min[2] - cameraPos[2] );
        }

        this.addSceneObject(gpuSubmesh.userData.wiredMesh);
    }

    stats.drawnFaces += this.faces;
    stats.drawCalls ++;

};


export default ThreeDevice;
