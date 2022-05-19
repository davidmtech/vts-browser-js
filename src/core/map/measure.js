
import {vec3 as vec3_, mat4 as mat4_} from '../utils/matrix';
import {math as math_} from '../utils/math';
import GeographicLib_ from 'geographiclib';

//get rid of compiler mess
const vec3 = vec3_, mat4 = mat4_;
const math = math_;
const GeographicLib = GeographicLib_;


const MapMeasure = function(map) {
    this.map = map;
    this.config = map.config;
    this.convert = map.convert;
    this.getPhysicalSrs = this.map.getPhysicalSrs();
    this.navigationSrs = this.map.getNavigationSrs();
    this.publicSrs = this.map.getPublicSrs();
    this.navigationSrsInfo = this.navigationSrs.getSrsInfo();
    this.isProjected = this.navigationSrs.isProjected();

    const res = this.getSpatialDivisionNodeDepths();

    this.minDivisionNodeDepth = res[0];
    this.maxDivisionNodeDepth = res[1];
};

MapMeasure.prototype.getSurfaceAreaGeometry = function(coords, radius, mode, limit, loadMeshes, loadTextures) {
    const tree = this.map.tree;

    if (tree.surfaceSequence.length == 0) {
        return [true, []];
    }

    const center = this.convert.convertCoords(coords, 'navigation', 'physical');
    const coneVec = [0,0,0];

    vec3.normalize(center, coneVec);

    const distance = vec3.length(center);
    const coneAngle = Math.atan(Math.tan(radius / distance));

    tree.params = {
        coneVec : coneVec,
        coneAngle : coneAngle,
        mode : mode,
        limit : limit,
        loaded : true,
        areaTiles : [],
        loadMeshes: (loadMeshes === true),
        loadTextures: (loadTextures === true)
    };

    //priority = 0, noReadInly = false
    tree.traceAreaTiles(tree.surfaceTree, 0, false);

    return [tree.params.loaded, tree.params.areaTiles];
};

MapMeasure.prototype.getSurfaceHeight = function(coords, lod, storeStats, node, nodeCoords, coordsArray, useNodeOnly) {
    const tree = this.map.tree;

    if (tree.surfaceSequence.length == 0) {
        return [0, true, true, null, null, null];
    }

    if (!node) {
        const result = this.getSpatialDivisionNode(coords);
        node = result[0];
        nodeCoords = result[1];
    }

    if (!this.config.mapHeightLodBlend) {
        lod = Math.floor(lod);
    }

    if (useNodeOnly || this.config.mapIgnoreNavtiles) {
        return this.getSurfaceHeightNodeOnly(null, lod + 8, storeStats, lod, null, node, nodeCoords, coordsArray);
    }

    if (node != null && lod !== null) {
        const root = tree.findSurfaceTile(node.id);

        const extents = {
            ll : node.extents.ll.slice(),
            ur : node.extents.ur.slice()
        };
        const params = {
            coords : nodeCoords,
            desiredLod : Math.ceil(lod),
            extents : extents,
            metanode : null,
            heightMap : null,
            heightMapExtents : null,
            traceHeight : true,
            waitingForNode : false,
            finalNode : false,
            bestHeightMap : 999
        };

        tree.traceHeight(root, params, false);

        const metanode = params.metanode;
        let i, li, height;

        if (params.heightMap) {
            if (storeStats) {
                const stats = this.map.stats;
                stats.heightClass = 2;
                stats.heightLod = lod;
                stats.heightNode = metanode.id[0];
            }

            let res = metanode.id[0] >= Math.ceil(lod);
            let arrayRes, height1, height2;

            if (this.config.mapHeightLodBlend && metanode.id[0] > 0 &&
                params.parent && params.parent.heightMap && lod <= metanode.id[0]) {
                height1 = this.getHeightmapValue(nodeCoords, params.parent.metanode, params.parent);
                height2 = this.getHeightmapValue(nodeCoords, metanode, params);
                const factor = lod - Math.floor(lod);
                height = height1 + (height2 - height1) * factor;

                if (coordsArray) {
                    arrayRes = new Array(coordsArray.length);

                    for (i = 0, li = coordsArray.length; i < li; i++) {
                        const nodeCoords2 = coordsArray[i];//node.getInnerCoords(coordsArray[i]);
                        height1 = this.getHeightmapValue(nodeCoords2, params.parent.metanode, params.parent);
                        height2 = this.getHeightmapValue(nodeCoords2, metanode, params);

                        arrayRes[i] = [height1 + (height2 - height1) * factor, res, true];
                    }
                }

                //console.log("lod: " + lod + " h1: " + height1 + " h2: " + height2 + " h: " + height);
            } else {
                height = this.getHeightmapValue(nodeCoords, metanode, params);

                if (coordsArray) {
                    arrayRes = new Array(coordsArray.length);

                    for (i = 0, li = coordsArray.length; i < li; i++) {
                        height2 = this.getHeightmapValue(coordsArray[i], metanode, params);

                        arrayRes[i] = [height2, res, true];
                    }
                }
            }

            return [height, res, true, null, null, arrayRes];

        } else if (metanode /*&& metanode.id[0] == lod && !metanode.hasNavtile()*/){
            let res = this.getSurfaceHeightNodeOnly(coords, lod + 8, storeStats, lod, null, node, nodeCoords, coordsArray);

            //console.log("lod2: " + lod + " h: " + height[0]);
            //return [res[0], res[1], true, null, null, res[5]];

            return [res[0], res[1], res[2], null, null, res[5]];
        }

    }

    return [0, false, false, null, null, null];
};


