
import {globals as globals_, vec3Normalize as vec3Normalize_,
        vec3Length as vec3Length_, vec3Cross as vec3Cross_} from './worker-globals.js';

import {Typr as Typr_} from './worker-font.js';


//get rid of compiler mess
const globals = globals_,
    vec3Normalize = vec3Normalize_, vec3Length = vec3Length_,
    vec3Cross = vec3Cross_,
    Typr = Typr_;


function setFont(fontData) {
    //console.log('setFont ' + fontData['url']);
    //debugger;

    const font = Typr.parse(fontData['data']);

    globals.fontsStorage[fontData['url']] = font;
}


function setFontMap(fontMap) {
    const fonts = fontMap['map'];
    for (let key in fonts) {
        globals.fonts[key] = globals.fontsStorage[fonts[key]];
    }

    globals.fontsMap = fonts;
}


//http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/

function mat3toQuad2(m) {  //TODO: use m as one dimensional vector

    const tr = m[0][0] + m[1][1] + m[2][2];
    let qx,qy,qz,qw,s;

    if (tr > 0) {
      s = Math.sqrt(tr+1.0) * 2; // S=4*qw
      qw = 0.25 * s;
      qx = (m[2][1] - m[1][2]) / s;
      qy = (m[0][2] - m[2][0]) / s;
      qz = (m[1][0] - m[0][1]) / s;
    } else if ((m[0][0] > m[1][1])&(m[0][0] > m[2][2])) {
      s = Math.sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2; // S=4*qx
      qw = (m[2][1] - m[1][2]) / s;
      qx = 0.25 * s;
      qy = (m[0][1] + m[1][0]) / s;
      qz = (m[0][2] + m[2][0]) / s;
    } else if (m[1][1] > m[2][2]) {
      s = Math.sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2; // S=4*qy
      qw = (m[0][2] - m[2][0]) / s;
      qx = (m[0][1] + m[1][0]) / s;
      qy = 0.25 * s;
      qz = (m[1][2] + m[2][1]) / s;
    } else {
      s = Math.sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2; // S=4*qz
      qw = (m[1][0] - m[0][1]) / s;
      qx = (m[0][2] + m[2][0]) / s;
      qy = (m[1][2] + m[2][1]) / s;
      qz = 0.25 * s;
    }

    return [qx,qy,qz,qw];
}


