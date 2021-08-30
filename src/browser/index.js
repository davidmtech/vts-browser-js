
import Proj4 from 'melowntech-proj4';
import earcut from 'earcut';
import {getCoreVersion as getCoreVersion_, checkSupport as checkSupport_} from '../core/core';
import {vec2 as vec2_, vec3 as vec3_, vec4 as vec4_, mat3 as mat3_, mat4 as mat4_} from '../core/utils/matrix';
import {utils as utils_} from '../core/utils/utils';
import {math as math_} from '../core/utils/math';
import {platform as platform_} from '../core/utils/platform';
import BrowserInterface_ from './interface';
import Dom_ from './utility/dom';

//get rid of compiler mess
const getCoreVersion = getCoreVersion_, checkSupport = checkSupport_;
const vec2 = vec2_, vec3 = vec3_, vec4 = vec4_, mat3 = mat3_, mat4 = mat4_;
const utils = utils_;
const dom = Dom_;
const math = math_;
const BrowserInterface = BrowserInterface_;
const proj4 = Proj4;
const platform = platform_;

function browser (element, config) {
    const browserInterface = new BrowserInterface(element, config);
    return browserInterface.core ? browserInterface : null;
}

function getBrowserVersion() {
//    return "Browser: 2.0.0, Core: " + getCoreVersion();
    return '' + getCoreVersion();
}

export {vec2,vec3,vec4,mat3,mat4,math,utils,getCoreVersion,checkSupport,browser,getBrowserVersion,proj4,earcut,platform,dom};
