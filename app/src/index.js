import '../style/main.css'
import '../style/ui.css'
import '../favicon.ico'

import { Loader } from './UI/Loader'
import { Tlaloc } from './UI/Tlaloc'

import { MindFile, MindMap } from './MindMap/MindMap'
import { addNode, moveNode, setColorNode, transplantNode, distance, dfsNode, calculateNodeCoords, getCenterOfView } from './MindMap/Utils'
import { isOverNodeText, isOverNode, isOverRoot, isOverRootJoint } from './MindMap/Utils'
import { Events } from './MindMap/Events'

import { insertRemoteFile, getRemoteFile, deleteRemoteFile, subscribeToRemoteFile, unsubscribeFromRemoteFile, getRemoteFilesList, logout, login, register, ping, getRemoteFileEvents } from './Net'

import { draw, checkBounds } from './Render'
import { $, openLink, showNotification, tsToDateTime } from './Utils'

const scaleCoef = 1.1; // For mouse whell
const animInterval = 1000 / 120; // Micro sec
const workSpaceLoader = new Loader($('#work__loading-animation'));

let user = {};

let baseFontSize = parseInt(getComputedStyle($('body')).fontSize.slice(0, -2)); // Font size in px
let baseSize = baseFontSize * 1.25;

let fontSize = 22;
let fontFamily = '';

let DEBUG = false;

let transplantHoldZone = baseSize / 2;

let canvas;

let tabs;

let mindFiles = [];
let mindFilesRemote = {};
let mindFileNum = 0;

let mindFileCur;
let mindMap;

let onDrag = false;
let dragState = 0; // 0, 1, 2
let draggedElem;
let dragTimer;
let dragEnd = false;
let dragWait = false;
let dragWaitWorkspace = false;
let dragTransplant = false;
let lastTransplantEvent = {};

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

const systemFilesList = {
    'menu': { name: 'Menu', path: 'static/system/Menu.json', version: 0, editable: false },
    'help': { name: 'Help', path: 'static/system/Help.json', version: 0, editable: false },
};
const samplesFilesList = [
    { name: 'Palms', path: 'static/samples/Palms.json', version: 0 },
    { name: 'MindEditor', path: 'static/samples/MindEditor.json', version: 0 },
];

let loadingSamples, loadingRemote = false;

const colors = {};
colors['baseText'] = '#23282f';
colors['placeHolderText'] = '#818181';
colors['background'] = '#fcfcfc';
colors['border'] = '#E9E9E9';
colors['borderCanvas'] = '#b5b5b5b8';
colors.branches = ['#e096e9', '#988ee3', '#7aa3e5', '#67d7c4', '#9ed56b', '#ebd95f', '#efa670', '#e68782'];
colors.darkColorCoef = 0.6;
colors.lightColorCoef = 0.4;

const keys = { 'ctrl': false, 'shift': false, 'alt': false };

let afterConnectAction;

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
    initUI();

    // Help map init
    mindFiles['help'] = new MindFile(systemFilesList['help'], 'system_help');

    // Menu map init and select
    mindFiles['menu'] = new MindFile(systemFilesList['menu'], 'system_menu', true);

    selectMindFile('menu');
    await loadTempMaps();
    loadTempUser();
}

function initUI() {
    const menu = Tlaloc.menu('menu');
    menu.addItem('MindEditor', function () { menuItemMainHandler(); });
    menu.addItem('New', function () { menuItemNewHandler(); });
    menu.addItem('Open', function () { menuItemOpenHandler(); });
    menu.addItem('Save', function () { menuItemSaveHandler(); });
    menu.addItem('Close', function () { menuItemCloseHandler(); });

    tabs = Tlaloc.tabs('tabs');

    initColorsDialog(colors.branches);

    $('body').addEventListener('mouseleave', canvasMouseLeaveHandler);

    canvas = $('#canvas');

    canvas.addEventListener('click', canvasClickHandler);
    canvas.addEventListener('mousemove', canvasMouseMoveHandler);
    canvas.addEventListener('mouseover', canvasMouseMoveHandler);
    canvas.addEventListener('mousedown', canvasMouseDownHandler);
    canvas.addEventListener('mouseup', canvasMouseUpHandler);
    canvas.addEventListener('dblclick', canvasDblClickHandler);
    canvas.addEventListener('contextmenu', canvasContextHandler);
    canvas.addEventListener('wheel', canvasWhellHandler);

    $('body').addEventListener('keydown', bodyKeyDownHandler);
    $('body').addEventListener('keyup', bodyKeyUpHandler);

    canvas.addEventListener('drop', canvasFilesDropHandler);
    canvas.addEventListener('dragover', canvasFilesDragOverHandler);
    canvas.addEventListener('dragleave', canvasFilesDragLeaveHandler);

    $('#uploader').addEventListener('change', loaderChangeHandler);

    $('#rename-area').addEventListener('input', renameAreaInputHandler);
    $('#rename-area').addEventListener('keydown', renameAreaKeyDownHandler);
    $('#rename-area').addEventListener('mouseover', renameAreaMouseOverHandler);
    $('#rename-area').addEventListener('blur', renameAreaBlurHandler);
    $('#rename-area').addEventListener('wheel', function (e) { e.preventDefault(); });

    $('#dialogs-cont').addEventListener('mousedown', function (e) { if (e.target == this) { showDialog(); } });
    $('#button-name').addEventListener('click', renameMap);
    $('#button-save').addEventListener('click', saveMap);
    $('#button-save-remote').addEventListener('click', function () { saveMapRemote(); });
    $('#button-share').addEventListener('click', copyLinkToClipboard);

    $('#context-branch__set-color').addEventListener('click', function () { showContextMenu('colorpicker'); });
    $('#context-branch__rename').addEventListener('click', renameSelectedNode);
    $('#context-branch__delete').addEventListener('click', deleteSelectedNode);

    $('#context-color-picker__color-picker__button').addEventListener('click', function () { $('#color-picker').click(); });
    $('#color-picker').addEventListener('change', colorPickerChangeHandler);

    $('#context-canvas__add-root').addEventListener('click', contextAddRootHandler);
    $('#context-canvas__save').addEventListener('click', menuItemSaveHandler);
    $('#context-canvas__rename').addEventListener('click', function () { showDialog('rename'); });
    $('#context-canvas__share').addEventListener('click', function () { showDialog('share'); });
    $('#context-canvas__delete').addEventListener('click', function () { deleteMapRemote(mindFileCur); });

    $('#input-name').placeholder = $('#input-save').placeholder = defaultName;

    $('#button-connect').addEventListener('click', function () { loginToService() });
    $('#button-register').addEventListener('click', function () { registerOnService() });

    $('#button-signup').addEventListener('click', function () {
        $('#dialog-connections-signin').classList.toggle('none', true);
        $('#dialog-connections-signup').classList.toggle('none', false);
    });
    $('#button-signin').addEventListener('click', function () {
        $('#dialog-connections-signin').classList.toggle('none', false);
        $('#dialog-connections-signup').classList.toggle('none', true);
    });
    $('#button-logout').addEventListener('click', function () { logoutFromService() });

    const forms = document.querySelectorAll('form');
    for (let i of forms) {
        i.addEventListener('submit', function (e) { e.preventDefault(); });
    }

    setFontFamily('Helvetica', 'normal');
}

