
import {globals as globals_, vec3Normalize as vec3Normalize_,
        vec3Cross as vec3Cross_} from './worker-globals.js';
import {getLayerPropertyValue as getLayerPropertyValue_,
        getLayerExpresionValue as getLayerExpresionValue_, hasLayerProperty as hasLayerProperty_} from './worker-style.js';
import {addStreetTextOnPath as addStreetTextOnPath_, getTextGlyphs as getTextGlyphs_,
        areTextCharactersAvailable as areTextCharactersAvailable_,
        getCharVerticesCount as getCharVerticesCount_, getFonts as getFonts_, getFontsStorage as getFontsStorage_} from './worker-text.js';
import {postGroupMessageFast as postGroupMessageFast_} from './worker-message.js';
import {checkDPoints as checkDPoints_} from './worker-pointarray.js';

//get rid of compiler mess
const globals = globals_, vec3Normalize = vec3Normalize_,
      vec3Cross = vec3Cross_;
const getLayerPropertyValue = getLayerPropertyValue_,
      getLayerExpresionValue = getLayerExpresionValue_, hasLayerProperty = hasLayerProperty_;
const addStreetTextOnPath = addStreetTextOnPath_, areTextCharactersAvailable = areTextCharactersAvailable_,
      getCharVerticesCount = getCharVerticesCount_, getFonts = getFonts_, getFontsStorage = getFontsStorage_;
const postGroupMessageFast = postGroupMessageFast_, getTextGlyphs = getTextGlyphs_;
const checkDPoints = checkDPoints_;


/*const getLineInfo = function(lineString, lod, style, featureIndex, zIndex, eventInfo) {
};*/

