
import {vec3 as vec3_} from '../utils/matrix';
import MapSurfaceTile_ from './surface-tile';

//get rid of compiler mess
const vec3 = vec3_;
const MapSurfaceTile = MapSurfaceTile_;


const MapSurfaceTree = function(map, freeLayer, freeLayerSurface) {
    this.map = map;
    this.camera = map.camera;
    this.rootId = [0,0,0];
    this.freeLayer = freeLayer;
    this.freeLayerSurface = freeLayerSurface;
    this.metaBinaryOrder = this.map.referenceFrame.params.metaBinaryOrder;
    //this.initialized = false;
    //this.geocent = !this.map.getNavigationSrs().isProjected();

    this.surfaceTree = new MapSurfaceTile(this.map, null, this.rootId);

    //if (freeLayer !== true) {
        //this.heightTracer = new MapMetanodeTracer(this, null, this.traceTileHeight.bind(this), this.traceHeightChild.bind(this));
        //this.heightTracerNodeOnly = new MapMetanodeTracer(this, null, this.traceTileHeightNodeOnly.bind(this), this.traceHeightChild.bind(this));
    //}

    this.surfaceSequence = [];
    this.surfaceOnlySequence = [];

    this.config = this.map.config;
    this.cameraPos = [0,0,0];
    this.worldPos = [0,0,0];
    this.ndcToScreenPixel = 1.0;
    this.counter = 0;
};


MapSurfaceTree.prototype.kill = function() {
    this.surfaceTree = null;
    this.metastorageTree = null;
    this.surfaceTracer = null;
    this.heightTracer = null;
};


/*MapSurfaceTree.prototype.init = function() {
    const url = this.map.url.makeUrl(surface.metaUrl, {lod:result[0], ix:result[1], iy:result[2] });  //result???
    map.loader.load(url, metatile.load.bind(metatile, url));

    this.metatileTree.load();
    this.surfaceTree.metatile = 1;

    this.initialized = true;
};*/


MapSurfaceTree.prototype.findSurfaceTile = function(id) {
    let tile = this.surfaceTree;

//    for (const lod = 1; lod <= id[0]; lod++) {
//        const mask = 1 << (lod-1);
//        const index = 0;

    for (let lod = id[0]; lod > 0; lod--) {
        const mask = 1 << (lod-1);
        let index = 0;

        if ((id[1] & mask) != 0) {
            index += 1;
        }

        if ((id[2] & mask) != 0) {
            index += 2;
        }

        tile = tile.children[index];

        if (!tile) {
            return null;
        }
    }

    return tile;
};


MapSurfaceTree.prototype.findNavTile = function(id) {
    let tile = this.surfaceTree;

    if (id[0] == 0) {
        if (tile.metanode && tile.metanode.hasNavtile()) {
            return tile;
        } else {
            return null;
        }
    }

    let navtile = null;

//    for (const lod = 1; lod <= id[0]; lod++) {
//        const mask = 1 << (id[0] - lod);
//        const index = 0;
    for (let lod = id[0]; lod > 0; lod--) {
        const mask = 1 << (lod-1);
        let index = 0;

        if ((id[1] & mask) != 0) {
            index += 1;
        }

        if ((id[2] & mask) != 0) {
            index += 2;
        }

        tile = tile.children[index];

        if (!tile) {
            return navtile;
        } else {
            if (tile.metanode && tile.metanode.hasNavtile()) {
                navtile = tile;
            }
        }
    }

    return navtile;
};


MapSurfaceTree.prototype.draw = function(storeTilesOnly) {
    this.cameraPos = [0,0,0];
    this.worldPos = [0,0,0];

    const map = this.map;
    const draw = map.draw;
    this.ndcToScreenPixel = draw.ndcToScreenPixel;

    const srs = map.getPhysicalSrs();

    //const divisionNode = this.divisionNode;
    const periodicity = srs.periodicity;

    //if (this.map.config.mapBasicTileSequence) {
        //this.surfaceTracer = this.surfaceTracerBasic;
    //}

    if (this.freeLayerSurface && this.freeLayerSurface.geodata && draw.drawChannel != 0) {
        return;
    }

    if (periodicity != null) {
        this.drawSurface([0,0,0]);

        if (periodicity.type == 'X') {
            this.drawSurface([periodicity.period,0,0], storeTilesOnly);
            this.drawSurface([-periodicity.period,0,0], storeTilesOnly);
        }

    } else {
        let mode;

        if (this.freeLayerSurface && this.freeLayerSurface.geodata) {
            mode = map.config.mapGeodataLoadMode;
        } else {
            mode = map.config.mapLoadMode;
        }

        switch(mode) {
        case 'topdown':

            if (map.config.mapSplitMeshes) {
                this.drawSurfaceWithSpliting([0,0,0], storeTilesOnly);
            } else {
                this.drawSurface([0,0,0], storeTilesOnly);
            }

            break;

        case 'downtop': this.drawSurfaceDownTop([0,0,0], storeTilesOnly); break;
        case 'fit':     this.drawSurfaceFit([0,0,0], storeTilesOnly); break;
        case 'fitonly': this.drawSurfaceFitOnly([0,0,0], storeTilesOnly); break;
        }

    }
};


MapSurfaceTree.prototype.updateNodeHeightExtents = function(tile, node) {

    if (!node.heightReady && node.metatile.useVersion < 4) {
        let parent = tile.parent;

        //if (node.hasNavtile()) {
          //  node = node;
        //}

        while (parent) {
            const parentNode = parent.metanode;
            if (parentNode.hasNavtile()) {

                //if (node.hasNavtile()) {
                  //  node = node;
                //}

                node.minHeight = parentNode.minHeight;
                node.maxHeight = parentNode.maxHeight;
                node.minZ = parentNode.minZ;
                node.maxZ = parentNode.maxZ;
                node.minZ2 = parentNode.minZ2;
                node.maxZ2 = parentNode.maxZ2;
                node.generateCullingHelpers();
                break;
            }

            parent = parent.parent;
        }

        node.heightReady = true;
    }
};


MapSurfaceTree.prototype.logTileInfo = function(tile, node, cameraPos) {
    if (!tile || !node) {
        return;
    }

    const visible = tile.bboxVisible(tile.id, node.bbox, cameraPos, node);
    tile.updateTexelSize();

    // eslint-disable-next-line
    console.log('tile: ' + JSON.stringify(tile.id) + ' visible: ' + visible + ' texelsize: ' +  tile.texelSize + ' center: '  + JSON.stringify(node.diskPos) + ' vec: ' + node.diskNormal + 'ang: ' + node.diskAngle + ' dist: ' + node.diskDistance);
};


