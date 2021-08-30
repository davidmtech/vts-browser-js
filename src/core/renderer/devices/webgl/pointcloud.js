
const WebGLPointcloud = function(gpu, pointcloudData, fileSize, core, direct) {
    this.gpu = gpu;
    this.gl = gpu.gl;
    this.bbox = null; //< bbox copy from Mesh
    this.fileSize = fileSize; //used for stats
    this.core = core;
    this.vertexBuffer = null;
    this.colorBuffer = null;

    const vertices = pointcloudData.vertices;
    const colors = pointcloudData.colors;

    const gl = this.gl;

    if (!vertices || !colors || !gl) {
        return;
    }

    //create vertex buffer
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

    //when direct mode is used vertices can be also unit16
    gl.bufferData(gl.ARRAY_BUFFER, direct ? vertices : (new Uint8Array(vertices)), gl.STATIC_DRAW);
    this.vertexBuffer.itemSize = 3;
    this.vertexBuffer.numItems = vertices.length / 3;

    this.colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, direct ? colors : (new Uint8Array(colors)), gl.STATIC_DRAW);
    this.colorBuffer.itemSize = 3;
    this.colorBuffer.numItems = colors.length / 3;

    this.size = this.vertexBuffer.numItems * 3;
    this.size += this.colorBuffer.numItems * 3;
    this.points = this.vertexBuffer.numItems;

    this.valid = true;
};

//destructor
WebGLPointcloud.prototype.kill = function() {
    if (!this.gl || !this.valid) {
        return;
    }

    if (this.vertexBuffer) {
        this.gl.deleteBuffer(this.vertexBuffer);
    }

    if (this.colorBuffer) {
        this.gl.deleteBuffer(this.vertexBuffer);
    }

    this.vertexBuffer = null;
    this.colorBuffer = null;
};

// Draws the mesh, given the two vertex shader attributes locations.
WebGLPointcloud.prototype.draw = function(program, attrVertex, attrColor, skipDraw) {
    const gl = this.gl;
    if (gl == null || !this.valid) {
        return;
    }

    //bind vetex positions
    const vertexAttribute = program.getAttribute(attrVertex);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(vertexAttribute, this.vertexBuffer.itemSize, gl.UNSIGNED_BYTE, true, 0, 0);

    //bind vetex colors
    const colorAttribute = program.getAttribute(attrColor);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.vertexAttribPointer(colorAttribute, this.colorBuffer.itemSize, gl.UNSIGNED_BYTE, true, 0, 0);

    if (!skipDraw) gl.drawArrays(gl.POINTS, 0, this.vertexBuffer.numItems);
};


// Returns GPU RAM used, in bytes.
WebGLPointcloud.prototype.getSize = function(){ return this.size; };


//WebGLPointcloud.prototype.getBBox = function(){ return this.bbox; };


WebGLPointcloud.prototype.getPoints = function(){ return this.points; };


export default WebGLPointcloud;
