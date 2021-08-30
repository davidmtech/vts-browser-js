
import UIEvent_ from './event';
import Dom_ from '../../utility/dom';
import {platform as platform_} from '../../../core/utils/platform';

//get rid of compiler mess
const UIEvent = UIEvent_;
const dom = Dom_;
const platform = platform_;


const UIElement = function(control, element) {
    this.control = control;
    this.ui = this.control.ui;
    this.element = element;
    this.events = [];
    this.dragBeginCall = this.onDragBegin.bind(this, false);
    this.dragBeginCallTouch = this.onDragBegin.bind(this, true);
    this.dragMoveCall = this.onDragMove.bind(this, false);
    this.dragMoveCallTouch = this.onDragMove.bind(this, true);
    this.dragEndCall = this.onDragEnd.bind(this, false);
    this.dragEndCallTouch = this.onDragEnd.bind(this, true);
    this.firstDragDistance = 0;
    this.lastDragDistance = 0;
    this.lastWheelTimer = 0;
    this.lastWheelTimer2 = 0;
    this.dragStartPos = [0,0];
    this.dragCurrentPos = [0,0];
    this.dragLastPos = [0,0];
    this.dragAbsMoved = [0,0];
    this.zoomDrag = false;
    this.wheelTimes = [];
    this.id = this.ui.elementIdCounter++;
};


UIElement.prototype.setStyle = function(key, value) {
    this.element.style[key] = value;
};


UIElement.prototype.getStyle = function(key) {
    return this.element.style[key];
};


UIElement.prototype.setClass = function(name) {
    dom.setClass(this.element, name);
    return this;
};


UIElement.prototype.getClass = function() {
    dom.getClass(this.element);
    return this;
};


UIElement.prototype.hasClass = function(name) {
    return dom.hasClass(this.element, name);
};


UIElement.prototype.addClass = function(name) {
    dom.addClass(this.element, name);
    return this;
};


UIElement.prototype.removeClass = function(name) {
    dom.removeClass(this.element, name);
    return this;
};


UIElement.prototype.getRect = function() {
    const rect = this.element.getBoundingClientRect();
    const rect2 = this.ui.map.getMapElement().element.getBoundingClientRect();
    const offsetX = window.pageXOffset || 0;
    const offsetY = window.pageYOffset || 0;
    return {
        'left' : (rect.left + offsetX) - (rect2.left + offsetX),
        'top' : (rect.top + offsetY) - (rect2.top + offsetY),
        'fromRight' : rect2.right - ((rect.left + offsetX) - (rect2.left + offsetX)),
        'fromBottom' : rect2.height - ((rect.top + offsetY) - (rect2.top + offsetY)),
        'width' : rect.width,
        'height' : rect.height
    };
};


UIElement.prototype.getPageRect = function() {
    const rect = this.element.getBoundingClientRect();
    const offsetX = window.pageXOffset || 0;
    const offsetY = window.pageYOffset || 0;
    return {
        'left' : (rect.left + offsetX),
        'top' : (rect.top + offsetY),
        'width' : rect.width,
        'height' : rect.height
    };
};


UIElement.prototype.setHtml = function(html) {
    this.element.innerHTML = html;

    const allElements = this.element.getElementsByTagName('*');

    //store all elements with id attribute to the table
    for (let i = 0, li = allElements.length; i < li; i++) {
        const id = allElements[i].getAttribute('id');

        if (id !== null) {
            //store element to the table
            this.control.elementsById[id] = new UIElement(this, allElements[i]);
        }
    }
};


UIElement.prototype.getHtml = function() {
    return this.element.innerHTML;
};


UIElement.prototype.getElement = function() {
    return this.element;
};


UIElement.prototype.on = function(type, call, externalElement) {
    this.addEvent(type, call, externalElement);
};


UIElement.prototype.once = function(type, call, externalElement) {
    const removeEventCall = (function() {
        this.removeEvent(type, call, externalElement);
    }).bind(this);

    const handler = function(e) {
        call(e);
        removeEventCall();
    };

    this.addEvent(type, handler, externalElement);
};


UIElement.prototype.off = function(type, call, externalElement) {
    this.removeEvent(type, call, externalElement);
};


