
const MapGeodataImportGeoJSON = function(builder, heightMode, srs, options) {
    this.builder = builder;
    this.map = builder.map;
    this.heightMode = heightMode || 'float';
    this.srs = srs;

    options = options || {};

    this.groupIdPrefix = options['groupIdPrefix'] || '';
    this.dontCreateGroups = options['dontCreateGroups'];
    this.tesselation = options['tesselation'];
};

MapGeodataImportGeoJSON.prototype.processGeometry = function(geometry, feature) {
    const coords = geometry['coordinates'];
    if (!coords) {
        return;
    }

    switch(geometry['type']) {
        case 'Point':
            this.builder.addPoint(coords, this.heightMode, feature['properties'], feature['properties'] ? feature['properties']['id'] : null, this.srs);
            break;

        case 'MultiPoint':
            this.builder.addPointArray(coords, this.heightMode, feature['properties'], feature['properties'] ? feature['properties']['id'] : null, this.srs);
            break;

        case 'LineString':
            this.builder.addLineString(coords, this.heightMode, feature['properties'], feature['properties'] ? feature['properties']['id'] : null, this.srs);
            break;

        case 'MultiLineString':
            this.builder.addLineStringArray(coords, this.heightMode, feature['properties'], feature['properties'] ? feature['properties']['id'] : null, this.srs);
            break;

        case 'Polygon':
            if (coords.length > 0) {
                this.builder.addPolygon(coords[0], (coords.length > 1) ? coords.slice(1) : [], null, this.heightMode, feature['properties'], feature['properties'] ? feature['properties']['id'] : null, this.srs, this.tesselation);
            }
            break;

        case 'MultiPolygon':
            for (let i = 0, li = coords.length; i < li; i++) {
                const coords2 = coords[i];
                if (coords2.length > 0) {
                    this.builder.addPolygon(coords2[0], (coords2.length > 1) ? coords2.slice(1) : [], null, this.heightMode, feature['properties'], feature['properties'] ? feature['properties']['id'] : null, this.srs, this.tesselation);
                }
            }
            break;

        case 'GeometryCollection':
            {
                const geometries = geometry['gemetries'];

                if (geometries) {
                    for (let i = 0, li = geometries.length; i < li; i++) {
                        this.processGeometry(geometries[i], feature);
                    }
                }
            }
            break;
    }
};

MapGeodataImportGeoJSON.prototype.processFeature = function(json) {
    const geometry = json['geometry'];

    if (geometry) {
        this.processGeometry(geometry, json);
    }
};

MapGeodataImportGeoJSON.prototype.processCollection = function(json) {
    const features = json['features'];

    if (!features) {
        return;
    }

    for (let i = 0, li = features.length; i < li; i++) {
        this.processFeature(features[i]);
    }
};

MapGeodataImportGeoJSON.prototype.processJSON = function(json) {
    if (!json) {
        return;
    }

    if (json['type']) {

        switch (json['type']) {
            case 'FeatureCollection':

                if (!this.dontCreateGroups) {
                    this.builder.addGroup(this.groupIdPrefix != '' ? this.groupIdPrefix : null);
                }

                this.processCollection(json);
                break;
            case 'Feature':

                if (!this.dontCreateGroups) {
                    this.builder.addGroup(this.groupIdPrefix != '' ? this.groupIdPrefix : null);
                }

                this.processFeature(json);
                break;
        }

    } else {

        for (let key in json) {
            const item = json[key];

            if (!this.dontCreateGroups) {
                this.builder.addGroup(this.groupIdPrefix + key);
            }

            switch (json['type']) {
                case 'FeatureCollection':
                    this.processCollection(item);
                    break;
                case 'Feature':
                    this.processFeature(item);
                    break;
            }
        }
    }

};

export default MapGeodataImportGeoJSON;
