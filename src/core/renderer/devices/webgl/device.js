import {mat4 as mat4_} from '../../../utils/matrix';
import WebGLInit_ from './init';
import WebGLDraw_ from './draw';
import WebGLProgram_ from './program';
import WebGLShaders_ from './shaders';
import WebGLGroup_ from './group';
import WebGLTexture_ from './texture';
import WebGLMesh_ from './mesh';

//get rid of compiler mess
const mat4 = mat4_;
const WebGLProgram = WebGLProgram_;
const WebGLShaders = WebGLShaders_;
const WebGLInit = WebGLInit_;
const WebGLDraw = WebGLDraw_;
const WebGLGroup = WebGLGroup_;
const WebGLTexture = WebGLTexture_;
const WebGLMesh = WebGLMesh_;

const WebGLDevice = function(renderer, div, size, keepFrameBuffer, antialias, aniso) {
    this.renderer = renderer;
    this.div = div;
    this.config = renderer.config;
    this.canvas =  null;
    this.curSize = size;
    this.currentProgram = null;
    this.maxAttributesCount = 8;
    this.newAttributes = new Uint8Array(this.maxAttributesCount);
    this.enabledAttributes = new Uint8Array(this.maxAttributesCount);
    this.noTextures = false;
    this.barycentricBuffer = null;
    this.progTile = null;
    this.progHeightmap = null;
    this.progSkydome = null;
    this.progWireframeTile = null;
    this.progWireframeTile2 = null;
    this.progText = null;
    this.progMap = [];

    //state of device when first initialized
    this.defaultState = this.createState({blend:false, stencil:false, zequal: false, ztest:false, zwrite: false, culling:false});
    this.currentState = this.defaultState;
    this.currentOffset = 0; //used fot direct offset

    this.keepFrameBuffer = (keepFrameBuffer == null) ? false : keepFrameBuffer;
    this.antialias = antialias ? true : false;
    this.anisoLevel = aniso;

    this.mBuffer = new Float32Array(16);
    this.mBuffer2 = new Float32Array(16);
    this.vBuffer = new Float32Array(4);
};


WebGLDevice.prototype.init = function() {
    const canvas = document.createElement('canvas');

    if (canvas == null) {
        //canvas not supported
        return;
    }

    this.canvas = canvas;

    canvas.width = this.curSize[0];
    canvas.height = this.curSize[1];
    canvas.style.display = 'block';

    if (canvas.getContext == null) {
        //canvas not supported
        return;
    }

    canvas.addEventListener("webglcontextlost", this.contextLost.bind(this), false);
    canvas.addEventListener("webglcontextrestored", this.contextRestored.bind(this), false);

    let gl;

    try {
        gl = canvas.getContext('webgl', {preserveDrawingBuffer: this.keepFrameBuffer, antialias: this.antialias, stencil: true}) || canvas.getContext('experimental-webgl', {preserveDrawingBuffer: this.keepFrameBuffer});
    } catch(e) {
        //webgl not supported
    }

    if (!gl) {
        //webgl not supported
        return;
    }

    this.gl = gl;

    //if (!
        gl.getExtension('OES_standard_derivatives');
    //){}

    this.anisoExt = (
      gl.getExtension('EXT_texture_filter_anisotropic') ||
      gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
      gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
    );

    if (this.anisoExt) {
        this.maxAniso = gl.getParameter(this.anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);

        if (this.anisoLevel) {
            if (this.anisoLevel == -1) {
                this.anisoLevel = this.maxAniso;
            } else {
                this.anisoLevel = Math.min(this.anisoLevel, this.maxAniso);
            }
        }
    } else {
        this.maxAniso = 0;
        this.anisoLevel = 0;
    }

    this.div.appendChild(canvas);

    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    //gl.enable(gl.DEPTH_TEST);

    //initial state
    gl.disable(gl.BLEND);

    gl.disable(gl.STENCIL_TEST);
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.CULL_FACE);

    //clear screen
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.init = new WebGLInit(this);
    this.draw = new WebGLDraw(this);

};


WebGLDevice.prototype.kill = function() {

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

    this.div.removeChild(this.canvas);
    delete this.canvas;
    this.canvas = null;
};