UIElement.prototype.fire = function(type, event) {
    const hooks = this.events[type];

    if (hooks != null) {
        for (let hook in hooks) {
            hooks[hook](event);
        }
    }
};


UIElement.prototype.addEvent = function(type, call, externalElement) {
    const id = type + '-' + dom.stamp(call)
               + (externalElement ? ('-' + dom.stamp(externalElement)) : '');

    const handler = (function(e) {
        if (this.ui.killed) {
            return; //todo remove event
        }

        if (type == 'mousewheel' && platform.getOS().toLowerCase().indexOf('mac') != -1) {

            if (this.ui.browser.config.separatePanAndZoom &&
                (this.dragAbsMoved[0] * this.dragAbsMoved[0] + this.dragAbsMoved[1] * this.dragAbsMoved[1]) > 20 ) {
                return;
            }

            const timer = Date.now();

            //console.log('wheel: ');

            const bigInterval = 500;
            const bigInterval2 = 500;
            let time = timer - this.lastWheelTimer2;

            this.wheelTimes.push(timer);

            let avrg = 0;

            for (let i = 0; i < this.wheelTimes.length;) {
                if (timer - this.wheelTimes[i] > bigInterval2) {
                    this.wheelTimes.splice(i, 1);
                } else {
                    avrg += (timer - this.wheelTimes[i]);
                    i++;
                }
            }

            // eslint-disable-next-line
            avrg = this.wheelTimes.length ? avrg / this.wheelTimes.length : 0;

            //console.log('wheel count: ' + this.wheelTimes.length);
            //console.log('wheel avrg: ' + avrg);

            if (time > bigInterval) {
                this.lastWheelTimer2 = timer;
                time = 0;
            }

            //const x = time / (bigInterval);
            //const lag = Math.min((x * x * x) * this.ui.browser.config.wheelInputLag, this.ui.browser.config.wheelInputLag);
            //const lag = Math.min((x * x * x) * this.wheelTimes.length, this.ui.browser.config.wheelInputLag);
            //const lag = Math.min((x) * this.wheelTimes.length*2, this.ui.browser.config.wheelInputLag);
            const lag = Math.min(this.wheelTimes.length * this.ui.browser.config.wheelInputLag[1], this.ui.browser.config.wheelInputLag[0]);
            //const lag = Math.max(0,Math.min(avrg - (0.5-(1-x)*0.5) * this.wheelTimes.length*2, this.ui.browser.config.wheelInputLag));
            //const lag = Math.min(avrg, this.ui.browser.config.wheelInputLag);
            //lag = this.wheelTimes.length; //this.ui.browser.config.wheelInputLag;
            //console.log('lag: ' + lag + '  ' +x);

            if ((timer - this.lastWheelTimer) < lag) {
              //this.ui.fireWheel[this.id] = { element: this, event: e || window.event, call: call};
                return;
            }

            //console.log('interval: ' + (timer - this.lastWheelTimer));

            this.lastWheelTimer = timer;

            //console.log('mousewheel ' + timer);
            //console.log('',e);
            //console.log('type: ' + e.type + '  phase: ' + e.eventPhase);
        }

        call(new UIEvent(type, this, e || window.event));
    }).bind(this);

    const element =  externalElement || this.element;
    element.addEventListener(this.getEventName(type), handler, false);

    if (type == 'mousewheel') {
        element.addEventListener('DOMMouseScroll', handler, false);
    }

    this.events[type] = this.events[type] || [];
    this.events[type][id] = handler;
};


UIElement.prototype.removeEvent = function(type, call, externalElement) {
    const id = type + '-' + dom.stamp(call)
               + (externalElement ? ('-' + dom.stamp(externalElement)) : '');

    const handler = this.events[type] && this.events[type][id];

    if (handler != null) {
        delete this.events[type][id];

        const element =  externalElement || this.element;
        element.removeEventListener(this.getEventName(type), handler, false);
    }
};


UIElement.prototype.getEventName = function(type) {
    return type;
};


