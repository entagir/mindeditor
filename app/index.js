import './style/main.css'
import './style/ui.css'
import './favicon.ico'

import { MindFile, MindMap } from './MindMap'
import { Loader } from './Loader'
import { Tlaloc } from './Tlaloc'

const host = 'http://localhost:8181/mindmap'; // Api host
const scaleCoef = 1.1; // For mouse whell
const animInterval = 1000 / 120; // Micro sec

let fontSize = parseInt(getComputedStyle(document.body).fontSize.slice(0, -2)); // Font size in px
let fontFamily = '';

let baseSize = fontSize * 1.25;
let transplantHoldZone = baseSize / 2;

let DEBUG = false;

let canvas;

let tabs;

let mindMaps = [];
let mindMap;
let mindMapNum = 0;

let onDrag = false;
let dragState = 0; // 0, 1, 2
let draggedElem;
let dragTimer;
let dragEnd = false;
let dragWait = false;
let dragWaitWorkspace = false;
let dragTransplant = false;

let onFilesDrag = false;

let animTimer;
let targetView = { x: 0, y: 0, scale: 1 }; // For anim

let contextElem;
let contextCoords = { x: 0, y: 0 };
let contextUp = false;
let contextFlag = false;

let renameMode = false;
let renameAuto = false;
let renamedNode;
let renamedNodeText = '';

let cursorOffset = { x: 0, y: 0 };
let canvasOffset = { x: 0, y: 0 };
let mindMapBox = { x: 0, y: 0, width: 0, height: 0 };
let bufferOfView = baseSize * 2;

let lastActiveNode = -1; // last active node index
let lastEvent;

let placeholder = 'Press to edit';
let defaultName = 'New mindmap';
let splashText = 'Use Double Click to add nodes';

let systemFilesList = {
    'menu': { name: 'Menu', path: 'static/system/Menu.json', version: 0, editable: false },
    'help': { name: 'Help', path: 'static/system/Help.json', version: 0, editable: false },
};
let samplesFilesList = [
    { name: 'Palms', path: 'static/samples/Palms.json', version: 0 },
    { name: 'MindEditor', path: 'static/samples/MindEditor.json', version: 0 },
];

let loadingSamples = false;

let colors = {};
colors['baseText'] = '#3d444f';
colors['placeHolderText'] = '#949494';
colors['background'] = '#fcfcfc';
colors['border'] = '#E9E9E9';
colors['borderCanvas'] = '#9e9e9e';
colors.branches = ['#e096e9', '#988ee3', '#7aa3e5', '#67d7c4', '#9ed56b', '#ebd95f', '#efa670', '#e68782'];
// colors.extra = ['#e23e2b', '#a65427', '#ffaa38', '#e8e525', '#69b500', '#0a660d', '#3e8975', '#0da7d3', '#075978', '#272727', '#5f5f5f', '#b4b4b4'];

let keys = { 'ctrl': false, 'shift': false, 'alt': false };

const workSpaceLoader = new Loader($('#work__loading-animation'));

window.onload = function () {
    init();
}

window.onunload = function () {
    saveTempMaps();
}

window.onresize = function () {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    if (!mindMap.editable) {
        setViewAuto();

        return;
    }

    draw(mindMap);
}

async function init() {
    const menu = Tlaloc.menu('menu');
    menu.addItem('MindEditor', function () { openMenu(); });
    menu.addItem('New', function () { newFile(); });
    menu.addItem('Open', function () { loadFromFile(); });
    menu.addItem('Save', function () { saveFile(); });
    menu.addItem('Close', function () { closeFile(); });

    tabs = Tlaloc.tabs('tabs');

    initColorsDialog(colors.branches);

    document.body.addEventListener('mouseleave', canvasMouseLeaved);

    canvas = $('#canvas');

    canvas.addEventListener('click', canvasClicked);
    canvas.addEventListener('mousemove', canvasMouseMoved);
    canvas.addEventListener('mouseover', canvasMouseMoved);
    canvas.addEventListener('mousedown', canvasMouseDowned);
    canvas.addEventListener('mouseup', canvasMouseUped);
    canvas.addEventListener('dblclick', canvasDblClicked);
    canvas.addEventListener('contextmenu', canvasContexted);
    canvas.addEventListener('wheel', canvasWhellHandler);

    document.body.addEventListener('keydown', bodyKeyDownHandler);
    document.body.addEventListener('keyup', bodyKeyUpHandler);

    canvas.addEventListener('drop', canvasFilesDroped);
    canvas.addEventListener('dragover', canvasFilesDragged);
    canvas.addEventListener('dragleave', canvasFilesDragLeaveHandler);
    const loader = $('#uploader');
    loader.addEventListener('change', loaderChanged);

    $('#rename-area').addEventListener('input', renameAreaInputed);
    $('#rename-area').addEventListener('keydown', renameAreaKeyDowned);
    $('#rename-area').addEventListener('mouseover', renameAreaMouseOver);
    $('#rename-area').addEventListener('blur', renameAreaBlured);
    $('#rename-area').addEventListener('wheel', function (e) { e.preventDefault(); });

    $('#dialogs-cont').addEventListener('mousedown', function (e) { if (e.target == this) { showDialog(); } });
    $('#button-name').addEventListener('click', renameMap);
    $('#button-save').addEventListener('click', saveMap);

    $('#context-branch__set-color').addEventListener('click', function () { showContextMenu('colorpicker'); });
    $('#context-branch__rename').addEventListener('click', renameSelectedNode);
    $('#context-branch__delete').addEventListener('click', deleteSelectedNode);

    $('#context-color-picker__color-picker__button').addEventListener('click', function () { $('#color-picker').click(); });
    $('#color-picker').addEventListener('change', colorPickerChanged);

    $('#context-canvas__add-root').addEventListener('click', contextAddRoot);
    $('#context-canvas__save').addEventListener('click', saveFile);
    $('#context-canvas__rename').addEventListener('click', function () { showDialog('rename'); });

    $('#input-name').placeholder = $('#input-save').placeholder = defaultName;

    const forms = document.querySelectorAll('form');
    for (let i of forms) {
        i.addEventListener('submit', function (e) { e.preventDefault(); });
    }

    setFontFamily('Arial');

    // Help map init
    mindMaps['help'] = new MindFile(systemFilesList['help'], 'system_help');

    // Menu map init and select
    mindMaps['menu'] = new MindFile(systemFilesList['menu'], 'system_menu', true);

    selectMindMap('menu');
    loadTempMaps();
}

function initColorsDialog(colors) {
    for (let i in colors) {
        const button = document.createElement('button');

        button.style.background = colors[i];
        button.style.color = colors[i];

        button.setAttribute('data-color', colors[i]);

        button.addEventListener('click', function (e) { selectColor(button); });

        $('#colors-cont').appendChild(button);
    }
}

async function loadSamples() {
    // Need samples list init

    const fileList = $('#file-list-samples');
    fileList.innerHTML = '';

    if (samplesFilesList == {}) {
        fileList.innerHTML = 'Not samples';
    }

    for (let i in samplesFilesList) {
        const button = document.createElement('button');
        button.innerHTML = samplesFilesList[i].name;
        button.addEventListener('click', function (e) {
            showDialog('');
            addMindMap(new MindFile(samplesFilesList[i], 'samples_' + samplesFilesList[i].path));

        });
        fileList.appendChild(button);
    }
}

