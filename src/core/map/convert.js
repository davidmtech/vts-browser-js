
import {mat4 as mat4_} from '../utils/matrix';
import {math as math_} from '../utils/math';
//import GeographicLib_ from 'geographiclib';

//get rid of compiler mess
const mat4 = mat4_;
const math = math_;
//const GeographicLib = GeographicLib_;


const MapConvert = function(map) {
    this.map = map;
    this.renderer = map.renderer;
    this.config = map.config;
    this.measure = map.measure;
    this.isProjected = this.map.getNavigationSrs().isProjected();
};


MapConvert.prototype.convertCoords = function(coords, source, destination) {
    return this.map.referenceFrame.convertCoords(coords, source, destination);
};


MapConvert.prototype.movePositionCoordsTo = function(position, azimuth, distance, azimuthCorrectionFactor) {
    const coords = position.getCoords();
    //const navigationSrsInfo = this.map.getNavigationSrs().getSrsInfo();
    azimuthCorrectionFactor = (azimuthCorrectionFactor == null) ? 1 : azimuthCorrectionFactor;

    if (this.isProjected) {
        const yaw = math.radians(azimuth);
        const forward = [-Math.sin(yaw), Math.cos(yaw)];

        position.setCoords2([coords[0] + (forward[0]*distance),
            coords[1] + (forward[1]*distance)]);
    } else {
        const geod = this.measure.getGeodesic();

        const r = geod.Direct(coords[1], coords[0], azimuth, distance);
        position.setCoords2([r.lon2, r.lat2]);

        const orientation = position.getOrientation();

        //console.log("corerction: " + (r.azi1 - r.azi2));

        orientation[0] -= (r.azi1 - r.azi2) * azimuthCorrectionFactor;
        //orientation[0] -= (r.azi1 - r.azi2);

        //if (!skipOrientation) {
        position.setOrientation(orientation);
        //}

        //console.log("azimuthCorrection: " + azimuthCorrectionFactor);
        //console.log("oldpos: " + JSON.stringify(this));
        //console.log("newpos: " + JSON.stringify(pos2));
    }

    return position;
};


MapConvert.prototype.convertPositionViewMode = function(position, mode) {
    if (mode == position.pos[0]) {
        return position;
    }

    if (mode == 'obj') {
        let convertToFloat = false;

        if (position.getHeightMode() == 'float') {
            convertToFloat = true;
            this.convertPositionHeightMode(position, 'fix', true);
        }

        let distance = position.getViewDistance();
        const orientation = position.getOrientation();
        let coords;

        //get height delta
        const pich = math.radians(-orientation[1]);
        const heightDelta = distance * Math.sin(pich);

        //reduce distance by pich
        distance *= Math.cos(pich);

        if (this.isProjected) {
            //get forward vector
            const yaw = math.radians(orientation[0]);
            const forward = [-Math.sin(yaw), Math.cos(yaw)];

            //get center coords
            coords = position.getCoords();
            coords[0] = coords[0] + (forward[0] * distance);
            coords[1] = coords[1] + (forward[1] * distance);
        } else {
            this.movePositionCoordsTo(position, -orientation[0], distance);
            coords = position.getCoords();
        }

        coords[2] -= heightDelta;
        position.setCoords(coords);

        if (convertToFloat) {
            this.convertPositionHeightMode(position, 'float', true);
        }

    } else if (mode == 'subj') {
        let coords = this.getPositionCameraCoords(position, position.getHeightMode());
        position.setCoords(coords);

        //TODO: take in accout planet ellipsoid
    }

    position.pos[0] = mode;

    return position;
};


MapConvert.prototype.convertPositionHeightMode = function(position, mode, noPrecisionCheck) {
    if (position.pos[3] == mode) {
        return position;
    }

    const lod =  this.measure.getOptimalHeightLod(position.getCoords(), position.getViewExtent(), this.config.mapNavSamplesPerViewExtent);
    const height = this.measure.getSurfaceHeight(position.getCoords(), lod);

    if (!height[1] && !noPrecisionCheck) {
        //return null;
    }

    //set new height
    if (mode == 'float') {
        position.pos[3] = mode;
        position.pos[4] = position.pos[4] - height[0];
    } else if (mode == 'fix') {
        position.pos[3] = mode;
        position.pos[4] = position.pos[4] + height[0];
    }

    return position;
};


