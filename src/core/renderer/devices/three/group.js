
import {vec3 as vec3_, mat4 as mat4_} from '../../../utils/matrix';
import BBox_ from '../../bbox';
import {math as math_} from '../../../utils/math';
import {utils as utils_} from '../../../utils/utils';
import MapResourceNode_ from '../../../map/resource-node';

//get rid of compiler mess
const vec3 = vec3_, mat4 = mat4_;
const BBox = BBox_;
const math = math_;
const utils = utils_;
const MapResourceNode = MapResourceNode_;

const ThreeGroup = function(id, bbox, origin, gpu, renderer) {
    this.id = id;
    this.bbox = null;
    this.origin = origin || [0,0,0];
    this.gpu = gpu;
    this.gl = gpu.gl;
    this.renderer = renderer;
    this.jobs = [];
    this.reduced = 0;
    this.geometries = {};
    this.subjob = null;
    this.mv = new Float32Array(16);
    this.mvp = new Float32Array(16);
    this.loadMode = 0;
    //this.geFactor = 1/38;
    this.geFactor = 1/16;
    this.geFactor2 = 0.5;
    this.geNormalized = false;

    if (bbox != null && bbox[0] != null && bbox[1] != null) {
        this.bbox = new BBox(bbox[0][0], bbox[0][1], bbox[0][2], bbox[1][0], bbox[1][1], bbox[1][2]);
    }

    this.binFiles = [];

    this.size = 0;
    this.polygons = 0;
};

//destructor
ThreeGroup.prototype.kill = function() {
    for (let i = 0, li = this.jobs.length; i < li; i++) {
        const job = this.jobs[i];

        switch(job.type) {
        case VTS_JOB_FLAT_LINE:
        case VTS_JOB_POLYGON:
            if (job.vertexPositionBuffer) this.gl.deleteBuffer(job.vertexPositionBuffer);
            if (job.vertexElementBuffer) this.gl.deleteBuffer(job.vertexElementBuffer);
            break;

        case VTS_JOB_FLAT_TLINE:
        case VTS_JOB_FLAT_RLINE:
        case VTS_JOB_PIXEL_LINE:
        case VTS_JOB_PIXEL_TLINE:
            if (job.vertexPositionBuffer) this.gl.deleteBuffer(job.vertexPositionBuffer);
            if (job.vertexNormalBuffer) this.gl.deleteBuffer(job.vertexNormalBuffer);
            if (job.vertexElementBuffer) this.gl.deleteBuffer(job.vertexElementBuffer);
            break;

        case VTS_JOB_LINE_LABEL:
            if (job.vertexPositionBuffer) this.gl.deleteBuffer(job.vertexPositionBuffer);
            if (job.vertexTexcoordBuffer) this.gl.deleteBuffer(job.vertexTexcoordBuffer);
            if (job.vertexElementBuffer) this.gl.deleteBuffer(job.vertexElementBuffer);
            break;

        case VTS_JOB_ICON:
        case VTS_JOB_LABEL:
            if (job.vertexPositionBuffer) this.gl.deleteBuffer(job.vertexPositionBuffer);
            if (job.vertexTexcoordBuffer) this.gl.deleteBuffer(job.vertexTexcoordBuffer);
            if (job.vertexOriginBuffer) this.gl.deleteBuffer(job.vertexOriginBuffer);
            if (job.vertexElementBuffer) this.gl.deleteBuffer(job.vertexElementBuffer);
            break;
        }
    }

    //remove geometries
    for (let key in this.geometries) {
        const geometries = this.geometries[key];
        const globalGeometry = this.renderer.geometries[key];
        this.geometries[key] = null;

        //remove geometry from glbal stack
        for (let i = 0, li = geometries.length; i < li; i++) {
            if (geometries[i] == globalGeometry) {
                this.renderer.geometries[key] = null;
            }
        }
    }

    if (this.octreeParser) {
        this.octreeParser.kill();
        this.octreeParser = null;
    }

};


ThreeGroup.prototype.getSize = function() {
    return this.size;
};


ThreeGroup.prototype.getZbufferOffset = function() {
    return this.size;
};