function checkBounds() {
    if (DEBUG) { console.info('check'); }

    // Check nodes and titles width and height

    let tempScale = mindMap.view.scale;
    mindMap.view.scale = 1;

    let ctx = canvas.getContext('2d');

    for (let i in mindMap.nodes) {
        const node = mindMap.nodes[i];

        if (mindMap.nodes[i].parent === undefined) {
            let text = placeholder;
            drawRootText(ctx, node);

            node.textbox.width = ctx.measureText(text).width;
            node.textbox.height = ctx.measureText(text).actualBoundingBoxAscent + ctx.measureText(text).actualBoundingBoxDescent;

            node.boundbox.width = node.textbox.width + baseSize * 1.8;
            node.boundbox.height = node.textbox.height + baseSize * 1.8;

            if (node.name != '') {
                text = node.name;
                drawRootText(ctx, node);

                node.textbox.width = ctx.measureText(text).width;
                node.textbox.height = ctx.measureText(text).actualBoundingBoxAscent + ctx.measureText(text).actualBoundingBoxDescent;

                let currentBoundBox = { width: node.textbox.width + baseSize * 1.8, height: node.textbox.height + baseSize * 1.8 };

                if (currentBoundBox.width > node.boundbox.width) {
                    node.boundbox.width = currentBoundBox.width;
                }
                if (currentBoundBox.height > node.boundbox.height) {
                    node.boundbox.height = currentBoundBox.height;
                }
            }

            node.boundbox.x = node.x - node.boundbox.width / 2;
            node.boundbox.y = node.y - node.boundbox.height / 2;

            node.textbox.x = node.x - node.textbox.width / 2;
            node.textbox.y = node.y - node.textbox.height / 2;
        } else {
            // Check joint
            if (node.parent.parent === undefined) {
                let jointsCoords = [];
                jointsCoords[0] = { x: node.parent.x, y: node.parent.y - node.parent.boundbox.height / 2 };
                jointsCoords[1] = { x: node.parent.x + node.parent.boundbox.width / 2, y: node.parent.y };
                jointsCoords[2] = { x: node.parent.x, y: node.parent.y + node.parent.boundbox.height / 2 };
                jointsCoords[3] = { x: node.parent.x - node.parent.boundbox.width / 2, y: node.parent.y };

                if (node.joint == 0) {
                    if (node.y > jointsCoords[0].y) {
                        if (node.x < jointsCoords[3].x) { node.joint = 3; }
                        if (node.x > jointsCoords[1].x) { node.joint = 1; }
                        if (node.y > jointsCoords[2].y) { node.joint = 2; }
                    }
                } else if (node.joint == 1) {
                    if (node.x < jointsCoords[1].x) {
                        if (node.y > jointsCoords[2].y) { node.joint = 2; }
                        if (node.y < jointsCoords[0].y) { node.joint = 0; }
                        if (node.x < jointsCoords[3].x) { node.joint = 3; }
                    }
                } else if (node.joint == 2) {
                    if (node.y < jointsCoords[2].y) {
                        if (node.x < jointsCoords[3].x) { node.joint = 3; }
                        if (node.y < jointsCoords[0].y) { node.joint = 0; }
                        if (node.x > jointsCoords[1].x) { node.joint = 1; }
                    }
                } else {
                    if (node.x > jointsCoords[3].x) {
                        if (node.y < jointsCoords[0].y) { node.joint = 0; }
                        if (node.x > jointsCoords[1].x) { node.joint = 1; }
                        if (node.y > jointsCoords[2].y) { node.joint = 2; }
                    }
                }
            }

            // Check node direction
            if (node.dir == 'right' && node.parent.x > node.x) {
                node.dir = 'left';

                for (let i in node.childs) {
                    changeNodeDir(node.childs[i]);
                }
            } else if (node.dir == 'left' && node.parent.x <= node.x) {
                node.dir = 'right';

                for (let i in node.childs) {
                    changeNodeDir(node.childs[i]);
                }
            }

            // Check node text
            if (!node.textbox.minWidth) // Or changed font
            {
                let text = placeholder;
                drawNodeText(ctx, node);

                node.textbox.minWidth = ctx.measureText(text).width;
                node.textbox.minHeight = ctx.measureText(text).actualBoundingBoxAscent + ctx.measureText(text).actualBoundingBoxDescent;

            }

            let text = node.name || placeholder;
            drawNodeText(ctx, node);

            node.textbox.width = ctx.measureText(text).width;
            node.textbox.height = ctx.measureText(text).actualBoundingBoxAscent + ctx.measureText(text).actualBoundingBoxDescent;
            if (node.textbox.height < node.textbox.minHeight) { node.textbox.height = node.textbox.minHeight; }

            let textOffset = { x: 0, y: 0 };

            if (node.childs.length == 0) {
                textOffset.x = baseSize * 1.25;

                if (node.parent.x > node.x) {
                    textOffset.x *= -1;
                }
            } else {
                textOffset.x = baseSize * 0.75;

                if (node.parent.x <= node.x) {
                    textOffset.x *= -1;
                }

                textOffset.y = baseSize * 1.25;

                if (node.parent.y >= node.y) {
                    textOffset.y *= -1;
                }
            }

            node.textbox.x = node.x + textOffset.x;

            if (textOffset.x < 0) {
                node.textbox.x -= node.textbox.width
            }

            node.textbox.y = node.y + textOffset.y - node.textbox.height / 2;
        }
    }

    // Calculate mind map boundbox
    let mindMapRect = { left: Infinity, top: Infinity, right: 0, bottom: 0 };

    for (let i in mindMap.nodes) {
        const x = mindMap.nodes[i].x;
        const y = mindMap.nodes[i].y;

        let textbox = mindMap.nodes[i].textbox;
        if (mindMap.nodes[i].parent === undefined) {
            textbox = mindMap.nodes[i].boundbox;
        }

        if (x < mindMapRect.left) { mindMapRect.left = x; }
        if (textbox.x < mindMapRect.left) {
            mindMapRect.left = textbox.x;
        }

        if (x > mindMapRect.right) { mindMapRect.right = x; }
        if (textbox.x + textbox.width > mindMapRect.right) {
            mindMapRect.right = textbox.x + textbox.width;
        }

        if (y < mindMapRect.top) { mindMapRect.top = y; }
        if (textbox.y < mindMapRect.top) {
            mindMapRect.top = textbox.y;
        }

        if (y > mindMapRect.bottom) { mindMapRect.bottom = y; }
        if (textbox.y + textbox.height > mindMapRect.bottom) {
            mindMapRect.bottom = textbox.y + textbox.height;
        }
    }

    mindMapBox = { x: mindMapRect.left, y: mindMapRect.top, width: mindMapRect.right - mindMapRect.left, height: mindMapRect.bottom - mindMapRect.top };

    mindMap.view.scale = tempScale;
}

function draw(mindMap, canvasElem) {
    if (!canvasElem) {
        canvasElem = canvas;
    }
    canvasElem.width = canvasElem.width;
    const ctx = canvasElem.getContext('2d');

    ctx.fillStyle = colors['background'];
    ctx.fillRect(0, 0, canvasElem.width, canvasElem.height);

    if (mindMap.nodes.length == 0) {
        drawSplash(ctx);

        return;
    }

    // Draw branches
    for (let i in mindMap.nodes) {
        if (mindMap.nodes[i].parent) {
            // Joint offset respect to elem center
            let startLine = { x: 0, y: 0 };

            if (mindMap.nodes[i].parent.parent === undefined) {
                // Root elem to node branch

                let parent = mindMap.nodes[i].parent;

                if (mindMap.nodes[i].joint == 0) { startLine = { x: 0, y: -parent.boundbox.height / 2 }; }
                if (mindMap.nodes[i].joint == 1) { startLine = { x: parent.boundbox.width / 2, y: 0 }; }
                if (mindMap.nodes[i].joint == 2) { startLine = { x: 0, y: parent.boundbox.height / 2 }; }
                if (mindMap.nodes[i].joint == 3) { startLine = { x: -parent.boundbox.width / 2, y: 0 }; }
            }

            // Draw parent to child (this) branch
            let branchStart = {
                x: mindMap.nodes[i].parent.x + startLine.x,
                y: mindMap.nodes[i].parent.y + startLine.y
            };
            let branchEnd = { x: mindMap.nodes[i].x, y: mindMap.nodes[i].y };

            drawEdge(ctx, project(branchStart), project(branchEnd), mindMap.nodes[i].color);
        }
    }

    // Draw nodes
    for (let i in mindMap.nodes) {
        if (mindMap.nodes[i].parent) {
            // Draw child elem
            drawNode(ctx, mindMap.nodes[i]);
        } else {
            // Draw root elem
            drawRootNode(ctx, mindMap.nodes[i]);
        }
    }

    if (onFilesDrag) { drawCanvasBorder(ctx); }

    if (DEBUG) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors['border'];
        const mindMapBoxPoint = project({ x: mindMapBox.x, y: mindMapBox.y });
        ctx.strokeRect(mindMapBoxPoint.x, mindMapBoxPoint.y, mindMapBox.width, mindMapBox.height);
    }
}

