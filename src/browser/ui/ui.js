
import Dom_ from '../utility/dom';
import {utils as utils_} from '../../core/utils/utils';
import UIControlHolder_ from './control/holder';
import UIControlMap_ from './control/map';

import UIControlCompass_ from './control/compass';
import UIControlCredits_ from './control/credits';
import UIControlFullscreen_ from './control/fullscreen';
import UIControlZoom_ from './control/zoom';
import UIControlSpace_ from './control/space';
import UIControlSearch_ from './control/search';
import UIControlLink_ from './control/link';
import UIControlGithub_ from './control/github';
import UIControlLayers_ from './control/layers';
import UIControlFallback_ from './control/fallback';
import UIControlPopup_ from './control/popup';
import UIControlLoading_ from './control/loading';
import { UIControlMeasure as UIControlMeasure_ }  from './control/measure';
import UIControlMeasureLite_ from './control/measure-lite';
import UIControlSync_ from './control/sync';

//get rid of compiler mess
const dom = Dom_;
const utils = utils_;
const UIControlHolder = UIControlHolder_;
const UIControlMap = UIControlMap_;

const UIControlCompass = UIControlCompass_;
const UIControlCredits = UIControlCredits_;
const UIControlFullscreen = UIControlFullscreen_;
const UIControlZoom = UIControlZoom_;
const UIControlSpace = UIControlSpace_;
const UIControlSearch = UIControlSearch_;
const UIControlLink = UIControlLink_;
const UIControlGithub = UIControlGithub_;
const UIControlMeasure = UIControlMeasure_;
const UIControlMeasureLite = UIControlMeasureLite_;
const UIControlLayers = UIControlLayers_;
const UIControlFallback = UIControlFallback_;
const UIControlPopup = UIControlPopup_;
const UIControlLoading = UIControlLoading_;
const UIControlSync = UIControlSync_;


const UI = function(browser, element) {
    this.browser = browser;
    this.config = browser.config;
    this.rootElement = element;
    this.element = null;
    this.controls = [];
    this.killed = false;
    this.init();
    this.instanceId = utils.instanceCounter++;

    Object.defineProperty(this, 'dom', {
        get: function() {
            if (this.killed) return null;
            return dom;
        }
    });
};


UI.prototype.init = function() {
    //create browser wrapper
    this.elementIdCounter = 1;
    this.element = document.createElement('div');
    this.element.className = 'vts-browser';
    this.rootElement.appendChild(this.element);

    //create map cotrol
    this.map = new UIControlMap(this);

    //create other ui controls
    const loading = this.config.controlLoading;
    this.compass = new UIControlCompass(this, (!loading && this.config.controlCompass), loading);
    this.credits = new UIControlCredits(this, (!loading && this.config.controlCredits), loading);
    //this.logo = new UIControlLogo(this, this.config.controlLogo);
    this.fullscreen = new UIControlFullscreen(this, (!loading && this.config.controlFullscreen), loading);
    this.zoom = new UIControlZoom(this, (!loading && this.config.controlZoom), loading);
    this.space = new UIControlSpace(this, (!loading && this.config.controlSpace), loading);
    this.search = new UIControlSearch(this, (!loading && this.config.controlSearch), loading);
    this.link = new UIControlLink(this, (!loading && this.config.controlLink), loading);
    this.github = new UIControlGithub(this, (!loading && this.config.controlGithub), loading);
    this.measure = new UIControlMeasure(this, (!loading && this.config.controlMeasure), loading);
    this.measure2 = new UIControlMeasureLite(this, (!loading && this.config.controlMeasureLite), loading);
    //this.navigator = new UIControlNavigation(this, this.config.controlNavigator);
    this.layers = new UIControlLayers(this, (!loading && this.config.controlLayers), loading);
    this.fallback = new UIControlFallback(this);
    this.popup = new UIControlPopup(this, false);
    this.loading = new UIControlLoading(this, this.config.controlLoading);

    if (this.config.syncCursor) {
        this.sync = new UIControlSync(this, this.config.syncCursor);
    }

    dom.disableContexMenu(this.element);
};


UI.prototype.kill = function() {
    this.killed = true;

    for (let key in this.controls) {
        delete this.controls[key];
    }

    this.rootElement.removeChild(this.element);
    delete this.element;
    this.element = null;
};


UI.prototype.addControl = function(id, html, visible, visibleLock, parentElement) {
    const control = new UIControlHolder(this, html, visible, visibleLock, parentElement);
    this.controls[id] = control;
    return control;
};


UI.prototype.removeControl = function(id) {
    if (this.controls[id] != null) {
        delete this.controls[id];
    }
};


UI.prototype.setControlHtml = function(id, html) {
    if (this.controls[id] != null) {
        this.controls[id].setHTML(html);
    }
};


UI.prototype.setControlVisible = function(id, state, lockState) {
    if (this.controls[id] != null) {
        if (typeof lockState !== 'undefined') {
            this.controls[id].setVisibleLock(lockState);
        }

        const renderer = this.browser.getRenderer();
        let flags = renderer.getMarginFlags();

        if (id == 'compass') flags |= 1;
        if (id == 'search') flags |= 2;

        if (this.config.bigScreenMargins) {
            flags |= 4096;
        }

        renderer.setMarginFlags(flags);

        this.controls[id].setVisible(state);
    }
};


UI.prototype.getControlVisible = function(id) {
    if (this.controls[id] != null) {
        this.controls[id].getVisible();
    }
};


UI.prototype.getControl = function(id) {
    return this.controls[id];
};


UI.prototype.getMapControl = function() {
    return this.map;
};


UI.prototype.getMapElement = function() {
    return this.map.getMapElement();
};


UI.prototype.setParam = function(key) {
    switch (key) {
    case 'controlCompass':     this.setControlVisible('compass', this.config.controlCompass); break;
    case 'controlZoom':        this.setControlVisible('zoom', this.config.controlZoom); break;
        //case "controlMeasure":     this.setControlVisible(this.config.controlCompass); break;
    case 'controlScale':       this.setControlVisible('scale', this.config.controlScale); break;
    case 'controlLayers':      this.setControlVisible('layers', this.config.controlLayers); break;
    case 'controlSpace':       this.setControlVisible('space', this.config.controlSpace); break;
    case 'controlSearch':      this.setControlVisible('search', this.config.controlSearch); break;
    case 'controlLink':        this.setControlVisible('link', this.config.controlLink); break;
    case 'controlMeasure':     this.setControlVisible('measure', this.config.controlMeasure); break;
    case 'controlLogo':        this.setControlVisible('logo', this.config.controlLogo); break;
    case 'controlFullscreen':  this.setControlVisible('fullscreeen', this.config.controlFullscreen); break;
    case 'controlCredits':     this.setControlVisible('credits', this.config.controlCredits); break;
        //case "controlLoading":     this.setControlVisible("loading", this.config.controlLogo); break;
    }
};


UI.prototype.tick = function(dirty) {
    if (dirty) {
        this.compass.update();
        this.space.update();
        this.credits.update();
        this.link.updateLink();
        this.search.update();
    }

    if (this.loading.control.getVisible()) {
        this.loading.update();
    }
};


export default UI;
