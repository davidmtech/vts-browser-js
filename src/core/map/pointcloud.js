
import {math as math_} from '../utils/math';
import {mat4 as mat4_} from '../utils/matrix';
import {utils as utils_} from '../utils/utils';
import BBox_ from '../renderer/bbox';
//import GpuProgram_ from '../renderer/gpu/program';
//import GpuShaders_ from '../renderer/gpu/shaders';
//import GpuPointcloud_ from '../renderer/gpu/pointcloud';

//get rid of compiler mess
const mat4 = mat4_;
const math = math_;
const BBox = BBox_;
const utils = utils_;
//const GpuProgram = GpuProgram_;
//const GpuShaders = GpuShaders_;
//const GpuPointcloud = GpuPointcloud_;

const MapPointCloud = function(map, url, tile, offset, size) {
    this.generateLines = true;
    this.map = map;
    this.stats = map.stats;
    this.mapLoaderUrl  = url;
    this.rangeOffset = offset;
    this.rangeSize = size;
    this.tile = tile; // used only for stats

    this.bbox = new BBox();
    this.size = 0;
    this.gpuSize = 0;
    this.fileSize = 0;
    this.faces = 0;

    this.cacheItem = null;  //store killSubcloudes
    this.gpuCacheItem = null; //store killGpuSubclouds

    this.loadState = 0;
    this.loadErrorTime = null;
    this.loadErrorCounter = 0;

    this.mBuffer = new Float32Array(16);
    this.mBuffer2 = new Float32Array(16);
    this.vBuffer = new Float32Array(4);

    this.subclouds = [];
    this.gpuSubclouds = [];
    this.subcloudsKilled = false;
};


MapPointCloud.prototype.kill = function() {
    this.bbox = null;
    this.killSubclouds();
    this.killGpuSubcloud();
};


MapPointCloud.prototype.killSubclouds = function(killedByCache) {
    for (let i = 0, li = this.subclouds.length; i < li; i++) {
        this.subclouds[i].kill();
    }
    //this.subclouds = [];
    this.subcloudsKilled = true;

    if (killedByCache !== true && this.cacheItem) {
        this.map.resourcesCache.remove(this.cacheItem);
        //this.tile.validate();
    }

    if (this.gpuSubclouds.length == 0) {
        this.loadState = 0;
    }

    this.cacheItem = null;
};


MapPointCloud.prototype.killGpuSubclouds = function(killedByCache) {
    let size = 0, i, li;
    for (i = 0, li = this.gpuSubclouds.length; i < li; i++) {
        this.gpuSubclouds[i].kill();
        size += this.gpuSubclouds[i].getSize();
    }

    if (li > 0) {
        this.stats.gpuMeshes -= size;
        this.stats.graphsFluxMesh[1][0]++;
        this.stats.graphsFluxMesh[1][1] += size;
    }

    this.gpuSubclouds = [];

    if (killedByCache !== true && this.gpuCacheItem) {
        this.map.gpuCache.remove(this.gpuCacheItem);
    }

    if (this.subcloudsKilled) {
        this.loadState = 0;
    }

    this.gpuCacheItem = null;
};


MapPointCloud.prototype.isReady = function(doNotLoad, priority, doNotCheckGpu) {
    const doNotUseGpu = (this.map.stats.gpuRenderUsed >= this.map.draw.maxGpuUsed);
    doNotLoad = doNotLoad || doNotUseGpu;

    if (this.loadState == 2) { //loaded
        if (this.cacheItem) {
            this.map.resourcesCache.updateItem(this.cacheItem);
        }

        if (doNotCheckGpu) {
            return true;
        }

        if (this.gpuSubclouds.length == 0) {
            if (this.map.stats.gpuRenderUsed >= this.map.draw.maxGpuUsed) {
                return false;
            }

            if (doNotUseGpu) {
                return false;
            }

            const t = performance.now();
            this.buildGpuSubclouds();
            this.stats.renderBuild += performance.now() - t;
        }

        if (!doNotLoad && this.gpuCacheItem) {
            this.map.gpuCache.updateItem(this.gpuCacheItem);
        }
        return true;
    } else {
        if (this.loadState == 0) {
            if (doNotLoad) {
                //remove from queue
                //if (this.mapLoaderUrl) {
                  //  this.map.loader.remove(this.mapLoaderUrl);
                //}
            } else {
                //not loaded
                //add to loading queue or top position in queue
                this.scheduleLoad(priority);
            }
        } else if (this.loadState == 3) { //loadError
            if (this.loadErrorCounter <= this.map.config.mapLoadErrorMaxRetryCount &&
                performance.now() > this.loadErrorTime + this.map.config.mapLoadErrorRetryTime) {

                this.scheduleLoad(priority);
            }
        } //else load in progress
    }

    return false;
};


