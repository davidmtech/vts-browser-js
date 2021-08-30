
//import GpuTexture_ from './texture';
import {utils as utils_} from '../utils/utils';

//get rid of compiler mess
//const GpuTexture = GpuTexture_;
const utils = utils_;


const RendererFont = function(renderer, core, font, size, path) {
    this.bbox = null;
    this.renderer = renderer;
    this.gpu = renderer.gpu;
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
    //this.textures[index] =  this.renderer.createDataTexture({ data: new Uint8Array(data), width: 256, height: 256 });
    this.textures[index] =  this.renderer.gpu.createTexture({ data: new Uint8Array(data), width: 256, height: 256, filter: 'linear' });
};

RendererFont.prototype.onFileLoadError = function() {
};

RendererFont.prototype.areTexturesReady = function(files) {
    let ready = true;
    for (let i = 0, li = files.length; i < li; i++) {
        const index = files[i];//Math.round( (planes[i] - (planes[i] % 3)) );

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
