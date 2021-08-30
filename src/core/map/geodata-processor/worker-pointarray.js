
import {globals as globals_, clamp as clamp_} from './worker-globals.js';
import {getLayerPropertyValue as getLayerPropertyValue_, getLayerExpresionValue as getLayerExpresionValue_} from './worker-style.js';
import {addText as addText_, getSplitIndex as getSplitIndex_, getTextGlyphs as getTextGlyphs_,
        getTextLength as getTextLength_, getFonts as getFonts_, getFontsStorage as getFontsStorage_,
        areTextCharactersAvailable as areTextCharactersAvailable_, getCharVerticesCount as getCharVerticesCount_, getLineHeight as getLineHeight_} from './worker-text.js';
import {postGroupMessageFast as postGroupMessageFast_} from './worker-message.js';

//get rid of compiler mess
const globals = globals_, clamp = clamp_;
const getLayerPropertyValue = getLayerPropertyValue_, getLayerExpresionValue = getLayerExpresionValue_;
const addText = addText_, getSplitIndex = getSplitIndex_, getTextGlyphs = getTextGlyphs_,
    getTextLength = getTextLength_, getFonts = getFonts_, getFontsStorage = getFontsStorage_,
    areTextCharactersAvailable = areTextCharactersAvailable_, getCharVerticesCount = getCharVerticesCount_, getLineHeight = getLineHeight_;
const postGroupMessageFast = postGroupMessageFast_;


function checkDPoints(pointArray) {
    let pointsGroups = [];
    let i, li, g, gl, points, p, pp;

    if (pointArray['d-points'] || pointArray['d-lines']) {  //converty d-lines/points to lines/points
        pointsGroups = pointArray['d-points'] || pointArray['d-lines'];

        if (Array.isArray(pointsGroups) && points.length > 0) {

            for (g = 0, gl = pointsGroups; g < gl; g++) {
                points = pointsGroups[g];

                if (Array.isArray(points) && points.length > 0) {
                    p = points[0];

                    p[0] = (p[0] >> 1) ^ (-(p[0] & 1));
                    p[1] = (p[1] >> 1) ^ (-(p[1] & 1));
                    p[2] = (p[2] >> 1) ^ (-(p[2] & 1));

                    for (i = 1, li = points.length; i < li; i++) {
                        p = points[i-1];
                        pp = points[i];

                        pp[0] = ((pp[0] >> 1) ^ (-(pp[0] & 1))) + p[0];
                        pp[1] = ((pp[1] >> 1) ^ (-(pp[1] & 1))) + p[1];
                        pp[2] = ((pp[2] >> 1) ^ (-(pp[2] & 1))) + p[2];
                    }
                }
            }
        }

        if (pointArray['d-points']) {
            pointArray['points'] = pointArray['d-points'];
            delete pointArray['d-points'];
        } else {
            pointArray['lines'] = pointArray['d-lines'];
            delete pointArray['d-lines'];
        }
    }
}


