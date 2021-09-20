
import {checkSupport as checkSupport_} from '../core/core';
import {CoreInterface as CoreInterface_} from '../core/interface';
import {utils as utils_} from '../core/utils/utils';
import UI_ from './ui/ui';
import Autopilot_ from './autopilot/autopilot';
import ControlMode_ from './control-mode/control-mode';
import Presenter_ from './presenter/presenter';
import Rois_ from './rois/rois';
//import UIEvent_ from './ui/element/event';


//get rid of compiler mess
const CoreInterface = CoreInterface_;
const utils = utils_;
const UI = UI_;
const Autopilot = Autopilot_;
const ControlMode = ControlMode_;
const Presenter = Presenter_;
const Rois = Rois_;
const checkSupport = checkSupport_;


const Browser = function(element, config) {
    this.killed = false;
    this.configStorage = {};
    this.initConfig();
    this.setConfigParams(config, true);
    this.originalConfig = JSON.parse(JSON.stringify(config));

    this.element = (typeof element === 'string') ? document.getElementById(element) : element;
    this.ui = new UI(this, this.element);

    element = (typeof element !== 'string') ? element : document.getElementById(element);

    if (!checkSupport()) {
        this.ui.setControlVisible('fallback', true);
        return;
    }

    if (config.tiles3d) { //} && !(config.pos || config.position)) {
        this.config.autocenter = true;
    }

    this.core = new CoreInterface(this.ui.getMapControl().getMapElement().getElement(), config);

    if (this.core == null) {
        this.ui.setControlVisible('fallback', true);
        return;
    }

    this.updatePosInUrl = false;
    this.lastUrlUpdateTime = false;
    this.mapLoaded = false;
    this.mapInteracted = false;

    this.autopilot = new Autopilot(this);
    this.rois = new Rois(this);
    this.controlMode = new ControlMode(this, this.ui);
    this.presenter = new Presenter(this, config);
    this.wsId = Date.now();
    this.lastWsPos = null;
    this.lastWSConnectTime = 0;

    if (this.config.sync) {
        this.setupWS();
    }

    this.on('map-loaded', this.onMapLoaded.bind(this));
    this.on('map-unloaded', this.onMapUnloaded.bind(this));
    this.on('map-update', this.onMapUpdate.bind(this));
    this.on('map-position-changed', this.onMapPositionChanged.bind(this));
    this.on('map-position-fixed-height-changed', this.onMapPositionFixedHeightChanged.bind(this));
    this.on('map-position-panned', this.onMapPositionPanned.bind(this));
    this.on('map-position-rotated', this.onMapPositionRotated.bind(this));
    this.on('map-position-zoomed', this.onMapPositionZoomed.bind(this));

    this.on('tick', this.onTick.bind(this));
};


Browser.prototype.kill = function() {
    this.ui.kill();
    this.killed = true;

    if (this.ws) {
        this.ws.close();
    }
};


Browser.prototype.getCore = function() {
    return this.core;
};


Browser.prototype.getMap = function() {
    return this.core ? this.core.map : null;
};


Browser.prototype.getRenderer = function() {
    return this.core ? this.core.renderer : null;
};


Browser.prototype.getProj4 = function() {
    return this.core ? this.core.proj4 : null;
};


Browser.prototype.getUI = function() {
    return this.ui;
};


Browser.prototype.setControlMode = function(mode) {
    this.controlMode = mode;
};


Browser.prototype.getControlMode = function() {
    return this.controlMode;
};


Browser.prototype.on = function(name, listener) {
    return this.core.on(name, listener);
};


Browser.prototype.callListener = function(name, event) {
    this.core.callListener(name, event);
};


