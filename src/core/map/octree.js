
import {vec3 as vec3_/*, mat4 as mat4_*/} from '../utils/matrix';
import BBox_ from '../renderer/bbox';
//import {math as math_} from '../utils/math';
//import {utils as utils_} from '../utils/utils';
import {utilsUrl as utilsUrl_} from '../utils/url';
import MapResourceNode_ from './resource-node';
import MapGeodataImportVTSTree_ from './geodata-import/vts-tree.js';

//get rid of compiler mess
const vec3 = vec3_; // mat4 = mat4_;
const BBox = BBox_;
//const math = math_;
//const utils = utils_;
const MapResourceNode = MapResourceNode_;
const MapGeodataImportVTSTree = MapGeodataImportVTSTree_;

const utilsUrl = utilsUrl_;

const localTest = false;

const MapOctree = function(id, bbox, origin, gpu, renderer) {
    this.id = id;
    this.bbox = null;
    this.origin = origin || [0,0,0];
    this.gpu = gpu;
    this.gl = gpu.gl;
    this.renderer = renderer;
    this.mv = new Float32Array(16);
    this.mvp = new Float32Array(16);
    this.loadMode = 0;
    //this.geFactor = 1/38;
    this.geFactor = 1/16;
    this.geFactor2 = 0.5;
    this.geNormalized = false;

    if (bbox != null && bbox[0] != null && bbox[1] != null) {
        this.bbox = new BBox(bbox[0][0], bbox[0][1], bbox[0][2], bbox[1][0], bbox[1][1], bbox[1][2]);
    }

    this.binFiles = [];

    this.size = 0;
};

//destructor

MapOctree.prototype.kill = function() {

    //TODO: remove resources

    this.binFiles = null;

};


MapOctree.prototype.getSize = function() {
    return this.size;
};


MapOctree.prototype.getZbufferOffset = function() {
    return this.size;
};

MapOctree.prototype.getNodeLOD = function(node) {
    let lod = 0;

    while(node.parent) {
        lod++;
        node = node.parent;
    }

    return lod;
};


MapOctree.prototype.getNodeTexelSize = function(node, screenPixelSize) {
    const pos = node.volume.center;
    const cameraPos = this.renderer.cameraPosition;
    let d = vec3.length(
        [pos[0] - cameraPos[0],
         pos[1] - cameraPos[1],
         pos[2] - cameraPos[2]]);

    d -= node.volume.radius;

    if (d <= 0) {
        return [Number.POSITIVE_INFINITY, 0.1];
    }

    return [this.renderer.camera.scaleFactor2(d) * screenPixelSize, d];
};


MapOctree.prototype.drawNodeVolume = function(points, color, node) {
    const renderer = this.renderer;

    if (this.map.renderer.device === VTS_DEVICE_THREE) {

        if (!node.helper) {
            node.helper = renderer.bboxMesh2.clone();
        }

        const buffer = this.map.draw.bboxBuffer;
        const camPos = this.map.camera.position;

        for (let i = 0, li = 8*3, j = 0; i < li; i+=3, j++) {
            buffer[i] = points[j][0] - camPos[0];
            buffer[i+1] = points[j][1] - camPos[1];
            buffer[i+2] = points[j][2] - camPos[2];
        }

        node.helper.onBeforeRender = renderer.bboxMaterial.userData.onRender.bind(node.helper, buffer.slice());

        renderer.addSceneObject(node.helper);

    } else {

        drawLineString({
            points : [points[0], points[1], points[2], points[3], points[0],
                      points[4], points[5], points[6], points[7], points[4]
            ],
            size : 1.0,
            color : color,
            depthTest : false,
            screenSpace : false, //switch to physical space
            blend : false
            }, renderer);

        drawLineString({
            points : [points[1], points[5]],
            size : 1.0,
            color : color,
            depthTest : false,
            screenSpace : false, //switch to physical space
            blend : false
            }, renderer);

        drawLineString({
            points : [points[2], points[6]],
            size : 1.0,
            color : color,
            depthTest : false,
            screenSpace : false, //switch to physical space
            blend : false
            }, renderer);

        drawLineString({
            points : [points[3], points[7]],
            size : 1.0,
            color : color,
            depthTest : false,
            screenSpace : false, //switch to physical space
            blend : false
            }, renderer);

    }

}