function drawRootNode(ctx, node) {
    const point = project({ x: node.x, y: node.y });

    ctx.fillStyle = node.color;

    drawRoundedRect(ctx, point.x - node.boundbox.width / 2 * mindMap.view.scale, point.y - node.boundbox.height / 2 * mindMap.view.scale, node.boundbox.width * mindMap.view.scale, node.boundbox.height * mindMap.view.scale, baseSize / 2 * mindMap.view.scale);
    drawRootText(ctx, node);

    if (!(renameMode && renamedNode == node)) {
        // Draw connectors ("+" circles)
        drawConnector(ctx, point.x, point.y - node.boundbox.height / 2 * mindMap.view.scale, node.color, node.jointState == 0 ? 1 : 0);
        drawConnector(ctx, point.x + node.boundbox.width / 2 * mindMap.view.scale, point.y, node.color, node.jointState == 1 ? 1 : 0);
        drawConnector(ctx, point.x, point.y + node.boundbox.height / 2 * mindMap.view.scale, node.color, node.jointState == 2 ? 1 : 0);
        drawConnector(ctx, point.x - node.boundbox.width / 2 * mindMap.view.scale, point.y, node.color, node.jointState == 3 ? 1 : 0);
    }
}

function drawNode(ctx, node) {
    const point = project({ x: node.x, y: node.y });

    const state = node.state;

    // Draw connector
    drawConnector(ctx, point.x, point.y, node.color, state);

    // Draw text
    drawNodeText(ctx, node);
}

function drawEdge(ctx, start, end, color) {
    ctx.beginPath();

    drawBezier(start.x, start.y, end.x, end.y);

    ctx.lineWidth = baseSize * 0.4 * mindMap.view.scale;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.closePath();

    function drawBezier(xs, ys, xf, yf) {
        let p1x = xs + (xf - xs) / 2;
        let p1y = ys;

        let p2x = xs + (xf - xs) / 2;
        let p2y = yf;

        ctx.moveTo(xs, ys);
        ctx.bezierCurveTo(p1x, p1y, p2x, p2y, xf, yf);

        if (DEBUG) {
            ctx.fillStyle = colors['baseText'];

            ctx.fillRect(p1x, p1y, baseSize / 2, baseSize / 2);
            ctx.fillRect(p2x, p2y, baseSize / 2, baseSize / 2);
        }
    }
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x, y + radius);
    ctx.arcTo(x, y + height, x + radius, y + height, radius);
    ctx.arcTo(x + width, y + height, x + width, y + height - radius, radius);
    ctx.arcTo(x + width, y, x + width - radius, y, radius);
    ctx.arcTo(x, y, x, y + radius, radius);
    ctx.fill();
    ctx.closePath();
}

function drawRootText(ctx, node) {
    const point = project({ x: node.x, y: node.y });

    let text = placeholder;
    if (node.name != '') { text = node.name; }

    ctx.fillStyle = colors['baseText'];
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + baseSize * mindMap.view.scale + 'px ' + fontFamily;
    ctx.fillText(text, point.x, point.y);

    if (DEBUG) {
        let textboxCoords = project({ x: node.textbox.x, y: node.textbox.y });

        ctx.strokeStyle = colors['baseText'];
        ctx.strokeRect(textboxCoords.x, textboxCoords.y, node.textbox.width, node.textbox.height);;
    }
}

function drawNodeText(ctx, node) {
    ctx.font = 'bold ' + baseSize * 0.75 * mindMap.view.scale + 'px ' + fontFamily;
    ctx.fillStyle = colors['placeHolderText'];
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    let text = placeholder;
    if (node.name != '') {
        text = node.name;
        ctx.fillStyle = node.colorDark || node.color;
    }

    let textboxCoords = project({ x: node.textbox.x, y: node.textbox.y });

    ctx.fillText(text, textboxCoords.x, textboxCoords.y + node.textbox.height / 2 * mindMap.view.scale);

    if (DEBUG) {
        ctx.strokeStyle = colors['baseText'];
        ctx.strokeRect(textboxCoords.x, textboxCoords.y, node.textbox.width, node.textbox.height);

        ctx.fillStyle = node.colorDark || node.color;
        ctx.fillRect(textboxCoords.x, textboxCoords.y, baseSize / 4, baseSize / 4);
    }

    if (node.action) {
        ctx.fillRect(textboxCoords.x, textboxCoords.y + node.textbox.height * mindMap.view.scale, node.textbox.width * mindMap.view.scale, 0.5 * mindMap.view.scale);
    }
}

