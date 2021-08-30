
//import GpuTexture_ from './gpu/texture';
//import GpuMesh_ from './gpu/mesh';
//import GpuProgram_ from './gpu/program';
import {Octree as Octree_, OctreeRaycaster as OctreeRaycaster_} from './raycaster.js';

//get rid of compiler mess
//const GpuTexture = GpuTexture_;
//const GpuMesh = GpuMesh_;
//const GpuProgram = GpuProgram_;
const Octree = Octree_;
const OctreeRaycaster = OctreeRaycaster_;

const RendererInterface = function(renderer) {
    this.renderer = renderer;
    this.gpu = renderer.gpu;
};

RendererInterface.prototype.getRaw = function() {
    return this.renderer;
};

RendererInterface.prototype.clear = function(options) {
    if (options != null) {
        this.gpu.clear((options['clearDepth'] || true),
                        (options['clearColor'] || false),
                        (options['color'] || [255,255,255,255]),
                        ((options['depth'] != null) ? options['depth'] : 1.0) );
    }
    return this;
};


RendererInterface.prototype.createState = function(options) {
    if (options == null || typeof options !== 'object') {
        return this;
    }

    const stateOptions = {
        blend : (options['blend'] != null) ? options['blend'] : false,
        stencil : (options['stencil'] != null) ? options['stencil'] : false,
        zoffset : (options['zoffset'] != null) ? options['zoffset'] : 0,
        zwrite : (options['zwrite'] != null) ? options['zwrite'] : true,
        ztest : (options['ztest'] != null) ? options['ztest'] : true,
        zequal : (options['zequal'] != null) ? options['zequal'] : true,
        culling : (options['culling'] != null) ? options['culling'] : true
    };

    return this.gpu.createState(stateOptions);
};


RendererInterface.prototype.setState = function(state) {
    if (state != null) {
        this.gpu.setState(state);
    }
    return this;
};


RendererInterface.prototype.createTexture = function(options) {
    if (options == null || typeof options !== 'object') {
        return null;
    }

    const source = options['source'];
    if (source == null) {
        return null;
    }

    const filter = options['filter'] || 'linear';
    const repeat = options['repeat'] || false;

    if (source instanceof Uint8Array) {
        const width = options['width'];
        const height = options['height'];

        if (width && height) {
            //const texture = new GpuTexture(this.gpu);
            //texture.createFromData(width, height, source, filter, repeat);
            const texture = this.gpu.createTexture({data:source, width:width, height:height, filter: filter, repeat: repeat });
            return texture;
        }
    }

    if (source instanceof Image) {
        //const texture = new GpuTexture(this.gpu);
        //texture.createFromImage(source, filter, repeat);
        const texture = this.gpu.createTexture({image:source, filter: filter, repeat: repeat });
        return texture;
    }

    return null;
};


RendererInterface.prototype.removeTexture = function(texture) {
    if (texture) {
        texture.kill();
    }
    return this;
};


RendererInterface.prototype.createMesh = function(options) {
    if (options == null || typeof options !== 'object') {
        return null;
    }

    const data = {
        vertices : options['vertices'],
        uvs : options['uvs'],
        uvs2 : options['normals'],
        vertexSize : options['vertexSize'],
        uvSize : options['uvSize'],
        uv2Size : options['normalSize'] || 3,
        vertexAttr : options['vertexAttr'],
        uvAttr : options['uvAttr'],
        uv2Attr : options['normalAttr'],
        bbox : options['bbox']
    };

//    return new GpuMesh(this.gpu, data, 0, this.renderer.core);
    return this.gpu.createMesh(data);
};


RendererInterface.prototype.removeMesh = function(mesh) {
    if (mesh) {
        mesh.kill();
    }
    return this;
};


RendererInterface.prototype.createShader = function(options) {
    if (!options || typeof options !== 'object') {
        return null;
    }

    const vertexShader = options['vertexShader'];
    const fragmentShader = options['fragmentShader'];

    if (vertexShader && fragmentShader) {
        //return new GpuProgram(this.gpu, vertexShader, fragmentShader);
        return this.gpu.createShader({ vertexShader: vertexShader, fragmentShader: fragmentShader});
    }
};


RendererInterface.prototype.removeResource = function(resource) {
    if (resource && resource.kill != null) {
        resource.kill();
    }

    return this;
};


RendererInterface.prototype.addJob = function(/*options*/) {
    return this;
};


RendererInterface.prototype.clearJobs = function(/*options*/) {
    return this;
};