ThreeGroup.prototype.addGeometry = function(data) {
    const id = data['id'];

    if (!this.geometries[id]) {
        this.geometries[id] = [data];
    } else {
        this.geometries[id].push(data);
    }

    this.renderer.geometries[id] = data;
};

ThreeGroup.prototype.convertColor = function(c) {
    const f = 1.0/255;
    return [c[0]*f, c[1]*f, c[2]*f, c[3]*f];
};

ThreeGroup.prototype.addLineJob = function(data) {
    const gl = this.gl;

    const vertices = data.vertexBuffer;

    const job = {};

    if (data.type == VTS_WORKER_TYPE_POLYGON) {
        job.type = VTS_JOB_POLYGON;
    } else {
        job.type = VTS_JOB_FLAT_LINE;
    }

    job.program = this.gpu.progLine;
    job.color = this.convertColor(data['color']);
    job.zIndex = data['z-index'] + 256;
    job.clickEvent = data['click-event'];
    job.hoverEvent = data['hover-event'];
    job.enterEvent = data['enter-event'];
    job.leaveEvent = data['leave-event'];
    job.advancedHit = data['advancedHit'];
    job.hitable = data['hitable'];
    job.eventInfo = data['eventInfo'];
    job.style = data['style'] || 0;
    job.stencil = (data['stencil'] === false) ? false : true;
    job.culling = data['culling'] || 0;
    job.state = data['state'];
    job.center = data['center'];
    job.lod = data['lod'];
    job.lineWidth = data['line-width'];
    job.zbufferOffset = data['zbuffer-offset'];
    job.reduced = false;
    job.ready = true;
    job.bbox = this.bbox;

    if (!job.program.isReady()) {
        return;
    }

    if (job.advancedHit) {
        job.program2 = this.gpu.progELine;

        if (!job.program2.isReady()) {
            return;
        }
    }

    //create vertex buffer
    job.vertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    job.vertexPositionBuffer.itemSize = 3;
    job.vertexPositionBuffer.numItems = vertices.length / 3;

    if (job.advancedHit) {
        job.program = this.gpu.progLine;

        const elements = data.elementBuffer;

        job.vertexElementBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexElementBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, elements, gl.STATIC_DRAW);
        job.vertexElementBuffer.itemSize = 1;
        job.vertexElementBuffer.numItems = elements.length;
    }

    this.jobs.push(job);

    this.size += vertices.length * 4;
    this.polygons += vertices.length / (3 * 3);
};