MapMeasure.prototype.getSurfaceHeightNodeOnly = function(coords, lod, storeStats, statsLod, deltaSample, node, nodeCoords, coordsArray) {
    let arrayRes, height;

    const tree = this.map.tree, stats = this.map.stats;

    if (tree.surfaceSequence.length == 0) {
        return [0, true, true, null, null, null];
    }

    if (!deltaSample) {
        if (!node) {
            const result = this.getSpatialDivisionNode(coords);
            node = result[0];
            nodeCoords = result[1];
        }

        if (coordsArray) {
            arrayRes = new Array(coordsArray.length);

            for (let i = 0, li = coordsArray.length; i < li; i++) {
                arrayRes[i] = this.getSurfaceHeightNodeOnly(null, lod, storeStats, statsLod, deltaSample, node, coordsArray[i]);
            }
        }

    } else {
        node = deltaSample[0];
        nodeCoords = deltaSample[1];
    }

    if (!this.config.mapHeightLodBlend) {
        lod = Math.floor(lod);
    }

    if (!deltaSample && this.config.mapHeightNodeBlend) {
        const res1 = this.getSurfaceHeightNodeOnly(null, lod, storeStats, statsLod, [node, [nodeCoords[0], nodeCoords[1], nodeCoords[2]]]);

        if (res1[2]) {
            const sx = res1[3].ur[0] - res1[3].ll[0];
            const sy = res1[3].ur[1] - res1[3].ll[1];

            const fx = (nodeCoords[0] - res1[3].ll[0]) / sx;
            const fy = (nodeCoords[1] - res1[3].ll[1]) / sy;

            /*
            const c2 = node.getOuterCoords([nodeCoords[0] + sx, nodeCoords[1], nodeCoords[2]]);
            const c3 = node.getOuterCoords([nodeCoords[0], nodeCoords[1] + sy, nodeCoords[2]]);
            const c4 = node.getOuterCoords([nodeCoords[0] + sx, nodeCoords[1] + sy, nodeCoords[2]]);

            const res2 = this.getSurfaceHeightNodeOnly(c2, lod, storeStats, statsLod, true);
            const res3 = this.getSurfaceHeightNodeOnly(c3, lod, storeStats, statsLod, true);
            const res4 = this.getSurfaceHeightNodeOnly(c4, lod, storeStats, statsLod, true);
            */

            const res2 = this.getSurfaceHeightNodeOnly(null, lod, storeStats, statsLod, [node, [nodeCoords[0] + sx, nodeCoords[1], nodeCoords[2]]]);
            const res3 = this.getSurfaceHeightNodeOnly(null, lod, storeStats, statsLod, [node, [nodeCoords[0], nodeCoords[1] + sy, nodeCoords[2]]]);
            const res4 = this.getSurfaceHeightNodeOnly(null, lod, storeStats, statsLod, [node, [nodeCoords[0] + sx, nodeCoords[1] + sy, nodeCoords[2]]]);

            const w0 = (res1[0] + (res2[0] - res1[0])*fx);
            const w1 = (res3[0] + (res4[0] - res3[0])*fx);
            height = (w0 + (w1 - w0)*fy);

            //console.log("h: " + height + "fx: " + fx + "fy: " + fy + "s1234: " + res1[0] + " "  + res2[0] + " "  + res3[0] + " "  + res4[0]);
            /*
            if (res1[4] && res2[4] && res3[4] && res4[4]){
                console.log("h: " + height + "fx: " + fx + "fy: " + fy + "s1234: " + JSON.stringify(res1[4].id) + " "  + JSON.stringify(res2[4].id) + " "  + JSON.stringify(res3[4].id) + " "  + JSON.stringify(res4[4].id));
            }*/

            return [height, res1[1], res1[2], res1[3], null, arrayRes];
        } else {
            return [res1[0], res1[1], res1[2], res1[3], null, arrayRes];
        }
        //convert new coords to nav coords
        //blend values
    }

    if (node != null && lod !== null) {
        const root = tree.findSurfaceTile(node.id);

        const extents = {
            ll : node.extents.ll.slice(),
            ur : node.extents.ur.slice()
        };
        const params = {
            coords : nodeCoords,
            desiredLod : Math.ceil(lod),
            extents : extents,
            metanode : null,
            heightMap : null,
            heightMapExtents : null,
            traceHeight : true,
            waitingForNode : false,
            finalNode : false,
            bestHeightMap : 999
        };

        tree.traceHeight(root, params, true);

        const metanode = params.metanode;
        let center, center2;

        if (metanode != null) { // && metanode.id[0] == lod){

            if (metanode.metatile.version >= 5) {
                center = this.convert.convertCoords(metanode.diskPos, 'physical', 'navigation');
            } else {
                if (metanode.bbox.maxSize < 8000) { // use bbox only when bbox is reasonable small
                    center = metanode.bbox.center();
                    center = this.convert.convertCoords(center, 'physical', 'navigation');
                } else {
                    center = [0,0,nodeCoords[2]];
                }
            }

            //console.log("lod2: " + lod + " nodelod: " + metanode.id[0] + " h: " + center[2]/1.55);

            if (storeStats) {
                stats.heightClass = 1;
                stats.heightLod = statsLod;
                stats.heightNode = metanode.id[0];
            }

            if (this.config.mapHeightLodBlend && metanode.id[0] > 0 &&
                params.parent && params.parent.metanode) {

                if (params.parent.metanode.metatile.version >= 5) {
                    center2 = this.convert.convertCoords(params.parent.metanode.diskPos, 'physical', 'navigation');
                } else {
                    if (params.parent.metanode.bbox.maxSize < 8000) { // use bbox only when bbox is reasonable small
                        center2 = this.convert.convertCoords(params.parent.metanode.bbox.center(), 'physical', 'navigation');
                    } else {
                        center2 = [0,0,nodeCoords[2]];
                    }
                }

                const factor = lod - Math.floor(lod);
                height = center[2] + (center2[2] - center[2]) * factor;

                //extetnts = params.extents;
                //return [height, true, true, params.extents, metanode, arrayRes];

                return [height, (metanode.id[0] >= Math.floor(lod) || params.finalNode),
                        (!params.waitingForNode || metanode.id[0] >= Math.floor(lod) || params.finalNode),
                        params.extents, metanode, arrayRes];


                //console.log("lod: " + lod + " h1: " + center[2] + " h2: " + center2[2] + " h: " + height);
            } else {
                return [center[2], (metanode.id[0] >= Math.floor(lod) || params.finalNode),
                        (!params.waitingForNode || metanode.id[0] >= Math.floor(lod) || params.finalNode),
                        params.extents, metanode, arrayRes];

                //return [center[2], true, true, params.extents, metanode, arrayRes];
            }
        }

        /*
        if (metanode != null) {
            const height = metanode.minHeight + (metanode.maxHeight - metanode.minHeight) * 0.5;
            return [height, metanode.id[0] >= lod, true];
        }*/
    }

    //coords
    //console.log("lod3: " + lod + " h: 0");

    if (storeStats) {
        stats.heightClass = 0;
        stats.heightLod = statsLod;
        stats.heightNode = 0;
    }


    return [0, false, false, null, null, arrayRes];
};


