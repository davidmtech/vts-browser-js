
import {vec3 as vec3_} from '../utils/matrix';

//get rid of compiler mess
const vec3 = vec3_;


const RendererRMap = function(renderer, blockSize, maxBlockRectangles) {
    this.renderer = renderer;
    this.drawAllLabels = false;
    this.maxBlockRectangles = maxBlockRectangles || 500;
    this.blockSize = blockSize;
    this.blockSizeFactor = 1/blockSize;
    this.blocks = [];
    this.blocks2 = [];
    this.blocksRCount = [];
    this.blocks2RCount = [];
    this.allocatedBlocks = 0;
    this.lx = 1;
    this.ly = 1;
    this.counter = 0;
    this.rectangles = null;
    this.rectanglesCount = 0;
    this.rectangles2 = null;
    this.rectangles2Count = 0;
    this.rectanglesR = null;
    this.rectanglesRCount = 0;
    this.benevolentMargins = false;
    this.positionsBuffer = new Float64Array(256*4);
};


RendererRMap.prototype.clear = function() {
    const renderer = this.renderer;

    this.sx2 = renderer.curSize[0];
    this.sy2 = renderer.curSize[1];

    //reduce by credits
    this.sy2 = Math.max(1, this.sy2 - 55);
    this.sy1 = 1;
    this.sx1 = 1;

    //compass size
    this.cx2 = 135;
    this.cy1 = renderer.curSize[1] - 145;

    //search bar size
    this.bx2 = 245;
    this.by2 = 45;

    this.lx = Math.floor(renderer.curSize[0] * this.blockSizeFactor) + 1;
    this.ly = Math.floor(renderer.curSize[1] * this.blockSizeFactor) + 1;

    if (renderer.marginFlags & 4096) {
        this.sx1 = Math.min(34, this.sx2);
        this.sx2 = Math.max(1, renderer.curSize[0] - 34);
        this.sy1 = Math.min(50, this.sy2);
        this.sy2 = Math.max(1, renderer.curSize[1] - 68);
    }

    const totalNeeded = this.ly * this.lx;

    if (!this.rectangles) {
        this.rectangles = new Array(totalNeeded * this.maxBlockRectangles * 6); //preallocate empty rectangles
    }

    if (!this.rectangles2) {
        this.rectangles2 = new Array(totalNeeded * this.maxBlockRectangles * 6); //preallocate empty rectangles
    }

    if (!this.rectanglesR) {
        this.rectanglesR = new Array(totalNeeded * this.maxBlockRectangles * 6); //preallocate empty rectangles
    }

    if (this.rectanglesCount > 0 || this.allocatedBlocks != totalNeeded) {

        for (let i = 0; i < totalNeeded; i++) { //check if all rectangles are preallocated and reset coutner
            if (!this.blocks[i]) {
                this.blocks[i] = [];
            }

            this.blocksRCount[i] = 0;
        }
    }

    if (this.rectangles2Count > 0 || this.allocatedBlocks != totalNeeded) {

        for (let i = 0; i < totalNeeded; i++) { //check if all rectangles are preallocated and reset coutner
            if (!this.blocks2[i]) {
                this.blocks2[i] = [];
            }

            this.blocks2RCount[i] = 0;
        }
    }

    this.allocatedBlocks = totalNeeded;
    this.drawAllLabels = renderer.debug.drawAllLabels;
    this.benevolentMargins = renderer.benevolentMargins;

    this.rectanglesCount = 0;
    this.rectangles2Count = 0;
    this.rectanglesRCount = 0;
    this.counter = renderer.geoRenderCounter;
};


RendererRMap.prototype.storeRemovedRectangle = function(x1, y1, x2, y2, z, subjob) {
    const rectangles2 = this.rectanglesR;
    const rectangles2Count = this.rectanglesRCount;

    rectangles2[rectangles2Count] = x1;
    rectangles2[rectangles2Count+1] = y1;
    rectangles2[rectangles2Count+2] = x2;
    rectangles2[rectangles2Count+3] = y2;
    rectangles2[rectangles2Count+4] = z;
    rectangles2[rectangles2Count+5] = subjob;
    this.rectanglesRCount += 6;
};


