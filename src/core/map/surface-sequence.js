
const MapSurfaceSequence = function(map) {
    this.map = map;
};


MapSurfaceSequence.prototype.generateSurfaceSequence = function() {
    const view = this.map.currentView;
    const tree = this.map.tree;

    if (!tree) {
        return;
    }

    tree.surfaceSequence = [];
    tree.surfaceSequenceIndices = []; //probably not used
    tree.surfaceOnlySequence = [];

    let vsurfaces = {}, surface, glue;
    let vsurfaceCount = 0;
    let list = [], listId, i, li, j , lj, key;
    let strId = [];

    //add surfaces to the list
    for (key in view.surfaces) {
        surface = this.map.getSurface(key);

        if (surface) {
            strId.push(surface.id);
            vsurfaceCount++;
            vsurfaces[key] = surface.index + 1; //add one to avoid zero
            //list.push(["" + (surface.index + 1), surface, true]);
            list.push([ [(surface.index + 1)], surface, true, false]); //[surfaceId, surface, isSurface, isAlien]
        }
    }


    if (vsurfaceCount >= 1) { //do we have virtual surface?
        strId.sort();
        strId = strId.join(';');

        surface = this.map.virtualSurfaces[strId];
        if (surface) {
            list = [ [ [(surface.index + 1)], surface, true, false] ]; //[surfaceId, surface, isSurface, isAlien]
            vsurfaceCount = 1;
        }
    }

    if (vsurfaceCount > 1) {

        const glues = [];

        //add proper glues to the list
        for (key in this.map.glues) {
            glue = this.map.glues[key];

            //add only glue which contains desired surfaces

            if (!glue || !glue.id) continue;

            const id = glue.id;
            if (id.length <= vsurfaceCount) {

                let missed = false;
                for (j = 0, lj = id.length; j < lj; j++) {
                    if (!vsurfaces[id[j]]) {
                        missed = true;
                        break;
                    }
                }

                if (!missed) {
                    listId = [];

                    //create glue id in reverse order for sorting
                    for (j = 0, lj = id.length; j < lj; j++) {
                        //listId = vsurfaces[id[j]] + (j ? "." : "") + listId;
                        listId.unshift(vsurfaces[id[j]]);
                    }

                    glues.push([listId, glue, false, false]); //[surfaceId, surface, isSurface, isAlien]
                }
            }
        }

        //process glue flags
        for (i = 0, li = glues.length; i < li; i++) {
            const item = glues[i];
            glue = item[1];

            glue.flagProper = true;
            glue.flagAlien = true;

            if (glue.flagProper) {
                list.push(item);
            }

            if (glue.flagAlien) {
                //remove first surface from id
                listId = item[0].slice(1);

                //add same glue as alien
                list.push([listId, item[1], false, true]); //[surfaceId, surface, isSurface, isAlien]
            }
        }

        //sort list alphabetically
        let sorted;

        do {
            sorted = true;

            for (i = 0, li = list.length - 1; i < li; i++) {
                const a1 = list[i][0];
                const a2 = list[i+1][0];

                let lesser = false;

                for (j = 0, lj = Math.min(a1.length, a2.length); j < lj; j++) {
                    if (a1[j] < a2[j] || (j == (lj -1) && a1[j] == a2[j] && a2.length > a1.length)) {
                        lesser = true;
                        break;
                    }
                }

                if (lesser) {
                    const t = list[i];
                    list[i] = list[i+1];
                    list[i+1] = t;
                    sorted = false;
                }
            }

        } while(!sorted);

        let lastIndex = vsurfaceCount - 1;

        //convert list to surface sequence
        for (i = 0, li = list.length; i < li; i++) {
            tree.surfaceSequence.push([list[i][1], list[i][3]]); //[surface, isAlien]
            //this.surfaceSequence.push(list[i][1]);
            list[i][1].viewSurfaceIndex = lastIndex;

            if (list[i][2]) {
                lastIndex--;
                tree.surfaceOnlySequence.push(list[i][1]);
            }
        }

        //this.generateSurfaceSequenceOld();

    } else {
        if (vsurfaceCount == 1) {
            tree.surfaceSequence.push([list[0][1], list[0][3]]); //[surface, isAlien]
            list[0][1].viewSurfaceIndex = vsurfaceCount - 1;
            tree.surfaceOnlySequence = [list[0][1]];
        }
    }

    this.map.freeLayersHaveGeodata = false;

    //free layers
    for (key in view.freeLayers) {
        const freeLayer = this.map.getFreeLayer(key);
        if (freeLayer) {
            freeLayer.surfaceSequence = [freeLayer];
            freeLayer.surfaceOnlySequence = [freeLayer];

            if (freeLayer.geodata) {
                this.map.freeLayersHaveGeodata = true;
            }
        }
    }

    //just in case
    this.map.renderer.gpu.draw.clearJobBuffer();
};