ThreeGroup.prototype.addExtentedLineJob = function(data) {
    const gl = this.gl;

    const vertices = data.vertexBuffer;
    const normals = data.normalBuffer;

    const job = {};
    job.type = data['type'];


    switch(job.type) {
    case VTS_WORKER_TYPE_FLAT_LINE:  job.type = VTS_JOB_FLAT_TLINE;  break;
    case VTS_WORKER_TYPE_FLAT_RLINE:  job.type = VTS_JOB_FLAT_RLINE;  break;
    case VTS_WORKER_TYPE_PIXEL_LINE:  job.type = VTS_JOB_PIXEL_LINE;  break;
    case VTS_WORKER_TYPE_PIXEL_TLINE: job.type = VTS_JOB_PIXEL_TLINE; break;
    }

    job.color = this.convertColor(data['color']);
    job.zIndex = data['z-index'] + 256;
    job.clickEvent = data['click-event'];
    job.hoverEvent = data['hover-event'];
    job.hitable = data['hitable'];
    job.eventInfo = data['eventInfo'];
    job.enterEvent = data['enter-event'];
    job.leaveEvent = data['leave-event'];
    job.advancedHit = data['advancedHit'];
    job.widthByRatio = data['width-units'] == 'ratio',
    job.state = data['state'];
    job.center = data['center'];
    job.lod = data['lod'];
    job.lineWidth = data['line-width'];
    job.zbufferOffset = data['zbuffer-offset'];
    job.reduced = false;
    job.ready = true;
    job.bbox = this.bbox;

    let background;

    if (data['texture'] != null) {
        const texture = data['texture'];
        const bitmap = texture[0];
        job.texture = [this.renderer.getBitmap(bitmap['url'], bitmap['filter'] || 'linear', bitmap['tiled'] || false),
            texture[1], texture[2], texture[3], texture[4]];
        background = this.convertColor(data['background']);

        if (background[3] != 0) {
            job.background = background;
        }
    }

    switch(job.type) {
    case VTS_JOB_FLAT_TLINE:   job.program = (background[3] != 0) ? this.gpu.progTBLine : this.gpu.progTLine;  break;
    case VTS_JOB_FLAT_RLINE:   job.program = this.gpu.progRLine;  break;
    case VTS_JOB_PIXEL_LINE:   job.program = this.gpu.progLine3;  break;
    case VTS_JOB_PIXEL_TLINE:  job.program = (background[3] != 0) ? this.gpu.progTPBLine : this.gpu.progTPLine; break;
    }

    if (!job.program.isReady()) {
        return;
    }

    if (job.advancedHit) {
        switch(job.type) {
        case VTS_JOB_FLAT_TLINE:   job.program2 = this.gpu.progETLine;  break;
        case VTS_JOB_FLAT_RLINE:   job.program2 = this.gpu.progERLine;  break;
        case VTS_JOB_PIXEL_LINE:   job.program2 = this.gpu.progELine3;  break;
        case VTS_JOB_PIXEL_TLINE:  job.program2 = this.gpu.progETPLine; break;
        }

        if (!job.program2.isReady()) {
            return;
        }
    }

    //create vertex buffer
    job.vertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    job.vertexPositionBuffer.itemSize = 4;
    job.vertexPositionBuffer.numItems = vertices.length / 4;

    //create normal buffer
    job.vertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
    job.vertexNormalBuffer.itemSize = 4;
    job.vertexNormalBuffer.numItems = normals.length / 4;

    if (job.advancedHit) {
        const elements = data.elementBuffer;

        job.vertexElementBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexElementBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, elements, gl.STATIC_DRAW);
        job.vertexElementBuffer.itemSize = 1;
        job.vertexElementBuffer.numItems = elements.length;
    }

    this.jobs.push(job);

    this.size += vertices.length * 4 + normals.length * 4;
    this.polygons += vertices.length / (4 * 3);
};


ThreeGroup.prototype.processReduce = function(job) {
    if (job.reduce) {
        switch(job.reduce[0]) {
            case 'tilt':       job.reduce[0] = 1; break;
            case 'tilt-cos':   job.reduce[0] = 2; break;
            case 'tilt-cos2':  job.reduce[0] = 3; break;
            case 'scr-count':  job.reduce[0] = 4; break;
            case 'scr-count2': job.reduce[0] = 5; this.renderer.drawnGeodataTilesUsed = true; break;
            case 'scr-count3': job.reduce[0] = 6; this.renderer.drawnGeodataTilesUsed = true; break;
            case 'scr-count4': job.reduce[0] = 7; break;
            case 'scr-count5': job.reduce[0] = 8; break;
            case 'scr-count6': job.reduce[0] = 9; break;
            case 'scr-count7': job.reduce[0] = 10; break;
            case 'scr-count8': job.reduce[0] = 11; break;
        }

        job.reduce[5] = 0; //zero debug value
        job.reduce[6] = 0;
        job.reduce[7] = 0;

        if (job.reduce[0] >= 7 && job.reduce[0] <= 11) {

            if (job.reduce[0] == 10 || job.reduce[0] == 11) {
                job.reduce[1] = Math.abs(job.reduce[1]);
                job.reduce[3] = job.reduce[1] * job.reduce[2];
                job.reduce[2] = job.reduce[1];
                job.reduce[4] = 0;
            } else {
                job.reduce[2] = Math.abs(job.reduce[1]); //copy prominence for prom / dist support

                if (this.renderer.config.mapFeaturesReduceFactor >= 1) { // prom / dists
                    job.reduce[1] = job.reduce[2];
                } else {
                    if (job.reduce[0] == 9) {
                        job.reduce[1] = job.reduce[2];
                    } else {
                        job.reduce[1] = Math.floor((Math.log(job.reduce[2] * 500) / Math.log(1.0017)) + 5000);
                    }
                }
            }
        }
    }
};