UIElement.prototype.setDraggableState = function(state) {
    if (state) {
        this.on('mousedown', this.dragBeginCall);
        this.on('touchstart', this.dragBeginCallTouch);
    } else if (this.dragable){
        this.off('mousedown', this.dragBeginCall);
        this.off('mousemove', this.dragMoveCall, document);
        //this.off("mouseup", this.onDragEnd.bind(this));
        this.off('mouseup', this.dragEndCall, document);

        this.off('touchstart', this.dragBeginCallTouch);
        this.off('touchmove', this.dragMoveCallTouch, document);
        this.off('touchend', this.dragEndCallTouch, document);

        this.dragging = false;
    }

    this.dragStartPos = [0,0];
    this.dragCurrentPos = [0,0];
    this.dragLastPos = [0,0];
    this.dragAbsMoved = [0,0];
    this.dragTouchCount = 0;
    this.dragTouches = [];
    this.dragTouches2 = [];
    this.resetPos = false;

    this.dragable = state;
    this.dragButtons = {
        'left' : false,
        'right' : false,
        'middle' : false
    };
};


UIElement.prototype.getDraggableState = function() {
    return this.dragable;
};


UIElement.prototype.getDraggingState = function() {
    return {
        'dragging' : this.dragging,
        'buttonLeft' : this.dragButtons['left'],
        'buttonRight' : this.dragButtons['right'],
        'buttonMiddle' : this.dragButtons['middle'],
        'startPos' : this.dragStartPos.slice(),
        'lastPos' : this.dragLastPos.slice(),
        'currentPos' : this.dragCurrentPos.slice(),
        'absMoved' : this.dragAbsMoved.slice()
    };
};


UIElement.prototype.onDragBegin = function(touchUsed, event) {
    //console.log("bergin: 1#:  " + JSON.stringify(this.dragButtons));

    this.dragButtons[event.getMouseButton()] = true;

    //console.log("bergin: 2#:  " + JSON.stringify(this.dragButtons));

    //if (event.getTouchesCount() == 2) {
    this.dragTouches = [];
    this.dragTouches2 = [];
    this.dragTouches.push(event.getTouchCoords(0));
    this.dragTouches2.push(event.getTouchCoords(1));
    //}

    if (touchUsed) {
        this.resetPos = true;
        this.firstDragDistance = 0;
        this.lastDragDistance = 0;
        this.zoomDrag = false;
    }

    if (!this.dragging) {
        this.dragging = true;
        const pos = event.getMouseCoords();//true);
        this.dragStartPos = [pos[0], pos[1]];
        this.dragCurrentPos = [pos[0], pos[1]];
        this.dragLastPos = [pos[0], pos[1]];
        this.dragAbsMoved = [0,0];

        this.on('mousemove', this.dragMoveCall, document);
        this.on('mouseup', this.dragEndCall, document);
        //this.on("mouseup", this.onDragEnd.bind(this), document);

        this.on('touchmove', this.dragMoveCallTouch, document);
        this.on('touchend', this.dragEndCallTouch, document);

        dom.disableTextSelection();
        dom.disableImageDrag();
        //dom.disableContexMenu();
        dom.preventDefault(event);

        this.dragLastPos[0] = pos[0];
        this.dragLastPos[1] = pos[1];

        this.fire('dragstart', {
            'clientX' : pos[0],
            'clientY' : pos[1],
            'pageX' : pos[0],
            'pageY' : pos[1]
        });
    } else {
        this.dragLastPos = event.getMouseCoords();
    }
};