//loadmode = topdown
MapSurfaceTree.prototype.drawSurface = function(shift, storeTilesOnly) {
    this.counter++;

    let tile = this.surfaceTree;

    if (!tile.isMetanodeReady(this, 0)) {
        return;
    }

    let node = tile.metanode;
    const map = this.map;
    const cameraPos = map.camera.position;

    if (!tile.bboxVisible(tile.id, node.bbox, cameraPos, node)) {
        return;
    }

    tile.updateTexelSize();

    const typeFactor = this.freeLayerSurface ? 1 : 1;

    const draw = map.draw;
    const drawTiles = draw.drawTiles;
    const drawBuffer = draw.drawBuffer;
    const replay = draw.replay;
    const storeNodes = replay.storeNodes || replay.storeFreeNodes;
    const storeNodesBuffer = replay.nodeBuffer;
    let drawBufferIndex = 0;
    let processBuffer = draw.processBuffer;
    let processBufferIndex = 0;
    let newProcessBuffer = draw.processBuffer2;
    let newProcessBufferIndex = 0;
    let gpuNeeded = 0;
    let gpuNeededForRender = 0;
    let size = 0;

    processBuffer[0] = tile;
    processBufferIndex = 1;

    let texelSizeFit = draw.texelSizeFit;
    let best2 = 0;

    draw.drawCounter++;

    let pocessedNodes = 1;
    let pocessedMetatiles = 1;
    let usedNodes = 1;
    let drawCounter = draw.drawCounter, i, j, lj;

    do {
        let best = 0;
        newProcessBufferIndex = 0;

        for (i = processBufferIndex - 1; i >= 0; i--) {
            tile = processBuffer[i];
            node = tile.metanode;

            if (node) {
                pocessedNodes++;
                if (node.metatile.drawCounter != drawCounter) {
                    node.metatile.drawCounter = drawCounter;
                    pocessedMetatiles++;
                }
            }

            //if (this.map.drawIndices) {
              //  this.logTileInfo(tile, node, cameraPos);
            //}

            if (tile.bboxVisible(tile.id, node.bbox, cameraPos, node)) {

                usedNodes++;

                if (tile.texelSize != Number.POSITIVE_INFINITY){
                    if (tile.texelSize > best) {
                        best = tile.texelSize;
                    }
                }

                if (storeNodes) { //used only for inspector
                    storeNodesBuffer.push(tile);
                }

                if (/*node.hasGeometry() && */tile.texelSize <= texelSizeFit /*|| gpuNeeded > gpuMax*/) {
                    size = draw.getDrawCommandsGpuSize(tile.drawCommands[draw.drawChannel] || tile.lastRenderState.drawCommands[draw.drawChannel]);

                    gpuNeeded += size;
                    gpuNeededForRender += size;

                    tile.drawCounter = draw.drawCounter;
                    drawBuffer[drawBufferIndex] = tile;
                    drawBufferIndex++;

                } else { //go deeper
                    size = draw.getDrawCommandsGpuSize(tile.drawCommands[draw.drawChannel] || tile.lastRenderState.drawCommands[draw.drawChannel]);
                    gpuNeeded += size;

                    let childrenCount = 0;
                    let readyCount = 0;
                    let childrenBuffer = [];

                    for (j = 0; j < 4; j++) {
                        const child = tile.children[j];
                        if (child) {
                            childrenCount++;

                            if (child.isMetanodeReady(this, child.id[0])) { //lod is used as priority

                                this.updateNodeHeightExtents(child, child.metanode);
                                child.updateTexelSize();

                                const priority = child.id[0] * typeFactor * child.distance;

                                if (!tile.surface || !child.metanode.hasGeometry()) {

                                    readyCount++;
                                    //child.updateTexelSize();
                                    childrenBuffer.push(child);

                                } else {

                                    //are draw buffers ready? preventRender=true, preventLoad=false, doNotCheckGpu=true
                                    if (drawTiles.drawSurfaceTile(child, child.metanode, cameraPos, child.texelSize, priority, true, false, true)) {

                                        readyCount++;
                                        //child.updateTexelSize();
                                        childrenBuffer.push(child);
                                    }

                                }
                            }
                        }
                    }

                    if (/*!(gpuNeeded > gpuMax) &&*/ childrenCount > 0 && childrenCount == readyCount) {
                        //sort children by distance

                        let sorted;

                        do {
                            sorted = true;

                            for (j = 0, lj = childrenBuffer.length - 1; j < lj; j++) {
                                if (childrenBuffer[j].distance > childrenBuffer[j+1].distance) {
                                    const t = childrenBuffer[j];
                                    childrenBuffer[j] = childrenBuffer[j+1];
                                    childrenBuffer[j+1] = t;
                                    sorted = false;
                                }
                            }

                        } while(!sorted);


                        //add children to new process buffer
                        for (j = 0, lj = childrenBuffer.length; j < lj; j++) {

                            /*const n = childrenBuffer[j].metanode.divisionNode;
                            if ((n.id[0] == 1 && n.id[1] == 1 && n.id[2] == 0)) {*/
                            newProcessBuffer[newProcessBufferIndex] = childrenBuffer[j];
                            newProcessBufferIndex++;
                            /*}*/

                        }
                    } else {
                        // eslint-disable-next-line
                        gpuNeededForRender += size;

                        tile.drawCounter = draw.drawCounter;
                        drawBuffer[drawBufferIndex] = tile;
                        drawBufferIndex++;
                    }

                }
            }
        }

        const tmp = processBuffer;
        processBuffer = newProcessBuffer;
        newProcessBuffer = tmp;
        processBufferIndex = newProcessBufferIndex;

    } while(processBufferIndex > 0);

    if (storeTilesOnly) {
        this.storeDrawBufferGeometry(drawBufferIndex);
        return;
    }

    if (best2 > draw.bestMeshTexelSize) {
        draw.bestMeshTexelSize = best2;
    }

    const stats = map.stats;

    stats.usedNodes = usedNodes;
    stats.processedNodes = pocessedNodes;
    stats.processedMetatiles = pocessedMetatiles;
    stats.gpuNeeded = gpuNeeded;

    //console.log("texel: "+ this.map.bestMeshTexelSize);
    //console.log("more: "+ more + "more2: " + more2);

    this.processDrawBuffer(draw, drawTiles, cameraPos, map, stats, false, false, replay, drawBuffer, drawBufferIndex, true);
};


