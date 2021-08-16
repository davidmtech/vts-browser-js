
//import GpuTexture_ from './texture';
import {utils as utils_} from '../utils/utils';

//get rid of compiler mess
//var GpuTexture = GpuTexture_;
var utils = utils_;


var RendererFont = function(gpu, core, font, size, path) {
    this.bbox = null;
    this.gpu = gpu;
    this.gl = gpu.gl;
    this.core = core;

    this.data = null;
    this.path = path;

    this.texture = {width:256, height:256}; //hack

    this.textures = [];
    this.images = [];
    this.ready = false;
    this.version = 1;

    this.load(path);
};


//destructor
RendererFont.prototype.kill = function() {
};

// Returns GPU RAM used, in bytes.
RendererFont.prototype.getSize = function(){ return this.size; };


RendererFont.prototype.load = function(path) {
    utils.loadBinary(path, this.onLoaded.bind(this), this.onError.bind(this));
};

RendererFont.prototype.onLoaded = function(data) {
    this.data = data;
    this.ready = true;
    this.core.markDirty();
};

RendererFont.prototype.isReady = function() {
    return this.ready;
};

RendererFont.prototype.onError = function() {

};

RendererFont.prototype.onFileLoaded = function(index, data) {
    this.core.markDirty();
    //this.textures[index].createFromData(256, 256, new Uint8Array(data), 'linear');
    this.textures[index] =  this.map.renderer.createDataTexture({ data: new Uint8Array(data), width: 256, height: 256 });
};

RendererFont.prototype.onFileLoadError = function() {
};

RendererFont.prototype.areTexturesReady = function(files) {
    var ready = true;
    for (var i = 0, li = files.length; i < li; i++) {
        var index = files[i];//Math.round( (planes[i] - (planes[i] % 3)) );

        if (!this.textures[index]) {
            utils.loadBinary(this.path + (index+2), this.onFileLoaded.bind(this, index), this.onFileLoadError.bind(this));
            this.textures[index] = true;
            ready = false;
        } else {

            if (this.textures[index] === true) {  //loading but not yet loaded
                ready = false;
            }

            //ready = (ready && this.textures[index].loaded);
        }
    }

    return ready;
};

RendererFont.prototype.getTexture = function(file) {
    //if (!this.textures[file]) {
        //debugger;
    //}

    return this.textures[file];
};

export default RendererFont;