MapMeasure.prototype.getHeightmapValue = function(coords, node, params) {
    const heightMap = params.heightMap;
    const data = heightMap.getImageData();
    const dataExtents = heightMap.getImageExtents();
    const mapExtents = params.heightMapExtents;

    //relative tile coords
    let x = coords[0] - mapExtents.ll[0];
    //const y = nodeCoords[1] - mapExtents.ll[1];
    let y = mapExtents.ur[1] - coords[1];

    const maxX = (dataExtents[0]-1);
    const maxY = (dataExtents[1]-1);

    //data coords
    x = (maxX) * (x / (mapExtents.ur[0] - mapExtents.ll[0]));
    y = (maxY) * (y / (mapExtents.ur[1] - mapExtents.ll[1]));

    if (x < 0) { x = 0; }
    if (y < 0) { y = 0; }
    if (x > maxX) { x = maxX; }
    if (y > maxY) { y = maxY; }

    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const index = iy * dataExtents[0];
    const index2 = (iy == maxY) ? index : index + dataExtents[0];
    const ix2 = (ix == maxX) ? ix : ix + 1;
    const h00 = data[(index + ix)*4];
    const h01 = data[(index + ix2)*4];
    const h10 = data[(index2 + ix)*4];
    const h11 = data[(index2 + ix2)*4];
    const w0 = (h00 + (h01 - h00)*fx);
    const w1 = (h10 + (h11 - h10)*fx);
    let height = (w0 + (w1 - w0)*fy);

    height = node.minHeight + (node.maxHeight - node.minHeight) * (height/255);

    return height;
};