function addChar(pos, dir, verticalShift, char, factor, spacing, index, index2, textVector, fonts, vertexBuffer, texcoordsBuffer, flat, planes, fontIndex, singleBuffer) {
    let n, font = fonts[fontIndex];
    let up = [0,0,0];

    if (globals.geocent && !flat) {
        n = [0,0,0];
        vec3Normalize(globals.bboxMin, up);
        vec3Cross(up, dir, n);
    } else {
        n = [-dir[1],dir[0],0];
    }

    vec3Cross(dir, n, up);

    let p1 = [pos[0], pos[1], pos[2]];
    let p2 = [p1[0], p1[1], p1[2]];

    let fc = font.glyphs[char];
    char = 0; // hack

    if (!fc) {
        return [pos, index, index2, 0];
    }

    let l = 0;
    let nx = textVector[0];
    let ny = textVector[1];
    let nz = textVector[2];

    if (char == 9 || char == 32) {  //tab or space
        fc = font.glyphs[32]; //chars[32]; //space

        if (fc) {
            pos[0] += dir[0] * (fc.step) * factor * spacing;
            pos[1] += dir[1] * (fc.step) * factor * spacing;
            l = fc.lx * factor;
        }
    } else {
        if (fc.lx == 0) {
            pos[0] = pos[0] + dir[0] * fc.step * factor * spacing;
            pos[1] = pos[1] + dir[1] * fc.step * factor * spacing;
            l = fc.lx * factor;
        } else {
            const planeShift = fontIndex * 4000;
            const plane = fc.plane + planeShift;

            if (planes) {
                if (!planes[fontIndex]) {
                    planes[fontIndex] = {};
                }

                planes[fontIndex][plane] = true;
            }

            const factorX = fc.lx * factor;
            const factorY = fc.ly * factor;

            if (singleBuffer) {

                if (globals.processLineLabel && globals.useLineLabel2) {

                    p1[0] = p1[0] + dir[0] * fc.sx * factor;
                    p1[1] = p1[1] + dir[1] * fc.sx * factor;
                    p1[2] = p1[2] + dir[2] * fc.sx * factor;
                    p1[0] = p1[0] + n[0] * (fc.sy - font.size) * factor;
                    p1[1] = p1[1] + n[1] * (fc.sy - font.size) * factor;
                    p1[2] = p1[2] + n[2] * (fc.sy - font.size) * factor;

                    const n2 = [n[0] * verticalShift, n[1] * verticalShift, n[2] * verticalShift];
                    //const n3 = [n2[0] + n[0] * factorY, n2[1] + n[1] * factorY, n2[2] + n[2] * factorY];

                    singleBuffer[index] = p1[0] - n2[0];
                    singleBuffer[index+1] = p1[1] - n2[1];
                    singleBuffer[index+2] = p1[2] - n2[2];


                    const m = [ [dir[0], dir[1], dir[2]],
                              [n[0], n[1], n[2]],
                              [up[0], up[1], up[2]] ];

                    /*
                    const m = [ dir[0], dir[1], dir[2],
                              n[0], n[1], n[2],
                              up[0], up[1], up[2] ];*/

                    const q = mat3toQuad2(m);
                    singleBuffer[index+3] = q[0];  //x
                    singleBuffer[index+4] = q[1];  //y
                    singleBuffer[index+5] = q[2];  //z
                    singleBuffer[index+6] = q[3];  //w

                    if (!globals.lineLabelPass) {
                        singleBuffer[index+7] = factorX;
                        singleBuffer[index+8] = factorY;
                    }

                    singleBuffer[index+9] = fc.u1;
                    singleBuffer[index+10] = fc.v1 + planeShift;

                    const dtx = (fc.u2 - fc.u1) * 1024;
                    const dty = (fc.v2 - fc.v1);// * 1024;

                    singleBuffer[index+11] = dtx + dty;  // u store in decimal part, v stored in fraction part

                    const dx = dir[0]*0.5*factorX - n[0]*0.5*factorY - n2[0];
                    const dy = dir[1]*0.5*factorX - n[1]*0.5*factorY - n2[1];
                    const dz = dir[2]*0.5*factorX - n[2]*0.5*factorY - n2[2];

                    //globals.lineLabelPoints.push([p1[0] + dx, p1[1] + dy, p1[2] + dz, Math.sqrt(factorX*factorX + factorY*factorY)*0.5]);
                    globals.lineLabelPoints.push([p1[0] + dx, p1[1] + dy, p1[2] + dz, Math.sqrt(factorX*factorX + factorY*factorY)*0.5,
                                                  singleBuffer[index], singleBuffer[index+1], singleBuffer[index+2],
                                                  singleBuffer[index+3], singleBuffer[index+4], singleBuffer[index+5], singleBuffer[index+6], factorX, factorY]);

                    index += 12;

                } else {
                    singleBuffer[index] = p1[0] + fc.sx * factor;
                    singleBuffer[index+1] = p1[1] + (fc.sy - font.size) * factor;
                    singleBuffer[index+2] = singleBuffer[index] + factorX;
                    singleBuffer[index+3] = singleBuffer[index+1] - factorY;
                    singleBuffer[index+4] = fc.u1;
                    singleBuffer[index+5] = fc.v1 + planeShift;
                    singleBuffer[index+6] = fc.u2;
                    singleBuffer[index+7] = fc.v2 + planeShift;

                    index += 8;
                }

            } else {

                const n2 = [n[0] * verticalShift, n[1] * verticalShift, n[2] * verticalShift];
                const n3 = [n2[0] + n[0] * factorY, n2[1] + n[1] * factorY, n2[2] + n[2] * factorY];

                p1[0] = p1[0] + dir[0] * fc.sx * factor;
                p1[1] = p1[1] + dir[1] * fc.sx * factor;
                p1[2] = p1[2] + dir[2] * fc.sx * factor;
                p1[0] = p1[0] + n[0] * (fc.sy - font.size) * factor;
                p1[1] = p1[1] + n[1] * (fc.sy - font.size) * factor;
                p1[2] = p1[2] + n[2] * (fc.sy - font.size) * factor;

                p2[0] = p1[0] + dir[0] * factorX;
                p2[1] = p1[1] + dir[1] * factorX;
                p2[2] = p1[2] + dir[2] * factorX;

                //first polygon
                vertexBuffer[index] = p1[0] - n2[0];
                vertexBuffer[index+1] = p1[1] - n2[1];
                vertexBuffer[index+2] = p1[2] - n2[2];
                vertexBuffer[index+3] = nz;

                texcoordsBuffer[index2] = fc.u1;
                texcoordsBuffer[index2+1] = fc.v1 +  planeShift;
                texcoordsBuffer[index2+2] = nx;
                texcoordsBuffer[index2+3] = ny;

                vertexBuffer[index+4] = p1[0] - n3[0];
                vertexBuffer[index+5] = p1[1] - n3[1];
                vertexBuffer[index+6] = p1[2] - n3[2];
                vertexBuffer[index+7] = nz;

                texcoordsBuffer[index2+4] = fc.u1;
                texcoordsBuffer[index2+5] = fc.v2 +  planeShift;
                texcoordsBuffer[index2+6] = nx;
                texcoordsBuffer[index2+7] = ny;

                vertexBuffer[index+8] = p2[0] - n2[0];
                vertexBuffer[index+9] = p2[1] - n2[1];
                vertexBuffer[index+10] = p2[2] - n2[2];
                vertexBuffer[index+11] = nz;

                texcoordsBuffer[index2+8] = fc.u2;
                texcoordsBuffer[index2+9] = fc.v1 +  planeShift;
                texcoordsBuffer[index2+10] = nx;
                texcoordsBuffer[index2+11] = ny;


                //next polygon
                vertexBuffer[index+12] = p1[0] - n3[0];
                vertexBuffer[index+13] = p1[1] - n3[1];
                vertexBuffer[index+14] = p1[2] - n3[2];
                vertexBuffer[index+15] = nz;

                texcoordsBuffer[index2+12] = fc.u1;
                texcoordsBuffer[index2+13] = fc.v2 +  planeShift;
                texcoordsBuffer[index2+14] = nx;
                texcoordsBuffer[index2+15] = ny;

                vertexBuffer[index+16] = p2[0] - n3[0];
                vertexBuffer[index+17] = p2[1] - n3[1];
                vertexBuffer[index+18] = p2[2] - n3[2];
                vertexBuffer[index+19] = nz;

                texcoordsBuffer[index2+16] = fc.u2;
                texcoordsBuffer[index2+17] = fc.v2 +  planeShift;
                texcoordsBuffer[index2+18] = nx;
                texcoordsBuffer[index2+19] = ny;

                vertexBuffer[index+20] = p2[0] - n2[0];
                vertexBuffer[index+21] = p2[1] - n2[1];
                vertexBuffer[index+22] = p2[2] - n2[2];
                vertexBuffer[index+23] = nz;

                texcoordsBuffer[index2+20] = fc.u2;
                texcoordsBuffer[index2+21] = fc.v1 +  planeShift;
                texcoordsBuffer[index2+22] = nx;
                texcoordsBuffer[index2+23] = ny;

                index += 24;
                index2 += 24;
            }

            pos[0] = pos[0] + dir[0] * fc.step * factor * spacing;
            pos[1] = pos[1] + dir[1] * fc.step * factor * spacing;
            l = fc.lx * factor;
        }
    }

    return [pos, index, index2, l * spacing];
}