function processLineStringPass(lineString, lod, style, featureIndex, zIndex, eventInfo) {

    checkDPoints(lineString);

    const lines = lineString['lines'];

    if (!lines || lines.length == 0) {
        return;
    }

    const line = getLayerPropertyValue(style, 'line', lineString, lod);
    const lineLabel = getLayerPropertyValue(style, 'line-label', lineString, lod);

    if (!line && !lineLabel) {
        return;
    }

    const hoverEvent = getLayerPropertyValue(style, 'hover-event', lineString, lod);
    const clickEvent = getLayerPropertyValue(style, 'click-event', lineString, lod);
    const drawEvent = getLayerPropertyValue(style, 'draw-event', lineString, lod);
    const enterEvent = getLayerPropertyValue(style, 'enter-event', lineString, lod);
    const leaveEvent = getLayerPropertyValue(style, 'leave-event', lineString, lod);
    const advancedHit = getLayerPropertyValue(style, 'advanced-hit', lineString, lod);

    const zbufferOffset = getLayerPropertyValue(style, 'zbuffer-offset', lineString, lod);
    let lineFlat;

    // eslint-disable-next-line
    if (hasLayerProperty(style,'line-type')) {

    } else {
        lineFlat = getLayerPropertyValue(style, 'line-flat', lineString, lod);
    }

    let lineWidth = 0.5 * getLayerPropertyValue(style, 'line-width', lineString, lod);
    const lineColor = getLayerPropertyValue(style, 'line-color', lineString, lod);
    const lineWidthUnits = getLayerPropertyValue(style, 'line-width-units', lineString, lod);

    const lineStyle = getLayerPropertyValue(style, 'line-style', lineString, lod);
    const lineStyleTexture = getLayerPropertyValue(style, 'line-style-texture', lineString, lod);
    const lineStyleBackground = getLayerPropertyValue(style, 'line-style-background', lineString, lod);

    const lineLabelSize = getLayerPropertyValue(style, 'line-label-size', lineString, lod);

    const texturedLine = (lineStyle != 'solid');
    const widthByRatio = (lineWidthUnits == 'ratio');

    if (lineWidthUnits == 'points') {
        lineWidth *= globals.pixelFactor / ((1 / 72) * (96));
    }

    let index = 0, index2 = 0, index3 = 0;
    let skipJoins = false;

    if (widthByRatio) {
        skipJoins = (!lineFlat && ((lineWidth/* *globals.invPixelFactor*/)*1080) < 2.1);
    } else {
        skipJoins = (!lineFlat && (lineWidth/* *globals.invPixelFactor*/) < 2.1);
    }

    let ii, i, li, p2, v, vv, l, n, nn, p1, p, elementIndex, elementBase = 0;
    let circleBuffer, circleBuffer2, circleSides;

    if (!skipJoins) {
        circleBuffer = [];
        circleBuffer2 = [];
        circleSides = 8;//Math.max(8, (14 - lod) * 8);

        let angle = 0, step = (2.0*Math.PI) / circleSides;

        for (i = 0; i < circleSides; i++) {
            circleBuffer[i] = [-Math.sin(angle), Math.cos(angle)];
            circleBuffer2[i] = angle;
            angle += step;
        }

        circleBuffer[circleSides] = [0, 1.0];
        circleBuffer2[circleSides] = 0;
    }

    let totalPoints = 0;

    for (ii = 0; ii < lines.length; ii++) {
        if (Array.isArray(lines[ii])) {
            totalPoints += lines[ii].length;
        }
    }

    if (totalPoints <= 1) {
        return;
    }

    if (lineFlat) {
        circleSides = 2;
    }

    //allocate buffers
    const lineVertices = ((texturedLine || (widthByRatio)) || !lineFlat ? 4 : 3) * 3 * 2;
    const joinVertices = skipJoins ? 0 : (circleSides * ((texturedLine || (widthByRatio)) || !lineFlat? 4 : 3) * 3);
    const vertexBuffer = new Float32Array((totalPoints-1) * lineVertices + totalPoints * joinVertices);
    let elementBuffer;

    if (advancedHit) {
        elementBuffer = new Float32Array((totalPoints-1) * (3 * 2) + totalPoints * (skipJoins ? 0 : circleSides) * 3);
    }

    let lineNormals, joinNormals, normalBuffer;

    if (!(lineFlat && !texturedLine && !widthByRatio)) {
        lineNormals = 3 * 4 * 2;
        joinNormals = skipJoins ? 0 : (circleSides * 3 * 4);
        normalBuffer = new Float32Array((totalPoints-1) * lineNormals + totalPoints * joinNormals);
    }

    let center = [0,0,0];
    let lineLabelStack = [];
    const forceOrigin = globals.forceOrigin;
    const bboxMin = globals.bboxMin;
    const geocent = globals.geocent;
    const tileX = globals.tileX;
    const tileY = globals.tileY;
    const forceScale = globals.forceScale;
    let vstart = [1,0,0], vend = [-1,0,0];
    let lineLabelPoints, lineLabelPoints2;

    for (ii = 0; ii < lines.length; ii++) {
        if (!Array.isArray(lines[ii]) || !lines[ii].length) {
            continue;
        }

        const points = lines[ii];

        if (lineLabel) {
            lineLabelPoints = new Array(points.length);
            lineLabelPoints2 = new Array(points.length);

            lineLabelStack.push({points: lineLabelPoints, points2 :lineLabelPoints2});
        }

        p = points[0];
        p1 = [p[0], p[1], p[2]];

        if (forceOrigin) {
            p1 = [p1[0] - tileX, p1[1] - tileY, p1[2]];
        }

        if (forceScale != null) {
            p1 = [p1[0] * forceScale[0], p1[1] * forceScale[1], p1[2] * forceScale[2]];
        }

        let distance = 0.001;
        let distance2 = 0.001;
        /*let ln = null;*/
        let vertexBase = index;
        let normalBase = index2;

        //add lines
        for (i = 0, li = points.length - 1; i < li; i++) {

            p1 = points[i];
            p2 = points[i+1];

            if (forceOrigin) {
                p1 = [p1[0] - tileX, p1[1] - tileY, p1[2]];
                p2 = [p2[0] - tileX, p2[1] - tileY, p2[2]];
            }

            if (forceScale != null) {
                p1 = [p1[0] * forceScale[0], p1[1] * forceScale[1], p1[2] * forceScale[2]];
                p2 = [p2[0] * forceScale[0], p2[1] * forceScale[1], p2[2] * forceScale[2]];
            }

            if (advancedHit) {
                elementIndex = elementBase + i;

                elementBuffer[index3] = elementIndex;
                elementBuffer[index3+1] = elementIndex;
                elementBuffer[index3+2] = elementIndex;

                //add polygon
                elementBuffer[index3+3] = elementIndex;
                elementBuffer[index3+4] = elementIndex;
                elementBuffer[index3+5] = elementIndex;

                index3 += 6;
            }

            if (lineFlat && !texturedLine && !widthByRatio) {

                //normalize vector to line width and rotate 90 degrees
                if (geocent) {
                    //direction vector
                    v = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];

                    //get line length
                    l = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
                    distance2 += l;

                    l = (l != 0) ? (1 / l) : 0;

                    vv = [v[0]*l, v[1]*l, v[2]*l];
                    n = [0,0,0];
                    nn = [0,0,0];

                    vec3Normalize(bboxMin, nn);
                    vec3Cross(nn, vv, n);

                    if (i == 0) {
                        vstart = vv;
                    }

                    if (i == (li - 1)) {
                        vend = vv;
                    }

                    n = [n[0] * lineWidth, n[1] * lineWidth, n[2] * lineWidth];
                } else {
                    //direction vector
                    v = [p2[0] - p1[0], p2[1] - p1[1], 0];

                    //get line length
                    l = Math.sqrt(v[0]*v[0] + v[1]*v[1]);
                    distance2 += l;

                    l = (l != 0) ? (lineWidth / l) : 0;

                    n = [-v[1]*l, v[0]*l, 0];

                    if (i == 0) {
                        vstart = [v[0]*l, v[1]*l, 0];
                    }

                    if (i == (li - 1)) {
                        vend = [v[0]*l, v[1]*l, 0];
                    }
                }

                //add polygon
                vertexBuffer[index] = p1[0] + n[0];
                vertexBuffer[index+1] = p1[1] + n[1];
                vertexBuffer[index+2] = p1[2] + n[2];

                vertexBuffer[index+3] = p1[0] - n[0];
                vertexBuffer[index+4] = p1[1] - n[1];
                vertexBuffer[index+5] = p1[2] - n[2];

                vertexBuffer[index+6] = p2[0] + n[0];
                vertexBuffer[index+7] = p2[1] + n[1];
                vertexBuffer[index+8] = p2[2] + n[2];

                //add polygon
                vertexBuffer[index+9] = p1[0] - n[0];
                vertexBuffer[index+10] = p1[1] - n[1];
                vertexBuffer[index+11] = p1[2] - n[2];

                vertexBuffer[index+12] = p2[0] - n[0];
                vertexBuffer[index+13] = p2[1] - n[1];
                vertexBuffer[index+14] = p2[2] - n[2];

                vertexBuffer[index+15] = p2[0] + n[0];
                vertexBuffer[index+16] = p2[1] + n[1];
                vertexBuffer[index+17] = p2[2] + n[2];

                index += 18;

            } else {


                //console.log("distance("+i+"): " + distance + " " + distance2);

                if (lineFlat) {

                    /*
                    //normalize vector to line width and rotate 90 degrees
                    l = (l != 0) ? (lineWidth / l) : 0;
                    n = [-v[1]*l, v[0]*l,0];

                    if (joinParams != null) {
                        joinParams[i] = (l != 0) ? Math.atan2(v[0], v[1]) + Math.PI *0.5 : 0;
                    }*/

                    //normalize vector to line width and rotate 90 degrees
                    if (geocent) {
                        //direction vector
                        v = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];

                        //get line length
                        l = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
                        distance2 += l;

                        l = (l != 0) ? (1 / l) : 0;

                        vv = [v[0]*l, v[1]*l, v[2]*l];
                        n = [0,0,0];
                        nn = [0,0,0];

                        if (i == 0) {
                            vstart = vv;
                        }

                        if (i == (li - 1)) {
                            vend = vv;
                        }

                        vec3Normalize(bboxMin, nn);
                        vec3Cross(nn, vv, n);

                        //n = [n[0] * lineWidth, n[1] * lineWidth, n[2] * lineWidth];
                        n = [n[0], n[1], n[2]];
                    } else {
                        //direction vector
                        v = [p2[0] - p1[0], p2[1] - p1[1], 0];

                        //get line length
                        l = Math.sqrt(v[0]*v[0] + v[1]*v[1]);
                        distance2 += l;

                        l = (l != 0) ? (lineWidth / l) : 0;

                        n = [-v[1], v[0], 0];

                        if (i == 0) {
                            vstart = [v[0]*l, v[1]*l, 0];
                        }

                        if (i == (li - 1)) {
                            vend = [v[0]*l, v[1]*l, 0];
                        }
                    }

                    //add polygon
                    vertexBuffer[index] = p1[0];
                    vertexBuffer[index+1] = p1[1];
                    vertexBuffer[index+2] = p1[2];
                    vertexBuffer[index+3] = distance;
                    normalBuffer[index2] = n[0];
                    normalBuffer[index2+1] = n[1];
                    normalBuffer[index2+2] = n[2];
                    normalBuffer[index2+3] = lineWidth;

                    vertexBuffer[index+4] = p1[0];
                    vertexBuffer[index+5] = p1[1];
                    vertexBuffer[index+6] = p1[2];
                    vertexBuffer[index+7] = -distance;
                    normalBuffer[index2+4] = -n[0];
                    normalBuffer[index2+5] = -n[1];
                    normalBuffer[index2+6] = -n[2];
                    normalBuffer[index2+7] = lineWidth;

                    vertexBuffer[index+8] = p2[0];
                    vertexBuffer[index+9] = p2[1];
                    vertexBuffer[index+10] = p2[2];
                    vertexBuffer[index+11] = distance2;
                    normalBuffer[index2+8] = n[0];
                    normalBuffer[index2+9] = n[1];
                    normalBuffer[index2+10] = n[2];
                    normalBuffer[index2+11] = lineWidth;

                    //add polygon
                    vertexBuffer[index+12] = p1[0];
                    vertexBuffer[index+13] = p1[1];
                    vertexBuffer[index+14] = p1[2];
                    vertexBuffer[index+15] = -distance;
                    normalBuffer[index2+12] = -n[0];
                    normalBuffer[index2+13] = -n[1];
                    normalBuffer[index2+14] = -n[2];
                    normalBuffer[index2+15] = lineWidth;

                    vertexBuffer[index+16] = p2[0];
                    vertexBuffer[index+17] = p2[1];
                    vertexBuffer[index+18] = p2[2];
                    vertexBuffer[index+19] = -distance2;
                    normalBuffer[index2+16] = -n[0];
                    normalBuffer[index2+17] = -n[1];
                    normalBuffer[index2+18] = -n[2];
                    normalBuffer[index2+19] = lineWidth;

                    vertexBuffer[index+20] = p2[0];
                    vertexBuffer[index+21] = p2[1];
                    vertexBuffer[index+22] = p2[2];
                    vertexBuffer[index+23] = distance2;
                    normalBuffer[index2+20] = n[0];
                    normalBuffer[index2+21] = n[1];
                    normalBuffer[index2+22] = n[2];
                    normalBuffer[index2+23] = lineWidth;

                    index += 24;
                    index2 += 24;

                } else {

                    //direction vector
                    v = [p2[0] - p1[0], p2[1] - p1[1], 0];

                    //get line length
                    l = Math.sqrt(v[0]*v[0] + v[1]*v[1]);
                    distance2 += l;

                    //add polygon
                    vertexBuffer[index] = p1[0];
                    vertexBuffer[index+1] = p1[1];
                    vertexBuffer[index+2] = p1[2];
                    vertexBuffer[index+3] = distance;
                    normalBuffer[index2] = p2[0];
                    normalBuffer[index2+1] = p2[1];
                    normalBuffer[index2+2] = p2[2];
                    normalBuffer[index2+3] = lineWidth;

                    vertexBuffer[index+4] = p1[0];
                    vertexBuffer[index+5] = p1[1];
                    vertexBuffer[index+6] = p1[2];
                    vertexBuffer[index+7] = -distance;
                    normalBuffer[index2+4] = p2[0];
                    normalBuffer[index2+5] = p2[1];
                    normalBuffer[index2+6] = p2[2];
                    normalBuffer[index2+7] = -lineWidth;

                    vertexBuffer[index+8] = p2[0];
                    vertexBuffer[index+9] = p2[1];
                    vertexBuffer[index+10] = p2[2];
                    vertexBuffer[index+11] = -distance2;
                    normalBuffer[index2+8] = p1[0];
                    normalBuffer[index2+9] = p1[1];
                    normalBuffer[index2+10] = p1[2];
                    normalBuffer[index2+11] = lineWidth;

                    //add polygon
                    vertexBuffer[index+12] = p1[0];
                    vertexBuffer[index+13] = p1[1];
                    vertexBuffer[index+14] = p1[2];
                    vertexBuffer[index+15] = distance;
                    normalBuffer[index2+12] = p2[0];
                    normalBuffer[index2+13] = p2[1];
                    normalBuffer[index2+14] = p2[2];
                    normalBuffer[index2+15] = lineWidth;

                    vertexBuffer[index+16] = p2[0];
                    vertexBuffer[index+17] = p2[1];
                    vertexBuffer[index+18] = p2[2];
                    vertexBuffer[index+19] = -distance2;
                    normalBuffer[index2+16] = p1[0];
                    normalBuffer[index2+17] = p1[1];
                    normalBuffer[index2+18] = p1[2];
                    normalBuffer[index2+19] = lineWidth;

                    vertexBuffer[index+20] = p2[0];
                    vertexBuffer[index+21] = p2[1];
                    vertexBuffer[index+22] = p2[2];
                    vertexBuffer[index+23] = distance2;
                    normalBuffer[index2+20] = p1[0];
                    normalBuffer[index2+21] = p1[1];
                    normalBuffer[index2+22] = p1[2];
                    normalBuffer[index2+23] = -lineWidth;

                    index += 24;
                    index2 += 24;
                }
            }

            distance = distance2;
            p1 = p2; //only for dlines
        }

        p1 = [p[0], p[1], p[2]];

        //add joins
        for (i = 0, li = points.length; i < li; i++) {

            if (forceOrigin) {
                p1 = [p1[0] - tileX, p1[1] - tileY, p1[2]];
            }

            if (forceScale != null) {
                p1 = [p1[0] * forceScale[0], p1[1] * forceScale[1], p1[2] * forceScale[2]];
            }

            center[0] += p1[0];
            center[1] += p1[1];
            center[2] += p1[2];

            if (!skipJoins) {
                let angleShift = 0;//(joinParams != null) ? joinParams[i] : 0;
                /*let dx, dy;*/

                if (lineFlat) {

                    if (advancedHit) {
                        elementIndex = elementBase + ((i != (li-1)) ? i : (i -1));

                        elementBuffer[index3] = elementIndex;
                        elementBuffer[index3+1] = elementIndex;
                        elementBuffer[index3+2] = elementIndex;

                        //add polygon
                        elementBuffer[index3+3] = elementIndex;
                        elementBuffer[index3+4] = elementIndex;
                        elementBuffer[index3+5] = elementIndex;

                        index3 += 6;
                    }

                    let lineIndex, lineIndex2;

                    if (!(texturedLine || widthByRatio)) {

                        if (i != (li-1)) {
                            lineIndex = vertexBase + i * lineVertices;
                        } else {
                            lineIndex = vertexBase + (i - 1) * lineVertices;
                        }

                        if (i > 0) {
                            lineIndex2 = vertexBase + (i - 1) * lineVertices;
                        } else {
                            lineIndex2 = vertexBase + lineIndex;
                        }

                        if (i == 0) { //start cap
                            //add polygon
                            vertexBuffer[index] = p1[0];
                            vertexBuffer[index+1] = p1[1];
                            vertexBuffer[index+2] = p1[2];

                            vertexBuffer[index+3] = vertexBuffer[lineIndex];
                            vertexBuffer[index+4] = vertexBuffer[lineIndex+1];
                            vertexBuffer[index+5] = vertexBuffer[lineIndex+2];

                            vertexBuffer[index+6] = p1[0] - vstart[0] * lineWidth;
                            vertexBuffer[index+7] = p1[1] - vstart[1] * lineWidth;
                            vertexBuffer[index+8] = p1[2] - vstart[2] * lineWidth;

                            //add polygon
                            vertexBuffer[index+9] = p1[0];
                            vertexBuffer[index+9+1] = p1[1];
                            vertexBuffer[index+9+2] = p1[2];

                            vertexBuffer[index+9+3] = vertexBuffer[lineIndex+3];
                            vertexBuffer[index+9+4] = vertexBuffer[lineIndex+4];
                            vertexBuffer[index+9+5] = vertexBuffer[lineIndex+5];

                            vertexBuffer[index+9+6] = p1[0] - vstart[0] * lineWidth;
                            vertexBuffer[index+9+7] = p1[1] - vstart[1] * lineWidth;
                            vertexBuffer[index+9+8] = p1[2] - vstart[2] * lineWidth;
                        } else if (i == (li - 1)) {  //end cap
                            //add polygon
                            vertexBuffer[index] = p1[0];
                            vertexBuffer[index+1] = p1[1];
                            vertexBuffer[index+2] = p1[2];

                            vertexBuffer[index+3] = vertexBuffer[lineIndex+15];
                            vertexBuffer[index+4] = vertexBuffer[lineIndex+16];
                            vertexBuffer[index+5] = vertexBuffer[lineIndex+17];

                            vertexBuffer[index+6] = p1[0] + vend[0] * lineWidth;
                            vertexBuffer[index+7] = p1[1] + vend[1] * lineWidth;
                            vertexBuffer[index+8] = p1[2] + vend[2] * lineWidth;

                            //add polygon
                            vertexBuffer[index+9] = p1[0];
                            vertexBuffer[index+9+1] = p1[1];
                            vertexBuffer[index+9+2] = p1[2];

                            vertexBuffer[index+9+3] = vertexBuffer[lineIndex+12];
                            vertexBuffer[index+9+4] = vertexBuffer[lineIndex+13];
                            vertexBuffer[index+9+5] = vertexBuffer[lineIndex+14];

                            vertexBuffer[index+9+6] = p1[0] + vend[0] * lineWidth;
                            vertexBuffer[index+9+7] = p1[1] + vend[1] * lineWidth;
                            vertexBuffer[index+9+8] = p1[2] + vend[2] * lineWidth;
                        } else {
                            //add polygon
                            vertexBuffer[index] = p1[0];
                            vertexBuffer[index+1] = p1[1];
                            vertexBuffer[index+2] = p1[2];

                            vertexBuffer[index+3] = vertexBuffer[lineIndex];
                            vertexBuffer[index+4] = vertexBuffer[lineIndex+1];
                            vertexBuffer[index+5] = vertexBuffer[lineIndex+2];

                            vertexBuffer[index+6] = vertexBuffer[lineIndex2 + 15];
                            vertexBuffer[index+7] = vertexBuffer[lineIndex2 + 16];
                            vertexBuffer[index+8] = vertexBuffer[lineIndex2 + 17];

                            //add polygon
                            vertexBuffer[index+9] = p1[0];
                            vertexBuffer[index+9+1] = p1[1];
                            vertexBuffer[index+9+2] = p1[2];

                            vertexBuffer[index+9+3] = vertexBuffer[lineIndex+3];
                            vertexBuffer[index+9+4] = vertexBuffer[lineIndex+4];
                            vertexBuffer[index+9+5] = vertexBuffer[lineIndex+5];

                            vertexBuffer[index+9+6] = vertexBuffer[lineIndex2 + 12];
                            vertexBuffer[index+9+7] = vertexBuffer[lineIndex2 + 13];
                            vertexBuffer[index+9+8] = vertexBuffer[lineIndex2 + 14];
                        }

                        index += 18;

                    } else {

                        if (i != (li-1)) {
                            distance = vertexBuffer[i * lineVertices + 3];
                        } else {
                            distance = vertexBuffer[(i - 1) * lineVertices + 11];
                        }

                        if (i != (li-1)) {
                            lineIndex = normalBase + i * lineVertices;
                        } else {
                            lineIndex = normalBase + (i - 1) * lineVertices + 8;
                        }

                        if (i > 0) {
                            lineIndex2 = normalBase + (i - 1) * lineVertices + 8;
                        } else {
                            lineIndex2 = normalBase + lineIndex;
                        }

                        //add polygon
                        vertexBuffer[index] = p1[0];
                        vertexBuffer[index+1] = p1[1];
                        vertexBuffer[index+2] = p1[2];
                        vertexBuffer[index+3] = distance;

                        vertexBuffer[index+4] = p1[0];
                        vertexBuffer[index+5] = p1[1];
                        vertexBuffer[index+6] = p1[2];
                        vertexBuffer[index+7] = distance;

                        vertexBuffer[index+8] = p1[0];
                        vertexBuffer[index+9] = p1[1];
                        vertexBuffer[index+10] = p1[2];
                        vertexBuffer[index+11] = distance;

                        //add polygon
                        vertexBuffer[index+12] = p1[0];
                        vertexBuffer[index+1+12] = p1[1];
                        vertexBuffer[index+2+12] = p1[2];
                        vertexBuffer[index+3+12] = distance;

                        vertexBuffer[index+4+12] = p1[0];
                        vertexBuffer[index+5+12] = p1[1];
                        vertexBuffer[index+6+12] = p1[2];
                        vertexBuffer[index+7+12] = -distance;

                        vertexBuffer[index+8+12] = p1[0];
                        vertexBuffer[index+9+12] = p1[1];
                        vertexBuffer[index+10+12] = p1[2];
                        vertexBuffer[index+11+12] = -distance;

                        if (i == 0) { //start cap
                            //first polygon
                            normalBuffer[index2] = 0;
                            normalBuffer[index2+1] = 0;
                            normalBuffer[index2+2] = 0;
                            normalBuffer[index2+3] = -lineWidth;

                            normalBuffer[index2+4] = normalBuffer[lineIndex];
                            normalBuffer[index2+5] = normalBuffer[lineIndex+1];
                            normalBuffer[index2+6] = normalBuffer[lineIndex+2];
                            normalBuffer[index2+7] = lineWidth;

                            normalBuffer[index2+8] = -vstart[0];
                            normalBuffer[index2+9] = -vstart[1];
                            normalBuffer[index2+10] = -vstart[2];
                            normalBuffer[index2+11] = -lineWidth;

                            //second polygon
                            normalBuffer[index2+12] = 0;
                            normalBuffer[index2+1+12] = 0;
                            normalBuffer[index2+2+12] = 0;
                            normalBuffer[index2+3+12] = -lineWidth;

                            normalBuffer[index2+4+12] = -normalBuffer[lineIndex];
                            normalBuffer[index2+5+12] = -normalBuffer[lineIndex+1];
                            normalBuffer[index2+6+12] = -normalBuffer[lineIndex+2];
                            normalBuffer[index2+7+12] = lineWidth;

                            normalBuffer[index2+8+12] = -vstart[0];
                            normalBuffer[index2+9+12] = -vstart[1];
                            normalBuffer[index2+10+12] = -vstart[2];
                            normalBuffer[index2+11+12] = -lineWidth;
                        } else if (i == (li - 1)) {  //end cap
                            //first polygon
                            normalBuffer[index2] = 0;
                            normalBuffer[index2+1] = 0;
                            normalBuffer[index2+2] = 0;
                            normalBuffer[index2+3] = -lineWidth;

                            normalBuffer[index2+4] = normalBuffer[lineIndex2];
                            normalBuffer[index2+5] = normalBuffer[lineIndex2+1];
                            normalBuffer[index2+6] = normalBuffer[lineIndex2+2];
                            normalBuffer[index2+7] = lineWidth;

                            normalBuffer[index2+8] = vend[0];
                            normalBuffer[index2+9] = vend[1];
                            normalBuffer[index2+10] = vend[2];
                            normalBuffer[index2+11] = -lineWidth;

                            //second polygon
                            normalBuffer[index2+12] = 0;
                            normalBuffer[index2+1+12] = 0;
                            normalBuffer[index2+2+12] = 0;
                            normalBuffer[index2+3+12] = -lineWidth;

                            normalBuffer[index2+4+12] = -normalBuffer[lineIndex2];
                            normalBuffer[index2+5+12] = -normalBuffer[lineIndex2+1];
                            normalBuffer[index2+6+12] = -normalBuffer[lineIndex2+2];
                            normalBuffer[index2+7+12] = lineWidth;

                            normalBuffer[index2+8+12] = vend[0];
                            normalBuffer[index2+9+12] = vend[1];
                            normalBuffer[index2+10+12] = vend[2];
                            normalBuffer[index2+11+12] = -lineWidth;
                        } else {
                            normalBuffer[index2] = 0;
                            normalBuffer[index2+1] = 0;
                            normalBuffer[index2+2] = 0;
                            normalBuffer[index2+3] = -lineWidth;

                            normalBuffer[index2+4] = normalBuffer[lineIndex];
                            normalBuffer[index2+5] = normalBuffer[lineIndex+1];
                            normalBuffer[index2+6] = normalBuffer[lineIndex+2];
                            normalBuffer[index2+7] = lineWidth;

                            normalBuffer[index2+8] = normalBuffer[lineIndex2];
                            normalBuffer[index2+9] = normalBuffer[lineIndex2+1];
                            normalBuffer[index2+10] = normalBuffer[lineIndex2+2];
                            normalBuffer[index2+11] = lineWidth;

                            //add polygon
                            normalBuffer[index2+12] = 0;
                            normalBuffer[index2+1+12] = 0;
                            normalBuffer[index2+2+12] = 0;
                            normalBuffer[index2+3+12] = -lineWidth;

                            normalBuffer[index2+4+12] = -normalBuffer[lineIndex];
                            normalBuffer[index2+5+12] = -normalBuffer[lineIndex+1];
                            normalBuffer[index2+6+12] = -normalBuffer[lineIndex+2];
                            normalBuffer[index2+7+12] = lineWidth;

                            normalBuffer[index2+8+12] = -normalBuffer[lineIndex2];
                            normalBuffer[index2+9+12] = -normalBuffer[lineIndex2+1];
                            normalBuffer[index2+10+12] = -normalBuffer[lineIndex2+2];
                            normalBuffer[index2+11+12] = lineWidth;
                        }

                        index += 24;
                        index2 += 24;

                    }

                } else {

                    const segmentIndex = (i != (li-1)) ? i : (i - 1);

                    for (let j = 0; j < circleSides; j++) {

                        if (advancedHit) {
                            elementIndex = elementBase + segmentIndex;
                            elementBuffer[index3] = elementIndex;
                            elementBuffer[index3+1] = elementIndex;
                            elementBuffer[index3+2] = elementIndex;
                            index3 += 3;
                        }

                        distance = vertexBuffer[segmentIndex * lineVertices + 3];

                        //add polygon
                        vertexBuffer[index] = p1[0];
                        vertexBuffer[index+1] = p1[1];
                        vertexBuffer[index+2] = p1[2];
                        vertexBuffer[index+3] = distance;
                        normalBuffer[index2] = 0;
                        normalBuffer[index2+1] = 0;
                        normalBuffer[index2+2] = 0;
                        normalBuffer[index2+3] = 0;

                        vertexBuffer[index+4] = p1[0];
                        vertexBuffer[index+5] = p1[1];
                        vertexBuffer[index+6] = p1[2];
                        vertexBuffer[index+7] = distance;
                        normalBuffer[index2+4] = circleBuffer[j][0] * lineWidth;
                        normalBuffer[index2+5] = circleBuffer[j][1] * lineWidth;
                        normalBuffer[index2+6] = circleBuffer2[j] + angleShift;
                        normalBuffer[index2+7] = 0;

                        vertexBuffer[index+8] = p1[0];
                        vertexBuffer[index+9] = p1[1];
                        vertexBuffer[index+10] = p1[2];
                        vertexBuffer[index+11] = distance;
                        normalBuffer[index2+8] = circleBuffer[j+1][0] * lineWidth;
                        normalBuffer[index2+9] = circleBuffer[j+1][1] * lineWidth;
                        normalBuffer[index2+10] = circleBuffer2[j+1] + angleShift;
                        normalBuffer[index2+11] = 0;

                        index += 12;
                        index2 += 12;
                    }
                }
            }

            if (lineLabel) {
                p = [p1[0], p1[1], p1[2] + lineLabelSize*0.1];
                lineLabelPoints[i] = p;
                lineLabelPoints2[li - i - 1] = p;
            }

            if ((i + 1) < li) {
                p1 = points[i+1];
            }
        }

        elementBase += points.length;
    }

    if (totalPoints > 0) {
        center[0] /= totalPoints;
        center[1] /= totalPoints;
        center[2] /= totalPoints;
    }

    center[0] += globals.groupOrigin[0];
    center[1] += globals.groupOrigin[1];
    center[2] += globals.groupOrigin[2];

    const hitable = hoverEvent || clickEvent || enterEvent || leaveEvent;
    let type;

    if (line) {
        //console.log('totalPoints:' + totalPoints + ' vbuff-l:' + (vertexBuffer ? vertexBuffer.length : '??'));

        const messageData = {
            'color':lineColor, 'z-index':zIndex, 'center': center, 'advancedHit': advancedHit, 'totalPoints': totalPoints,
            'hover-event':hoverEvent, 'click-event':clickEvent, 'draw-event':drawEvent, 'width-units': lineWidthUnits,
            'hitable':hitable, 'state':globals.hitState, 'eventInfo': (globals.alwaysEventInfo || hitable || drawEvent) ? eventInfo : {},
            'enter-event':enterEvent, 'leave-event':leaveEvent, 'zbuffer-offset':zbufferOffset,
            'line-width':lineWidth*2, 'lod':(globals.autoLod ? null : globals.tileLod) };

        if (lineFlat) {
            type = texturedLine ? VTS_WORKER_TYPE_FLAT_TLINE : (widthByRatio ? VTS_WORKER_TYPE_FLAT_RLINE : VTS_WORKER_TYPE_FLAT_LINE);
        } else {
            type = texturedLine ? VTS_WORKER_TYPE_PIXEL_TLINE : VTS_WORKER_TYPE_PIXEL_LINE;
        }

        if (texturedLine) {
            if (lineStyleTexture != null) {
                messageData['texture'] = [globals.stylesheetBitmaps[lineStyleTexture[0]], lineStyleTexture[1], lineStyleTexture[2]];
                messageData['background'] = lineStyleBackground;
            }
        }

        const signature = JSON.stringify({
            type: 'T'+type,
            color : lineColor,
            zIndex : zIndex,
            zOffset : zbufferOffset,
            state : globals.hitState
        });

        const buffers = (normalBuffer) ? [vertexBuffer, normalBuffer] : [vertexBuffer];

        if (advancedHit) {
            buffers.push(elementBuffer);
        }

        postGroupMessageFast(VTS_WORKERCOMMAND_ADD_RENDER_JOB, type, messageData, buffers, signature);
    }

    if (lineLabel) {
        for (i = 0, li = lineLabelStack.length; i < li; i++) {
            processLineLabel(lineLabelStack[i].points, lineLabelStack[i].points2, lineString, center, lod, style, featureIndex, zIndex, eventInfo);
        }
    }

}

