import Proj4 from 'melowntech-proj4';
import earcut from 'earcut';
import {getCoreVersion as getCoreVersion_, checkSupport as checkSupport_} from './core';
import {CoreInterface as CoreInterface_} from './interface';
import {vec2 as vec2_, vec3 as vec3_, vec4 as vec4_, mat3 as mat3_, mat4 as mat4_} from './utils/matrix';
import {utils as utils_} from './utils/utils';
import {math as math_} from './utils/math';
import {platform as platform_} from './utils/platform';

//get rid of compiler mess
const getCoreVersion = getCoreVersion_, checkSupport = checkSupport_;
const CoreInterface = CoreInterface_;
const vec2 = vec2_, vec3 = vec3_, vec4 = vec4_, mat3 = mat3_, mat4 = mat4_;
const utils = utils_;
const math = math_;
const proj4 = Proj4;
const platform = platform_;


function core(element, config) {
    element = (typeof element !== 'string') ? element : document.getElementById(element);

    if (checkSupport()) {
        return new CoreInterface(element, config);
    } else {
        return null;
    }
}


export {vec2,vec3,vec4,mat3,mat4,math,utils,getCoreVersion,checkSupport,core,proj4,earcut,platform};