//aabbox circle
//http://www.firenibbler.com/2016/04/27/how-to-js-collision-detection-cheat-sheets-learn-aabb-box-circle-and-point-detection/
RendererRMap.prototype.circleAABBoxCollide = function(x1, y1, x2, y2, cx, cy, cr){
    // Get the distance between the two objects
    const hwidth = (x2 - x1) * 0.5;
    const hheight = (y2 - y1) * 0.5;
    const distX = Math.abs(cx - x1 - hwidth);
    const distY = Math.abs(cy - y2 - hheight);

    // Check to make sure it is definitely not overlapping
    if (distX > (hwidth + cr) || distY > (hheight + cr)) {
        return false;
    }
    // Check to see if it is definitely overlapping
    if (distX <= hwidth || distY <= hheight) {
        return true;
    }

    // Last Resort to see if they are overlapping
    const dx = distX - hwidth;
    const dy = distY - hheight;
    return (dx * dx + dy * dy <= (cr * cr));
};


//aabbox line
//https://gamedev.stackexchange.com/questions/18436/most-efficient-aabb-vs-ray-collision-algorithms
RendererRMap.prototype.lineAABBoxCollide = function(x1, y1, x2, y2, rx1, ry1, rx2, ry2) {
    const dx = 1 / ( (rx2 != rx1) ? (rx2 - rx1) : 0.00001);
    const tx1 = (x1 - rx1)*dx;
    const tx2 = (x2 - rx1)*dx;

    let tmin = Math.min(tx1, tx2);
    let tmax = Math.max(tx1, tx2);

    const dy = 1 / ( (ry2 != ry1) ? (ry2 - ry1) : 0.00001);
    const ty1 = (y1 - ry1)*dy;
    const ty2 = (y2 - ry1)*dy;

    tmin = Math.max(tmin, Math.min(ty1, ty2));
    tmax = Math.min(tmax, Math.max(ty1, ty2));

    return tmax >= tmin;
};


RendererRMap.prototype.checkRectangle = function(x1, y1, x2, y2, y3) {
    let t;

    if (x1 > x2) { t = x1; x1 = x2; x2 = t; }
    if (y1 > y2) { t = y1; y1 = y2; y2 = t; }

    y3 += y2;

    if (this.benevolentMargins) {
        //screen including credits
        return !(x2 < this.sx1 || x1 > this.sx2 || y3 < this.sy1 || y1 > this.sy2);
    }

    //screen including credits
    if (x1 < this.sx1 || x2 > this.sx2 || y1 < this.sy1 || y3 > this.sy2) {
        return false;
    }

    //compass
    if ((this.renderer.marginFlags & 1) && x1 < this.cx2 && x2 > 0 && y1 <= this.sx2 && y3 > this.cy1) {
        return false;
    }

    //search bar
    if ((this.renderer.marginFlags & 2) && x1 < this.bx2 && x2 > 0 && y1 <= this.by2 && y3 > 0) {
        return false;
    }

    return true;
}