MapMeasure.prototype.getSpatialDivisionNode = function(coords) {
    const nodes = this.map.referenceFrame.getSpatialDivisionNodes();

    let bestNode = null;
    let bestLod = -1;
    let bestCoords = [0,0];

    for (let i = 0, li = nodes.length; i < li; i++) {
        const node = nodes[i];
        const nodeCoords = node.getInnerCoords(coords);
        const extents = node.extents;

        if (nodeCoords[0] >= extents.ll[0] && nodeCoords[0] <= extents.ur[0] &&
            nodeCoords[1] >= extents.ll[1] && nodeCoords[1] <= extents.ur[1]) {

            if (node.id[0] > bestLod) {
                bestNode = node;
                bestLod = node.id[0];
                bestCoords = nodeCoords;
            }
        }
    }

    return [bestNode, bestCoords];
};


MapMeasure.prototype.getSpatialDivisionNodeAndExtents = function(id) {
    const nodes = this.map.referenceFrame.getSpatialDivisionNodes();

    let bestNode = null;
    let bestNodeCoords = [0,0], shift;

    for (let i = 0, li = nodes.length; i < li; i++) {
        const node = nodes[i];

        //has division node this tile node
        shift = id[0] - node.id[0];

        if (shift >= 0) {
            const x = id[1] >> shift;
            const y = id[2] >> shift;

            if (node.id[1] == x && node.id[2] == y) {
                bestNode = node;
                bestNodeCoords = [node.id[1] << shift, node.id[2] << shift];
            }
        }
    }

    if (!bestNode) {
        return null;
    }

    shift = id[0] - bestNode.id[0];

    const factor = 1.0 / Math.pow(2, shift);
    const ur = bestNode.extents.ur;
    const ll = bestNode.extents.ll;

    //extents ll ur but tiles are ul lr!!!!

    const dx = (ur[0] - ll[0]) * factor;
    const dy = (ll[1] - ur[1]) * factor;

    const nx = id[1] - bestNodeCoords[0];
    const ny = id[2] - bestNodeCoords[1];

    return [bestNode, [[ll[0] + dx * nx, ur[1] + dy * ny], [ll[0] + dx * (nx+1), ur[1] + dy * (ny+1)] ]];
};


MapMeasure.prototype.getSpatialDivisionNodeFromId = function(id) {
    const shift = id[0] - this.maxDivisionNodeDepth;
    const nx = id[1] >> shift;
    const ny = id[2] >> shift;

    return this.map.referenceFrame.nodesMap['' + this.maxDivisionNodeDepth + '.'  + nx + '.' + ny];
};


MapMeasure.prototype.getSpatialDivisionNodeAndExtents2 = function(id, res, divisionNode) {
    if (!divisionNode) {
        return [null, 0,0,0,0];
    }

    const shift = id[0] - divisionNode.id[0];
    const factor = 1.0 / Math.pow(2, shift);
    const ur = divisionNode.extents.ur;
    const ll = divisionNode.extents.ll;

    //extents ll ur but tiles are ul lr!!!!

    const dx = (ur[0] - ll[0]) * factor;
    const dy = (ll[1] - ur[1]) * factor;

    const nx = id[1] - (divisionNode.id[1] << shift);
    const ny = id[2] - (divisionNode.id[2] << shift);

    res[0] = divisionNode;
    res[1] = ll[0] + dx * nx;
    res[2] = ur[1] + dy * ny;
    res[3] = ll[0] + dx * (nx+1);
    res[4] = ur[1] + dy * (ny+1);
};


