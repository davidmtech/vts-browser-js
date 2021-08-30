

const Presenter = function(browser, config) {
    this.container = null;
    this.aTags = null;
    this.sectionTags = null;
    this.defaultHeight = 0; // Changes based on presentation"s height
    this.maxHeight = 0; // Height of inner container to be set
    this.subtitlesHeights = []; // Set of heights after init() for subtitles

    this.firstTitleMargin = 20; // First slide of presentation has some css margin-top, so here we use it
    this.swipeOffset = 60; // Height of swipeControl

    this.actualNode = 0;
    this.maxNodes = 1;
    this.animTime = 600; // Default css transition time
    this.currentToolbox = 'right'; // Default toolbox (right | wide)

    this.browser = browser;
    this.id = [];
    this.current = null;

    this.presenter = (typeof config['presenter'] !== 'undefined') ? JSON.parse(JSON.stringify(config['presenter'])) : {};
    this.presenterAutoplay = config['presenterAutoplay'];

    if (typeof this.presenter !== 'undefined') {
        this.playPresentation();
    }
};


Presenter.prototype.addPresentation = function(id, source) {
    if (Object.keys(this.presenter).length !== 0) {
        this.presenter[id] = source;
    } else if (typeof id !== 'undefined') {
        this.presenter = {};
        this.presenter[id] = source;
    }
};


Presenter.prototype.removePresentation = function(id) {
    if (typeof id !== 'undefined') {
        if (this.getCurrentPresentation() == id) {
            this.stopPresentation();
            this.current = null;
        }
        delete this.presenter[id];
        return('Removed presentation id: '+id);
    } else {
        if (this.getCurrentPresentation() !== null) {
            this.stopPresentation();
        }
        this.presenter = {}; // Remove all presentations
        this.presenterAutoplay = '';
        this.current = null;
        return('All presentations removed.');
    }
};


Presenter.prototype.getCurrentPresentation = function() {
    return this.current;
};


Presenter.prototype.getCurrentPresentationType = function() {
    return this.currentToolbox;
};


Presenter.prototype.playPresentation = function(id) {
    this.stopPresentation();
    if (this.presenterAutoplay !== undefined && typeof id === 'undefined') {
        id = this.presenterAutoplay;
    } else if (typeof id === 'undefined' && this.presenter !== undefined && Object.keys(this.presenter).length > 0) {
        for (let key in this.presenter) {
            id = key;
            break;
        }
    }

    if (typeof id !== 'undefined' && Object.keys(this.presenter).indexOf(id) != -1) {
        this.current = id;
        this.readTextInput(id);
        return true;
    } else {
        return false;
    }
};


Presenter.prototype.stopPresentation = function() {
    const current = this.getCurrentPresentation();
    this.currentToolbox = 'right';
    if (current !== null) {
        this.current = null;
        this.browser.ui.removeControl(current);
        this.container.getElementsByTagName('article')[0].parentNode.parentNode.parentNode.remove();
        return true;
    }
    return false;
};


Presenter.prototype.listPresentations = function(id) {
    if (Object.keys(this.presenter).length === 0) {
        return [];
    }
    if (typeof id !== 'undefined') {
        if (this.presenter[id] !== 'undefined') {
            return this.presenter[id];
        } else {
            return null;
        }
    } else {
        const tmp = [];
        for (let key in this.presenter) {
            tmp.push(key);
        }
        return tmp;
    }
};