MapOctree.prototype.drawNode = function(node, noSkip, splitMask, splitSpace) {
    const renderer = this.renderer;
    const debug = this.map.draw.debug;
    const jobs = node.jobs;

    renderer.drawnNodes++;

    if (debug.drawNBBoxes) {
        const points = node.volume.points;
        let color = [255,0,255,255];

        if (node.tileset) {
            color = [0,255,0,255];
        }

        if (noSkip) {
            color = [255,255,0,255];
        }

        if (debug.drawSpaceBBox && node.volume2) {
            this.drawNodeVolume(node.volume2.points, [255,0,0,255], node);
        } else {
            this.drawNodeVolume(points, color, node);
        }

        const cameraPos = this.renderer.cameraPosition;
        let pos = node.volume.center;

        const shift = [cameraPos[0] - pos[0],
               cameraPos[1] - pos[1],
               cameraPos[2] - pos[2]];

        vec3.normalize(shift);
        vec3.scale(shift, node.volume.radius);

        pos = [pos[0]+shift[0]-cameraPos[0],
               pos[1]+shift[1]-cameraPos[1],
               pos[2]+shift[2]-cameraPos[2]];

        pos = this.renderer.core.getRendererInterface().getCanvasCoords(
            pos,
             this.renderer.camera.getMvpMatrix());

        let factor = 2, text;

        if (debug.drawLods) {
            text = '' + node.lod;//this.getNodeLOD(node);
            renderer.gpu.draw.drawText(Math.round(pos[0]-renderer.gpu.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]-4*factor), 4*factor, text, [1,0,0,1], pos[2]);
        }

        if (debug.drawOctants) {
            text = '' + node.index;//this.getNodeLOD(node);
            renderer.gpu.draw.drawText(Math.round(pos[0]-renderer.gpu.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+3*factor), 4*factor, text, [1,1,0,1], pos[2]);
        }

        if (debug.drawDistance) {
            const res = this.getNodeTexelSize(node, node.precision * renderer.curSize[0]);
            text = '' + res[1].toFixed(2) + ' ' + res[0].toFixed(2) + ' ' + node.precision.toFixed(3);
            renderer.gpu.draw.drawText(Math.round(pos[0]-renderer.gpu.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+17*factor), 4*factor, text, [0.5,0.5,1,1], pos[2]);
        }

        if (debug.drawFaceCount) {
            const mesh = (jobs[0] && jobs[0].type == VTS_JOB_MESH) ? jobs[0].mesh : null;
            if (mesh) {
                text = '' + mesh.faces + ' - ' + mesh.submeshes.length;
                renderer.gpu.draw.drawText(Math.round(pos[0]-renderer.gpu.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+10*factor), 4*factor, text, [0,1,0,1], pos[2]);
            }
        }

        if (debug.drawResources && jobs[0]) {
            text = '' + (this.getGpuSize(jobs[0])/(1024*1024)).toFixed(2) + 'MB';
            renderer.gpu.draw.drawText(Math.round(pos[0]-renderer.gpu.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+3*factor), 4*factor, text, [0,1,0,1], pos[2]);
        }

        if (debug.drawSurfaces && jobs[0]) {
            text = '';

            const mesh = (jobs[0] && jobs[0].type == VTS_JOB_MESH) ? jobs[0].mesh : null;
            if (mesh) {
                let path = mesh.mapLoaderUrl;
                path = path.replace('.mesh', '');
                const parts = path.split('/');

                if (parts.length > 1) {
                    text = parts[parts.length-2] + '/' + parts[parts.length-1];
                } else {
                    text = parts[0];
                }
            }

            renderer.gpu.draw.drawText(Math.round(pos[0]-renderer.gpu.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+10*factor), 4*factor, text, [0,1,0,1], pos[2]);
        }

        if (debug.drawTextureSize) {
            const mesh = (jobs[0] && jobs[0].type == VTS_JOB_MESH) ? jobs[0].mesh : null;
            if (mesh) {
                const submeshes = mesh.submeshes;
                for (let i = 0, li = submeshes.length; i < li; i++) {

                    if (submeshes[i].internalUVs) {
                        let texture;
                        if (jobs[0].direct) {
                            texture = submeshes[i].texture;
                        } else {
                            texture = jobs[0].textures[i];
                        }

                        if (texture) {
                            const gpuTexture = texture.getGpuTexture();
                            if (gpuTexture) {
                                text = '[' + i + ']: ' + gpuTexture.width + ' x ' + gpuTexture.height;
                                renderer.gpu.draw.drawText(Math.round(pos[0]-renderer.gpu.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+(17+i*4*2)*factor), 4*factor, text, [1,1,1,1], pos[2]);
                            }
                        }
                    } else {
                        text = '[' + i + ']: 256 x 256';
                        renderer.gpu.draw.drawText(Math.round(pos[0]-renderer.gpu.draw.getTextSize(4*factor, text)*0.5), Math.round(pos[1]+(17+i*4*2)*factor), 4*factor, text, [1,1,1,1], pos[2]);
                    }
                }
            }
        }
    }

    //debug.drawNBBoxes = true;

    if (!noSkip) {
        //return true;
    }

    for (let i = 0, li = jobs.length; i < li; i++) {
        const job = jobs[i];

        switch(job.type) {

            case VTS_JOB_MESH:
                if (this.isMeshReady(job, null, null, null, true, node)) {
                    this.drawMesh(job, node, splitMask, splitSpace);
                }
                break;

            case VTS_JOB_POINTCLOUD:
                if (job.pointcloud.isReady()) {
                    job.pointcloud.draw(this.renderer.cameraPosition);
                }
                break;
        }

    }

};