MapMeasure.prototype.getSpatialDivisionNodeDepths = function() {
    const nodes = this.map.referenceFrame.getSpatialDivisionNodes();
    let maxLod = -1;
    let minLod = Number.MAX_VALUE;

    for (let i = 0, li = nodes.length; i < li; i++) {
        const node = nodes[i];

        if (node.id[0] < minLod) {
            minLod = node.id[0];
        }

        if (node.id[0] > maxLod) {
            maxLod = node.id[0];
        }
    }

    return [minLod, maxLod];
};


MapMeasure.prototype.getOptimalHeightLodBySampleSize = function(coords, desiredSamplesSize) {
    const result = this.getSpatialDivisionNode(coords);
    const node = result[0];

    if (node != null) {
        const nodeLod = node.id[0];
        const nodeExtent = node.extents.ur[1] - node.extents.ll[1];

        let lod = Math.log(nodeExtent / desiredSamplesSize) / Math.log(2);
        //lod = Math.round(lod) - 8 + nodeLod;
        lod = lod - 8 + nodeLod;

        return Math.max(0, lod);
    }

    return null;
};


MapMeasure.prototype.getOptimalHeightLod = function(coords, viewExtent, desiredSamplesPerViewExtent) {
    const result = this.getSpatialDivisionNode(coords);
    const node = result[0];

    if (node != null) {
        const nodeLod = node.id[0];
        const nodeExtent = node.extents.ur[1] - node.extents.ll[1];

        let lod = Math.log((desiredSamplesPerViewExtent * nodeExtent) / viewExtent) / Math.log(2);
        //lod = Math.round(lod) - 8 + nodeLod;
        lod = lod - 8 + nodeLod;

        return Math.max(0, lod);
    }

    return null;
};


MapMeasure.prototype.getDistance = function(coords, coords2, includingHeight, usePublic) {
    const sourceSrs = usePublic ? this.publicSrs : this.navigationSrs;
    const p1 = this.getPhysicalSrs.convertCoordsFrom(coords,  sourceSrs);
    const p2 = this.getPhysicalSrs.convertCoordsFrom(coords2, sourceSrs);
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dz = p2[2] - p1[2];

    const dd = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const navigationSrsInfo = this.navigationSrsInfo;

    if (!this.isProjected) {
        const geod = this.getGeodesic(); //new GeographicLib["Geodesic"]["Geodesic"](navigationSrsInfo["a"],
                                       //                   (navigationSrsInfo["a"] / navigationSrsInfo["b"]) - 1.0);

        const r = geod.Inverse(coords[1], coords[0], coords2[1], coords2[0]);

        if (r.s12 > (navigationSrsInfo['a'] * 2 * Math.PI) / 4007.5) { //aprox 10km for earth
            if (includingHeight) {
                return [Math.sqrt(r.s12*r.s12 + dz*dz), -r.azi1, dd];
            } else {
                return [r.s12, -r.azi1, dd];
            }
        } else {
            if (includingHeight) {
                return [Math.sqrt(dx*dx + dy*dy + dz*dz), -r.azi1, dd];
            } else {
                return [r.s12, -r.azi1, dd];
            }
        }

    } else {
        return [Math.sqrt(dx*dx + dy*dy), math.degrees(Math.atan2(dx, dy)), dd];
    }
};


MapMeasure.prototype.getGeodesic = function() {
    const navigationSrsInfo = this.navigationSrsInfo;

    const geodesic = new GeographicLib.Geodesic.Geodesic(navigationSrsInfo['a'],
                                                      (navigationSrsInfo['a'] / navigationSrsInfo['b']) - 1.0);

    return geodesic;
};


MapMeasure.prototype.getAzimuthCorrection = function(coords, coords2) {
    if (!this.getNavigationSrs().isProjected()) {
        const geodesic = this.getGeodesic();
        const r = geodesic.Inverse(coords[0], coords[1], coords2[0], coords2[1]);
        let ret = (r.azi1 - r.azi2);
        if (isNaN(ret)) {
            ret = 0;
        }
        return ret;
    }
    return 0;
};


