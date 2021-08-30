
import MapBoundLayer_ from './bound-layer';
import MapCredit_ from './credit';
import MapRefFrame_ from './refframe';
import MapView_ from './view';
import MapSrs_ from './srs';
import MapBody_ from './body';
import MapSurface_ from './surface';
import MapVirtualSurface_ from './virtual-surface';
import MapStylesheet_ from './stylesheet';

//get rid of compiler mess
const MapCredit = MapCredit_;
const MapBoundLayer = MapBoundLayer_;
const MapRefFrame = MapRefFrame_;
const MapView = MapView_;
const MapSrs = MapSrs_;
const MapBody = MapBody_;
const MapSurface = MapSurface_;
const MapVirtualSurface = MapVirtualSurface_;
const MapStylesheet = MapStylesheet_;


const MapConfig = function(map, config) {
    this.map = map;
    this.mapConfig = config;
    this.parseConfig();
};


MapConfig.prototype.parseConfig = function() {
    if (!(this.parseSrses() && this.parseBodies() && this.parseReferenceFrame() &&
          this.parseCredits() && this.parseStylesheets() &&
          this.parseSurfaces() && this.parseGlues() &&
          this.parseVirtualSurfaces() && this.parseBoundLayers() &&
          this.parseFreeLayers() && this.parseViews() &&
          this.parseParams() && this.parseBrowserOptions() )) {
        //wrong config file
    }

    const stats = this.map.stats;
    stats.loadedCount = 0;
    stats.loadErrorCount = 0;
    stats.loadFirst = performance.now();
    stats.loadLast = this.map.loadFirst;
};


MapConfig.prototype.afterConfigParsed = function() {
    if (this.mapConfig['position'] != null) {
        this.map.setPosition(this.mapConfig['position'], false);
    }

    this.map.setView(this.map.initialView);
};


MapConfig.prototype.parseSrses = function() {
    const srses = this.mapConfig['srses'];
    this.map.srses = {};

    if (srses == null) {
        return false;
    }

    for (let key in srses) {
        this.map.addSrs(key, new MapSrs(this.map, key, srses[key]));
    }

    return true;
};


MapConfig.prototype.parseBodies = function() {
    const bodies = this.mapConfig['bodies'];
    this.map.bodies = {};

    if (bodies == null) {
        return true;//false;
    }

    for (let key in bodies) {
        this.map.addBody(key, new MapBody(this.map, bodies[key]));
    }

    return true;
};


MapConfig.prototype.parseReferenceFrame = function() {
    const rf = this.mapConfig['referenceFrame'];

    if (rf == null) {
        return false;
    }

    this.map.referenceFrame = new MapRefFrame(this.map, rf);

    if (!this.map.referenceFrame.valid) {
        return false;
    }

    return true;
};


MapConfig.prototype.parseCredits = function() {
    const credits = this.mapConfig['credits'];
    this.map.credits = {};

    if (credits == null) {
        return false;
    }

    for (let key in credits) {
        this.map.addCredit(key, new MapCredit(this.map, credits[key]));
    }

    return true;
};


MapConfig.prototype.parseSurfaces = function() {
    const surfaces = this.mapConfig['surfaces'];
    this.map.surfaces = [];

    if (surfaces == null) {
        return false;
    }

    for (let i = 0, li = surfaces.length; i < li; i++) {
        const surface = new MapSurface(this.map, surfaces[i]);
        this.map.addSurface(surface.id, surface);
    }

    return true;
};


MapConfig.prototype.parseVirtualSurfaces = function() {
    const surfaces = this.mapConfig['virtualSurfaces'];
    this.map.virtualSurfaces = [];

    if (!this.map.config.mapVirtualSurfaces) {
        return true;
    }

    if (surfaces == null) {
        return true;
    }

    for (let i = 0, li = surfaces.length; i < li; i++) {
        const surface = new MapVirtualSurface(this.map, surfaces[i]);
        this.map.virtualSurfaces[surface.strId] = surface;
    }

    return true;
};


MapConfig.prototype.parseViews = function() {
    const views = this.mapConfig['namedViews'];
    this.map.namedViews = [];

    if (views) {
        for (let key in views) {
            this.map.addNamedView(key, new MapView(this.map, views[key], true));
        }
    }

    let view = this.mapConfig['view'];

    if (typeof view === 'string') {
        view = this.map.namedViews[view];
    }

    if (!view) {
        return true;
    }

    view = new MapView(this.map, view, true);

    this.map.initialView = view.getInfo();
    return true;
};


MapConfig.prototype.parseGlues = function() {
    const glues = this.mapConfig['glue'];
    this.map.glues = [];

    if (glues == null) {
        return true;
    }

    for (let i = 0, li = glues.length; i < li; i++) {
        const surface = new MapSurface(this.map, glues[i], 'glue');
        this.map.addGlue(surface.id.join(';'), surface);
    }

    return true;
};


MapConfig.prototype.parseBoundLayers = function() {
    const layers = this.mapConfig['boundLayers'];
    this.map.boundLayers = [];

    if (layers == null) {
        return true;
    }

    for (let key in layers) {
        const layer = new MapBoundLayer(this.map, layers[key], key);
        this.map.addBoundLayer(key, layer);
    }

    return true;
};


MapConfig.prototype.parseFreeLayers = function() {
    const layers = this.mapConfig['freeLayers'];
    this.map.freeLayers = [];

    if (layers == null) {
        return true;
    }

    for (let key in layers) {
        const layer = new MapSurface(this.map, layers[key], 'free');
        this.map.addFreeLayer(key, layer);
    }

    return true;
};


MapConfig.prototype.parseStylesheets = function() {
    const styles = this.mapConfig['stylesheets'];
    this.map.stylesheets = [];

    if (styles == null) {
        return true;
    }

    for (let key in styles) {
        const style = new MapStylesheet(this.map, key, styles[key]);
        this.map.addStylesheet(key, style);
    }

    return true;
};


MapConfig.prototype.parseParams = function() {
    return true;
};


MapConfig.prototype.parseBrowserOptions = function() {
    const options = this.mapConfig['browserOptions'];
    this.map.browserOptions = {};

    if (options == null) {
        return true;
    }

    this.map.browserOptions = JSON.parse(JSON.stringify(options));
    return true;
};


MapConfig.prototype.cloneConfig = function() {
    const json = JSON.parse(JSON.stringify(this.mapConfig));
    return json;
};


export default MapConfig;
