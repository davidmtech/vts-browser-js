
var Octree = function() {
    this.root = null;
    this.maxItemsPerNode = 20;

    /**
     * A binary pattern that describes the standard octant layout:
     *
     * ```text
     *    3____7
     *  2/___6/|
     *  | 1__|_5
     *  0/___4/
     * ```
     *
     * This common layout is crucial for positional assumptions.
     *
     */

    this.pattern = [
        new Uint8Array([0, 0, 0]),
        new Uint8Array([0, 0, 1]),
        new Uint8Array([0, 1, 0]),
        new Uint8Array([0, 1, 1]),

        new Uint8Array([1, 0, 0]),
        new Uint8Array([1, 0, 1]),
        new Uint8Array([1, 1, 0]),
        new Uint8Array([1, 1, 1])
    ];
};


Octree.prototype.clear = function() {
};


Octree.prototype.buildFromGeometry = function(data) {
    if (!data) {
        return;
    }

    var i, li, j, lj, k, lk, v, item, submeshes, submesh, bbox, index,
        minX, minY, minZ, maxX, maxY, maxZ, geometry, vertices;

    minX = minY = minZ = Number.POSITIVE_INFINITY;
    maxX = maxY = maxZ = Number.NEGATIVE_INFINITY;

    //get gemetery bbox
    for (i = 0, li = data.length; i < li; i++) {
        geometry = data[i];
        if (geometry["type"] == "mesh") {
            submeshes = geometry["submeshes"];

            for (j = 0; j < lj; j++) {
                submesh = submeshes[j];
                bbox = submesh["bbox"];
                
                if (bbox.min[0] < minX) minX = bbox.min[0];
                if (bbox.min[1] < minY) minY = bbox.min[1];
                if (bbox.min[2] < minZ) minZ = bbox.min[2];

                if (bbox.max[0] > maxX) maxX = bbox.max[0];
                if (bbox.max[1] > maxY) maxY = bbox.max[1];
                if (bbox.max[2] > maxZ) maxZ = bbox.max[2];
            }
        }
    }

    this.root = new OctreeNode([minX, minY, minZ], [maxX, maxY, maxZ]);

    //get gemetery bbox
    for (i = 0, li = data.length; i < li; i++) {
        geometry = data[i];
        if (geometry["type"] == "mesh") {
            submeshes = geometry["submeshes"];

            for (j = 0, lj = submeshes.length; j < lj; j++) {
                submesh = submeshes[j];

                vertices = submesh["vertices"];

                for (k = 0, lk = vertices.length; k < lk; k += 9) {

                    minX = minY = minZ = Number.POSITIVE_INFINITY;
                    maxX = maxY = maxZ = Number.NEGATIVE_INFINITY;

                    for (v = 0; v < 3; v ++) {
                        index = k + v;

                        if (vertices[index] < minX) minX = vertices[index];
                        if (vertices[index+1] < minY) minY = vertices[index+1];
                        if (vertices[index+2] < minZ) minZ = vertices[index+2];

                        if (vertices[index] > maxX) maxX = vertices[index];
                        if (vertices[index+1] > maxY) maxY = vertices[index+1];
                        if (vertices[index+2] > maxZ) maxZ = vertices[index+2];
                    }

                    //this.root.add([minX, minY, minZ], [maxX, maxY, maxZ], [vertices, k])
                    this.root.add([minX, minY, minZ, maxX, maxY, maxZ, vertices, k])
                }

            }
        }
    }


};


var OctreeNode = function(min, max) {
    this.min = min;
    this.max = max;
    this.children = [];
    this.items = null;
};

OctreeNode.prototype.add = function(item, octree) {
    this.items.push(item);

    if (this.children.length >= octree.maxItemsPerNode) {
        this.split();
    }
};