WebGLDevice.prototype.contextLost = function(event) {
    event.preventDefault();
    this.renderer.core.contextLost = true;
    this.renderer.core.callListener('gpu-context-lost', {});
};


WebGLDevice.prototype.contextRestored = function() {
    this.renderer.core.callListener('gpu-context-restored', {});
};


WebGLDevice.prototype.resize = function(size, skipCanvas) {
    this.curSize = size;
    const canvas = this.canvas, gl = this.gl;

    if (canvas != null && skipCanvas !== true) {
        canvas.width = this.curSize[0];
        canvas.height = this.curSize[1];
    }

    if (gl != null) {
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    }
};


WebGLDevice.prototype.setAniso = function(aniso) {
    if (this.anisoExt) {
        if (this.anisoLevel) {
            if (aniso == -1) {
                this.anisoLevel = this.maxAniso;
            } else {
                this.anisoLevel = Math.min(aniso, this.maxAniso);
            }
        }
    }
};


WebGLDevice.prototype.getCanvas = function() {
    return this.canvas;
};


WebGLDevice.prototype.setViewport = function() {
    this.gl.viewport(0, 0, this.gl.viewportWidth, this.gl.viewportHeight);
};


WebGLDevice.prototype.clear = function(clearDepth, clearColor, color) {
    if (color != null) {
        this.gl.clearColor(color[0]/255, color[1]/255, color[2]/255, color[3]/255);
    }

    this.gl.clear((clearColor ? this.gl.COLOR_BUFFER_BIT : 0) |
                  (clearDepth ? this.gl.DEPTH_BUFFER_BIT : 0) );
};


WebGLDevice.prototype.useProgram = function(program, attributes, nextSampler) {
    if (this.currentProgram != program) {
        this.gl.useProgram(program.program);
        this.currentProgram = program;

        program.setSampler('uSampler', 0);

        if (nextSampler) {
            program.setSampler('uSampler2', 1);
        }

        const newAttributes = this.newAttributes;
        const enabledAttributes = this.enabledAttributes;

        //reset new attributes list
        for (let i = 0, li = newAttributes.length; i < li; i++){
            newAttributes[i] = 0;
        }

        for (let i = 0, li = attributes.length; i < li; i++){
            const index = program.getAttribute(attributes[i]);

            if (index != -1){
                newAttributes[index] = 1;
            }
        }

        //enable or disable current attributes according to new attributes list
        for (let i = 0, li = newAttributes.length; i < li; i++){
            if (enabledAttributes[i] != newAttributes[i]) {
                if (newAttributes[i]) {
                    this.gl.enableVertexAttribArray(i);
                    enabledAttributes[i] = 1;
                } else {
                    this.gl.disableVertexAttribArray(i);
                    enabledAttributes[i] = 0;
                }
            }
        }
    }
};


WebGLDevice.prototype.bindTexture = function(texture, id) {
    if (!texture.loaded) {
        return;
    }

    this.gl.activeTexture(id ? this.gl.TEXTURE1 : this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture.texture);
};


WebGLDevice.prototype.setFramebuffer = function(texture) {
    if (texture != null) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, texture.framebuffer);
    } else {
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
};


WebGLDevice.prototype.createState = function(state) {
    if (state.blend == null) { state.blend = false; }
    if (state.stencil == null) { state.stencil = false; }
    if (state.zwrite == null) { state.zwrite = true; }
    if (state.ztest == null) { state.ztest = true; }
    if (state.zequal == null) { state.zequal = false; }
    if (state.culling == null) { state.culling = true; }

    return state;
};


WebGLDevice.prototype.setState = function(state) {
    if (!state) {
        return;
    }

    const gl = this.gl;
    const currentState = this.currentState;

    if (currentState.blend != state.blend) {
        if (state.blend) {
            gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.enable(gl.BLEND);
        } else {
            gl.disable(gl.BLEND);
        }
    }

    if (currentState.stencil != state.stencil) {
        if (state.stencil) {
            gl.enable(gl.STENCIL_TEST);
        } else {
            gl.disable(gl.STENCIL_TEST);
        }
    }

    if (currentState.zwrite != state.zwrite) {
        if (state.zwrite) {
            gl.depthMask(true);
        } else {
            gl.depthMask(false);
        }
    }

    if (currentState.ztest != state.ztest) {
        if (state.ztest != 0) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
    }

    if (currentState.zequal != state.zequal) {
        if (state.zequal != 0) {
            gl.depthFunc(gl.LEQUAL);
        } else {
            gl.depthFunc(gl.LESS);
        }
    }

    if (currentState.culling != state.culling) {
        if (state.culling) {
            gl.enable(gl.CULL_FACE);
        } else {
            gl.disable(gl.CULL_FACE);
        }
    }

    this.currentState = state;
};