UIElement.prototype.onDragMove = function(touchUsed, event) {
    const pos = event.getMouseCoords();

    if (event.getTouchesCount() != -1) {
        this.updateDragButtonsState(event, true);
    }

    dom.preventDefault(event);

    let mode = '';
    let zoom = 0;
    let rotateDelta = 0;
    let panDelta = [0,0];
    let distanceDelta = 0;
    let touchCount = 0;

    //cont el = document.getElementById("debug123");

    if (touchUsed) {

        touchCount = event.getTouchesCount();
        if (touchCount != this.dragTouchCount) {
            this.dragLastPos[0] = pos[0];
            this.dragLastPos[1] = pos[1];
            this.dragTouchCount = touchCount;
        }

        if (this.resetPos) {
            this.dragCurrentPos = [pos[0], pos[1]];
            this.dragLastPos[0] = pos[0];
            this.dragLastPos[1] = pos[1];
            this.resetPos = false;
        }

        if (touchCount == 2) {
            this.dragTouches.push(event.getTouchCoords(0));
            this.dragTouches2.push(event.getTouchCoords(1));

            if (this.dragTouches.length >= 7) {
                this.dragTouches.shift();
                this.dragTouches2.shift();
            }

            if (this.dragTouches.length == 6) {

                //get vector for touch #1
                let t = this.dragTouches;
                const v1x = (t[5][0] - t[4][0]) + (t[4][0] - t[3][0]) + (t[3][0] - t[2][0]) + (t[2][0] - t[1][0]) + (t[1][0] - t[0][0]);
                const v1y = (t[5][1] - t[4][1]) + (t[4][1] - t[3][1]) + (t[3][1] - t[2][1]) + (t[2][1] - t[1][1]) + (t[1][1] - t[0][1]);

                //get vector for touch #2
                let t2 = this.dragTouches2;
                const v2x = (t2[5][0] - t2[4][0]) + (t2[4][0] - t2[3][0]) + (t2[3][0] - t2[2][0]) + (t2[2][0] - t2[1][0]) + (t2[1][0] - t2[0][0]);
                const v2y = (t2[5][1] - t2[4][1]) + (t2[4][1] - t2[3][1]) + (t2[3][1] - t2[2][1]) + (t2[2][1] - t2[1][1]) + (t2[1][1] - t2[0][1]);

                //get distance of each vector
                let d1 = Math.sqrt(v1x * v1x + v1y * v1y);
                let d2 = Math.sqrt(v2x * v2x + v2y * v2y);
                let cosAngle, cosAngle2;

                mode = 'pan';

                if (d1 > d2 * 5 || d2 > d1 * 5) { //dectec situation where only one finger is closing to another

                    let p1, p2, p3;

                    //make first vector from non moving point to beginnig position of moving point
                    //make seconf vector from non moving point to ending position of moving point
                    if (d1 > d2 * 5) {
                        p1 = t2[0];
                        p2 = t[0];
                        p3 = t[5];
                    } else {
                        p1 = t[0];
                        p2 = t2[0];
                        p3 = t2[5];
                    }

                    const v1 = [p2[0] - p1[0], p2[1] - p1[1]];
                    const v2 = [p3[0] - p1[0], p3[1] - p1[1]];

                    //normalize vectors
                    let d =  Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
                    v1[0] /= d;
                    v1[1] /= d;

                    d =  Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);
                    v2[0] /= d;
                    v2[1] /= d;

                    //measure angle between vectors
                    cosAngle = v1[0] * v2[0] + v1[1] * v2[1];
                    cosAngle2 = -v1[1] * v2[0] + v1[0] * v2[1]; //v1 is rotated by 90deg

                    rotateDelta = (Math.acos(cosAngle2) * (180.0/Math.PI)) - 90;

                    if (cosAngle > 0.9999) { //are vectors in same line?
                        mode = 'zoom';
                    } else {
                        panDelta = [(v1x + v2x) *0.5, (v1y + v2y) *0.5];
                    }

                } else if (d1 > 1 && d2 > 1) { //are bouth vectors in motion

                    //normalize vectors
                    const nv1x = v1x / d1;
                    const nv1y = v1y / d1;

                    const nv2x = v2x / d2;
                    const nv2y = v2y / d2;

                    //do vectors move in same direction
                    cosAngle = nv1x * nv2x + nv1y * nv2y;

                    if (cosAngle < 0.2) {
                        mode = 'zoom';
                    } else {
                        panDelta = [(v1x + v2x) *0.5, (v1y + v2y) *0.5];
                    }
                }

                //if (mode == "zoom") {
                t = this.dragTouches;
                t2 = this.dragTouches2;

                //get distance between points at the beginig
                let dx = (t2[0][0] - t[0][0]);
                let dy = (t2[0][1] - t[0][1]);
                d1 = Math.sqrt(dx * dx + dy * dy);

                /*
                //get distance between points at the end
                dx = (t2[5][0] - t[5][0]);
                dy = (t2[5][1] - t[5][1]);
                d2 = Math.sqrt(dx * dx + dy * dy);

                //get delta betwwen distances
                distanceDelta = d2 - d1;
                */

                distanceDelta = 0;

                for (let i = 1; i < 6; i++) {

                    //get distance between points at the end
                    dx = (t2[i][0] - t[i][0]);
                    dy = (t2[i][1] - t[i][1]);
                    d2 = Math.sqrt(dx * dx + dy * dy);

                    //get delta between distances
                    distanceDelta += d2 - d1;
                    d1 = d2;
                }

                //}
            }
        }
    }

    this.fire('drag', {
        'clientX' : pos[0],
        'clientY' : pos[1],
        'pageX' : pos[0],
        'pageY' : pos[1],
        'deltaX' : pos[0] - this.dragLastPos[0],
        'deltaY' : pos[1] - this.dragLastPos[1],
        'left' : this.dragButtons['left'],
        'right' : this.dragButtons['right'],
        'middle' : this.dragButtons['middle'],
        'zoom' : zoom,
        'touchMode' : mode,
        'touchPanDelta' : panDelta,
        'touchRotateDelta' : rotateDelta,
        'touchDistanceDelta' : distanceDelta,
        'touches' : (touchUsed) ? touchCount : 0
    });

    //
    //el.innerHTML = "rotDelta" + rotateDelta;

    this.dragLastPos = this.dragCurrentPos;
    this.dragCurrentPos = [pos[0], pos[1]];
    this.dragAbsMoved[0] += Math.abs(pos[0] - this.dragLastPos[0]);
    this.dragAbsMoved[1] += Math.abs(pos[1] - this.dragLastPos[1]);
};

