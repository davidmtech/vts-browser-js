/**
 * @constructor
 */
Melown.MapSurfaceTile = function(map_, parent_, id_) {
    this.map_ = map_;
    this.id_ = id_;
    this.parent_ = parent_;
    this.viewCounter_ = map_.viewCounter_;
    this.renderCounter_ = 0;
    this.renderReady_ = false;
    this.geodataCounter_ = 0;

    this.metanode_ = null;  //[metanode, cacheItem]
    this.lastMetanode_ = null;
    this.boundmetaresources_ = null; //link to bound layers metatile storage

    this.surface_ = null; //surface or glue
    this.surfaceMesh_ = null;
    this.surfaceGeodata_ = null;     //probably only used in free layers
    this.surfaceGeodataView_ = null; //probably only used in free layers
    this.surfaceTextures_ = [];

    this.virtual_ = false;
    this.virtualReady_ = false;
    this.virtualSurfaces_ = [];
    
    this.resetDrawCommands_ = false;
    this.drawCommands_ = [[], [], []];
    
    this.bounds_ = {};
    this.boundLayers_ = {};
    this.boundTextures_ = {};
    this.updateBounds_ = true;

    this.heightMap_ = null;
    this.drawCommands_ = [[], [], []];
    this.credits_ = [];
    
    this.resources_ = this.map_.resourcesTree_.findNode(id_, true);   // link to resource tree
    this.metaresources_ = this.map_.resourcesTree_.findAgregatedNode(id_, 5, true); //link to meta resource tree
    this.boundresources_ = this.map_.resourcesTree_.findAgregatedNode(id_, 8, true); //link to meta resource tree

    this.children_ = [null, null, null, null];
};

Melown.MapSurfaceTile.prototype.kill = function() {
    //kill children
    for (var i = 0; i < 4; i++) {
        if (this.children_[i] != null) {
            this.children_[i].kill();
        }
    }
/*
    if (this.surfaceMesh_ != null) {
        this.surfaceMesh_.kill();
    }

    for (var key in this.surfaceTextures_) {
        if (this.surfaceTextures_[key_] != null) {
            this.surfaceTextures_[key_].kill();
        }
    }

    if (this.surfaceGeodata_ != null) {
        this.surfaceGeodata_.kill();
    }

    if (this.surfaceGeodataView_ != null) {
        this.surfaceGeodataView_.kill();
    }

    if (this.heightMap_ != null) {
        this.heightMap_.kill();
    }

    for (var key_ in this.boundTextures_) {
        if (this.boundTextures_[key_] != null) {
            this.boundTextures_[key_].kill();
        }
    }
*/
    this.resources_ = null;
    this.metaresources_ = null;
    this.metanode_ = null;

    this.surface_ = null;
    this.surfaceMesh_ = null;
    this.surfaceTextures_ = [];
    this.surfaceGeodata_ = null;
    this.surfaceGeodataView_ = null;

    this.bounds_ = {};
    this.boundLayers_ = {};
    this.boundTextures_ = {};
    this.updateBounds_ = true;

    this.virtual_ = false;
    this.virtualReady_ = false;
    this.virtualSurfaces_ = [];

    this.renderReady_ = false;
    this.lastSurface_ = null;
    this.lastState_ = null;
    this.lastRenderState_ = null;
        
    this.heightMap_ = null;
    this.drawCommands_ = [[], [], []];
    this.credits_ = {};

    this.verifyChildren_ = false;
    this.children_ = [null, null, null, null];

    var parent_ = this.parent_;
    this.parent_ = null;

    if (parent_ != null) {
        parent_.removeChild(this);
    }
};

Melown.MapSurfaceTile.prototype.validate = function() {
    //is tile empty?
    if (this.metaresources_ == null || !this.metaresources_.getMetatile(this.surface_)) {
        //this.kill();
    }
};

Melown.MapSurfaceTile.prototype.viewSwitched = function() {
    //store last state for view switching
    this.lastSurface_ = this.surface_;
    this.lastState_ = {
        surfaceMesh_ : this.surfaceMesh_,
        surfaceTextures_ : this.surfaceTextures_,
        boundTextures_ : this.boundTextures_,
        surfaceGeodata_ : this.surfaceGeodata_,
        surfaceGeodataView_ : this.surfaceGeodataView_
    };    

    if (this.drawCommands_[0].length > 0) {  // check only visible chanel
        this.lastRenderState_ = {
            drawCommands_ : this.drawCommands_,
            credits_ : this.credits_
        };
    } else {
        this.lastRenderState_ = null;
    }

    
    //zero surface related data    
    this.verifyChildren_ = true;
    this.renderReady_ = false;
    this.lastMetanode_ = this.metanode_;
    //this.metanode_ = null; //keep old value for smart switching


    //this.lastMetanode_ = null;
    //this.metanode_ = null;

    for (var key_ in this.bounds_) {
        this.bounds_[key_] = {
            sequence_ : [],
            alpha_ : [],
            transparent_ : false,
            viewCoutner_ : 0
        };
    }

    this.boundLayers_ = {};
    this.boundTextures_ = {};
    this.updateBounds_ = true;
    this.transparentBounds_ = false;

    this.surface_ = null;
    this.surfaceMesh_ = null;
    this.surfaceTextures_ = [];
    this.surfaceGeodata_ = null;
    this.surfaceGeodataView_ = null;
    
    this.virtual_ = false;
    this.virtualReady_ = false;
    this.virtualSurfaces_ = [];
    
    this.drawCommands_ = [[], [], []];
    this.credits_ = {};
};

Melown.MapSurfaceTile.prototype.restoreLastState = function() {
    if (!this.lastState_) {
        return;
    }
    this.surfaceMesh_ = this.lastState_.surfaceMesh_;
    this.surfaceTextures_ = this.lastState_.surfaceTextures_; 
    this.boundTextures_ = this.lastState_.boundTextures_;
    this.surfaceGeodata_ = this.lastState_.surfaceGeodata_;
    this.surfaceGeodataView_ = this.lastState_.surfaceGeodataView_;
    this.lastSurface_ = null;
    this.lastState_ = null;
};

Melown.MapSurfaceTile.prototype.addChild = function(index_) {
    if (this.children_[index_]) {
        return;
    }
    
    var id_ = this.id_;
    var childId_ = [id_[0] + 1, id_[1] << 1, id_[2] << 1];

    switch (index_) {
        case 1: childId_[1]++; break;
        case 2: childId_[2]++; break;
        case 3: childId_[1]++; childId_[2]++; break;
    }

    this.children_[index_] = new Melown.MapSurfaceTile(this.map_, this, childId_);
};

Melown.MapSurfaceTile.prototype.removeChildByIndex = function(index_) {
    if (this.children_[index_] != null) {
        this.children_[index_].kill();
        this.children_[index_] = null;
    }
    
    //remove resrource node?
};

Melown.MapSurfaceTile.prototype.removeChild = function(tile_) {
    for (var i = 0; i < 4; i++) {
        if (this.children_[i] == tile_) {
            this.children_[i].kill();
            this.children_[i] = null;
        }
    }
};


//MapTileMetacache

//MapTileData