WebGLDevice.prototype.setSize = function(width, height) {
    this.resize(this.curSize /*, skipCanvas*/);

    //if (skipPaint !== true) { //remove this??
       // this.draw.paintGL();
    //}
};

WebGLDevice.prototype.generateTileShader = function (progs, v, useSuperElevation, splitMask) {
    let str = '';
    if (splitMask) {
        if (!this.config.mapSplitMargin) {
            if (splitMask.length == 4){ str += '#define clip4_nomargin\n' } else { str += '#define clip8\n' }
        } else {
            if (splitMask.length == 4){ str += '#define clip4\n' } else { str += '#define clip8\n' }
            str += '#define TMIN ' + (0.5-this.config.mapSplitMargin) + '\n' + '#define TMAX ' + (0.5+this.config.mapSplitMargin) + '\n';
        }
    }

    if (v & VTS_TILE_SHADER_FLAT_INNER) {
        str +=  '#extension GL_OES_standard_derivatives : enable\n';
        str += '#define flatShade\n';
        str += '#define flatShadeVar\n';
        str += '#define flatShadeInner\n';
    }

    if (useSuperElevation) str += '#define applySE\n';
    const prog = (new WebGLProgram(this, progs[0].vertex.replace('#define variants\n', str), progs[0].fragment.replace('#define variants\n', str)));
    progs[v] = prog;
    return prog;
};


WebGLDevice.prototype.generateTileShaderWithFilter = function (progs, v, useSuperElevation, splitMask, gpuMask, flatShade, filter) {
    const map = this.renderer.core.map;
    let pixelShader, variations = '';

    if (splitMask) {
        if (!map.config.mapSplitMargin) {
            variations += '#define clip4_nomargin\n';
        } else {
            variations += '#define clip4\n';
            variations += '#define TMIN ' + (0.5-map.config.mapSplitMargin) + '\n' + '#define TMAX ' + (0.5+map.config.mapSplitMargin) + '\n';
        }
    }

    let vertexShader = '#define externalTex\n' + variations + ((useSuperElevation) ? '#define applySE\n' : '') + WebGLShaders.tileVertexShader;

    if (gpuMask) {
        pixelShader = '#define externalTex\n#define mask\n' + variations + WebGLShaders.tileFragmentShader;
    } else {
        pixelShader = '#define externalTex\n' + variations + WebGLShaders.tileFragmentShader;
    }

    if (flatShade) {
        pixelShader =  '#extension GL_OES_standard_derivatives : enable\n#define flatShadeVar\n' + pixelShader;
        vertexShader = '#define flatShadeVar\n' + vertexShader;

        //if (map.mobile) {
            //pixelShader = '#define flatShadeVarFallback\n' + pixelShader;
            pixelShader = pixelShader.replace('mediump', 'highp');
        //}
    }

    const program = new WebGLProgram(this, vertexShader, pixelShader.replace('__FILTER__', filter));
    return program;
};


WebGLDevice.prototype.createRenderGroup = function(id, bbox, origin) {
    return new WebGLGroup(id, bbox, origin, this, this.renderer);
};