// eslint-disable-next-line
MapOctree.prototype.isMeshReady = function(job, doNotLoad, priority, skipGpu, skipStats, node) {
    const mesh = job.mesh;
    const submeshes = mesh.submeshes;
    const stats = this.map.stats;
    let ready = true;

    //console.log('' + stats.gpuNeeded + '  ' + job.texturePath);

    if (mesh.isReady(doNotLoad, priority, skipGpu)) {
        if (!skipStats) {
            stats.gpuNeeded += mesh.gpuSize;

            //if (job.texturePath) {
                //console.log('--' + node.lod + '--' + job.texturePath + '    ' + stats.gpuNeeded);
            //}
        }

        for (let i = 0, li = submeshes.length; i < li; i++) {
            const submesh = submeshes[i];

            if (submesh.internalUVs) {

                let texture;

                if (job.direct) {
                    if (!submesh.texture) {
                        let path = mesh.mapLoaderUrl;
                        path = path.replace('.mesh', '-' + i + '.jpg');
                        const resource = new MapResourceNode(this.renderer.core.map, null, null);
                        submesh.texture = resource.getTexture(path, VTS_TEXTURETYPE_COLOR, null, null, null /*tile*/, true);
                    }

                    texture = submesh.texture;
                } else {
                    if (!job.texturePath) {
                        continue;
                    }

                    if (!job.textures[i]) {
                        const path = job.texturePath + '-' + i + '.jpg';
                        job.textures[i] = job.resources.getTexture(path, VTS_TEXTURETYPE_COLOR, null, null, null /*tile*/, true);
                    }

                    texture = job.textures[i];
                }


                if (!texture.isReady(doNotLoad, priority, skipGpu)) {
                    ready = false;
                }

                if (!skipStats) {
                    stats.gpuNeeded += texture.getGpuSize();
                }
            }
        }

    } else {
        ready = false;
    }

    //console.log('' + stats.gpuNeeded + '  finish');

    return ready;
}


MapOctree.prototype.getGpuSize = function(job) {
    const mesh = job.mesh;

    if (!mesh) return 0;

    const submeshes = mesh.submeshes;
    let size = 0;
    let doNotLoad = true;

    if (mesh.isReady(doNotLoad)) {
        size += mesh.gpuSize;

        for (let i = 0, li = submeshes.length; i < li; i++) {
            const submesh = submeshes[i];

            if (submesh.internalUVs && job.texturePath) {
                if (job.textures[i]) {
                    size += job.textures[i].getGpuSize();
                }
            }
        }
    }

    return size;
}