MapMeasure.prototype.getNED = function(coords) {
    const centerCoords = this.convert.convertCoords([coords[0], coords[1], 0], 'navigation', 'physical');
    let upCoords, rightCoords;

    if (this.isProjected) {
        upCoords = this.convert.convertCoords([coords[0], coords[1] + 100, 0], 'navigation', 'physical');
        rightCoords = this.convert.convertCoords([coords[0] + 100, coords[1], 0], 'navigation', 'physical');
    } else {
        const cy = (coords[1] + 90) - 0.0001;
        const cx = (coords[0] + 180) + 0.0001;

        if (cy < 0 || cx > 180) { //if we are out of bounds things start to be complicated
            const geodesic = this.getGeodesic();

            //up coords
            let r = geodesic.Direct(coords[1], coords[0], 0, -100);
            upCoords = this.convert.convertCoords([r.lon2, r.lat2, 0], 'navigation', 'physical');

            //right coords
            r = geodesic.Direct(coords[1], coords[0], 90, 100);
            rightCoords = this.convert.convertCoords([r.lon2, r.lat2, 0], 'navigation', 'physical');
        } else {
            // substraction instead of addition is probably case of complicated view matrix calculation
            upCoords = this.convert.convertCoords([coords[0], coords[1] - 0.0001, 0], 'navigation', 'physical');
            rightCoords = this.convert.convertCoords([coords[0] + 0.0001, coords[1], 0], 'navigation', 'physical');
        }
    }

    const up = [upCoords[0] - centerCoords[0],
        upCoords[1] - centerCoords[1],
        upCoords[2] - centerCoords[2]];

    const right = [rightCoords[0] - centerCoords[0],
        rightCoords[1] - centerCoords[1],
        rightCoords[2] - centerCoords[2]];

    const dir = [0,0,0];
    vec3.normalize(up);
    vec3.normalize(right);
    vec3.cross(up, right, dir);
    vec3.normalize(dir);

    return {
        east  : right,
        direction : up,
        north : dir
    };
};

MapMeasure.prototype.getNewNED = function(coords, returnMatrix) {
    const centerCoords = this.convert.convertCoords([coords[0], coords[1], 0], 'navigation', 'physical');
    let upCoords, rightCoords;

    if (this.isProjected) {
        upCoords = this.convert.convertCoords([coords[0], coords[1] + 100, 0], 'navigation', 'physical');
        rightCoords = this.convert.convertCoords([coords[0] + 100, coords[1], 0], 'navigation', 'physical');
    } else {
        //get NED for latlon coordinates
        //http://www.mathworks.com/help/aeroblks/directioncosinematrixeceftoned.html
        /*
        const coords = this.position.getCoords();
        const lon = math.radians(coords[0]);
        const lat = math.radians(coords[1]);

        //NED vectors for sphere
        const east = [-Math.sin(lat)*Math.cos(lon), -Math.sin(lat)*Math.sin(lon), Math.cos(lat)];
        const direction = [-Math.sin(lon), Math.cos(lon), 0];
        const north = [-Math.cos(lat)*Math.cos(lon), -Math.cos(lat)*Math.sin(lon), -Math.sin(lat)];

        north = vec3.negate(north);
        east  = vec3.negate(east);

        //get elipsoid factor
        const navigationSrsInfo = this.getNavigationSrs().getSrsInfo();
        const factor = navigationSrsInfo["b"] / navigationSrsInfo["a"];

        //flaten vectors
        north[2] *= factor;
        east[2] *= factor;
        direction[2] *= factor;

        //normalize vectors
        north = vec3.normalize(north);
        east  = vec3.normalize(east);
        direction = vec3.normalize(direction);
        */

        const cy = (coords[1] + 90) + 0.0001;
        const cx = (coords[0] + 180) + 0.0001;

        if (cy < 0 || cx > 180) { //if we are out of bounds things start to be complicated
            const geodesic = this.getGeodesic();

            //up coords
            let r = geodesic.Direct(coords[1], coords[0], 0, -100);
            upCoords = this.convert.convertCoords([r.lon2, r.lat2, 0], 'navigation', 'physical');

            //right coords
            r = geodesic.Direct(coords[1], coords[0], 90, -100);
            rightCoords = this.convert.convertCoords([r.lon2, r.lat2, 0], 'navigation', 'physical');
        } else {
            // substraction instead of addition is probably case of complicated view matrix calculation
            upCoords = this.convert.convertCoords([coords[0], coords[1] + 0.0001, 0], 'navigation', 'physical');
            rightCoords = this.convert.convertCoords([coords[0] + 0.0001, coords[1], 0], 'navigation', 'physical');
        }
    }

    const up = [upCoords[0] - centerCoords[0],
        upCoords[1] - centerCoords[1],
        upCoords[2] - centerCoords[2]];

    const right = [rightCoords[0] - centerCoords[0],
        rightCoords[1] - centerCoords[1],
        rightCoords[2] - centerCoords[2]];

    const dir = [0,0,0];
    vec3.normalize(up);
    vec3.normalize(right);
    vec3.cross(up, right, dir);
    vec3.normalize(dir);

    if (returnMatrix) {
        const east = right;
        const direction = up;
        const north = dir;

        return [
            east[0], east[1], east[2], 0,
            north[0], north[1], north[2], 0,
            direction[0], direction[1], direction[2], 0,
            0, 0, 0, 1
        ];
    }

    return {
        east  : right,
        direction : up,
        north : dir
    };
};


