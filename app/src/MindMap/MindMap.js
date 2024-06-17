import { v4 as uuid } from 'uuid';
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
        this.nodesById = {};
        this.view = { x: 0, y: 0, scale: 1, moveable: true };

        if (source) {
            this.importFromStruct(source);
        }
    }

    addNode(options) {
        if (options.id && this.nodesById[options.id]) {
            return;
        }

        if (options.parent) {
            if (options.color) {
                options.colorDark = options.colorDark || darkColor(options.color, 0.9);
                options.colorLight = options.colorLight || opacityColor(options.color, 0.4);
            }

            const node = new Node(options);
            if (options.parent.parent) {
                node.dir = parent.dir;
            } else {
                if (options.joint == 3) {
                    node.dir = 'left';
                }
            }

            this.nodes.push(node);
            this.nodesById[node.id] = node;
            options.parent.childs.push(node);

            return node;
        } else {
            const root = new Node(options);

            this.nodes.push(root);
            this.nodesById[root.id] = root;

            return root;
        }
    }

    deleteNode(node, first) {
        if (first && node.parent) {
            const i = node.parent.childs.indexOf(node);
            
            if (i !== -1) {
                node.parent.childs.splice(i, 1);
            }
        }

        for (let i in node.childs) {
            this.deleteNode(node.childs[i]);
        }

        const i = this.nodes.indexOf(node); 

        if (i !== -1) {
            this.nodes.splice(i, 1);
            delete(this.nodesById[node.id]);
        }
    }

    getStruct() {
        let struct = [];

        for (let i in this.nodes) {
            if (this.nodes[i].parent) {
                continue;
            }

            struct.push(getPlainNode(this.nodes[i]));
        }

        return struct;

        function getPlainNode(node) {
            let plainNode = {
                id: node.id,
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
            const currentNode = mindMap.addNode({id: node.id, x: node.x, y: node.y, name: node.name, joint: node.joint, parent: parent, color: node.color});
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
    constructor(options) {
        this.id = options.id || uuid(),
        this.x = options.x;
        this.y = options.y;
        this.name = options.name || '';
        this.parent = options.parent;
        this.childs = [];
        this.joint = options.joint;
        this.dir = 'right';
        this.state = 0;
        this.textbox = {};
        this.boundbox = {};
        this.color = options.color || '';
        this.colorDark = options.colorDark || '';
        this.colorLight = options.colorLight || '';
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