MapOctree.prototype.drawMesh = function(job ,node, splitMask, splitSpace) {
    const mesh = job.mesh;
    const submeshes = mesh.submeshes;
    const cameraPos = this.renderer.cameraPosition;

    for (let i = 0, li = submeshes.length; i < li; i++) {
        const submesh = submeshes[i];

        if (job.direct) {
            if (submesh.texture) {
                mesh.drawSubmesh(cameraPos, i, submesh.texture, this.drawChannel == 1 ? VTS_MATERIAL_DEPTH : VTS_MATERIAL_INTERNAL /*type*/, null /*alpha*/, null /*layer*/, null /*surface*/,  splitMask, splitSpace);
            }
        } else {
            if (job.textures[i]) {
                mesh.drawSubmesh(cameraPos, i, job.textures[i], this.drawChannel == 1 ? VTS_MATERIAL_DEPTH : VTS_MATERIAL_INTERNAL /*type*/, null /*alpha*/, null /*layer*/, null /*surface*/,  splitMask, splitSpace);
            }
        }
    }
}

MapOctree.prototype.generateNode = function(index, file, lod, cindex, texelSize, points, center, radius, hasMesh) {

    let jobs = [];

    if (hasMesh) {

        if (file.vtsFormat) {
            for (let i = 0, li = file.features.length; i < li; i++) {
                const feature = file.features[i];

                switch(feature.type) {
                    case 1: //mesh
                        jobs.push({
                            type: VTS_JOB_MESH,
                            mesh: feature.resources[index],
                            direct: true
                        });
                        break;

                    case 2: //point cloud
                        jobs.push({
                            type: VTS_JOB_POINTCLOUD,
                            pointcloud: feature.resources[index],
                            direct: true
                        });
                        break;
                }
            }
        } else {
            jobs = [
                {
                    type: VTS_JOB_MESH,
                    mesh: file.meshes[index],
                    direct: true
                }
            ];
        }
    }

    const node = {
        lod : lod,
        index: cindex,
        precision: texelSize,
        volume: {
            points: points,
            center: center,
            radius: radius,
        },
        jobs: jobs
    };

    return node;
}



