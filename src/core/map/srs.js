
import MapTexture_ from './texture';
import {math as math_} from '../utils/math';
import GeographicLib_ from 'geographiclib';

//get rid of compiler mess
const MapTexture = MapTexture_;
const math = math_;
const GeographicLib = GeographicLib_;


const MapSrs = function(map, id, json) {
    this.map = map;
    this.id = id;
    this.proj4 = map.proj4;
    this.comment = json['comment'] || null;
    this.srsDef = json['srsDef'] || null;
    this.srsModifiers = json['srsModifiers'] || [];
    this.type = json['type'] || 'projected';
    this.vdatum = json['vdatum'] || 'orthometric';
    //this.srsDefEllps = json["srsDefEllps"] || "";
    this.srsDef = json['srsDefEllps'] || this.srsDef;
    this.periodicity = this.parsePeriodicity(json['periodicity']);
    this.srsInfo = this.proj4(this.srsDef).info();
    this.geoidGrid = null;
    this.geoidGridMap = null;
    this.srsProj4 = this.proj4(this.srsDef, null, null, true);
    this.latlonProj4 = null;
    this.proj4Cache = {};

    if (json['geoidGrid']) {
        const geoidGridData = json['geoidGrid'];

        this.geoidGrid = {
            definition : geoidGridData['definition'] || null,
            srsDefEllps : geoidGridData['srsDefEllps'] || null,
            valueRange : geoidGridData['valueRange'] || [0,1]
        };

        if (geoidGridData['extents']) {
            this.geoidGrid.extents = {
                ll : geoidGridData['extents']['ll'],
                ur : geoidGridData['extents']['ur']
            };
        } else {
            this.geoidGrid.extents = {
                ll : [0,0],
                ur : [1,1]
            };
        }

        if (this.geoidGrid.definition) {
            const url = this.map.url.makeUrl(this.geoidGrid.definition, {}, null);
            this.geoidGridMap = new MapTexture(this.map, url, true);
        }

        if (this.geoidGrid.srsDefEllps) {
            this.geoidGrid.srsProj4 = this.proj4(this.geoidGrid.srsDefEllps, null, null, true);
        }
    }

    if (this.type == 'geographic') {
        this.spheroid = json['spheroid'] || null;

        if (this.spheroid == null) {
            //TODO: return error
        }
    }
};


MapSrs.prototype.parsePeriodicity = function(periodicityData) {
    if (periodicityData == null) {
        return null;
    }

    const periodicity = {
        'type' : periodicityData['type'] || '',
        'period' : periodicityData['period'] || 0
    };

    return periodicity;
};


MapSrs.prototype.getInfo = function() {
    return {
        'comment' : this.comment,
        'srsDef' : this.srsDef,
        'srsModifiers' : this.srsModifiers,
        'type' : this.type,
        'vdatum' : this.vdatum,
        'srsDefEllps' : this.srsDef,
        'a' : this.srsInfo['a'],
        'b' : this.srsInfo['b']
    };
};


MapSrs.prototype.getSrsInfo = function() {
    return this.srsInfo;
};


MapSrs.prototype.isReady = function() {
    return this.isGeoidGridReady();
};


MapSrs.prototype.isGeoidGridReady = function() {
    return (this.geoidGrid == null ||
           (this.geoidGridMap != null && this.geoidGridMap.isReady()));
};


MapSrs.prototype.isProjected = function() {
    return (this.type == 'projected');
};


MapSrs.prototype.getOriginalHeight = function(coords) {
    let height = coords[2] || 0;
    height /= this.getVerticalAdjustmentFactor(coords);
    height += this.getGeoidGridDelta(coords);
    return height;
};


MapSrs.prototype.getFinalHeight = function(coords) {
    let height = coords[2] || 0;
    height -= this.getGeoidGridDelta(coords);
    height *= this.getVerticalAdjustmentFactor(coords);
    return height;
};