function processPointArrayPass(pointArray, lod, style, featureIndex, zIndex, eventInfo) {
    let pointsGroups = [];
    let i, li, g, gl, points, p, pp;

    checkDPoints(pointArray);

    if (pointArray['lines']) {  //use lines as points
        pointsGroups = pointArray['lines'];
    } else {
        pointsGroups = [pointArray['points']];
    }

    if (!pointsGroups || pointsGroups.length == 0) {
        return;
    }

    let visibility = getLayerPropertyValue(style, 'visibility-rel', pointArray, lod) ||
                     getLayerPropertyValue(style, 'visibility-abs', pointArray, lod) ||
                     getLayerPropertyValue(style, 'visibility', pointArray, lod);
    const culling = getLayerPropertyValue(style, 'culling', pointArray, lod);
    const hoverEvent = getLayerPropertyValue(style, 'hover-event', pointArray, lod);
    const clickEvent = getLayerPropertyValue(style, 'click-event', pointArray, lod);
    const drawEvent = getLayerPropertyValue(style, 'draw-event', pointArray, lod);
    const enterEvent = getLayerPropertyValue(style, 'enter-event', pointArray, lod);
    const leaveEvent = getLayerPropertyValue(style, 'leave-event', pointArray, lod);
    const advancedHit = getLayerPropertyValue(style, 'advanced-event', pointArray, lod);
    const linePoints = getLayerPropertyValue(style, 'line-points', pointArray, lod);

    const zbufferOffset = getLayerPropertyValue(style, 'zbuffer-offset', pointArray, lod);

    const point = getLayerPropertyValue(style, 'point', pointArray, lod);
    const pointFlat = getLayerPropertyValue(style, 'point-flat', pointArray, lod);
    const pointColor = getLayerPropertyValue(style, 'point-color', pointArray, lod);
    const pointRadius = 0.5 * getLayerPropertyValue(style, 'point-radius', pointArray, lod);

    let source, bufferSize, bufferSize2, totalPoints = 0, noOverlap;
    let labelData, iconData;

    //zIndex = (zIndex !== null) ? zIndex : getLayerPropertyValue(style, "z-index", pointArray, lod);

    for (g = 0, gl = pointsGroups.length; g < gl; g++) {
        points = pointsGroups[g];
        if (Array.isArray(points) && points.length > 0) {
            totalPoints += points.length;
        }
    }

    let icon = getLayerPropertyValue(style, 'icon', pointArray, lod);
    if (icon) {
        source = getLayerPropertyValue(style, 'icon-source', pointArray, lod);

        if (source) {
            bufferSize = getCharVerticesCount() * totalPoints;
            bufferSize2 = getCharVerticesCount(true) * totalPoints;

            iconData = {
                color : getLayerPropertyValue(style, 'icon-color', pointArray, lod),
                scale : getLayerPropertyValue(style, 'icon-scale', pointArray, lod),
                offset : getLayerPropertyValue(style, 'icon-offset', pointArray, lod),
                stick : getLayerPropertyValue(style, 'icon-stick', pointArray, lod),
                reduce : getLayerPropertyValue(style, 'dynamic-reduce', pointArray, lod),
                origin : getLayerPropertyValue(style, 'icon-origin', pointArray, lod),
                source : getLayerPropertyValue(style, 'icon-source', pointArray, lod),
                noOverlap : getLayerPropertyValue(style, 'icon-no-overlap', pointArray, lod),
                noOverlapMargin : getLayerPropertyValue(style, 'icon-no-overlap-margin', pointArray, lod),
                noOverlapFactor : getLayerPropertyValue(style, 'icon-no-overlap-factor', pointArray, lod),
                index : 0,
                index2 : 0
            };

            if (totalPoints > 1) {
                iconData.vertexBuffer = new Float32Array(bufferSize);
                iconData.originBuffer = new Float32Array(bufferSize2);
                iconData.texcoordsBuffer = new Float32Array(bufferSize);
            } else {
                iconData.singleBuffer = new Float32Array(16);
            }

        } else {
            icon = false;
        }
    }

    let label = getLayerPropertyValue(style, 'label', pointArray, lod);
    if (label) {
        source = getLayerPropertyValue(style, 'label-source', pointArray, lod);

        let text = getLayerExpresionValue(style, source, pointArray, lod, source);
        text = text ? text.replace('\r\n', '\n').replace('\r', '\n') : '';
        const size = getLayerPropertyValue(style, 'label-size', pointArray, lod);
        const fontNames = getLayerPropertyValue(style, 'label-font', pointArray, lod);
        const fonts = getFonts(fontNames);
        let glyphsRes = getTextGlyphs(text, fonts);

        if (source == '$name') {
            if (!areTextCharactersAvailable(text, fonts, glyphsRes)) {
                let text2 = getLayerExpresionValue(style, '$name:en', pointArray, lod, source);
                text2 = text2 ? text2.replace('\r\n', '\n').replace('\r', '\n') : '';
                const glyphsRes2 = getTextGlyphs(text2, fonts);

                if (areTextCharactersAvailable(text2, fonts)) {
                    text = text2;
                    glyphsRes = glyphsRes2;
                }
            }
        }
        if (text && text != '' && Math.abs(size) > 0.0001) {
            noOverlap = getLayerPropertyValue(style, 'label-no-overlap', pointArray, lod);
            bufferSize = getCharVerticesCount() * text.length * (noOverlap ? 1 : totalPoints);
            bufferSize2 = getCharVerticesCount(true) * text.length * (noOverlap ? 1 : totalPoints);

            const useSingleBuffer = (totalPoints == 1);

            let factor = 1;
            if (getLayerPropertyValue(style, 'label-size-units', pointArray, lod) == 'points') {
                factor = globals.pixelFactor / ((1 / 72) * (96));
            }

            labelData = {
                color : getLayerPropertyValue(style, 'label-color', pointArray, lod),
                color2 : getLayerPropertyValue(style, 'label-color2', pointArray, lod),
                outline : getLayerPropertyValue(style, 'label-outline', pointArray, lod),
                reduce : getLayerPropertyValue(style, 'dynamic-reduce', pointArray, lod),
                size : size * factor,
                spacing: getLayerPropertyValue(style, 'label-spacing', pointArray, lod),
                lineHeight: getLayerPropertyValue(style, 'label-line-height', pointArray, lod),
                offset : getLayerPropertyValue(style, 'label-offset', pointArray, lod),
                stick : getLayerPropertyValue(style, 'label-stick', pointArray, lod),
                origin : getLayerPropertyValue(style, 'label-origin', pointArray, lod),
                align : getLayerPropertyValue(style, 'label-align', pointArray, lod),
                fonts : fonts,
                fontsStorage : getFontsStorage(fontNames),
                text : text,
                hysteresis : getLayerPropertyValue(style, 'hysteresis', pointArray, lod),
                width : factor * getLayerPropertyValue(style, 'label-width', pointArray, lod),
                noOverlap : noOverlap,
                noOverlapMargin : getLayerPropertyValue(style, 'label-no-overlap-margin', pointArray, lod),
                noOverlapFactor : getLayerPropertyValue(style, 'label-no-overlap-factor', pointArray, lod),
                vertexBuffer : (useSingleBuffer) ? null : (new Float32Array(bufferSize)),
                originBuffer : (useSingleBuffer) ? null : (new Float32Array(bufferSize2)),
                texcoordsBuffer : (useSingleBuffer) ? null : (new Float32Array(bufferSize)),
                singleBuffer : (useSingleBuffer) ? (new Float32Array(text.length * 4 * 2)) : null,
                index : 0,
                index2 : 0,
                glyphsRes : glyphsRes
            };

            if (labelData.stick) {
                labelData.stick = labelData.stick.slice();
                labelData.stick[2] *= factor;
                //labelData.stick[7] *= factor;
            }

        } else {
            label = false;
        }
    }

    let index = 0;
    let index2 = 0;

    let center = [0,0,0];
    const forceOrigin = globals.forceOrigin;
    const bboxMin = globals.bboxMin;
    const tileX = globals.tileX;
    const tileY = globals.tileY;
    const forceScale = globals.forceScale;
    let labelBBox, iconBBox, p1, p2, pp2;

    let circleBuffer = [];
    let circleSides = clamp(pointRadius * 8 * 0.5, 8, 32);

    // eslint-disable-next-line
    const generatePoint = (function(pindex) {

        if (icon && (!iconData.noOverlap)) {
            iconBBox = processIcon(pp, iconData) ;//, pointArray, lod, style, zIndex);
        }

        if (label && (!labelData.noOverlap)) {
            labelBBox = processLabel(pp, labelData); //, pointArray, lod, style, zIndex);
        }

        if (point) {

            for (let j = 0; j < circleSides; j++) {

                if (pointFlat) {

                    //add polygon
                    vertexBuffer[index] = pp[0];
                    vertexBuffer[index+1] = pp[1];
                    vertexBuffer[index+2] = pp[2];

                    vertexBuffer[index+3] = pp[0] + circleBuffer[j][0] * pointRadius;
                    vertexBuffer[index+4] = pp[1] + circleBuffer[j][1] * pointRadius;
                    vertexBuffer[index+5] = pp[2];

                    vertexBuffer[index+6] = pp[0] + circleBuffer[j+1][0] * pointRadius;
                    vertexBuffer[index+7] = pp[1] + circleBuffer[j+1][1] * pointRadius;
                    vertexBuffer[index+8] = pp[2];

                    index += 9;

                } else {

                    //add polygon
                    vertexBuffer[index] = pp[0];
                    vertexBuffer[index+1] = pp[1];
                    vertexBuffer[index+2] = pp[2];
                    vertexBuffer[index+3] = 0;
                    normalBuffer[index2] = 0;
                    normalBuffer[index2+1] = 0;
                    normalBuffer[index2+2] = 0;
                    normalBuffer[index2+3] = 0;

                    vertexBuffer[index+4] = pp[0];
                    vertexBuffer[index+5] = pp[1];
                    vertexBuffer[index+6] = pp[2];
                    vertexBuffer[index+7] = 0;
                    normalBuffer[index2+4] = circleBuffer[j][0] * pointRadius;
                    normalBuffer[index2+5] = circleBuffer[j][1] * pointRadius;
                    normalBuffer[index2+6] = 0;
                    normalBuffer[index2+7] = 0;

                    vertexBuffer[index+8] = pp[0];
                    vertexBuffer[index+9] = pp[1];
                    vertexBuffer[index+10] = pp[2];
                    vertexBuffer[index+11] = 0;
                    normalBuffer[index2+8] = circleBuffer[j+1][0] * pointRadius;
                    normalBuffer[index2+9] = circleBuffer[j+1][1] * pointRadius;
                    normalBuffer[index2+10] = 0;
                    normalBuffer[index2+11] = 0;

                    index += 12;
                    index2 += 12;
                }
            }
        }
    });


    const getLinePoint = (function(length) {

        let l1 = 0, l2 = 0;

        p = points[0];
        p1 = [p[0], p[1], p[2]];

        if (forceOrigin) {
            p1 = [p1[0] - tileX, p1[1] - tileY, p1[2]];
        }

        if (forceScale != null) {
            p1 = [p1[0] * forceScale[0], p1[1] * forceScale[1], p1[2] * forceScale[2]];
        }

        if (length == 0) {
            return p1;
        }

        for (let k = 0, lk = points.length - 1; k < lk; k++) {
            p = points[k+1];
            p2 = [p[0], p[1], p[2]];

            if (forceOrigin) {
                p2 = [p2[0] - tileX, p2[1] - tileY, p2[2]];
            }

            if (forceScale != null) {
                p2 = [p2[0] * forceScale[0], p2[1] * forceScale[1], p2[2] * forceScale[2]];
            }

            const dx = p2[0] - p1[0], dy = p2[1] - p1[1], dz = p2[2] - p1[2];
            const l = Math.sqrt(dx*dx+dy*dy+dz*dz);

            l1 = l2;
            l2 += l;

            if (length >= l1 && length <= l2) {
                const d = (length - l1) / l;

                return [p1[0] + dx * d,  p1[1] + dy * d, p1[2] + dz * d];
            }

            p1 = p2;
        }

    });

    const pointsBuffer = new Array(2048);
    let pointsBufferLength = 0;

    for (g = 0, gl = pointsGroups.length; g < gl; g++) {
        points = pointsGroups[g];

        if (Array.isArray(points) && points.length > 0) {

            let totalLength = 0, lengths = null;

            if (linePoints[0] != 'vertices') {
                lengths = new Array(points.length);
                lengths[0] = 0;
            }

            //add ponints
            for (i = 0, li = points.length; i < li; i++) {
                p = points[i];
                p1 = [p[0], p[1], p[2]];

                if (forceOrigin) {
                    p1 = [p1[0] - tileX, p1[1] - tileY, p1[2]];
                }

                if (forceScale != null) {
                    p1 = [p1[0] * forceScale[0], p1[1] * forceScale[1], p1[2] * forceScale[2]];
                }

                if (i + 1 < li) {
                    p = points[i+1];
                    p2 = [p[0], p[1], p[2]];

                    if (forceOrigin) {
                        p2 = [p2[0] - tileX, p2[1] - tileY, p2[2]];
                    }

                    if (forceScale != null) {
                        p2 = [p2[0] * forceScale[0], p2[1] * forceScale[1], p2[2] * forceScale[2]];
                    }

                    const dx = p2[0] - p1[0], dy = p2[1] - p1[1], dz = p2[2] - p1[2];
                    const l = Math.sqrt(dx*dx+dy*dy+dz*dz);

                    if (lengths) {
                        lengths[i] = l;
                    }

                    totalLength += l;
                }

                center[0] += p1[0];
                center[1] += p1[1];
                center[2] += p1[2];

                if (linePoints[0] == 'vertices') {
                    pointsBuffer[pointsBufferLength] = p1;
                    pointsBufferLength++;
                }
            }

            if (linePoints[0] == 'by-length' || linePoints[0] == 'by-ratio') {
                let period = linePoints[1];
                let offset = linePoints[2] || 0;

                if (linePoints[0] == 'by-ratio') {
                    period *= totalLength;
                    offset *= totalLength;
                }

                if (period <= 0) {
                    pointsBuffer[pointsBufferLength] = getLinePoint(offset);
                    if (pointsBuffer[pointsBufferLength]) {
                        pointsBufferLength++;
                    }
                } else {
                    for (i = offset; i < totalLength; i += period) {
                        pointsBuffer[pointsBufferLength] = getLinePoint(i);
                        if (pointsBuffer[pointsBufferLength]) {
                            pointsBufferLength++;
                        }
                    }
                }
            }

            if (linePoints[0] == 'start') {
                pointsBuffer[pointsBufferLength] = getLinePoint(0);
                pointsBufferLength++;
            }

            if (linePoints[0] == 'end') {
                pointsBuffer[pointsBufferLength] = getLinePoint(totalLength);
                pointsBufferLength++;
            }

            if (linePoints[0] == 'endpoints') {
                pointsBuffer[pointsBufferLength] = getLinePoint(0);
                pointsBufferLength++;
                pointsBuffer[pointsBufferLength] = getLinePoint(totalLength);
                pointsBufferLength++;
            }

            if (linePoints[0] == 'middle' || linePoints[0] == 'midpoint') {
                pointsBuffer[pointsBufferLength] = getLinePoint(totalLength * 0.5);
                pointsBufferLength++;
            }
        }
    }

    let pointsVertices, vertexBuffer, pointsNormals, normalBuffer, bufferPoints = pointsBufferLength;

    if (point) {
        circleBuffer = [];
        circleSides = clamp(pointRadius * 8 * 0.5, 8, 32);

        let angle = 0, step = (2.0*Math.PI) / circleSides;

        for (i = 0; i < circleSides; i++) {
            circleBuffer[i] = [-Math.sin(angle), Math.cos(angle)];
            angle += step;
        }

        circleBuffer[circleSides] = [0, 1.0];

        //allocate buffers
        if (!pointFlat) {
            pointsVertices = circleSides * 3 * 4;
            vertexBuffer = new Float32Array(bufferPoints * pointsVertices);
            pointsNormals = circleSides * 3 * 4;
            normalBuffer = new Float32Array(bufferPoints * pointsNormals);
        } else {
            pointsVertices = circleSides * 3 * 3;
            vertexBuffer = new Float32Array(bufferPoints * pointsVertices);
        }
    }

    if (!pointsBufferLength) {
        return;
    }

    //if (pointsBufferLength > 1) {
      //  globals.directPoints = pointsBuffer.slice(1,pointsBufferLength);
    //}

    globals.directPoints = pointsBuffer.slice(0,pointsBufferLength);

    for (i = 0; i < pointsBufferLength; i++) {
        pp = pointsBuffer[i];
        generatePoint(i);
    }

    if (totalPoints > 0) {
        center[0] /= totalPoints;
        center[1] /= totalPoints;
        center[2] /= totalPoints;
    }

    center[0] += bboxMin[0];//groupOrigin[0];
    center[1] += bboxMin[1];//groupOrigin[1];
    center[2] += bboxMin[2];//groupOrigin[2];

    const hitable = hoverEvent || clickEvent || enterEvent || leaveEvent;
    //let message, messageSize;

    globals.signatureCounter++;
    let signature = (""+globals.signatureCounter);

    if (visibility && !Array.isArray(visibility)) {
        visibility = [visibility];
    }

    if (point) {
        if (pointFlat) {
            postGroupMessageFast(VTS_WORKERCOMMAND_ADD_RENDER_JOB, VTS_WORKER_TYPE_FLAT_LINE, {
                'color':pointColor, 'z-index':zIndex, 'visibility': visibility, 'center': center,
                'hover-event':hoverEvent, 'click-event':clickEvent, 'draw-event':drawEvent, 'advancedHit': advancedHit,
                'enter-event':enterEvent, 'leave-event':leaveEvent, 'zbuffer-offset':zbufferOffset,
                'hitable':hitable, 'state':globals.hitState, 'eventInfo': (globals.alwaysEventInfo || hitable || drawEvent) ? eventInfo : {},
                'lod':(globals.autoLod ? null : globals.tileLod) }, [vertexBuffer], signature);
        } else {
            postGroupMessageFast(VTS_WORKERCOMMAND_ADD_RENDER_JOB, VTS_WORKER_TYPE_PIXEL_LINE, {
                'color':pointColor, 'z-index':zIndex, 'visibility': visibility, 'center': center,
                'hover-event':hoverEvent, 'click-event':clickEvent, 'draw-event':drawEvent,
                'enter-event':enterEvent, 'leave-event':leaveEvent, 'zbuffer-offset':zbufferOffset,
                'hitable':hitable, 'state':globals.hitState, 'eventInfo': (globals.alwaysEventInfo || hitable || drawEvent) ? eventInfo : {},
                'lod':(globals.autoLod ? null : globals.tileLod) }, [vertexBuffer, normalBuffer], signature);
        }
    }

    const sendIconMessage = (function(){

        if (icon) {

            globals.signatureCounter++;
            signature = (""+globals.signatureCounter);

            let noOverlap;

            if (iconData.noOverlap) {
                const margin = iconData.noOverlapMargin;
                let factorType = null, factorValue = null;

                if (iconData.noOverlapFactor !== null) {
                    switch(iconData.noOverlapFactor[0]) {
                        case 'direct':      factorType = VTS_NO_OVERLAP_DIRECT;      break;
                        case 'div-by-dist': factorType = VTS_NO_OVERLAP_DIV_BY_DIST; break;
                    }

                    factorValue = iconData.noOverlapFactor[1];
                }

                noOverlap = [iconBBox[0]-margin[0], iconBBox[1]-margin[1], iconBBox[2]+margin[0], iconBBox[3]+margin[1], factorType, factorValue];
            }

            if ((iconData.singleBuffer && iconData.singleBuffer.length > 0) || (iconData.vertexBuffer && iconData.vertexBuffer.length > 0)) {

                postGroupMessageFast(VTS_WORKERCOMMAND_ADD_RENDER_JOB, (iconData.singleBuffer) ? VTS_WORKER_TYPE_ICON : VTS_WORKER_TYPE_ICON2, {
                    'icon':globals.stylesheetBitmaps[iconData.source[0]], 'color':iconData.color, 'z-index':zIndex,
                    'visibility': visibility, 'culling': culling, 'center': pp2, 'stick': iconData.stick,
                    'hover-event':hoverEvent, 'click-event':clickEvent, 'draw-event':drawEvent, 'advancedHit': advancedHit,
                    'enter-event':enterEvent, 'leave-event':leaveEvent, 'zbuffer-offset':zbufferOffset, 'noOverlap' : (iconData.noOverlap ? noOverlap: null),
                    'hitable':hitable, 'state':globals.hitState, 'eventInfo': (globals.alwaysEventInfo || hitable || drawEvent) ? eventInfo : {},
                    'index': featureIndex, 'reduce': iconData.reduce, 'lod':(globals.autoLod ? null : globals.tileLod) },
                    (iconData.singleBuffer) ? [iconData.singleBuffer] : [iconData.vertexBuffer, iconData.originBuffer, iconData.texcoordsBuffer],
                    signature);
            }
        }

    });

    const sendLabelMessage = (function(){

        if (label) {
            globals.signatureCounter++;
            signature = (""+globals.signatureCounter);

            let noOverlap;

            if (labelData.noOverlap) {
                const margin = labelData.noOverlapMargin;
                let factorType = null, factorValue = null;

                if (labelData.noOverlapFactor !== null) {
                    switch(labelData.noOverlapFactor[0]) {
                        case 'direct':      factorType = VTS_NO_OVERLAP_DIRECT;      break;
                        case 'div-by-dist': factorType = VTS_NO_OVERLAP_DIV_BY_DIST; break;
                    }

                    factorValue = labelData.noOverlapFactor[1];
                }

                noOverlap = [labelBBox[0]-margin[0], labelBBox[1]-margin[1], labelBBox[2]+margin[0], labelBBox[3]+margin[1], factorType, factorValue];
            }

            if ((labelData.singleBuffer && labelData.singleBuffer.length > 0) || (labelData.vertexBuffer && labelData.vertexBuffer.length > 0)) {

                postGroupMessageFast(VTS_WORKERCOMMAND_ADD_RENDER_JOB, (labelData.singleBuffer) ? VTS_WORKER_TYPE_LABEL : VTS_WORKER_TYPE_LABEL2, {
                    'size':labelData.size, 'origin':labelData.pos, 'color':labelData.color,
                    'color2':labelData.color2, 'outline':labelData.outline, 'z-index':zIndex, 'visibility': visibility,
                    'culling': culling, 'center': pp2, 'stick': labelData.stick, 'noOverlap' : (labelData.noOverlap ? noOverlap: null),
                    'hover-event':hoverEvent, 'click-event':clickEvent, 'draw-event':drawEvent, 'files':labelData.files, 'index': featureIndex,
                    'enter-event':enterEvent, 'leave-event':leaveEvent, 'zbuffer-offset':zbufferOffset, 'fonts': labelData.fontsStorage,
                    'hitable':hitable, 'state':globals.hitState, 'advancedHit': advancedHit, 'reduce': labelData.reduce, 'hysteresis': labelData.hysteresis,
                    'eventInfo': (globals.alwaysEventInfo || hitable || drawEvent) ? eventInfo : {}, 'lod':(globals.autoLod ? null : globals.tileLod) },
                    (labelData.singleBuffer) ? [labelData.singleBuffer] : [labelData.vertexBuffer, labelData.originBuffer, labelData.texcoordsBuffer],
                    signature);
            }
        }

    });

    if (icon && (!iconData.noOverlap)) {
        pp2 = center;
        sendIconMessage();
    }

    if (label && (!labelData.noOverlap)) {
        pp2 = center;
        sendLabelMessage();
    }

    for (i = 0, li = globals.insidePack ? 1 : globals.directPoints.length; i < li; i++) {
        pp = globals.directPoints[i];
        pp2 = [pp[0] + bboxMin[0], pp[1] + bboxMin[1], pp[2] + bboxMin[2]];

        if (icon && (iconData.noOverlap)) {
            iconBBox = processIcon(pp, iconData, iconBBox) ;//, pointArray, lod, style, zIndex);
            sendIconMessage();
        }

        if (label && (labelData.noOverlap)) {
            labelBBox = processLabel(pp, labelData, labelBBox); //, pointArray, lod, style, zIndex);
            sendLabelMessage();
        }
    }

}