function getCharVerticesCount(origin) {
    return (origin ? 3 : 4) * 3 * 2;
}


function addText(pos, dir, text, size, spacing, fonts, vertexBuffer, texcoordsBuffer, flat, index, planes, glyphsRes, singleBuffer) {
    let textVector = [0,1,0];
    let p1 = [pos[0], pos[1], pos[2]];

    const res = glyphsRes ? glyphsRes : Typr.U.stringToGlyphs(fonts, text);
    const glyphs = res[0];
    const gfonts = res[1];

    for (let i = 0, li = glyphs.length; i < li; i++) {
        let glyph = glyphs[i];
        let font = fonts[gfonts[i]];

        if (font) {
            const factor = getFontFactor(size, font);

            const shift = addChar(p1, dir, 0, glyph, factor, spacing, index, index, textVector, fonts, vertexBuffer, texcoordsBuffer, flat, planes, gfonts[i], singleBuffer);

            //const gid2 = (i<gls.length-1 && gls[i+1]!=-1)  ? gls[i+1] : 0;
            //x += Typr.U.getPairAdjustment(font, gid, gid2);

            p1 = shift[0];
            index = shift[1];
        }
    }

    return index;
}


function addTextOnPath(points, distance, text, size, spacing, textVector, fonts, verticalOffset, vertexBuffer, texcoordsBuffer, index, planes, glyphsRes, singleBuffer) {
    if (textVector == null) {
        textVector = [0,1,0];
    }

    //let p1 = points[0];
    //const newLineSpace = getLineHeight(size, fonts);
    //const s = [p1[0], p1[1], p1[2]];

    //p1 = [p1[0], p1[1], p1[2]];
    let l = distance;

    const res = glyphsRes ? glyphsRes : Typr.U.stringToGlyphs(fonts, text);
    const glyphs = res[0];
    const gfonts = res[1];

    globals.processLineLabel = true;

    for (let i = 0, li = glyphs.length; i < li; i++) {
        /*
        let char = text.charCodeAt(i);

        if (char == 10) { //new line
            s[0] += -dir[1] * newLineSpace;
            s[1] += dir[0] * newLineSpace;
            p1 = [s[0], s[1], s[2]];
            continue;
        }

        if (char == 9) { //tab
            char = 32;
        }
        */

        const glyph = glyphs[i];
        const font = fonts[gfonts[i]];

        if (font) {
            const factor = getFontFactor(size, font);

            let ll = 0.01;
            const fc = font.glyphs[glyph];
            if (fc) {
                ll = fc.step * factor * spacing;
            }

            const posAndDir = getPathPositionAndDirection(points, l);
            const posAndDir2 = getPathPositionAndDirection(points, l+ll);

            //average dir
            const dir = [(posAndDir2[1][0] + posAndDir[1][0])*0.5,
                (posAndDir2[1][1] + posAndDir[1][1])*0.5,
                (posAndDir2[1][2] + posAndDir[1][2])*0.5];

            vec3Normalize(dir);

            const shift = addChar(posAndDir[0], dir, -factor*font.size*0.7+verticalOffset, glyph, factor, spacing, index, index, textVector, fonts, vertexBuffer, texcoordsBuffer, null, planes, gfonts[i], singleBuffer);

            //p1 = shift[0];
            index = shift[1];
            //index2 = shift[2];
            l += ll;
        }
    }

    globals.processLineLabel = false;

    return index;
}