RendererRMap.prototype.addRectangle = function(x1, y1, x2, y2, z, subjob, any, checkDepthMap) {
    let x, y, i, index, blockRectangles, blockRectanglesCount,
        rectangleIndex, t, renderer = this.renderer;

    if (this.drawAllLabels) {
        return true;
    }

    if (x1 > x2) { t = x1; x1 = x2; x2 = t; }
    if (y1 > y2) { t = y1; y1 = y2; y2 = t; }

    const y3 = y2 + subjob[1]; //add stick shift

    if (this.benevolentMargins) {
        //screen including credits
        if (x2 < this.sx1 || x1 > this.sx2 || y3 < this.sy1 || y1 > this.sy2) {
            return false;
        }
    } else {
        //screen including credits
        if (x1 < this.sx1 || x2 > this.sx2 || y1 < this.sy1 || y3 > this.sy2) {
            return false;
        }

        //compass
        if ((renderer.marginFlags & 1) && x1 < this.cx2 && x2 > 0 && y1 <= this.sx2 && y3 > this.cy1) {
            return false;
        }

        //search bar
        if ((renderer.marginFlags & 2) && x1 < this.bx2 && x2 > 0 && y1 <= this.by2 && y3 > 0) {
            return false;
        }
    }

    let xx1 = Math.floor(x1 * this.blockSizeFactor);
    let yy1 = Math.floor(y1 * this.blockSizeFactor);
    let xx2 = Math.floor(x2 * this.blockSizeFactor);
    let yy2 = Math.floor(y2 * this.blockSizeFactor);

    if (xx2 < 0 || yy2 < 0 || xx1 >= this.lx || yy1 >= this.ly) {
        return false;
    }

    if (xx1 < 0) xx1 = 0;
    if (xx2 >= this.lx) xx2 = this.lx - 1;

    if (yy1 < 0) yy1 = 0;
    if (yy2 >= this.ly) yy2 = this.ly - 1;

    const lx = (xx2 - xx1) + 1;
    const ly = (yy2 - yy1) + 1;
    const removeList = {};
    //let exit = false;

    const top = renderer.config.mapFeaturesSortByTop,
          rectangles = this.rectangles, rectangles2 = this.rectangles2;

    //test collision
    for (y = 0; y < ly; y++) {
        for (x = 0; x < lx; x++) {
            index = (yy1 + y)*this.lx + (xx1 + x);

            blockRectangles = this.blocks[index];
            blockRectanglesCount = this.blocksRCount[index];

            //test rectangles
            for (i = 0; i < blockRectanglesCount; i++) {
                rectangleIndex = blockRectangles[i];

                if (x1 < rectangles[rectangleIndex + 2] && x2 > rectangles[rectangleIndex + 0] &&
                    y1 < rectangles[rectangleIndex + 3] && y2 > rectangles[rectangleIndex + 1]) {

                    if (any) {
                        return false;
                    }

                    if (top) {
                        if (z < rectangles[rectangleIndex + 4]) {
                            return false;
                        }
                    } else {
                        if (z > rectangles[rectangleIndex + 4]) {
                            return false;
                        }
                    }

                    removeList[rectangleIndex] = true;
                }
            }

            if ((blockRectanglesCount + 1) >= this.maxBlockRectangles) {
                return false;
            }

            blockRectangles = this.blocks2[index];
            blockRectanglesCount = this.blocks2RCount[index];

            //test circles
            for (i = 0; i < blockRectanglesCount; i++) {
                rectangleIndex = blockRectangles[i];

//                if (this.circleAABBoxCollide(rectangles2[rectangleIndex + 0], rectangles2[rectangleIndex + 1], rectangles[rectangleIndex + 2], rectangles[rectangleIndex + 3], x, y, r)) {
                if (this.circleAABBoxCollide(x1, y1, x2, y2, rectangles2[rectangleIndex + 0], rectangles2[rectangleIndex + 1], rectangles[rectangleIndex + 3])) {

                 //   if (any) {
                        return false;
                  //  }
                }
            }


        }
    }

    //remove rectangles
    for (let key in removeList) {
        this.removeRectangle(parseInt(key));
    }

    if (checkDepthMap) {

        const reduce = checkDepthMap[2];
        const depth = renderer.mapHack.getScreenDepth(checkDepthMap[0], checkDepthMap[1], (reduce[4] > 10000000));

        if (depth[0]) {
            const delta = depth[1] - reduce[4];
            reduce[7] = delta;

            if (!renderer.drawHiddenLabels && delta < checkDepthMap[3]) {
                return false;
            }
        }
    }

    //there is no collision so we can store rectangle
    rectangleIndex = this.rectanglesCount;
    rectangles[rectangleIndex] = x1;
    rectangles[rectangleIndex+1] = y1;
    rectangles[rectangleIndex+2] = x2;
    rectangles[rectangleIndex+3] = y2;
    rectangles[rectangleIndex+4] = z;
    rectangles[rectangleIndex+5] = subjob;
    this.rectanglesCount += 6;

    for (y = 0; y < ly; y++) {
        for (x = 0; x < lx; x++) {
            index = (yy1 + y)*this.lx + (xx1 + x);
            this.blocks[index][this.blocksRCount[index]] = rectangleIndex;
            this.blocksRCount[index]++;
        }
    }

    return true;
};