//var debugCoutner = 0;

UIElement.prototype.onDragEnd = function(touchUsed, event) {
    //this.dragButtons[event.getMouseButton()] = false;
    //console.log("end: 1#:  " + JSON.stringify(this.dragButtons));

    const left = this.dragButtons['left'];
    const right = this.dragButtons['right'];
    const middle = this.dragButtons['middle'];

    this.updateDragButtonsState(event, false);

    //if (event.getTouchesCount() == 2) {
    this.dragTouches = [];
    this.dragTouches2 = [];
    this.dragTouches.push(event.getTouchCoords(0));
    this.dragTouches2.push(event.getTouchCoords(1));
    this.dragAbsMoved = [0,0];

    //}

    //console.log("end: 2#:  " + JSON.stringify(this.dragButtons));

    if (touchUsed) {
        this.resetPos = true;
        this.firstDragDistance = 0;
        this.lastDragDistance = 0;
        this.zoomDrag = false;
    }

    if (this.dragging) {
        let pos = event.getMouseCoords();
        this.dragLastPos = pos;

        if (!this.dragButtons['left'] &&
            !this.dragButtons['right'] &&
            !this.dragButtons['middle'] ) {

            this.dragging = false;
            pos = this.dragCurrentPos;//event.getMouseCoords();
            this.off('mousemove', this.dragMoveCall, document);
            this.off('mouseup', this.dragEndCall, document);
            //this.off("mouseup", this.onDragEnd.bind(this), document);

            this.off('touchmove', this.dragMoveCallTouch, document);
            this.off('touchend', this.dragEndCallTouch, document);

            dom.enableTextSelection();
            dom.enableImageDrag();
            //dom.enableContexMenu();
            dom.preventDefault(event);

            this.fire('dragend', {
                'clientX' : pos[0],
                'clientY' : pos[1],
                'pageX' : pos[0],
                'pageY' : pos[1],
                'left' : left,
                'right' : right,
                'middle' : middle
            });
        }
    }
};


UIElement.prototype.updateDragButtonsState = function(event, state) {
    switch(event.getTouchesCount()) {
    case -1: this.dragButtons[event.getMouseButton()] = state; break;
    case 0: this.dragButtons = { 'left' : false, 'right' : false, 'middle' : false }; break;
    case 1: this.dragButtons = { 'left' : true, 'right' : false, 'middle' : false }; break;
    case 2: this.dragButtons = { 'left' : false, 'right' : true, 'middle' : false }; break;
    case 3: this.dragButtons = { 'left' : false, 'right' : false, 'middle' : true }; break;
    }
};



export default UIElement;