//loadmode = topdown + split
MapSurfaceTree.prototype.drawSurfaceWithSpliting = function(shift, storeTilesOnly) {
    this.counter++;

    let tile = this.surfaceTree;

    if (!tile.isMetanodeReady(this, 0)) {
        return;
    }

    const map = this.map;
    const cameraPos = map.camera.position;
    let node = tile.metanode;

    if (!tile.bboxVisible(tile.id, node.bbox, cameraPos, node)) {
        return;
    }

    tile.updateTexelSize();

    const typeFactor = this.freeLayerSurface ? 1 : 1;

    const draw = map.draw;
    const drawTiles = draw.drawTiles;
    const drawBuffer = draw.drawBuffer;
    const replay = draw.replay;
    const storeNodes = replay.storeNodes || replay.storeFreeNodes;
    const storeNodesBuffer = replay.nodeBuffer;

    let drawBufferIndex = 0;
    let processBuffer = draw.processBuffer;
    let processBufferIndex = 0;
    let newProcessBuffer = draw.processBuffer2;
    let newProcessBufferIndex = 0;
    let gpuNeeded = 0;
    let gpuNeededForRender = 0;
    let size = 0;

    processBuffer[0] = tile;
    processBufferIndex = 1;

    let texelSizeFit = draw.texelSizeFit;

    let best2 = 0;

    draw.drawCounter++;

    let pocessedNodes = 1;
    let pocessedMetatiles = 1;
    let usedNodes = 1;
    let drawCounter = draw.drawCounter, i, j, lj;

    do {
        let best = 0;
        newProcessBufferIndex = 0;

        for (i = processBufferIndex - 1; i >= 0; i--) {
            tile = processBuffer[i];
            node = tile.metanode;

            if (node) {
                pocessedNodes++;
                if (node.metatile.drawCounter != drawCounter) {
                    node.metatile.drawCounter = drawCounter;
                    pocessedMetatiles++;
                }
            }

            //if (this.map.drawIndices) {
              //  this.logTileInfo(tile, node, cameraPos);
            //}

            tile.splitMask = null;
            //tile.splitMask = [0,0,0,1];

            if (tile.visibleCounter == drawCounter || tile.bboxVisible(tile.id, node.bbox, cameraPos, node)) {

                usedNodes++;

                if (tile.texelSize != Number.POSITIVE_INFINITY){
                    if (tile.texelSize > best) {
                        best = tile.texelSize;
                    }
                }

                if (storeNodes) { //used only for inspector
                    storeNodesBuffer.push(tile);
                }

                if (/*node.hasGeometry() && */tile.texelSize <= texelSizeFit /*|| gpuNeeded > gpuMax*/) {

                    if (tile.skipRenderCounter != drawCounter) {

                        size = draw.getDrawCommandsGpuSize(tile.drawCommands[draw.drawChannel] || tile.lastRenderState.drawCommands[draw.drawChannel]);

                        gpuNeeded += size;
                        gpuNeededForRender += size;

                        //if (tile.parent && tile.parent.children[3] == tile) {
                            tile.drawCounter = drawCounter;
                            drawBuffer[drawBufferIndex] = tile;
                            drawBufferIndex++;
                        //}
                    }

                } else { //go deeper
                    size = draw.getDrawCommandsGpuSize(tile.drawCommands[draw.drawChannel] || tile.lastRenderState.drawCommands[draw.drawChannel]);
                    gpuNeeded += size;

                    let childrenCount = 0;
                    let childrenBuffer = [];
                    let mask = [1,1,1,1];
                    let useMask = false;

                    for (j = 0; j < 4; j++) {
                        const child = tile.children[j];
                        if (child) {
                            childrenCount++;
                            child.skipRenderCounter = tile.skipRenderCounter;

                            if (child.isMetanodeReady(this, child.id[0])) { //lod is used as priority

                                this.updateNodeHeightExtents(child, child.metanode);
                                child.updateTexelSize();

                                if (child.bboxVisible(child.id, child.metanode.bbox, cameraPos, child.metanode)) {
                                    child.visibleCounter = draw.drawCounter;
                                } else {
                                    continue;
                                }

                                const priority = child.id[0] * typeFactor * child.distance;

                                if (!tile.surface || !child.metanode.hasGeometry()) {
                                    childrenBuffer.push(child);
                                } else {
                                    //are draw buffers ready? preventRender=true, preventLoad=false, doNotCheckGpu=true
                                    if (drawTiles.drawSurfaceTile(child, child.metanode, cameraPos, child.texelSize, priority, true, false, true)) {
                                        childrenBuffer.push(child);
                                        mask[j] = 0;
                                    } else {
                                        childrenBuffer.push(child);
                                        child.skipRenderCounter = drawCounter;
                                        useMask = true;
                                    }
                                }

                            } else {
                                //mask[j] = 0;
                                useMask = true;
                            }
                        }
                    }

                    if (childrenBuffer.length > 0) {
                        //sort children by distance

                        let sorted = true;

                        do {
                            sorted = true;

                            for (j = 0, lj = childrenBuffer.length - 1; j < lj; j++) {
                                if (childrenBuffer[j].distance > childrenBuffer[j+1].distance) {
                                    const t = childrenBuffer[j];
                                    childrenBuffer[j] = childrenBuffer[j+1];
                                    childrenBuffer[j+1] = t;
                                    sorted = false;
                                }
                            }

                        } while(!sorted);


                        //add children to new process buffer
                        for (j = 0, lj = childrenBuffer.length; j < lj; j++) {
                            newProcessBuffer[newProcessBufferIndex] = childrenBuffer[j];
                            newProcessBufferIndex++;
                        }
                    }

                    if (childrenCount == 0 || useMask) {

                        //if (tile.parent && tile.parent.children[3] == tile) {

                        if (tile.skipRenderCounter != drawCounter) {
                            // eslint-disable-next-line
                            gpuNeededForRender += size;
                            tile.splitMask = useMask ? mask : null;
                            tile.drawCounter = drawCounter;

                            drawBuffer[drawBufferIndex] = tile;
                            drawBufferIndex++;
                        }

                        //}
                    }


                }
            }
        }

        const tmp = processBuffer;
        processBuffer = newProcessBuffer;
        newProcessBuffer = tmp;
        processBufferIndex = newProcessBufferIndex;

    } while(processBufferIndex > 0);

    if (storeTilesOnly) {
        this.storeDrawBufferGeometry(drawBufferIndex);
        return;
    }

    if (best2 > draw.bestMeshTexelSize) {
        draw.bestMeshTexelSize = best2;
    }

    const stats = map.stats;

    stats.usedNodes = usedNodes;
    stats.processedNodes = pocessedNodes;
    stats.processedMetatiles = pocessedMetatiles;
    stats.gpuNeeded = gpuNeeded;

    //console.log("texel: "+ this.map.bestMeshTexelSize);
    //console.log("more: "+ more + "more2: " + more2);

    this.processDrawBuffer(draw, drawTiles, cameraPos, map, stats, false, false, replay, drawBuffer, drawBufferIndex, true);
};


//loadmode = fitonly
MapSurfaceTree.prototype.drawSurfaceFitOnly = function(shift, storeTilesOnly, useDrawBufferOnly) {
    this.counter++;
//    this.surfaceTracer.trace(this.surfaceTree);//this.rootId);

    let tile = this.surfaceTree;

    if (!tile.isMetanodeReady(this, 0)) {
        return;
    }

    const map = this.map;
    const cameraPos = map.camera.position;
    let node = tile.metanode;

    if (!tile.bboxVisible(tile.id, node.bbox, cameraPos, node)) {
        return;
    }

    tile.updateTexelSize();

    //const typeFactor = this.freeLayerSurface ? 1 : 1;

    const draw = map.draw;
    const drawTiles = draw.drawTiles;
    const drawBuffer = draw.drawBuffer;
    const replay = map.draw.replay;
    const storeNodes = replay.storeNodes || replay.storeFreeNodes;
    const storeNodesBuffer = replay.nodeBuffer;
    let drawBufferIndex = 0;
    let processBuffer = draw.processBuffer;
    let processBufferIndex = 0;
    let newProcessBuffer = draw.processBuffer2;
    let newProcessBufferIndex = 0;

    processBuffer[0] = tile;
    processBufferIndex = 1;

    let texelSizeFit = draw.texelSizeFit;

    draw.drawCounter++;

    let usedNodes = 1;
    let pocessedNodes = 1;
    let pocessedMetatiles = 1;
    let drawCounter = draw.drawCounter, i, j, lj;
    //let grids = false;

    do {
        let best = 0;
        newProcessBufferIndex = 0;

        for (i = processBufferIndex - 1; i >= 0; i--) {
            tile = processBuffer[i];
            node = tile.metanode;

            if (node) {
                pocessedNodes++;
                if (node.metatile.drawCounter != drawCounter) {
                    node.metatile.drawCounter = drawCounter;
                    pocessedMetatiles++;
                }
            }

            if (tile.bboxVisible(tile.id, node.bbox, cameraPos, node)) {

                usedNodes++;

                if (storeNodes) { //used only for inspector
                    storeNodesBuffer.push(tile);
                }

                if (tile.texelSize  != Number.POSITIVE_INFINITY){
                    if (tile.texelSize > best) {
                        best = tile.texelSize;
                    }
                }

                if (/*node.hasGeometry() && */tile.texelSize <= texelSizeFit) {

                    tile.drawCounter = draw.drawCounter;
                    drawBuffer[drawBufferIndex] = tile;
                    drawBufferIndex++;

                } else { //go deeper

                    let childrenCount = 0;
                    let nodesReadyCount = 0;
                    let childrenBuffer = [];

                    for (j = 0; j < 4; j++) {
                        const child = tile.children[j];
                        if (child) {
                            childrenCount++;

                            if (child.isMetanodeReady(this, child.id[0])) { //lod is used as priority

                                this.updateNodeHeightExtents(child, child.metanode);
                                child.updateTexelSize();

                                childrenBuffer.push(child);
                                nodesReadyCount++;

                            } /*else if (useDrawBufferOnly) { //used in downtop
                                //drawBuffer[drawBufferIndex] = [child, true];
                                //drawBufferIndex++;
                            }*/
                        }
                    }

                    if (childrenCount > 0 && (!useDrawBufferOnly || childrenCount == nodesReadyCount)) {
                        //sort children by distance
                        let sorted;

                        do {
                            sorted = true;

                            for (j = 0, lj = childrenBuffer.length - 1; j < lj; j++) {
                                if (childrenBuffer[j].distance > childrenBuffer[j+1].distance) {
                                    const t = childrenBuffer[j];
                                    childrenBuffer[j] = childrenBuffer[j+1];
                                    childrenBuffer[j+1] = t;
                                    sorted = false;
                                }
                            }

                        } while(!sorted);

                        //add childrn to new process buffer
                        for (j = 0, lj = childrenBuffer.length; j < lj; j++) {

                            newProcessBuffer[newProcessBufferIndex] = childrenBuffer[j];
                            newProcessBufferIndex++;
                        }
                    } else {
                        tile.drawCounter = draw.drawCounter;
                        drawBuffer[drawBufferIndex] = tile;
                        drawBufferIndex++;
                    }

                }
            }
        }

        const tmp = processBuffer;
        processBuffer = newProcessBuffer;
        newProcessBuffer = tmp;
        processBufferIndex = newProcessBufferIndex;

    } while(processBufferIndex > 0);

    if (storeTilesOnly) {
        if (useDrawBufferOnly) {
            const tmp = draw.drawBuffer2;
            draw.drawBuffer2 = draw.drawBuffer;
            draw.drawBuffer = tmp;
            //draw.drawBufferIndex = drawBufferIndex;
        } else {
            this.storeDrawBufferGeometry(drawBufferIndex);
        }
        return drawBufferIndex;
    }

    const stats = map.stats;

    stats.usedNodes = usedNodes;
    stats.processedNodes = pocessedNodes;
    stats.processedMetatiles = pocessedMetatiles;

    this.processDrawBuffer(draw, drawTiles, cameraPos, map, stats, false, false, replay, drawBuffer, drawBufferIndex, true);
};


