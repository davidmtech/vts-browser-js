
//import {mat4 as mat4_} from '../utils/matrix';
//import {utils as utils_} from '../utils/utils';
import MapSubmesh_ from './submesh';
import BBox_ from '../renderer/bbox';

//get rid of compiler mess
//const mat4 = mat4_;
const BBox = BBox_;
const MapSubmesh = MapSubmesh_;
//const utils = utils_;


const MapMesh = function(map, url, tile) {
    this.generateLines = true;
    this.map = map;
    this.stats = map.stats;
    this.mapLoaderUrl  = url;
    this.tile = tile; // used only for stats
    this.use16bit = map.config.map16bitMeshes;

    this.bbox = new BBox();
    this.size = 0;
    this.gpuSize = 0;
    this.fileSize = 0;
    this.faces = 0;

    this.cacheItem = null;  //store killSubmeshes
    this.gpuCacheItem = null; //store killGpuSubmeshes

    this.loadState = 0;
    this.loadErrorTime = null;
    this.loadErrorCounter = 0;

    this.mBuffer = new Float32Array(16);
    this.mBuffer2 = new Float32Array(16);
    this.vBuffer = new Float32Array(4);

    this.submeshes = [];
    this.gpuSubmeshes = [];
    this.submeshesKilled = false;

};


MapMesh.prototype.kill = function() {
    this.bbox = null;
    this.killSubmeshes();
    this.killGpuSubmeshes();
};


MapMesh.prototype.killSubmeshes = function(killedByCache) {
    for (let i = 0, li = this.submeshes.length; i < li; i++) {
        this.submeshes[i].kill();
    }
    //this.submeshes = [];
    this.submeshesKilled = true;

    if (killedByCache !== true && this.cacheItem) {
        this.map.resourcesCache.remove(this.cacheItem);
        //this.tile.validate();
    }

    if (this.gpuSubmeshes.length == 0) {
        this.loadState = 0;
    }

    this.cacheItem = null;
};


MapMesh.prototype.killGpuSubmeshes = function(killedByCache) {
    let size = 0, i, li;
    for (i = 0, li = this.gpuSubmeshes.length; i < li; i++) {

        if (this.map.renderer.device === VTS_DEVICE_THREE) {
            this.gpuSubmeshes[i].geometry.dispose();
        } else {
            this.gpuSubmeshes[i].kill();
        }

        size += this.gpuSubmeshes[i].gpuSize;
    }

    if (li > 0) {
        this.stats.gpuMeshes -= size;
        this.stats.graphsFluxMesh[1][0]++;
        this.stats.graphsFluxMesh[1][1] += size;
    }

    this.gpuSubmeshes = [];

    if (killedByCache !== true && this.gpuCacheItem) {
        this.map.gpuCache.remove(this.gpuCacheItem);
        //this.tile.validate();
    }

    //console.log("kill: " + this.stats.counter + "   " + this.mapLoaderUrl);

//    if (this.submeshes.length == 0) {
    if (this.submeshesKilled) {
        this.loadState = 0;
    }

    this.gpuCacheItem = null;
};