ThreeGroup.prototype.addLineLabelJob = function(data) {
    const gl = this.gl;
    let singleBuffer;
    let singleBuffer2;
    let vertices;
    let texcoords;

    if (data.singleBuffer) {
        singleBuffer = data.singleBuffer;
        singleBuffer2 = data.singleBuffer2;
    } else {
        vertices = data.vertexBuffer;
        texcoords = data.texcoordsBuffer;
    }

    const job = {};
    job.type = VTS_JOB_LINE_LABEL;
    job.program = this.gpu.progText;
    job.color = this.convertColor(data['color']);
    job.color2 = this.convertColor(data['color2']);
    job.outline = data['outline'];
    job.zIndex = data['z-index'] + 256;
    job.visibility = data['visibility'];
    job.culling = data['culling'];
    job.clickEvent = data['click-event'];
    job.hoverEvent = data['hover-event'];
    job.enterEvent = data['enter-event'];
    job.leaveEvent = data['leave-event'];
    job.hitable = data['hitable'];
    job.eventInfo = data['eventInfo'];
    job.state = data['state'];
    job.center = data['center'];
    job.lod = data['lod'];
    job.labelPoints = data['labelPoints'];
    job.labelIndex = data['labelIndex'];
    job.labelSize = data['labelSize'];
    job.zbufferOffset = data['zbuffer-offset'];
    job.hysteresis = data['hysteresis'];
    job.noOverlap = data['noOverlap'];
    job.labelPointsBuffer = { id: -1, points: [], points2: [] },
    job.id = job.hysteresis ? job.hysteresis[2] : null;
    job.reduced = false;
    job.ready = true;
    job.bbox = this.bbox;
    job.reduce = data['reduce'];

    this.processReduce(job);

    job.files = data['files'] || [];
    const fonts = data['fonts'] || ['#default'];
    job.fonts = fonts;

    for (let i = 0, li = fonts.length; i < li; i++) {
        fonts[i] = this.renderer.fonts[fonts[i]];
    }

    job.program = this.gpu.progText2;

    if (!job.program.isReady()) {
        return;
    }

    if (singleBuffer) {

        job.singleBuffer = singleBuffer;
        job.singleBuffer2 = singleBuffer2;
        job.textVector = data['textVector'];
        this.polygons += (singleBuffer.length / 12) * 2;

    } else {
        //create vertex buffer
        job.vertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        job.vertexPositionBuffer.itemSize = 4;
        job.vertexPositionBuffer.numItems = vertices.length / 4;

        //create normal buffer
        job.vertexTexcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexTexcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
        job.vertexTexcoordBuffer.itemSize = 4;
        job.vertexTexcoordBuffer.numItems = texcoords.length / 4;

        this.size += vertices.length * 4 + texcoords.length * 4;
        this.polygons += vertices.length / (4 * 3);
    }

    this.jobs.push(job);
};


