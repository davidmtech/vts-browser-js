
const MapView = function(map, json, fixPaths) {
    this.map = map;
    //this.id = json["id"] || null;
    this.parse(json, fixPaths);
};


MapView.prototype.parse = function(json, fixPaths) {
    //this.description = json['description'] || '';
    //this.boundLayers = json["boundLayers"] || [];
    this.freeLayers = json['freeLayers'] || {};
    this.surfaces = {};
    this.options = json['options'] || {};

    if (json['surfaces']) {
        const surfaces = json['surfaces'];
        if (Array.isArray(surfaces)) { //convert from old version
            for (let i = 0, li = surfaces.length; i < li; i++) {
                this.surfaces[surfaces[i]] = [];
            }
        } else {
            this.surfaces = surfaces;
        }
    }

    if (!this.freeLayers || Array.isArray(this.freeLayers)) { //convert from old version
        this.freeLayers = {};
    } else {
        this.freeLayers = JSON.parse(JSON.stringify(this.freeLayers));

        if (fixPaths) {
            for (let key in this.freeLayers) {
                const layer = this.freeLayers[key];

                if (typeof layer['style'] === 'string') {
                    layer['style'] = this.processUrl(layer['style'], '');
                }
            }
        }
    }

    this.surfaces = JSON.parse(JSON.stringify(this.surfaces));
    this.options = JSON.parse(JSON.stringify(this.options));
};


MapView.prototype.processUrl = function(url, fallback) {
    if (!url) {
        return fallback;
    }

    if (typeof url !== 'string') {
        return url;
    }

    url = url.trim();

    if (url.indexOf('://') != -1) { //absolute
        return url;
    } else if (url.indexOf('//') == 0) {  //absolute without schema
        return this.map.url.baseUrlSchema + url;
    } else if (url.indexOf('/') == 0) {  //absolute without host
        return this.map.url.baseUrlOrigin + url;
    } else {  //relative
        return this.map.url.baseUrl + url;
    }
};


MapView.prototype.getInfo = function() {
    const view = {
        //'description' : JSON.parse(JSON.stringify(this.description)),
        'surfaces' : JSON.parse(JSON.stringify(this.surfaces)),
        'freeLayers' : JSON.parse(JSON.stringify(this.freeLayers)),
        'options' : JSON.parse(JSON.stringify(this.options)),
    };

    //const renderer = this.map.renderer;

    if (this.map.renderer.getSuperElevationState()) {
        const se = this.map.renderer.getSuperElevation();

        view['options'] = {
            'superelevation' : [[se[0],se[2]],[se[1],se[3]]]
        }
    }

    return view;
};


export default MapView;