MapOctree.prototype.traverseBinNode = function(cindex, points, center, radius, texelSize, lod, index, file, visible, isready, skipRender) {

    const renderer = this.renderer;
    const cameraPos = this.renderer.cameraPosition;

    if (!visible && !renderer.camera.pointsVisible2(points, cameraPos)) {
        return;
    }

    let tree = file.tree;
    //const vtsFormat = file.vtsFormat;
    const res = this.getBinNodeTexelSize(center, radius, texelSize * renderer.curSize[0]);

    let index2 = index * 9;

    let pathFlags = tree[index2];
    let pathIndex = (pathFlags & 0xfffffff);

    if (pathFlags & (1 << 31)) {  // has json, jump to another tree (bin file)
        const tab = file.pathTable;

        if (tab[pathIndex] == 2) { //loaded
            const fileIndex = tab[pathIndex+1] | tab[pathIndex+2] << 8 | tab[pathIndex+3] << 16; // | | tab[pathIndex+3] << 24;
            file = this.binFiles[fileIndex];
            tree = file.tree;
            index = 0;
            index2 = 0;
            pathFlags = tree[index2];
            pathIndex = (pathFlags & 0xfffffff);
        } else {
            return;
        }
    }

    let hasMesh = (pathIndex != 0);

    if (file.vtsFormat) {
        hasMesh = true;
    }

    this.map.config.mapTraverseToMeshNode = false; //!!!!!!!!!!!!!!!! DEBUG

    if (this.loadMode == 1) { // topdown with splitting

        const priority = lod * res[1];

        const noChildren = (!tree[index2+1] && !tree[index2+2] && !tree[index2+3] && !tree[index2+4] &&
                          !tree[index2+5] && !tree[index2+6] && !tree[index2+7] && !tree[index2+8]);

        if (noChildren || (res[0] <= this.map.draw.texelSizeFit && (hasMesh || !this.map.config.mapTraverseToMeshNode))) {

            if (!skipRender && (/*node.parent ||*/ this.isBinNodeReady(points, center, index, file, null, priority, null, true))) {

                const node = this.generateNode(index, file, lod, cindex, texelSize, points, center, radius, hasMesh);
                this.drawNode(node);
                //const mask = [0,1,1,1,1,1,1,1];
                //this.drawNode(node, null, mask, points);
            }

        } else {

            //are nodes ready
            //let ready = true;
            let useMask = false;
            let readyCount = 0;
            const mask = [0,0,0,0,0,0,0,0];
            const childPointsCache = [];
            const childCenterCache = [];
            const splitLods = this.map.config.mapSplitLods;

            const childPriority = (lod+1) * res[1];

            let yv = //vtsFormat ? [(points[2][0] - points[0][0])*0.5, (points[2][1] - points[0][1])*0.5, (points[2][2] - points[0][2])*0.5] :
                                 [(points[2][0] - points[1][0])*0.5, (points[2][1] - points[1][1])*0.5, (points[2][2] - points[1][2])*0.5];

            let xv = [(points[1][0] - points[0][0])*0.5, (points[1][1] - points[0][1])*0.5, (points[1][2] - points[0][2])*0.5];
            let zv = [(points[0][0] - points[4][0])*0.5, (points[0][1] - points[4][1])*0.5, (points[0][2] - points[4][2])*0.5];
            let xf, yf, zf;

            zv[0] = -zv[0];
            zv[1] = -zv[1];
            zv[2] = -zv[2];

            for (let i = 0, li = 8; i < li; i++) {

                const childIndex = tree[index2 + 1 + i];

                if (childIndex) {
                    const childIndex2 = childIndex * 9;

                    switch(i) {
                        case 0: xf = -1, yf = -1, zf = -1; break;
                        case 1: xf = 0, yf = -1, zf = -1; break;
                        case 2: xf = -1, yf = 0, zf = -1; break;
                        case 3: xf = 0, yf = 0, zf = -1; break;
                        case 4: xf = -1, yf = -1, zf = 0; break;
                        case 5: xf = 0, yf = -1, zf = 0; break;
                        case 6: xf = -1, yf = 0, zf = 0; break;
                        case 7: xf = 0, yf = 0, zf = 0; break;
                    }

                    const p = [center[0] + xv[0] * xf + yv[0] * yf + zv[0] * zf,
                             center[1] + xv[1] * xf + yv[1] * yf + zv[1] * zf,
                             center[2] + xv[2] * xf + yv[2] * yf + zv[2] * zf];

                    const childPoints = [

                        [p[0],
                         p[1],
                         p[2]],

                        [p[0] + xv[0],
                         p[1] + xv[1],
                         p[2] + xv[2]],

                        [p[0] + xv[0] + yv[0],
                         p[1] + xv[1] + yv[1],
                         p[2] + xv[2] + yv[2]],

                        [p[0] + yv[0],
                         p[1] + yv[1],
                         p[2] + yv[2]],

                        [p[0] + zv[0],
                         p[1] + zv[1],
                         p[2] + zv[2]],

                        [p[0] + xv[0] + zv[0],
                         p[1] + xv[1] + zv[1],
                         p[2] + xv[2] + zv[2]],

                        [p[0] + xv[0] + yv[0] + zv[0],
                         p[1] + xv[1] + yv[1] + zv[1],
                         p[2] + xv[2] + yv[2] + zv[2]],

                        [p[0] + yv[0] + zv[0],
                         p[1] + yv[1] + zv[1],
                         p[2] + yv[2] + zv[2]]

                    ];

                    const childCenter = [ (childPoints[0][0]+childPoints[1][0]+childPoints[2][0]+childPoints[3][0]+childPoints[4][0]+childPoints[5][0]+childPoints[6][0]+childPoints[7][0])/8,
                                   (childPoints[0][1]+childPoints[1][1]+childPoints[2][1]+childPoints[3][1]+childPoints[4][1]+childPoints[5][1]+childPoints[6][1]+childPoints[7][1])/8,
                                   (childPoints[0][2]+childPoints[1][2]+childPoints[2][2]+childPoints[3][2]+childPoints[4][2]+childPoints[5][2]+childPoints[6][2]+childPoints[7][2])/8 ];

/*
                    const childCenter = [p[0] + xv[0]*0.5 + yv[0]*0.5 + zv[0]*0.5,
                                       p[1] + xv[1]*0.5 + yv[1]*0.5 + zv[1]*0.5,
                                       p[2] + xv[2]*0.5 + yv[2]*0.5 + zv[2]*0.5];
*/
                    childPointsCache[i] = childPoints;
                    childCenterCache[i] = childCenter;

                    if (splitLods) {
                        const res2 = this.getBinNodeTexelSize(childCenter, radius*0.5, texelSize*0.5 * renderer.curSize[0]);
                        if (res2[0] <= this.map.draw.texelSizeFit) {
                            tree[childIndex2] |= (1 << 29);  // set good lod flag true
                        } else {
                            tree[childIndex2] &= ~(1 << 29);  // set good lod flag false
                        }
                    }

                    if (renderer.camera.pointsVisible2(childPoints, cameraPos)) {
                        tree[childIndex2] |= (1 << 30);  // set visible flag true
                    } else {
                        tree[childIndex2] &= ~(1 << 30);  // set visible flag false
                        continue;
                    }

                    if (!this.isBinNodeReady(childPoints, childCenter, childIndex, file, null, childPriority, true, skipRender) || (splitLods && (tree[index2] & (1 << 29) /* good lod flag*/ ))) {
                        //ready = false;
                        useMask = true;
                        mask[i] = 1;
                    } else {
                        readyCount++;
                    }
                }
            }

            for (let i = 0, li = 8; i < li; i++) {
                const childIndex = tree[index2 + 1 + i];

                if (childIndex) {
                    const childIndex2 = childIndex * 9;

                    if ((tree[childIndex2] & (1 << 30) /* visibility flag*/ ) && !(splitLods && (tree[childIndex2] & (1 << 29) /* good lod flag*/ ))) {
                        const skipChildRender = (skipRender || (mask[i] == 1));

                        this.traverseBinNode(i, childPointsCache[i], childCenterCache[i], radius * 0.5, texelSize * 0.5, lod+1, childIndex, file, true, null, skipChildRender);
                    }
                }
            }

            if (useMask) { // some children are not ready, draw parent as fallback
                if (!skipRender && this.isBinNodeReady(points, center, index, file, null, priority, null, true)) {

                    const node = this.generateNode(index, file, lod, cindex, texelSize, points, center, radius, hasMesh);

                    if (readyCount > 0) {
                        this.drawNode(node, null, mask, points);
                    } else {
                        this.drawNode(node);
                    }
                }
            }

        }
    }

};