// eslint-disable-next-line
function processPointArrayVSwitchPass(pointArray, lod, style, featureIndex, zIndex, eventInfo) {
    let pointsGroups = [];
    let i, li;

    checkDPoints(pointArray);

    if (pointArray['lines']) {  //use lines as points
        pointsGroups = pointArray['lines'];
    } else {
        pointsGroups = [pointArray['points']];
    }

    if (!pointsGroups || pointsGroups.length == 0) {
        return;
    }


    const visibility = getLayerPropertyValue(style, 'visibility-rel', pointArray, lod) ||
                     getLayerPropertyValue(style, 'visibility-abs', pointArray, lod) ||
                     getLayerPropertyValue(style, 'visibility', pointArray, lod);
    const culling = getLayerPropertyValue(style, 'culling', pointArray, lod);
    const hysteresis = getLayerPropertyValue(style, 'hysteresis', pointArray, lod);

    let points, g, gl, totalPoints = 0;

    for (g = 0, gl = pointsGroups.length; g < gl; g++) {
        points = pointsGroups[g];
        if (Array.isArray(points) && points.length > 0) {
            totalPoints += points.length;
        }
    }

    let center = [0,0,0];
    const forceOrigin = globals.forceOrigin;
    const bboxMin = globals.bboxMin;
    const tileX = globals.tileX;
    const tileY = globals.tileY;
    const forceScale = globals.forceScale;
    let p, p1;

    for (g = 0, gl = pointsGroups.length; g < gl; g++) {
        points = pointsGroups[g];

        if (Array.isArray(points) && points.length > 0) {

            //add ponints
            for (i = 0, li = points.length; i < li; i++) {
                p = points[i];
                p1 = [p[0], p[1], p[2]];

                if (forceOrigin) {
                    p1 = [p1[0] - tileX, p1[1] - tileY, p1[2]];
                }

                if (forceScale != null) {
                    p1 = [p1[0] * forceScale[0], p1[1] * forceScale[1], p1[2] * forceScale[2]];
                }

                center[0] += p1[0];
                center[1] += p1[1];
                center[2] += p1[2];
            }
        }
    }

    if (totalPoints > 0) {
        center[0] /= totalPoints;
        center[1] /= totalPoints;
        center[2] /= totalPoints;
    }

    center[0] += bboxMin[0];//groupOrigin[0];
    center[1] += bboxMin[1];//groupOrigin[1];
    center[2] += bboxMin[2];//groupOrigin[2];

    globals.signatureCounter++;
    const signature = (""+globals.signatureCounter);

    postGroupMessageFast(VTS_WORKERCOMMAND_ADD_RENDER_JOB, VTS_WORKER_TYPE_VSPOINT, {
        'z-index':zIndex, 'hysteresis' : hysteresis,
        'visibility': visibility, 'culling': culling, 'center': center, 'eventInfo': {} /*(globals.alwaysEventInfo || hitable || drawEvent) ? eventInfo : {}*/,
         'index': featureIndex, 'lod':(globals.autoLod ? null : globals.tileLod) }, [], signature);
}


