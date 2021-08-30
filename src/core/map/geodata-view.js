
import {mat4 as mat4_} from '../utils/matrix';
import {math as math_} from '../utils/math';
import {utils as utils_} from '../utils/utils';
import MapOctree_ from './octree';
//import RenderGroup_ from '../renderer/group';
import MapGeodataProcessor_ from './geodata-processor/processor';

//get rid of compiler mess
const mat4 = mat4_, math = math_, utils = utils_;
const MapOctree = MapOctree_;
//const RenderGroup = RenderGroup_;
const MapGeodataProcessor = MapGeodataProcessor_;

const MapGeodataView = function(map, geodata, extraInfo) {
    this.map = map;
    this.stats = map.stats;
    this.geodata = geodata;
    this.gpu = this.map.renderer.gpu;
    this.renderer = this.map.renderer;
    this.gpuGroups = [];
    this.currentGpuGroup = null;
    this.tile = extraInfo.tile;
    this.surface = extraInfo.surface;

    if (!this.surface.geodataProcessor) {
        const processor = new MapGeodataProcessor(this, this.onGeodataProcessorMessage.bind(this));
        processor.setStylesheet(this.surface.stylesheet);
        this.surface.geodataProcessor = processor;
        this.map.geodataProcessors.push(processor);
    } else {
        if (this.surface.styleChanged) {
            this.surface.geodataProcessor.setStylesheet(this.surface.stylesheet);
            this.surface.styleChanged = false;
        }
    }

    this.geodataProcessor = this.surface.geodataProcessor;
    this.processing = false;
    this.statsCounter = 0;
    this.size = 0;
    this.killed = false;
    this.killedByCache = false;
    this.ready = false;
    this.isReady();
};


MapGeodataView.prototype.kill = function() {
    this.killed = true;
    this.geodata = null;
    this.killGeodataView(false);
};


MapGeodataView.prototype.killGeodataView = function(killedByCache) {
    this.killedByCache = killedByCache;

    for (let i = 0, li = this.gpuGroups.length; i < li; i++) {
        this.gpuGroups[i].kill();
    }

    this.gpuGroups = [];

    if (killedByCache !== true && this.gpuCacheItem != null) {
        this.map.gpuCache.remove(this.gpuCacheItem);
    }

    this.stats.gpuGeodata -= this.size;
    this.stats.graphsFluxGeodata[1][0]++;
    this.stats.graphsFluxGeodata[1][1] += this.size;

    this.ready = false;
    this.size = 0;
    this.gpuCacheItem = null;
};


MapGeodataView.prototype.processPackedCommands = function(buffer, index) {

    const maxIndex = buffer.byteLength;
    const maxTime = this.map.config.mapMaxGeodataProcessingTime;
    const view = new DataView(buffer.buffer);
    let t = performance.now(), length, str, data;

    do {

        const command = buffer[index]; index += 1;

        switch(command) {
            case VTS_WORKERCOMMAND_GROUP_BEGIN:
                index += 1;
                length = view.getUint32(index); index += 4;
                str = utils.unint8ArrayToString(new Uint8Array(buffer.buffer, index, length)); index+= length;
                data = JSON.parse(str);

                this.currentGpuGroup = this.renderer.gpu.createRenderGroup(data['id'], data['bbox'], data['origin']);
                this.gpuGroups.push(this.currentGpuGroup);

                //console.log('VTS_WORKERCOMMAND_GROUP_BEGIN ' + (this.tile ? JSON.stringify(this.tile.id) : '[free]'));
                break;

            case VTS_WORKERCOMMAND_GROUP_END:
                this.size += this.currentGpuGroup.size; index += 1 + 4;
                //console.log('VTS_WORKERCOMMAND_GROUP_END ' + (this.tile ? JSON.stringify(this.tile.id) : '[free]'));
                break;

            case VTS_WORKERCOMMAND_ADD_RENDER_JOB:
                index = this.currentGpuGroup.addRenderJob2(buffer, index, this.tile);
                break;

            case VTS_WORKERCOMMAND_ALL_PROCESSED:
                this.map.markDirty();
                this.gpuCacheItem = this.map.gpuCache.insert(this.killGeodataView.bind(this, true), this.size);

                this.stats.gpuGeodata += this.size;
                this.stats.graphsFluxGeodata[0][0]++;
                this.stats.graphsFluxGeodata[0][1] += this.size;
                this.ready = true;
                this.processing = false;

                //console.log('VTS_WORKERCOMMAND_ALL_PROCESSED ' + (this.tile ? JSON.stringify(this.tile.id) : '[free]'));

                index += 1 + 4;
                break;
        }

        if ((performance.now() - t) > maxTime) {
            if (index < maxIndex) {
                return index;
            }
        }

    } while(index < maxIndex);


    this.stats.renderBuild += performance.now() - t;

    return -1;
};