function processLineLabel(lineLabelPoints, lineLabelPoints2, lineString, center, lod, style, featureIndex, zIndex, eventInfo) {
    const labelType = getLayerPropertyValue(style, 'line-label-type', lineString, lod);
    const labelColor = getLayerPropertyValue(style, 'line-label-color', lineString, lod);
    const labelColor2 = getLayerPropertyValue(style, 'line-label-color2', lineString, lod);
    const labelOutline = getLayerPropertyValue(style, 'line-label-outline', lineString, lod);
    const labelSource = getLayerPropertyValue(style, 'line-label-source', lineString, lod);
    const labelSpacing = getLayerPropertyValue(style, 'line-label-spacing', lineString, lod);
    //const labelLineHeight = getLayerPropertyValue(style, 'line-label-line-height', lineString, lod);
    const labelOffset = getLayerPropertyValue(style, 'line-label-offset', lineString, lod);
    const labelReduce =  getLayerPropertyValue(style, 'dynamic-reduce', lineString, lod);
    const labelOverlap = getLayerPropertyValue(style, 'line-label-no-overlap', lineString, lod);
    const labelOverlapFactor = getLayerPropertyValue(style, 'line-label-no-overlap-factor', lineString, lod);
    const labelOverlapMargin = getLayerPropertyValue(style, 'line-label-no-overlap-margin', lineString, lod);
    let labelSize = getLayerPropertyValue(style, 'line-label-size', lineString, lod);

    if (Math.abs(labelSize) < 0.0001) {
        return;
    }

    let labelText = getLayerExpresionValue(style, labelSource, lineString, lod, labelSource);
    labelText = labelText ? labelText.replace('\r\n', '\n').replace('\r', '\n') : '';
    const fontNames = getLayerPropertyValue(style, 'line-label-font', lineString, lod);
    const fonts = getFonts(fontNames);
    const fontsStorage = getFontsStorage(fontNames);
    let glyphsRes = getTextGlyphs(labelText, fonts);

    if (labelSource == '$name') {
        if (!areTextCharactersAvailable(labelText, fonts, glyphsRes)) {
            let labelText2 = getLayerExpresionValue(style, '$name:en', lineString, lod, labelSource);
            labelText2 = labelText2 ? labelText2.replace('\r\n', '\n').replace('\r', '\n') : '';
            let glyphsRes2 = getTextGlyphs(labelText, fonts);

            if (areTextCharactersAvailable(labelText2, fonts, glyphsRes2)) {
                labelText = labelText2;
                glyphsRes = glyphsRes2;
            }
        }
    }

    if (!labelText || labelText == '') {
        return;
    }

    const hoverEvent = getLayerPropertyValue(style, 'hover-event', lineString, lod);
    const clickEvent = getLayerPropertyValue(style, 'click-event', lineString, lod);
    const drawEvent = getLayerPropertyValue(style, 'draw-event', lineString, lod);
    const enterEvent = getLayerPropertyValue(style, 'enter-event', lineString, lod);
    const leaveEvent = getLayerPropertyValue(style, 'leave-event', lineString, lod);
    const advancedHit = getLayerPropertyValue(style, 'advanced-hit', lineString, lod);

    const zbufferOffset = getLayerPropertyValue(style, 'zbuffer-offset', lineString, lod);

    let bufferSize, vertexBuffer, texcoordsBuffer, singleBuffer, singleBuffer2;

    globals.useLineLabel2 = (labelType != 'flat');

    if (globals.useLineLabel2) {
        bufferSize = 12 * labelText.length;
        singleBuffer = new Float32Array(bufferSize);
        singleBuffer2 = new Float32Array(bufferSize);
    } else {
        bufferSize = getCharVerticesCount() * labelText.length * 2;
        vertexBuffer = new Float32Array(bufferSize);
        texcoordsBuffer = new Float32Array(bufferSize);
    }

    let planes = {};
    const hitable = hoverEvent || clickEvent || enterEvent || leaveEvent;
    const originalLabelSize = labelSize;

    globals.lineLabelPass = 0;
    globals.lineLabelPoints = [];
    let index = addStreetTextOnPath(lineLabelPoints, labelText, labelSize, labelSpacing, fonts, labelOffset, vertexBuffer, texcoordsBuffer, 0, planes, glyphsRes, singleBuffer);
    let labelPoints = globals.lineLabelPoints;

    globals.lineLabelPoints = [];
    index = addStreetTextOnPath(lineLabelPoints2, labelText, labelSize, labelSpacing, fonts, labelOffset, vertexBuffer, texcoordsBuffer, globals.useLineLabel2 ? 0 : index, null, glyphsRes, singleBuffer2);
    let labelPoints2 = globals.lineLabelPoints;

    if (!index) {

        //label is bigger than path
        if (globals.useLineLabel2) {

            // eslint-disable-next-line
            while(true) {

                //reduce size until is label smaler than path
                labelSize *= 0.5;

                globals.lineLabelPass = 0;
                globals.lineLabelPoints = [];
                index = addStreetTextOnPath(lineLabelPoints, labelText, labelSize, labelSpacing, fonts, labelOffset, vertexBuffer, texcoordsBuffer, 0, planes, glyphsRes, singleBuffer);
                labelPoints = globals.lineLabelPoints;

                globals.lineLabelPoints = [];
                index = addStreetTextOnPath(lineLabelPoints2, labelText, labelSize, labelSpacing, fonts, labelOffset, vertexBuffer, texcoordsBuffer, globals.useLineLabel2 ? 0 : index, null, glyphsRes, singleBuffer2);
                labelPoints2 = globals.lineLabelPoints;

                if (index || labelSize < 0.05) {
                    break;
                }
            }
        }

        if (!index) {
            return;
        }
    }

    const visibility = getLayerPropertyValue(style, 'visibility-rel', lineString, lod) ||
                     getLayerPropertyValue(style, 'visibility-abs', lineString, lod) ||
                     getLayerPropertyValue(style, 'visibility', lineString, lod);
    const culling = getLayerPropertyValue(style, 'culling', lineString, lod);
    const hysteresis = getLayerPropertyValue(style, 'hysteresis', lineString, lod);


    let bboxMin = globals.bboxMin, p, i, li, labelsPack = [], labelIndex = 0;
    //let originalLabelOffset = labelOffset;

    if (globals.useLineLabel2) {
        for (i = 0, li = labelPoints.length; i < li; i++) {
            p = labelPoints[i];
            p[0] += bboxMin[0];
            p[1] += bboxMin[1];
            p[2] += bboxMin[2];
            p = labelPoints2[i];
            p[0] += bboxMin[0];
            p[1] += bboxMin[1];
            p[2] += bboxMin[2];
        }

        labelsPack.push([labelSize, globals.textVector, labelPoints, labelPoints2]);
        globals.lineLabelPass = 1;

        //bigger labels
        // eslint-disable-next-line
        while(true) {

            labelSize *= 2;

            globals.lineLabelPoints = [];
            index = addStreetTextOnPath(lineLabelPoints, labelText, labelSize, labelSpacing, fonts, labelOffset, vertexBuffer, texcoordsBuffer, 0, planes, glyphsRes, singleBuffer);
            labelPoints = globals.lineLabelPoints;

            if (!index) {
                break;
            }

            globals.lineLabelPoints = [];
            index = addStreetTextOnPath(lineLabelPoints2, labelText, labelSize, labelSpacing, fonts, labelOffset, vertexBuffer, texcoordsBuffer, globals.useLineLabel2 ? 0 : index, null, glyphsRes, singleBuffer2);
            labelPoints2 = globals.lineLabelPoints;

            for (i = 0, li = labelPoints.length; i < li; i++) {
                p = labelPoints[i];
                p[0] += bboxMin[0];
                p[1] += bboxMin[1];
                p[2] += bboxMin[2];
                p = labelPoints2[i];
                p[0] += bboxMin[0];
                p[1] += bboxMin[1];
                p[2] += bboxMin[2];
            }

            labelsPack.push([labelSize, globals.textVector, labelPoints, labelPoints2]);
        }

        labelSize = originalLabelSize;

        //smaller labels
        // eslint-disable-next-line
        while(true) {

            labelSize *= 0.5;

            globals.lineLabelPoints = [];
            index = addStreetTextOnPath(lineLabelPoints, labelText, labelSize, labelSpacing, fonts, labelOffset, vertexBuffer, texcoordsBuffer, 0, planes, glyphsRes, singleBuffer);
            labelPoints = globals.lineLabelPoints;

            if (globals.textLength < 2) {
                break;
            }

            globals.lineLabelPoints = [];
            index = addStreetTextOnPath(lineLabelPoints2, labelText, labelSize, labelSpacing, fonts, labelOffset, vertexBuffer, texcoordsBuffer, 0, null, glyphsRes, singleBuffer2);
            labelPoints2 = globals.lineLabelPoints;

            for (i = 0, li = labelPoints.length; i < li; i++) {
                p = labelPoints[i];
                p[0] += bboxMin[0];
                p[1] += bboxMin[1];
                p[2] += bboxMin[2];
                p = labelPoints2[i];
                p[0] += bboxMin[0];
                p[1] += bboxMin[1];
                p[2] += bboxMin[2];
            }

            labelsPack.unshift([labelSize, globals.textVector, labelPoints, labelPoints2]);
            labelIndex++;
        }

        center = globals.textCenter;
        center[0] += bboxMin[0];
        center[1] += bboxMin[1];
        center[2] += bboxMin[2];
    }


    //let fonts = labelData.fonts;
    let labelFiles = new Array(fonts.length);

    for (i = 0, li= fonts.length; i < li; i++) {
        labelFiles[i] = [];
    }

    for (let key in planes) {
        const fontIndex = parseInt(key);
        const planes2 = planes[key];

        const files = [];

        for (let key2 in planes2) {
            const plane = parseInt(key2) - (fontIndex*4000);
            const file = Math.round((plane - (plane % 4)) / 4);

            if (files.indexOf(file) == -1) {
                files.push(file);
            }
        }

        labelFiles[fontIndex] = files;
    }

    const signature = JSON.stringify({
        type: 'line-label',
        color : labelColor,
        color2 : labelColor2,
        outline : labelOutline,
        fonts : fontNames,
        zIndex : zIndex,
        zOffset : zbufferOffset
    });

    let noOverlap;

    if (labelOverlap) {
        let factorType = null, factorValue = null;

        if (labelOverlapFactor !== null) {
            switch(labelOverlapFactor[0]) {
                case 'direct':      factorType = VTS_NO_OVERLAP_DIRECT;      break;
                case 'div-by-dist': factorType = VTS_NO_OVERLAP_DIV_BY_DIST; break;
            }

            factorValue = labelOverlapFactor[1];
        }

        noOverlap = [labelOverlapMargin, factorType, factorValue];
    }

    postGroupMessageFast(VTS_WORKERCOMMAND_ADD_RENDER_JOB, globals.useLineLabel2 ? VTS_WORKER_TYPE_LINE_LABEL2 : VTS_WORKER_TYPE_LINE_LABEL, {
        'color':labelColor, 'color2':labelColor2, 'outline':labelOutline, 'textVector':globals.textVector, 'labelPoints': globals.useLineLabel2 ? labelsPack : [],
        'visibility': visibility, 'culling': culling, 'hysteresis' : hysteresis, 'z-index':zIndex,
        'center': center, 'hover-event':hoverEvent, 'click-event':clickEvent, 'draw-event':drawEvent,
        'reduce':labelReduce, 'noOverlap': (labelOverlap ? noOverlap : null), 'files': labelFiles, 'enter-event':enterEvent,
        'leave-event':leaveEvent, 'zbuffer-offset':zbufferOffset, 'advancedHit': advancedHit, 'labelIndex': labelIndex, 'labelSize': originalLabelSize,
        'fonts': fontsStorage, 'hitable':hitable, 'state':globals.hitState, 'eventInfo': (globals.alwaysEventInfo || hitable || drawEvent) ? eventInfo : {},
        'lod':(globals.autoLod ? null : globals.tileLod) }, globals.useLineLabel2 ? [singleBuffer, singleBuffer2] : [vertexBuffer, texcoordsBuffer], signature);
}