Presenter.prototype.initPresentation = function(id, HTMLtemplate) {
    const obj = this;
    const templatePanelPrefix = '<div class="vts-presenter panelContainer"><div class="vts-presenter swipeControl top"></div><div class="vts-presenter toolboxContainer">';
    const templatePanelSuffix = '</div><div class="vts-presenter swipeControl"></div></div>';
    const templatePanel = templatePanelPrefix + HTMLtemplate + templatePanelSuffix;
    const templateSubtitlesPrefix = '<div class="vts-presenter subtitlesContainer"><button type="button"></button><button type="button"></button>'
                                    + '<div class="vts-presenter swipeSubtitles"><div><div></div></div></div><div class="vts-presenter swipeSubtitles"><div><div></div></div></div><div class="vts-presenter innerContainer">';
    const templateSubtitlesSuffix = '</div></div>';
    const templateSubtitles = templateSubtitlesPrefix + HTMLtemplate + templateSubtitlesSuffix;
    const template = templatePanel + templateSubtitles;
    const ctrlDelve = this.browser.ui.addControl(id, template);
    this.id.push(id);
    this.setContainer(ctrlDelve);

    // Set all <a> tags to have onclick
    this.aTags = this.container.getElementsByTagName('a');
    for (let i = 0; i < this.aTags.length; i++) {
        this.aTags[i].onclick = function() {
            obj.linksDecode(this);
        };
    }

    setTimeout((function(){
        this.renderControl();
    }).bind(this), 200);
};