function addStreetTextOnPath(points, text, size, spacing, fonts, verticalOffset, vertexBuffer, texcoordsBuffer, index, planes, glyphsRes, singleBuffer) {
    const textLength = getTextLength(text, size, spacing, fonts, glyphsRes);
    const pathLength = getPathLength(points);
    let shift = (pathLength -  textLength)*0.5;
    if (shift < 0) {
        shift = 0;
    }

    if (textLength > pathLength) {
        return;
    }

    const textVector = getPathTextVector(points, shift, text, size, spacing, fonts, glyphsRes);
    globals.textVector = textVector;
    globals.textCenter = getPathPositionAndDirection(points, pathLength * 0.5)[0];
    globals.textLength = textLength;

    return addTextOnPath(points, shift, text, size, spacing, textVector, fonts, verticalOffset, vertexBuffer, texcoordsBuffer, index, planes, glyphsRes, singleBuffer);
}


function getFontFactor(size, font) {
    return font ? ((size / font.size) * 1.52) : 1;
}


function getLineHeight(size, lineHeight, fonts) {
    const factor = getFontFactor(size, fonts[0]);
    //return font.space * factor;
    return fonts[0].cly * factor * lineHeight;
}


function getTextLength(text, size, spacing, fonts, glyphsRes) {
    let l = 0;

    const res = glyphsRes ? glyphsRes : Typr.U.stringToGlyphs(fonts, text);
    const glyphs = res[0];
    const gfonts = res[1];

    for (let i = 0, li = glyphs.length; i < li; i++) {
        const glyph = glyphs[i];
        const font = fonts[gfonts[i]];

        if (font) {
            const factor = getFontFactor(size, font) * spacing;
            const fc = font.glyphs[glyph];

            if (fc) {
                if (i == (li-1)) {
                    l += fc.lx * factor;
                } else {
                    l += fc.step * factor;
                }
            }
        }
    }

    return l;
}