MapConvert.prototype.getPositionCameraCoords = function(position, heightMode) {
    const orientation = position.getOrientation();
    const rotMatrix = mat4.create();
    mat4.multiply(math.rotationMatrix(2, math.radians(-orientation[0])), math.rotationMatrix(0, math.radians(orientation[1])), rotMatrix);

    let coords, terrainHeight = 0, surfaceHeight, lod = -1;

    if (position.getViewMode() == 'obj') {
        coords = position.getCoords();

        //convert height to fix
        if (position.getHeightMode() == 'float') {
            lod = this.measure.getOptimalHeightLod(coords, position.getViewExtent(), this.config.mapNavSamplesPerViewExtent);
            surfaceHeight = this.measure.getSurfaceHeight(coords, lod);
            terrainHeight = surfaceHeight[0];
        }

        const camInfo = this.measure.getPositionCameraInfo(position, this.isProjected);

        if (this.isProjected) {
            //const distance = (this.getViewExtent()) / Math.tan(math.radians(this.getFov()*0.5));
            //const orbitPos = [0, -distance, 0];
            //math.mat4.multiplyVec3(rotMatrix, orbitPos);

            coords[0] += camInfo.orbitCoords[0];
            coords[1] += camInfo.orbitCoords[1];
            coords[2] += camInfo.orbitCoords[2] + terrainHeight;
        } else {
            const worldPos = this.convertCoords([coords[0], coords[1], coords[2] + terrainHeight], 'navigation', 'physical');
            worldPos[0] += camInfo.orbitCoords[0];
            worldPos[1] += camInfo.orbitCoords[1];
            worldPos[2] += camInfo.orbitCoords[2];// + terrainHeight;

            coords = this.convertCoords(worldPos, 'physical', 'navigation');
        }

        if (heightMode == 'fix') {
            return coords;
        } else {
            //get float height for new coords
            if (lod == -1) {
                lod =  this.measure.getOptimalHeightLod(coords, position.getViewExtent(), this.config.mapNavSamplesPerViewExtent);
            }

            surfaceHeight = this.measure.getSurfaceHeight(coords, lod);
            coords[2] -= surfaceHeight[0];

            return coords;
        }

    } else {

        if (position.getHeightMode() == heightMode) {
            return position.getCoords();
        } else {
            lod =  this.measure.getOptimalHeightLod(position.getCoords(), position.getViewExtent(), this.config.mapNavSamplesPerViewExtent);
            surfaceHeight = this.measure.getSurfaceHeight(position.getCoords(), lod);
            //height += surfaceHeight[0];

            coords = position.getCoords();

            if (heightMode == 'fix') {
                coords[2] += surfaceHeight[0];
            } else {
                coords[2] -= surfaceHeight[0];
            }

            return coords;
        }
    }
};


MapConvert.prototype.getPositionNavCoordsFromPublic = function(position, lod) {
    const coords = position.getCoords();

    if (position.getHeightMode() == 'float') {
        lod =  (lod != null) ? lod : this.measure.getOptimalHeightLod(position.getCoords(), position.getViewExtent(), this.config.mapNavSamplesPerViewExtent);
        const surfaceHeight = this.measure.getSurfaceHeight(position.getCoords(), lod);
        coords[2] += surfaceHeight[0];
    }

    return this.convertCoords(coords, 'public', 'navigation');
};

MapConvert.prototype.getPositionPublicCoords = function(position, lod) {
    const coords = position.getCoords();

    if (position.getHeightMode() == 'float') {
        lod =  (lod != null) ? lod : this.measure.getOptimalHeightLod(position.getCoords(), position.getViewExtent(), this.config.mapNavSamplesPerViewExtent);
        const surfaceHeight = this.measure.getSurfaceHeight(position.getCoords(), lod);
        coords[2] += surfaceHeight[0];
    }

    return this.convertCoords(coords, 'navigation', 'public');
};