function getOriginOffset(origin, width, height) { //TODO: fix pixel units
    switch(origin) {
    case 'top-left':        return [0, 0];
    case 'top-right':       return [-width, 0];
    case 'top-center':      return [-width*0.5, 0];
    case 'center-left':     return [0, -height*0.5];
    case 'center-right':    return [-width, -height*0.5];
    case 'center-center':   return [-width*0.5, -height*0.5];
    case 'bottom-left':     return [0, -height];
    case 'bottom-right':    return [-width, -height];
    case 'bottom-center':   return [-width*0.5, -height];
    }
}


function processIcon(point, iconData, cloneBuffers) {

    if (cloneBuffers) {
        iconData.index = 0;
        iconData.index2 = 0;
        iconData.vertexBuffer = iconData.vertexBuffer ?  (new Float32Array(iconData.vertexBuffer.length)) : null;
        iconData.originBuffer = iconData.originBuffer ?  (new Float32Array(iconData.originBuffer.length)) : null;
        iconData.singleBuffer = iconData.singleBuffer ?  (new Float32Array(iconData.singleBuffer.length)) : null;
    }

    const icon = iconData.source;
    let index = iconData.index;
    let index2 = iconData.index2;
    let lastIndex = index;

    const width = Math.abs(icon[3] * iconData.scale * 0.5);
    const height = Math.abs(icon[4] * iconData.scale * 0.5);

    //get offset
    const originOffset = getOriginOffset(iconData.origin, width, height);
    const offsetX = originOffset[0] + iconData.offset[0];
    const offsetY = originOffset[1] + iconData.offset[1];

    if (iconData.singleBuffer) {
        const b = iconData.singleBuffer;

        b[0] = offsetX; b[1] = offsetY;
        b[2] = icon[1];
        b[3] = icon[2];

        b[4] = width + offsetX; b[5] = offsetY;
        b[6] = icon[1]+icon[3];
        b[7] = icon[2];

        b[8] = width + offsetX; b[9] = height + offsetY;
        b[10] = icon[1]+icon[3];
        b[11] = icon[2]+icon[4];

        b[12] = offsetX; b[13] = height + offsetY;
        b[14] = icon[1];
        b[15] = icon[2]+icon[4];

        return [offsetX * 0.5, offsetY * 0.5, (offsetX + width) * 0.5 + 1, (offsetY + height) *0.5];
    }

    const vertexBuffer = iconData.vertexBuffer;
    const texcoordsBuffer = iconData.texcoordsBuffer;
    const originBuffer = iconData.originBuffer;

    //add polygon
    vertexBuffer[index] = 0;
    vertexBuffer[index+1] = 0;
    vertexBuffer[index+2] = 0;
    vertexBuffer[index+3] = 0;

    vertexBuffer[index+4] = width;
    vertexBuffer[index+5] = 0;
    vertexBuffer[index+6] = 0;
    vertexBuffer[index+7] = 0;

    vertexBuffer[index+8] = width;
    vertexBuffer[index+9] = -height;
    vertexBuffer[index+10] = 0;
    vertexBuffer[index+11] = 0;

    texcoordsBuffer[index] = icon[1];
    texcoordsBuffer[index+1] = icon[2];
    texcoordsBuffer[index+2] = 0;
    texcoordsBuffer[index+3] = 0;

    texcoordsBuffer[index+4] = icon[1]+icon[3];
    texcoordsBuffer[index+5] = icon[2];
    texcoordsBuffer[index+6] = 0;
    texcoordsBuffer[index+7] = 0;

    texcoordsBuffer[index+8] = icon[1]+icon[3];
    texcoordsBuffer[index+9] = icon[2]+icon[4];
    texcoordsBuffer[index+10] = 0;
    texcoordsBuffer[index+11] = 0;

    index += 12;

    //add polygon
    vertexBuffer[index] = 0;
    vertexBuffer[index+1] = 0;
    vertexBuffer[index+2] = 0;
    vertexBuffer[index+3] = 0;

    vertexBuffer[index+4] = 0;
    vertexBuffer[index+5] = -height;
    vertexBuffer[index+6] = 0;
    vertexBuffer[index+7] = 0;

    vertexBuffer[index+8] = width;
    vertexBuffer[index+9] = -height;
    vertexBuffer[index+10] = 0;
    vertexBuffer[index+11] = 0;

    texcoordsBuffer[index] = icon[1];
    texcoordsBuffer[index+1] = icon[2];
    texcoordsBuffer[index+2] = 0;
    texcoordsBuffer[index+3] = 0;

    texcoordsBuffer[index+4] = icon[1];
    texcoordsBuffer[index+5] = icon[2]+icon[4];
    texcoordsBuffer[index+6] = 0;
    texcoordsBuffer[index+7] = 0;

    texcoordsBuffer[index+8] = icon[1]+icon[3];
    texcoordsBuffer[index+9] = icon[2]+icon[4];
    texcoordsBuffer[index+10] = 0;
    texcoordsBuffer[index+11] = 0;

    index += 12;

    const p1 = point[0];
    const p2 = point[1];
    const p3 = point[2];

    //set origin buffer and apply offset
    for (let i = lastIndex; i < index; i+=4) {
        vertexBuffer[i] += offsetX;
        vertexBuffer[i+1] -= offsetY;

        originBuffer[index2] = p1;
        originBuffer[index2 + 1] = p2;
        originBuffer[index2 + 2] = p3;
        index2 += 3;
    }

    iconData.index = index;
    iconData.index2 = index2;

    return [offsetX * 0.5, offsetY * 0.5, (offsetX + width) * 0.5 + 1, (offsetY + height) *0.5];
}


