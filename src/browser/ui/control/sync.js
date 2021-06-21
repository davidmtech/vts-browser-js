
var UIControlSync = function(ui, visible, visibleLock) {
    this.ui = ui;

    this.clinets = [];

    var html = '<div class="vts-sync"';
    var hues = [0, 32, 96, 192, 224, 64]

    for (var i = 0, li = hues.length; i < li; i++) {
        html += '<div id="vts-sync' + i + '" style="background: radial-gradient(circle, hsl(' + hues[i] + ',100%,50%,0) 45%, hsl(' + hues[i] + ',100%,50%,1) 50%, hsl(' + hues[i] + ',100%,50%,-1) 55%); display: none; position: absolute; left: 0px; top: 0px;  width: 40px; height: 40px; pointer-events: none; "></div>';
    }

    html += '</div>';

    this.control = this.ui.addControl("sync", html, visible, visibleLock);

    var mapElement = this.ui.getMapElement();

    //this.divRect = this.div.getRect();

    this.onMouseMoveCall = this.onMouseMove.bind(this);
    this.onMouseLeaveCall = this.onMouseLeave.bind(this);

    mapElement.on('mousemove', this.onMouseMoveCall);
    mapElement.on('mouseleave', this.onMouseLeaveCall);


};

UIControlSync.prototype.onDoNothing = function(event) {
    dom.stopPropagation(event);
};

UIControlSync.prototype.onMouseLeave = function(event) {

    var browser = this.ui.browser;
    var screenSize = browser.getRenderer().getCanvasSize();

    if (browser.ws && browser.ws.readyState == 1) {

        var coords = event.getMouseCoords();

        browser.ws.send('{ "command":"hide-cursor", "id": ' + browser.wsId + '  }');
    }

};

UIControlSync.prototype.onMouseMove = function(event) {

    var browser = this.ui.browser;
    var screenSize = browser.getRenderer().getCanvasSize();

    if (browser.ws && browser.ws.readyState == 1) {

        var coords = event.getMouseCoords();

        browser.ws.send('{ "command":"cursor", "id": ' + browser.wsId + ',  "pos":[' + ((coords[0] - screenSize[0] * 0.5) / screenSize[1]) +  ',' + coords[1]/screenSize[1] + ']  }');
    }

};

UIControlSync.prototype.updateCursor = function(event) {

    if (event.color > 5) {
        event.color = 5;
    }

    var div = document.getElementById('vts-sync' + event.color)

    if (div) {

        if (event.command == 'cursor') {
            var screenSize = this.ui.browser.getRenderer().getCanvasSize();

            div.style.display = 'block';
            div.style.left = '' + (event.pos[0]*screenSize[1]+screenSize[0]*0.5-20) + 'px';
            div.style.top = '' + (event.pos[1]*screenSize[1]-20) + 'px';
        } else {
            div.style.display = 'none';
        }

    }

};

export default UIControlSync;