MapMeasure.prototype.getNewNED2 = function(coords, returnMatrix) {
    const centerCoords = this.convert.convertCoords([coords[0], coords[1], 0], 'navigation', 'physical');
    let upCoords, rightCoords;

    if (this.isProjected) {
        upCoords = this.convert.convertCoords([coords[0], coords[1] + 100, 0], 'navigation', 'physical');
        rightCoords = this.convert.convertCoords([coords[0] + 100, coords[1], 0], 'navigation', 'physical');
    } else {

        const cy = (coords[1] + 90) + 0.0001;
        const cx = (coords[0] + 180) + 0.0001;

        if (cy < 0 || cx > 180) { //if we are out of bounds things start to be complicated
            const geodesic = this.getGeodesic();

            //up coords
            let r = geodesic.Direct(coords[1], coords[0], 0, -100);
            upCoords = this.convert.convertCoords([r.lon2, r.lat2, 0], 'navigation', 'physical');

            //right coords
            r = geodesic.Direct(coords[1], coords[0], 90, -100);
            rightCoords = this.convert.convertCoords([r.lon2, r.lat2, 0], 'navigation', 'physical');
        } else {
            // substraction instead of addition is probably case of complicated view matrix calculation
            upCoords = this.convert.convertCoords([coords[0], coords[1] + 0.0001, 0], 'navigation', 'physical');
            rightCoords = this.convert.convertCoords([coords[0] + 0.0001, coords[1], 0], 'navigation', 'physical');
        }
    }

    const up = [upCoords[0] - centerCoords[0],
        upCoords[1] - centerCoords[1],
        upCoords[2] - centerCoords[2]];

    const right = [rightCoords[0] - centerCoords[0],
        rightCoords[1] - centerCoords[1],
        rightCoords[2] - centerCoords[2]];

    const dir = [0,0,0];
    vec3.normalize(up);
    vec3.normalize(right);
    vec3.cross(up, right, dir);
    vec3.normalize(dir);

    if (returnMatrix) {
        const east = right;
        const direction = up;
        const north = dir;

        return [
            east[0], east[1], east[2], 0,
            north[0], north[1], north[2], 0,
            direction[0], direction[1], direction[2], 0,
            0, 0, 0, 1
        ];
    }

    return {
        east  : right,
        direction : up,
        north : dir
    };
};


