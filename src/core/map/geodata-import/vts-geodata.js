
const MapGeodataImportVTSGeodata = function(builder, groupIdPrefix, dontCreateGroups) {
    this.builder = builder;
    this.map = builder.map;
    this.groupIdPrefix = groupIdPrefix || '';
    this.dontCreateGroups = dontCreateGroups;
    //this.processJSON(json);
};

MapGeodataImportVTSGeodata.prototype.processJSON = function(json) {
    if (!json) {
        return;
    }

    const groups = json['groups'], builder = this.builder;
    let i, li, j, lj, k, lk, p;
    let newPoints, points;

    if (!groups) {
        return;
    }

    for (i = 0, li = groups.length; i < li; i++) {
        const group = groups[i];

        const bbox = group['bbox'],
              resolution = group['resolution'];

        if (!bbox || !resolution) {
            continue;
        }

        const bboxMin = bbox[0];
        const bboxMax = bbox[1];

        if (!bboxMin || !bboxMax) {
            continue;
        }

        if (!this.dontCreateGroups) {
            builder.addGroup(this.groupIdPrefix + (group['id'] || ''));
        }

        const fx = (bboxMax[0] - bboxMin[0]) / resolution;
        const fy = (bboxMax[1] - bboxMin[1]) / resolution;
        const fz = (bboxMax[2] - bboxMin[2]) / resolution;

        //import group points
        const pointsFeatures = group['points'];
        if (pointsFeatures) {

            points = pointsFeatures['points']

            for (j = 0, lj = pointsFeatures.length; j < lj; j++) {
                const point = pointsFeatures[j];
                const subpoints = point['points'];
                const newSubpoints = new Array(subpoints.length);

                for (k = 0, lk = subpoints.length; k < lk; k++) {
                    p = subpoints[k];
                    newSubpoints[k] = [bboxMin[0] + p[0] * fx, bboxMin[1] + p[1] * fy, bboxMin[2] + p[2] * fz];
                }

                builder.addPointArray(newSubpoints, 'fix', point['properties'], point['id'], null, true);
            }
        }

        //import group lines
        const linesFeatures = group['lines'];
        if (linesFeatures) {
            for (j = 0, lj = linesFeatures.length; j < lj; j++) {
                const line = linesFeatures[j];
                const sublines = line['lines'];
                const newSublines = new Array(sublines.length);

                for (k = 0, lk = sublines.length; k < lk; k++) {

                    points = sublines[k];
                    newPoints = new Array(points.length);

                    for (let l  = 0, ll = points.length; l < ll; l++) {
                        p = points[l];
                        newPoints[l] = [bboxMin[0] + p[0] * fx, bboxMin[1] + p[1] * fy, bboxMin[2] + p[2] * fz];
                    }

                    newSublines[k] = newPoints;
                }

                builder.addLineStringArray(newSublines, 'fix', line['properties'], line['id'], null, true);
            }
        }

        const polygonsFeatures = group['polygons'];
        if (polygonsFeatures) {
            const transform = { sx: fx, sy:fy, sz:fz, px:bboxMin[0], py:bboxMin[1], pz:bboxMin[2] };

            for (j = 0, lj = polygonsFeatures.length; j < lj; j++) {
                const polygon = polygonsFeatures[j];

                builder.addPolygonRAW(polygon['vertices'], polygon['surface'], polygon['borders'], polygon['middle'], 'fix', polygon['properties'], polygon['id'], null, true, transform);
            }
        }

    }

};

export default MapGeodataImportVTSGeodata;