Browser.prototype.setupWS = function() {

    this.ws = new WebSocket(this.config.syncServer);

    this.ws.onmessage = (e) => {

        const map = this.getMap();
        if (!map) {
            return ;
        }

        try {

            const json = JSON.parse(e.data);

            //console.log(e.data);

            switch(json.command) {

                //case 'id':
                    //this.wsId = json.id;
                    //break;

                case 'cursor':
                case 'hide-cursor':
                    //this.wsId = json.id;
                        if (this.ui && this.ui.sync) {
                            this.ui.sync.updateCursor(json);
                        }

                    break;

                case 'pos':
                    {
                        const pos = json.pos;
                        const pos2 = map.getPosition().toArray();

                        this.lastWsPos = pos;

                        if (json.fixedHeight) {
                            this.config.fixedHeight = json.fixedHeight;
                        }

                        if (Math.abs(pos[1] - pos2[1]) > 0.00001 ||
                            Math.abs(pos[2] - pos2[2]) > 0.00001 ||
                            Math.abs(pos[4] - pos2[4]) > 0.001 ||
                            Math.abs(pos[5] - pos2[5]) > 0.01 ||
                            Math.abs(pos[6] - pos2[6]) > 0.01 ||
                            Math.abs(pos[7] - pos2[7]) > 0.01 ||
                            Math.abs(pos[8] - pos2[8]) > 0.01 ||
                            Math.abs(pos[9] - pos2[9]) > 0.01) {

                                map.setPosition(json.pos);
                            }
                    }
                    break;

                default:
            }

        } catch(ee) {
            console.log(ee);
        }

      //console.log(e.data)
    }

    this.ws.onopen = () => {
      this.ws.send('{ "command": "client", "channel": "' + this.config.sync + '", "id":' + this.wsId + '  }');
    }

    this.ws.onerror = (error) => {
      console.log(`WebSocket error: ${error}`)
    }

};


Browser.prototype.onMapLoaded = function(event) {
    this.mapLoaded = true;

    //overwrite browser options
    const options = event['browserOptions'] || {};
    const originalOptions = this.originalConfig;
    for (let key in originalOptions) {
        if (typeof options[key] !== 'undefined') {
            options[key] = originalOptions[key];
        }
    }

    this.setConfigParams(options);

    if (this.config.geojson || this.config.geodata) {
        let data = this.config.geojson || this.config.geodata;

        if (typeof data === 'string') {
            data = data.trim();

            if (data.charAt(0) == '{') {
                try {
                    data = JSON.parse(data);
                    this.onGeoJsonLoaded(data);
                // eslint-disable-next-line
                } catch(e){ }
            } else {
                utils.loadJSON(data, this.onGeoJsonLoaded.bind(this));
            }
        }
    }

    const map = this.getMap();
    map.config.autocenter = this.config.autocenter;

    if (this.config.tiles3d && map) {

        if (!this.config.position) {
            this.config.autocenter = true;
        }

        const freeLayer = {
            credits:[],
            displaySize:1024,
            extents:{"ll":[null,null,null],"ur":[null,null,null]},
            style:{},
            type:"geodata",
            hitable: true
        };

        freeLayer.geodata = {  binPath : this.config.tiles3d };

        map.addFreeLayer('geodatatest', freeLayer);

        const view = map.getView();
        view.freeLayers.geodatatest = { options: { fastParse: true }};
        map.setView(view);
    }

    if (this.autopilot) {
        this.autopilot.setAutorotate(this.config.autoRotate);
        this.autopilot.setAutopan(this.config.autoPan[0], this.config.autoPan[1]);
    }
};