function initColorsDialog(colors) {
    for (let i in colors) {
        const button = document.createElement('button');

        button.style.background = colors[i];
        button.style.color = colors[i];

        button.setAttribute('data-color', colors[i]);

        button.addEventListener('click', colorButtonClickHandler);

        $('#colors-cont').appendChild(button);
    }
}

function setFontFamily(fontFamilyCSS, fontWeightCSS) {
    fontFamily = fontFamilyCSS;

    const renameArea = $('#rename-area');
    renameArea.style.fontFamily = fontFamily;
    renameArea.style.fontWeight = fontWeightCSS;
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
            showDialog();
            openMindFile(new MindFile(samplesFilesList[i], 'samples_' + samplesFilesList[i].path));

        });
        fileList.appendChild(button);
    }
}


function renameNode(node, auto) {
    const text = node.name;
    let fs = fontSize; // Font Size (in px)
    let textColor = colors['baseText'];

    if (node.parent) {
        fs = fontSize * 0.75;
        textColor = node.colorDark;
    }

    renameAreaUpdate(node);

    const renameArea = $('#rename-area');
    renameArea.style.display = 'block';
    renameArea.style.fontSize = fs * mindMap.view.scale + 'px';
    renameArea.style.color = textColor;
    renameArea.style.borderColor = node.color;
    renameArea.value = renamedNodeText = text;

    renameArea.focus();

    renameMode = true;
    renameAuto = auto || false;
    renamedNode = node;

    draw(mindMap);
}

function renameAreaUpdate(node) {
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
        Events.generate('rename', mindFileCur, { id: renamedNode.id, name: renamedNode.name });
    }
    checkBounds(mindMap, mindMapBox);

    renameArea.style.display = 'none';
}


function completeDrag(e, reset) {
    clearTimeout(dragTimer);
    dragWait = false;
    dragWaitWorkspace = false;

    if (onDrag) {
        onDrag = false;

        canvasMouseMoveHandler(e);

        return;
    }

    if (dragState == 2) {
        Events.generate('move', mindFileCur, { id: draggedElem.id, x: draggedElem.x, y: draggedElem.y, joint: draggedElem.joint });

        if (lastTransplantEvent && lastTransplantEvent.lastParent !== lastTransplantEvent.parent) {
            Events.generate('transplant', mindFileCur, { id: draggedElem.id, parent: lastTransplantEvent.parent });
        }
        lastTransplantEvent = {};
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

        canvasMouseMoveHandler(e);

        return;
    }
}

function deleteSelectedNode() {
    lastActiveNode = -1;

    showContextMenu();

    Events.generate('remove', mindFileCur, { id: contextElem.id });
    mindMap.deleteNode(contextElem, true);
    checkBounds(mindMap, mindMapBox);

    draw(mindMap);
}

function renameSelectedNode() {
    showContextMenu();

    renameNode(contextElem);
}

function resetLastActiveNode() {
    if (lastActiveNode == -1) return;

    if (mindMap.nodes[lastActiveNode].parent) {
        mindMap.nodes[lastActiveNode].state = 0;
    } else {
        mindMap.nodes[lastActiveNode].jointState = -1;
    }
}