MapMesh.prototype.isReady = function(doNotLoad, priority, doNotCheckGpu) {
    let doNotUseGpu = (this.map.stats.gpuRenderUsed >= this.map.draw.maxGpuUsed);
    doNotLoad = doNotLoad || doNotUseGpu;

    //if (doNotUseGpu) {
      //  doNotUseGpu = doNotUseGpu;
    //}

    //if (this.mapLoaderUrl == "https://cdn.vts.com/mario/proxy/melown2015/surface/vts/cz10/12-1107-688.bin?0") {
      //  this.mapLoaderUrl = this.mapLoaderUrl;
    //}

    if (this.loadState == 2) { //loaded
        if (this.cacheItem) {
            this.map.resourcesCache.updateItem(this.cacheItem);
        }

        if (doNotCheckGpu) {
            return true;
        }

        if (this.gpuSubmeshes.length == 0) {
            if (this.map.stats.gpuRenderUsed >= this.map.draw.maxGpuUsed) {
                return false;
            }

            /*if (this.stats.renderBuild > this.map.config.mapMaxProcessingTime) {
                this.map.markDirty();
                return false;
            }*/

            if (doNotUseGpu) {
                return false;
            }

            let t = performance.now();
            this.buildGpuSubmeshes();
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


MapMesh.prototype.scheduleLoad = function(priority) {
    if (!this.mapLoaderUrl) {
        this.mapLoaderUrl = this.map.url.makeUrl(this.tile.resourceSurface.meshUrl, {lod:this.tile.id[0], ix:this.tile.id[1], iy:this.tile.id[2] });
    }

    this.map.loader.load(this.mapLoaderUrl, this.onLoad.bind(this), priority, this.tile, 'mesh');
};


MapMesh.prototype.onLoad = function(url, onLoaded, onError) {
    this.mapLoaderCallLoaded = onLoaded;
    this.mapLoaderCallError = onError;

    this.map.loader.processLoadBinary(url, this.onLoaded.bind(this), this.onLoadError.bind(this), null, 'mesh');
    this.loadState = 1;
};


MapMesh.prototype.onLoadError = function() {
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


MapMesh.prototype.onLoaded = function(data, task, direct) {
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
        this.parseMapMesh(stream);
    }

    this.map.stats.renderBuild += performance.now() - t;

    this.submeshesKilled = false;

    this.cacheItem = this.map.resourcesCache.insert(this.killSubmeshes.bind(this, true), this.size);

    this.map.markDirty();
    this.loadState = 2;
    this.loadErrorTime = null;
    this.loadErrorCounter = 0;
    this.mapLoaderCallLoaded();
};


// Returns RAM usage in bytes.
//MapMesh.prototype.getSize = function () {
  //  return this.size;
//};

//MapMesh.prototype.fileSize = function () {
    //return this.fileSize;
//};


MapMesh.prototype.parseWorkerData = function (data) {
    this.faces = data['faces'];
    this.gpuSize = data['gpuSize'];
    this.meanUndulation = data['meanUndulation'];
    this.numSubmeshes = data['numSubmeshes'];
    this.size = data['size'];
    this.version = data['version'];
    this.submeshes = [];

    const submeshes = data['submeshes'];

    for (let i = 0, li = submeshes.length; i < li; i++) {
        const submesh = new MapSubmesh(this);
        const submeshData = submeshes[i];

        submesh.bbox.min = submeshData['bboxMin'];
        submesh.bbox.max = submeshData['bboxMax'];
        submesh.externalUVs = submeshData['externalUVs'];
        submesh.faces = submeshData['faces'];
        submesh.flags = submeshData['flags'];
        submesh.gpuSize = submeshData['gpuSize'];
        submesh.indices = submeshData['indices'];
        submesh.internalUVs = submeshData['internalUVs'];
        submesh.size = submeshData['size'];
        submesh.surfaceReference = submeshData['surfaceReference'];
        submesh.textureLayer = submeshData['textureLayer'];
        submesh.textureLayer2 = submeshData['textureLayer2'];
        submesh.vertices = submeshData['vertices'];

        this.submeshes.push(submesh);
    }

    this.bbox.updateMaxSize();
};

MapMesh.prototype.parseMapMesh = function (stream) {
/*
    struct MapMesh {
        struct MapMeshHeader {
            char magic[2];                // letters "ME"
            ushort version;               // currently 1
            double meanUndulation;        // read more about undulation below
            ushort numSubmeshes;          // number of submeshes
        } header;
        struct Submesh submeshes [];      // array of submeshes, size of array is defined by numSubmeshes property
    };
*/
    this.killSubmeshes(); //just in case

    //parase header
    const streamData = stream.data;
    let magic = '';

    if (streamData.length < 2) {
        return false;
    }

    magic += String.fromCharCode(streamData.getUint8(stream.index, true)); stream.index += 1;
    magic += String.fromCharCode(streamData.getUint8(stream.index, true)); stream.index += 1;

    if (magic != 'ME') {
        return false;
    }

    this.version = streamData.getUint16(stream.index, true); stream.index += 2;

    if (this.version > 3) {
        return false;
    }

    //if (this.version >= 3) {
    stream.uint8Data = new Uint8Array(stream.buffer);
    //}

    this.meanUndulation = streamData.getFloat64(stream.index, true); stream.index += 8;
    this.numSubmeshes = streamData.getUint16(stream.index, true); stream.index += 2;

    this.submeshes = [];
    this.gpuSize = 0;
    this.faces = 0;

    for (let i = 0, li = this.numSubmeshes; i < li; i++) {
        const submesh = new MapSubmesh(this, stream);
        if (submesh.valid) {
            this.submeshes.push(submesh);
            this.size += submesh.getSize();
            this.faces += submesh.faces;

            //aproximate size
            this.gpuSize += submesh.getSize();
        }
    }

    this.numSubmeshes = this.submeshes.length;
};


MapMesh.prototype.addSubmesh = function(submesh) {
    this.submeshes.push(submesh);
    this.size += submesh.size;
    this.faces += submesh.faces;
};


MapMesh.prototype.buildGpuSubmeshes = function() {
    let size = 0;
    this.gpuSubmeshes = new Array(this.submeshes.length);

    for (let i = 0, li = this.submeshes.length; i < li; i++) {
        this.gpuSubmeshes[i] = this.submeshes[i].buildGpuMesh();
        this.gpuSubmeshes[i].gpuSize = this.submeshes[i].size;
        size += this.gpuSubmeshes[i].gpuSize;
    }

    this.stats.gpuMeshes += size;
    this.stats.graphsFluxMesh[0][0]++;
    this.stats.graphsFluxMesh[0][1] += size;

    this.gpuCacheItem = this.map.gpuCache.insert(this.killGpuSubmeshes.bind(this, true), size);
    this.gpuSize = size;

    //console.log("build: " + this.stats.counter + "   " + this.mapLoaderUrl);
};


MapMesh.prototype.drawSubmesh = function (cameraPos, index, texture, type, alpha, layer, surface, splitMask, splitSpace) {
    if (this.gpuSubmeshes[index] == null && this.submeshes[index] != null && !this.submeshes[index].killed) {
        this.gpuSubmeshes[index] = this.submeshes[index].buildGpuMesh();
    }

    const submesh = this.submeshes[index];
    const gpuSubmesh = this.gpuSubmeshes[index];

    if (!gpuSubmesh) { // || !texture) {
        return;
    }

    this.map.renderer.gpu.drawTileSubmesh(cameraPos, index, texture, type, alpha, layer, surface, splitMask, splitSpace, submesh, gpuSubmesh);
};


export default MapMesh;