Browser.prototype.getLinkWithCurrentPos = function() {
    const map = this.getMap();
    if (!map) {
        return '';
    }

    //get url params
    const params = utils.getParamsFromUrl(window.location.href);

    //get position string
    let p = map.getPosition();
    p = map.convertPositionHeightMode(p, 'fix', true);

    let s = '';
    s += p.getViewMode() + ',';
    const c = p.getCoords();
    s += c[0].toFixed(6) + ',' + c[1].toFixed(6) + ',' + p.getHeightMode() + ',' + c[2].toFixed(2) + ',';
    const o = p.getOrientation();
    s += o[0].toFixed(2) + ',' + o[1].toFixed(2) + ',' + o[2].toFixed(2) + ',';
    s += p.getViewExtent().toFixed(2) + ',' + p.getFov().toFixed(2);

    //replace old value with new one
    params['pos'] = s;

    if (this.mapInteracted) {
        if (params['rotate'] || this.getConfigParam('rotate')) {
            params['rotate'] = '0';
        }

        const pan = this.getConfigParam('pan');
        if (params['pan'] || (pan && (pan[0] || pan[1]))) {
            params['pan'] = '0,0';
        }
    }

    if (this.config.fixedHeight) {
        params['fixedHeight'] = '' + this.config.fixedHeight.toFixed(3);
    }

    //convert prameters to url parameters string
    s = '';
    for (let key in params) {
        s += ((s.length > 0) ? '&' : '') + key + '=' + params[key];
    }

    //separete base url and url params
    const urlParts = window.location.href.split('?');

    if (urlParts.length > 1) {
        const extraParts = urlParts[1].split('#'); //is there anchor?
        return urlParts[0] + '?' + s + (extraParts[1] || '');
    } else {
        return urlParts[0] + '?' + s;
    }
};


Browser.prototype.onMapPositionChanged = function(event) {
    if (this.config.positionInUrl) {
        this.updatePosInUrl = true;
    }

    if (this.ws) {

        const pos = this.getPositionString(event.position);
        const pos2 = this.lastWsPos ? this.getPositionString(this.lastWsPos) : "";

        if (pos != pos2) {

            if (this.ws.readyState == 1) {
                if (this.config.fixedHeight) {
                    this.ws.send('{ "command":"pos", "pos": ' + pos + ' "fixedHeight" : ' + this.config.fixedHeight + ' }')
                } else {
                    this.ws.send('{ "command":"pos", "pos": ' + pos + ' }')
                }
            }

        }
    }
};


Browser.prototype.onMapPositionPanned = function() {
    this.mapInteracted = true;
};


Browser.prototype.onMapPositionRotated = function() {
    this.mapInteracted = true;
};


Browser.prototype.onMapPositionZoomed = function() {
    this.mapInteracted = true;
};


Browser.prototype.onMapPositionFixedHeightChanged = function() {
    if (this.config.positionInUrl) {
        this.updatePosInUrl = true;
    }
};


Browser.prototype.onMapUnloaded = function() {
};


Browser.prototype.onMapUpdate = function() {
    this.dirty = true;
};


Browser.prototype.onGeoJsonLoaded = function(data) {
    const map = this.getMap();
    const geodata = map.createGeodata();

    const addFreeLayer = (function(){
        const freeLayer = geodata.makeFreeLayer(this.config.geojsonStyle);
        map.addFreeLayer('geojson', freeLayer);
        const view = map.getView();
        view.freeLayers.geojson = {};
        map.setView(view);
    }).bind(this)

    if (this.config.geodata) {
        geodata.importVTSGeodata(data);
        addFreeLayer();
    } else {
        geodata.importGeoJson(data);
        geodata.processHeights('node-by-precision', 62, addFreeLayer);
    }
};


Browser.prototype.on3DTilesLoaded = function() {
    const map = this.getMap();
    const freeLayer = this.tiles3d.makeFreeLayer({});
    map.addFreeLayer('tiles3d', freeLayer);
    const view = map.getView();
    view.freeLayers.tiles3d = { options: { fastParse: true }};
    map.setView(view);
}


Browser.prototype.onTick = function() {
    if (this.killed) {
        return;
    }

    this.autopilot.tick();
    this.ui.tick(this.dirty);
    this.dirty = false;

    if (this.ws) {
        if (this.ws.readyState > 1) {
            const timer = performance.now();
            if ((timer - this.lastWSConnectTime) > 1000) {
                this.setupWS();
                this.lastWSConnectTime = timer;
            }
        }
    }

    if (this.updatePosInUrl) {
        const timer = performance.now();
        if ((timer - this.lastUrlUpdateTime) > 1000) {
            if (window.history.replaceState) {
                window.history.replaceState({}, null, this.getLinkWithCurrentPos());
            }
            this.updatePosInUrl = false;
            this.lastUrlUpdateTime = timer;
        }
    }
};