function getSplitIndex(text, width, size, spacing, fonts, glyphsRes) {
    let l = 0, i, li;

    const res = glyphsRes ? glyphsRes : Typr.U.stringToGlyphs(fonts, text);
    const glyphs = res[0];
    const gfonts = res[1];
    const codes = res[2];

    for (i = 0, li = glyphs.length; i < li; i++) {
        const glyph = glyphs[i];
        const char = codes[i];//text.charCodeAt(i);

        if (l > width && (char == 10 || char == 9 || char == 32)) {
            return i;
        }

        if (char == 10) { //new line
            continue;
        }

        const font = fonts[gfonts[i]];

        if (font) {
            const factor = getFontFactor(size, font) * spacing;
            const fc = font.glyphs[glyph];

            if (fc) {
                if (i == (li-1)) {
                    l += fc.lx * factor;
                } else {
                    l += fc.step * factor;
                }
            }
        }
    }

    return li;
}


function getPathLength(points) {
    let l = 0;

    for (let i = 0, li = points.length-1; i < li; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        const dir = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];

        l += vec3Length(dir);
    }

    return l;
}


function getPathPositionAndDirection(points, distance) {
    let l = 0, p2;
    let p1 = [0,0,0];
    let dir = [1,0,0];

    for (let i = 0, li = points.length-1; i < li; i++) {
        p1 = points[i];
        p2 = points[i+1];
        dir = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];

        const ll = vec3Length(dir);

        if ((l + ll) > distance) {

            const factor = (distance - l) / (ll);
            const p = [p1[0] + dir[0] * factor,
                p1[1] + dir[1] * factor,
                p1[2] + dir[2] * factor];

            vec3Normalize(dir);

            return [p, dir];
        }

        l += ll;
    }

    return [p1, dir];
}


