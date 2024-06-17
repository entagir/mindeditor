import { colors, unproject, baseSize } from '../index'
import { darkColor, opacityColor, randomInteger } from '../Utils'

export function addNode(id, mindMap, x, y, name, joint, parent, color, colorDark, colorLight) {
    if (!color) {
        if (parent) {
            if (parent.parent) {
                color = parent.color;
            } else {
                color = colors.branches[randomInteger(0, colors.branches.length - 1)];
            }
        } else {
            color = colors.branches[randomInteger(0, colors.branches.length - 1)];
        }
    }

    if (!colorDark) colorDark = darkColor(color, 0.9);
    if (!colorLight) colorLight = opacityColor(color, 0.4);

    return mindMap.addNode({id, x, y, name, joint, parent, color, colorDark, colorLight});
}

export function moveNode(node, offsetX, offsetY) {
    node.x -= offsetX;
    node.y -= offsetY;

    for (let i in node.childs) {
        moveNode(node.childs[i], offsetX, offsetY);
    }
}

export function setColorNode(node, color, colorDark, colorLight) {
    if (!node.color) {
        return;
    }

    node.color = color;
    node.colorDark = colorDark || darkColor(node.color, 0.9);
    node.colorLight = colorLight || opacityColor(node.color, 0.4);
}

export function transplateNode(branch, node) {
    branch.parent.childs.splice(branch.parent.childs.indexOf(branch), 1);

    branch.parent = node;
    node.childs.push(branch);
}

export function distance(nodeA, nodeB) {
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

export function dfsNode(node, action) {
    action(node);

    for (let i in node.childs) {
        dfsNode(node.childs[i], action)
    }
}

export function getCenterOfView(mindMap) {
    return { x: canvas.width / 2 - mindMap.view.x, y: canvas.height / 2 - mindMap.view.y };
}

export function changeNodeDir(node) {
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

export function calculateNodeCoords(node, jointNum) {
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

export function isOverNodeText(event, node) {
    const cursor = unproject({ x: event.offsetX, y: event.offsetY });;

    return isOverRect(node.textbox, cursor);
}

export function isOverNode(event, node) {
    const cursor = unproject({ x: event.offsetX, y: event.offsetY });

    return isOverCircle(node.x, node.y, baseSize * 0.625, cursor);
}

export function isOverRoot(event, node) {
    const cursor = unproject({ x: event.offsetX, y: event.offsetY });

    return isOverRect(node.boundbox, cursor);
}

export function isOverRootJoint(event, node) {
    const cursorPoint = unproject({ x: event.offsetX, y: event.offsetY });

    if (isOverCircle(node.x, node.y - node.boundbox.height / 2, baseSize * 0.625, cursorPoint)) { return 0; }
    if (isOverCircle(node.x + node.boundbox.width / 2, node.y, baseSize * 0.625, cursorPoint)) { return 1; }
    if (isOverCircle(node.x, node.y + node.boundbox.height / 2, baseSize * 0.625, cursorPoint)) { return 2; }
    if (isOverCircle(node.x - node.boundbox.width / 2, node.y, baseSize * 0.625, cursorPoint)) { return 3; }

    return -1;
}

function isOverRect(rect, cursorPoint) {
    return ((cursorPoint.x > rect.x) && (cursorPoint.x < rect.x + rect.width) && (cursorPoint.y > rect.y) && (cursorPoint.y < rect.y + rect.height));
}

function isOverCircle(circleX, circleY, circleRadius, cursorPoint) {
    return (Math.pow(cursorPoint.x - circleX, 2) +
        Math.pow(cursorPoint.y - circleY, 2) <= Math.pow(circleRadius, 2));
}