// eslint-disable-next-line
RendererRMap.prototype.addLineLabel = function(subjob, checkDepthMap) {
    const pbuff = this.positionsBuffer;
    const job = subjob[0], renderer = this.renderer;
    const margin = job.noOverlap ? job.noOverlap[0] : 1;

    let blockRectangles, blockRectanglesCount, rectangleIndex;
    let x1 = Number.POSITIVE_INFINITY, x2 = Number.NEGATIVE_INFINITY,
        y1 = Number.POSITIVE_INFINITY, y2 = Number.NEGATIVE_INFINITY;
    let x, y, r, rr = 0, xx, yy, i, li, pp = [0,0,0,0];
    let index = 0, pindex = 0;

    const targetSize = job.labelSize * 0.5;
    const sizeFactor = renderer.camera.scaleFactor2(subjob[5][3])*0.5*renderer.curSize[1]*(renderer.curSize[0]/renderer.curSize[1]);
    const labelPoints = job.labelPoints;
    let pointsIndex = subjob[9];
    let labelIndex = job.labelIndex;
    let labelMorph = 0;

    li = labelPoints.length;

    if (li <= 1 || labelPoints[li -1][0]*sizeFactor < targetSize) {
        return;
    }

    li--;

    for (i = 0; i < li; i++) {
        const s2 = labelPoints[i+1][0] * sizeFactor;

        if (s2 > targetSize) {
            const s1 = labelPoints[i][0] * sizeFactor;

            labelIndex = i;
            labelMorph = (targetSize - s1) / (s2 - s1);
            break;
        }
    }

    pointsIndex = (vec3.dot(labelPoints[labelIndex][1], renderer.labelVector) >= 0) ? 3 : 2;

    let points = labelPoints[labelIndex][pointsIndex];
    let points2 = (labelPoints[labelIndex+1]) ? labelPoints[labelIndex+1][pointsIndex] : points;
    let p, p2, buffer, benevolentMargins = this.benevolentMargins;

    if (renderer.useSuperElevation) {
        buffer = job.labelPointsBuffer;

        if (buffer.id != (labelIndex * 1024 + pointsIndex)) {
            buffer.id = (labelIndex * 1024 + pointsIndex);
            if (buffer.points.length != points.length) {
                buffer.points = new Array(points.length);
                buffer.points2 = new Array(points.length);
            }

            const sePoints = buffer.points;
            const sePoints2 = buffer.points2;

            for(i = 0, li = points.length; i < li; i++) {
                sePoints[i] = renderer.transformPointBySE2(points[i]);
                sePoints2[i] = renderer.transformPointBySE2(points2[i]);
            }

            points = sePoints;
            points2 = sePoints2;

        } else {
            points = buffer.points;
            points2 = buffer.points2;
        }
    }

    if (!points.length || !points2.length) {
        return false;
    }

    for (i = 0, li = points.length; i < li; i++) {

        p = points[i];
        p2 = points2[i];

        pp[0] = p[0] + (p2[0] - p[0]) * labelMorph;
        pp[1] = p[1] + (p2[1] - p[1]) * labelMorph;
        pp[2] = p[2] + (p2[2] - p[2]) * labelMorph;
        r = (p[3] + (p2[3] - p[3]) * labelMorph)*sizeFactor*margin;

        pp = renderer.project2(pp, renderer.camera.mvp, renderer.cameraPosition, true);

        if (pp[0] > x2) x2 = pp[0];
        if (pp[1] > y2) y2 = pp[1];
        if (pp[0] < x1) x1 = pp[0];
        if (pp[1] < y1) y1 = pp[1];

        //minX, maxX, minY, maxY;
        pbuff[pindex] = pp[0];
        pbuff[pindex+1] = pp[1];
        pbuff[pindex+2] = pp[2];
        pbuff[pindex+3] = r;

        if (r > rr) {
            rr = r;
        }

        pindex += 4;
    }

    x1 -= rr, x2 += rr, y1 -= rr, y2 += rr;

    if (benevolentMargins) {
        //screen including credits
        if (x2 < this.sx1 || x1 > this.sx2 || y2 < this.sy1 || y1 > this.sy2) {
            return false;
        }
    } else {
        //screen including credits
        if (x1 < this.sx1 || x2 > this.sx2 || y1 < this.sy1 || y2 > this.sy2) {
            return false;
        }

        //compass
        if ((renderer.marginFlags & 1) && x1 < this.cx2 && x2 > 0 && y1 <= this.sx2 && y2 > this.cy1) {
            return false;
        }

        //search bar
        if ((renderer.marginFlags & 2) && x1 < this.bx2 && x2 > 0 && y1 <= this.by2 && y2 > 0) {
            return false;
        }
    }

    const blockSizeFactor = this.blockSizeFactor;
    const /*top = renderer.config.mapFeaturesSortByTop,*/
          rectangles = this.rectangles, rectangles2 = this.rectangles2;
    let xx1, yy1, xx2, yy2, dx, dy, llx = this.lx, lly = this.ly, j;

    pindex = 0;

    for (i = 0, li = points.length; i < li; i++) {

        xx = pbuff[pindex];
        yy = pbuff[pindex+1];
        r = pbuff[pindex+3];

        xx1 = Math.floor((xx-r) * blockSizeFactor);
        yy1 = Math.floor((yy-r) * blockSizeFactor);
        xx2 = Math.floor((xx+r) * blockSizeFactor);
        yy2 = Math.floor((yy+r) * blockSizeFactor);

        if (benevolentMargins) {
            if (xx2 < 0 || xx1 >= llx || yy2 < 0 || yy1 >= lly) {
              pindex += 4;
              continue;
            }
            if (xx1 < 0) xx1 = 0;
            if (yy1 < 0) yy1 = 0;
            if (xx2 >= llx) xx2 = llx - 1;
            if (yy2 >= lly) yy2 = lly - 1;
        }

        const lx = (xx2 - xx1) + 1;
        const ly = (yy2 - yy1) + 1;

        //test collision
        for (y = 0; y < ly; y++) {
            for (x = 0; x < lx; x++) {
                index = (yy1 + y)*llx + (xx1 + x);

                blockRectangles = this.blocks[index];
                blockRectanglesCount = this.blocksRCount[index];

                //test rectangles
                for (j = 0; j < blockRectanglesCount; j++) {
                    rectangleIndex = blockRectangles[j];

                    if (this.circleAABBoxCollide(x1, y1, x2, y2, rectangles[rectangleIndex + 0], rectangles[rectangleIndex + 1], rectangles[rectangleIndex + 2])) {

                        //if (any) {
                            return false;
                        //}
                    }
                }

                blockRectangles = this.blocks2[index];
                blockRectanglesCount = this.blocks2RCount[index];

                //test circles
                for (j = 0; j < blockRectanglesCount; j++) {
                    rectangleIndex = blockRectangles[j];

                    dx = xx - rectangles2[rectangleIndex + 0];
                    dy = yy - rectangles2[rectangleIndex + 1];
                    rr = rectangles2[rectangleIndex + 2] + r;

                    if ((dx*dx + dy*dy) < (rr * rr)) {

                        //if (any) {
                            return false;
                        //}
                    }
                }
            }
        }

        pindex += 4;
    }

    //there is no collision so we can store line label
    pindex = 0;

    for (i = 0, li = points.length; i < li; i++) {

        xx = pbuff[pindex];
        yy = pbuff[pindex+1];
        r = pbuff[pindex+3];

        xx1 = Math.floor((xx-r) * blockSizeFactor);
        yy1 = Math.floor((yy-r) * blockSizeFactor);
        xx2 = Math.floor((xx+r) * blockSizeFactor);
        yy2 = Math.floor((yy+r) * blockSizeFactor);

        if (benevolentMargins) {
            if (xx2 < 0 || xx1 >= llx || yy2 < 0 || yy1 >= lly) {
              pindex += 4;
              continue;
            }
            if (xx1 < 0) xx1 = 0;
            if (yy1 < 0) yy1 = 0;
            if (xx2 >= llx) xx2 = llx - 1;
            if (yy2 >= lly) yy2 = lly - 1;
        }

        const lx = (xx2 - xx1) + 1;
        const ly = (yy2 - yy1) + 1;

        rectangleIndex = this.rectangles2Count;
        rectangles2[rectangleIndex] = xx;
        rectangles2[rectangleIndex+1] = yy;
        rectangles2[rectangleIndex+2] = r;
        rectangles2[rectangleIndex+3] = subjob;
        this.rectangles2Count += 4;

        //test collision
        for (y = 0; y < ly; y++) {
            for (x = 0; x < lx; x++) {
                index = (yy1 + y)*this.lx + (xx1 + x);

                //console.log('' + index);

                //if (typeof this.blocks2[index][this.blocks2RCount[index]] === 'undefined') {
                  //  debugger
                //}

                this.blocks2[index][this.blocks2RCount[index]] = rectangleIndex;
                this.blocks2RCount[index]++;
            }
        }

        pindex += 4;
    }

    return true;
};