Browser.prototype.initConfig = function() {
    this.config = {
        panAllowed : true,
        rotationAllowed : true,
        zoomAllowed : true,
        jumpAllowed : false,
        separatePanAndZoom : true,
        sensitivity : [1, 0.06, 0.05],
        inertia : [0.81, 0.9, 0.7],
        timeNormalizedInertia : false, // legacy inertia [0.8,0.8,0.8] sensitivity [0.5,0.4]
        legacyInertia : false, // legacy inertia [0.8,0.8,0.8] sensitivity [0.5,0.4]
        positionInUrl : false,
        positionUrlHistory : false,
        constrainCamera : true,
        navigationMode : 'azimuthal',
        controlCompass : true,
        controlZoom : true,
        controlSpace : true,
        controlSearch : true,
        controlSearchSrs : null,
        controlSearchUrl : null,
        controlSearchFilter : false,
        controlMeasure : false,
        controlMeasureLite : false,
        controlLink : false,
        controlGithub : false,
        controlScale : true,
        controlLayers : false,
        controlCredits : true,
        controlFullscreen : false,
        controlLoading : true,
        searchElement : null,
        searchValue : null,
        walkMode : false,
        wheelInputLag : [70,1],
        fixedHeight : 0,
        geojson : null,
        sync: null,
        syncServer: 'ws://localhost:9080',
        syncCursor: false,
        syncId: '',
        tiltConstrainThreshold : [0.5,1],
        bigScreenMargins : false, //75,
        minViewExtent : 20, //75,
        maxViewExtent : Number.MAXINTEGER,
        autocenter : false,
        autoRotate : 0,
        autoPan : [0,0]
    };
};


Browser.prototype.setConfigParams = function(params, ignoreCore) {
    if (typeof params === 'object' && params !== null) {
        for (let key in params) {
            this.setConfigParam(key, params[key], ignoreCore);

            /*if (!(key == "pos" || key == "position" || key == "view" ||
                key.indexOf("map") == 0 || key.indexOf("renderer") == 0)) {
                this.configStorage[key] = params[key];
            }*/
        }
    }
};


Browser.prototype.getPositionString = function(p) {

    var s = '[';
    s += '"' + p[0] + '",';
    s += p[1].toFixed(6) + ',' + p[2].toFixed(6) + ',"' + p[3] + '",' + p[4].toFixed(2) + ',';
    s += p[5].toFixed(2) + ',' + p[6].toFixed(2) + ',' + p[7].toFixed(2) + ',';
    s += p[8].toFixed(2) + ',' + p[9].toFixed(2) +  ']';

    return s;
}



Browser.prototype.updateUI = function(key) {
    if (this.ui == null) {
        return;
    }

    this.ui.setParam(key);
};


