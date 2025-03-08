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

    if (!colorDark) {
        colorDark = darkColor(color, colors.darkColorCoef);
    }
    if (!colorLight) {
        colorLight = opacityColor(color, colors.lightColorCoef);
    }

    return mindMap.addNode({ id, x, y, name, joint, parent, color, colorDark, colorLight });
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
    node.colorDark = colorDark || darkColor(node.color, colors.darkColorCoef);
    node.colorLight = colorLight || opacityColor(node.color, colors.lightColorCoef);
}

export function transplantNode(branch, node) {
    if (branch.parent) {
        branch.parent.childs.splice(branch.parent.childs.indexOf(branch), 1);
    }

    if (node) {
        branch.parent = node;
        node.childs.push(branch);
    } else {
        branch.parent = undefined;
    }
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
        if (node.dir == 'left') {
            nodeStartAngle += 90;
        } else {
            nodeStartAngle -= 90;
        }
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

            if (jointNum == 0 || jointNum == 1) {
                resultStartAngle += currentStartAngleOffset * mirror;
            } else {
                resultStartAngle -= currentStartAngleOffset * mirror;
            }

            mirror *= -1; // Reverse mirror

            const left = radius * Math.cos((nodeStartAngle + resultStartAngle) * Math.PI / 180) + center.x;
            const right = radius * Math.cos((nodeStartAngle + resultStartAngle + currentSectorAngle) * Math.PI / 180) + center.x;
            const top = radius * Math.sin((nodeStartAngle + resultStartAngle) * Math.PI / 180) + center.y;
            const bottom = radius * Math.sin((nodeStartAngle + resultStartAngle + currentSectorAngle) * Math.PI / 180) + center.y;

            let onFind = false;

            for (let i in node.childs) {
                if (!node.parent && node.childs[i].joint != jointNum) {
                    continue;
                }

                // If current connector

                if (!node.parent && jointNum == 0) {
                    if (node.childs[i].x > left && node.childs[i].x < right) {
                        onFind = true;
                    }
                }
                if (!node.parent && jointNum == 2) {
                    if (node.childs[i].x > right && node.childs[i].x < left) {
                        onFind = true;
                    }
                }

                if (!node.parent && jointNum == 1 || node.parent && node.dir == 'right') {
                    if (node.childs[i].y > top && node.childs[i].y < bottom) {
                        onFind = true;
                    }
                }
                if (!node.parent && jointNum == 3 || node.parent && node.dir == 'left') {
                    if (node.childs[i].y > bottom && node.childs[i].y < top) {
                        onFind = true;
                    }
                }

                if (onFind) {
                    break;
                }
            }

            if (!onFind) {
                // Calculate node coords in middle of current sector
                const newNodeAngle = (nodeStartAngle + resultStartAngle + currentSectorAngle / 2) * Math.PI / 180;

                const newNodeCoords = { x: 0, y: 0 };
                newNodeCoords.x = radius * Math.cos(newNodeAngle) + center.x;
                newNodeCoords.y = radius * Math.sin(newNodeAngle) + center.y;

                return newNodeCoords;
            }

            if (mirror == -1) {
                currentStartAngleOffset += currentSectorAngle / 2;

                if (currentStartAngle - currentStartAngleOffset < 0) {
                    break;
                }
            }
        }

        currentSectorAngle /= 2;
    }
}

export function isOverNodeText(event, node) {
    const cursor = unproject({ x: event.offsetX, y: event.offsetY });;

    return isOverRect(node.textbox, cursor, baseSize / 2);
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

    if (isOverCircle(node.x, node.y - node.boundbox.height / 2, baseSize * 0.625, cursorPoint)) {
        return 0;
    }
    if (isOverCircle(node.x + node.boundbox.width / 2, node.y, baseSize * 0.625, cursorPoint)) {
        return 1;
    }
    if (isOverCircle(node.x, node.y + node.boundbox.height / 2, baseSize * 0.625, cursorPoint)) {
        return 2;
    }
    if (isOverCircle(node.x - node.boundbox.width / 2, node.y, baseSize * 0.625, cursorPoint)) {
        return 3;
    }

    return -1;
}

function isOverRect(rect, cursorPoint, padding = 0) {
    return ((cursorPoint.x > rect.x - padding) && (cursorPoint.x < rect.x + rect.width + padding) && (cursorPoint.y > rect.y - padding) && (cursorPoint.y < rect.y + rect.height + padding));
}

function isOverCircle(circleX, circleY, circleRadius, cursorPoint) {
    return (Math.pow(cursorPoint.x - circleX, 2) +
        Math.pow(cursorPoint.y - circleY, 2) <= Math.pow(circleRadius, 2));
}