//loadmode = fit
MapSurfaceTree.prototype.drawSurfaceFit = function(shift, storeTilesOnly) {
    this.counter++;

    let tile = this.surfaceTree;

    if (!tile.isMetanodeReady(this, 0)) {
        return;
    }

    const map = this.map;
    const cameraPos = map.camera.position;
    let node = tile.metanode;

    if (!tile.bboxVisible(tile.id, node.bbox, cameraPos, node)) {
        return;
    }

    tile.updateTexelSize();

    const geodata = tile.surface ? tile.surface.geodata : null;
    const maxLod = tile.surface.maxLod || tile.surface.lodRange[1];
    const free = tile.surface ? tile.surface.free : null;
    const drawGrid = (!geodata && !free && map.config.mapHeightfiledWhenUnloaded);
    let checkGpu = true;

    let lodShift = 4;//this.freeLayerSurface ? 1 : 1;
    let typeFactor = 2000;//this.freeLayerSurface ? 1 : 1;

    if (this.freeLayerSurface) {
        lodShift = 0;//this.freeLayerSurface ? 1 : 1;
        typeFactor = 0.1;//this.freeLayerSurface ? 1 : 1;
    }

    const draw = map.draw;
    const drawTiles = draw.drawTiles;
    const replay = draw.replay;
    let drawBuffer = draw.drawBuffer;
    let drawBufferIndex = 0;
    let processBuffer = draw.processBuffer;
    let processBufferIndex = 0;
    let newProcessBuffer = draw.processBuffer2;
    let newProcessBufferIndex = 0;
    let lastProcessBufferIndex = newProcessBufferIndex;
    let lastDrawBufferIndex = drawBufferIndex;

    processBuffer[0] = [tile, 0];
    processBufferIndex = 1;

    let texelSizeFit = draw.texelSizeFit;

    let storeNodes = replay.storeNodes || replay.storeFreeNodes;
    let storeNodesBuffer = replay.nodeBuffer;

    draw.drawCounter++;

    let usedNodes = 1;
    let pocessedNodes = 1;
    let pocessedMetatiles = 1;
    let drawCounter = draw.drawCounter;
    let maxHiresLodLevels = map.config.mapMaxHiresLodLevels, i, j, lj, child, priority, parent, parent2, children2;
    let grids = false;

    do {
        let best = 0;
        newProcessBufferIndex = 0;

        /*if (this.map.drawIndices) {
            console.log("processed begin==============================================");
        }*/

        for (i = processBufferIndex - 1; i >= 0; i--) {
            const pack = processBuffer[i];
            tile = pack[0];
            let depth = pack[1];

            tile.childrenReadyCount = 0;

            /*if (this.map.drawIndices) {
                console.log(JSON.stringify(tile.id));
            }*/

            if (depth >= maxHiresLodLevels) {
                if (drawGrid) {
                    parent = tile;

                    //make sure that we draw grid with lowest possible detail
                    parent2 = parent.parent;

                    if (parent.id[0] > 3 && depth !=0 && parent2 && parent2.childrenReadyCount == 0) {
                        children2 = parent2.children;

                        if (!(depth >= 1 && parent.parent && ((children2[0] && children2[0].childrenReadyCount != 0) ||
                             (children2[1] && children2[1].childrenReadyCount != 0) ||
                             (children2[2] && children2[2].childrenReadyCount != 0) ||
                             (children2[3] && children2[3].childrenReadyCount != 0)))) {
                            parent = parent.parent;
                        }
                    }

                    //make sure that grid tile is rendered only one time
                    if (parent.drawCounter != draw.drawCounter && (!parent.parent || parent.parent.drawCounter != draw.drawCounter )) {
                        parent.drawCounter = draw.drawCounter;

                        drawBuffer[drawBufferIndex] = [parent, true]; //draw grid
                        drawBufferIndex++;
                        grids = true;
                    }
                }

                continue;
            }

            node = tile.metanode;

            if (node) {
                pocessedNodes++;
                if (node.metatile.drawCounter != drawCounter) {
                    node.metatile.drawCounter = drawCounter;
                    pocessedMetatiles++;
                }
            }


            if (tile.bboxVisible(tile.id, node.bbox, cameraPos, node)) {

                usedNodes++;

                if (tile.texelSize  != Number.POSITIVE_INFINITY){
                    if (tile.texelSize > best) {
                        best = tile.texelSize;
                    }
                }

                if (storeNodes) { //used only for inspaector
                    storeNodesBuffer.push(tile);
                }

                lastProcessBufferIndex = newProcessBufferIndex;
                lastDrawBufferIndex = drawBufferIndex;

                if (!node.hasChildren() || tile.texelSize <= texelSizeFit || (geodata && tile.id[0] >= maxLod)) {

                    priority = ((tile.id[0] + lodShift) * typeFactor) * tile.distance;

                    if (node.hasChildren() && !drawTiles.drawSurfaceTile(tile, tile.metanode, cameraPos, tile.texelSize, priority, true, (depth > 0), checkGpu)) {

                        depth++; //we dont have tile ready, so we try to draw more detailed tiles

                        for (j = 0; j < 4; j++) {
                            child = tile.children[j];
                            if (child) {

                                if (child.isMetanodeReady(this, child.id[0], true)) { //lod is used as priority

                                    this.updateNodeHeightExtents(child, child.metanode);
                                    child.updateTexelSize();

                                    //are draw buffers ready? preventRender=true, preventLoad=false
                                    if (drawTiles.drawSurfaceTile(child, child.metanode, cameraPos, child.texelSize, priority, true, (depth > 0), checkGpu)) {
                                        tile.childrenReadyCount++;
                                        child.drawCounter = draw.drawCounter;

                                        drawBuffer[drawBufferIndex] = [child, false];
                                        drawBufferIndex++;
                                    } else {
                                        newProcessBuffer[newProcessBufferIndex] = [child, depth];
                                        newProcessBufferIndex++;
                                    }
                                }
                            }
                        }

                        if (lastProcessBufferIndex == newProcessBufferIndex && lastDrawBufferIndex == drawBufferIndex) {
                            depth--;
                        }

                    } else {
                        tile.drawCounter = draw.drawCounter;

                        drawBuffer[drawBufferIndex] = [tile, false];
                        drawBufferIndex++;
                    }

                } else if (depth == 0 && node.hasGeometry() && tile.texelSize <= (texelSizeFit * 2)) {

                    //are all children ready? if not then draw carser lod
                    let childrenCount = 0;
                    let readyCount = 0;
                    let childrenBuffer = [];

                    for (j = 0; j < 4; j++) {
                        child = tile.children[j];
                        if (child) {
                            childrenCount++;

                            if (child.isMetanodeReady(this, child.id[0])) { //lod is used as priority

                                this.updateNodeHeightExtents(child, child.metanode);
                                child.updateTexelSize();

                                priority = ((child.id[0] + lodShift) * typeFactor) * child.distance;

                                //are draw buffers ready? preventRender=true, preventLoad=true
                                if (drawTiles.drawSurfaceTile(child, child.metanode, cameraPos, child.texelSize, priority, true, true, checkGpu)) {
                                    readyCount++;
                                    childrenBuffer.push(child);
                                }
                            }
                        }
                    }

                    if (childrenCount > 0 && childrenCount == readyCount) {
                        //sort children by distance

                        let sorted;

                        do {
                            sorted = true;

                            for (j = 0, lj = childrenBuffer.length - 1; j < lj; j++) {
                                if (childrenBuffer[j].distance > childrenBuffer[j+1].distance) {
                                    let t = childrenBuffer[j];
                                    childrenBuffer[j] = childrenBuffer[j+1];
                                    childrenBuffer[j+1] = t;
                                    sorted = false;
                                }
                            }

                        } while(!sorted);

                        //add children to new process buffer
                        for (j = 0, lj = childrenBuffer.length; j < lj; j++) {
                            newProcessBuffer[newProcessBufferIndex] = [childrenBuffer[j], depth];
                            newProcessBufferIndex++;
                        }
                    } else {

                        //can i use coarser lod
                        priority = ((tile.id[0] + lodShift) * typeFactor) * tile.distance;

                        if (drawTiles.drawSurfaceTile(tile, tile.metanode, cameraPos, tile.texelSize, priority, true, true, checkGpu)) {
                            tile.drawCounter = draw.drawCounter;

                            drawBuffer[drawBufferIndex] = [tile, false];
                            drawBufferIndex++;

                            for (j = 0; j < 4; j++) {
                                child = tile.children[j];
                                if (child) {
                                    if (child.isMetanodeReady(this, child.id[0])) { //lod is used as priority
                                        priority = ((child.id[0] + lodShift) * typeFactor) * child.distance;
                                        drawTiles.drawSurfaceTile(child, child.metanode, cameraPos, child.texelSize, priority, true, false, checkGpu);
                                    }
                                }
                            }

                        } else {

                            //add children to new process buffer
                            for (j = 0; j < 4; j++) {
                                child = tile.children[j];
                                if (child) {
                                    if (child.isMetanodeReady(this, child.id[0])) { //lod is used as priority
                                        this.updateNodeHeightExtents(child, child.metanode);
                                        child.updateTexelSize();

                                        newProcessBuffer[newProcessBufferIndex] = [child, depth];
                                        newProcessBufferIndex++;
                                    }
                                }
                            }

                        }
                    }

                }  else  {  //go deeper


                    for (j = 0; j < 4; j++) {
                        child = tile.children[j];
                        if (child) {

                            if (child.isMetanodeReady(this, child.id[0])) { //lod is used as priority
                                this.updateNodeHeightExtents(child, child.metanode);
                                child.updateTexelSize();

                                newProcessBuffer[newProcessBufferIndex] = [child, depth];
                                newProcessBufferIndex++;
                            }
                        }
                    }
                }
            }


            if (drawGrid && lastProcessBufferIndex == newProcessBufferIndex && lastDrawBufferIndex == drawBufferIndex) {
                parent = tile;

                //make sure that we draw grid with lowest possible detail
                parent2 = parent.parent;

                if (parent.id[0] > 3 && depth !=0 && parent2 && parent2.childrenReadyCount == 0) {
                    children2 = parent2.children;

                    if (!(depth >= 1 && parent.parent && ((children2[0] && children2[0].childrenReadyCount != 0) ||
                         (children2[1] && children2[1].childrenReadyCount != 0) ||
                         (children2[2] && children2[2].childrenReadyCount != 0) ||
                         (children2[3] && children2[3].childrenReadyCount != 0)))) {
                        parent = parent.parent;
                    }
                }

                //make sure that grid tile is rendered only one time
                if (parent && parent.drawCounter != draw.drawCounter) {
                    parent.drawCounter = draw.drawCounter;

                    drawBuffer[drawBufferIndex] = [parent, true]; //draw grid
                    drawBufferIndex++;
                    grids = true;
                }
            }

        }

        /*if (this.map.drawIndices) {
            console.log("processed end==============================================");
        }*/

        const tmp = processBuffer;
        processBuffer = newProcessBuffer;
        newProcessBuffer = tmp;
        processBufferIndex = newProcessBufferIndex;

    } while(processBufferIndex > 0);

    if (storeTilesOnly) {
        this.storeDrawBufferGeometry(drawBufferIndex);
        return;
    }

    const stats = map.stats;

    stats.usedNodes = usedNodes;
    stats.processedNodes = pocessedNodes;
    stats.processedMetatiles = pocessedMetatiles;

    this.processDrawBuffer(draw, drawTiles, cameraPos, map, stats, drawGrid, grids, replay, drawBuffer, drawBufferIndex);
};