Browser.prototype.setConfigParam = function(key, value, ignoreCore) {
    const map = this.getMap();

    switch (key) {
    case 'pos':
    case 'position':
        this.config.position = value;
        if (map) {
            map.setPosition(this.config.position);
        }
        break;

    case 'view':
        this.config.view = value;
        if (map) {
            map.setView(this.config.view);
        }
        break;

    case 'panAllowed':             this.config.panAllowed = utils.validateBool(value, true);           break;
    case 'rotationAllowed':        this.config.rotationAllowed = utils.validateBool(value, true);      break;
    case 'zoomAllowed':            this.config.zoomAllowed = utils.validateBool(value, true);          break;
    case 'jumpAllowed':            this.config.jumpAllowed = utils.validateBool(value, false);         break;
    case 'separatePanAndZoom':     this.config.separatePanAndZoom = utils.validateBool(value, false);  break;
    case 'constrainCamera':        this.config.constrainCamera = utils.validateBool(value, true);      break;
    case 'navigationMode':         this.config.navigationMode = value;                                 break;
    case 'positionInUrl':          this.config.positionInUrl = utils.validateBool(value, false);       break;
    case 'positionUrlHistory':     this.config.positionUrlHistory = utils.validateBool(value, false);  break;
    case 'controlCompass':         this.config.controlCompass = utils.validateBool(value, true); this.updateUI(key);    break;
    case 'controlZoom':            this.config.controlZoom = utils.validateBool(value, true); this.updateUI(key);       break;
    case 'controlScale':           this.config.controlScale = utils.validateBool(value, true); this.updateUI(key);      break;
    case 'controlLayers':          this.config.controlLayers = utils.validateBool(value, false); this.updateUI(key);    break;
    case 'controlSpace':           this.config.controlSpace = utils.validateBool(value, false); this.updateUI(key);     break;
    case 'controlSearch':          this.config.controlSearch = utils.validateBool(value, false); this.updateUI(key);    break;
    case 'controlSearchUrl':       this.config.controlSearchUrl = value;    break;
    case 'controlSearchSrs':       this.config.controlSearchSrs = value;    break;
    case 'controlSearchFilter':    this.config.controlSearchFilter = utils.validateBool(value, true);  break;
    case 'controlSearchElement':   this.config.controlSearchElement = value; this.updateUI(key);  break;
    case 'controlSearchValue':     this.config.controlSearchValue = /*utils.validateString(*/value/*, null)*/; this.updateUI(key); break;
    case 'controlLink':            this.config.controlLink = utils.validateBool(value, false); this.updateUI(key);        break;
    case 'controlGithub':          this.config.controlGithub = utils.validateBool(value, false); this.updateUI(key);      break;
    case 'controlMeasure':         this.config.controlMeasure = utils.validateBool(value, false); this.updateUI(key);     break;
    case 'controlMeasureLite':     this.config.controlMeasureLite = utils.validateBool(value, false); this.updateUI(key); break;
    case 'controlLogo':            this.config.controlLogo = utils.validateBool(value, false); this.updateUI(key);        break;
    case 'controlFullscreen':      this.config.controlFullscreen = utils.validateBool(value, true); this.updateUI(key);   break;
    case 'controlCredits':         this.config.controlCredits = utils.validateBool(value, true); this.updateUI(key);      break;
    case 'controlLoading':         this.config.controlLoading = utils.validateBool(value, true); this.updateUI(key);      break;
    case 'minViewExtent':          this.config.minViewExtent = utils.validateNumber(value, 0.01, Number.MAXINTEGER, 100); break;
    case 'maxViewExtent':          this.config.maxViewExtent = utils.validateNumber(value, 0.01, Number.MAXINTEGER, Number.MAXINTEGER); break;
    case 'wheelInputLag':          this.config.wheelInputLag = utils.validateNumberArray(value, 2, [0,0], [999, 999], [70, 1]); break;
    case 'sensitivity':            this.config.sensitivity = utils.validateNumberArray(value, 3, [0,0,0], [10, 10, 10], [1, 0.12, 0.05]); break;
    case 'inertia':                this.config.inertia = utils.validateNumberArray(value, 3, [0,0,0], [0.99, 0.99, 0.99], [0.85, 0.9, 0.7]); break;
    case 'legacyInertia':          this.config.legacyInertia = utils.validateBool(value, false); break;
    case 'timeNormalizedInertia':  this.config.timeNormalizedInertia = utils.validateBool(value, false); break;
    case 'bigScreenMargins':       this.config.bigScreenMargins = utils.validateBool(value, false); break;
    case 'tiltConstrainThreshold': this.config.tiltConstrainThreshold = utils.validateNumberArray(value, 2, [0.5,1], [-Number.MAXINTEGER, -Number.MAXINTEGER], [Number.MAXINTEGER, Number.MAXINTEGER]); break;
    case 'walkMode':               this.config.walkMode = utils.validateBool(value, false); break;
    case 'fixedHeight':            this.config.fixedHeight = utils.validateNumber(value, -Number.MAXINTEGER, Number.MAXINTEGER, 0); break;
    case 'sync':                   this.config.sync = value; break;
    case 'syncCursor':             this.config.syncCursor = utils.validateBool(value, false); break;
    case 'syncServer':             this.config.syncServer = value; break;
    case 'syncId':                 this.config.syncId = value; break;
    case 'geodata':                this.config.geodata = value; break;
    case 'tiles3d':                this.config.tiles3d = value; break;
    case 'geojson':                this.config.geojson = value; break;
    case 'geojsonStyle':           this.config.geojsonStyle =  JSON.parse(value); break;
    case 'rotate':
        this.config.autoRotate = utils.validateNumber(value, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 0);
        if (map && this.autopilot) {
            this.autopilot.setAutorotate(this.config.autoRotate);
        }
        break;
    case 'pan':
        if (Array.isArray(value) && value.length == 2){
            this.config.autoPan = [
                utils.validateNumber(value[0], Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 0),
                utils.validateNumber(value[1], -360, 360, 0)
            ];
        }

        if (map && this.autopilot) {
            this.autopilot.setAutorotate(this.config.autoRotate);
        }
        break;
    }

    if (ignoreCore) {
        if ((key.indexOf('map') == 0 || key.indexOf('mario') == 0 || key.indexOf('authorization') == 0) && map) {
            map.setConfigParam(key, value);
        }

        if (key.indexOf('renderer') == 0 && this.getRenderer()) {
            this.getRenderer().setConfigParam(key, value);
        }

        if (key.indexOf('debug') == 0 && this.core) {
            this.core.setConfigParam(key, value);
        }

    }
};


