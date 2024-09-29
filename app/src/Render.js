import { DEBUG, project, baseSize, colors, placeholder, fontSize, fontFamily, dragTransplant, renameMode, onFilesDrag, renamedNode, draggedElem, mindMapBox } from './index'
import { changeNodeDir } from './MindMap/Utils'

let splashText = 'Use Double Click to add nodes';

export function checkBounds(mindMap, mindMapBox) {
    if (DEBUG) {
        console.info('check');
    }

    // Check nodes and titles width and height

    let tempScale = mindMap.view.scale;
    mindMap.view.scale = 1;

    let ctx = canvas.getContext('2d');

    for (let i in mindMap.nodes) {
        const node = mindMap.nodes[i];

        if (mindMap.nodes[i].parent === undefined) {
            let text = placeholder;
            drawRootText(ctx, mindMap, node);

            node.textbox.width = ctx.measureText(text).width;
            node.textbox.height = ctx.measureText(text).actualBoundingBoxAscent + ctx.measureText(text).actualBoundingBoxDescent;

            node.boundbox.width = node.textbox.width + baseSize * 1.8;
            node.boundbox.height = node.textbox.height + baseSize * 1.8;

            if (node.name != '') {
                text = node.name;
                drawRootText(ctx, mindMap, node);

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
                        if (node.x < jointsCoords[3].x) {
                            node.joint = 3;
                        }
                        if (node.x > jointsCoords[1].x) {
                            node.joint = 1;
                        }
                        if (node.y > jointsCoords[2].y) {
                            node.joint = 2;
                        }
                    }
                } else if (node.joint == 1) {
                    if (node.x < jointsCoords[1].x) {
                        if (node.y > jointsCoords[2].y) {
                            node.joint = 2;
                        }
                        if (node.y < jointsCoords[0].y) {
                            node.joint = 0;
                        }
                        if (node.x < jointsCoords[3].x) {
                            node.joint = 3;
                        }
                    }
                } else if (node.joint == 2) {
                    if (node.y < jointsCoords[2].y) {
                        if (node.x < jointsCoords[3].x) {
                            node.joint = 3;
                        }
                        if (node.y < jointsCoords[0].y) {
                            node.joint = 0;
                        }
                        if (node.x > jointsCoords[1].x) {
                            node.joint = 1;
                        }
                    }
                } else {
                    if (node.x > jointsCoords[3].x) {
                        if (node.y < jointsCoords[0].y) {
                            node.joint = 0;
                        }
                        if (node.x > jointsCoords[1].x) {
                            node.joint = 1;
                        }
                        if (node.y > jointsCoords[2].y) {
                            node.joint = 2;
                        }
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
            if (!node.textbox.minWidth) { // Or changed font
                let text = placeholder;
                drawNodeText(ctx, mindMap, node);

                node.textbox.minWidth = ctx.measureText(text).width;
                node.textbox.minHeight = ctx.measureText(text).actualBoundingBoxAscent + ctx.measureText(text).actualBoundingBoxDescent;
            }

            let text = node.name || placeholder;
            drawNodeText(ctx, mindMap, node);

            node.textbox.width = ctx.measureText(text).width;
            node.textbox.height = ctx.measureText(text).actualBoundingBoxAscent + ctx.measureText(text).actualBoundingBoxDescent;
            if (node.textbox.height < node.textbox.minHeight) {
                node.textbox.height = node.textbox.minHeight;
            }

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

    mindMapBox.x = mindMapRect.left;
    mindMapBox.y = mindMapRect.top;
    mindMapBox.width = mindMapRect.right - mindMapRect.left;
    mindMapBox.height = mindMapRect.bottom - mindMapRect.top;

    mindMap.view.scale = tempScale;
}

export function draw(mindMap, canvasElem=canvas) {
    canvasElem.width = canvasElem.width;
    const ctx = canvasElem.getContext('2d');

    ctx.fillStyle = colors['background'];
    ctx.fillRect(0, 0, canvasElem.width, canvasElem.height);

    if (mindMap.loading) {
        return;
    }

    if (mindMap.nodes.length == 0) {
        drawSplash(ctx, mindMap);

        return;
    }

    // Draw branches
    for (const node of mindMap.nodes) {
        if (!dragTransplant) {
            node['transplant'] = false;
        }

        if (node.parent) {
            // Joint offset respect to elem center
            let startLine = { x: 0, y: 0 };

            if (!node.parent.parent) {
                // Root elem to node branch

                const parent = node.parent;

                if (node.joint == 0) {
                    startLine = { x: 0, y: -parent.boundbox.height / 2 };
                }
                if (node.joint == 1) {
                    startLine = { x: parent.boundbox.width / 2, y: 0 };
                }
                if (node.joint == 2) {
                    startLine = { x: 0, y: parent.boundbox.height / 2 };
                }
                if (node.joint == 3) {
                    startLine = { x: -parent.boundbox.width / 2, y: 0 };
                }
            }

            // Draw parent to child (this) branch
            let branchStart = {
                x: node.parent.x + startLine.x,
                y: node.parent.y + startLine.y
            };
            let branchEnd = {
                x: node.x,
                y: node.y
            };

            drawEdge(ctx, mindMap, project(branchStart), project(branchEnd), node);
        }
    }

    // Draw nodes
    for (const node of mindMap.nodes) {
        if (node.parent) {
            // Draw child elem
            drawNode(ctx, mindMap, node);
        } else {
            // Draw root elem
            drawRootNode(ctx, mindMap, node);
        }
    }

    if (onFilesDrag) {
        drawCanvasBorder(ctx);
    }

    if (DEBUG) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors['border'];

        const mindMapBoxPoint = project({ x: mindMapBox.x, y: mindMapBox.y });
        ctx.strokeRect(mindMapBoxPoint.x, mindMapBoxPoint.y, mindMapBox.width, mindMapBox.height);
    }
}

export function drawRootText(ctx, mindMap, node) {
    const point = project({ x: node.x, y: node.y });

    let text = placeholder;
    if (node.name != '') {
        text = node.name;
    }

    ctx.fillStyle = colors['baseText'];
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = 'normal ' + fontSize * mindMap.view.scale + 'px ' + fontFamily;
    ctx.fillText(text, point.x, point.y);

    if (DEBUG) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors['baseText'];

        const textboxCoords = project({ x: node.textbox.x, y: node.textbox.y });
        ctx.strokeRect(textboxCoords.x, textboxCoords.y, node.textbox.width, node.textbox.height);;
    }
}

export function drawNodeText(ctx, mindMap, node) {
    ctx.font = 'normal ' + fontSize * 0.75 * mindMap.view.scale + 'px ' + fontFamily;
    ctx.fillStyle = colors['placeHolderText'];
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    let text = placeholder;
    if (node.name != '') {
        text = node.name;
        ctx.fillStyle = node.colorDark || node.color;
    }

    const textboxCoords = project({ x: node.textbox.x, y: node.textbox.y });

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

function drawRootNode(ctx, mindMap, node) {
    const point = project({ x: node.x, y: node.y });

    ctx.fillStyle = node.color;

    drawRoundedRect(ctx, point.x - node.boundbox.width / 2 * mindMap.view.scale, point.y - node.boundbox.height / 2 * mindMap.view.scale, node.boundbox.width * mindMap.view.scale, node.boundbox.height * mindMap.view.scale, baseSize / 2 * mindMap.view.scale);
    drawRootText(ctx, mindMap, node);

    // Draw connectors ("+" circles)
    drawConnector(ctx, mindMap, point.x, point.y - node.boundbox.height / 2 * mindMap.view.scale, node, node.jointState == 0 ? 1 : 0);
    drawConnector(ctx, mindMap, point.x + node.boundbox.width / 2 * mindMap.view.scale, point.y, node, node.jointState == 1 ? 1 : 0);
    drawConnector(ctx, mindMap, point.x, point.y + node.boundbox.height / 2 * mindMap.view.scale, node, node.jointState == 2 ? 1 : 0);
    drawConnector(ctx, mindMap, point.x - node.boundbox.width / 2 * mindMap.view.scale, point.y, node, node.jointState == 3 ? 1 : 0);
}

function drawNode(ctx, mindMap, node) {
    const point = project({ x: node.x, y: node.y });

    // Draw connector
    drawConnector(ctx, mindMap, point.x, point.y, node);

    // Draw text
    drawNodeText(ctx, mindMap, node);
}

function drawEdge(ctx, mindMap, start, end, node) {
    const { color, colorLight } = node;

    ctx.lineWidth = baseSize * 0.4 * mindMap.view.scale;
    ctx.strokeStyle = (node['transplant']) ? colorLight : color;

    ctx.beginPath();
    drawBezier(start.x, start.y, end.x, end.y);
    ctx.stroke();
    ctx.closePath();

    function drawBezier(xs, ys, xf, yf) {
        let p1x = xs + (xf - xs) / 1.5;
        let p1y = ys;

        let p2x = xs + (xf - xs) / 2.5;
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

function drawSplash(ctx, mindMap) {
    ctx.fillStyle = colors['baseText'];
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + baseSize * mindMap.view.scale + 'px ' + fontFamily;
    
    ctx.fillText(splashText, canvas.width / 2, canvas.height / 2);
}

function drawCanvasBorder(ctx) {
    ctx.strokeStyle = colors['borderCanvas'];
    ctx.lineWidth = baseSize / 2.5;
    ctx.setLineDash([15, 10]);

    ctx.strokeRect(0, 0, canvas.width, canvas.height);
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

function drawConnector(ctx, mindMap, x, y, node, state = node.state) {
    const { color, colorLight } = node;

    // Draw circle
    if (node['transplant'] && draggedElem != node) {
        ctx.fillStyle = colorLight;
    } else {
        ctx.fillStyle = color;
    }

    ctx.lineWidth = 2 * mindMap.view.scale;
    ctx.strokeStyle = colors['background'];

    let r = baseSize / 4;
    if (state > 0) {
        r = baseSize * 0.625;
        ctx.strokeStyle = colors['border'];
    }
    
    drawCircle(ctx, x, y, r * mindMap.view.scale);

    // Draw text
    ctx.fillStyle = colors['background'];
    if (state == 1) {
        drawPlus(ctx, x, y, r * 1.5 * mindMap.view.scale, baseSize / 5 * mindMap.view.scale);
    } else if (state == 2) {
        drawCircle(ctx, x, y, r / 3 * mindMap.view.scale, false);
    } else if (state == 3) {
        drawMinus(ctx, x, y, r * 1.5 * mindMap.view.scale, baseSize / 5 * mindMap.view.scale);
    }
}

function drawCircle(ctx, x, y, r, onStroke = true, onFill = true) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2, false);
    ctx.closePath();

    if (onFill) ctx.fill();
    if (onStroke) ctx.stroke();
}

function drawMinus(ctx, x, y, width, lineWidth) {
    ctx.fillRect(x - width / 2, y - lineWidth / 2, width, lineWidth);
}

function drawPlus(ctx, x, y, width, lineWidth) {
    ctx.fillRect(x - lineWidth / 2, y - width / 2, lineWidth, width);
    ctx.fillRect(x - width / 2, y - lineWidth / 2, width, lineWidth);
}