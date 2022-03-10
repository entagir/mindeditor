class MindMap
{
	constructor(name, source)
	{
		this.name = name;
		this.editable = true;

		this.nodes = [];
		this.view = {x: 0 , y: 0, scale: 1, moveable: true};

		if(source)
		{
			this.importFromStruct(source);
		}
	}
	
	addNode(x, y, name, joint, parent, color)
	{
		if(parent)
		{
			let node = new Node(x, y, name, joint, parent, color);
			if(parent.parent)
			{
				node.dir = parent.dir;
			}
			else
			{
				if(joint == 3){node.dir = 'left';}
			}
			
			this.nodes.push(node);
			parent.childs.push(node);

			return node;
		}
		else
		{
			let root = new Node(x, y, name, undefined, undefined, color);
			
			this.nodes.push(root);

			return root;
		}
	}

	deleteNode(node, first)
	{
		if(first && node.parent)
		{
			node.parent.childs.splice(node.parent.childs.indexOf(node), 1);
		}

		for(let i in node.childs)
		{
			this.deleteNode(node.childs[i]);
		}

		this.nodes.splice(this.nodes.indexOf(node), 1);
	}

	getStruct()
	{
		let struct = [];

		for(let i in this.nodes)
		{
			if (this.nodes[i].parent){continue;}

			struct.push(getPlainNode(this.nodes[i]));
		}

		return struct;

		function getPlainNode(node)
		{
			let plainNode = 
			{
				x: node.x,
				y: node.y,
				name: node.name,
				joint: node.joint,
				color: node.color,
				nodes: [],
			};

			for(let i in node.childs)
			{
				plainNode.nodes.push(getPlainNode(node.childs[i]));
			}

			return plainNode;
		}
	}

	importFromStruct(struct)
	{
		for(let i in struct)
		{
			addPlainNode(this, struct[i]);
		}

		function addPlainNode(mindMap, node, parent)
		{
			let currentNode = mindMap.addNode(node.x, node.y, node.name, node.joint, parent, node.color);
			currentNode.action = node.action;

			for(let i in node.nodes)
			{
				addPlainNode(mindMap, node.nodes[i], currentNode);
			}
		}
	}
}

class Node
{
	constructor(x, y, name = '', joint, parent, color = '')
	{
		this.x = x;
		this.y = y;
		this.name = name;
		this.parent = parent;
		this.childs = [];
		this.joint = joint;
		this.dir = 'right';
		this.state = 0;
		this.joint_state = -1;
		this.textbox = {};
		this.boundbox = {};
		this.color = color;
	}
}

export {MindMap};