//loadmode = downtop
// eslint-disable-next-line
MapSurfaceTree.prototype.drawSurfaceDownTop = function(shift, storeTilesOnly) {
    this.counter++;

    const map = this.map;
    const cameraPos = map.camera.position;
    let tile = this.surfaceTree;

    if (!tile.isMetanodeReady(this, 0)) {
        return;
    }

    tile.updateTexelSize();

    const root = tile;
    let node = tile.metanode;

    if (!tile.bboxVisible(tile.id, node.bbox, cameraPos, node)) {
        return;
    }

    //const drawBufferIndex2 = this.drawSurfaceFitOnly(shift, true, true);
    //if (drawBufferIndex2 == 0) {
      //  return;
    //}

    const draw = map.draw;
    const drawTiles = draw.drawTiles;
    let drawBuffer = draw.drawBuffer;
    let drawBuffer2 = draw.drawBuffer2;
    let drawBufferIndex = 0;
    let texelSizeFit = draw.texelSizeFit;
    let tilesToLoad = 0, priority, parent, child;

    let processBuffer = draw.processBuffer;
    let newProcessBuffer = draw.processBuffer2;
    let processBufferIndex = 0;
    let newProcessBufferIndex = 0;

    processBuffer[0] = tile;
    processBufferIndex = 1;

    draw.drawCounter++;

    const replay = map.draw.replay;
    const storeNodes = replay.storeNodes || replay.storeFreeNodes;
    const storeNodesBuffer = replay.nodeBuffer;

    let usedNodes = 1;
    let pocessedNodes = 1;
    let pocessedMetatiles = 1;
    let drawCounter = draw.drawCounter, i, j, lj;
    let grids = false, item, hit;

    do {
        let best = 0;
        newProcessBufferIndex = 0;

        for (i = processBufferIndex - 1; i >= 0; i--) {
            tile = processBuffer[i];
            node = tile.metanode;

            if (node) {
                // eslint-disable-next-line
                pocessedNodes++;
                if (node.metatile.drawCounter != drawCounter) {
                    node.metatile.drawCounter = drawCounter;
                    // eslint-disable-next-line
                    pocessedMetatiles++;
                }
            }

            if (tile.bboxVisible(tile.id, node.bbox, cameraPos, node)) {

                // eslint-disable-next-line
                usedNodes++;

                if (storeNodes) { //used only for inspector
                    storeNodesBuffer.push(tile);
                }

                if (tile.texelSize  != Number.POSITIVE_INFINITY){
                    if (tile.texelSize > best) {
                        best = tile.texelSize;
                    }
                }

                if (/*node.hasGeometry() && */tile.texelSize <= texelSizeFit) {

                    tile.drawCounter = drawCounter;
                    drawBuffer[drawBufferIndex] = tile;
                    drawBufferIndex++;

                } else { //go deeper

                    let childrenCount = 0;
                    let nodesReadyCount = 0;
                    let childrenBuffer = [];

                    for (j = 0; j < 4; j++) {
                        const child = tile.children[j];
                        if (child) {
                            childrenCount++;

                            if (child.isMetanodeReady(this, child.id[0])) { //lod is used as priority

                                this.updateNodeHeightExtents(child, child.metanode);
                                child.updateTexelSize();

                                childrenBuffer.push(child);
                                nodesReadyCount++;

                            } /*else if (useDrawBufferOnly) { //used in downtop
                                //drawBuffer[drawBufferIndex] = [child, true];
                                //drawBufferIndex++;
                            }*/
                        }
                    }

                    if (childrenCount > 0 && (childrenCount == nodesReadyCount)) {
                        //sort children by distance
                        let sorted;

                        do {
                            sorted = true;

                            for (j = 0, lj = childrenBuffer.length - 1; j < lj; j++) {
                                if (childrenBuffer[j].distance > childrenBuffer[j+1].distance) {
                                    const t = childrenBuffer[j];
                                    childrenBuffer[j] = childrenBuffer[j+1];
                                    childrenBuffer[j+1] = t;
                                    sorted = false;
                                }
                            }

                        } while(!sorted);

                        //add childrn to new process buffer
                        for (j = 0, lj = childrenBuffer.length; j < lj; j++) {

                            newProcessBuffer[newProcessBufferIndex] = childrenBuffer[j];
                            newProcessBufferIndex++;
                        }
                    } else {
                        tile.drawCounter = drawCounter;
                        drawBuffer[drawBufferIndex] = [tile,true];
                        drawBufferIndex++;
                    }

                }
            }
        }

        const tmp = processBuffer;
        processBuffer = newProcessBuffer;
        newProcessBuffer = tmp;
        processBufferIndex = newProcessBufferIndex;

    } while(processBufferIndex > 0);

    if (drawBufferIndex == 0) {
        return;
    }

    let tmp = draw.drawBuffer2;
    draw.drawBuffer2 = draw.drawBuffer;
    draw.drawBuffer = tmp;

    drawBuffer = draw.drawBuffer;
    drawBuffer2 = draw.drawBuffer2;
    let drawBufferIndex2 = drawBufferIndex;
    drawBufferIndex = 0;

    //draw.drawCounter++;
    //drawCounter++;

    let lodShift = 4;
    let typeFactor = 2000;

    if (this.freeLayerSurface) {
        lodShift = 0;
        typeFactor = 0.1;
    }

    const findLoadedParent = (function(){

        //TODO: NEW RULES
            // search parent
               // if exist load from parent down (there can be configurable limit e.g. max 3 lods up)
               // if not exist (root) load only fit lod


        let hasLoadedParent = false;

        if (/*tile.texelSize != 1 && tile.texelSize <= texelSizeFit &&*/ tile != root) {
            parent = tile.parent;

            while (parent != root) {
                priority = ((parent.id[0] + lodShift) * typeFactor);

                // preventRender=true, preventLoad=true, checkGpu = false
                if (drawTiles.drawSurfaceTile(parent, parent.metanode, cameraPos, parent.texelSize, priority, true, true, false)) {
                    //render parent
                    drawBuffer[drawBufferIndex] = [parent, false];
                    parent.drawCounter = drawCounter;
                    hasLoadedParent = true;

                    //load children
                    for (let j = 0; j < 4; j++) {
                        child = parent.children[j];
                        if (child) {
                            if (child.isMetanodeReady(this, child.id[0])) { //lod is used as priority
                                // preventRender=true, preventLoad=false, checkGpu = false
                                if (!drawTiles.drawSurfaceTile(child, child.metanode, cameraPos, child.texelSize, priority, true, false, false)) {
                                    tilesToLoad++;
                                }
                            }
                        }
                    }

                    break;
                }

                parent = parent.parent;
            }


            if (!hasLoadedParent) {
                priority = ((tile.id[0] + lodShift) * typeFactor);

                // preventRender=true, preventLoad=false, checkGpu = false
                if (!drawTiles.drawSurfaceTile(tile, tile.metanode, cameraPos, tile.texelSize, priority, true, false, false)) {
                    drawBuffer[drawBufferIndex] = [tile, true];
                    tile.drawCounter = drawCounter;
                    tilesToLoad++;
                } else {
                    drawBuffer[drawBufferIndex] = [tile, false];
                    tile.drawCounter = drawCounter;
                }
            }
        }


    });


    //draw surface
    for (i = drawBufferIndex2 - 1; i >= 0; i--) {
        item = drawBuffer2[i];
        //tile = (noGrid) ? item : item[0];

        if (item[1]) {
            tile = item[0];

            if (!tile.isMetanodeReady(this, tile.id[0])) { //lod is used as priority
                continue;
            }

            drawBuffer[drawBufferIndex] = [tile, true];
            grids = true;
            priority = 20;

            //TODO: search parents
                // if parent exist render parent (limit parent level?), load children,
                // remove parent children from draw buffer?

            //if (!node.hasChildren() || ) {

            findLoadedParent();

        } else {
            tile = item;
            node = tile.metanode;
            drawBuffer[drawBufferIndex] = [tile, false];
            priority = ((tile.id[0] + lodShift) * typeFactor);

            //are draw buffers ready? preventRender=true, preventLoad=false, checkGpu = false
            if (!drawTiles.drawSurfaceTile(tile, tile.metanode, cameraPos, tile.texelSize, priority, true, false, false)) {

                findLoadedParent();

                tilesToLoad++;
            } else {
                tile.drawCounter = drawCounter;
            }
        }

        drawBufferIndex++;
    }


    //filter out children
    tmp = drawBuffer2;
    drawBuffer2 = drawBuffer;
    drawBuffer = tmp;

    drawBufferIndex2 = drawBufferIndex;
    drawBufferIndex = 0;

    for (i = 0; i < drawBufferIndex2; i++) {
        item = drawBuffer2[i];

        tile = item[0];
        hit = false;

        if (tile != root) {
            parent = tile.parent;

            while (parent != root) {

                if (parent.drawCounter == drawCounter) {
                    hit = true;
                    break;
                }

                parent = parent.parent;
            }
        }

        if (!hit) {
            drawBuffer[drawBufferIndex] = drawBuffer2[i];
            drawBufferIndex++;
        }
    }


    //TODO: if everything loaded then load parents
        // use drawCounter as optimization

    if (tilesToLoad == 0) {

        for (i = 0; i < drawBufferIndex; i++) {
            item = drawBuffer[i];

            tile = item[0];
            hit = false;

            if (tile != root) {
                parent = tile.parent;

                while (parent != root) {

                    priority = (((100-tile.id[0]) + lodShift) * typeFactor);

                    //are draw buffers ready? preventRender=true, preventLoad=false, checkGpu = false
                    if (!drawTiles.drawSurfaceTile(parent, parent.metanode, cameraPos, parent.texelSize, priority, true, false, false)) {
                        break;
                    }

                    parent = parent.parent;
                }
            }

        }

    }


    //if (/*node.hasGeometry() && */tile.texelSize <= texelSizeFit) {

    const stats = map.stats;
    //const draw = map.draw;
    //const drawTiles = draw.drawTiles;
    //const replay = draw.replay;

    const geodata = tile.surface ? tile.surface.geodata : null;
    const free = tile.surface ? tile.surface.free : null;
    const drawGrid = (!geodata && !free && map.config.mapHeightfiledWhenUnloaded);

    //stats.usedNodes = usedNodes;
    //stats.processedNodes = pocessedNodes;
    //stats.processedMetatiles = pocessedMetatiles;

    this.processDrawBuffer(draw, drawTiles, cameraPos, map, stats, drawGrid, grids, replay, drawBuffer, drawBufferIndex);
};