//TODO: use getNewNED
MapMeasure.prototype.getPositionCameraInfo = function(position, projected, clampTilt) {
    //const position = [0,0,0];
    const orientation = position.getOrientation();
    const distance = position.getViewDistance();

    let roty = orientation[1]
    if (!this.config.mapNoTiltConstraint)
    {
        if (clampTilt) { //used for street labels
            orientation[1] = math.clamp(orientation[1], -89.0, 90.0);
        }

        roty = math.clamp(orientation[1], -89.5, 89.5);
    }

    let tmpMatrix = mat4.create();
    mat4.multiply(math.rotationMatrix(2, math.radians(-orientation[0])), math.rotationMatrix(0, math.radians(roty)), tmpMatrix);
    let orbitPos, ned, north, east, direction, spaceMatrix, rotationMatrix;
    let east2, north2, direction2, dir, up, right;

    if (position.getViewMode() == 'obj') {
        orbitPos = [0, -distance, 0];
        mat4.multiplyVec3(tmpMatrix, orbitPos);
    } else {
        orbitPos = [0, 0, 0];
    }

    //this.cameraVector = [0, 0, 1];
    //mat4.multiplyVec3(this.updateCameraMatrix, this.cameraVector);

    const ret = {
        orbitCoords : null,
        distance : distance,
        rotMatrix : null,
        vector : null,
        orbitHeight : orbitPos[2]
    };

    let coords = position.getCoords();

    if (projected) {

        tmpMatrix = mat4.create();
        mat4.multiply(math.rotationMatrix(0, math.radians(-roty - 90.0)), math.rotationMatrix(2, math.radians(orientation[0])), tmpMatrix);

        ned = this.getNED(coords);
        north = ned.north;
        east  = ned.east;
        direction = ned.direction;

        spaceMatrix = [
            east[0], east[1], east[2], 0,
            direction[0], direction[1], direction[2], 0,
            north[0], north[1], north[2], 0,
            0, 0, 0, 1
        ];

        east2  = [1,0,0];
        direction2 = [0,1,0];
        north2 = [0,0,1];

        dir = [1,0,0];
        up = [0,0,-1];
        right = [0,0,0];
        vec3.cross(dir, up, right);

        //rotate vectors according to eulers
        mat4.multiplyVec3(tmpMatrix, north2);
        mat4.multiplyVec3(tmpMatrix, east2);
        mat4.multiplyVec3(tmpMatrix, direction2);

        mat4.multiplyVec3(tmpMatrix, dir);
        mat4.multiplyVec3(tmpMatrix, up);
        mat4.multiplyVec3(tmpMatrix, right);

        let t = 0;
        t = dir[0]; dir[0] = dir[1]; dir[1] = t;
        t = up[0]; up[0] = up[1]; up[1] = t;
        t = right[0]; right[0] = right[1]; right[1] = t;

        dir[2] = -dir[2];
        up[2] = -up[2];
        right[2] = -right[2];

        //get rotation matrix
        rotationMatrix = [
            east2[0], east2[1], east2[2], 0,
            direction2[0], direction2[1], direction2[2], 0,
            north2[0], north2[1], north2[2], 0,
            0, 0, 0, 1
        ];

        ret.vector = vec3.normalize([-orbitPos[0], -orbitPos[1], -orbitPos[2]]);
        ret.vector2 = ret.vector; //vector2 is probably hack for tree.js bboxVisible

        ret.orbitCoords = orbitPos;
        ret.rotMatrix = rotationMatrix;

    } else { //geographics


        ned = this.getNED(coords);
        north = ned.north;
        east  = ned.east;
        direction = ned.direction;


        spaceMatrix = [
            east[0], east[1], east[2], 0,
            direction[0], direction[1], direction[2], 0,
            north[0], north[1], north[2], 0,
            0, 0, 0, 1
        ];

        const localRotMatrix = mat4.create();
        mat4.multiply(math.rotationMatrix(0, math.radians(-roty - 90.0)), math.rotationMatrix(2, math.radians(orientation[0])), localRotMatrix);

        east2  = [1,0,0];
        direction2 = [0,1,0];
        north2 = [0,0,1];

        coords = position.getCoords();
        const latlonMatrix = mat4.create();
        mat4.multiply(math.rotationMatrix(0, math.radians((coords[1] - 90.0))), math.rotationMatrix(2, math.radians((-coords[0]-90))), latlonMatrix);

        //rotate vectors according to latlon
        mat4.multiplyVec3(latlonMatrix, north2);
        mat4.multiplyVec3(latlonMatrix, east2);
        mat4.multiplyVec3(latlonMatrix, direction2);


        spaceMatrix = [
            east2[0], east2[1], east2[2], 0,
            direction2[0], direction2[1], direction2[2], 0,
            north2[0], north2[1], north2[2], 0,
            0, 0, 0, 1
        ];

        right = [1,0,0];
        dir = [0,1,0];
        up = [0,0,1];

        mat4.multiplyVec3(spaceMatrix, dir);
        mat4.multiplyVec3(spaceMatrix, up);
        mat4.multiplyVec3(spaceMatrix, right);

        mat4.multiplyVec3(localRotMatrix, right);
        mat4.multiplyVec3(localRotMatrix, dir);
        mat4.multiplyVec3(localRotMatrix, up);

        rotationMatrix = [
            right[0], right[1], right[2], 0,
            dir[0], dir[1], dir[2], 0,
            up[0], up[1], up[2], 0,
            0, 0, 0, 1
        ];

        //get orbit pos
        spaceMatrix = mat4.inverse(spaceMatrix);
        mat4.multiplyVec3(spaceMatrix, orbitPos);

        ret.vector = [-rotationMatrix[2], -rotationMatrix[6], -rotationMatrix[10]];

    }

    ret.orbitCoords = orbitPos;
    ret.rotMatrix = rotationMatrix;
    return ret;
};


export default MapMeasure;