MapSrs.prototype.getGeoidGridDelta = function(coords) {
    if (this.geoidGridMap != null && this.isGeoidGridReady()) {
        //get cooords in geoidGrid space
        const mapCoords = this.proj4(this.srsProj4, this.geoidGrid.srsProj4, [coords[0], coords[1]]);

        //get image coords
        let px = mapCoords[0] - this.geoidGrid.extents.ll[0];
        let py = this.geoidGrid.extents.ur[1] - mapCoords[1];

        const imageExtens = this.geoidGridMap.getImageExtents();

        px *= imageExtens[0] / (this.geoidGrid.extents.ur[0] - this.geoidGrid.extents.ll[0]);
        py *= imageExtens[1] / (this.geoidGrid.extents.ur[1] - this.geoidGrid.extents.ll[1]);

        px = math.clamp(px, 0, imageExtens[0] - 2);
        py = math.clamp(py, 0, imageExtens[1] - 2);

        //get bilineary interpolated value from image
        const ix = Math.floor(px);
        const iy = Math.floor(py);
        const fx = px - ix;
        const fy = py - iy;

        const data = this.geoidGridMap.getImageData();
        const index = iy * imageExtens[0];
        const index2 = index + imageExtens[0];
        const h00 = data[(index + ix)*4];
        const h01 = data[(index + ix + 1)*4];
        const h10 = data[(index2 + ix)*4];
        const h11 = data[(index2 + ix + 1)*4];
        const w0 = (h00 + (h01 - h00)*fx);
        const w1 = (h10 + (h11 - h10)*fx);
        let delta = (w0 + (w1 - w0)*fy);

        //strech deta into value range
        delta = this.geoidGrid.valueRange[0] + (delta * ((this.geoidGrid.valueRange[1] - this.geoidGrid.valueRange[0]) / 255));

        return delta;
    }

    return 0;
};


MapSrs.prototype.getVerticalAdjustmentFactor = function(coords) {
    if (this.srsModifiers.indexOf('adjustVertical') != -1) {
        const info = this.getSrsInfo();

        //convert coords to latlon
        const latlonProj = '+proj=longlat ' +
                          ' +alpha=0' +
                          ' +gamma=0 +a=' + info['a'] +
                          ' +b=' + info['b'] +
                          ' +x0=0 +y0=0';

        if (!this.latlonProj4) {
            this.latlonProj4 = this.proj4(latlonProj, null, null, true);
        }

        let coords2 = this.proj4(this.srsProj4, this.latlonProj4, [coords[0], coords[1]]);

        //move coors 1000m
        const geod = new GeographicLib.Geodesic.Geodesic(info['a'],
                                                       (info['a'] / info['b']) - 1.0);


        const r = geod.Direct(coords2[1], coords2[0], 90, 1000);
        coords2 = [r.lon2, r.lat2];

        //convet coords from latlon back to projected
        coords2 = this.proj4(this.latlonProj4, this.srsProj4, coords2);

        //get distance between coords
        const dx = coords2[0] - coords[0];
        const dy = coords2[1] - coords[1];

        const distance = Math.sqrt(dx * dx + dy* dy);

        //get factor
        const factor = distance / 1000;

        return factor;
    }

    return 1.0;
};


MapSrs.prototype.convertCoordsTo = function(coords, srs, skipVerticalAdjust) {
    this.isReady();
    if (typeof srs !== 'string') {
        if (srs.id == this.id) {
            return coords.slice();
        }

        srs.isReady();
    }

    coords = coords.slice();

    const stringSrs = (typeof srs === 'string');

    //if (!skipVerticalAdjust && stringSrs) {
    coords[2] = this.getOriginalHeight(coords);
    //}

    const srsDef = (stringSrs) ? srs : srs.srsProj4;

    /*
    if (srsDef.isGeocent && this.srsProj4.projName == "merc") {
        const coords3 = coords.slice();
        this.convertMercToWGS(coords3);
        this.convertWGSToGeocent(coords3, srsDef);
        return coords3;
    }*/


    const srsDef2 = (stringSrs) ? srs : srs.srsDef;
    //const coords2 = this.proj4(this.srsProj4, srsDef, coords);

    let proj = this.proj4Cache[srsDef2];

    if (!proj) {
        proj = this.proj4(this.srsProj4, srsDef);
        this.proj4Cache[srsDef2] = proj;
    }

    const coords2 = proj.forward(coords);

    if (!skipVerticalAdjust && !stringSrs) {
        coords2[2] = srs.getFinalHeight(coords2);
    }

    return coords2;
};


MapSrs.prototype.convertCoordsToFast = function(coords, srs, skipVerticalAdjust, coords2, index, index2) {

    //if (!skipVerticalAdjust && stringSrs) {
        //coords[2] = this.getOriginalHeight(coords);
    //}

    const srsDef = srs.srsProj4;

    /*
    if (srsDef.isGeocent && this.srsProj4.projName == "merc") {
        this.convertMercToWGS(coords, coords2, index, index2);
        this.convertWGSToGeocent(coords2, srsDef, coords2, index2, index2);
        return;
    }*/

    const srsDef2 = srs.srsDef;

    let proj = this.proj4Cache[srsDef2];

    if (!proj) {
        proj = this.proj4(this.srsProj4, srsDef);
        this.proj4Cache[srsDef2] = proj;
    }

    const coords3 = proj.forward(coords);

    coords2[index2] = coords3[0];
    coords2[index2+1] = coords3[1];
    coords2[index2+2] = coords3[2];


    //if (!skipVerticalAdjust && stringSrs) {
        //coords2[2] = srs.getFinalHeight(coords2);
    //}

    if (srs.geoidGrid) {
        coords2[index2+2] -= srs.getGeoidGridDelta(coords);
    }
};


