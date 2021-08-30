

function processGMap(gpu, gl, renderer, screenPixelSize, draw) {
    if (!renderer.config.mapFeaturesReduceParams) {
        return;
    }

    const featuresPerSquareInch = renderer.config.mapFeaturesReduceParams[0]; //0.6614; //labelsPerSquareInch
    const ppi = 96 * (window.devicePixelRatio || 1);
    const screenLX = renderer.curSize[0];
    const screenLY = renderer.curSize[1];
    let tileCount = renderer.config.mapFeaturesReduceParams[1]; //31; //labelGridCells
    let featureCount = Math.ceil((screenLX/ppi)*(screenLY/ppi)*featuresPerSquareInch);
    let i, li, top = renderer.config.mapFeaturesSortByTop;

    if (tileCount <= 0) {
        tileCount = featureCount * 2; //31; //labelGridCells
    }

    //renderer.debugStr = '<br>featuresPerScr: ' + featureCount + '<br>gridCells: ' + tileCount + '';

    //get top features
    const featureCache = renderer.gmap;
    const featureCacheSize = renderer.gmapIndex;
    const topFeatures = renderer.gmapTop;
    let featureCount2 = featureCount;

    if (featureCount > featureCacheSize) {
        featureCount2 = featureCacheSize;
    }

    //distribute top features
    const drawAllLabels = renderer.drawAllLabels;
    let tileSize = Math.floor(Math.sqrt((screenLX*screenLY) / tileCount));
    let tileFeatures, count, feature, job, usedFeatures = 0;

    const colors = [
        [0, 0, 255, 255],
        [128, 0, 255, 255],
        [255, 0, 0, 255],
        [255, 128, 0, 255],
        [0, 255, 0, 255],
        [0, 255, 128, 255],
        [128, 255, 128, 255]
    ];

    let colorIndex = 0;

    do {
        let a,b,c,d,ix,iy,is,pp,tx,ty,mx,my,v,index,o,j;

        ix = screenLX / tileSize;
        iy = screenLY / tileSize;
        is = ix * iy;
        mx = Math.floor(ix);
        my = Math.floor(iy);
        ix = ix - mx;
        iy = iy - my;

        a = 1 / is;
        b = ix / is;
        c = iy / is;
        d = (ix*iy) / is;

        a = Math.floor(a * featureCount);
        b = Math.floor(b * featureCount);
        c = Math.floor(c * featureCount);
        d = Math.floor(d * featureCount);

        const hitMap = renderer.gmapStore;
        const hitMapCount = renderer.gmapHit;

        if (renderer.drawGridCells) {
            gpu.setState(renderer.lineLabelState);

            let x = 0, y = 0, j, lj;

            for (j = 0, lj = (my + 1); j < lj; j++) {
                for (i = 0, li = (mx + 1); i < li; i++) {
                    x = tileSize * i;
                    y = tileSize * j;

                    v = a;

                    if (i >= mx) {
                        if (j >= my) {
                            v =d;
                        } else {
                            v = b;
                        }

                    } else {
                        if (j >= my) {
                            v = b;
                        }
                    }

                    draw.drawLineString([[x, y, 0.5], [x+tileSize, y, 0.5],
                                         [x+tileSize, y+tileSize, 0.5], [x, y+tileSize, 0.5]], true, 1, colors[colorIndex], null, true, null, null, null);

                    draw.drawText(Math.round(x+5), Math.round(y + 5 + colorIndex * 15), 10, '' + v, colors[colorIndex], 0.5);
                }
            }

        }


        //clear hit-map
        for (i = 0, li = (mx+1) * (my+1); i < li; i++) {
            hitMap[i] = null;
        }

        for (i = 0, li = featureCacheSize; i < li; i++) {
            feature = featureCache[i];
            if (!feature) {
                continue;
            }

            pp = feature[5];

            if (pp[0] < 30 || pp[0] >= (screenLX-30) || pp[1] < 30 || pp[1] >= (screenLY-30)) {
                featureCache[i] = null;
                continue;
            }

            tx = pp[0] / tileSize;
            ty = pp[1] / tileSize;

            if (tx > mx) {
                if (ty > my) {
                    v = d;
                } else {
                    v = b;
                }
            } else if (ty > my) {
                v = c;
            } else {
                v = a;
            }

            if (v > 0) {
                index = Math.floor(tx) + Math.floor(ty) * (mx + 1);

                tileFeatures = hitMap[index];

                if (tileFeatures) {
                    hitMap[index].push(i);
                } else {
                    hitMap[index] = [i];
                    hitMapCount[index] = v;
                }
            }
        }

        for (i = 0, li = (mx+1) * (my+1); i < li; i++) {
            tileFeatures = hitMap[i];

            if (tileFeatures && tileFeatures.length) {
                count = hitMapCount[i];

                if (count > tileFeatures.length) {
                    count = tileFeatures.length;
                }

                sortFeatures(tileFeatures, top, count, renderer);

                for (j = 0; j < count; j++){
                    index = topFeatures[j]
                    feature = featureCache[index];
                    topFeatures[j] = null;
                    featureCache[index] = null;
                    job = feature[0];

                    //render job
                    if (!drawAllLabels && feature[6]) { //no-overlap
                        pp = feature[5];
                        o = feature[8];

                        //if (!
                            renderer.rmap.addRectangle(pp[0]+o[0], pp[1]+o[1], pp[0]+o[2], pp[1]+o[3], feature[7], feature[0].lastSubJob)
                        //) {}

                        if (job.type == VTS_JOB_LINE_LABEL) {
                            if (renderer.rmap.addLineLabel(job.lastSubJob, null /*depthParams*/)) {
                                //renderer.rmap.storeRemovedLineLabel(pp[0]+o[0], pp[1]+o[1], pp[0]+o[2], pp[1]+o[3], feature[7], feature[0].lastSubJob);
                            }
                        } else {
                            if (renderer.rmap.addRectangle(pp[0]+o[0], pp[1]+o[1], pp[0]+o[2], pp[1]+o[3], feature[7], job.lastSubJob, true, null /*depthParams*/)) {
                                renderer.rmap.storeRemovedRectangle(pp[0]+o[0], pp[1]+o[1], pp[0]+o[2], pp[1]+o[3], feature[7], feature[0].lastSubJob);
                            }
                        }

                    } else {
                        if (job.hysteresis) {
                            renderer.jobHBuffer[job.id] = job;
                        } else {
                            renderer.drawnJobs++;

                            if (job.type == VTS_JOB_LINE_LABEL) {
                                draw.drawGpuSubJobLineLabel(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                            } else {
                                draw.drawGpuSubJob(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                            }
                        }
                    }
                }

            }
        }

        a *= mx * my;
        b *= mx;
        c *= my;

        usedFeatures += a + b + c + d;
        featureCount -= a + b + c + d;
        tileSize *= 2;

        colorIndex++;

    } while(usedFeatures < featureCount2);

}


function sortFeatures(features, top, count, renderer) {
    let value, feature, index;
    let currentIndex = 0;
    let currentValue2 = top ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    let topFeaturesIndex = 0;
    let topFeaturesIndex2 = 0;

    //remove feature from cache
    const featureCache = renderer.gmap;
    const topFeatures = renderer.gmapTop;

    do {
        let currentValue = top ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
        topFeaturesIndex2 = topFeaturesIndex;

        for (let i = 0, li = features.length; i < li; i++) {
            index = features[i];
            feature = featureCache[index];
            value = feature[0].reduce[1];

            if (((top && value >= currentValue && value < currentValue2) || (value <= currentValue && value > currentValue2)) ) {
                if (currentValue != value) {
                    topFeaturesIndex = topFeaturesIndex2;
                }

                topFeatures[topFeaturesIndex] = index;
                topFeaturesIndex++;
                currentValue = value;
            }
        }

        currentValue2 = currentValue;
        currentIndex++;

    } while(currentIndex < count);

}

function storeFeatureToHitmap(id, feature, ix, iy, mx, my, hitMap, hcache, hcacheSize) {
    let x1 = ix - 1, y1 = iy - 1, x,
        x2 = ix + 1, y2 = iy + 1, index;//, blockFeatures;

    if (x1 < 0) x1 = 0;
    if (y1 < 0) y1 = 0;
    if (x2 > mx) x2 = mx;
    if (y2 > my) y2 = my;

    for (; y1 <= y2; y1++) {
        for (x = x1; x <= x2; x++) {
            index = (y1 * mx + x) * 2;
            //blockFeatures = hitMap[index];

            if (!hitMap[index]) {
                hitMap[index] = hcacheSize;
                hitMap[index+1] = hcacheSize+1;
                hcache[hcacheSize] = feature;
                hcache[hcacheSize+1] = 0;
                hcacheSize +=2;
            } else {
                hcache[hitMap[index+1]] = hcacheSize;
                hitMap[index+1] = hcacheSize+1;
                hcache[hcacheSize] = feature;
                hcache[hcacheSize+1] = 0;
                hcacheSize +=2;
            }
        }
    }

    return hcacheSize;
}


function processGMap4(gpu, gl, renderer, screenPixelSize, draw) {
    if (!renderer.config.mapFeaturesReduceParams) {
        return;
    }

    const ppi = 96 * (window.devicePixelRatio || 1);

    let maxRadius = renderer.config.mapFeaturesReduceParams[0] * ppi; //mapFeatureRadius
    const maxHitcount = renderer.config.mapFeaturesReduceParams[1]; //0.6614; //mapFeatureMaxOverlays

    const screenLX = renderer.curSize[0];
    const screenLY = renderer.curSize[1];
    //const top = renderer.config.mapFeaturesSortByTop;
    const drawAllLabels = renderer.drawAllLabels;

    let i, li;
    let feature, feature2, pp, pp2, o, job;

    //get top features
    const featureCache = renderer.gmap;
    const featureCacheSize = renderer.gmapIndex;

    const hcache = renderer.gmap2;
    const hmap = renderer.gmap3;
    let hcacheSize = 1;
    let hmapSize = renderer.gmap3Size;


    let hmin = 10000;
    let hmax = 0, h, r, ub, lb;

    const divByDist = (renderer.config.mapFeaturesReduceFactor >= 1);

    if (divByDist) { // imp / dists
        if (renderer.fmaxDist == Number.NEGATIVE_INFINITY || renderer.fminDist == Number.POSITIVE_INFINITY) {
            return;
        }

        ub = 1 - Math.log(renderer.fminDist) / Math.log(101);
        lb = -Math.log(renderer.fmaxDist) / Math.log(101);
    }

    //filter features and sort them by importance
    for (i = 0, li = featureCacheSize; i < li; i++) {
        feature = featureCache[i];
        if (!feature) {
            continue;
        }

        pp = feature[5];

        if (divByDist) {
            r = feature[0].reduce;
            h = Math.round(-5000 + ( ( Math.log(r[1]+1) - Math.log(r[4]) ) / Math.log(101) - lb ) / ( ub-lb ) * 10000) + 5000;
            r[5] = h; //for debug
        } else {
            h = Math.round(feature[0].reduce[1]);
        }

        if (h < 0) h = 0;
        if (h >= 10000) h = 9999;
        if (h < hmin) hmin = h;
        if (h > hmax) hmax = h;

        hmap[h][hmapSize[h]++] = feature;
    }

    const invMaxRadius = 1 / maxRadius;
    const mx = Math.floor(screenLX * invMaxRadius);
    const my = Math.floor(screenLY * invMaxRadius);
    const hitMap = renderer.gmapStore;
    //const hitMapCount = renderer.gmapHit;
    let index, ix, iy;

    //clear hit-map
    for (i = 0, li = (mx+1) * (my+1) * 2; i < li; i+=2) {
        hitMap[i] = 0;
    }

    let hitCacheSize = 0, j, lj, hitCount, dx, dy;

    maxRadius *= maxRadius;

    for (i = hmax, li = hmin; i >= 0; i--) {

        if (hmapSize[i] > 0) {
            const features = hmap[i];

            for (j = 0, lj = hmapSize[i]; j < lj; j++) {
                feature = features[j];
                job = feature[0];

                hitCount = 0;
                pp = feature[5];

                //check area
                ix = Math.floor(pp[0] * invMaxRadius);
                iy = Math.floor(pp[1] * invMaxRadius);
                index = ((iy * mx) + ix) * 2;
                //blockFeatures = hitMap[index];

                //check
                if (hitMap[index]) {
                    index = hitMap[index];
                    do {
                        feature2 = hcache[index];
                        pp2 = feature2[5];

                        dx = pp[0] - pp2[0];
                        dy = pp[1] - pp2[1];

                        if ((dx*dx+dy*dy) < maxRadius) {
                            hitCount++;
                            if (hitCount > maxHitcount) {
                                break;
                            }
                        }

                        index = hcache[index+1];
                    } while (index);
                }

                // check
                if (hitCount <= maxHitcount) {
                    index = hitCacheSize;

                    //render job
                    if (!drawAllLabels && feature[6]) { //no-overlap
                        pp = feature[5];
                        o = feature[8];

                        if (job.type == VTS_JOB_LINE_LABEL) {
                            if (renderer.rmap.addLineLabel(job.lastSubJob, null)) {
                                hitCacheSize++;
                            }
                        } else {
                            if (renderer.rmap.addRectangle(pp[0]+o[0], pp[1]+o[1], pp[0]+o[2], pp[1]+o[3], feature[7], job.lastSubJob, true, null)) {
                                hitCacheSize++;
                            }
                        }

                    } else {
                        if (job.hysteresis) {
                            renderer.jobHBuffer[job.id] = job;
                        } else {
                            renderer.drawnJobs++;

                            if (job.type == VTS_JOB_LINE_LABEL) {
                                draw.drawGpuSubJobLineLabel(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                            } else {
                                draw.drawGpuSubJob(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                            }
                        }

                        //hitCache[hitCacheSize] = feature;
                        hitCacheSize++;
                    }

                    //store to hitmap
                    if (index != hitCacheSize) {
                        hcacheSize = storeFeatureToHitmap(index, feature, ix, iy, mx, my, hitMap, hcache, hcacheSize);
                    }
                }

            }

            hmapSize[i] = 0;  //zero size
        }
    }
}

function processGMap5(gpu, gl, renderer, screenPixelSize, draw) {
    if (!renderer.config.mapFeaturesReduceParams) {
        return;
    }

    //const ppi = 96 * (window.devicePixelRatio || 1);
    //const screenLX = renderer.curSize[0];
    //const screenLY = renderer.curSize[1];
    //const top = renderer.config.mapFeaturesSortByTop;
    const drawAllLabels = renderer.drawAllLabels;
    let i, li;
    let feature, pp, o, job;

    //get top features
    const featureCache = renderer.gmap;
    const featureCacheSize = renderer.gmapIndex;

    //const hcache = renderer.gmap2;
    const hmap = renderer.gmap3;
    //let hcacheSize = 1;
    let hmapSize = renderer.gmap3Size;

    let hmin = 10000;
    let hmax = 0, h, r, ub, lb;

    const divByDist = (renderer.config.mapFeaturesReduceFactor >= 1);

    if (divByDist) { // imp / dists
        if (renderer.fmaxDist == Number.NEGATIVE_INFINITY || renderer.fminDist == Number.POSITIVE_INFINITY) {
            return;
        }

        ub = 1 - Math.log(renderer.fminDist) / Math.log(101);
        lb = -Math.log(renderer.fmaxDist) / Math.log(101);
    }

    //filter features and sort them by importance
    for (i = 0, li = featureCacheSize; i < li; i++) {
        feature = featureCache[i];
        if (!feature) {
            continue;
        }

        pp = feature[5];

        if (divByDist) {
            r = feature[0].reduce;
            h = Math.round(-5000 + ( ( Math.log(r[1]+1) - Math.log(r[4]) ) / Math.log(101) - lb ) / ( ub-lb ) * 10000) + 5000;
            r[5] = h; //for debug
        } else {
            h = Math.round(feature[0].reduce[1]);
        }

        if (h < 0) h = 0;
        if (h >= 10000) h = 9999;
        if (h < hmin) hmin = h;
        if (h > hmax) hmax = h;

        hmap[h][hmapSize[h]++] = feature;
    }

    let j, lj;

    for (i = hmax, li = hmin; i >= 0; i--) {

        if (hmapSize[i] > 0) {
            const features = hmap[i];

            for (j = 0, lj = hmapSize[i]; j < lj; j++) {
                feature = features[j];
                job = feature[0];
                pp = feature[5];

                // check

                //render job
                if (!drawAllLabels && feature[6]) { //no-overlap is always enabled
                    pp = feature[5];
                    o = feature[8];

                    if (job.type == VTS_JOB_LINE_LABEL) {
                        if (renderer.rmap.addLineLabel(job.lastSubJob, null)) {
                            //hitCache[hitCacheSize] = feature;
                        }
                    } else {
                        if (renderer.rmap.addRectangle(pp[0]+o[0], pp[1]+o[1], pp[0]+o[2], pp[1]+o[3], feature[7], job.lastSubJob, true, null)) {
                            //hitCache[hitCacheSize] = feature;
                        }
                    }

                } else {
                    if (job.hysteresis) {
                        renderer.jobHBuffer[job.id] = job;
                    } else {
                        renderer.drawnJobs++;

                        if (job.type == VTS_JOB_LINE_LABEL) {
                            draw.drawGpuSubJobLineLabel(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                        } else {
                            draw.drawGpuSubJob(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                        }
                    }
                }
            }

            hmapSize[i] = 0;  //zero size
        }
    }
}


// eslint-disable-next-line
function radixSortFeatures(renderer, input, inputSize, tmp, depthOnly) {
    const count = inputSize < (1 << 16) ? renderer.radixCountBuffer16 : renderer.radixCountBuffer32;
    const distanceFactor = renderer.config.mapFeaturesReduceFactor;
    const bunit32 = renderer.buffUint32, bfloat32 = renderer.buffFloat32;
    let item, val, i, r;

    //const sx = renderer.curSize[0], sy = renderer.curSize[1];
    //const cx = sx * 0.5, cy = sy * 0.5;
    //const invcx = 1.0 / (cx+0.0001), invcy = 1.0 / (cy+0.0001);
    //const invsy = 1.0 / (sy+0.0001);

    if (count.fill) {
        count.fill(0);
    } else { //IE fallback
        for (i = 0; i < (256*4); i++) {
            count[i] = 0;
        }
    }

    // count all bytes in one pass
    for (i = 0; i < inputSize; i++) {
        item = input[i];
        r = item[0].reduce;

        // optical center
        //pp = item[5];
        //yy = Math.pow(pp[1] * invsy, centerOffset) * sy;
        //dx = (cx - pp[0]) * invcx;
        //dy = (cy - yy) * invcx;

        val = r[3] - distanceFactor * Math.log(r[4]); // - screenDistanceFactor * Math.log(dx*dx + dy*dy + e100);
        r[6] = val;
        val += 10000;
        if (val < 0) val = 0;
        bfloat32[0] = val;
        val = bunit32[0];
        r[5] = val;
        count[val & 0xFF]++;
        count[((val >> 8) & 0xFF) + 256]++;
        count[((val >> 16) & 0xFF) + 512]++;
        count[((val >> 24) & 0xFF) + 768]++;
    }

    // create summed array
    for (let j = 0; j < 4; j++) {
        let t = 0, sum = 0, offset = j * 256;

        for (i = 0; i < 256; i++) {
            t = count[i + offset];
            count[i + offset] = sum;
            sum += t;
        }
    }

    for (i = 0; i < inputSize; i++) {
        item = input[i];
        val = item[0].reduce[5];
        tmp[count[val & 0xFF]++] = item;
    }
    for (i = 0; i < inputSize; i++) {
        item = tmp[i];
        val = item[0].reduce[5];
        input[count[((val >> 8) & 0xFF) + 256]++] = item;
    }
    for (i = 0; i < inputSize; i++) {
        item = input[i];
        val = item[0].reduce[5];
        tmp[count[((val >> 16) & 0xFF) + 512]++] = item;
    }
    for (i = 0; i < inputSize; i++) {
        item = tmp[i];
        val = item[0].reduce[5];
        input[count[((val >> 24) & 0xFF) + 768]++] = item;
    }

    if (i == -123) { //debug
        for (i = 0; i < inputSize; i++) {
            val = input[i][0].reduce[5];
            console.log('' + val +  ' ' + input[i][0].id);
        }
    }

    return input;
}

//used for scr-count7
function processGMap6(gpu, gl, renderer, screenPixelSize, draw) {
    if (!renderer.config.mapFeaturesReduceParams) {
        return;
    }

    const featuresPerSquareInch = renderer.config.mapFeaturesReduceParams[1]; //0.6614; //labelsPerSquareInch
    const ppi = 96 * (window.devicePixelRatio || 1);
    const screenLX = renderer.curSize[0];
    const screenLY = renderer.curSize[1];
    let maxFeatures = Math.ceil((screenLX/ppi)*(screenLY/ppi)*featuresPerSquareInch);
    //const top = renderer.config.mapFeaturesSortByTop;
    const drawAllLabels = renderer.drawAllLabels;
    let i, job;
    let feature, pp, o, featureCount = 0;

    const depthTest = (renderer.config.mapFeaturesReduceFactor2 != 0);
    const depthOffset = -renderer.config.mapFeaturesReduceFactor3;
    let depthParams = null;

    renderer.debugStr = '<br>featuresPerScr: ' + maxFeatures;

    //get top features
    const featureCache = renderer.gmap;
    const featureCacheSize = renderer.gmapIndex;
    const featureCache2 = renderer.gmap2;

    if (drawAllLabels) {
        maxFeatures = featureCacheSize;
    }

    //filter features and sort them by importance
    radixSortFeatures(renderer, featureCache, featureCacheSize, featureCache2);

    for (i = featureCacheSize - 1; i >= 0; i--) {
        feature = featureCache[i];
        job = feature[0];

        // check

        //render job
        if (!drawAllLabels && feature[6]) { //no-overlap is always enabled
            pp = feature[5];
            o = feature[8];

            depthParams = depthTest ? [pp[0],pp[1]+feature[1],job.reduce,depthOffset] : null;

            if (job.type == VTS_JOB_LINE_LABEL) {
                if (renderer.rmap.addLineLabel(job.lastSubJob, depthParams)) {
                    featureCount++;
                }
            } else {
                if (renderer.rmap.addRectangle(pp[0]+o[0], pp[1]+o[1], pp[0]+o[2], pp[1]+o[3], feature[7], job.lastSubJob, true, depthParams)) {
                    featureCount++;
                }
            }

            if (featureCount >= maxFeatures) {
                return;
            }

        } else {
            if (job.hysteresis) {
                renderer.jobHBuffer[job.id] = job;
            } else {
                renderer.drawnJobs++;

                if (job.type == VTS_JOB_LINE_LABEL) {
                    draw.drawGpuSubJobLineLabel(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                } else {
                    draw.drawGpuSubJob(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                }
            }
        }
    }

}


function radixDepthSortFeatures(renderer, input, inputSize, tmp) {
    const count = inputSize < (1 << 16) ? renderer.radixCountBuffer16 : renderer.radixCountBuffer32;
    //const distanceFactor = renderer.config.mapFeaturesReduceFactor;
    const bunit32 = renderer.buffUint32, bfloat32 = renderer.buffFloat32;
    let item, val, i;
    //const screenDistanceFactor = renderer.config.mapFeaturesReduceFactor2 * 0.5, e100 = 1.0/Math.exp(100);
    //const centerOffset = renderer.config.mapFeaturesReduceFactor3;

    //const depthTest = true;

    if (count.fill) {
        count.fill(0);
    } else { //IE fallback
        for (i = 0; i < (256*4); i++) {
            count[i] = 0;
        }
    }

    // count all bytes in one pass
    for (i = 0; i < inputSize; i++) {
        item = input[i];
        val = 1 - item.lastSubJob[5][2];
        bfloat32[0] = val;
        val = bunit32[0];
        item.depth = val;
        count[val & 0xFF]++;
        count[((val >> 8) & 0xFF) + 256]++;
        count[((val >> 16) & 0xFF) + 512]++;
        count[((val >> 24) & 0xFF) + 768]++;
    }

    // create summed array
    for (let j = 0; j < 4; j++) {
        let t = 0, sum = 0, offset = j * 256;

        for (i = 0; i < 256; i++) {
            t = count[i + offset];
            count[i + offset] = sum;
            sum += t;
        }
    }

    for (i = 0; i < inputSize; i++) {
        item = input[i];
        val = item.depth;
        tmp[count[val & 0xFF]++] = item;
    }
    for (i = 0; i < inputSize; i++) {
        item = tmp[i];
        val = item.depth;
        input[count[((val >> 8) & 0xFF) + 256]++] = item;
    }
    for (i = 0; i < inputSize; i++) {
        item = input[i];
        val = item.depth;
        tmp[count[((val >> 16) & 0xFF) + 512]++] = item;
    }
    for (i = 0; i < inputSize; i++) {
        item = tmp[i];
        val = item.depth;
        input[count[((val >> 24) & 0xFF) + 768]++] = item;
    }

    /*if (i == -123) { //debug
        for (i = 0; i < inputSize; i++) {
            item = input[i];
            val = item.depth;
            console.log('' + val +  ' ' + item.lastSubJob[0].id);
        }
    }*/

    return input;
}


function fillVMapHoles(vmap, mx, my) {
    let holesCount = 0, v;
    let x0, y0, x1, y1, x2, y2;
    let maxX = mx - 1;
    let maxY = my - 1;

    for (let j = 0, lj = my; j < lj; j++) {
        for (let i = 0, li = mx; i < li; i++) {

            v = vmap[j*mx+i];

            if (v === null) {

                //find
                x0 = i - 1;
                y0 = j - 1;

                x1 = i;
                y1 = j;

                x2 = i + 1;
                y2 = j + 1;

                if (x0 < 0) x0 = 0;
                if (y0 < 0) y0 = 0;

                if (x2 > maxX) x2 = maxX;
                if (y2 > maxY) y2 = maxY;

                const vv = [vmap[y0*mx+x0],
                          vmap[y0*mx+x1],
                          vmap[y0*mx+x2],
                          vmap[y1*mx+x0],
                          vmap[y1*mx+x2],
                          vmap[y2*mx+x0],
                          vmap[y2*mx+x1],
                          vmap[y2*mx+x2]];

                let vcount = 0;
                let vsum = 0;

                for (let k= 0; k < 8; k++) {
                    if (vv[k] !== null) {
                        vcount++;
                        vsum += vv[k];
                    }
                }

                if (vcount != 0) {
                    vmap[j*mx+i] = vsum / vcount;
                } else {
                    holesCount++;
                }
            }
        }
    }

    if (holesCount != 0 && holesCount != (mx * my)) {
        fillVMapHoles(vmap, mx, my);
    }
}


function getVMapValue(vmap, x, y, mx, my) {
    x -= 0.5;
    y -= 0.5;

    const maxX = mx - 1;
    const maxY = my - 1;

    if (x < 0) { x = 0; }
    if (y < 0) { y = 0; }
    if (x > maxX) { x = maxX; }
    if (y > maxY) { y = maxY; }

    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const index = iy * mx;
    const index2 = (iy == maxY) ? index : index + mx;
    const ix2 = (ix == maxX) ? ix : ix + 1;
    const v00 = vmap[index + ix];
    const v01 = vmap[index + ix2];
    const v10 = vmap[index2 + ix];
    const v11 = vmap[index2 + ix2];
    const w0 = (v00 + (v01 - v00)*fx);
    const w1 = (v10 + (v11 - v10)*fx);

    return (w0 + (w1 - w0)*fy);
}


function radixDeltaSortFeatures(renderer, input, inputSize, tmp) {
    const count = inputSize < (1 << 16) ? renderer.radixCountBuffer16 : renderer.radixCountBuffer32;
    const bunit32 = renderer.buffUint32, bfloat32 = renderer.buffFloat32;
    let item, val, i;

    if (count.fill) {
        count.fill(0);
    } else { //IE fallback
        for (i = 0; i < (256*4); i++) {
            count[i] = 0;
        }
    }

    // count all bytes in one pass
    for (i = 0; i < inputSize; i++) {
        item = input[i];
        //val = 1 - item.lastSubJob[5][2];
        bfloat32[0] = item[0].delta;
        val = bunit32[0];
        item[0].delta = val;
        count[val & 0xFF]++;
        count[((val >> 8) & 0xFF) + 256]++;
        count[((val >> 16) & 0xFF) + 512]++;
        count[((val >> 24) & 0xFF) + 768]++;
    }

    // create summed array
    for (let j = 0; j < 4; j++) {
        let t = 0, sum = 0, offset = j * 256;

        for (i = 0; i < 256; i++) {
            t = count[i + offset];
            count[i + offset] = sum;
            sum += t;
        }
    }

    for (i = 0; i < inputSize; i++) {
        item = input[i];
        val = item[0].delta;
        tmp[count[val & 0xFF]++] = item;
    }
    for (i = 0; i < inputSize; i++) {
        item = tmp[i];
        val = item[0].delta;
        input[count[((val >> 8) & 0xFF) + 256]++] = item;
    }
    for (i = 0; i < inputSize; i++) {
        item = input[i];
        val = item[0].delta;
        tmp[count[((val >> 16) & 0xFF) + 512]++] = item;
    }
    for (i = 0; i < inputSize; i++) {
        item = tmp[i];
        val = item[0].delta;
        input[count[((val >> 24) & 0xFF) + 768]++] = item;
    }

    /*if (i == -123) { //debug
        for (i = 0; i < inputSize; i++) {
            item = input[i];
            val = item.depth;
            console.log('' + val +  ' ' + item.lastSubJob[0].id);
        }
    }*/

    return input;
}


//used for scr-count8
function processGMap7(gpu, gl, renderer, screenPixelSize, draw) {
    if (!renderer.config.mapFeaturesReduceParams) {
        return;
    }

    const tileCount = renderer.config.mapFeaturesReduceParams[5];
    const featuresPerSquareInch = renderer.config.mapFeaturesReduceParams[1];
    const ppi = 96 * (window.devicePixelRatio || 1);
    const screenLX = renderer.curSize[0];
    const screenLY = renderer.curSize[1];

    let maxFeatures = Math.ceil((screenLX/ppi)*(screenLY/ppi)*featuresPerSquareInch);
    const featuresPerTile = maxFeatures / (tileCount * tileCount);
    const featuresPerTileInt = Math.floor(featuresPerTile);
    const featuresPerTileFract = featuresPerTile - featuresPerTileInt;
    const tileSizeX = screenLX / tileCount;
    const tileSizeY = screenLY / tileCount;

    renderer.debugStr = '<br>featuresPerScr: ' + maxFeatures + '<br>featuresPerTile: ' + featuresPerTile.toFixed(2);

    let i, li, job, feature, featureCount = 0, mx, my;
    //const feature, feature2, pp, pp2, o, featureCount = 0;
    //const drawAllLabels = renderer.drawAllLabels;

    const depthTest = (renderer.config.mapFeaturesReduceFactor2 != 0);
    const depthOffset = -renderer.config.mapFeaturesReduceFactor3;
    let depthParams = null;

    //get top features
    const featureCache = renderer.gmap;
    const featureCacheSize = renderer.gmapIndex;
    const featureCache2 = renderer.gmap2;
    let featureCacheSize2 = 0;
    const vmap = renderer.gmap4;
    const drawAllLabels = renderer.drawAllLabels;

    if (drawAllLabels) {
        maxFeatures = featureCacheSize;
    }

    if (featureCacheSize > 0) {

        //filter features and sort them by importance
        radixSortFeatures(renderer, featureCache, featureCacheSize, featureCache2);

        if (drawAllLabels) {

            for (i = featureCacheSize - 1; i >= 0; i--) {
                feature = featureCache[i];
                job = feature[0];

                if (feature[0].hysteresis) {
                    renderer.jobHBuffer[feature[0].id] = job;
                } else {
                    renderer.drawnJobs++;
                    job = feature[0];
                    if (job.type == VTS_JOB_LINE_LABEL) {
                        draw.drawGpuSubJobLineLabel(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                    } else {
                        draw.drawGpuSubJob(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                    }
                }
            }

        } else {

            //distribute top features
            const hitMap = renderer.gmapHit;
            //const hitMapCount = renderer.gmapHit;

            let tileFeatures, count;
            let ix,iy,pp,tx,ty,mx,my,v,v2,index,o;

            ix = screenLX / tileSizeX;
            iy = screenLY / tileSizeY;
            mx = Math.round(ix);
            my = Math.round(iy);

            //clear hit-map
            for (i = 0, li = mx * my; i < li; i++) {
                hitMap[i] = null;
                vmap[i] = null;
            }

            for (i = featureCacheSize - 1; i >= 0; i--) {

                feature = featureCache[i];
                if (!feature) {
                    continue;
                }

                pp = feature[5];

                if (pp[0] < 30 || pp[0] >= (screenLX-30) || pp[1] < 30 || pp[1] >= (screenLY-30)) {
                    featureCache[i] = null;
                    continue;
                }

                tx = pp[0] / tileSizeX;
                ty = pp[1] / tileSizeY;

                index = Math.floor(tx) + Math.floor(ty) * (mx);

                tileFeatures = hitMap[index];

                if (tileFeatures) {
                    hitMap[index].push(i);
                } else {
                    hitMap[index] = [i];
                    //hitMapCount[index] = v;
                }
            }


            for (i = 0, li = (mx) * (my); i < li; i++) {
                tileFeatures = hitMap[i];

                if (tileFeatures && tileFeatures.length) {
                    count = tileFeatures.length;

                    if (count == 0) {
                        vmap[i] = null;
                    } else {
                        if (count > featuresPerTileInt) {
                            count = featuresPerTileInt;

                            index = tileFeatures[count];
                            feature = featureCache[index];
                            v = feature[0].reduce[6];

                            if (tileFeatures.length > count+1) {
                                index = tileFeatures[count+1];
                                feature = featureCache[index];
                                v2 = feature[0].reduce[6];
                                v = v + (v2 - v) * featuresPerTileFract;
                            }
                        } else {
                            index = tileFeatures[count - 1];
                            feature = featureCache[index];
                            v = feature[0].reduce[6];
                        }

                        vmap[i] = v;
                    }
                }
            }

            fillVMapHoles(vmap, mx, my);

            for (i = featureCacheSize - 1; i >= 0; i--) {
                feature = featureCache[i];
                if (!feature) {
                    continue;
                }

                job = feature[0];
                v = job.reduce[6];
                pp = feature[5];

                const vmax = getVMapValue(vmap, pp[0] / tileSizeX, pp[1] / tileSizeY, mx, my);

                if (v >= vmax) {

                    //render job
                    if (/*!drawAllLabels &&*/ feature[6]) { //no-overlap is always enabled
                        pp = feature[5];
                        o = feature[8];

                        depthParams = depthTest ? [pp[0],pp[1]+feature[1],job.reduce,depthOffset] : null;

                        if (job.type == VTS_JOB_LINE_LABEL) {
                            if (renderer.rmap.addLineLabel(job.lastSubJob, depthParams)) {
                                featureCount++;
                            }
                        } else {
                            if (renderer.rmap.addRectangle(pp[0]+o[0], pp[1]+o[1], pp[0]+o[2], pp[1]+o[3], feature[7], job.lastSubJob, true, depthParams)) {
                                featureCount++;
                            }
                        }


                    } else {
                        if (job.hysteresis) {
                            renderer.jobHBuffer[job.id] = job;
                        } else {
                            renderer.drawnJobs++;

                            if (job.type == VTS_JOB_LINE_LABEL) {
                                draw.drawGpuSubJobLineLabel(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                            } else {
                                draw.drawGpuSubJob(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                            }
                        }
                    }
                } else {
                    //store v delta
                    feature[0].delta = Math.abs(vmax - v);
                    featureCache2[featureCacheSize2] = feature;
                    featureCacheSize2++;
                }
            }

            if (featureCount < maxFeatures && featureCacheSize2 > 0) {
                //sort deltas
                radixDeltaSortFeatures(renderer, featureCache2, featureCacheSize2, featureCache);

                for (i = featureCacheSize2 - 1; i >= 0; i--) {
                    feature = featureCache2[i];
                    job = feature[0];

                    //render job
                    if (/*!drawAllLabels &&*/ feature[6]) { //no-overlap is always enabled
                        pp = feature[5];
                        o = feature[8];

                        depthParams = depthTest ? [pp[0],pp[1]+feature[1],job.reduce,depthOffset] : null;

                        if (job.type == VTS_JOB_LINE_LABEL) {
                            if (renderer.rmap.addLineLabel(job.lastSubJob, depthParams)) {
                                featureCount++;
                            }
                        } else {
                            if (renderer.rmap.addRectangle(pp[0]+o[0], pp[1]+o[1], pp[0]+o[2], pp[1]+o[3], feature[7], job.lastSubJob, true, depthParams)) {
                                featureCount++;
                            }
                        }

                    } else {
                        if (job.hysteresis) {
                            renderer.jobHBuffer[job.id] = job;
                        } else {
                            renderer.drawnJobs++;

                            if (job.type == VTS_JOB_LINE_LABEL) {
                                draw.drawGpuSubJobLineLabel(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                            } else {
                                draw.drawGpuSubJob(gpu, gl, renderer, screenPixelSize, job.lastSubJob, null);
                            }
                        }
                    }

                    if (featureCount >= maxFeatures) {
                        break;
                    }
                }
            }
        }
    }


    if (renderer.drawGridCells) {
        gpu.setState(renderer.lineLabelState);

        let x = 0, y = 0, j, lj;

        for (j = 0, lj = my; j < lj; j++) {
            for (i = 0, li = mx; i < li; i++) {
                x = tileSizeX * i;
                y = tileSizeY * j;

                const v = vmap[j*mx+i];

                draw.drawLineString([[x, y, 0.5], [x+tileSizeX, y, 0.5],
                                     [x+tileSizeX, y+tileSizeY, 0.5], [x, y+tileSizeY, 0.5]], true, 1, [0,0,255,255], null, true, null, null, null);

                if (v) {
                    draw.drawText(Math.round(x+5), Math.round(y + 5), 11, '' + v.toFixed(2), [255,255,255,255], 0.5);
                }
            }
        }
    }

}


export {processGMap, processGMap4, processGMap5, processGMap6, processGMap7, radixDepthSortFeatures};