MapPointCloud.prototype.scheduleLoad = function(priority) {
    this.map.loader.load(this.mapLoaderUrl, this.onLoad.bind(this), priority, this.tile, 'pointcloud');
};


MapPointCloud.prototype.onLoad = function(url, onLoaded, onError) {
    this.mapLoaderCallLoaded = onLoaded;
    this.mapLoaderCallError = onError;

    this.map.loader.processLoadBinary(url, this.onLoaded.bind(this), this.onLoadError.bind(this), null, 'pointcloud', { offset: this.rangeOffset, size: this.rangeSize });
    this.loadState = 1;
};


MapPointCloud.prototype.onLoadError = function() {
    if (this.map.killed){
        return;
    }

    this.loadState = 3;
    this.loadErrorTime = performance.now();
    this.loadErrorCounter ++;

    //make sure we try to load it again
    if (this.loadErrorCounter <= this.map.config.mapLoadErrorMaxRetryCount) {
        setTimeout((function(){ if (!this.map.killed) { this.map.markDirty(); } }).bind(this), this.map.config.mapLoadErrorRetryTime);
    }

    this.mapLoaderCallError();
};


MapPointCloud.prototype.onLoaded = function(data, task, direct) {
    if (this.map.killed){
        return;
    }

    if (!task) {
        //this.map.stats.renderBuild > this.map.config.mapMaxProcessingTime) {
        this.map.markDirty();
        this.map.addProcessingTask(this.onLoaded.bind(this, data, true, direct));
        return;
    }

    const t = performance.now();

    if (direct) {
        this.parseWorkerData(data);
    } else {
        this.fileSize = data.byteLength;
        const stream = {data: new DataView(data), buffer:data, index:0};
        this.parseMapPointCloud(stream);
    }

    this.map.stats.renderBuild += performance.now() - t;

    this.subcloudsKilled = false;

    this.cacheItem = this.map.resourcesCache.insert(this.killSubclouds.bind(this, true), this.size);

    this.map.markDirty();
    this.loadState = 2;
    this.loadErrorTime = null;
    this.loadErrorCounter = 0;
    this.mapLoaderCallLoaded();
};


// Returns RAM usage in bytes.
//MapPointCloud.prototype.getSize = function () {
  //  return this.size;
//};

//MapPointCloud.prototype.fileSize = function () {
    //return this.fileSize;
//};

MapPointCloud.prototype.parseMapPointCloud = function (stream) {

    //this.killSubclouds(); //just in case

    //parase header
    const streamData = stream.data;
    let magic = '';

    if (streamData.length < 2) {
        return false;
    }

    magic += String.fromCharCode(streamData.getUint8(stream.index, true)); stream.index += 1;
    magic += String.fromCharCode(streamData.getUint8(stream.index, true)); stream.index += 1;

    if (magic != 'pc') {
        return false;
    }

    this.version = streamData.getUint16(stream.index, true); stream.index += 2;

    const jsonSize = streamData.getUint32(stream.index, true); stream.index += 4;

    let json = utils.unint8ArrayToString(new Uint8Array(streamData.buffer, stream.index, jsonSize));
    stream.index += jsonSize;

    try {
        json = JSON.parse(json);
        // eslint-disable-next-line
    } catch (e) {
    }

    const headerSize = jsonSize + 2 + 2 + 4;

    const features = json['features'];
    const attributes = json['attributes'];

    if (!features || features.length < 1) {
        return false;
    }

    if (!attributes || attributes.length < 1) {
        return false;
    }

    for (let i = 0, li = features.length; i < li; i++) {
        const feature = features[i];

        const attribute = attributes[feature['attributes']];

        if (!attribute) {
            continue;
        }

        const subcloud = {};

        let offset = feature['offset'] + headerSize;
        const size = feature['size'];

        subcloud.size = size;

        if('color' in attribute) {
            switch(attribute['color']){
                case 0: //rgb888
                    subcloud.colors = new Uint8Array(streamData.buffer, offset, size * 3);
                    offset += size*3;
                    break;
            }
        }

        if('position' in attribute) {
            switch(attribute['position']){
                case 0: // xyz uint8
                    subcloud.vertices = new Uint8Array(streamData.buffer, offset, size * 3);
                    offset += size*3;
                    break;
            }
        }

        this.addSubcloud(subcloud);
    }
};