MapSurfaceTree.prototype.processDrawBuffer = function(draw, drawTiles, cameraPos, map, stats, drawGrid, grids, replay, drawBuffer, drawBufferIndex, noGrid) {

    if (replay.storeTiles || replay.storeFreeTiles) { //used only in inspectors
        if (!draw.tileBuffer[0]) {
            draw.tileBuffer[0] = [];
        }

        const tiles = draw.tileBuffer[0];
        for (i = drawBufferIndex - 1; i >= 0; i--) {
            tiles.push(drawBuffer[i]);
        }
    }

    const scanExtents = (!this.freeLayerSurface && map.config.mapFeatureStickMode[0] == 2); // && this.freeLayerSurface.geodata && draw.drawChannel == 0);
    const renderer = map.renderer;
    let hmax = -999999, hmin = 999999;
    let p1, p2, camVec, length, tilt, factor, i, tile, node;

    map.gpuCache.skipCostCheck = true;

    const underSurfaceGrid = (drawGrid && map.config.mapGridUnderSurface > 0 && grids);

    if (underSurfaceGrid) {
        //draw only grid
        for (i = drawBufferIndex - 1; i >= 0; i--) {
            drawBuffer[i][0].drawGrid(cameraPos);
        }

        //clear zbuffer
        map.renderer.gpu.clear(true, false);
    }

    //draw surface
    for (i = drawBufferIndex - 1; i >= 0; i--) {
        const item = drawBuffer[i];
        tile = (noGrid) ? item : item[0];
        node = tile.metanode;

        if (scanExtents && node) {
            // TODO noramlize by distance and tilt

            p2 = node.diskPos;
            p1 = renderer.cameraPosition;
            camVec = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
            length = vec3.normalize4(camVec);
            tilt = -vec3.dot(camVec, node.diskNormal);

            if (tilt < 0) {
                tilt = 0;
            }

            tilt = 1 - tilt;

            factor = (renderer.camera.fovDist / length) * tilt;
            //renderer.camera.scaleFactor2(d) * screenPixelSize
            //pp = this.renderer.project2(tile.diskPos, mvp);

            if (node.minZ * factor < hmin) {
                hmin = node.minZ * factor;
            }

            if (node.maxZ * factor > hmax) {
                hmax = node.maxZ * factor;
            }
        }


        if (noGrid)  {

            if (stats.gpuRenderUsed >= draw.maxGpuUsed)  {
                break;
            }

            //draw tile,  preventRender=false, preventLoad=false
            drawTiles.drawSurfaceTile(tile, tile.metanode, cameraPos, tile.texelSize, 0, false, false);

        } else {

            if (underSurfaceGrid) {

                if (!item[1] && !(stats.gpuRenderUsed >= draw.maxGpuUsed))  {
                    drawTiles.drawSurfaceTile(tile, tile.metanode, cameraPos, tile.texelSize, 0, false, false /*, checkGpu*/);
                } else {
                    if (drawTiles.debug.drawBBoxes) {
                        drawTiles.drawTileInfo(tile, tile.metanode, cameraPos);
                    }
                }

            } else {

                if ((drawGrid && item[1]) || stats.gpuRenderUsed >= draw.maxGpuUsed)  {

                    if (drawTiles.debug.drawBBoxes) {
                        drawTiles.drawTileInfo(tile, tile.metanode, cameraPos);
                    }

                    tile.drawGrid(cameraPos);
                } else if (!item[1]) {
                    drawTiles.drawSurfaceTile(tile, tile.metanode, cameraPos, tile.texelSize, 0, false, false /*, checkGpu*/);
                }
            }

        }
    }

    if (scanExtents) {
        renderer.gridHmax = hmax;
        renderer.gridHmin = hmin;
    }

    map.gpuCache.skipCostCheck = false;
    map.gpuCache.checkCost();

};