WebGLDevice.prototype.drawTileSubmesh = function (cameraPos, index, texture, type, alpha, layer, surface, splitMask, splitSpace, submesh, gpuSubmesh) {

    const renderer = this.renderer;
    const map = this.renderer.core.map;
    const draw = map.draw;
    const stats = map.stats;
    let program = null;
    let gpuMask = null;

    let texcoordsAttr = null;
    let texcoords2Attr = null;
    const drawWireframe = draw.debug.drawWireframe;
    const useSuperElevation = renderer.useSuperElevation;
    let attributes = ['aPosition'];
    let vbits = (useSuperElevation) ? VTS_TILE_SHADER_SE : 0;

    if (drawWireframe == 2) {
        type = VTS_MATERIAL_FLAT;
    }

    if (splitMask) {
        vbits |= VTS_TILE_SHADER_CLIP4;

        if (type != VTS_MATERIAL_EXTERNAL && type != VTS_MATERIAL_INTERNAL_NOFOG) {
            texcoords2Attr = 'aTexCoord2';
            attributes.push('aTexCoord2');
        }
    }

    if (texture && draw.debug.meshStats) {
        if (!submesh.uvAreaComputed) {
            submesh.computeUVArea(texture.getGpuTexture());
        }

        stats.meshesUVArea += submesh.uvArea;
        stats.meshesFaces += submesh.faces;
    }

    if (type == VTS_MATERIAL_DEPTH) {
        program = this.progDepthTile[vbits];

        if (!program) {
            program = this.generateTileShader(this.progDepthTile, vbits, useSuperElevation, splitMask);
        }

    } else if (type == VTS_MATERIAL_FLAT) {
        program = this.progFlatShadeTile[vbits];

        if (!program) {
            program = this.generateTileShader(this.progFlatShadeTile, vbits, useSuperElevation, splitMask);
        }

    } else {
        if (drawWireframe > 0 && type == VTS_MATERIAL_FOG) {
            return;
        }

        if (drawWireframe == 1 || drawWireframe == 3) {
            program = this.progFlatShadeTile[vbits];

            if (!program) {
                program = this.generateTileShader(this.progFlatShadeTile, vbits, useSuperElevation, splitMask);
            }

        } else {
            switch(type) {
            case VTS_MATERIAL_INTERNAL:
            case VTS_MATERIAL_INTERNAL_NOFOG:

                texcoordsAttr = 'aTexCoord';
                attributes.push('aTexCoord');

                if (surface && surface.flatShade) {
                    vbits |= VTS_TILE_SHADER_FLAT_INNER;
                }

                program = this.progTile[vbits];

                if (!program) {
                    program = this.generateTileShader(this.progTile, vbits, useSuperElevation, splitMask);
                }

                break;

            case VTS_MATERIAL_EXTERNAL:
            case VTS_MATERIAL_EXTERNAL_NOFOG:
                {
                    let prog = this.progTile2;

                    if (texture) {
                        gpuMask = texture.getGpuMaskTexture();
                        if (gpuMask) {
                            prog = this.progTile3;
                        }
                    }

                    program = prog[vbits];

                    if (!program) {
                        program = this.generateTileShader(prog, vbits, useSuperElevation, splitMask);
                    }


                    if (layer && (layer.shaderFilters || layer.shaderFilter)) {
                        let filter, flatShade;

                        if (surface && layer.shaderFilters) {
                            filter = layer.shaderFilters[surface.id];

                            if (filter) {
                                if (filter.varFlatShade) {
                                    flatShade = true;
                                }

                                filter = filter.filter;
                            }
                        }

                        if (!filter) {
                            filter = layer.shaderFilter;
                        }

                        if (filter) {
                            let id = (gpuMask) ? 'progTile3' : 'progTile2';

                            if (useSuperElevation) {
                                id += 'se';
                            }

                            if (flatShade) {
                                id += 'fs';
                            }

                            if (splitMask) {
                                id += 'c4';
                            }

                            id += filter;

                            program = this.progMap[id];

                            if (!program) {
                                program = this.generateTileShaderWithFilter(this.progMap, id, useSuperElevation, splitMask, gpuMask, flatShade, filter);
                            }
                        }
                    }

                    texcoords2Attr = 'aTexCoord2';
                    attributes.push('aTexCoord2');
                }
                break;

            case VTS_MATERIAL_FOG:
                program = this.progFogTile[vbits];

                if (!program) {
                    program = this.generateTileShader(this.progFogTile, vbits, useSuperElevation, splitMask);
                }

                break;
            }
        }
    }

    if (!program || !program.isReady()) {
        return;
    }

    this.useProgram(program, attributes, gpuMask);

    let gpuTexture;

    if (texture) {
        gpuTexture = texture.getGpuTexture();

        if (gpuTexture) {
            if (texture.statsCoutner != stats.counter) {
                texture.statsCoutner = stats.counter;
                stats.gpuRenderUsed += gpuTexture.getSize();
            }

            this.bindTexture(gpuTexture);

            if (gpuMask) {
                this.bindTexture(gpuMask, 1);
            }

        } else {
            return;
        }
    } else if (type != VTS_MATERIAL_FOG && type != VTS_MATERIAL_DEPTH && type != VTS_MATERIAL_FLAT) {
        return;
    }

    let mv = this.mBuffer, m = this.mBuffer2, v = this.vBuffer;

    if (useSuperElevation) {

        m = this.mBuffer;
        const se = renderer.superElevation;

        m[0] = submesh.bbox.min[0];
        m[1] = submesh.bbox.min[1];
        m[2] = submesh.bbox.min[2];

        m[3] = submesh.bbox.side(0);
        m[4] = submesh.bbox.side(1);
        m[5] = submesh.bbox.side(2);

        //m[6] = 0;
        //m[7] = 0;
        //m[8] = 0;

        m[9] = se[0]; // h1
        m[10] = se[1]; // f1
        m[11] = se[2]; // h2
        m[12] = se[6]; // inv dh
        m[13] = se[5]; // df

        m[14] = renderer.earthRadius;
        m[15] = renderer.earthERatio;

        program.setMat4('uParamsSE', m);

        //mv = renderer.camera.getModelviewFMatrix();
        mat4.multiply(renderer.camera.getModelviewFMatrix(), submesh.getWorldMatrixSE(cameraPos, m), mv);

    } else {
        mat4.multiply(renderer.camera.getModelviewFMatrix(), submesh.getWorldMatrix(cameraPos, m), mv);
    }


    let proj = renderer.camera.getProjectionFMatrix();

    program.setMat4('uMV', mv);

    if (draw.zbufferOffset) {
        program.setMat4('uProj', proj, renderer.getZoffsetFactor(draw.zbufferOffset));
    } else {
        program.setMat4('uProj', proj);
    }

    if (splitMask) {
        program.setFloatArray('uClip', splitMask);

        //const fx = this.getLinePointParametricDist(points[0], points[1], point);
        //const fy = this.getLinePointParametricDist(points[1], points[2], point);
        //const fz = this.getLinePointParametricDist(points[4], points[0], point);

        let p = map.camera.position;
        let s = splitSpace;
        //const c = [s[0][0] - p[0], s[0][1] - p[1], s[0][2] - p[2]];
        //const px = [s[1][0] - p[0], s[1][1] - p[1], s[1][2] - p[2]];
        //const py = [s[2][0] - p[0], s[2][1] - p[1], s[2][2] - p[2]];
        //const pz = [s[4][0] - p[0], s[4][1] - p[1], s[4][2] - p[2]];

        if (splitSpace) {
            m[0] = s[0][0] - p[0]; m[1] = s[0][1] - p[1]; m[2] = s[0][2] - p[2];
            m[4] = s[1][0] - s[0][0]; m[5] = s[1][1] - s[0][1]; m[6] = s[1][2] - s[0][2];
            m[8] = s[2][0] - s[1][0]; m[9] = s[2][1] - s[1][1]; m[10] = s[2][2] - s[1][2];
            //m[12] = s[0][0] - s[4][0]; m[13] = s[0][1] - s[4][1]; m[14] = s[0][2] - s[4][2];
            m[12] = s[4][0] - s[0][0]; m[13] = s[4][1] - s[0][1]; m[14] = s[4][2] - s[0][2];

            let bmin = submesh.bbox.min;// bmax = submesh.bbox.max;

            m[3] = bmin[0] - p[0];
            m[7] = bmin[1] - p[1];
            m[11] = bmin[2] - p[2];

            program.setMat4('uParamsC8', m);
        }
    }

    if (drawWireframe == 0) {
        let cv = map.camera.vector2, c = draw.atmoColor, t, bmin = submesh.bbox.min, bmax = submesh.bbox.max;

        switch(type) {
        case VTS_MATERIAL_INTERNAL:
        case VTS_MATERIAL_FOG:
        case VTS_MATERIAL_INTERNAL_NOFOG:

            m[0] = draw.zFactor, m[1] = (type == VTS_MATERIAL_INTERNAL_NOFOG) ? 0 : draw.fogDensity;
            m[2] = bmax[0] - bmin[0], m[3] = bmax[1] - bmin[1],
            m[4] = cv[0], m[5] = cv[1], m[6] = cv[2], m[7] = cv[3],
            m[12] = bmax[2] - bmin[2], m[13] = bmin[0], m[14] = bmin[1], m[15] = bmin[2];

            program.setMat4('uParams', m);

            v[0] = c[0], v[1] = c[1], v[2] = c[2];
            program.setVec4('uParams2', v);

            break;

        case VTS_MATERIAL_EXTERNAL:
        case VTS_MATERIAL_EXTERNAL_NOFOG:

            t = texture.getTransform();

            m[0] = draw.zFactor, m[1] = (type == VTS_MATERIAL_EXTERNAL) ? draw.fogDensity : 0;
            m[2] = bmax[0] - bmin[0], m[3] = bmax[1] - bmin[1],
            m[4] = cv[0], m[5] = cv[1], m[6] = cv[2], m[7] = cv[3],
            m[8] = t[0], m[9] = t[1], m[10] = t[2], m[11] = t[3],
            m[12] = bmax[2] - bmin[2], m[13] = bmin[0], m[14] = bmin[1], m[15] = bmin[2];

            program.setMat4('uParams', m);

            v[0] = c[0], v[1] = c[1], v[2] = c[2]; v[3] = (type == VTS_MATERIAL_EXTERNAL) ? 1 : alpha;
            program.setVec4('uParams2', v);

            break;
        }
    }

    if (submesh.statsCoutner != stats.counter) {
        submesh.statsCoutner = stats.counter;
        stats.gpuRenderUsed += gpuSubmesh.getSize();
    }

    gpuSubmesh.draw(program, 'aPosition', texcoordsAttr, texcoords2Attr, drawWireframe != 0 ? 'aBarycentric' : null, (drawWireframe == 2));


    if (drawWireframe == 1 || drawWireframe == 2) { //very slow debug only
        program = this.progWireFrameBasic[vbits];

        if (!program) {
            program = this.generateTileShader(this.progWireFrameBasic, vbits, useSuperElevation, splitMask);
            this.progWireFrameBasic[vbits] = program;
        }

        this.useProgram(program, attributes, gpuMask);

        if (useSuperElevation) {
            program.setMat4('uParamsSE', m);
        }

        program.setMat4('uMV', mv);
        program.setVec4('uColor', [0,0,0,1]);

        program.setMat4('uProj', proj, renderer.getZoffsetFactor([-0.001,0,0]));

        if (splitMask) {
            program.setFloatArray('uClip', splitMask);
        }

        const gl = gpuSubmesh.gl;

        if (gpuSubmesh.indexBuffer) {
            for (let i = 0, li = gpuSubmesh.indexBuffer.numItems*2; i < li; i+=3) {
                gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, i);
            }
        }  else {
            for (let i = 0, li = gpuSubmesh.vertexBuffer.numItems*2; i < li; i+=3) {
                gl.drawArrays(gl.LINE_LOOP, i, 3);
            }
        }
    }

    stats.drawnFaces += submesh.faces;
    stats.drawCalls ++;
};


WebGLDevice.prototype.createShader = function(options) {

    return new WebGLProgram(this, options.vertexShader, options.fragmentShader);

};


WebGLDevice.prototype.createTexture = function(options) {

    const texture = new WebGLTexture(this, null, this.renderer.core, null, null, options.tiled, options.filter);

    if (options.data) {
        texture.createFromData(options.width, options.height, options.data, options.filter, options.repeat);

        if (options.framebuffer) {
            texture.createFramebuffer(options.width, options.height);
        }

    } else if (options.path) {
        texture.load(options.path, options.onLoaded, options.onError, options.direct, options.keepImage);
    } else if (options.image) {
        texture.createFromImage(options.image, options.filter, options.repeat, options.aniso);
    }

    return texture;

};


WebGLDevice.prototype.createMesh = function(options) {

    //(gpu, meshData, fileSize, core, direct, use16bit, verticesUnnormalized) {

    return new WebGLMesh(this, options, 1, this.renderer.core, options.direct, options.use16bit); // true, this.use16bit);

}



export default WebGLDevice;