Presenter.prototype.readTextInput = function(id) {
    const presentation = {
        htmlDataStorage : this.presenter[id],
        id : id,
        checkID : function() {
            const url = /^(ftp|http|https):\/\/[^ "]+$/;
            const relative = /.*\/+.*/;
            const level = /(\.\.\/|\.\/)/g;
            const hash = /^#.*$/;
            const str = /(<article)/g;
            if (str.test(this.htmlDataStorage)) {
                return 'string';
            } else if (url.test(this.htmlDataStorage)) {
                return 'url';
            } else if (relative.test(this.htmlDataStorage)) {
                let getLevel;
                let l = 0;
                let split = '';
                const loc = window.location.href.split('/');
                let path = '';
                while ((getLevel = level.exec(this.htmlDataStorage)) !== null) {
                    split = split + getLevel[0];
                    if (getLevel[0] === './') {
                        break;
                    }
                    l++;
                }
                l++;
                for (let i = 0; i < (loc.length-l); i++) {
                    path = path + loc[i] + '/';
                }
                path = path + this.htmlDataStorage.split(split)[1];
                //console.log('Final path:');
                //console.log(path);
                this.htmlDataStorage = path;
                return 'url';
            } else if (hash.test(this.htmlDataStorage)) {
                return 'hash';
            } else {
                return 'string';
            }
        }
    };

    const mode = presentation.checkID();

    if (mode == 'url') {
        const rawFile = new XMLHttpRequest();
        rawFile.open('GET', presentation.htmlDataStorage, false);
        rawFile.onreadystatechange = (function() {
            if (rawFile.readyState === 4) {
                if (rawFile.status === 200 || rawFile.status == 0) {
                    const allText = rawFile.responseText;
                    this.html = allText;
                    this.initPresentation(presentation.id, this.html);
                } else {
                    this.file = 'undefined';
                }
            }
        }).bind(this);
        rawFile.send(null);
    } else if (mode == 'hash') {
        const obj = document.getElementById(presentation.htmlDataStorage).innerHTML;
        this.initPresentation(presentation.id, obj);
    } else if (mode == 'string') {
        this.initPresentation(presentation.id, presentation.htmlDataStorage);
    }
};


Presenter.prototype.linksDecode = function(obj) {
    let position = null;
    let autorotate = null;
    let transition = null;
    let navigate = null;

    if (obj.getAttribute('data-mln-navigate') !== null) {
        navigate = obj.getAttribute('data-mln-navigate');
        if (navigate !== null) {
            if (navigate == 'prev') {
                this.nextArticle('-1');
            } else if (navigate == 'next') {
                this.nextArticle('+1');
            } else if (navigate == 'first') {
                this.nextArticle(0);
            } else if (navigate == 'last') {
                this.nextArticle(this.maxNodes-1);
            } else {
                this.nextArticle(navigate);
            }
            return 'navigation:true';
        }
    }

    if (obj.getAttribute('data-mln-position') === null){
        return 'position:false';
    }

    position = this.getNumbers(obj.getAttribute('data-mln-position').split(','));

    if (obj.getAttribute('data-mln-autorotate') !== null) {
        autorotate = this.getNumbers(obj.getAttribute('data-mln-autorotate'));
    }
    if (obj.getAttribute('data-mln-transition') !== null) {
        transition = obj.getAttribute('data-mln-transition');
    }

    if (transition === null) {
        this.browser.autopilot.flyTo(position);
    } else if (transition == 'teleport') {
        this.browser.core.getMap().setPosition(position);
    } else {
        this.browser.autopilot.flyTo(position);
        // Feature to be considered
        // browser.flyTo(position, {mode : transition});
    }
    if (autorotate !== null) {
        this.browser.autopilot.setAutorotate(autorotate);
    }

    return 'Moving to position: ' + position;
};


// parseFloat here
Presenter.prototype.getNumbers = function(obj) {
    for (let i = 0; i < obj.length; i++){
        if (typeof obj == 'string' && parseFloat(obj)) {
            obj = parseFloat(obj);
            break;
        }
        if (parseFloat(obj[i])) {
            obj[i] = parseFloat(obj[i]); // toFixed might be added here
        }
    }
    return obj;
};


Presenter.prototype.nextArticle = function(node, init, lastNode) {
    // fly to whatever node we wish
    if (node === '+1') {
        node = 1;
    } else if (node === '-1') {
        node = -1;
    } else {
        this.actualNode = node;
        node = 0;
    }
    this.actualNode = this.actualNode + node;

    if (this.actualNode >= 0 && this.actualNode < this.maxNodes) {
        if (!init) {
            if (this.currentToolbox == 'right') {
                this.handleArticle(this.actualNode);
            } else if (this.currentToolbox == 'wide') {
                this.handleSubtitlesPosition(this.actualNode);
            }
        }
        if (typeof lastNode !== 'undefined') {
            this.maxNodes = lastNode;
        }
        this.linksDecode(this.container.getElementsByTagName('section')[this.actualNode]);
        return true;

    } else {
        this.actualNode = this.actualNode - node;
    }
    return false;
};


Presenter.prototype.useToolbox = function() {
    let type = this.container.getElementsByTagName('article')[0].getAttribute('data-mln-style');

    if (type === null) {
        type = 'right';
    }

    const rightPanel = this.container.getElementsByClassName('vts-presenter panelContainer')[0];
    const subtitles = this.container.getElementsByClassName('vts-presenter subtitlesContainer')[0];
    const swipeControl = this.container.getElementsByClassName('vts-presenter swipeControl');
    let i;
    this.currentToolbox = type;

    subtitles.setAttribute('style', 'opacity: 0;');
    subtitles.setAttribute('class', 'vts-presenter subtitlesContainer');
    if (type == 'right') {
        rightPanel.style.display = 'block';
        setTimeout(function() {
            rightPanel.style.opacity = 1;
        }, 20);
        swipeControl[0].style.display = 'block';
        swipeControl[1].style.display = 'block';
        for (i = 0; i < this.sectionTags.length; i++) { // Set maxHeight back as there is no dynamic rescaling of rightPanel
            this.sectionTags[i].style.height = this.maxHeight + 'px';
        }
        this.nextArticle(0);
    } else if (type == 'wide') {
        subtitles.style.display = 'block';
        setTimeout(function() {
            subtitles.style.opacity = 1;
        }, 20);
        rightPanel.style.display = 'none';
        rightPanel.style.opacity = 0;
        swipeControl[0].style.display = 'none';
        swipeControl[1].style.display = 'none';
        for (i = 0; i < this.sectionTags.length; i++) { // Set height to auto so we can dynamicaly adjust subtitles height
            this.sectionTags[i].style.height = 'auto';
        }
        this.handleSubtitlesPosition(0, true);
    }
};


Presenter.prototype.setContainer = function(c) {
    this.container = c.element;
};


// Rendering of DOM elements for Presenter

Presenter.prototype.renderControl = function() {
    // Set every <section> tag excluding the first one to not to be displayed
    this.sectionTags = this.container.getElementsByClassName('vts-presenter toolboxContainer')[0].querySelectorAll('section');

    const swipeControlUp = this.container.getElementsByClassName('vts-presenter swipeControl')[0];
    const swipeControlDw = this.container.getElementsByClassName('vts-presenter swipeControl')[1];

    const nextButton = document.createElement('button');
    nextButton.innerHTML = '<div><div></div></div>';
    nextButton.setAttribute('type','button');
    nextButton.setAttribute('class','vts-presenter-btnDw');
    nextButton.onclick = (function(){
        this.nextArticle('+1');
    }).bind(this);

    const prevButton = document.createElement('button');
    prevButton.innerHTML = '<div><div></div></div>';
    prevButton.setAttribute('type','button');
    prevButton.setAttribute('class','vts-presenter-btnUp');
    prevButton.onclick = (function(){
        this.nextArticle('-1');
    }).bind(this);

    // End of all buttons and other controllers

    swipeControlUp.appendChild(prevButton);
    swipeControlDw.appendChild(nextButton);

    this.getElementsTrueHeight(this.sectionTags);

    const offsetTop = this.maxHeight + this.swipeOffset;

    this.container.getElementsByClassName('vts-presenter panelContainer')[0].style.height = (offsetTop + this.swipeOffset) + 'px';
    swipeControlDw.style.top = offsetTop +'px';
    swipeControlUp.style.opacity = '1';
    swipeControlDw.style.opacity = '1';

    // init now
    setTimeout((function() {
        this.useToolbox();
    }).bind(this), this.animTime);
    this.nextArticle(0, false, this.sectionTags.length);
};


Presenter.prototype.getElementsTrueHeight = function(elems) {
    for (let i = 0; i < elems.length; i++) {
        if (elems[i].offsetHeight > this.maxHeight) {
            this.maxHeight = elems[i].offsetHeight;
        }
    }

    for (let i = 0; i < elems.length; i++) {
        elems[i].style.height = this.maxHeight + 'px';
    }
};


Presenter.prototype.handleArticle = function(node) {
    const rightPanel = this.container.getElementsByClassName('vts-presenter toolboxContainer')[0];
    const btnUp = this.container.getElementsByClassName('vts-presenter-btnUp')[0];
    const btnDw = this.container.getElementsByClassName('vts-presenter-btnDw')[0];

    const articleClass = (function(a) {
        this.container.getElementsByClassName('vts-presenter toolboxContainer')[0].querySelectorAll('article')[0].setAttribute('class',a);
    }).bind(this);

    const actualHeight = this.maxHeight * this.actualNode * -1;

    btnUp.setAttribute('class','vts-presenter-btnUp');
    btnDw.setAttribute('class','vts-presenter-btnDw');

    if (node === 0) {
        btnUp.setAttribute('class','vts-presenter-btnUp vts-presenter hidden');
    } else if (node === this.maxNodes-1) {
        btnDw.setAttribute('class','vts-presenter-btnDw vts-presenter hidden');
    }

    this.container.getElementsByTagName('article')[0].setAttribute('style','top: '+actualHeight+'px');

    if (this.actualNode === 0) {
        /* handle right panel stuff */
        rightPanel.style.height = (this.maxHeight + this.swipeOffset) + 'px';
        rightPanel.style.top = 0;
        articleClass('vts-presenter');
        /* done - now add some cosmetic attributes */
        this.container.getElementsByClassName('vts-presenter swipeControl')[0].style.height = 0;
        this.container.getElementsByTagName('article')[0].style.top = 0;
        this.container.getElementsByTagName('section')[0].style.height = (this.maxHeight + (this.swipeOffset - this.firstTitleMargin)) + 'px';
    } else {
        /* handle right panel stuff */
        rightPanel.style.height = this.maxHeight + 'px';
        rightPanel.style.top = this.swipeOffset + 'px';
        articleClass('vts-presenter nonFirst');
        /* done - now add some cosmetic attributes */
        this.container.getElementsByClassName('vts-presenter swipeControl')[0].style.height = this.swipeOffset + 'px';
        this.container.getElementsByTagName('section')[0].style.height = (this.maxHeight + this.swipeOffset) + 'px';
    }
    return true;
};


Presenter.prototype.handleSubtitlesPosition = function(node, init) {
    if (typeof node === 'undefined') {
        node = 0;
    }

    const subtitlesContainer = this.container.getElementsByClassName('vts-presenter subtitlesContainer')[0];
    const leftButton = subtitlesContainer.childNodes[0];
    const rightButton = subtitlesContainer.childNodes[1];
    const sections = subtitlesContainer.childNodes[4].querySelectorAll('article')[0].querySelectorAll('section');
    const swipeSubtitles = this.container.getElementsByClassName('vts-presenter swipeSubtitles');

    this.linksDecode(sections[node]);

    // clean all previous states
    sections[node].removeAttribute('style');
    subtitlesContainer.setAttribute('class','vts-presenter subtitlesContainer');
    subtitlesContainer.removeAttribute('onclick');
    swipeSubtitles[0].removeAttribute('onclick');
    swipeSubtitles[1].removeAttribute('onclick');
    swipeSubtitles[0].removeAttribute('style');
    swipeSubtitles[1].removeAttribute('style');
    leftButton.removeAttribute('onclick');
    rightButton.removeAttribute('onclick');
    leftButton.setAttribute('class', 'vts-presenter hidden');
    rightButton.setAttribute('class', 'vts-presenter hidden');

    for (let i = 0; i < sections.length; i++) {
        sections[i].style.opacity = 0;
        if (this.subtitlesHeights[i] === undefined) {
            sections[i].style.display = 'block';
            this.subtitlesHeights[i] = sections[i].offsetHeight;
            sections[i].style.display = 'none';
        }
        if (i !== node) {
            this.hideSections(sections[i]);
        }
    }
    this.showSections(sections[node]);

    let sectionType = sections[node].getAttribute('data-mln-style');
    if (sectionType == undefined) {
        sectionType = 'full';
    }

    if (sectionType == 'full') {
        swipeSubtitles[0].style.opacity = 0;
        swipeSubtitles[1].style.opacity = 0;
        swipeSubtitles[0].style.cursor = 'default';
        swipeSubtitles[1].style.cursor = 'default';

        if (node === 0) {
            leftButton.setAttribute('class', 'vts-presenter hidden');
            rightButton.setAttribute('class', 'vts-presenter');
            rightButton.onclick = (function() {
                this.nextArticle(1);
            }).bind(this);
            rightButton.innerHTML = 'Continue';
        } else if (node === sections.length - 2) { // One more before end
            leftButton.setAttribute('class', 'vts-presenter');
            leftButton.onclick = (function() {
                this.nextArticle('-1');
            }).bind(this);
            leftButton.innerHTML = 'Back';
            rightButton.setAttribute('class', 'vts-presenter');
            rightButton.onclick = (function() {
                this.nextArticle('+1');
            }).bind(this);
            rightButton.innerHTML = 'Explore';
        }
        if (typeof init === 'undefined') {
            subtitlesContainer.setAttribute('style', 'display: block;');
        }
        subtitlesContainer.setAttribute('class','vts-presenter subtitlesContainer full');
    } else if (sectionType == 'title') {
        swipeSubtitles[0].style.opacity = 1;
        swipeSubtitles[1].style.opacity = 1;
        swipeSubtitles[0].onclick = (function() {
            this.nextArticle('-1');
        }).bind(this);
        swipeSubtitles[1].onclick = (function() {
            this.nextArticle('+1');
        }).bind(this);
        leftButton.setAttribute('class', 'vts-presenter hidden');
        rightButton.setAttribute('class', 'vts-presenter hidden');
        subtitlesContainer.style.height = this.subtitlesHeights[node] + 'px';
        subtitlesContainer.setAttribute('class','vts-presenter subtitlesContainer title');

    } else if (sectionType == 'mini') {
        subtitlesContainer.setAttribute('style', 'display: block;');
        subtitlesContainer.setAttribute('class','vts-presenter subtitlesContainer mini');
        leftButton.setAttribute('class', 'vts-presenter hidden');
        rightButton.setAttribute('class', 'vts-presenter hidden');
    }
};



Presenter.prototype.hideSections = function(elem) {
    setTimeout(function() {
        elem.style.display = 'none';
    }, this.animTime);
};


Presenter.prototype.showSections = function(elem) {
    setTimeout(function() {
        elem.style.display = 'block';
        setTimeout(function() {
            elem.style.opacity = 1;
        }, 50);
    }, this.animTime);
};


export default Presenter;