MapOctree.prototype.getPath = function(tab, index) {
    let stmp = '';
    while(tab[index] != 0) {
        stmp += String.fromCharCode(tab[index++]);
        if (stmp.length > 700) {
            //debugger
            break;
        }
    }

    return stmp;
};


MapOctree.prototype.isBinNodeReady = function(points, center, index, file, doNotLoad, priority, skipGpu, skipStats) {
    let ready = true;

    let tree = file.tree;
    let index2 = index * 9;
    let pathFlags = tree[index2];
    let pathIndex = (pathFlags & 0xfffffff);

    if (pathFlags & (1 << 31)) {  // has json, jump to another tree (bin file)
        const tab = file.pathTable;

        if (tab[pathIndex] == 2) { //loaded
            const fileIndex = tab[pathIndex+1] | tab[pathIndex+2] << 8 | tab[pathIndex+3] << 16;// | tab[pathIndex+4] << 24;
            file = this.binFiles[fileIndex];
            tree = file.tree;
            index = 0;
            index2 = 0;
            pathFlags = tree[index2];
            pathIndex = (pathFlags & 0xfffffff);
        } else {

            if (tab[pathIndex] == 0) {
                tab[pathIndex] = 1;

                this.binFiles.push({});

                let path = this.getPath(tab, pathIndex+4);
                path = utilsUrl.getProcessUrl(path, this.rootPath);

                if (localTest) {
                    const importer = new MapGeodataImport3DTiles2();
                    importer.navSrs = this.map.getNavigationSrs();
                    importer.physSrs = this.map.getPhysicalSrs();
                    importer.srs = importer.navSrs;

                    importer.loadJSON(path + '.json', {index: this.binFiles.length-1, nodeFile:file.index, nodeOffset:pathIndex, root: false}, this.onBinFileLoaded.bind(this));
                } else {
                    this.map.loader.processLoadBinary(path + '.json', this.onBinFileLoaded.bind(this,{index: this.binFiles.length-1, nodeFile:file.index, nodeOffset:pathIndex, root: false }), null, "text", 'direct-3dtiles', {root: false});
                }
            }

            return false;
        }
    }

    let hasMesh = (pathIndex != 0);

    if (file.vtsFormat) {
        hasMesh = true;
    }

    if (hasMesh) {

        if (file.vtsFormat) {

            for (let i = 0, li = file.features.length; i < li; i++) {
                const feature = file.features[i];

                switch (feature.type) {

                    case 1: //mesh
                        break;

                    case 2: //pointcloud
                        {
                            let pointcloud = feature.resources[index];

                            if (!pointcloud) {
                                if (feature.indices) {
                                    const path = utilsUrl.getProcessUrl(feature.uri, this.rootPath);
                                    const resource = new MapResourceNode(this.renderer.core.map, null, null);
                                    pointcloud = resource.getPointCloud(path, null, feature.indices[index] - 1, feature.indices[index+1] - feature.indices[index]);
                                    feature.resources[index] = pointcloud;
                                    pointcloud.transform = [points[0][0], points[0][1], points[0][2], Math.abs(points[1][0] - points[0][0])];
                                }
                            }

                            if (!pointcloud.isReady(doNotLoad, priority, skipGpu)) {
                                ready = false;
                            }
                        }
                        break;
                }
            }

        } else {
            if (!file.meshes[index]) {
                let path = this.getPath(file.pathTable, pathIndex);
                path = utilsUrl.getProcessUrl(path, this.rootPath);
                const resource = new MapResourceNode(this.renderer.core.map, null, null);
                file.meshes[index] = resource.getMesh(path + '.mesh', null);
            }

            const job = {
                mesh: file.meshes[index],
                //textures: [file.textures[index]],
                direct: true
            };

            if (!this.isMeshReady(job, doNotLoad, priority, skipGpu, skipStats /*, node*/)) {
                ready = false;
            }

        }
    }

    return ready;
};


