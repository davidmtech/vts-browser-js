
import MapResourceNode_ from './resource-node';

//get rid of compiler mess
const MapResourceNode = MapResourceNode_;


const MapResourceTree = function(map) {
    this.map = map;
    this.tree = new MapResourceNode(map, null, [0,0,0]);
};


MapResourceTree.prototype.kill = function() {
    this.tree.kill();
};


MapResourceTree.prototype.findNode = function(id, createNonexisted) {
    let node = this.tree; //TODO: fix is it same way as findNavTile

    //console.log("--------------findNode: " + JSON.stringify(id));

//    for (const lod = 1; lod <= id[0]; lod++) {
    for (let lod = id[0]; lod > 0; lod--) {
        const mask = 1 << (lod-1);
        let index = 0;

        if ((id[1] & mask) != 0) {
            index += 1;
        }

        if ((id[2] & mask) != 0) {
            index += 2;
        }

        if (!node.children[index]) {
            if (createNonexisted) {
                node.addChild(index);
                //console.log("addNode: " + JSON.stringify(node.children[index].id));
            } else {
                return null;
            }
        }

        node = node.children[index];
    }

    return node;
};


MapResourceTree.prototype.findAgregatedNode = function(id, agregation, createNonexisted) {
    //const rootLod = 0;  //TODO: fix is it same way as findNavTile
    let node = this.tree;
    const ix = ((id[1] >> agregation) << agregation);
    const iy = ((id[2] >> agregation) << agregation);


//    for (const lod = id[0]; lod > rootLod; lod--) {
//        const i = lod - rootLod;
//        const index = 0;
//        const mask = 1 << (i-1);

    for (let lod = id[0]; lod > 0; lod--) {
        const mask = 1 << (lod-1);
        let index = 0;

        if ((ix & mask) != 0) {
            index += 1;
        }

        if ((iy & mask) != 0) {
            index += 2;
        }

        if (!node.children[index]) {
            if (createNonexisted) {
                node.addChild(index);
            } else {
                return null;
            }
        }

        node = node.children[index];
    }

    return node;
};


export default MapResourceTree;