MapGeodataView.prototype.onGeodataProcessorMessage = function(command, message, task) {
    if (this.killed || this.killedByCache){
        return;
    }

    switch (command) {

    case 'addPackedCommands':

        //console.log('pack size:' + message['buffer'].byteLength);

        if (task) {
            const index = this.processPackedCommands(message['buffer'], message.index);

            if (index < 0) {
                this.map.markDirty();
                //console.log('addPackedCommandsB ' + (this.tile ? JSON.stringify(this.tile.id) : '[free]'));
            } else {
                //console.log('addPackedCommandsC ' + (this.tile ? JSON.stringify(this.tile.id) : '[free]'));
                message.index = index;
                return -123;
            }

        } else {
            message.index = 0;
            this.map.markDirty();
            this.map.addProcessingTask2(this.onGeodataProcessorMessage.bind(this, command, message, true));

            //console.log('addPackedCommandsA ' + (this.tile ? JSON.stringify(this.tile.id) : '[free]'));
        }

        break;

    case 'ready':

        if (this.geodataProcessor.processCounter > 0) {
            this.geodataProcessor.processCounter--;

            if (this.geodataProcessor.processCounter > 0) {
                this.map.markDirty();
                //console.log('ready2 ' + (this.tile ? JSON.stringify(this.tile.id) : '[free]'));

                break;
            }
        }

        if (message['geodata']) {
            this.geodata.geodata = message['geodata'];
        }

        this.geodataProcessor.busy = false;
        this.map.markDirty();
        //console.log('ready ' + (this.tile ? JSON.stringify(this.tile.id) : '[free]'));

            //this.ready = true;
        break;
    }
};


MapGeodataView.prototype.directParseNode = function(node, lod) {

    this.currentGpuGroup.addRenderJob2(null, null, this.tile, { type: VTS_WORKER_TYPE_NODE_BEGIN, data: {'volume': node.volume, 'precision': node.precision, 'tileset': node.tileset }});

    const meshes = node['meshes'] || [];
    let i, li;

    //loop elements
    for (i = 0, li = meshes.length; i < li; i++) {
        this.currentGpuGroup.addRenderJob2(null, null, this.tile, { type: VTS_WORKER_TYPE_MESH, data: { 'path':meshes[i] } });
    }

    const nodes = node['nodes'] || [];

    for (i = 0, li = nodes.length; i < li; i++) {
        this.directParseNode(nodes[i], lod+1);
    }

    const loadNodes = node['loadNodes'] || [];

    for (i = 0, li = loadNodes.length; i < li; i++) {
        this.currentGpuGroup.addRenderJob2(null, null, this.tile, { type: VTS_WORKER_TYPE_LOAD_NODE, data: { 'path':loadNodes[i] } });
    }

    this.currentGpuGroup.addRenderJob2(null, null, this.tile, { type: VTS_WORKER_TYPE_NODE_END, data: {} });

};


MapGeodataView.prototype.directParse = function(data) {
    if (!data) {
        return;
    }

    const nodes = data['nodes'] || [];

    for (let i = 0, li = nodes.length; i < li; i++) {

        //VTS_WORKERCOMMAND_GROUP_BEGIN
        this.currentGpuGroup = this.renderer.gpu.createRenderGroup(null /*data['id']*/, null /*data['bbox']*/, null /*data['origin']*/);

        this.gpuGroups.push(this.currentGpuGroup);

        this.directParseNode(nodes[i], 0);

        //VTS_WORKERCOMMAND_GROUP_END:
        this.size += this.currentGpuGroup.size;
    }
};


MapGeodataView.prototype.directBinParse = function(path) {
    this.currentGpuGroup = this.renderer.gpu.createRenderGroup(null /*data['id']*/, null /*data['bbox']*/, null /*data['origin']*/);
    this.gpuGroups.push(this.currentGpuGroup);
    this.currentGpuGroup.binPath = path;
    this.currentGpuGroup.octreeParser = new MapOctree(null /*data['id']*/, null /*data['bbox']*/, null /*data['origin']*/, this.gpu, this.renderer);
    this.currentGpuGroup.octreeParser.binPath = path;
};


