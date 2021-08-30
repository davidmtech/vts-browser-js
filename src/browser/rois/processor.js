
/**
 * @constructor
 */
const RoiProcessQueue = function(options) {
    this.options = options;

    // queue
    this.enqueued = [];

    // options properties
    this.opsPerTick = 1;

    if (typeof this.options === 'object' && this.options !== null) {
        this.opsPerTick = this.options.opsPerTick || 1;
    }
};


RoiProcessQueue.prototype.tick = function() {
    for (let i = 0; i < this.opsPerTick; i++) {
        if (this.enqueued.length) {
            const task = this.enqueued.pop();
            task();
        } else {
            break;
        }
    }
};


RoiProcessQueue.prototype.enqueue = function(task) {
    if (typeof task !== 'function') {
        return;
    }
    for (let i in this.enqueued) {
        if (this.enqueued[i] === task) {
            this.enqueued.splice(i, 1);
            break;
        }
    }
    this.enqueued.push(task);
};


RoiProcessQueue.prototype.enqueued = function() {
    this.enqueued;
};


RoiProcessQueue.prototype.denqueue = function(task) {
    if (typeof task !== 'function') {
        return;
    }

    for (let i in this.enqueued) {
        if (this.enqueued[i] === task) {
            this.enqueued.splice(i, 1);
            break;
        }
    }
};


export default RoiProcessQueue;
