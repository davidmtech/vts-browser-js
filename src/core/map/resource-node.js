
import MapTexture_ from './texture';
import MapSubtexture_ from './subtexture';
import MapMetatile_ from './metatile';
import MapMesh_ from './mesh';
import MapGeodata_ from './geodata';
import MapPointCloud_ from './pointcloud';

//get rid of compiler mess
const MapTexture = MapTexture_;
const MapSubtexture = MapSubtexture_;
const MapMetatile = MapMetatile_;
const MapMesh = MapMesh_;
const MapGeodata = MapGeodata_;
const MapPointCloud = MapPointCloud_;


const MapResourceNode = function(map, parent, id) {
    this.map = map;
    this.id = id;
    this.parent = parent;

    this.metatiles = {};
    this.meshes = {};
    this.textures = {};
    this.subtextures = {};
    this.geodata = {};
    this.credits = {};

    this.children = [null, null, null, null];
};


MapResourceNode.prototype.kill = function() {
    //kill children
    for (let i = 0; i < 4; i++) {
        if (this.children[i] != null) {
            this.children[i].kill();
        }
    }

    this.children = [null, null, null, null];

    const parent = this.parent;
    this.parent = null;

    if (parent != null) {
        parent.removeChild(this);
    }

    //kill resources?
};


MapResourceNode.prototype.addChild = function(index) {
    if (this.children[index]) {
        return;
    }

    const id = this.id;
    const childId = [id[0] + 1, id[1] << 1, id[2] << 1];

    switch (index) {
    case 1: childId[1]++; break;
    case 2: childId[2]++; break;
    case 3: childId[1]++; childId[2]++; break;
    }

    this.children[index] = new MapResourceNode(this.map, this, childId);
};


MapResourceNode.prototype.removeChildByIndex = function(index) {
    if (this.children[index] != null) {
        this.children[index].kill();
        this.children[index] = null;
    }
};


MapResourceNode.prototype.removeChild = function(tile) {
    for (let i = 0; i < 4; i++) {
        if (this.children[i] == tile) {
            this.children[i].kill();
            this.children[i] = null;
        }
    }
};


// Meshes ---------------------------------

MapResourceNode.prototype.getMesh = function(path, tile) {
    let mesh = this.meshes[path];

    if (!mesh) {
        mesh = new MapMesh(this.map, path, tile);
        this.meshes[path] = mesh;
    }

    return mesh;
};


// Point Clouds ---------------------------------

MapResourceNode.prototype.getPointCloud = function(path, tile, offset, size) {
    if (!this.pointclouds) this.pointclouds = {};

    const path2 = offset ? path+'@'+offset : path;
    let pointcloud = this.pointclouds[path2];

    if (!pointcloud) {
        pointcloud = new MapPointCloud(this.map, path, tile, offset, size);
        this.pointclouds[path2] = pointcloud;
    }

    return pointcloud;
};


// Geodata ---------------------------------

MapResourceNode.prototype.getGeodata = function(path, extraInfo) {
    let geodata = this.geodata[path];

    if (!geodata) {
        geodata = new MapGeodata(this.map, path, extraInfo);
        this.geodata[path] = geodata;
    }

    return geodata;
};


// Textures ---------------------------------

MapResourceNode.prototype.getTexture = function(path, type, extraBound, extraInfo, tile, internal) {
    let texture;
    if (extraInfo && (extraInfo.layer || extraInfo.hmap)) {
        const id = path + (extraInfo.hmap ? '' : extraInfo.layer.id);
        texture = this.textures[id];

        if (!texture) {
            texture = new MapTexture(this.map, path, type, extraBound, extraInfo, tile, internal);
            this.textures[id] = texture;
        }
    } else {
        texture = this.textures[path];

        if (!texture) {
            texture = new MapTexture(this.map, path, type, extraBound, extraInfo, tile, internal);
            this.textures[path] = texture;
        }
    }

    return texture;
};


// SubTextures ---------------------------------

MapResourceNode.prototype.getSubtexture = function(texture, path, type, extraBound, extraInfo, tile, internal) {
    texture = this.subtextures[path];

    if (!texture) {
        texture = new MapSubtexture(this.map, path, type, extraBound, extraInfo, tile, internal);
        this.subtextures[path] = texture;
    }

    return texture;
};


// Metatiles ---------------------------------

MapResourceNode.prototype.addMetatile = function(path, metatile) {
    this.metatiles[path] = metatile;
};


MapResourceNode.prototype.removeMetatile = function(metatile) {
    for (let key in this.metatiles) {
        if (this.metatiles[key] == metatile) {
            delete this.metatiles[key];
        }
    }
};


MapResourceNode.prototype.getMetatile = function(surface, allowCreation, tile) {
    const metatiles = this.metatiles;
    let metatile;
    for (let key in metatiles) {
        if (metatiles[key].surface == surface) {
            return metatiles[key];
        }
    }

    const path = surface.getMetaUrl(this.id);

    if (metatiles[path]) {
        metatile = metatiles[path].clone(surface);
        this.addMetatile(path, metatile);
        return metatile;
    }

    if (allowCreation) {
        metatile = new MapMetatile(this, surface, tile);
        this.addMetatile(path, metatile);
        return metatile;
    } else {
        return null;
    }
};


export default MapResourceNode;