ThreeGroup.prototype.addIconJob = function(data, label, tile) {
    const gl = this.gl;

    const vertices = data.vertexBuffer;
    const texcoords = data.texcoordsBuffer;
    const origins = data.originBuffer;
    const singleBuffer = data.singleBuffer;
    const s = data['stick'];
    const f = 1.0/255;

    const job = { tile: tile };
    job.type = label ? VTS_JOB_LABEL : VTS_JOB_ICON;
    job.program = this.gpu.progIcon;
    job.color = this.convertColor(data['color']);
    job.zIndex = data['z-index'] + 256;
    job.visibility = data['visibility'];
    job.culling = data['culling'];
    job.clickEvent = data['click-event'];
    job.hoverEvent = data['hover-event'];
    job.enterEvent = data['enter-event'];
    job.leaveEvent = data['leave-event'];
    job.hitable = data['hitable'];
    job.eventInfo = data['eventInfo'];
    job.state = data['state'];
    job.center = data['center'];
    job.stick = [s[0], s[1], s[2], s[3]*f, s[4]*f, s[5]*f, s[6]*f, s[7]];
    job.lod = data['lod'];
    job.zbufferOffset = data['zbuffer-offset'];
    job.hysteresis = data['hysteresis'];
    job.noOverlap = data['noOverlap'];
    job.id = job.hysteresis ? job.hysteresis[2] : null;
    job.reduced = false;
    job.ready = true;
    job.reduce = data['reduce'];

    this.processReduce(job);

    if (!job.program.isReady()) {
        return;
    }

    if (label !== true) {
        const icon = data['icon'];
        job.texture = this.renderer.getBitmap(null, icon['filter'] || 'linear', icon['tiled'] || false, icon['hash'], true);
        job.files = [];
    } else {
        job.color2 = this.convertColor(data['color2']);
        job.outline = data['outline'];
        job.size = data['size'];
        job.origin = data['origin'];
        job.files = data['files'] || [];
        job.index = data['index'] || 0;
        const fonts = data['fonts'] || ['#default'];
        job.fonts = fonts;
        job.gamma = [job.outline[2] * 1.4142 / job.size, job.outline[3] * 1.4142 / job.size];

        if (job.origin) {
            job.origin = new Float32Array(job.origin);
        }

        for (let i = 0, li = fonts.length; i < li; i++) {
            fonts[i] = this.renderer.fonts[fonts[i]];
        }

        job.program = this.gpu.progIcon2;
    }

    if (job.visibility != null && !Array.isArray(job.visibility)) {
        job.visibility = [job.visibility];
    }

    if (singleBuffer) {
        job.singleBuffer = singleBuffer;
        this.polygons += 2;

    } else {
        //create vertex buffer
        job.vertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        job.vertexPositionBuffer.itemSize = 4;
        job.vertexPositionBuffer.numItems = vertices.length / 4;

        //create normal buffer
        job.vertexTexcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexTexcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
        job.vertexTexcoordBuffer.itemSize = 4;
        job.vertexTexcoordBuffer.numItems = texcoords.length / 4;

        //create origin buffer
        job.vertexOriginBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, job.vertexOriginBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, origins, gl.STATIC_DRAW);
        job.vertexOriginBuffer.itemSize = 3;
        job.vertexOriginBuffer.numItems = origins.length / 3;

        this.size += job.vertexPositionBuffer.numItems * 4 +
                      job.vertexOriginBuffer.numItems * 4 +
                      job.vertexTexcoordBuffer.numItems * 4;
        this.polygons += job.vertexPositionBuffer.numItems / (4 * 3);
    }


    if (this.subjobs) {
        this.subjobs.push(job);
    } else {
        if (this.vsjobs) {
            this.vsjobs.push(job);
        } else {
            this.jobs.push(job);
        }
    }

};


ThreeGroup.prototype.addPack = function() {
    if (!this.subjobs.length) {
        this.subjobs = null;
        return;
    }

    const job = {
        type : VTS_JOB_PACK,
        subjobs: this.subjobs,
        culling : 180,
        zIndex : 0,
        ready : true
    };

    //extract no overlap, remove it form subjobs
    for (let i = 0, li = job.subjobs.length; i < li; i++) {
        const subjob = job.subjobs[i];

        if (subjob.noOverlap) {

            if (!job.noOverlap) {
                job.noOverlap = subjob.noOverlap;
            } else {
                const o = job.noOverlap;
                const o2 = subjob.noOverlap;

                if (o2[0] < o[0]) o[0] = o2[0];
                if (o2[1] < o[1]) o[1] = o2[1];
                if (o2[2] > o[2]) o[2] = o2[2];
                if (o2[3] > o[3]) o[3] = o2[3];
            }

            subjob.noOverlap = null;
        }

        if (subjob.culling <= job.culling) {
            job.culling = subjob.culling;
            subjob.culling = 180;
        }

        if (subjob.visibility) {
            job.visibility = subjob.visibility;
            subjob.visibility = null;
        }

        if (subjob.stick) {
            job.stick = subjob.stick;
            subjob.stick = [0,0,0,255,255,255,255,0];
        }

        if (subjob.zIndex > job.zIndex) {
            job.zIndex = subjob.zIndex;
        }

        if (subjob.center) {
            job.center = subjob.center;
        }

        job.eventInfo = subjob.eventInfo;
        job.reduce = subjob.reduce;

        job.hysteresis = subjob.hysteresis;
        job.id = subjob.id;
    }

    if (this.vsjobs) {
        this.vsjobs.push(job);
    } else {
        this.jobs.push(job);
    }

    this.subjobs = null;
};