MapSurfaceSequence.prototype.generateBoundLayerSequence = function() {
    const view = this.map.currentView;
    let key, item, layer, alpha, i, li, item2, surface;

    //zero bound layer filters
    const layers = this.map.boundLayers;
    for (key in layers) {
        layers[key].shaderFilters = null;
    }

    //surfaces
    for (key in view.surfaces) {
        const surfaceLayers = view.surfaces[key];
        surface = this.map.getSurface(key);
        if (surface != null) {
            surface.boundLayerSequence = [];

            for (i = 0, li = surfaceLayers.length; i < li; i++) {
                item = surfaceLayers[i];

                if (typeof item === 'string') {
                    layer = this.map.getBoundLayerById(item);
                    if (layer) {
                        surface.boundLayerSequence.push([layer, 1]);
                    }
                } else {
                    layer = this.map.getBoundLayerById(item['id']);
                    if (layer) {

                        alpha = 1;
                        if (typeof item['alpha'] !== 'undefined') {
                            alpha = parseFloat(item['alpha']);
                        }

                        surface.boundLayerSequence.push([layer, alpha]);

                        item2 = item['options'] || item;

                        if (item2['shaderVarFlatShade']) {
                            if (!layer.shaderFilters) {
                                layer.shaderFilters = {};
                            }

                            if (!layer.shaderFilters[surface.id]) {
                                layer.shaderFilters[surface.id] = {};
                            }

                            layer.shaderFilters[surface.id].varFlatShade = item2['shaderVarFlatShade'];
                        }

                        if (item2['shaderFilter']) {
                            if (!layer.shaderFilters) {
                                layer.shaderFilters = {};
                            }

                            if (!layer.shaderFilters[surface.id]) {
                                layer.shaderFilters[surface.id] = {};
                            }

                            layer.shaderFilters[surface.id].filter = item2['shaderFilter'];
                        }
                    }
                }
            }
        }
    }

    //free layers
    for (key in view.freeLayers) {
        const freeLayersProperties = view.freeLayers[key];
        const freeLayer = this.map.getFreeLayer(key);
        if (freeLayer != null && freeLayer.ready) {

            freeLayer.options = freeLayersProperties['options'] || {};

            freeLayer.boundLayerSequence = [];

            const boundLayers = freeLayersProperties['boundLayers'];

            if (boundLayers && Array.isArray(boundLayers)) {

                for (i = 0, li = boundLayers.length; i < li; i++) {
                    item = boundLayers[i];

                    if (typeof item === 'string') {
                        layer = this.map.getBoundLayerById(item);
                        if (layer) {
                            freeLayer.boundLayerSequence.push([layer, 1]);
                        }
                    } else {
                        layer = this.map.getBoundLayerById(item['id']);
                        if (layer) {

                            alpha = 1;
                            if (typeof item['alpha'] !== 'undefined') {
                                alpha = parseFloat(item['alpha']);
                            }

                            freeLayer.boundLayerSequence.push([layer, alpha]);

                            if (item['shaderVarFlatShade']) {
                                if (!layer.shaderFilters) {
                                    layer.shaderFilters = {};
                                }

                                if (!layer.shaderFilters[surface.id]) {
                                    layer.shaderFilters[surface.id] = {};
                                }

                                layer.shaderFilters[surface.id].varFlatShade = item['shaderVarFlatShade'];
                            }

                            if (item['shaderFilter']) {
                                if (!layer.shaderFilters) {
                                    layer.shaderFilters = {};
                                }

                                if (!layer.shaderFilters[surface.id]) {
                                    layer.shaderFilters[surface.id] = {};
                                }

                                layer.shaderFilters[surface.id].filter = item['shaderFilter'];
                            }
                        }
                    }
                }
            }
        }
    }
};


export default MapSurfaceSequence;