MapOctree.prototype.getBinNodeTexelSize = function(pos, radius, screenPixelSize) {
    const cameraPos = this.renderer.cameraPosition;
    let d = vec3.length(
        [pos[0] - cameraPos[0],
         pos[1] - cameraPos[1],
         pos[2] - cameraPos[2]]);

    d -= radius;

    if (d <= 0) {
        return [Number.POSITIVE_INFINITY, 0.1];
    }

    return [this.renderer.camera.scaleFactor2(d) * screenPixelSize * 0.5, d];
};


MapOctree.prototype.onBinFileLoaded = function(info, data) {
    const binFile = this.binFiles[info.index];
    binFile.loadState = 2;
    binFile.tree = data.bintree;
    binFile.pathTable = data.pathTable;
    binFile.rootSize = data.rootSize;
    binFile.index = info.index;

    this.map.stats.octoNodes += data.totalNodes;
    this.map.stats.octoNodesMemSize += binFile.tree.byteLength + 8*2 + 16*2 + 24;


    if (data.vtsFormat) {

        //shift is DEBUG ONLY !!!!!!!!!!!!!!!!!!!!
        const cpos = this.renderer.cameraPosition;
        const cdist = this.renderer.cameraDistance;
        const cvec = this.renderer.cameraVector;

        //const shift = [0,0,0];
        const shift = [
            cpos[0] + cvec[0] * cdist,
            cpos[1] + cvec[1] * cdist,
            cpos[2] + cvec[2] * cdist
        ];

        vec3.add(data.center, shift);
        vec3.add(data.points[0], shift);
        vec3.add(data.points[1], shift);
        vec3.add(data.points[2], shift);
        vec3.add(data.points[3], shift);
        vec3.add(data.points[4], shift);
        vec3.add(data.points[5], shift);
        vec3.add(data.points[6], shift);
        vec3.add(data.points[7], shift);

        binFile.vtsFormat = data.vtsFormat;
        binFile.features = data.features;

        for (let i = 0, li = binFile.features.length; i < li; i++) {
            const feature = binFile.features[i];
            feature.resources = new Array(data.totalNodes);

            this.map.stats.octoNodesMemSize += feature.resources.length*4 +
                                               feature.indices ? feature.indices.byteLength : 0;
        }

    } else {
        binFile.meshes = new Array(data.totalNodes);
        this.map.stats.octoNodesMemSize += binFile.pathTable.byteLength +
                                           binFile.meshes.length*4;
    }

    if (info.nodeOffset) {
        const tab = this.binFiles[info.nodeFile].pathTable;
        tab[info.nodeOffset] = 2; //load state
        tab[info.nodeOffset+1] = (info.index & 0xff);
        tab[info.nodeOffset+2] = (info.index >> 8) & 0xff;
        tab[info.nodeOffset+3] = (info.index >> 16) & 0xff;
        //table[info.nodeOffset+3] = (info.index >> 24) & 0xff;
    }

    if (info.root) {
        this.rootPoints = data.points;
        this.rootCenter = data.center;
        this.rootRadius = data.radius;
        this.rootTexelSize = data.texelSize;

        if (this.map.config.autocenter) {
            const coords = this.map.convert.convertCoordsFromPhysToNav(data.center, 'fix');
            const pos = this.map.getPosition();
            pos.setCoords(coords);
            pos.pos[3] = 'fix';
            this.map.setPosition(pos);
        }
    }

    this.renderer.core.map.dirty = true;
};