RendererRMap.prototype.removeRectangle = function(rectangleIndex) {
    const rectangles = this.rectangles;
    let x1, y1, x2, y2, x, y, i, index,
        blockRectangles, blockRectanglesCount;

    x1 = rectangles[rectangleIndex];
    y1 = rectangles[rectangleIndex+1];
    x2 = rectangles[rectangleIndex+2];
    y2 = rectangles[rectangleIndex+3];

    //store removed rectangels for second pass
    const rectangles2 = this.rectanglesR;
    const rectangles2Count = this.rectanglesRCount;

    rectangles2[rectangles2Count] = x1;
    rectangles2[rectangles2Count+1] = y1;
    rectangles2[rectangles2Count+2] = x2;
    rectangles2[rectangles2Count+3] = y2;
    rectangles2[rectangles2Count+4] = rectangles[rectangleIndex+4];
    rectangles2[rectangles2Count+5] = rectangles[rectangleIndex+5];
    this.rectanglesRCount += 6;

    //remove subjob
    rectangles[rectangleIndex+5] = null;

    let xx1 = Math.floor(x1 * this.blockSizeFactor);
    let yy1 = Math.floor(y1 * this.blockSizeFactor);
    let xx2 = Math.floor(x2 * this.blockSizeFactor);
    let yy2 = Math.floor(y2 * this.blockSizeFactor);

    if (xx1 < 0) xx1 = 0;
    if (xx2 >= this.lx) xx2 = this.lx - 1;

    if (yy1 < 0) yy1 = 0;
    if (yy2 >= this.ly) yy2 = this.ly - 1;

    const lx = (xx2 - xx1) + 1;
    const ly = (yy2 - yy1) + 1;

    for (y = 0; y < ly; y++) {
        for (x = 0; x < lx; x++) {
            index = (yy1 + y)*this.lx + (xx1 + x);

            blockRectangles = this.blocks[index];
            blockRectanglesCount = this.blocksRCount[index];

            for (i = 0; i < blockRectanglesCount; i++) {
                if (blockRectangles[i] == rectangleIndex) {
                    blockRectangles[i] = blockRectangles[blockRectanglesCount - 1];
                    this.blocksRCount[index]--;
                    break;
                }
            }

        }
    }
};