ThreeGroup.prototype.addVSPoint = function(data, tile){
    const job = { tile: tile };
    job.type = VTS_JOB_VSPOINT;
    job.zIndex = data['z-index'] + 256;
    job.visibility = data['visibility'];
    job.culling = data['culling'];
    job.hitable = false;
    job.eventInfo = data['eventInfo'];
    job.state = data['state'];
    job.center = data['center'];
    job.lod = data['lod'];
    job.hysteresis = data['hysteresis'];
    job.id = job.hysteresis ? job.hysteresis[2] : null;
    job.reduced = false;
    job.ready = true;
    job.reduce = data['reduce'];
    job.vswitch = [];

    this.vsjob = job;
};


ThreeGroup.prototype.storeVSJobs = function(data){
    this.vsjob.vswitch.push([data.viewExtent, this.vsjobs]);
    this.vsjobs = [];
};


ThreeGroup.prototype.addVSwitch = function(){
    if (this.vsjob) {
        this.jobs.push(this.vsjob);
    }

    this.vsjobs = null;
};

ThreeGroup.prototype.addMeshJob = function(data) {
    const job = {};

    job.type = VTS_JOB_MESH;
    job.path = data['path'];

    job.textures = [];

    job.resources = new MapResourceNode(this.renderer.core.map, null, null);

    if (job.path) {
        const stmp = job.path.split(".");
        if (stmp.length > 1) {
            stmp.pop();
            job.texturePath = stmp.join('.');
        }

        job.mesh = job.resources.getMesh(job.path, null);
    }

    this.jobs.push(job);
};


ThreeGroup.prototype.copyBuffer = function(buffer, source, index) {
    const tmp = new Uint8Array(buffer.buffer);
    tmp.set(new Uint8Array(source.buffer, index, buffer.byteLength));
    return buffer;
};