function canvasClickHandler(e) {
    if (workSpaceLoader.onLoading) return;

    // Complete drag if drag mode 
    if (dragEnd) {
        dragEnd = false;

        if (contextFlag) {
            contextFlag = false;
            canvasMouseMoveHandler(e);
        }

        return;
    }

    let renamed = false;
    // Complete rename if rename mode 
    if (renameMode) {
        completeRename();
        canvasMouseMoveHandler(e);

        renamed = !renameAuto;
    }

    if (contextFlag) {
        contextFlag = false;
        canvasMouseMoveHandler(e);

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
                    let addedNode = addNode('', mindMap, coords.x, coords.y, '', jointNum, mindMap.nodes[i]);
                    Events.generate('add', mindFileCur, { id: addedNode.id, parent: mindMap.nodes[i].id, joint: jointNum, x: addedNode.x, y: addedNode.y, color: addedNode.color });

                    checkBounds(mindMap, mindMapBox);
                    draw(mindMap);
                    renameNode(addedNode, true);

                    return;
                }
            }

            // Root elem shape
            if (isOverRoot(e, mindMap.nodes[i])) {
                if (DEBUG) { console.log(mindMap.nodes[i]); }

                renameNode(mindMap.nodes[i]);

                return;
            }
        } else {
            // Node
            if (mindMap.editable && !renamed && isOverNode(e, mindMap.nodes[i])) {
                if (keys['ctrl']) {
                    // Delete branch
                    Events.generate('remove', mindFileCur, { id: mindMap.nodes[i].id });
                    mindMap.deleteNode(mindMap.nodes[i], true);

                    lastActiveNode = -1;
                    checkBounds(mindMap, mindMapBox);
                    draw(mindMap);
                } else {
                    // Add sub-branch
                    let coords = calculateNodeCoords(mindMap.nodes[i]);
                    let addedNode = addNode('', mindMap, coords.x, coords.y, '', undefined, mindMap.nodes[i]);
                    Events.generate('add', mindFileCur, { id: addedNode.id, parent: mindMap.nodes[i].id, x: addedNode.x, y: addedNode.y, color: addedNode.color });

                    checkBounds(mindMap, mindMapBox);
                    draw(mindMap);
                    renameNode(addedNode, true);
                }

                return;
            }

            if (isOverNodeText(e, mindMap.nodes[i])) {
                if (DEBUG) { console.log(mindMap.nodes[i]); }

                if (mindMap.editable) {
                    renameNode(mindMap.nodes[i]);
                } else {
                    if (mindMap.nodes[i].action) {
                        switch (mindMap.nodes[i].action) {
                            case 'new':
                                menuItemNewHandler();
                                break;
                            case 'open':
                                menuItemOpenHandler();
                                break;
                            case 'open-remote':
                                menuItemOpenRemoteHandler();
                                break;
                            case 'help':
                                menuItemHelpHandler();
                                break;
                            case 'samples':
                                menuItemSamplesHandler();
                                break;
                            case 'git':
                                openLink('https://github.com/entagir/mindeditor');
                                break;
                            case 'connect':
                                showDialogConnect();
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

function canvasContextHandler(e) {
    e.preventDefault();
    if (workSpaceLoader.onLoading) { return; }

    if (!mindMap.editable) { return; }

    // Complete rename if rename mode 
    if (renameMode) {
        completeRename();
        canvasMouseMoveHandler(e);
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

function canvasMouseMoveHandler(e) {
    if (workSpaceLoader.onLoading || contextUp) {
        return;
    }

    if (dragWait) {
        clearTimeout(dragTimer);
        initDrag();
    }

    if (dragWaitWorkspace) {
        clearTimeout(dragTimer);
        initDragWorkspace();
    }

    if (!e) {
        return;
    }

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
            renameAreaUpdate(renamedNode);
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
            dfsNode(draggedElem, function (node) {
                node['transplant'] = true;
            });

            dragTransplant = true;

            draggedElem.state = 2;

            lastTransplantEvent.lastParent = draggedElem.parent.id;
        }

        if (dragTransplant) {
            let dist = distance(draggedElem, draggedElem.parent) - transplantHoldZone;
            if (dist < 0) {
                dist = 0;
            }

            let nearNode = draggedElem.parent;
            for (let i in mindMap.nodes) {
                if (mindMap.nodes[i].transplant || draggedElem.parent == mindMap.nodes[i]) {
                    continue;
                }

                const curDist = distance(draggedElem, mindMap.nodes[i]);

                if (curDist < dist) {
                    nearNode = mindMap.nodes[i];
                    dist = curDist;
                }
            }

            if (nearNode != draggedElem.parent) {
                transplantNode(draggedElem, nearNode);
                lastTransplantEvent.parent = nearNode.id;
            }
        } else if (draggedElem.state == 2) {
            draggedElem.state = 1;
        }

        checkBounds(mindMap, mindMapBox);
        draw(mindMap);

        if (renameMode) {
            renameAreaUpdate(renamedNode);
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
            if (mindMap.editable && (!renameMode || renameAuto) && (overText || isOverNode(e, mindMap.nodes[i]))) {
                lastActiveNode = i;

                if (!overText) {
                    if (keys['ctrl']) {
                        mindMap.nodes[i].state = 3;
                    } else if (keys['shift']) {
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

function canvasMouseDownHandler(e) {
    if (workSpaceLoader.onLoading) return;
    if (renameMode && !renameAuto) return;

    const x = e.offsetX;
    const y = e.offsetY;

    if (contextUp) {
        showContextMenu();
        contextFlag = true;
        canvasMouseMoveHandler(e);
    }

    if (e.which == 3) return;

    if (dragWait || dragWaitWorkspace) return;

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

function canvasMouseUpHandler(e) {
    if (workSpaceLoader.onLoading) { return; }

    completeDrag(e);
}

function canvasMouseLeaveHandler(e) {
    completeDrag(e, true);
}

function canvasDblClickHandler(e) {
    if (workSpaceLoader.onLoading) return;
    if (!mindMap.editable) return;

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
    const addedNode = addNode('', mindMap, cursor.x, cursor.y);
    Events.generate('add', mindFileCur, { id: addedNode.id, x: addedNode.x, y: addedNode.y, color: addedNode.color });

    checkBounds(mindMap, mindMapBox);
    canvasMouseMoveHandler(e);
}

function canvasWhellHandler(e) {
    e.preventDefault();

    if (workSpaceLoader.onLoading) return;
    if (!mindMap.editable || renameMode) return;

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

function canvasFilesDropHandler(e) {
    e.preventDefault();

    onFilesDrag = false;
    loadFilesLocal(e.dataTransfer.files);
}

function canvasFilesDragOverHandler(e) {
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

function bodyKeyDownHandler(e) {
    // Check special keys

    if (e.ctrlKey || e.metaKey) {
        keys['ctrl'] = true;
        canvasMouseMoveHandler(lastEvent);
    }

    if (e.shiftKey) {
        keys['shift'] = true;
        canvasMouseMoveHandler(lastEvent);
    }

    if (e.altKey) {
        keys['alt'] = true;
    }

    if (e.key == 'Escape') {
        showDialog();
    }

    if (keys['ctrl'] && e.key == '0') {
        e.preventDefault();
        if (renameMode) {
            return;
        }

        scale(1 / mindMap.view.scale);
        draw(mindMap);
    }

    if (keys['ctrl'] && (e.code == 'Equal' || e.code == 'NumpadAdd')) {
        e.preventDefault();
        if (renameMode) {
            return;
        }

        scale(scaleCoef);
        draw(mindMap);
    }

    if (keys['ctrl'] && (e.code == 'Minus' || e.code == 'NumpadSubtract')) {
        e.preventDefault();
        if (renameMode) {
            return;
        }

        scale(1 / scaleCoef);
        draw(mindMap);
    }
}

function bodyKeyUpHandler(e) {
    // Check special keys

    if (!e.ctrlKey && !e.metaKey) {
        keys['ctrl'] = false;

        if (dragState == 2) {
            draggedElem.state = 1;
        }
        canvasMouseMoveHandler(lastEvent);
    }

    if (!e.shiftKey) {
        keys['shift'] = false;

        dragTransplant = false;
        canvasMouseMoveHandler(lastEvent);
    }

    if (!e.altKey) {
        keys['alt'] = false;
    }
}

function colorPickerChangeHandler() {
    setColorNode(contextElem, $('#color-picker').value);

    draw(mindMap);

    Events.generate('color', mindFileCur, { id: contextElem.id, color: contextElem.color });
}

function loaderChangeHandler() {
    const loader = $('#uploader');

    loadFilesLocal(loader.files);

    $('#uploader').value = '';
}

function colorButtonClickHandler(e) {
    $('#color-picker').value = e.target.getAttribute('data-color');
    colorPickerChangeHandler();

    showContextMenu();
}

function renameAreaInputHandler() {
    const renameArea = $('#rename-area');
    renamedNode.name = renameArea.value;

    checkBounds(mindMap, mindMapBox);
    draw(mindMap);

    renameAreaUpdate(renamedNode);
}

function renameAreaKeyDownHandler(e) {
    if (e.key === 'Enter') {
        completeRename();
        canvasMouseMoveHandler(e);
    }

    if (e.key === 'Escape') {
        completeRename(true);
        canvasMouseMoveHandler(e);
    }
}

function renameAreaBlurHandler(e) {
    if (!renameMode) return;

    e.target.focus();
}

function renameAreaMouseOverHandler() {
    resetLastActiveNode();
    draw(mindMap);
}

function contextAddRootHandler() {
    const cursor = unproject({ x: contextCoords.x, y: contextCoords.y });
    const addedNode = addNode('', mindMap, cursor.x, cursor.y);
    Events.generate('add', mindFileCur, { id: addedNode.id, x: addedNode.x, y: addedNode.y, color: addedNode.color });

    checkBounds(mindMap, mindMapBox);

    showContextMenu();
}

function menuItemMainHandler() {
    selectMindFile('menu');
}

function menuItemHelpHandler() {
    selectMindFile('help');
}

function menuItemSamplesHandler() {
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

async function menuItemOpenRemoteHandler() {
    if (!user || !user.id) {
        showDialogConnect();
        afterConnectAction = menuItemOpenRemoteHandler;
        showNotification('Sign in to see the list of available mindmaps');
        return;
    }

    if (loadingRemote) {
        showDialog('open-remote');
        return;
    }

    loadingRemote = true;

    const fileListElem = $('#file-list-body');
    fileListElem.innerHTML = '<div class="head"><div>Name</div><div>Modified</div></div>';
    fileListElem.insertAdjacentHTML('beforeend', `<div class="message"><div>Loading...</div>`);

    showDialog('open-remote');

    const mindMapList = await getRemoteFilesList();
    // TODO: check err

    if (!mindMapList.length) {
        fileListElem.querySelector('.message').firstElementChild.innerHTML = 'No remote files';
    } else {
        fileListElem.querySelector('.message').remove();
        for (const item of mindMapList) {
            fileListElem.insertAdjacentHTML('beforeend', `<div class="row" data-id="${item.id}"><div>${item.name}</div><div>${tsToDateTime(new Date(item.timestamp))}</div></div>`);
        }
    }

    $('#file-list').onclick = function (e) {
        const row = e.target.closest('div.row');
        if (!row || !$('#file-list').contains(row) || !row.dataset.id) {
            return;
        }

        showDialog();
        openMindFileRemote(row.dataset.id);
    };

    loadingRemote = false;
}

async function menuItemNewHandler() {
    const mindFile = new MindFile({ name: '', version: 0 });
    mindFile.mindMap = new MindMap();

    const addedNode = addNode('', mindFile.mindMap, 0, 0);

    await openMindFile(mindFile);

    checkBounds(mindMap, mindMapBox);
    draw(mindMap);

    Events.generate('add', mindFileCur, { id: addedNode.id, x: addedNode.x, y: addedNode.y, color: addedNode.color });
}

function menuItemOpenHandler() {
    $('#uploader').click();
}

function menuItemSaveHandler() {
    if (mindFileNum == 'menu' || mindFileNum == 'help') return;

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

    if (user && user.login) {
        $('#button-save-remote').classList.toggle('none', false);
        $('#button-save').classList.toggle('none', true);
    } else {
        $('#button-save-remote').classList.toggle('none', true);
        $('#button-save').classList.toggle('none', false);
    }

    showDialog('save');
}

function menuItemCloseHandler() {
    closeMindFile();
}


function loadFilesLocal(files) {
    for (const file of files) {
        const fileName = file.name.split('.')[0];
        const fileExtention = file.name.split('.')[1];

        if (fileExtention != 'json') {
            showNotification(`Unable to open "${file.name}". Invalid extention.`);
            continue;
        }

        const reader = new FileReader();
        reader.addEventListener('load', function (e) {
            fileReaderLoadHandler(e, fileName);
        });
        reader.addEventListener('error', function () {
            showNotification(`Unable to open "${file.name}". Loading error.`);
        });
        reader.readAsText(file);
    }
}

async function fileReaderLoadHandler(e, fileName) {
    const fileAsText = e.target.result;
    const file = JSON.parse(fileAsText);

    // TODO: Check file on format
    // showNotification(`Unable to open "${file.name}". Invalid file.`);

    const mindFile = new MindFile({ name: fileName, version: 0 });
    mindFile.mindMap = new MindMap(fileName, file['mindMap']);
    mindFile.onSaved = true;
    await openMindFile(mindFile);

    const content = getFileFromMap(mindMap).mindMap;
    Events.generate('load', mindFile, { content: content });
}


function showContextMenu(context, x, y) {
    if (!context && !contextUp) return;

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
    if (context == 'canvas') {
        contextDomElem = $('#context-canvas');
    }
    if (context == 'branch') {
        contextDomElem = $('#context-branch');
    }
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

    for (let dialog of dialogs) {
        dialog.style.display = 'none';
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

    if (name == 'share') {
        let link = '';

        if (mindFileCur.id) {
            link = `${new URL(window.location.href).origin}/${mindFileCur.id}`;
        }

        $('#input-share').value = link;
    }

    afterConnectAction = null;
}

function showDialogConnect() {
    $('#dialog-connections-info').classList.toggle('none', true);
    $('#dialog-connections-signin').classList.toggle('none', true);
    $('#dialog-connections-signup').classList.toggle('none', true);

    if (user && user.login) {
        $("#input-login-info").value = user.login;
        $('#dialog-connections-info').classList.toggle('none', false);
    } else {
        $('#dialog-connections-signin').classList.toggle('none', false);
    }

    showDialog('connections');
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

    const dX = x - mindMap.view.x;
    const dY = y - mindMap.view.y;

    const framesCount = duration / animInterval;
    const vX = dX / framesCount;
    const vY = dY / framesCount;

    targetView = { x: x, y: y, scale: scale };

    run();

    function run() {
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
    }
}

function setViewAuto(file) {
    if (mindMap.nodes.flat().length == 0) {
        return;
    }

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

function scale(k, x, y) {
    if (mindMap.view.scale * k > 3 || mindMap.view.scale * k < 1 / 3) {
        return;
    }

    let p = {};

    if (x && y) {
        p = { x: x, y: y };
    } else {
        p = { x: canvas.width / 2, y: canvas.height / 2 };
    }

    mindMap.view.scale *= k;

    shiftView(p.x - p.x * k, p.y - p.y * k);
    setTargetView();

    checkBounds(mindMap, mindMapBox);
    draw(mindMap);
}


function saveFileLocal() {
    const file = getFileFromMap(mindMap);
    const fileAsText = JSON.stringify(file, undefined, 2);
    const downloader = $('#downloader');

    downloader.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(fileAsText);
    downloader.download = (mindMap.name || defaultName) + '.json';

    downloader.click();
}

async function saveFileRemote() {
    if (!user.session) return;

    if (mindFileCur.id) {
        // TODO: check sync events
        showNotification('File already saved and updated');
    } else {
        await insertRemoteFile(mindFileCur); // TODO: catch errors
        mindFilesRemote[mindFileCur.id] = mindFileCur;
        checkMindFile(mindFileCur);

        subscribeToRemoteFile(mindFileCur);

        // TODO: sub on new file
        showNotification('File saved');
    }
}

async function setFileName(mindFile, name) {
    if (!tabs.tabs[mindFile.num]) return;

    if (!name) {
        name = defaultName;
    }

    mindFile.name = name;
    const mindMap = await mindFile.getMap();
    mindMap.name = name;

    if (mindFile.onSaved) {
    } else {
        name += '*';
    }

    tabs.tabs[mindFile.num].setText(name);
}

async function openMindFile(mindFile) {
    if (mindFile.id && mindFilesRemote[mindFile.id]) {
        await selectMindFile(mindFilesRemote[mindFile.id].num);
        return;
    }

    workSpaceLoader.start();

    canvas.width = canvas.width;

    mindFiles.push(mindFile);

    const num = mindFiles.length - 1;
    await mindFile.getMap();
    mindFile.num = num;

    const name = mindFile.name || defaultName;
    tabs.addTab(name, function () {
        if (mindFileNum == num) {
            showDialog('rename');
            return;
        }

        selectMindFile(num);
    });

    await selectMindFile(num);
    setViewAuto(mindFile);

    if (mindFile.id) {
        mindFilesRemote[mindFile.id] = mindFile;
    }

    workSpaceLoader.stop();

    setFileName(mindFileCur, name);

    mindFile.events = [];
}

async function openMindFileRemote(id) {
    workSpaceLoader.start();

    const mindFile = new MindFile({ id: id, name: '...' });
    mindFile.mindMap = new MindMap('...');
    mindFile.mindMap.loading = true;
    mindFile.onSaved = true;

    await openMindFile(mindFile);

    const remoteFile = await getRemoteFile(mindFile.id);

    if (remoteFile) {
        mindFile.userId = remoteFile.userId;
        mindFile.timestampEvent = remoteFile.timestamp;

        setFileName(mindFile, remoteFile.name);

        const events = await getRemoteFileEvents(mindFile.id);
        for (const event of events) {
            updateMindFileEventHandler({
                type: 'event',
                fileId: id,
                data: event.content,
                timestamp: event.timestamp,
            }, event.type);
        }

        mindFile.mindMap.loading = false;
        setViewAuto(mindFile);

        showNotification(`MindMap ${mindFile.name} loaded`);
    } else {
        showNotification(`MindMap ${mindFile.name} failed load`);
    }

    workSpaceLoader.stop();
}

function closeMindFile(num) {
    if (!num) {
        num = mindFileNum;
    }

    if (num == 'menu') {
        return;
    }
    if (num == 'help') {
        menuItemMainHandler();
        return;
    }

    if (mindFilesRemote[mindFiles[num].id]) {
        unsubscribeFromRemoteFile(mindFiles[num]);
        delete (mindFilesRemote[mindFiles[num].id]);
    }

    delete (mindFiles[num]);
    tabs.removeTab(tabs.tabs[num]);

    if (mindFiles.flat().length) {
        for (let i = num - 1; i >= 0; i--) {
            if (mindFiles[i]) {
                selectMindFile(i);

                return;
            }
        }

        for (let i = num + 1; i < mindFiles.length; i++) {
            if (mindFiles[i]) {
                selectMindFile(i);

                return;
            }
        }
    } else {
        selectMindFile('menu');
    }
}

async function selectMindFile(num) {
    workSpaceLoader.start();

    if (renameMode) {
        completeRename();
    }

    showDialog();
    showContextMenu();

    resetLastActiveNode();
    lastActiveNode = -1;

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    mindFileNum = num;

    if (num == 'menu') {
        tabs.changeTab();
    } else {
        tabs.changeTab(tabs.tabs[num]);
    }

    mindFileCur = mindFiles[num];

    let preMindMap = await mindFileCur.getMap();

    if (mindFileNum != num) {
        return;
    }

    mindMap = preMindMap;

    checkBounds(mindMap, mindMapBox);

    if (num == 'menu' || num == 'help') {
        setViewAuto();
    } else {
        setTargetView();
        draw(mindMap);
    }

    workSpaceLoader.stop();

    // TODO: refactoring sync
    if (mindFileCur.id && !mindFileCur.onSub) {
        mindFileCur.onSub = true;
        subscribeToRemoteFile(mindFileCur);
    } else if (mindFileCur.needUpdate) {
        const events = await getRemoteFileEvents(mindFileCur.id, { min: mindFileCur.timestampEvent });
        if (events) {
            for (const event of events) {
                updateMindFileEventHandler({
                    type: 'event',
                    fileId: mindFileCur.id,
                    data: event.content,
                    timestamp: event.timestamp,
                }, event.type);
            }
            // mindFileCur.timestampEvent = remoteFile.timestamp;
            // mindFileCur.name = remoteFile.name;

            mindFileCur.needUpdate = false;
            mindFileCur.onSaved = true; // ?

            showNotification(`MindMap ${mindFileCur.name} updated`);
        } else {
            showNotification(`MindMap ${mindFileCur.name} failed update`);
        }
    }

    checkMindFile(mindFileCur);

    showMindFileUsers();
}

async function updateMindFileHandler(msg) {
    if (msg.type != 'update' || !msg.data || !msg.data.id || !mindFilesRemote[msg.data.id]) {
        return;
    }

    const mindFile = mindFilesRemote[msg.data.id];
    const remoteFile = msg.data;
    mindFile.timestampEvent = remoteFile.timestamp;
    mindFile.name = remoteFile.name;

    const content = JSON.parse(remoteFile.content);
    const view = mindFile.mindMap.view;
    mindFile.mindMap = new MindMap(remoteFile.name, content.mindMap);
    const mindMap = await mindFile.getMap();
    mindMap.view = view;
    mindFile.needUpdate = false;

    if (mindFileNum == mindFile.num) {
        selectMindFile(mindFile.num);
    }

    showNotification(`MindMap ${mindFile.name} updated on WS`);
}

function updateMindFileEventHandler(msg, eventType) {
    if (msg.type !== 'event' || !msg.data || !msg.fileId || !mindFilesRemote[msg.fileId]) {
        return;
    }

    const mindFile = mindFilesRemote[msg.fileId];
    const event = JSON.parse(msg.data);

    if (!event.type) {
        event.type = eventType;
    }

    if (event.type === 'file_rename') {
        setFileName(mindFile, event.name);
        return;
    }

    // TODO: check event ts
    mindFile.timestampEvent = msg.timestamp;

    if (event.type === 'load') {
        mindFile.mindMap.importFromStruct(event.content);
        checkBounds(mindMap, mindMapBox);
        draw(mindMap);
    }

    if (event.type === 'add') {
        const parent = event.parent && mindFile.mindMap.nodesById[event.parent];
        addNode(event.node, mindFile.mindMap, event.x, event.y, '', event.joint, parent, event.color);
    }

    if (!event.node) {
        return;
    }

    const node = mindFile.mindMap.nodesById[event.node];
    if (!node) {
        return;
    }

    if (event.type === 'move') {
        moveNode(node, node.x - event.x, node.y - event.y);

        if (event.joint) {
            node.joint = event.joint;
        }
    }

    if (event.type === 'rename') {
        node.name = event.name;
    }

    if (event.type === 'remove') {
        mindFile.mindMap.deleteNode(node, true);
    }

    if (event.type === 'color') {
        setColorNode(node, event.color);
    }

    if (event.type === 'transplant') {
        const parent = mindFile.mindMap.nodesById[event.parent];
        if (parent) {
            transplantNode(node, parent);
        }
    }

    if (mindFileNum === mindFile.num) {
        checkBounds(mindMap, mindMapBox);
        draw(mindMap);
    }

    showNotification(`MindMap ${mindFile.name} updated event on WS`);

    if (DEBUG) {
        console.log('[Event]', event);
    }
}

async function updateMindFileUsersHandler(msg) {
    if (msg.type !== 'users' || !msg.data || !msg.fileId || !mindFilesRemote[msg.fileId]) {
        return;
    }

    const mindFile = mindFilesRemote[msg.fileId];
    const users = msg.data;

    mindFile.usersList = users;

    if (mindFileNum == mindFile.num) {
        showMindFileUsers();
    }

    showNotification(`MindMap ${mindFile.name} updated users on WS`);

    if (DEBUG) {
        console.log('[Users]', users);
    }
}

function getFileFromMap(mindMap, view) {
    const file = {
        mindMap: mindMap.getStruct(),
        editorSettings: {},
    };

    if (view) {
        file.editorSettings['centerOfView'] = getCenterOfView(mindMap);
        file.editorSettings['scale'] = mindMap.view.scale;
    }

    return file;
}

function doneMindFileEventHandler(msg) {
    if (msg.type !== 'event-done' || !msg.fileId || !mindFilesRemote[msg.fileId] || !msg.eventId) {
        return;
    }

    const mindFile = mindFilesRemote[msg.fileId];
    for (let i = 0; i < mindFile.events.length; i++) {
        if (mindFile.events[i].id !== msg.eventId) {
            continue;
        }

        mindFile.events.splice(i, 1);
        break;
    }

    mindFile.timestampEvent = msg.timestamp;
}


function saveTempMaps() {
    if (mindFiles.flat().length == 0) {
        localStorage.removeItem('temp');

        return;
    }

    const temp = {};
    temp['files'] = [];
    temp['selected'] = mindFileNum;

    for (let i in mindFiles) {
        if (i == 'menu' || i == 'help') continue;

        const file = getFileFromMap(mindFiles[i].mindMap, true);

        temp['files'].push({ file: file, name: mindFiles[i].mindMap.name, timestampEvent: mindFiles[i].timestampEvent, id: mindFiles[i].id, userId: mindFiles[i].userId, onSaved: mindFiles[i].onSaved });

        if (mindFileNum == i) {
            temp['selected'] = temp['files'].length - 1;
        }
    }

    localStorage.setItem('temp', JSON.stringify(temp));
}

async function loadTempMaps() {
    if (localStorage.temp) {
        const temp = JSON.parse(localStorage.temp);

        for (const file of temp['files']) {
            const mindFile = new MindFile({ name: file.name, timestampEvent: file.timestampEvent, id: file.id });
            mindFile.mindMap = new MindMap(file.name, file.file.mindMap);
            mindFile.editorSettings = file.file.editorSettings;

            mindFile.onSaved = file.onSaved;

            if (mindFile.id) {
                mindFile.userId = file.userId || 0;
                mindFile.needUpdate = true;
            }

            showNotification(`MindMap ${mindFile.name} loaded from cache`);
            await openMindFile(mindFile);
        }

        selectMindFile(temp['selected']);
    }

    await checkCurrentURL();
}

async function loadTempUser() {
    const stored = localStorage.getItem('user');
    if (stored) {
        const storedJSON = JSON.parse(stored);

        if (storedJSON.login) {
            user = storedJSON;
        }
    }

    pingService();
}


async function checkCurrentURL() {
    const url = new URL(window.location.href);
    //const id = url.pathname.split('/')[1];
    const id = url.searchParams.get('id');

    if (!id || !id.length || mindFilesRemote[id]) {
        return;
    }

    await openMindFileRemote(id);

    //window.history.replaceState({}, null, '/');
}

async function loginToService() {
    const form = $('#form-connect-signin');
    const loginInput = form.querySelector('.input-login');
    const passwordInput = form.querySelector('.input-password');

    const userLogin = loginInput.value.trim();
    const userPassword = passwordInput.value.trim();

    const pay = await login(userLogin, userPassword);

    if (pay.session) {
        user.id = parseInt(pay.id);
        user.session = pay.session;
        user.login = userLogin;

        if (typeof (afterConnectAction) == 'function') {
            afterConnectAction();
        } else {
            showDialog();
        }

        localStorage.setItem('user', JSON.stringify(user));
    } else {
        afterConnectAction = null;
    }
}

async function registerOnService() {
    const form = $('#form-connect-signup');
    const loginInput = form.querySelector('.input-login');
    const passwordInput = form.querySelector('.input-password');

    const login = loginInput.value.trim();
    const password = passwordInput.value.trim();

    const pay = await register(login, password);
    if (pay.session) {
        user.id = pay.id;
        user.session = pay.session;
        user.login = login;

        showDialogConnect();
        localStorage.setItem('user', JSON.stringify(user));
        showNotification(`User ${user.login} was successfully registered`);
    } else {
        showNotification(`User ${login} registering error`);
    }
}

function logoutFromService() {
    logout();

    user = {};

    $('#dialog-connections-info').classList.toggle('none', true);
    $('#dialog-connections-signup').classList.toggle('none', true);
    $('#dialog-connections-signin').classList.toggle('none', false);

    localStorage.removeItem('user');
}

async function pingService() {
    if (!user.session) return;

    const pay = await ping(user.session);
    if (!pay.session && !pay.err) {
        showNotification(`Need login.`);

        user = {};

        localStorage.removeItem('user');
    } else if (pay.err) {
        showNotification(`Failed connection to server.`);
    }
}

function renameMap() {
    showDialog();

    const name = $('#input-name').value.trim();

    setFileName(mindFileCur, name);

    Events.generate('file_rename', mindFileCur, { name: name });
}

function saveMap() {
    showDialog();

    const name = $('#input-save').value.trim();
    setFileName(mindFileCur, name);

    saveFileLocal();

    mindFileCur.onSaved = true;
    setFileName(mindFileCur, mindFileCur.name);
}

async function saveMapRemote() {
    showDialog();

    const name = $('#input-save').value.trim();
    setFileName(mindFileCur, name);

    await saveFileRemote();

    mindFileCur.onSaved = true;
    setFileName(mindFileCur, mindFileCur.name);
}

async function deleteMapRemote(mindFile) {
    await deleteRemoteFile(mindFile);

    if (!mindFile.id) {
        showNotification(`MindMap ${mindFile.name} deleted`);
    } else {
        showNotification(`MindMap ${mindFile.name} failed delete`);
    }

    setFileName(mindFile, mindFile.name);

    if (mindFileCur == mindFile) {
        checkMindFile(mindFileCur);
    }

    showContextMenu();
}

async function copyLinkToClipboard() {
    const shareInput = $('#input-share');
    shareInput.select();
    shareInput.setSelectionRange(0, 99999);

    if (!navigator.clipboard) {
        document.execCommand('copy');
        showNotification(`Link on mindmap "${mindMap.name}" was copyed`);
        return;
    }

    try {
        await navigator.clipboard.writeText(shareInput.value);
        showNotification(`Link on mindmap "${mindMap.name}" was copyed`);
    } catch (err) {
        showNotification(`Error copying link on mindmap "${mindMap.name}"`);
    }
}

function checkMindFile(mindFile) {
    if (mindFile !== mindFileCur) {
        return;
    }

    if (mindFile.id) {
        $('#context-canvas__share').classList.toggle('none', false);
        if (mindFile.userId === user.id) {
            $('#context-canvas__delete').classList.toggle('none', false);
        } else {
            $('#context-canvas__delete').classList.toggle('none', true);
        }
    } else {
        $('#context-canvas__share').classList.toggle('none', true);
        $('#context-canvas__delete').classList.toggle('none', true);
    }

    return;

    if (mindFile.id) {
        //window.history.replaceState({}, null, `/diagram/${mindFile.id}`);
        window.history.replaceState({}, null, `/${mindFile.id}`);
    } else if (mindFileNum == 'menu' || mindFileNum == 'help') {
        window.history.replaceState({}, null, `/${mindFileNum}`);
    } else {
        window.history.replaceState({}, null, `/`);
    }
}

function showMindFileUsers() {
    const aliasPrefix = 'Unidentified';
    const aliases = ['Echinopsis', 'Washingtonia', 'Aztekium', 'Cocos', 'Pinus', 'Phoenix', 'Cedrus', 'Acacia', 'Sequoia', 'Eucalyptus', 'Nymphaea', 'Rafflesia'];

    $('#users').innerHTML = '';

    if (!mindFileCur.usersList) return;

    for (const user of mindFileCur.usersList) {
        const alias = aliases[user.alias % aliases.length];
        const userElem = document.createElement('div');
        userElem.innerHTML = aliasPrefix[0] + alias[0];
        userElem.title = aliasPrefix + ' ' + alias;
        $('#users').append(userElem);
    }
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

export { mindMapBox, fontSize, fontFamily, baseSize, DEBUG, draggedElem, dragTransplant, onFilesDrag, renameMode, renamedNode, placeholder, colors, user, mindFilesRemote, project, unproject, updateMindFileHandler, updateMindFileEventHandler, updateMindFileUsersHandler, doneMindFileEventHandler };