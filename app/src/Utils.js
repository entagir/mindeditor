export function openLink(link) {
    window.open(link, '_blank');
}

export function randomInteger(min, max) {
    const rand = min + Math.random() * (max + 1 - min);

    return Math.floor(rand);
}

export function darkColor(color, k = 0.9) {
    const colorArray = parseColor(color);
    colorArray[0] *= k;
    colorArray[1] *= k;
    colorArray[2] *= k;

    return stringifyColor(colorArray);
}

export function opacityColor(color, a = 0.5) {
    const colorArray = parseColor(color);
    colorArray[3] *= a;

    return stringifyColor(colorArray);
}

export function parseColor(colorString) {
    let cache, p = parseInt,
        color = colorString.replace(/\s/g, '');

    if (cache = /#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})/.exec(color))
        cache = [p(cache[1], 16), p(cache[2], 16), p(cache[3], 16)];
    else if (cache = /#([\da-fA-F])([\da-fA-F])([\da-fA-F])/.exec(color))
        cache = [p(cache[1], 16) * 17, p(cache[2], 16) * 17, p(cache[3], 16) * 17];
    else if (cache = /rgba\(([\d]+),([\d]+),([\d]+),([\d]+|[\d]*.[\d]+)\)/.exec(color))
        cache = [+cache[1], +cache[2], +cache[3], +cache[4]];
    else if (cache = /rgb\(([\d]+),([\d]+),([\d]+)\)/.exec(color))
        cache = [+cache[1], +cache[2], +cache[3]];
    else return [0, 0, 0, 0];

    isNaN(cache[3]) && (cache[3] = 1);

    return cache.slice(0, 4);
}

export function stringifyColor(colorArray) {
    return 'rgba(' + colorArray[0] + ',' + colorArray[1] + ',' + colorArray[2] + ',' + colorArray[3] + ')';
}

export function showNotification(text) {
    console.info(text);
}

export function tsToDateTime(dt, type='datetime') {
    if (!dt) {
        return;
    }

    let s = ``;
    if (type == 'datetime' || type == 'date') {
        s += `${f(dt.getDate())}.${f(dt.getMonth() + 1)}.${dt.getFullYear()}`;
    }
    if (type == 'datetime') {
        s += ` `;
    }
    if (type == 'datetime' || type == 'time') {
        s += `${f(dt.getHours())}:${f(dt.getMinutes())}:${f(dt.getSeconds())}`;
    }
    return s;

    function f(p) {
        p = p.toString();

        if (p.length == 1) {
            return '0' + p;
        } else {
            return p;
        }
    }
}

export function $(s) { 
    return document.querySelector(s);
}