ThreeGroup.prototype.addRenderJob2 = function(buffer, index, tile, direct) {
    let data, str, length, type, view;

    if (direct) {
        type = direct.type;
        data = direct.data;
    } else {
        view = new DataView(buffer.buffer);
        type = buffer[index]; index += 1;

        if (type != VTS_WORKER_TYPE_PACK_BEGIN && type != VTS_WORKER_TYPE_PACK_END &&
            type != VTS_WORKER_TYPE_VSWITCH_BEGIN && type != VTS_WORKER_TYPE_VSWITCH_END && type != VTS_WORKER_TYPE_VSWITCH_STORE) {

            length = view.getUint32(index); index += 4;
            str = utils.unint8ArrayToString(new Uint8Array(buffer.buffer, index, length)); index+= length;
            data = JSON.parse(str);
        }
    }

    switch(type) {
        case VTS_WORKER_TYPE_POLYGON:
        case VTS_WORKER_TYPE_FLAT_LINE:
            data.type = type;
            length = view.getUint32(index); index += 4;
            data.vertexBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.vertexBuffer.byteLength;

            if (data['advancedHit']) {
                length = view.getUint32(index); index += 4;
                data.elementBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.elementBuffer.byteLength;
            }

            this.addLineJob(data);
            break;

        case VTS_WORKER_TYPE_FLAT_TLINE:
        case VTS_WORKER_TYPE_FLAT_RLINE:
        case VTS_WORKER_TYPE_PIXEL_LINE:
        case VTS_WORKER_TYPE_PIXEL_TLINE:
            data.type = type;
            length = view.getUint32(index); index += 4;
            data.vertexBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.vertexBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            data.normalBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.normalBuffer.byteLength;

            if (data['advancedHit']) {
                length = view.getUint32(index); index += 4;
                data.elementBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.elementBuffer.byteLength;
            }

            this.addExtentedLineJob(data);
            break;

        case VTS_WORKER_TYPE_LINE_LABEL:

            length = view.getUint32(index); index += 4;
            data.vertexBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.vertexBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            data.texcoordsBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.texcoordsBuffer.byteLength;
            this.addLineLabelJob(data);
            break;

        case VTS_WORKER_TYPE_LINE_LABEL2:

            length = view.getUint32(index); index += 4;
            data.singleBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.singleBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            data.singleBuffer2 = this.copyBuffer(new Float32Array(length), buffer, index); index += data.singleBuffer2.byteLength;
            this.addLineLabelJob(data);
            break;

        case VTS_WORKER_TYPE_ICON:
        case VTS_WORKER_TYPE_LABEL:

            length = view.getUint32(index); index += 4;
            data.singleBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.singleBuffer.byteLength;
            this.addIconJob(data, (type == VTS_WORKER_TYPE_LABEL), tile);
            break;

        case VTS_WORKER_TYPE_ICON2:
        case VTS_WORKER_TYPE_LABEL2:

            length = view.getUint32(index); index += 4;
            data.vertexBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.vertexBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            data.originBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.originBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            data.texcoordsBuffer = this.copyBuffer(new Float32Array(length), buffer, index); index += data.texcoordsBuffer.byteLength;
            this.addIconJob(data, (type == VTS_WORKER_TYPE_LABEL2), tile);
            break;

        case VTS_WORKER_TYPE_POINT_GEOMETRY:
        case VTS_WORKER_TYPE_LINE_GEOMETRY:

            length = view.getUint32(index); index += 4;
            data.geometryBuffer = this.copyBuffer(new Float64Array(length), buffer, index); index += data.originBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            data.indicesBuffer = this.copyBuffer(new Uint32Array(length), buffer, index); index += data.indicesBuffer.byteLength;
            length = view.getUint32(index); index += 4;
            this.addGeometry(data);
            break;

        case VTS_WORKER_TYPE_PACK_BEGIN:
            this.subjobs = []; index += 4;
            break;

        case VTS_WORKER_TYPE_PACK_END:
            this.addPack(); index += 4;
            break;

        case VTS_WORKER_TYPE_VSPOINT:
            this.addVSPoint(data, tile);
            break;

        case VTS_WORKER_TYPE_VSWITCH_BEGIN:
            this.vsjobs = []; this.vsjob = null; index += 4;
            break;

        case VTS_WORKER_TYPE_VSWITCH_END:
            this.addVSwitch(); index += 4;
            break;

        case VTS_WORKER_TYPE_VSWITCH_STORE:
            data = { viewExtent: view.getUint32(index) }; index += 4;
            this.storeVSJobs(data);
            break;

        case VTS_WORKER_TYPE_NODE_BEGIN:
            {
                const node = data;
                node.nodes = [];
                node.jobs = [];
                node.parent = this.currentNode;

                if (node.volume) {
                    const p = node.volume.points;
                    const points = [
                        p[0][0],p[0][1],p[0][2],
                        p[1][0],p[1][1],p[1][2],
                        p[2][0],p[2][1],p[2][2],
                        p[3][0],p[3][1],p[3][2],
                        p[4][0],p[4][1],p[4][2],
                        p[5][0],p[5][1],p[5][2],
                        p[6][0],p[6][1],p[6][2],
                        p[7][0],p[7][1],p[7][2]
                    ];

                    node.volume.points2 = points;
                }

                if (this.rootNode) {
                    this.currentNode.nodes.push(node);
                    this.currentNode = node;
                } else {
                    this.rootNode = node;
                    this.currentNode = node;

                    this.oldJobs = this.jobs;
                }

                this.jobs = node.jobs;
            }
            break;

        case VTS_WORKER_TYPE_NODE_END:

            if (this.currentNode.parent) {
                this.currentNode = this.currentNode.parent;
                this.jobs = this.currentNode.jobs;
            } else {
                this.currentNode = this.currentNode.parent;
                this.jobs = this.oldJobs;
            }

            break;

        case VTS_WORKER_TYPE_MESH:
            this.addMeshJob(data, tile);
            break;

        case VTS_WORKER_TYPE_LOAD_NODE:
            if(this.currentNode) {
                this.currentNode.path = data['path'];
            }
            break;

    }

    return index;
};