function processLabel(point, labelData, cloneBuffers) {

    if (cloneBuffers) {
        labelData.index = 0;
        labelData.index2 = 0;
        labelData.vertexBuffer = labelData.vertexBuffer ?  (new Float32Array(labelData.vertexBuffer.length)) : null;
        labelData.originBuffer = labelData.originBuffer ?  (new Float32Array(labelData.originBuffer.length)) : null;
        labelData.singleBuffer = labelData.singleBuffer ?  (new Float32Array(labelData.singleBuffer.length)) : null;
    }

    const vertexBuffer = labelData.vertexBuffer;
    const texcoordsBuffer = labelData.texcoordsBuffer;
    const originBuffer = labelData.originBuffer;
    let singleBuffer = labelData.singleBuffer;
    let index = labelData.index;
    let index2 = labelData.index2;
    let lastIndex = index;
    //let text = '' + labelData.text;
    const fonts = labelData.fonts;
    let planes = {}, i, li, res;
    let glyphsRes = labelData.glyphsRes;

    const linesGlyphsRes = [];
    const linesGlyphsRes2 = [];

    //split text to lines
    do {
        res = glyphsRes[2].indexOf(10); //search /n

        if (res != -1) {
            linesGlyphsRes.push([glyphsRes[0].slice(0,res), glyphsRes[1].slice(0,res), glyphsRes[2].slice(0,res)]);
            glyphsRes = [glyphsRes[0].slice(res+1), glyphsRes[1].slice(res+1), glyphsRes[2].slice(res+1)];
        } else {
            linesGlyphsRes.push(glyphsRes);
        }

    } while (res != -1);

    //split lines by width
    for (let i = 0, li = linesGlyphsRes.length; i < li; i++) {

        glyphsRes = linesGlyphsRes[i];

        // eslint-disable-next-line
        do {
            const splitIndex = getSplitIndex(null, labelData.width, labelData.size, labelData.spacing, fonts, glyphsRes);
            const codes = glyphsRes[2];

            if (codes.length == splitIndex) {
                linesGlyphsRes2.push(glyphsRes);
                break;
            }

            linesGlyphsRes2.push([glyphsRes[0].slice(0,splitIndex), glyphsRes[1].slice(0,splitIndex), glyphsRes[2].slice(0,splitIndex)]);

            glyphsRes = [glyphsRes[0].slice(splitIndex+1), glyphsRes[1].slice(splitIndex+1), glyphsRes[2].slice(splitIndex+1)];

        // eslint-disable-next-line
        } while(true);

    }

    let x = 0, y = 0;
    let lineHeight = getLineHeight(labelData.size, labelData.lineHeight, fonts);
    let maxWidth = 0;
    let lineWidths = [];

    //get max width
    for (i = 0, li = linesGlyphsRes2.length; i < li; i++) {
        lineWidths[i] = getTextLength(null, labelData.size, labelData.spacing, fonts, linesGlyphsRes2[i]);
        maxWidth = Math.max(lineWidths[i], maxWidth);
    }

    //generate text
    for (i = 0, li = linesGlyphsRes2.length; i < li; i++) {
        const textWidth = lineWidths[i];

        switch(labelData.align) {
        case 'left': x = 0; break;
        case 'right': x = maxWidth - textWidth; break;
        case 'center': x = (maxWidth - textWidth)*0.5; break;
        }

        index = addText([x,y,0], [1,0,0], null, labelData.size, labelData.spacing, fonts, vertexBuffer, texcoordsBuffer, true, index, planes, linesGlyphsRes2[i], singleBuffer);
        y -= lineHeight;
    }

    //get offset
    const originOffset = getOriginOffset(labelData.origin, maxWidth, -y);
    const offsetX = originOffset[0] + labelData.offset[0];
    const offsetY = originOffset[1] + labelData.offset[1];

    const p1 = point[0];
    const p2 = point[1];
    const p3 = point[2];

    //set origin buffer and apply offset
    if (!singleBuffer) {
        for (i = lastIndex; i < index; i+=4) {
            vertexBuffer[i] += offsetX;
            vertexBuffer[i+1] -= offsetY;

            originBuffer[index2] = p1;
            originBuffer[index2 + 1] = p2;
            originBuffer[index2 + 2] = p3;
            index2 += 3;
        }
    } else {
        for (i = lastIndex; i < index; i+=8) {
            singleBuffer[i] += offsetX;
            singleBuffer[i+1] -= offsetY;
            singleBuffer[i+2] += offsetX;
            singleBuffer[i+3] -= offsetY;
        }

        labelData.pos = [p1,p2,p3];
        singleBuffer = new Float32Array(singleBuffer.buffer, 0, index);
    }

    //const fonts = labelData.fonts;
    labelData.files = new Array(fonts.length);

    for (i = 0, li= fonts.length; i < li; i++) {
        labelData.files[i] = [];
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

        labelData.files[fontIndex] = files;
    }

    labelData.index = index;
    labelData.index2 = index2;

    return [offsetX * 0.5, offsetY * 0.5, (offsetX + maxWidth) * 0.5 + 1, (offsetY + Math.abs(y)) *0.5];
}