MapSurfaceTree.prototype.storeDrawBufferGeometry = function(drawBufferIndex) {
    const map = this.map;
    const drawBuffer = map.draw.drawBuffer;

    this.storeGeometry(drawBuffer, drawBufferIndex);
};


MapSurfaceTree.prototype.storeGeometry = function(array, length) {
    const map = this.map;
    const drawBuffer = array;
    map.storedTilesRes = new Array(length);

    for (let i = length - 1; i >= 0; i--) {
        const tile = drawBuffer[i];

        if (tile.metanode && tile.surface && tile.metanode.hasGeometry() &&
            tile.surfaceMesh && tile.surfaceMesh.isReady(true, 0, true)) {

            const mesh = tile.surfaceMesh;
            const submeshes = [];

            for (let j = 0, lj = mesh.submeshes.length; j < lj; j++) {
                const submesh = mesh.submeshes[j],
                    vertices = submesh.vertices.slice(),
                    min = submesh.bbox.min,
                    max = submesh.bbox.max,
                    delta = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];

                for (let k = 0, lk = vertices.length; k < lk; k+=3) {
                    vertices[k] = vertices[k]*delta[0] + min[0];
                    vertices[k+1] = vertices[k+1]*delta[1] + min[1];
                    vertices[k+2] = vertices[k+2]*delta[2] + min[2];
                }

                submeshes.push({
                    "bbox": [min.slice(), max.slice()],
                    "vertices" : vertices });
            }

            map.storedTilesRes[i] = {
                "id": tile.id.slice(),
                "type": "mesh",
                "submeshes": submeshes
            };
        }
    }
};


MapSurfaceTree.prototype.traceHeight = function(tile, params, nodeOnly) {
    if (!tile) {
        return;
    }

    this.params = params;

    const heightFunction = nodeOnly ? this.traceHeightTileByNodeOnly : this.traceHeightTileByMap;

    if (tile.id[0] == 1) { //update root, get height in VTS2015 starts in division node which has lod 1
        this.traceHeightTile(tile.parent, 0, true);
        if (!tile.parent.metanode) {
            return;
        }
    }

    this.traceHeightTile(tile, 0, false, heightFunction);
};