MapPointCloud.prototype.addSubcloud = function(subcloud) {
    this.subclouds.push(subcloud);
    this.size += subcloud.size * 3 * 2;
    this.points += subcloud.size;
};


MapPointCloud.prototype.buildGpuSubclouds = function() {
    let size = 0;
    this.gpuSubclouds = new Array(this.subclouds.length);

    const renderer = this.map.renderer;

    for (let i = 0, li = this.subclouds.length; i < li; i++) {
        const subcloud = this.subclouds[i];

        this.gpuSubclouds[i] = new GpuPointcloud(renderer.gpu, { vertices: subcloud.vertices, colors: subcloud.colors }, subcloud.size, this.map.core, true);
    }

    this.stats.gpuMeshes += size;
    this.stats.graphsFluxMesh[0][0]++;
    this.stats.graphsFluxMesh[0][1] += size;

    this.gpuCacheItem = this.map.gpuCache.insert(this.killGpuSubclouds.bind(this, true), size);
    this.gpuSize = size;

    //console.log("build: " + this.stats.counter + "   " + this.mapLoaderUrl);
};

MapPointCloud.prototype.getWorldMatrix = function(geoPos, matrix) {
    // Note: the current camera geographic position (geoPos) is not necessary
    // here, in theory, but for numerical stability (OpenGL ES is float only)
    // we get rid of the large UTM numbers in the following subtractions. The
    // camera effectively stays in the position [0,0] and the tiles travel
    // around it. (The Z coordinate is fine and is not handled in this way.)

    let m = matrix;

    if (m) {
        m[0] = this.transform[3]; m[1] = 0; m[2] = 0; m[3] = 0;
        m[4] = 0; m[5] = this.transform[3]; m[6] = 0; m[7] = 0;
        m[8] = 0; m[9] = 0; m[10] = this.transform[3]; m[11] = 0;
        m[12] = this.transform[0] - geoPos[0]; m[13] = this.transform[1] - geoPos[1]; m[14] = this.transform[2] - geoPos[2]; m[15] = 1;
    } else {
        m = mat4.create();

        mat4.multiply( math.translationMatrix(this.bbox.min[0] - geoPos[0], this.bbox.min[1] - geoPos[1], this.bbox.min[2] - geoPos[2]),
                       math.scaleMatrix(this.bbox.side(0), this.bbox.side(1), this.bbox.side(2)), m);
    }

    return m;
};

// eslint-disable-next-line
MapPointCloud.prototype.drawSubcloud = function (cameraPos, index, texture, type, alpha, layer, surface, splitMask, splitSpace) {
    const renderer = this.map.renderer;

    if (!this.gpuSubclouds[index] && this.subclouds[index] && !this.subclouds[index].killed) {
        this.gpuSubclouds[index] = new GpuPointcloud(renderer.gpu, { vertices: this.subclouds[index].vertices, colors: this.subclouds[index].colors }, this.subclouds[index].size, this.map.core, true);
    }

    const subcloud = this.subclouds[index];
    const gpuSubcloud = this.gpuSubclouds[index];

    if (!gpuSubcloud) {
        return;
    }

    const program = renderer.gpu.progPCloud;

    const mv = this.mBuffer, m = this.mBuffer2; //, mvp = this.vBuffer;

    mat4.multiply(renderer.camera.getModelviewFMatrix(), this.getWorldMatrix(cameraPos, m), mv);

    renderer.gpu.useProgram(program, ['aPosition', 'aColor'], null /*gpuMask*/);

    const proj = renderer.camera.getProjectionMatrix();
    mat4.multiply(proj, mv, m);

    program.setMat4('uMVP', m);


    gpuSubcloud.draw(program, 'aPosition', 'aColor');

    this.stats.drawnFaces += subcloud.size;
    this.stats.drawCalls ++;
};

MapPointCloud.prototype.draw = function (cameraPos, splitMask, splitSpace) {

    for (let i = 0, li = this.subclouds.length; i < li; i++) {
        this.drawSubcloud(cameraPos, i, splitMask, splitSpace);
    }

};

export default MapPointCloud;