function getPathTextVector(points, shift, text, size, spacing, fonts, glyphsRes) {
    let l = 0;
    let p1 = [0,0,0], p2;
    let dir = [1,0,0];
    let textDir = [0,0,0];
    const textStart = shift;
    const textEnd = shift + getTextLength(text, size, spacing, fonts, glyphsRes);
    const bboxMin = globals.bboxMin;
    const geocent = globals.geocent;

    for (let i = 0, li = points.length-1; i < li; i++) {
        p1 = points[i];
        p2 = points[i+1];
        dir = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];

        l += vec3Length(dir);

        if (l > textStart) {
            vec3Normalize(dir);
            textDir[0] += dir[0];
            textDir[1] += dir[1];
            textDir[2] += dir[2];
        }

        if (l > textEnd) {
            vec3Normalize(textDir);

            if (geocent) {
                const nn = [0,0,0];
                vec3Normalize(bboxMin, nn);
                vec3Cross(nn, textDir, nn);
                return nn;
            } else {
                return [-textDir[1], textDir[0],0];
            }
        }
    }

    return textDir;
}


function areTextCharactersAvailable(text, fonts, glyphsRes) {
    if (!text || text == '') {
        return false;
    }

    const res = glyphsRes ? glyphsRes : Typr.U.stringToGlyphs(fonts, text);
    const glyphs = res[0];
    //const gfonts = res[1];

    if (glyphs.indexOf(0) != -1) {
        return false;
    }

    return true;
}


function hasLatin(str) {
    for (let i = 0, li = str.length; i < li; i++) {
        const c = str.charCodeAt(i);
        if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) ||
            ((c >= 0xc0 && c <= 0xff) && c!= 0xd7 && c!= 0xf7) || (c >= 0x100 && c <= 0x17f)) {
            return true;
        }
    }

    return false;
}


function isCJK(str) {
    for (let i = 0, li = str.length; i < li; i++) {
        const c = str.charCodeAt(i);

        if (!((c >= 0x4E00 && c <= 0x62FF) || (c >= 0x6300 && c <= 0x77FF) ||
              (c >= 0x7800 && c <= 0x8CFF) || (c >= 0x8D00 && c <= 0x9FFF) ||
              (c >= 0x3400 && c <= 0x4DBF) || (c >= 0x20000 && c <= 0x215FF) ||
              (c >= 0x21600 && c <= 0x230FF) || (c >= 0x23100 && c <= 0x245FF) ||
              (c >= 0x24600 && c <= 0x260FF) || (c >= 0x26100 && c <= 0x275FF) ||
              (c >= 0x27600 && c <= 0x290FF) || (c >= 0x29100 && c <= 0x2A6DF) ||
              (c >= 0x2A700 && c <= 0x2B73F) || (c >= 0x2B740 && c <= 0x2B81F) ||
              (c >= 0x2B820 && c <= 0x2CEAF) || (c >= 0x2CEB0 && c <= 0x2EBEF) ||
              (c >= 0xF900 && c <= 0xFAFF) || (c >= 0x3300 && c <= 0x33FF) ||
              (c >= 0xFE30 && c <= 0xFE4F) || (c >= 0xF900 && c <= 0xFAFF) ||
              (c >= 0x2F800 && c <= 0x2FA1F) ||
              (c >= 0x0 && c <= 0x40) || (c >= 0xa0 && c <= 0xbf)  )) { //neutral
            return false;
        }
    }

    return true;
}


function getFonts(fonts) {
    const fontsMap = [];
    for (let i = 0, li = fonts.length; i < li; i++) {
        fontsMap.push(globals.fonts[fonts[i]]);
    }

    return fontsMap;
}


function getFontsStorage(fonts) {
    const fontsMap = [];
    for (let i = 0, li = fonts.length; i < li; i++) {
        fontsMap.push(globals.fontsMap[fonts[i]]);
    }

    return fontsMap;
}


function getTextGlyphs(text, fonts) {
    return Typr.U.stringToGlyphs(fonts, text);
}


export {addStreetTextOnPath, getTextLength, getLineHeight, getFontFactor, getSplitIndex, areTextCharactersAvailable,
        addText, addTextOnPath, setFont, setFontMap, getCharVerticesCount, getFonts, getFontsStorage, hasLatin, isCJK, getTextGlyphs};