function processPointArrayGeometry(pointArray) {

    checkDPoints(pointArray);

    let pointsGroups;

    if (pointArray['lines']) {  //use lines as points
        pointsGroups = pointArray['lines'];
    } else {
        pointsGroups = [pointArray['points']];
    }

    if (!pointsGroups || pointsGroups.length == 0) {
        return;
    }

    let totalPoints = 0;
    const indicesBuffer = new Uint32Array(pointsGroups.length);

    for (let i = 0; i < pointsGroups.length; i++) {
        indicesBuffer[i] = totalPoints;

        if (Array.isArray(pointsGroups[i])) {
            totalPoints += pointsGroups[i].length;
        }
    }

    const geometryBuffer = new Float64Array(totalPoints * 3);

    /*const forceOrigin = globals.forceOrigin;
    const tileX = globals.tileX;
    const tileY = globals.tileY;*/
    const forceScale = globals.forceScale;
    let index = 0, p1, pp, p;

    for (let i = 0; i < pointsGroups.length; i++) {
        if (!Array.isArray(pointsGroups[i]) || !pointsGroups[i].length) {
            continue;
        }

        const points = pointsGroups[i];

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
    postGroupMessageFast(VTS_WORKERCOMMAND_ADD_RENDER_JOB, VTS_WORKER_TYPE_POINT_GEOMETRY, {
        'id':pointArray['id'] }, [geometryBuffer, indicesBuffer], (""+globals.signatureCounter));
}

export {processPointArrayPass, processPointArrayGeometry, processPointArrayVSwitchPass, checkDPoints};