ThreeGroup.prototype.addRenderJob = function(data, tile) {
    switch(data['type']) {
    case 'polygon':
    case 'flat-line':     this.addLineJob(data); break;
    case 'flat-tline':
    case 'flat-rline':
    case 'pixel-line':
    case 'pixel-tline':    this.addExtentedLineJob(data); break;
    case 'line-label':     this.addLineLabelJob(data); break;
    case 'icon':           this.addIconJob(data); break;
    case 'label':          this.addIconJob(data, true, tile); break;
    case 'point-geometry': this.addGeometry(data); break;
    case 'line-geometry':  this.addGeometry(data); break;
    case 'pack-begin':     this.subjobs = []; break;
    case 'pack-end':       this.addPack(); break;
    case 'vspoint':        this.addVSPoint(data, tile); break;
    case 'vswitch-begin':  this.vsjobs = []; this.vsjob = null; break;
    case 'vswitch-store':  this.storeVSJobs(data); break;
    case 'vswitch-end':    this.addVSwitch(); break;
    case 'node-begin':     this.nodeBegin(); break;
    case 'node-end':       this.nodeEnd(); break;
    case 'mesh':           this.addMesh(); break;
    }
};

/*
function drawLineString(options, renderer) {
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

    color = [ color[0] * (1.0/255), color[1] * (1.0/255), color[2] * (1.0/255), color[3] * (1.0/255) ];

    renderer.gpu.draw.drawLineString(points, screenSpace, size, color, depthOffset, depthTest, blend, writeDepth, useState);
    return this;
}
*/

ThreeGroup.prototype.draw = function(mv, mvp, applyOrigin, tiltAngle, texelSize) {
    if (this.id != null) {
        if (this.renderer.layerGroupVisible[this.id] === false) {
            return;
        }
    }

    const renderer = this.renderer;
    const renderCounter = [[renderer.geoRenderCounter, mv, mvp, this]];
    const map = renderer.core.map;
    this.map = map;

    if (this.binPath) {
        if (this.octreeParser) {
            this.octreeParser.draw(mv, mvp, applyOrigin, tiltAngle, texelSize);
        }
    }

    if (applyOrigin) {
        const mvp2 = mat4.create();
        const mv2 = mat4.create();
        const pos = this.renderer.position;

        /*
        const transform = this.renderer.layerGroupTransform[this.id];

        if (transform != null) {
            origin = transform[1];
            origin = [origin[0] - pos[0], origin[1] - pos[1], origin[2]];
            mat4.multiply(math.translationMatrix(origin[0], origin[1], origin[2]), transform[0], mv2);
            mat4.multiply(mv, mv2, mv2);
        } else {*/
            let origin = this.origin;
            origin = [origin[0] - pos[0], origin[1] - pos[1], origin[2]];
            mat4.multiply(mv, math.translationMatrix(origin[0], origin[1], origin[2]), mv2);
        /*}*/

        mat4.multiply(mvp, mv2, mvp2);
        mv = mv2;
        mvp = mvp2;
    }

    const cameraPos = renderer.cameraPosition;
    const jobZBuffer = renderer.jobZBuffer;
    const jobZBufferSize = renderer.jobZBufferSize;
    //const jobZBuffer2 = renderer.jobZBuffer2;
    //const jobZBuffer2Size = renderer.jobZBuffer2Size;

    const onlyHitable = renderer.onlyHitLayers;

    for (let i = 0, li = this.jobs.length; i < li; i++) {
        const job = this.jobs[i];

        if ((job.type == VTS_JOB_ICON || job.type == VTS_JOB_LABEL) && job.visibility > 0) {
            const center = job.center;
            if (vec3.length([center[0]-cameraPos[0],
                center[1]-cameraPos[1],
                center[2]-cameraPos[2]]) > job.visibility) {
                continue;
            }
        }

        if (onlyHitable && !job.hitable) {
            continue;
        }

        job.mv = mv;
        job.mvp = mvp;
        job.renderCounter = renderCounter;
        job.tiltAngle = tiltAngle;
        job.texelSize = texelSize;

        const zIndex = job.zIndex;

        jobZBuffer[zIndex][jobZBufferSize[zIndex]] = job;
        jobZBufferSize[zIndex]++;
    }
};


export default ThreeGroup;