MapSurfaceTree.prototype.traceHeightTile = function(tile, priority, nodeReadyOnly, heightFunction) {
    if (tile == null) {
        return;
    }

    if (!tile.isMetanodeReady(this, 0) || nodeReadyOnly) {
        this.params.waitingForNode = true;
        return;
    }

    tile.metanode.metatile.used();

    if (tile.lastSurface && tile.lastSurface == tile.surface) {
        tile.lastSurface = null;
        tile.restoreLastState();
        //return;
    }

    //process tile e.g. draw or get height
    const res = heightFunction(tile, this.params, priority);

    if (res) { //we need to go deeper
        const childIndex = this.traceHeightChild(tile, this.params);
        const child = tile.children[childIndex];

        if (!child) {
            this.params.finalNode = true;
        }

        this.traceHeightTile(child, 0, false, heightFunction);
    }
};


MapSurfaceTree.prototype.traceHeightChild = function(tile, params) {
    const coords = params.coords;
    const extents = params.extents;
    const center = [(extents.ll[0] + extents.ur[0]) *0.5,
        (extents.ll[1] + extents.ur[1]) *0.5];

    //ul,ur,ll,lr
    //deside in which quadrant are provided coodinates
    const right = (coords[0] >= center[0]);
    const bottom = (coords[1] >= center[1]);

    if (right) {
        extents.ll[0] = center[0];
        if (bottom) {
            extents.ll[1] = center[1];
        } else {
            extents.ur[1] = center[1];
        }
    } else {
        extents.ur[0] = center[0];
        if (bottom) {
            extents.ll[1] = center[1];
        } else {
            extents.ur[1] = center[1];
        }
    }

    /*
    if (extents.ll[0] > extents.ur[0]) {
        right = !right;
    }

    if (extents.ll[1] < extents.ur[1]) {
        bottom = !bottom;
    }*/

    //trace only resulting quadrant
    if (right) {
        return bottom ? 1 : 3;
    } else {
        return bottom ? 0 : 2;
    }
};


MapSurfaceTree.prototype.traceHeightTileByMap = function(tile, params) {
    if (!tile || (tile.id[0] > params.desiredLod && params.heightMap)) {
        return false;
    }

    const node = tile.metanode;

    if (!node) {
        return false;
    }

    if (node.hasNavtile()) {
        params.bestHeightMap = tile.id[0];

        if (!tile.heightMap) {
            //if (!preventLoad) {
                //if (!tile.surface || tile.surface.virtual) {
            if (!tile.surface || !tile.resourceSurface) { //surface.virtual) {
                return false; //is it best way how to do it?
            }

            if (!tile.resourceSurface.getNavUrl) { //virtual surface is as resource surface. Is it bug??!!
                return false; //is it best way how to do it?
            }

            const path = tile.resourceSurface.getNavUrl(tile.id);
            tile.heightMap = tile.resources.getTexture(path, true);
            //}
        } else {
            if (tile.heightMap.isReady(null, null, true)) {
                params.parent = {
                    metanode : params.metanode,
                    heightMap : params.heightMap,
                    heightMapExtents : params.heightMapExtents
                };

                params.metanode =  node;
                params.heightMap = tile.heightMap;
                params.heightMapExtents = {
                    ll : params.extents.ll.slice(),
                    ur : params.extents.ur.slice()
                };
                return (tile.id[0] != params.desiredLod);
            }
        }
    } else {
        if (!params.heightMap) {
            params.metanode =  node;
        }

        return true;
    }

    return false;
};


MapSurfaceTree.prototype.traceHeightTileByNodeOnly = function(tile, params) {
    if (!tile || tile.id[0] > params.desiredLod) {
        return false;
    }

    const node = tile.metanode;

    if (!node) {
        return false;
    }

    params.parent = {
        metanode : params.metanode
    };

    params.metanode =  node;
    return (tile.id[0] != params.desiredLod);
};


MapSurfaceTree.prototype.getNodeById = function(id, preventLoad) {
    let tile = this.surfaceTree;

    if (tile == null) {
        return;
    }

    for (let lod = id[0]; lod > 0; lod--) {
        const mask = 1 << (lod-1);
        let index = 0;

        if ((id[1] & mask) != 0) {
            index += 1;
        }

        if ((id[2] & mask) != 0) {
            index += 2;
        }

        if (!tile.children[index]) {

            if (!tile.isMetanodeReady(this, 0, preventLoad)) {
                return null;
            }

            if (!tile.metanode.hasChild(index)) {
                return null;
            }

            tile.addChild(index);
        }

        tile = tile.children[index];
    }

    if (!tile) {
        return;
    }

    if (!tile.isMetanodeReady(this, 0, preventLoad)) {
        return;
    }

    const node = tile.metanode;
    tile.metanode.metatile.used();

    return node;

	/*
    if (tile.lastSurface && tile.lastSurface == tile.surface) {
        tile.lastSurface = null;
        tile.restoreLastState();
        //return;
    }*/
};


MapSurfaceTree.prototype.getRenderedNodeById = function(id, drawCounter) {
    let tile = this.surfaceTree;

    if (tile == null) {
        return;
    }

    if (tile.drawCounter == drawCounter) {
        if (!tile.isMetanodeReady(this, 0)) {
            return;
        }

        return tile.metanode;
    }

    for (let lod = id[0]; lod > 0; lod--) {
        const mask = 1 << (lod-1);
        let index = 0;

        if ((id[1] & mask) != 0) {
            index += 1;
        }

        if ((id[2] & mask) != 0) {
            index += 2;
        }

        if (!tile.children[index]) {

            if (!tile.isMetanodeReady(this, 0)) {
                return;
            }

            if (!tile.metanode.hasChild(index)) {
                return;
            }
        }

        tile = tile.children[index];

        if (tile.drawCounter == drawCounter) {
            if (!tile.isMetanodeReady(this, 0)) {
                return;
            }

            return tile.metanode;
        } else {
            if (lod == 1) { //rendered lod is probably from more detailed lod so we take one which is from same lod
                return tile.metanode;
            }
        }
    }

    return;
};


MapSurfaceTree.prototype.chekTileMesh = function(tile) {
    if (this.params.loadMeshes || this.params.loadTextures) {

        const tmp = this.config.mapNoTextures;
        this.config.mapNoTextures = !this.params.loadTextures;

        //are resources ready? priority=0, preventRender=true, preventLoad=false, doNotCheckGpu=true
        if (!this.map.draw.drawTiles.drawSurfaceTile(tile, tile.metanode, this.map.renderer.cameraPosition, tile.texelSize, 0, true, false, true)) {
            this.params.loaded = false;
        }

        this.config.mapNoTextures = tmp;
    }
};


MapSurfaceTree.prototype.traceAreaTiles = function(tile, priority, nodeReadyOnly) {
    if (tile == null) {
        return;
    }

    if (!tile.isMetanodeReady(this, 0) || nodeReadyOnly) {
        this.params.loaded = false;
        //console.log('(L)' + JSON.stringify(tile.id));
        tile.isMetanodeReady(this, 0);
        return;
    }

    tile.metanode.metatile.used();

    if (tile.lastSurface && tile.lastSurface == tile.surface) {
        tile.lastSurface = null;
        tile.restoreLastState();
        //return;
    }

    if (!tile.insideCone(this.params.coneVec, this.params.coneAngle, tile.metanode)) {
        return;
    }

    const fit = (this.params.mode == 'lod') ? (tile.id[0] >= this.params.limit) : (tile.metanode.pixelSize <= this.params.limit);

    if (fit) {
        //console.log('(A)' + JSON.stringify(tile.id));
        this.chekTileMesh(tile);
        this.params.areaTiles.push(tile);
        return;
    }

    if (!tile.metanode.hasChildren()) {
        //console.log('(A)' + JSON.stringify(tile.id));
        this.chekTileMesh(tile);
        this.params.areaTiles.push(tile);
    } else {
        for (let i = 0; i < 4; i++) {
            this.traceAreaTiles(tile.children[i], priority, nodeReadyOnly);
        }
    }
};



export default MapSurfaceTree;
