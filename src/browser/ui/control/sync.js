
var UIControlSync = function(ui, visible, visibleLock) {
    this.ui = ui;

    this.clinets = [];

    var html = '<div>';
    //var html = '<div class="vts-sync">';
    var hues = [0, 32, 96, 192, 224, 64]

    if (this.ui.browser.config.syncId == '.enter') {
        html += '<div id="vts-sync-popup" style="position:absolute; left:0px; top:0px; width:100%; height: 100%; background-color: rgba(255,255,255,0.7); z-index: 5;">';
        html += '<div class="vts-search-input" style="left:calc(50% - 108px); top:calc(50% - 20px)"><input style="font-size: 20px; z-index:6; padding: 5px;" autofocus type="text" id="vts-sync-input" autocomplete="off" spellcheck="false" placeholder="Enter your name ..."></div>';
        html += '</div>';
    }


    for (var i = 0, li = hues.length; i < li; i++) {
        html += '<div id="vts-sync' + i + '" class="vts-sync" style="background: radial-gradient(circle, hsl(' + hues[i] + ',100%,50%,0) 45%, hsl(' + hues[i] + ',100%,50%,1) 50%, hsl(' + hues[i] + ',100%,50%,-1) 55%);">';
        html += '<div id="vts-sync-id' + i + '" class="vts-sync-label"></div>';
        html += '</div>';
    }

    html += '</div>';

    this.control = this.ui.addControl("sync", html, visible, visibleLock);

    var mapElement = this.ui.getMapElement();

    if (this.ui.browser.config.syncId == '.enter') {
        this.input = this.control.getElement('vts-sync-input');
        this.input.on("change", this.onUsername.bind(this));
    }

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

        browser.ws.send('{ "command":"cursor", "id": ' + browser.wsId + ', "label": "' + browser.config.syncId + '", "pos":[' + ((coords[0] - screenSize[0] * 0.5) / screenSize[1]) +  ',' + coords[1]/screenSize[1] + ']  }');
    }

};

UIControlSync.prototype.onUsername = function(event) {

    if (this.input && this.input.element.value != '') {
        this.ui.browser.config.syncId = this.input.element.value;
        this.control.getElement('vts-sync-popup').element.style.display = "none";
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

            if (event.label != "") {
                var div2 = document.getElementById('vts-sync-id' + event.color);

                if (div2 && div2.innerHTML != event.label) {
                    div2.innerHTML = event.label;
                    div2.style.display = 'block';
                }

            }

            div.style.display = 'block';
            div.style.left = '' + (event.pos[0]*screenSize[1]+screenSize[0]*0.5-20) + 'px';
            div.style.top = '' + (event.pos[1]*screenSize[1]-20) + 'px';
        } else {
            div.style.display = 'none';
        }

    }

};

export default UIControlSync;
