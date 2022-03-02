// MindEditor
// Class.js

"use strict";

class MindMap
{
	constructor(name, source)
	{
		this.nodes = [];
		this.editable = true;
		this.view = {x: 0 , y: 0, moveable: true};

		if(source)
		{
			this.importFromStruct(source);
		}

		if(name){this.name = name;}
	}
	
	add_node(x, y, name, joint, parent, color)
	{
		if(parent)
		{
			let node = new Node(x, y, name, joint, parent);
			if(parent.parent)
			{
				node.dir = parent.dir;
			}
			else
			{
				if(joint == 3){node.dir = 'left';}
			}

			if(color)
			{
				node.color = color;
			}
			else
			{
				if(node.parent.parent)
				{
					node.color = parent.color;
				}
				else
				{
					node.color = colors.branches[randomInteger(0, colors.branches.length-1)];
				}
			}
			
			this.nodes.push(node);
			parent.childs.push(node);

			return node;
		}
		else
		{
			let root = new Node(x, y, name);

			if(color)
			{
				root.color = color;
			}
			else
			{
				root.color = colors.branches[randomInteger(0, colors.branches.length-1)];
			}
			
			this.nodes.push(root);

			return root;
		}
	}

	delete_node(node, first)
	{
		if(first && node.parent)
		{
			node.parent.childs.splice(node.parent.childs.indexOf(node), 1);
		}

		for(let i in node.childs)
		{
			this.delete_node(node.childs[i]);
		}

		this.nodes.splice(this.nodes.indexOf(node), 1);
	}

	get_struct()
	{
		let struct = [];

		for(let i in this.nodes)
		{
			if (this.nodes[i].parent){continue;}

			struct.push(get_plain_node(this.nodes[i]));
		}

		return struct;

		function get_plain_node(node)
		{
			let pnode = 
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
				pnode.nodes.push(get_plain_node(node.childs[i]));
			}

			return pnode;
		}
	}

	importFromStruct(struct)
	{
		this.nodes = [];

		for(let i in struct)
		{
			addPlainNode(this, struct[i]);
		}

		function addPlainNode(mindMap, node, parent)
		{
			let currentNode = mindMap.add_node(node.x, node.y, node.name, node.joint, parent, node.color);
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
	constructor(x, y, name, joint, parent)
	{
		this.x = x;
		this.y = y;
		this.name = name || '';
		this.parent = parent;
		this.childs = [];
		this.joint = joint;
		this.dir = 'right';
		this.state = 0;
		this.joint_state = -1;
		this.textbox = {};
		this.boundbox = {};
		this.color = '';
	}
}