RendererInterface.prototype.drawMesh = function(options) {
    if (options == null || typeof options !== 'object') {
        return this;
    }

    if (!options['mesh'] == null || !options['shaderVariables']) {
        return this;
    }

    //const shaderAttributes = options['shaderAttributes'];
    const vertexAttr = options['vertex'] || 'aPosition';
    const depthOffset = (options['depthOffset'] != null) ? options['depthOffset'] : null;
    const shaderVariables = options['shaderVariables'];

    let shader = options['shader'] || 'textured';
    let uvAttr = options['uv'] || 'aTexCoord';
    let uv2Attr = options['normal'] || 'aNormal';
    let texture = options['texture'];

    const renderer = this.renderer;
    const mesh = options['mesh'];
    const mv = renderer.camera.getModelviewMatrix();
    const proj = renderer.camera.getProjectionMatrix();
    const fogDensity = renderer.fogDensity;

    if (typeof shader === 'string') {
        switch(shader) {
        case 'hit':

            if (!shaderVariables['uMV']) {
                shaderVariables['uMV'] = ['mat4', mv];
            }

            if (!shaderVariables['uProj']) {
                shaderVariables['uProj'] = ['mat4', proj];
            }

            uvAttr = null;
            uv2Attr = null;
            texture = null;
            shader = renderer.gpu.progDepthTile[0];
            break;

        case 'shaded':
            uvAttr = null;

        // eslint-disable-next-line
        case 'textured':
        case 'textured-and-shaded':

            if (!shaderVariables['uMV']) {
                shaderVariables['uMV'] = ['mat4', mv];
            }

            if (!shaderVariables['uProj']) {
                shaderVariables['uProj'] = ['mat4', proj];
            }

            if (!shaderVariables['uFogDensity']) {
                shaderVariables['uFogDensity'] = ['float', fogDensity];
            }

            uv2Attr = (shader == 'textured') ? null : 'aNormal';
            shader = (shader == 'textured') ? renderer.gpu.progTile[0] : ((shader == 'shaded') ? renderer.gpu.progShadedTile : renderer.gpu.progTShadedTile);
            break;
        }
    }

    if (!shader || !shader.isReady()) {
        return;
    }

    const attributes = [vertexAttr];
    if (uvAttr){
        attributes.push(uvAttr);
    }
    if (uv2Attr){
        attributes.push(uv2Attr);
    }

    renderer.gpu.useProgram(shader, attributes);

    for (let key in shaderVariables) {
        const item = shaderVariables[key];

        if (item.length == 2) {
            switch(item[0]){
            case 'floatArray':
                shader.setFloatArray(key, item[1]);
                break;
            case 'float':
                shader.setFloat(key, item[1]);
                break;
            case 'mat3':
                shader.setMat3(key, item[1]);
                break;
            case 'mat4':
                if (depthOffset && key == 'uProj') {
                    shader.setMat4(key, item[1], renderer.getZoffsetFactor(depthOffset));
                } else {
                    shader.setMat4(key, item[1]);
                }
                break;
            case 'vec2':
                shader.setVec2(key, item[1]);
                break;
            case 'vec3':
                shader.setVec3(key, item[1]);
                break;
            case 'vec4':
                shader.setVec4(key, item[1]);
                break;
            case 'sampler':
                shader.setSampler(key, item[1]);
                break;
            }
        }
    }

    if (texture) {
        renderer.gpu.bindTexture(texture);
    }

    //mesh.draw(shader, vertexAttr, texture ? uvAttr : null, uv2Attr, null);
    mesh.draw(shader, vertexAttr, uvAttr, uv2Attr, null);
    return this;
};


RendererInterface.prototype.drawImage = function(options) {
    if (options == null || typeof options !== 'object') {
        return this;
    }

    if (options['texture'] == null || options['rect'] == null) {
        return this;
    }

    const rect = options['rect'];
    const depth = (options['depth'] != null) ? options['depth'] : 0;
    const depthOffset = (options['depthOffset'] != null) ? options['depthOffset'] : null;
    const depthTest = (options['depthTest'] != null) ? options['depthTest'] : false;
    const blend = (options['blend'] != null) ? options['blend'] : false;
    const writeDepth = (options['writeDepth'] != null) ? options['writeDepth'] : false;
    const useState = (options['useState'] != null) ? options['useState'] : false;
    let color = options['color'] || [255,255,255,255];
    color = [ color[0] * (1.0/255), color[1] * (1.0/255), color[2] * (1.0/255), color[3] * (1.0/255) ];

    this.renderer.gpu.draw.drawImage(rect[0], rect[1], rect[2], rect[3], options['texture'], color, depth, depthOffset, depthTest, blend, writeDepth, useState);
    return this;
};