OctreeNode.prototype.split = function() {
    var min = this.min;
    var max = this.max;
    var mid = [(max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5];
    var i, li, j;

    this.children = [
        null, null,
        null, null,
        null, null,
        null, null
    ];

    for (i = 0; i < 8; i++) {
        var combination = this.pattern[i];

        this.children[i] = new OctreeNode(
            [
                (combination[0] === 0) ? min.x : mid.x,
                (combination[1] === 0) ? min.y : mid.y,
                (combination[2] === 0) ? min.z : mid.z
            ],

            [
                (combination[0] === 0) ? mid.x : max.x,
                (combination[1] === 0) ? mid.y : max.y,
                (combination[2] === 0) ? mid.z : max.z
            ]
        );
    }

    //distribute items
    if (items) {
        for (i = 0, li = items.length; i < li; i++) {
            var item = items[i];

            for (j = 0; j < 8; j++) {
                var child = this.children[j];
                min = child.min;
                max = child.max;

                if (item[0] < max[0] && item[3] > min[0] &&
                    item[1] < max[1] && item[4] > min[1] &&
                    item[2] < max[2] && item[5] > min[2]) {

                    //collision detected, add item
                    child.add(item);
                }
            }
        }
    }

};


var OctreeRaycaster = function() {

    // A lookup-table containing octant ids. Used to determine the exit plane from an octant.
    this.octantTable = [
        new Uint8Array([4, 2, 1]),
        new Uint8Array([5, 3, 8]),
        new Uint8Array([6, 8, 3]),
        new Uint8Array([7, 8, 8]),
        new Uint8Array([8, 6, 5]),
        new Uint8Array([8, 7, 8]),
        new Uint8Array([8, 8, 7]),
        new Uint8Array([8, 8, 8])
    ];

    // A byte that stores raycasting flags.
    this.flags = 0;
};


/**
 * Finds the entry plane of the first octant that a ray travels through.
 *
 * Determining the first octant requires knowing which of the t0s is the
 * largest. The tms of the other axes must also be compared against that
 * largest t0.
 * 
 * tx0, ty0,tz0 - Ray projection parameter.
 * txm, tym, tzm - Ray projection parameter mean.
 * returns - index of the first octant that the ray travels through.
 */

OctreeRaycaster.prototype.findEntryOctant = function(tx0, ty0, tz0, txm, tym, tzm) {
    var entry = 0;

    // Find the entry plane.
    if(tx0 > ty0 && tx0 > tz0) {

        // YZ-plane.
        if (tym < tx0) {
            entry |= 2;
        }

        if (tzm < tx0) {
            entry |= 1;
        }

    } else if (ty0 > tz0) {

        // XZ-plane.
        if (txm < ty0) {
            entry |= 4;
        }

        if (tzm < ty0) {
            entry |= 1;
        }

    } else {

        // XY-plane.
        if (txm < tz0) {
            entry |= 4;
        }

        if (tym < tz0) {
            entry |= 2;
        }
    }

    return entry;
}

/**
 * Finds the next octant that intersects with the ray based on the exit plane of
 * the current one.
 *
 * urrentOctant - The index of the current octant.
 * tx1, ty1, tz1 - Ray projection parameter.
 * returns - index of the next octant that the ray travels through.
 */

OctreeRaycaster.prototype.findNextOctant = function(currentOctant, tx1, ty1, tz1) {
    var min;
    var exit = 0;

    // Find the exit plane.
    if (tx1 < ty1) {
        min = tx1;
        exit = 0; // YZ-plane.
    } else {
        min = ty1;
        exit = 1; // XZ-plane.
    }

    if (tz1 < min) {
        exit = 2; // XY-plane.
    }

    return this.octantTable[currentOctant][exit];
}

/**
 * Finds all octants that intersect with the given ray.
 *
 * @param {Octant} octant - The current octant.
 * @param {Number} tx0 - Ray projection parameter. Initial tx0 = (minX - rayOriginX) / rayDirectionX.
 * @param {Number} ty0 - Ray projection parameter. Initial ty0 = (minY - rayOriginY) / rayDirectionY.
 * @param {Number} tz0 - Ray projection parameter. Initial tz0 = (minZ - rayOriginZ) / rayDirectionZ.
 * @param {Number} tx1 - Ray projection parameter. Initial tx1 = (maxX - rayOriginX) / rayDirectionX.
 * @param {Number} ty1 - Ray projection parameter. Initial ty1 = (maxY - rayOriginY) / rayDirectionY.
 * @param {Number} tz1 - Ray projection parameter. Initial tz1 = (maxZ - rayOriginZ) / rayDirectionZ.
 * @param {Array} intersects - An array to be filled with the intersecting octants.
 */

OctreeRaycaster.prototype.raycastOctant = function(octant, tx0, ty0, tz0, tx1, ty1, tz1, intersects) {
    var children = octant.children;
    var currentOctant;
    var txm, tym, tzm;

    if (tx1 >= 0.0 && ty1 >= 0.0 && tz1 >= 0.0) {

        if (children === null) {

            // Leaf.
            intersects.push(octant);

        } else {

            // Compute means.
            txm = 0.5 * (tx0 + tx1);
            tym = 0.5 * (ty0 + ty1);
            tzm = 0.5 * (tz0 + tz1);

            currentOctant = this.findEntryOctant(tx0, ty0, tz0, txm, tym, tzm);

            do {

                /* The possibilities for the next node are passed in the same respective
                 * order as the t-values. Hence, if the first value is found to be the
                 * greatest, the fourth one will be returned. If the second value is the
                 * greatest, the fifth one will be returned, etc.
                 */

                switch(currentOctant) {

                    case 0:
                        this.raycastOctant(children[this.flags], tx0, ty0, tz0, txm, tym, tzm, intersects);
                        currentOctant = this.findNextOctant(currentOctant, txm, tym, tzm);
                        break;

                    case 1:
                        this.raycastOctant(children[this.flags ^ 1], tx0, ty0, tzm, txm, tym, tz1, intersects);
                        currentOctant = this.findNextOctant(currentOctant, txm, tym, tz1);
                        break;

                    case 2:
                        this.raycastOctant(children[this.flags ^ 2], tx0, tym, tz0, txm, ty1, tzm, intersects);
                        currentOctant = this.findNextOctant(currentOctant, txm, ty1, tzm);
                        break;

                    case 3:
                        this.raycastOctant(children[this.flags ^ 3], tx0, tym, tzm, txm, ty1, tz1, intersects);
                        currentOctant = this.findNextOctant(currentOctant, txm, ty1, tz1);
                        break;

                    case 4:
                        this.raycastOctant(children[this.flags ^ 4], txm, ty0, tz0, tx1, tym, tzm, intersects);
                        currentOctant = this.findNextOctant(currentOctant, tx1, tym, tzm);
                        break;

                    case 5:
                        this.raycastOctant(children[this.flags ^ 5], txm, ty0, tzm, tx1, tym, tz1, intersects);
                        currentOctant = this.findNextOctant(currentOctant, tx1, tym, tz1);
                        break;

                    case 6:
                        this.raycastOctant(children[this.flags ^ 6], txm, tym, tz0, tx1, ty1, tzm, intersects);
                        currentOctant = this.findNextOctant(currentOctant, tx1, ty1, tzm);
                        break;

                    case 7:
                        this.raycastOctant(children[this.flags ^ 7], txm, tym, tzm, tx1, ty1, tz1, intersects);
                        // Far top right octant. No other octants can be reached from here.
                        currentOctant = 8;
                        break;

                }

            } while(currentOctant < 8);

        }

    }

}

/**
 * Finds the octants that intersect with the given ray. The intersecting
 * octants are sorted by distance, closest first.
 *
 * @param {Octree} octree - An octree.
 * @param {Array} intersects - A list to be filled with intersecting octants.
 */

// https://github.com/vanruesc/sparse-octree/blob/master/src/core/OctreeRaycaster.js

OctreeRaycaster.prototype.intersectOctree = function(rayPos, rayDir, octree, intersects) {
    // Translate the octree extents to the scene origin.
    var min = [0,0,0];
    var max = [octree.root.max[0] - octree.root.min[0],
               octree.root.max[1] - octree.root.min[1],
               octree.root.max[2] - octree.root.min[2]] 

    var dimensions = [max[0], max[1], max[2]];
    var halfDimensions = [dimensions[0]*0.5, dimensions[1]*0.5, dimensions[2]*0.5];

    var origin = [rayPos[0],rayPos[1],rayPos[2]];
    var direction = [rayDir[0], rayDir[1], rayDir[2]];

    var invDirX, invDirY, invDirZ;
    var tx0, tx1, ty0, ty1, tz0, tz1;

    var center = [(octree.root.max[0] + octree.root.min[0]) * 0.5,
                  (octree.root.max[1] + octree.root.min[1]) * 0.5,
                  (octree.root.max[2] + octree.root.min[2]) * 0.5] 

    // Translate the ray to the center of the octree.
    //origin.sub(octree.getCenter(v[2])).add(halfDimensions);
    origin[0] = (origin[0] - center[0]) + halfDimensions[0]; 
    origin[1] = (origin[1] - center[1]) + halfDimensions[1]; 
    origin[2] = (origin[2] - center[2]) + halfDimensions[2]; 

    // Reset all flags.
    this.flags = 0;

    // Handle rays with negative directions.
    if (direction[0] < 0.0) {
        origin[0] = dimensions[0] - origin[0];
        direction[0] = -direction[0];
        this.flags |= 4;
    }

    if (direction[1] < 0.0) {
        origin[1] = dimensions[1] - origin[1];
        direction[1] = -direction[1];
        this.flags |= 2;
    }

    if (direction[2] < 0.0) {
        origin[2] = dimensions[2] - origin[2];
        direction[2] = -direction[2];
        this.flags |= 1;
    }

    // Improve IEEE double stability.
    invDirX = 1.0 / direction[0];
    invDirY = 1.0 / direction[1];
    invDirZ = 1.0 / direction[2];

    // Project the ray to the root's boundaries.
    tx0 = (min[0] - origin[0]) * invDirX;
    tx1 = (max[0] - origin[0]) * invDirX;
    ty0 = (min[1] - origin[1]) * invDirY;
    ty1 = (max[1] - origin[1]) * invDirY;
    tz0 = (min[2] - origin[2]) * invDirZ;
    tz1 = (max[2] - origin[2]) * invDirZ;

    // Check if the ray hits the octree.
    if (Math.max(Math.max(tx0, ty0), tz0) < Math.min(Math.min(tx1, ty1), tz1)) {
        // Find the intersecting octants.
        this.raycastOctant(octree.root, tx0, ty0, tz0, tx1, ty1, tz1, intersects);
    }
}