function drawConnector(ctx, x, y, color, state) {
    const active = state > 0;

    // Draw circle
    ctx.beginPath();

    ctx.fillStyle = color;
    ctx.lineWidth = 2 * mindMap.view.scale;
    ctx.strokeStyle = colors['background'];
    let r = baseSize / 4;
    if (active) {
        r = baseSize * 0.625;
        ctx.strokeStyle = colors['border'];
    }

    ctx.arc(x, y, r * mindMap.view.scale, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.stroke();

    ctx.closePath();

    // Draw text
    ctx.fillStyle = colors['background'];
    if (state == 1) { drawPlus(ctx, x, y, r * 1.5 * mindMap.view.scale, baseSize / 5 * mindMap.view.scale); } else if (state == 2) {
        ctx.font = 'bold ' + r * 2 * mindMap.view.scale + 'px ' + fontFamily;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        ctx.fillText('~', x, y);
    }
}

function drawPlus(ctx, x, y, width, lineWidth) {
    ctx.fillRect(x - lineWidth / 2, y - width / 2, lineWidth, width);
    ctx.fillRect(x - width / 2, y - lineWidth / 2, width, lineWidth);
}

function drawSplash(ctx) {
    ctx.fillStyle = colors['baseText'];
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + baseSize * mindMap.view.scale + 'px ' + fontFamily;
    ctx.fillText(splashText, canvas.width / 2, canvas.height / 2);
}

function drawCanvasBorder(ctx) {
    ctx.strokeStyle = colors['borderCanvas'];
    ctx.lineWidth = 10;
    ctx.setLineDash([15, 10]);

    ctx.strokeRect(0, 0, canvas.width, canvas.height);
}

function calculateNodeCoords(node, jointNum) {
    let center = { x: node.x, y: node.y }; // Center of circle
    let radius = 160; // Radius of circle

    let nodeStartAngle = 0;

    if (node.parent) {
        // Node
        if (node.dir == 'left') { nodeStartAngle += 90; } else { nodeStartAngle -= 90; }
    } else {
        // Root
        if (jointNum == 0) {
            center.y -= node.boundbox.height / 2;
            nodeStartAngle += 180;
        }
        if (jointNum == 1) {
            center.x += node.boundbox.width / 2;
            nodeStartAngle -= 90;
        }
        if (jointNum == 2) {
            center.y += node.boundbox.height / 2;
            nodeStartAngle -= 0;
        }
        if (jointNum == 3) {
            center.x -= node.boundbox.width / 2;
            nodeStartAngle += 90;
        }
    }

    let currentSectorAngle = 90;

    while (true) {
        let currentStartAngle = 90 - currentSectorAngle / 2;
        let currentStartAngleOffset = 0;

        let mirror = -1;

        while (true) {
            // Check exist node in current sector

            let resultStartAngle = currentStartAngle;

            if (jointNum == 0 || jointNum == 1) { resultStartAngle += currentStartAngleOffset * mirror; } else { resultStartAngle -= currentStartAngleOffset * mirror; }

            mirror *= -1; // Reverse mirror

            let left = radius * Math.cos((nodeStartAngle + resultStartAngle) * Math.PI / 180) + center.x;
            let right = radius * Math.cos((nodeStartAngle + resultStartAngle + currentSectorAngle) * Math.PI / 180) + center.x;
            let top = radius * Math.sin((nodeStartAngle + resultStartAngle) * Math.PI / 180) + center.y;
            let bottom = radius * Math.sin((nodeStartAngle + resultStartAngle + currentSectorAngle) * Math.PI / 180) + center.y;

            let find = false;

            for (let i in node.childs) {
                // If current connector
                if (node.parent || node.childs[i].joint == jointNum) {
                    if (!node.parent && jointNum == 0) {
                        if (node.childs[i].x > left && node.childs[i].x < right) { find = true; }
                    }
                    if (!node.parent && jointNum == 2) {
                        if (node.childs[i].x > right && node.childs[i].x < left) { find = true; }
                    }

                    if (!node.parent && jointNum == 1 || node.parent && node.dir == 'right') {
                        if (node.childs[i].y > top && node.childs[i].y < bottom) { find = true; }
                    }
                    if (!node.parent && jointNum == 3 || node.parent && node.dir == 'left') {
                        if (node.childs[i].y > bottom && node.childs[i].y < top) { find = true; }
                    }

                    if (find) { break; }
                }
            }

            if (!find) {
                // Calculate node coords in middle of current sector
                let newNodeAngle = (nodeStartAngle + resultStartAngle + currentSectorAngle / 2) * Math.PI / 180;

                let newNodeCoords = { x: 0, y: 0 };
                newNodeCoords.x = radius * Math.cos(newNodeAngle) + center.x;
                newNodeCoords.y = radius * Math.sin(newNodeAngle) + center.y;

                return newNodeCoords;
            }

            if (mirror == -1) {
                currentStartAngleOffset += currentSectorAngle / 2;

                if (currentStartAngle - currentStartAngleOffset < 0) { break; }
            }
        }

        currentSectorAngle /= 2;
    }
}

function rename(node, auto) {
    const text = node.name;
    let fs = baseSize; // Font Size (in px)

    if (node.parent === undefined) {
        fs = baseSize;
    } else {
        fs = baseSize * 0.75;
    }

    renameAreaSet(node);

    let renameArea = $('#rename-area');
    renameArea.style.display = 'block';
    renameArea.style.fontSize = fs * mindMap.view.scale + 'px';
    renameArea.value = renamedNodeText = text;

    renameArea.focus();

    renameMode = true;
    renameAuto = auto || false;
    renamedNode = node;

    draw(mindMap);
}

function renameAreaSet(node) {
    const renameArea = $('#rename-area');

    let point = project({ x: node.x, y: node.y });
    let rect = { width: 0, height: 0 };
    let borderRadius = baseSize / 2 * mindMap.view.scale;

    if (node.parent === undefined) {
        // Root elem
        rect.width = node.boundbox.width + 2;
        rect.height = node.boundbox.height + 2;

        point.x -= rect.width / 2 * mindMap.view.scale;
        point.y -= rect.height / 2 * mindMap.view.scale;
    } else {
        let renameAreaPadding = { width: baseSize * 1.25, height: baseSize * 0.75 };

        point = project({ x: node.textbox.x, y: node.textbox.y });
        point.x -= renameAreaPadding.width / 2 * mindMap.view.scale;
        point.y -= renameAreaPadding.height / 2 * mindMap.view.scale;

        if (node.textbox.width > node.textbox.minWidth) {
            rect.width = node.textbox.width + renameAreaPadding.width;
        } else {
            rect.width = node.textbox.minWidth + renameAreaPadding.width;

            if (node.textbox.x < node.x) {
                point.x += node.textbox.width - node.textbox.minWidth;
            }
        }

        if (node.textbox.height > node.textbox.minHeight) {
            rect.height = node.textbox.height + renameAreaPadding.height;
        } else {
            rect.height = node.textbox.minHeight + renameAreaPadding.height;
        }
    }

    renameArea.style.left = point.x + 'px';
    renameArea.style.top = point.y + 'px';
    renameArea.style.width = rect.width * mindMap.view.scale + 'px';
    renameArea.style.height = rect.height * mindMap.view.scale + 'px';
    renameArea.style.borderRadius = borderRadius + 'px';
}

function completeRename(abort) {
    renameMode = false;

    const renameArea = $('#rename-area');
    if (abort) {
        renamedNode.name = renamedNodeText;
    } else {
        renamedNode.name = renameArea.value.trim();
    }
    checkBounds();

    renameArea.style.display = 'none';
}

function completeDrag(e, reset) {
    clearTimeout(dragTimer);
    dragWait = false;
    dragWaitWorkspace = false;

    if (onDrag) {
        onDrag = false;

        canvasMouseMoved(e);

        return;
    }

    if (dragState == 1 || dragState == 2) {
        if (reset) {
            resetLastActiveNode();
            dragState = 0;
            canvas.style.cursor = 'grab';
        } else {
            dragState = 1;
            canvas.style.cursor = 'pointer';
        }

        dragTransplant = false;

        canvasMouseMoved(e);

        return;
    }
}

function deleteSelectedNode() {
    lastActiveNode = -1;

    showContextMenu();

    mindMap.deleteNode(contextElem, true);
    checkBounds();

    draw(mindMap);
}

function renameSelectedNode() {
    showContextMenu();

    rename(contextElem);
}

function resetLastActiveNode() {
    if (lastActiveNode == -1) return;

    if (mindMap.nodes[lastActiveNode].parent) {
        mindMap.nodes[lastActiveNode].state = 0;
    } else {
        mindMap.nodes[lastActiveNode].jointState = -1;
    }
}

function moveNode(node, offsetX, offsetY) {
    node.x -= offsetX;
    node.y -= offsetY;

    for (let i in node.childs) {
        moveNode(node.childs[i], offsetX, offsetY);
    }
}

function transplateNode(branch, node) {
    branch.parent.childs.splice(branch.parent.childs.indexOf(branch), 1);

    branch.parent = node;
    node.childs.push(branch);
}

function distance(nodeA, nodeB) {
    if ((nodeA.parent && nodeB.parent) || !(nodeA.parent || nodeB.parent)) {
        return cartesianDist(nodeA, nodeB);
    }

    if (nodeA.parent) {
        return distToParent(nodeB, nodeA);
    }

    return distToParent(nodeA, nodeB);

    function cartesianDist(nodeA, nodeB) {
        return Math.sqrt(Math.pow(nodeA.x - nodeB.x, 2) + Math.pow(nodeA.y - nodeB.y, 2));
    }

    function distToParent(parentNode, node) {
        const distToJoint0 = cartesianDist({ x: parentNode.x, y: parentNode.y - parentNode.boundbox.height / 2 }, node);
        const distToJoint1 = cartesianDist({ x: parentNode.x + parentNode.boundbox.width / 2, y: parentNode.y }, node);
        const distToJoint2 = cartesianDist({ x: parentNode.x, y: parentNode.y + parentNode.boundbox.height / 2 }, node);
        const distToJoint3 = cartesianDist({ x: parentNode.x - parentNode.boundbox.width / 2, y: parentNode.y }, node);

        return Math.min(distToJoint0, distToJoint1, distToJoint2, distToJoint3);
    }
}

function dfsNode(node, action) {
    action(node);

    for (let i in node.childs) {
        dfsNode(node.childs[i], action)
    }
}

function changeNodeDir(node) {
    const offset = Math.abs(node.x - node.parent.x) * 2;

    if (node.dir == 'right') {
        moveNode(node, offset, 0);
        node.dir = 'left';
    } else {
        moveNode(node, -offset, 0);
        node.dir = 'right';
    }

    for (let i in node.childs) {
        changeNodeDir(node.childs[i]);
    }
}

function canvasClicked(e) {
    // Complete drag if drag mode 
    if (dragEnd) {
        dragEnd = false;

        if (contextFlag) {
            contextFlag = false;
            canvasMouseMoved(e);
        }

        return;
    }

    let renamed = false;
    // Complete rename if rename mode 
    if (renameMode) {
        completeRename();
        canvasMouseMoved(e);

        renamed = !renameAuto;
    }

    if (contextFlag) {
        contextFlag = false;
        canvasMouseMoved(e);

        return;
    }

    // Click on node
    for (let i in mindMap.nodes) {
        if (mindMap.editable && mindMap.nodes[i].parent === undefined) {
            // Root elem
            if (!renamed) {
                // "+" circles
                let jointNum = isOverRootJoint(e, mindMap.nodes[i]);
                if (jointNum != -1) {
                    // Add branch
                    let coords = calculateNodeCoords(mindMap.nodes[i], jointNum);
                    let addedNode = addNode(mindMap, coords.x, coords.y, '', jointNum, mindMap.nodes[i]);

                    checkBounds();
                    draw(mindMap);
                    rename(addedNode, true);

                    return;
                }
            }

            // Root elem shape
            if (isOverRoot(e, mindMap.nodes[i])) {
                rename(mindMap.nodes[i]);

                return;
            }
        } else {
            // Node
            if (mindMap.editable && !renamed && isOverNode(e, mindMap.nodes[i])) {
                // Add sub-branch
                let coords = calculateNodeCoords(mindMap.nodes[i]);
                let addedNode = addNode(mindMap, coords.x, coords.y, '', undefined, mindMap.nodes[i]);

                checkBounds();
                draw(mindMap);
                rename(addedNode, true);

                return;
            }

            if (isOverNodeText(e, mindMap.nodes[i])) {
                if (mindMap.editable) {
                    rename(mindMap.nodes[i]);
                } else {
                    if (mindMap.nodes[i].action) {
                        switch (mindMap.nodes[i].action) {
                            case 'new':
                                newFile();
                                break;
                            case 'open':
                                loadFromFile();
                                break;
                            case 'help':
                                openHelp();
                                break;
                            case 'samples':
                                openSamples();
                                break;
                            case 'git':
                                openLink('https://github.com/entagir/mindeditor');
                                break;
                        }
                    }
                }

                return;
            }
        }
    }

    // Click on canvas
}

function canvasContexted(e) {
    e.preventDefault();
    if (workSpaceLoader.onLoading) { return; }

    if (!mindMap.editable) { return; }

    // Complete rename if rename mode 
    if (renameMode) {
        completeRename();
        canvasMouseMoved(e);
    }

    for (let i in mindMap.nodes) {
        if (mindMap.nodes[i].parent === undefined) {
            // Root elem or "+" circles
            if (isOverRoot(e, mindMap.nodes[i]) || isOverRootJoint(e, mindMap.nodes[i]) > -1) {
                contextElem = mindMap.nodes[i];

                showContextMenu('branch', e.offsetX, e.offsetY);
                resetLastActiveNode();

                return;
            }
        } else {
            // Over node ("+") or node text (label)
            if (isOverNode(e, mindMap.nodes[i]) || isOverNodeText(e, mindMap.nodes[i])) {
                contextElem = mindMap.nodes[i];

                showContextMenu('branch', e.offsetX, e.offsetY);
                resetLastActiveNode();

                return;
            }
        }
    }

    showContextMenu('canvas', e.offsetX, e.offsetY);
}

function canvasMouseMoved(e) {
    if (workSpaceLoader.onLoading) { return; }
    if (contextUp) { return; }

    if (dragWait) {
        clearTimeout(dragTimer);
        initDrag();
    }

    if (dragWaitWorkspace) {
        clearTimeout(dragTimer);
        initDragWorkspace();
    }

    if (!e) return;

    lastEvent = e;

    const x = e.offsetX;
    const y = e.offsetY;

    // Drag workspace
    if (onDrag) {
        if (!mindMap.editable) {
            let newView = { x: mindMap.view.x + x - canvasOffset.x, y: mindMap.view.y + y - canvasOffset.y };

            let viewBounds = {
                left: mindMapBox.x,
                top: mindMapBox.y,
                right: mindMapBox.x + mindMapBox.width,
                bottom: mindMapBox.y + mindMapBox.height
            };

            let maxSpace = { x: canvas.width / 2, y: canvas.height / 2 };

            // X collision
            if (newView.x < -(viewBounds.right - maxSpace.x)) {
                mindMap.view.x = -(viewBounds.right - maxSpace.x);
            } else if (newView.x > -(viewBounds.left + maxSpace.x - canvas.width)) {
                mindMap.view.x = -(viewBounds.left + maxSpace.x - canvas.width);
            } else {
                mindMap.view.x = newView.x;
            }

            // Y collision
            if (newView.y < -(viewBounds.bottom - maxSpace.y)) {
                mindMap.view.y = -(viewBounds.bottom - maxSpace.y);
            } else if (newView.y > -(viewBounds.top + maxSpace.y - canvas.height)) {
                mindMap.view.y = -(viewBounds.top + maxSpace.y - canvas.height);
            } else {
                mindMap.view.y = newView.y;
            }
        } else {
            shiftView(x - canvasOffset.x, y - canvasOffset.y);
        }

        canvasOffset.x = x;
        canvasOffset.y = y;

        setTargetView();

        draw(mindMap);

        if (renameMode) {
            renameAreaSet(renamedNode);
        }

        return;
    }

    // Drag object
    if (dragState == 2) {
        const cursor = unproject({ x: e.offsetX, y: e.offsetY });

        const elemOffsetX = draggedElem.x - (cursor.x - cursorOffset.x);
        const elemOffsetY = draggedElem.y - (cursor.y - cursorOffset.y);

        moveNode(draggedElem, elemOffsetX, elemOffsetY);

        // Init transplant. Mark child nodes as not connectable
        if (!dragTransplant && keys['shift'] && draggedElem.parent) {
            for (let i in mindMap.nodes) {
                mindMap.nodes[i]['transplant'] = false;
            }

            dfsNode(draggedElem, function (node) { node['transplant'] = true; });

            dragTransplant = true;

            draggedElem.state = 2;
        }

        if (dragTransplant) {
            let dist = distance(draggedElem, draggedElem.parent) - transplantHoldZone;
            if (dist < 0) dist = 0;
            let nearNode = draggedElem.parent;

            for (let i in mindMap.nodes) {
                if (mindMap.nodes[i].transplant || draggedElem.parent == mindMap.nodes[i]) { continue; }

                const curDist = distance(draggedElem, mindMap.nodes[i]);

                if (curDist < dist) {
                    nearNode = mindMap.nodes[i];
                    dist = curDist;
                }
            }

            if (nearNode != draggedElem.parent) {
                transplateNode(draggedElem, nearNode);
            }
        } else if (draggedElem.state == 2) { draggedElem.state = 1; }

        checkBounds();
        draw(mindMap);

        if (renameMode) {
            renameAreaSet(renamedNode);
        }

        return;
    }

    resetLastActiveNode();

    for (let i in mindMap.nodes) {
        if (mindMap.editable && mindMap.nodes[i].parent === undefined) {
            const jointIndex = isOverRootJoint(e, mindMap.nodes[i]);

            // Root elem
            // "+" circles
            if (!renameMode || renameAuto) {
                mindMap.nodes[i].jointState = jointIndex;

                draw(mindMap);
            }

            // Root elem
            if (isOverRoot(e, mindMap.nodes[i]) || (jointIndex > -1 && (!renameMode || renameAuto))) {
                lastActiveNode = i;

                canvas.style.cursor = 'pointer';
                dragState = 1;

                return;
            }
        } else {
            // Over node ("+") or Over Node text (label)
            const overText = isOverNodeText(e, mindMap.nodes[i]);
            if (mindMap.editable && (!renameMode || renameAuto) && (isOverNode(e, mindMap.nodes[i]) || overText)) {
                lastActiveNode = i;

                if (!overText) {
                    if (keys['shift']) {
                        mindMap.nodes[i].state = 2;
                    } else {
                        mindMap.nodes[i].state = 1;
                    }
                }

                canvas.style.cursor = 'pointer';
                dragState = 1;

                draw(mindMap);

                return;
            }
        }
    }

    dragState = 0;
    canvas.style.cursor = 'grab';

    draw(mindMap);
}

function canvasMouseDowned(e) {
    if (workSpaceLoader.onLoading) { return; }
    if (renameMode && !renameAuto) { return; }

    const x = e.offsetX;
    const y = e.offsetY;

    if (contextUp) {
        showContextMenu();
        contextFlag = true;
        canvasMouseMoved(e);
    }

    if (e.which == 3) { return; }

    if (dragWait || dragWaitWorkspace) { return; }

    if (mindMap.editable) {
        for (let i in mindMap.nodes) {
            if (mindMap.nodes[i].parent === undefined) {
                // Root elem
                if (isOverRoot(e, mindMap.nodes[i]) || isOverRootJoint(e, mindMap.nodes[i]) > -1) {
                    if (dragState == 1) {
                        initDragElem(mindMap.nodes[i]);
                    }

                    return;
                }
            } else {
                // Over node ("+") or Over Node text (label)
                if (isOverNode(e, mindMap.nodes[i]) || isOverNodeText(e, mindMap.nodes[i])) {
                    if (dragState == 1) {
                        initDragElem(mindMap.nodes[i]);
                    }

                    return;
                }
            }
        }
    }

    if (e.which == 1 && mindMap.view.moveable) {
        initDragWorkspace();

        return;
    }

    function initDragElem(node) {
        const cursor = unproject({ x: e.offsetX, y: e.offsetY });

        draggedElem = node;

        cursorOffset.x = cursor.x - node.x;
        cursorOffset.y = cursor.y - node.y;

        draw(mindMap);

        clearTimeout(dragTimer);
        dragTimer = setTimeout(initDrag, 200, e);
        dragWait = true;
    }

    function initDragWorkspace() {
        canvasOffset.x = x;
        canvasOffset.y = y;

        clearTimeout(dragTimer);
        dragTimer = setTimeout(initDragWorkspace, 200, e);
        dragWaitWorkspace = true;
    }
}

function canvasMouseUped(e) {
    if (workSpaceLoader.onLoading) { return; }

    completeDrag(e);
}

function canvasMouseLeaved(e) {
    completeDrag(e, true);
}

function canvasDblClicked(e) {
    if (workSpaceLoader.onLoading) { return; }
    if (!mindMap.editable) { return; }

    for (let i in mindMap.nodes) {
        if (mindMap.nodes[i].parent === undefined) {
            // "+" circles
            let jointNum = isOverRootJoint(e, mindMap.nodes[i]);
            if (jointNum != -1) {
                return;
            }

            // Root elem
            if (isOverRoot(e, mindMap.nodes[i])) {
                return;
            }
        } else {
            // Over node ("+")
            if (isOverNode(e, mindMap.nodes[i])) {
                return;
            }

            // Over Node text (label)
            if (isOverNodeText(e, mindMap.nodes[i])) {
                return;
            }
        }
    }

    // Double click on canvas
    let cursor = unproject({ x: e.offsetX, y: e.offsetY });
    addNode(mindMap, cursor.x, cursor.y);

    checkBounds();
    canvasMouseMoved(e); // Draw
}

function canvasWhellHandler(e) {
    e.preventDefault();

    if (!mindMap.editable || renameMode) { return; }

    const x = e.offsetX;
    const y = e.offsetY;

    if (keys['ctrl']) {
        // Zoom
        const currentScaling = Math.abs(e.deltaY / 53 * scaleCoef / 2);

        if (e.deltaY < 0) {
            scale(currentScaling, x, y);
        } else if (e.deltaY > 0) {
            scale(1 / currentScaling, x, y);
        }
    } else if (keys['shift']) {
        // Scroll horizontally
        setView(targetView.x - e.deltaY / mindMap.view.scale, targetView.y, undefined, 200 / mindMap.view.scale);
    } else {
        // Scroll vertically
        setView(targetView.x, targetView.y - e.deltaY / mindMap.view.scale, undefined, 200 / mindMap.view.scale);
    }
}

function bodyKeyDownHandler(e) {
    // Check special keys

    if (e.ctrlKey || e.metaKey) {
        keys['ctrl'] = true;
    }

    if (e.shiftKey) {
        keys['shift'] = true;
        canvasMouseMoved(lastEvent);
    }

    if (e.altKey) {
        keys['alt'] = true;
    }

    if (e.key == 'Escape') {
        showDialog();
    }

    if (keys['ctrl'] && e.key == '0') {
        e.preventDefault();
        if (renameMode) { return; }

        scale(1 / mindMap.view.scale);
        draw(mindMap);
    }

    if (keys['ctrl'] && (e.code == 'Equal' || e.code == 'NumpadAdd')) {
        e.preventDefault();
        if (renameMode) { return; }

        scale(scaleCoef);
        draw(mindMap);
    }

    if (keys['ctrl'] && (e.code == 'Minus' || e.code == 'NumpadSubtract')) {
        e.preventDefault();
        if (renameMode) { return; }

        scale(1 / scaleCoef);
        draw(mindMap);
    }
}

function bodyKeyUpHandler(e) {
    // Check special keys

    if (!e.ctrlKey && !e.metaKey) {
        keys['ctrl'] = false;
    }

    if (!e.shiftKey) {
        keys['shift'] = false;

        dragTransplant = false;
        canvasMouseMoved(lastEvent);
    }

    if (!e.altKey) {
        keys['alt'] = false;
    }
}

function colorPickerChanged() {
    contextElem.color = $('#color-picker').value;
    contextElem.colorDark = darkColor(contextElem.color);

    draw(mindMap);
}

function loaderChanged(e) {
    const loader = $('#uploader');

    loadFiles(loader.files);
}

function readerFileLoaded(e, fileName) {
    const fileAsText = e.target.result;
    const file = JSON.parse(fileAsText);

    const mindFile = new MindFile({ name: fileName, version: 0 });
    mindFile.mindMap = new MindMap(fileName, file['mindMap']);
    addMindMap(mindFile);
}

function canvasFilesDroped(e) {
    e.preventDefault();
    onFilesDrag = false;
    loadFiles(e.dataTransfer.files);
}

function canvasFilesDragged(e) {
    e.preventDefault();

    if (!onFilesDrag) {
        onFilesDrag = true;
        draw(mindMap);
    }
}

function canvasFilesDragLeaveHandler(e) {
    e.preventDefault();

    onFilesDrag = false;
    draw(mindMap);
}

function loadFiles(files) {
    for (let file of files) {
        const fileName = file.name.split('.')[0];
        const fileExtention = file.name.split('.')[1];

        if (fileExtention != 'json') { continue; }
        // Check file on format ...

        const reader = new FileReader();
        reader.addEventListener('load', function (e) { readerFileLoaded(e, fileName); }, false);
        reader.addEventListener('error', function (e) { console.error('Error code: ' + e.target.error.code); }, false);

        reader.readAsText(file);
    }
}

function showContextMenu(context, x, y) {
    if (!context && !contextUp) { return; }

    const allContext = document.querySelectorAll('.context-menu');
    for (let i of allContext) {
        i.classList.toggle('hidden', true);
    }

    if (!context) {
        contextUp = false;

        draw(mindMap);
        return;
    }

    if (x === undefined) {
        x = contextCoords.x;
        y = contextCoords.y;
    }
    contextCoords.x = x;
    contextCoords.y = y;

    let contextDomElem;
    if (context == 'canvas') { contextDomElem = $('#context-canvas'); }
    if (context == 'branch') { contextDomElem = $('#context-branch'); }
    if (context == 'colorpicker') {
        contextDomElem = $('#context-color-picker');
        $('#color-picker').value = contextElem.color;
    }

    let contextRight = x + contextDomElem.clientWidth + bufferOfView;
    if (contextRight > canvas.clientWidth) {
        contextDomElem.style.left = x - contextDomElem.clientWidth + 'px';
    } else {
        contextDomElem.style.left = x + 'px';
    }

    let contextBottom = y + contextDomElem.clientHeight + bufferOfView;
    if (contextBottom > canvas.clientHeight) {
        contextDomElem.style.top = y - contextDomElem.clientHeight + 'px';
    } else {
        contextDomElem.style.top = y + 'px';
    }

    contextDomElem.classList.toggle('hidden', false);

    contextUp = true;
}

function showDialog(name) {
    showContextMenu();

    $('#dialogs-cont').style.display = 'none';

    const dialogs = $('#dialogs-cont').children;

    for (let i of dialogs) {
        i.style.display = 'none';
    }

    if (!name) { return; }

    $('#dialogs-cont').style.display = 'block';
    $('#dialog-' + name).style.display = 'block';

    if (name == 'rename') {
        $('#input-name').value = mindMap.name || '';
        $('#input-name').focus();
    }
    if (name == 'save') {
        $('#input-save').value = mindMap.name || '';
        $('#input-save').focus();
    }
}

function selectColor(obj) {
    $('#color-picker').value = obj.getAttribute('data-color');
    colorPickerChanged();

    showContextMenu();
}

function renameAreaInputed() {
    const renameArea = $('#rename-area');
    renamedNode.name = renameArea.value;

    checkBounds();
    draw(mindMap);

    renameAreaSet(renamedNode);
}

function renameAreaKeyDowned(e) {
    if (e.key == 'Enter') {
        completeRename();
        canvasMouseMoved(e);
    }

    if (e.key == 'Escape') {
        completeRename(true);
        canvasMouseMoved(e);
    }
}

function renameAreaBlured(e) {
    if (renameMode) {
        e.target.focus();
    }
}

function renameAreaMouseOver() {
    resetLastActiveNode();
    draw(mindMap);
}

function isOverNodeText(event, node) {
    const cursor = unproject({ x: event.offsetX, y: event.offsetY });;
    const textbox = node.textbox;

    return ((cursor.x > textbox.x) && (cursor.x < textbox.x + textbox.width) && (cursor.y > textbox.y) && (cursor.y < textbox.y + textbox.height));
}

function isOverNode(event, node) {
    const cursor = unproject({ x: event.offsetX, y: event.offsetY });

    return isOverCircle(node.x, node.y, baseSize * 0.625, cursor);
}

function isOverRoot(event, node) {
    const cursor = unproject({ x: event.offsetX, y: event.offsetY });

    return ((cursor.x > node.x - node.boundbox.width / 2) && (cursor.x < node.x + node.boundbox.width / 2) && (cursor.y > node.y - node.boundbox.height / 2) && (cursor.y < node.y + node.boundbox.height / 2));
}

function isOverRootJoint(event, node) {
    const cursorPoint = unproject({ x: event.offsetX, y: event.offsetY });

    if (isOverCircle(node.x, node.y - node.boundbox.height / 2, baseSize * 0.625, cursorPoint)) { return 0; }
    if (isOverCircle(node.x + node.boundbox.width / 2, node.y, baseSize * 0.625, cursorPoint)) { return 1; }
    if (isOverCircle(node.x, node.y + node.boundbox.height / 2, baseSize * 0.625, cursorPoint)) { return 2; }
    if (isOverCircle(node.x - node.boundbox.width / 2, node.y, baseSize * 0.625, cursorPoint)) { return 3; }

    return -1;
}

function isOverCircle(circleX, circleY, circleRadius, cursorPoint) {
    return (Math.pow(cursorPoint.x - circleX, 2) +
        Math.pow(cursorPoint.y - circleY, 2) <= Math.pow(circleRadius, 2));
}

function project(point) {
    // Point {x, y}
    // Coords global --> canvas

    let res = {};
    res.x = (point.x + mindMap.view.x) * mindMap.view.scale;
    res.y = (point.y + mindMap.view.y) * mindMap.view.scale;

    return res;
}

function unproject(point) {
    // Point {x, y}
    // Coords click canvas --> global

    let res = {};
    res.x = point.x / mindMap.view.scale - mindMap.view.x;
    res.y = point.y / mindMap.view.scale - mindMap.view.y;

    return res;
}

function shiftView(x, y) {
    mindMap.view.x += x / mindMap.view.scale;
    mindMap.view.y += y / mindMap.view.scale;
}

function setView(x, y, scale, duration = 0) {
    clearTimeout(animTimer);

    let dX = x - mindMap.view.x;
    let dY = y - mindMap.view.y;

    let framesCount = duration / animInterval;
    let vX = dX / framesCount;
    let vY = dY / framesCount;

    targetView = { x: x, y: y, scale: scale };

    (function run() {
        shiftView(vX, vY);

        if ((dY > 0 && mindMap.view.y > targetView.y) || (dY <= 0 && mindMap.view.y < targetView.y)) {
            mindMap.view.y = targetView.y;
        }
        if ((dX > 0 && mindMap.view.x > targetView.x) || (dX <= 0 && mindMap.view.x < targetView.x)) {
            mindMap.view.x = targetView.x;
        }

        draw(mindMap);

        if (mindMap.view.x != targetView.x || mindMap.view.y != targetView.y) {
            animTimer = setTimeout(run, animInterval);
        }
    })();
}

function setViewAuto(file) {
    // Set view automatically

    if (mindMap.nodes.flat().length == 0) { return; }

    if (file && file['editorSettings'] && file['editorSettings']['centerOfView']) {
        // If exist settings of view in file
        // Set view from file
        let centerOfView = file['editorSettings']['centerOfView'];

        mindMap.view.x = canvas.width / 2 - centerOfView.x;
        mindMap.view.y = canvas.height / 2 - centerOfView.y;
        mindMap.view.scale = file['editorSettings']['scale']; // Need setter
    } else if (mindMapBox.width + bufferOfView > canvas.width || mindMapBox.height + bufferOfView > canvas.height) {
        // If mind map boundbox > canvas
        // Set view on center of first root elem
        mindMap.view.x = canvas.width / 2 - mindMap.nodes[0].x;
        mindMap.view.y = canvas.height / 2 - mindMap.nodes[0].y;

        if (!mindMap.editable) { mindMap.view.moveable = true; }
    } else {
        // Set view on center of mind map boundbox
        mindMap.view.x = -(mindMapBox.x + mindMapBox.width / 2 - canvas.width / 2);
        mindMap.view.y = -(mindMapBox.y + mindMapBox.height / 2 - canvas.height / 2);

        if (!mindMap.editable) { mindMap.view.moveable = false; }
    }

    setTargetView();

    draw(mindMap);
}

function setTargetView() {
    targetView.x = mindMap.view.x;
    targetView.y = mindMap.view.y;
}

function scale(coef, x, y) {
    if (mindMap.view.scale * coef > 3 || mindMap.view.scale * coef < 1 / 3) {
        return;
    }

    let p = {};

    if (x && y) {
        p = { x: x, y: y };
    } else {
        p = { x: canvas.width / 2, y: canvas.height / 2 };
    }

    mindMap.view.scale *= coef;

    shiftView(p.x - p.x * coef, p.y - p.y * coef);
    setTargetView();

    checkBounds();
    draw(mindMap);
}

function setFontFamily(fontFamilyAsString) {
    fontFamily = fontFamilyAsString;

    const renameArea = $('#rename-area');
    renameArea.style.fontFamily = fontFamily;
}

function getCenterOfView(mindMap) {
    return { x: canvas.width / 2 - mindMap.view.x, y: canvas.height / 2 - mindMap.view.y };
}

function openMenu() {
    selectMindMap('menu');
}

function openHelp() {
    selectMindMap('help');
}

function openSamples() {
    // Init samples list
    if (!loadingSamples) {
        loadingSamples = true;
        $('#dialog-open__loading-animation').classList.toggle('hidden', false);
        loadSamples().finally(function () {
            loadingSamples = false;
            $('#dialog-open__loading-animation').classList.toggle('hidden', true);
        });
    }

    showDialog('open');
}

async function newFile() {
    const mindFile = new MindFile({ name: '', version: 0 });
    mindFile.mindMap = new MindMap();

    addNode(mindFile.mindMap, 0, 0);

    await addMindMap(mindFile);

    checkBounds();
    draw(mindMap);
}

function loadFromFile() {
    $('#uploader').click();
}

function saveFile() {
    if (mindMapNum == 'menu' || mindMapNum == 'help') return;

    showContextMenu();

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = mindMapBox.width;
    shadowCanvas.height = mindMapBox.height;

    const tempView = mindMap.view;
    mindMap.view = { x: -mindMapBox.x, y: -mindMapBox.y, scale: 1 };

    draw(mindMap, shadowCanvas);

    const imgDataUrl = shadowCanvas.toDataURL();

    $('#button-image').href = imgDataUrl;
    $('#button-image').download = (mindMap.name || defaultName) + '.png';

    mindMap.view = tempView;

    showDialog('save');
}

function saveToFile() {
    const file = getFileFromMap(mindMap);
    const fileAsText = JSON.stringify(file, undefined, 2);
    const downloader = $('#downloader');

    downloader.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(fileAsText); ///
    downloader.download = (mindMap.name || defaultName) + '.json';

    downloader.click();
}

function setNameMap(name) {
    if (!name) { name = defaultName; }

    mindMap.name = name;

    tabs.tabs[mindMapNum].setText(name);
}

function closeFile(num) {
    if (!num) {
        num = mindMapNum;
    }

    if (num == 'menu') { return; }
    if (num == 'help') { openMenu(); return; }

    if (mindMaps.flat().length > 1) {
        delete (mindMaps[num]);
        tabs.removeTab(tabs.tabs[num]);

        for (let i = num - 1; i >= 0; i--) {
            if (mindMaps[i]) {
                selectMindMap(i);

                return;
            }
        }

        for (let i = num + 1; i < mindMaps.length; i++) {
            if (mindMaps[i]) {
                selectMindMap(i);

                return;
            }
        }
    } else {
        delete (mindMaps[num]);
        tabs.removeTab(tabs.tabs[num]);

        selectMindMap('menu');
    }
}

function getFileFromMap(mindMap, view) {
    let file = {
        mindMap: mindMap.getStruct(),

        editorSettings: {},
    };

    if (view) {
        file.editorSettings['centerOfView'] = getCenterOfView(mindMap);
        file.editorSettings['scale'] = mindMap.view.scale;
    }

    return file;
}

async function addMindMap(mindFile) {
    workSpaceLoader.start();

    canvas.width = canvas.width;

    mindMaps.push(mindFile);

    const num = mindMaps.length - 1;
    const mindMap = await mindFile.getMap();

    // Init nodes direction (introduce this code to checkBuild and remove loading code)
    for (let node of mindMap.nodes) {
        if (node.parent && node.parent.x > node.x) {
            node.dir = 'left';
        } else {
            node.dir = 'right';
        }

        if (node.color && !node.colorDark) {
            node.colorDark = darkColor(node.color);
        }
    }

    tabs.addTab(mindFile.name || defaultName, function () {
        if (mindMapNum == num) { showDialog('rename'); }

        selectMindMap(num);
    });

    await selectMindMap(num);
    setViewAuto(mindFile);

    workSpaceLoader.stop();
}

function addNode(mindMap, x, y, name, joint, parent, color, colorDark) {
    if (!color) {
        if (parent) {
            if (parent.parent) {
                color = parent.color;
                colorDark = parent.colorDark;
            } else {
                color = colors.branches[randomInteger(0, colors.branches.length - 1)];
                colorDark = darkColor(color);
            }
        } else {
            color = colors.branches[randomInteger(0, colors.branches.length - 1)];
            colorDark = darkColor(color);
        }
    }

    return mindMap.addNode(x, y, name, joint, parent, color, colorDark);
}

function contextAddRoot() {
    const cursor = unproject({ x: contextCoords.x, y: contextCoords.y });
    addNode(mindMap, cursor.x, cursor.y);

    checkBounds();

    showContextMenu();
}

async function selectMindMap(num) {
    workSpaceLoader.start();

    if (renameMode) { completeRename(); }

    resetLastActiveNode();
    lastActiveNode = -1;

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    mindMapNum = num;

    if (num == 'menu') {
        tabs.changeTab();
    } else {
        tabs.changeTab(tabs.tabs[num]);
    }

    let preMindMap = await mindMaps[num].getMap();

    if (mindMapNum != num) { return; }

    mindMap = preMindMap;

    checkBounds();

    if (num == 'menu' || num == 'help') {
        setViewAuto();
    } else {
        setTargetView();
        draw(mindMap);
    }

    workSpaceLoader.stop();
}

async function loadTempMaps() {
    if (localStorage.temp) {
        const temp = JSON.parse(localStorage.temp);

        for (let i in temp['files']) {
            const mindFile = new MindFile({ name: temp['files'][i].name, version: 0 });
            mindFile.mindMap = new MindMap(temp['files'][i].name, temp['files'][i].file.mindMap);
            mindFile.editorSettings = temp['files'][i].file.editorSettings;

            await addMindMap(mindFile);
        }

        selectMindMap(temp['selected']);

        //await checkCurrentURL();
    } else {
        //await checkCurrentURL();
    }
}

async function checkCurrentURL() {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('id');

    // const url = window.location.href;
    // const id = url.split('/').pop();

    if (!id || !id.length) return;

    await loadMapFromURL(host + '/' + id, id);

    window.history.replaceState({}, null, '/');
}

async function loadMapFromURL(url, name) {
    const mindFile = new MindFile({ path: url, name: name, version: 0 });

    await addMindMap(mindFile);
}

function saveTempMaps() {
    if (mindMaps.flat().length == 0) {
        localStorage.removeItem('temp');

        return;
    }

    let temp = {};
    temp['files'] = [];
    temp['selected'] = mindMapNum;

    for (let i in mindMaps) {
        if (i == 'menu' || i == 'help') { continue; }

        let file = getFileFromMap(mindMaps[i].mindMap, true);

        temp['files'].push({ file: file, name: mindMaps[i].mindMap.name });

        if (mindMapNum == i) {
            temp['selected'] = temp['files'].length - 1;
        }
    }

    localStorage.setItem('temp', JSON.stringify(temp));
}

function renameMap() {
    showDialog();

    const name = $('#input-name').value.trim();

    setNameMap(name);
}

function saveMap() {
    showDialog();

    const name = $('#input-save').value.trim();
    setNameMap(name);

    saveToFile();
}

function initDrag() {
    dragState = 2;
    dragWait = false;
    dragEnd = true;

    canvas.style.cursor = 'move';
}

function initDragWorkspace() {
    onDrag = true;
    dragWaitWorkspace = false;
    dragEnd = true;

    canvas.style.cursor = 'grabbing';
}

function openLink(link) {
    window.open(link, '_blank');
}

function randomInteger(min, max) {
    const rand = min + Math.random() * (max + 1 - min);

    return Math.floor(rand);
}

function darkColor(color, k = 0.9) {
    const colorArray = parseColor(color);
    colorArray[0] *= k;
    colorArray[1] *= k;
    colorArray[2] *= k;

    return 'rgba(' + colorArray[0] + ',' + colorArray[1] + ',' + colorArray[2] + ',' + colorArray[3] + ')';
}

function parseColor(colorString) {
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

function $(s) { return document.querySelector(s); }