RendererInterface.prototype.drawBillboard = function(options) {
    if (options == null || typeof options !== 'object') {
        return this;
    }

    if (options['texture'] == null || options['mvp'] == null) {
        return this;
    }

    const mvp = options['mvp'];
    const depthOffset = (options['depthOffset'] != null) ? options['depthOffset'] : null;
    const depthTest = (options['depthTest'] != null) ? options['depthTest'] : false;
    const blend = (options['blend'] != null) ? options['blend'] : false;
    const writeDepth = (options['writeDepth'] != null) ? options['writeDepth'] : false;
    const useState = (options['useState'] != null) ? options['useState'] : false;
    let color = options['color'] || [255,255,255,255];
    color[0] *= 1.0/255;
    color[1] *= 1.0/255;
    color[2] *= 1.0/255;
    color[3] *= 1.0/255;

    this.renderer.gpu.draw.drawBillboard(mvp, options['texture'], color, depthOffset, depthTest, blend, writeDepth, useState);
    return this;
};


RendererInterface.prototype.drawLineString = function(options) {
    if (options == null || typeof options !== 'object') {
        return this;
    }

    if (options['points'] == null) {
        return this;
    }

    const points = options['points'];
    const depthOffset = (options['depthOffset'] != null) ? options['depthOffset'] : null;
    const size = options['size'] || 2;
    const screenSpace = (options['screenSpace'] != null) ? options['screenSpace'] : true;
    const depthTest = (options['depthTest'] != null) ? options['depthTest'] : false;
    const blend = (options['blend'] != null) ? options['blend'] : false;
    const writeDepth = (options['writeDepth'] != null) ? options['writeDepth'] : false;
    const useState = (options['useState'] != null) ? options['useState'] : false;
    let color = options['color'] || [255,255,255,255];
    color[0] *= 1.0/255;
    color[1] *= 1.0/255;
    color[2] *= 1.0/255;
    color[3] *= 1.0/255;

    this.renderer.gpu.draw.drawLineString(points, screenSpace, size, color, depthOffset, depthTest, blend, writeDepth, useState);
    return this;
};


RendererInterface.prototype.drawJobs = function(/*options*/) {
    return this;
};


RendererInterface.prototype.drawBBox = function(/*options*/) {
    return this;
};


RendererInterface.prototype.drawDebugText = function(options) {
    if (options == null || typeof options !== 'object') {
        return this;
    }

    const text = options['text'];
    const coords = options['coords'];

    if (!text || !coords) {
        return this;
    }

    const size = options['size'] || 16;
    const depth = options['depth'];
    const useState = options['useState'] || false;
    let color = options['color'] || [255,255,255,255];
    color[0] *= 1.0/255;
    color[1] *= 1.0/255;
    color[2] *= 1.0/255;
    color[3] *= 1.0/255;

    const lx = this.renderer.gpu.draw.getTextSize(size, text);

    this.renderer.gpu.draw.drawText(coords[0] - (lx * 0.5), coords[1], size, text, color, depth, useState);

    return this;
};


RendererInterface.prototype.buildOctreeFromGeometry = function(geometry) {
    const octree = new Octree();
    octree.buildFromGeometry(geometry);
    return octree;
};


RendererInterface.prototype.raycastOctreeGeometry = function(octree, rayPos, rayDir) {
    const raycaster = new OctreeRaycaster(), intersects = [];
    raycaster.intersectOctree(rayPos, rayDir, octree, intersects);
    return raycaster.intersectOctants(rayPos, rayDir, intersects);
};


RendererInterface.prototype.saveScreenshot = function(output, filename, filetype) {
    return this.renderer.saveScreenshot(output, filename, filetype);
};


RendererInterface.prototype.getCanvasCoords = function(point, mvp) {
    return this.renderer.project2(point, mvp);
};


RendererInterface.prototype.getCanvasSize = function() {
    return this.renderer.curSize.slice();
};


RendererInterface.prototype.setConfigParams = function(params) {
    this.renderer.setConfigParams(params);
    return this;
};


RendererInterface.prototype.setConfigParam = function(key, value) {
    this.renderer.setConfigParam(key, value);
    return this;
};


RendererInterface.prototype.getConfigParam = function(key) {
    return this.renderer.getConfigParam(key);
};


RendererInterface.prototype.getGLInterface = function() {
    return {
        canvas : this.gpu.canvas,
        gl : this.gpu.gl
    };
};


RendererInterface.prototype.setSuperElevation = function(h1, f1, h2, f2) {
    return this.renderer.setSuperElevation(h1, f1, h2, f2);
};


RendererInterface.prototype.setMarginFlags = function(flags) {
    return this.renderer.marginFlags = flags;
};


RendererInterface.prototype.getMarginFlags = function() {
    return this.renderer.marginFlags;
};


export default RendererInterface;
