
import {utils as utils_} from '../utils/utils';
import {utilsUrl as utilsUrl_} from '../utils/url';

//get rid of compiler mess
const utilsUrl = utilsUrl_;
const utils = utils_;


const MapUrl = function(map, path) {
    this.map = map;

    path = path.trim();
    this.baseUrl = utilsUrl.getBase(path);
    this.baseUrlSchema = utilsUrl.getSchema(path);
    this.baseUrlOrigin = utilsUrl.getOrigin(path);

    this.urlCounter = 0;
};


MapUrl.prototype['quad'] = function(lod, ix, iy) {
    let quadKey = '';
    //ty = Math.pow(2,zoom - 1) - ty;
    for (let i = lod; i > 0; i--) {
        let digit = 0;
        const mask = 1 << (i-1);
        if ((ix & mask) != 0) {
            digit += 1;
        }

        if ((iy & mask) != 0) {
            digit += 2;
        }

        quadKey += digit;
    }

    return quadKey;
};


MapUrl.prototype['msDigit'] = function(iy, ix) {
    return (((iy & 3) << 1) + (ix & 1));
};


MapUrl.prototype.hex = function(v) {
    let s = v.toString(16);
    while (s.length < 8) {
        s = '0' + s;
    }
    return s;
};


MapUrl.prototype['ppx'] = function(lod, ix) {
    return this.hex(ix << (28 - lod), 7);
};


MapUrl.prototype['ppy'] = function(lod, iy) {
    return this.hex((1 << 28) - ((iy + 1) << (28 - lod)), 7);
};


MapUrl.prototype.processUrlFunction = function(id, counter, string) {
    let string2, fc;
    if (typeof string == 'string') {
        if (string.indexOf('quad') != -1) {
            string2 = '(function(lod,x,y,loclod,locx,locy){' + string.replace('quad', 'return this.quad') + '})';

            try {
                fc = eval(string2).bind(this);
                return fc(id.lod, id.ix, id.iy, id.loclod, id.locx, id.locy);
            } catch(e) {
                return string;
            }
        } else if (string.indexOf('msdigit') != -1) {
            string2 = '(function(x,y,loclod,locx,locy){' + string.replace('msdigit', 'return this.msDigit') + '})';

            try {
                fc = eval(string2).bind(this);
                return fc(id.ix, id.iy, id.loclod, id.locx, id.locy);
            } catch(e) {
                return string;
            }

        } else if (string.indexOf('alt') != -1) {
            const result = /\(([^)]*)\)/.exec(string);

            if (result && result[1]) {
                const strings = result[1].match(/([^,]+)/g);

                if (strings.length > 0) {
                    return strings[(counter % strings.length)];
                }
            }

            return string;

        } else if (string.indexOf('ppx') != -1) {
            string2 = '(function(lod,x,loclod,locx){' + string.replace('ppx', 'return this.ppx') + '})';

            try {
                fc = eval(string2).bind(this);
                return fc(id.lod, id.ix, id.loclod, id.locx);
            } catch(e) {
                return string;
            }

        } else if (string.indexOf('ppy') != -1) {
            string2 = '(function(lod,y,loclod,locy){' + string.replace('ppy', 'return this.ppy') + '})';

            try {
                fc = eval(string2).bind(this);
                return fc(id.lod, id.iy, id.loclod, id.locy);
            } catch(e) {
                return string;
            }

        } else {
            return string;
        }

    } else {
        return string;
    }
};


MapUrl.prototype.findLocalRoot = function(id) {
    const nodes = this.map.referenceFrame.getSpatialDivisionNodes();
    const validNodes = [];

    for (let i = 0, li = nodes.length; i < li; i++) {
        const node = nodes[i];

        const delta = id[0] - node.id[0];
        const ix = id[1] >> delta;
        const iy = id[2] >> delta;

        if (ix == node.id[1] && iy == node.id[2]) {
            validNodes.push(node);
        }
    }

    let bestNode = null;
    let bestLod = -1;

    for (let i = 0, li = validNodes.length; i < li; i++) {
        if (validNodes[i].id[0] > bestLod) {
            bestNode = validNodes[i];
        }
    }

    if (bestNode) {
        return bestNode.id.slice();
    } else {
        return [0,0,0];
    }
};


MapUrl.prototype.makeUrl = function(templ, id, subId, skipBaseUrl) {
    //if (templ.indexOf("jpg") != -1) {
       //templ = "{lod}-{easting}-{northing}.jpg?v=4";
       //templ = "{lod}-{x}-{y}.jpg?v=4";
       //templ = "{quad(lod,x,y)}.jpg?v=4";
       //templ = "{quad(lod,x+1,y*2)}.jpg?v=4";
       //templ = "{lod}-{msdigit(x,y)}.jpg?v=4";
    //}
    //templ = "maps{alt(1,2,3,4)}.irist-test.citationtech.net/map/{lod}-{x}-{y}.jpg?v=4";

    let locx = 0;
    let locy = 0;
    let loclod = 0;

    if (id.lod) {
        const localRoot = this.findLocalRoot([id.lod, id.ix, id.iy]);
        loclod = id.lod - localRoot[0];
        const mask = (1 << loclod) - 1;
        locx = id.ix & mask;
        locy = id.iy & mask;
    }

    const id2 = {
        lod: id.lod,
        ix : id.ix,
        iy : id.iy,
        loclod: loclod,
        locx : locx,
        locy : locy
    };

    //remove white spaces from template
    templ = templ.replace(/ /g, '');

    const url = utils.simpleFmtObjOrCall(templ, {'lod':id.lod,  'x':id.ix, 'y':id.iy, 'sub': subId,
        'locx':locx, 'locy':locy, 'loclod':loclod, 'geonavtile': subId,
        'hereappid': 'abcde', 'hereappcode':'12345'},
                                               this.processUrlFunction.bind(this, id2, this.urlCounter));

    this.urlCounter++;

    skipBaseUrl = (url.indexOf('//') != -1);

    /* //useful for debug
    let tmp;

    if (skipBaseUrl) {
        tmp =  url;
    } else {
        tmp = this.baseUrl + url;
    }
    */

    if (skipBaseUrl) {
        if (url.indexOf('//') == 0) {
            return this.baseUrlSchema + url;
        } else {
            return url;
        }
    } else {
        return this.baseUrl + url;
    }
};


MapUrl.prototype.processUrl = function(url, fallback) {
    if (!url) {
        return fallback;
    }

    url = url.trim();

    if (url.indexOf('://') != -1) { //absolute
        return url;
    } else if (url.indexOf('//') == 0) {  //absolute without schema
        return this.baseUrlSchema + url;
    } else if (url.indexOf('/') == 0) {  //absolute without host
        return this.baseUrlOrigin + url;
    } else {  //relative
        return this.baseUrl + url;
    }
};


export default MapUrl;
