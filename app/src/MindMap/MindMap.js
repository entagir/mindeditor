import { darkColor, opacityColor } from '../Utils'

class MindFile {
    constructor(fileListItem, storageName = null, load) {
        this.name = fileListItem.name;
        this.version = fileListItem.version || 0;
        this.id = fileListItem.id;
        this.service = fileListItem.service;
        this.path = fileListItem.path;
        this.editable = fileListItem.editable === undefined ? true : fileListItem.editable;
        this.storageName = storageName;

        if (load) {
            this.mindMap = this.load();
        }
    }

    async getMap() {
        // mindMap getter
        this.mindMap = await this.load();
        return this.load();
    }

    async load() {
        if (!this.mindMap) {
            let file;

            let localFile = JSON.parse(localStorage.getItem(this.storageName));

            if (this.storageName && localFile && localFile.version == this.version) {
                file = localFile;
            } else {
                // For URL path!
                // Load from URL
                const res = await fetch(this.path);
                file = await res.json();
                file.version = this.version;

                // Update localStorage
                if (this.storageName) {
                    localStorage.setItem(this.storageName, JSON.stringify(file));
                }
            }

            let loadedMap = new MindMap(this.name, file.mindMap);
            loadedMap.editable = this.editable;
            this.editorSettings = file.editorSettings;

            return loadedMap;
        } else {
            return await this.mindMap;
        }
    }
}

class MindMap {
    constructor(name, source) {
        this.name = name;
        this.editable = true;

        this.nodes = [];
        this.view = { x: 0, y: 0, scale: 1, moveable: true };

        if (source) {
            this.importFromStruct(source);
        }
    }

    addNode(x, y, name, joint, parent, color, colorDark, colorLight) {
        if (parent) {
            if (color) {
                colorDark = colorDark || darkColor(color, 0.9);
                colorLight = colorLight || opacityColor(color, 0.4);
            }

            const node = new Node(x, y, name, joint, parent, color, colorDark, colorLight);
            if (parent.parent) {
                node.dir = parent.dir;
            } else {
                if (joint == 3) {
                    node.dir = 'left';
                }
            }

            this.nodes.push(node);
            parent.childs.push(node);

            return node;
        } else {
            const root = new Node(x, y, name, undefined, undefined, color);

            this.nodes.push(root);

            return root;
        }
    }

    deleteNode(node, first) {
        if (first && node.parent) {
            node.parent.childs.splice(node.parent.childs.indexOf(node), 1);
        }

        for (let i in node.childs) {
            this.deleteNode(node.childs[i]);
        }

        this.nodes.splice(this.nodes.indexOf(node), 1);
    }

    getStruct() {
        let struct = [];

        for (let i in this.nodes) {
            if (this.nodes[i].parent) { continue; }

            struct.push(getPlainNode(this.nodes[i]));
        }

        return struct;

        function getPlainNode(node) {
            let plainNode = {
                x: node.x,
                y: node.y,
                name: node.name,
                joint: node.joint,
                color: node.color,
                nodes: [],
            };

            for (let i in node.childs) {
                plainNode.nodes.push(getPlainNode(node.childs[i]));
            }

            return plainNode;
        }
    }

    importFromStruct(struct) {
        for (let i in struct) {
            addPlainNode(this, struct[i]);
        }

        function addPlainNode(mindMap, node, parent) {
            const currentNode = mindMap.addNode(node.x, node.y, node.name, node.joint, parent, node.color);
            currentNode.action = node.action;

            if (currentNode.parent && currentNode.parent.x > currentNode.x) {
                currentNode.dir = 'left';
            } else {
                currentNode.dir = 'right';
            }

            if (node.color) {
                node.colorDark = darkColor(node.color, 0.9);
                node.colorLight = opacityColor(node.color, 0.4);
            }

            for (let i in node.nodes) {
                addPlainNode(mindMap, node.nodes[i], currentNode);
            }
        }
    }
}

class Node {
    constructor(x, y, name = '', joint, parent, color = '', colorDark = '', colorLight = '') {
        this.x = x;
        this.y = y;
        this.name = name;
        this.parent = parent;
        this.childs = [];
        this.joint = joint;
        this.dir = 'right';
        this.state = 0;
        this.textbox = {};
        this.boundbox = {};
        this.color = color;
        this.colorDark = colorDark;
        this.colorLight = colorLight;
    }

    get x() {
        return this._x;
    }
    set x(val) {
        //this._x = parseInt(val);
        this._x = val;
    }

    get y() {
        return this._y;
    }
    set y(val) {
        //this._y = parseInt(val);
        this._y = val;
    }
}

export { MindFile, MindMap };