MapGeodataView.prototype.isReady = function(doNotLoad, priority, doNotCheckGpu) {
    if (this.killed) {
        return false;
    }

    const doNotUseGpu = (this.map.stats.gpuRenderUsed >= this.map.draw.maxGpuUsed);
    doNotLoad = doNotLoad || doNotUseGpu;

    if (!this.ready && !this.processing && !doNotLoad && this.surface.stylesheet.isReady()) {
        if (this.geodata.isReady(doNotLoad, priority, doNotCheckGpu, this.surface.options.fastParse) && this.geodataProcessor.isReady()) {

            if (this.surface.options.fastParse) {

                if (typeof this.geodata.geodata === 'object') { //use geodata directly
                    if (this.geodata.geodata['binPath']) {
                        this.directBinParse(this.geodata.geodata['binPath']);
                    } else {
                        this.directParse(this.geodata.geodata);
                    }
                } else {
                    this.directParse(JSON.parse(this.geodata.geodata));
                }

                this.map.markDirty();
                this.ready = true;
            } else {
                const geodata = this.geodata.geodata;

                this.processing = true;
                this.killedByCache = false;
                this.geodataProcessor.setListener(this.onGeodataProcessorMessage.bind(this));

                if (this.map.config.mapGeodataBinaryLoad && (typeof geodata !== 'string')) {
                    this.geodataProcessor.sendCommand('processGeodataRaw', geodata, this.tile, (window.devicePixelRatio || 1), [geodata]);
                } else {
                    this.geodataProcessor.sendCommand('processGeodata', geodata, this.tile, (window.devicePixelRatio || 1));
                }

                this.geodataProcessor.busy = true;
                //console.log('processGeodata ' + (this.tile ? JSON.stringify(this.tile.id) : '[free]'));
            }
        }
    }

    if (!doNotLoad && this.gpuCacheItem) {
        this.map.gpuCache.updateItem(this.gpuCacheItem);
    }

    return this.ready;
};


MapGeodataView.prototype.getWorldMatrix = function(bbox, geoPos, matrix) {
    let m = matrix;

    if (m != null) {
        m[0] = 1; m[1] = 0; m[2] = 0; m[3] = 0;
        m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
        m[8] = 0; m[9] = 0; m[10] = 1; m[11] = 0;
        m[12] = bbox.min[0] - geoPos[0]; m[13] = bbox.min[1] - geoPos[1]; m[14] = bbox.min[2] - geoPos[2]; m[15] = 1;
    } else {
        m = mat4.create();

        mat4.multiply( math.translationMatrix(bbox.min[0] - geoPos[0], bbox.min[1] - geoPos[1], bbox.min[2] - geoPos[2]),
                       math.scaleMatrix(1, 1, 1), m);
    }

    return m;
};


MapGeodataView.prototype.draw = function(cameraPos) {
    if (this.ready) {

        const renderer = this.renderer;
        const tiltAngle = this.tile ? Math.abs(this.tile.tiltAngle) : renderer.cameraTiltFator;
        const useSuperElevation = renderer.useSuperElevation;

        for (let i = 0, li = this.gpuGroups.length; i < li; i++) {
            const group = this.gpuGroups[i];
            group.drawChannel = this.map.draw.drawChannel;

            if (group.rootNode || group.binPath) {
                group.draw(null /*mv*/, null /*mvp*/, null, tiltAngle, (this.tile ? this.tile.texelSize : 1));
                continue;
            }

            if (!(group.jobs.length || group.rootNode)) {
                continue; //TODO: remove empty groups
            }

            const mvp = group.mvp;
            const mv = group.mv;
            const mtmp = mvp; //use it as tmp matrix

            if (useSuperElevation) {
                //mat4.set(renderer.camera.getModelviewFMatrix(), mv);
                mat4.multiply(renderer.camera.getModelviewFMatrix(), this.getWorldMatrix(group.bbox, cameraPos, mtmp), mv);
            } else {
                mat4.multiply(renderer.camera.getModelviewFMatrix(), this.getWorldMatrix(group.bbox, cameraPos, mtmp), mv);
            }

            const proj = renderer.camera.getProjectionFMatrix();
            mat4.multiply(proj, mv, mvp);

            group.draw(mv, mvp, null, tiltAngle, (this.tile ? this.tile.texelSize : 1));

            this.stats.drawnFaces += group.polygons;
            this.stats.drawCalls += group.jobs.length;
        }

        if (this.statsCoutner != this.stats.counter) {
            this.statsCoutner = this.stats.counter;
            this.stats.gpuRenderUsed += this.size;
        }
    }
    return this.ready;
};

//MapGeodataView.prototype.getSize = function() {
    //return this.size;
//};

export default MapGeodataView;