RendererRMap.prototype.processRectangles = function(gpu, gl, renderer, screenPixelSize) {
    const rectangles = this.rectangles;
    const rectangles2 = this.rectangles2;
    const rectanglesR = this.rectanglesR;
    const draw = renderer.gpu.draw;

    // second pass
    // add removed rectangles
    for (let i = 0, li = this.rectanglesRCount; i < li; i+=6) {
        const x1 = rectanglesR[i],
            y1 = rectanglesR[i+1],
            x2 = rectanglesR[i+2],
            y2 = rectanglesR[i+3],
            z = rectanglesR[i+4],
            subjob = rectanglesR[i+5];

        this.addRectangle(x1, y1, x2, y2, z, subjob);
    }

    this.rectanglesRCount = 0;

    //labels
    for (let i = 0, li = this.rectanglesCount; i < li; i+=6) {
        const subjob = rectangles[i+5];

        if (subjob) {
            if (subjob[0].hysteresis) {
                renderer.jobHBuffer[subjob[0].id] = subjob[0];
            } else {
                renderer.drawnJobs++;
                draw.drawGpuSubJob(gpu, gl, renderer, screenPixelSize, subjob, null);
            }
        }
    }

    //line labels
    for (let i = 0, li = this.rectangles2Count; i < li; i+=4) {
        const subjob = rectangles2[i+3];

        if (subjob) {
            const job = subjob[0];

            if (job.hysteresis) {
                renderer.jobHBuffer[job.id] = job;
            } else {
                renderer.drawnJobs++;
                draw.drawGpuSubJobLineLabel(gpu, gl, renderer, screenPixelSize, subjob, null);
            }

            const l = job.labelPoints[0][2].length;

            if (l > 0) {
                i += (4 * (l - 1));
            }
        }
    }

    this.clear();
};

export default RendererRMap;