MapSrs.prototype.convertCoordsFrom = function(coords, srs) {
    this.isReady();
    if (typeof srs !== 'string') {
        if (srs.id == this.id) {
            return coords.slice();
        }

        srs.isReady();
    }

    coords = coords.slice();

    if (typeof srs !== 'string') {
        coords[2] = srs.getOriginalHeight(coords);
    }

    const srsDef = (typeof srs === 'string') ? srs : srs.srsProj4;
    const srsDef2 = (typeof srs === 'string') ? srs : srs.srsDef;

    //const coords2 = this.proj4(srsDef, this.srsProj4, coords);

    let proj = this.proj4Cache[srsDef2];

    if (!proj) {
        proj = this.proj4(this.srsProj4, srsDef);
        this.proj4Cache[srsDef2] = proj;
    }

    const coords2 = proj.inverse(coords);

    coords2[2] = this.getFinalHeight(coords2);

    return coords2;
};


MapSrs.prototype.phi2z = function(eccent, ts) {
    const HALFPI = Math.PI*0.5;
    const eccnth = 0.5 * eccent;
    let phi = HALFPI - 2 * Math.atan(ts);
    let con, dphi;
    for (let i = 0; i <= 15; i++) {
        con = eccent * Math.sin(phi);
        dphi = HALFPI - 2 * Math.atan(ts * (Math.pow(((1 - con) / (1 + con)), eccnth))) - phi;
        phi += dphi;
        if (Math.abs(dphi) <= 0.0000000001) {
            return phi;
        }
    }
  //console.log("phi2z has NoConvergence");
    return -9999;
};


MapSrs.prototype.convertMercToWGS = function(coords, coords2, index, index2) {
    const TWOPI = Math.PI * 2;
    const HALFPI = Math.PI*0.5;
    const proj = this.srsProj4;
    let x = coords[index] - proj.x0;
    let y = coords[index+1] - proj.y0;

    if (proj.sphere) {
        coords2[index2+1] = HALFPI - 2 * Math.atan(Math.exp(-y / (proj.a * proj.k0)));
    } else {
        const ts = Math.exp(-y / (proj.a * proj.k0));
        const yy = this.phi2z(proj.e, ts);
        coords2[index2+1] = yy;
        if (yy === -9999) {
            return;
        }
    }

    //coords[0] = adjustlon(proj.long0 + x / (proj.a * proj.k0));
    x = proj.long0 + x / (proj.a * proj.k0);
    const SPI = 3.14159265359;
    coords2[index2] = (Math.abs(x) <= SPI) ? x : (x - ((x < 0) ? -1 : 1) * TWOPI);
    coords2[index2+2] = coords[index+2];
};


MapSrs.prototype.convertWGSToGeocent = function(coords, srs, coords2, index, index2) {
    const datum = srs.datum;

    const HALFPI = Math.PI*0.5;
    let Longitude = coords[index];
    let Latitude = coords[index+1];
    const Height = coords[index+2]; //Z value not always supplied

    let Rn; /*  Earth radius at location  */
    let SinLat; /*  Math.sin(Latitude)  */
    let Sin2Lat; /*  Square of Math.sin(Latitude)  */
    let CosLat; /*  Math.cos(Latitude)  */

    /*
     ** Don't blow up if Latitude is just a little out of the value
     ** range as it may just be a rounding issue.  Also removed longitude
     ** test, it should be wrapped by Math.cos() and Math.sin().  NFW for PROJ.4, Sep/2001.
     */
    if (Latitude < -HALFPI && Latitude > -1.001 * HALFPI) {
        Latitude = -HALFPI;
    }
    else if (Latitude > HALFPI && Latitude < 1.001 * HALFPI) {
        Latitude = HALFPI;
    }
    else if ((Latitude < -HALFPI) || (Latitude > HALFPI)) {
      /* Latitude out of range */
      //..reportError('geocent:lat out of range:' + Latitude);
        return null;
    }

    if (Longitude > Math.PI) {
        Longitude -= (2 * Math.PI);
    }

    SinLat = Math.sin(Latitude);
    CosLat = Math.cos(Latitude);
    Sin2Lat = SinLat * SinLat;
    Rn = datum.a / (Math.sqrt(1.0e0 - datum.es * Sin2Lat));
    coords2[index2] = (Rn + Height) * CosLat * Math.cos(Longitude);
    coords2[index2+1] = (Rn + Height) * CosLat * Math.sin(Longitude);
    coords2[index2+2] = ((Rn * (1 - datum.es)) + Height) * SinLat;
};


export default MapSrs;