function processLineStringGeometry(lineString) {

    checkDPoints(lineString);

    const lines = lineString['lines'];

    if (lines || lines.length == 0) {
        return;
    }

    //debugger
    let totalPoints = 0;
    const indicesBuffer = new Uint32Array(lines.length);

    for (let i = 0; i < lines.length; i++) {
        indicesBuffer[i] = totalPoints;

        if (Array.isArray(lines[i])) {
            totalPoints += lines[i].length;
        }
    }

    const geometryBuffer = new Float64Array(totalPoints * 3);

    /*let forceOrigin = globals.forceOrigin;
    let tileX = globals.tileX;
    let tileY = globals.tileY;*/
    const forceScale = globals.forceScale;
    let index = 0, p1, pp, p;

    for (let i = 0; i < lines.length; i++) {
        if (!Array.isArray(lines[i]) || !lines[i].length) {
            continue;
        }

        const points = lines[i];

        p = points[0];
        p1 = [p[0], p[1], p[2]];

        //add lines
        for (let j = 0, lj = points.length; j < lj; j++) {

            /*if (forceOrigin) {
                pp = [p1[0] - tileX, p1[1] - tileY, p1[2]];
            }*/

            if (forceScale != null) {
                pp = [p1[0] * forceScale[0], p1[1] * forceScale[1], p1[2] * forceScale[2]];
            }

            geometryBuffer[index] = pp[0];
            geometryBuffer[index+1] = pp[1];
            geometryBuffer[index+2] = pp[2];
            index += 3;

            if (j == (lj - 1)) {
                break;
            }

            p1 = points[j+1];
        }
    }

    globals.signatureCounter++;

    postGroupMessageFast(VTS_WORKERCOMMAND_ADD_RENDER_JOB, VTS_WORKER_TYPE_LINE_GEOMETRY, {
        'id':lineString['id'] }, [geometryBuffer, indicesBuffer], (""+globals.signatureCounter));
}


export {processLineStringPass, processLineLabel, processLineStringGeometry};
