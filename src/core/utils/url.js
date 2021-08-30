
const utilsUrl = {};


utilsUrl.isSameOrigin = function(url) {
    if (typeof url !== 'string') {
        return false;
    }
    const docHost = document.location.hostname;
    const parser = utilsUrl.parse(url);
    return parser['hostname'] === docHost;
};


utilsUrl.parse = function(url) {
    if (typeof url !== 'string') {
        return null;
    }

    const parser = document.createElement('a');
    parser['href'] = url;
    return parser;
};


utilsUrl.getParamsFromUrl = function(url) {
    const parser = utilsUrl.parse(url);
    const queryString = {};
    const query = parser['search'].substring(1);
    const vars = query.split('&');
    if (!(vars.length == 1 && vars[0] == '')) {
        for (let i = 0; i < vars.length; i++) {
            const pair = vars[i].split('=');
            if (typeof queryString[pair[0]] === 'undefined') {
                queryString[pair[0]] = pair[1];
            } else if (typeof queryString[pair[0]] === 'string') {
                const arr = [ queryString[pair[0]], pair[1] ];
                queryString[pair[0]] = arr;
            } else {
                queryString[pair[0]].push(pair[1]);
            }
        }
    }
    return queryString;
};


utilsUrl.getHost = function(url) {
    const location = document.createElement('a');
    location.href = url;
    return location.hostname;
};


utilsUrl.getSchema = function(url) {
    //if (window.location.href.indexOf("file://") != -1) {
    if (url.indexOf('http://') != -1) {
        return 'http:';
    } else if (url.indexOf('https://') != -1) {
        return 'https:';
    } else {
        const location = document.createElement('a');
        location.href = url;
        return location.protocol;
    }
};


utilsUrl.getOrigin = function(url) {
    const location = document.createElement('a');
    location.href = url;

    if (!location.origin) {  //IE11 hack
      return location.protocol + "//" + location.hostname + (location.port ? ':' + location.port: '');
    }

    return location.origin;
};


utilsUrl.getBase = function(url) {
    return url.split('?')[0].split('/').slice(0, -1).join('/')+'/';
};


utilsUrl.makeAbsolute = function(href) {
    const link = document.createElement("a");
    link.href = href;
    return link.href;
};

utilsUrl.getProcessUrl = function(url, originUrl) {
    if (!url || !originUrl) {
        return url;
    }

    url = url.trim();
    originUrl= originUrl.trim();
    const baseUrl = utilsUrl.getBase(originUrl);
    const baseUrlSchema = utilsUrl.getSchema(originUrl);
    const baseUrlOrigin = utilsUrl.getOrigin(originUrl);

    if (url.indexOf('://') != -1) { //absolute
        return url;
    } else if (url.indexOf('//') == 0) {  //absolute without schema
        return baseUrlSchema + url;
    } else if (url.indexOf('/') == 0) {  //absolute without host
        return baseUrlOrigin + url;
    } else {  //relative
        return baseUrl + url;
    }
};


export {utilsUrl};