// eslint-disable-next-line
MapOctree.prototype.draw = function(mv, mvp, applyOrigin, tiltAngle, texelSize) {
    if (this.id != null) {
        if (this.renderer.layerGroupVisible[this.id] === false) {
            return;
        }
    }

    const renderer = this.renderer;
    //const renderCounter = [[renderer.geoRenderCounter, mv, mvp, this]];
    const map = renderer.core.map;
    this.map = map;

    if (this.binPath) {

        if (this.binFiles.length == 0) {
            this.binFiles.push(
                {
                    loadState : 1
                }
            );

            this.rootPath = utilsUrl.makeAbsolute(this.binPath);
            this.rootPath = utilsUrl.getBase(this.rootPath);

            //localTest = true; ///!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

            if (localTest) {

                if (this.binPath.indexOf('.json') != -1)
                {
                    const importer = new MapGeodataImport3DTiles2();
                    importer.navSrs = this.map.getNavigationSrs();
                    importer.physSrs = this.map.getPhysicalSrs();
                    importer.srs = importer.navSrs;

                    importer.loadJSON(utilsUrl.makeAbsolute(this.binPath), {index: 0, root: true}, this.onBinFileLoaded.bind(this));
                } else {
                    const importer = new MapGeodataImportVTSTree();

                    importer.load(utilsUrl.makeAbsolute(this.binPath), {index: 0, root: true}, this.onBinFileLoaded.bind(this));
                }

            } else {
                map.loader.processLoadBinary(utilsUrl.makeAbsolute(this.binPath), this.onBinFileLoaded.bind(this,{index:0, root: true}), null, "text", 'direct-3dtiles', {root: true});
            }

            return;
        } else if (this.binFiles[0].loadState == 1) {
            return;
        }

        renderer.drawnNodes = 0;

        const mode = this.map.config.mapLoadMode;

        switch(mode) {
        case 'topdown': this.loadMode = 1; /*((this.map.config.mapSplitMeshes) ? 1 : 0);*/ break;
        case 'fit':     this.loadMode = 2; break;
        case 'fitonly': this.loadMode = 3; break;
        }

        const file = this.binFiles[0];

        this.traverseBinNode(0, this.rootPoints, this.rootCenter, this.rootRadius, this.rootTexelSize, 0, 0, file, null, null, null);
    }

};


export default MapOctree;