MapConvert.prototype.getPositionPhysCoords = function(position, lod, includeSE) {
    const coords = position.getCoords();

    if (position.getHeightMode() == 'float') {
        lod =  (lod != null) ? lod : this.measure.getOptimalHeightLod(position.getCoords(), position.getViewExtent(), this.config.mapNavSamplesPerViewExtent);
        const surfaceHeight = this.measure.getSurfaceHeight(position.getCoords(), lod);
        coords[2] += surfaceHeight[0];
    }

    if (this.renderer.useSuperElevation && includeSE) {
        coords[2] = this.renderer.getSuperElevatedHeight(coords[2]);
    }

    return this.convertCoords(coords, 'navigation', 'physical');
};


MapConvert.prototype.getPositionCameraSpaceCoords = function(position, lod) {
    const coords = position.getCoords();

    if (position.getHeightMode() == 'float') {
        lod =  (lod != null) ? lod : this.measure.getOptimalHeightLod(position.getCoords(), position.getViewExtent(), this.config.mapNavSamplesPerViewExtent);
        const surfaceHeight = this.measure.getSurfaceHeight(position.getCoords(), lod);
        coords[2] += surfaceHeight[0];
    }

    if (this.renderer.useSuperElevation) {
        coords[2] = this.renderer.getSuperElevatedHeight(coords[2]);
    }

    const worldPos = this.convertCoords(coords, 'navigation', 'physical');
    const camPos = this.map.camera.position;
    worldPos[0] -= camPos[0];
    worldPos[1] -= camPos[1];
    worldPos[2] -= camPos[2];

    return worldPos;
};


MapConvert.prototype.getPositionCanvasCoords = function(position, lod, physical, containsSE) {
    let worldPos;
    if (physical) {
        const camPos = this.map.camera.position;
        let coords = position.getCoords();

        if (this.renderer.useSuperElevation && !containsSE) {
            coords = this.renderer.transformPointBySE(coords);
        }

        worldPos = [coords[0] - camPos[0], coords[1] - camPos[1], coords[2] - camPos[2]];
    } else {
        worldPos = this.getPositionCameraSpaceCoords(position, lod);
    }

    return this.map.renderer.project2(worldPos, this.map.camera.getMvpMatrix());
};


MapConvert.prototype.transformPhysCoordsBySE = function(coords) {
    if (!this.renderer.useSuperElevation) {
        return coords;
    }

    return this.renderer.transformPointBySE(coords);
};


MapConvert.prototype.convertCoordsFromPhysToNav = function(coords, mode, lod, containsSE) {
    coords = this.convertCoords(coords, 'physical', 'navigation');

    if (this.renderer.useSuperElevation && containsSE) {
        coords[2] = this.renderer.getUnsuperElevatedHeight(coords[2]);
    }

    if (mode == 'float') {
        lod =  (lod != null) ? lod : this.measure.getOptimalHeightLod(coords, 10, this.config.mapNavSamplesPerViewExtent);
        const surfaceHeight = this.measure.getSurfaceHeight(coords, lod);
        coords[2] -= surfaceHeight[0];
    }

    return coords;
};


// eslint-disable-next-line
MapConvert.prototype.getGeodesicLinePoints = function(coords, coords2, height, density) {
    let geod, r, length, azimuth, minStep, d;
    const navigationSrsInfo = this.measure.navigationSrsInfo;
    const dx = coords2[0] - coords[0];
    const dy = coords2[1] - coords[1];
    const dz = coords2[2] - coords[2];

    if (this.isProjected) {
        length = Math.sqrt(dx*dx + dy*dy + dz*dz);
        minStep = 1000000; //just big number
    } else {
        geod = this.measure.getGeodesic();
        r = geod.Inverse(coords[1], coords[0], coords2[1], coords2[0]);
        length = r.s12;
        azimuth = r.azi1;
        minStep = 10 * ((navigationSrsInfo['a'] * 2 * Math.PI) / 4007.5); //aprox 100km for earth
    }

    const points = [coords];
    let distance = minStep;

    for (;distance < length; distance += minStep) {
        d = distance / length;

        if (this.isProjected) {
            points.push([ coords[0] + dx * d, coords[1] + dy * d, coords[2] + dz * d ]);
        } else {
            r = geod.Direct(coords[1], coords[0], azimuth, distance);
            points.push([r.lon2, r.lat2, coords[2] + dz * d]);
        }
    }

    points.push(coords2);

    return points;
};

export default MapConvert;