Browser.prototype.getConfigParam = function(key) {
    const map = this.getMap();

    switch (key) {
    case 'pos':
    case 'position':

        if (map) {
            map.getPosition();
        } else {
            return this.config.position;
        }

        break;

    case 'view':

        if (map) {
            return map.getView();
        } else {
            return this.config.view;
        }

    case 'panAllowed':             return this.config.panAllowed;
    case 'rotationAllowed':        return this.config.rotationAllowed;
    case 'zoomAllowed':            return this.config.zoomAllowed;
    case 'jumpAllowed':            return this.config.jumpAllowed;
    case 'sensitivity':            return this.config.sensitivity;
    case 'inertia':                return this.config.inertia;
    case 'legacyInertia':          return this.config.legacyInertia;
    case 'timeNormalizedInertia':  return this.config.timeNormalizedInertia;
    case 'bigScreenMargins':       return this.config.bigScreenMargins;
    case 'navigationMode':         return this.config.navigationMode;
    case 'constrainCamera':        return this.config.constrainCamera;
    case 'positionInUrl':          return this.config.positionInUrl;
    case 'positionUrlHistory':     return this.config.positionUrlHistory;
    case 'controlCompass':         return this.config.controlCompass;
    case 'controlZoom':            return this.config.controlZoom;
    case 'controlScale':           return this.config.controlScale;
    case 'controlLayers':          return this.config.controlLayers;
    case 'controlSpace':           return this.config.controlSpace;
    case 'controlSearch':          return this.config.controlSearch;
    case 'controlLink':            return this.config.controlLink;
    case 'controlGithub':          return this.config.controlGithub;
    case 'controlMeasure':         return this.config.controlMeasure;
    case 'controlMeasureLite':     return this.config.controlMeasureLite;
    case 'controlLogo':            return this.config.controlLogo;
    case 'controlFullscreen':      return this.config.controlFullscreen;
    case 'controlCredits':         return this.config.controlCredits;
    case 'controlLoading':         return this.config.controlLoading;
    case 'controlSearchElement':   return this.config.controlSearchElement;
    case 'controlSearchValue':     return this.config.controlSearchValue;
    case 'controlSearchUrl':       return this.config.controlSearchUrl;
    case 'controlSearchSrs':       return this.config.controlSearchSrs;
    case 'controlSearchFilter':    return this.config.controlSearchFilter;
    case 'minViewExtent':          return this.config.minViewExtent;
    case 'maxViewExtent':          return this.config.maxViewExtent;
    case 'fixedHeight':            return this.config.fixedHeight;
    case 'rotate':                 return this.config.autoRotate;
    case 'pan':                    return this.config.autoPan;
    }

    //if (ignoreCore) {
    if (key.indexOf('map') == 0 && map) {
        return map.getConfigParam(key);
    }

    if (key.indexOf('renderer') == 0) {
        return map.getConfigParam(key);
    }
    //}
};


export default Browser;
