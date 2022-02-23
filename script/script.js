// MindEditor
// Script.js

"use strict";

let onLoading = true;
let DEBUG = false;

let canvas;

let tabs;

let mindMaps = [];
let mindMap;
let mindMapNum = 0;

let onDrag = false;
let dragState = 0; // 0,1,2
let draggedElem;
let dragTimer;
let dragEnd = false;
let dragWait = false;
let dragWaitWorkspace = false;

let contextElem;
let contextCoords = {x:0, y:0};
let contextUp = false;
let contextFlag = false;

let renameMode = false;
let renameAuto = false;
let renamedNode;

let cursorOffset = { x:0, y:0 };
let canvasOffset = { x:0, y:0 };

let lastActiveNode = -1; // last active node index

let placeholder = 'Press to edit';
let defaultName = 'New mindmap';

let localSamples = {};
let systemFiles = {};

let colors = {};
colors['lightgray'] = '#565656';
colors['background'] = '#fcfcfc';
colors['border'] = '#E9E9E9';
colors.branches = ['#e096e9', '#988ee3', '#7aa3e5', '#67d7c4', '#9ed56b', '#ebd95f', '#efa670', '#e68782'];
// extra = ['#e23e2b', '#a65427', '#ffaa38', '#e8e525', '#69b500', '#0a660d', '#3e8975', '#0da7d3', '#075978', '#272727', '#5f5f5f', '#b4b4b4'];

window.onload = function()
{
	init();
}

window.onunload = function()
{
	saveTempMaps();
}

window.onresize = function()
{
	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;

	if(!mindMap.editable){setViewOnCenterOfWeight();}
	
	draw(mindMap);
}

function init()
{
	let menu = Tlaloc.menu('menu');
	menu.addItem('MindEditor', function(){openMenu();});
	menu.addItem('New', function(){newFile();});
	menu.addItem('Open', function(){loadFromFile();});
	menu.addItem('Save', function(){saveFile();});
	menu.addItem('Close', function(){closeFile();});
	
	tabs = Tlaloc.tabs('tabs');

	initColorsDialog(colors.branches);
	initFiles();

	canvas = $('#canvas'); 
	
	canvas.addEventListener('click', canvasClicked);
	canvas.addEventListener('mousemove', canvasMouseMoved);
	canvas.addEventListener('mouseover', canvasMouseMoved);
	canvas.addEventListener('mousedown', canvasMouseDowned);
	canvas.addEventListener('mouseup', canvasMouseUped);
	canvas.addEventListener('dblclick', canvasDblClicked);
	canvas.addEventListener('contextmenu', canvasContexted);
	
	// canvas.addEventListener('wheel', function(event){  });
	// document.body.addEventListener('keydown', function(event){  });
	// document.body.addEventListener('keyup', function(event){  });

	canvas.addEventListener('drop', canvasFilesDroped);
	canvas.addEventListener('dragover', canvasFilesDragged);
	let loader = $('#uploader');
	loader.addEventListener('change', loaderChanged);

	$('#rename-area').addEventListener('input', renameAreaInputed);
	$('#rename-area').addEventListener('keydown', renameAreaKeyDowned);
	$('#rename-area').addEventListener('mouseover', renameAreaMouseOver);
	$('#rename-area').addEventListener('blur', renameAreaBlured);

	$('#dialogs-cont').addEventListener('mousedown', function(e){if(e.target == this){showDialog();}});
	$('#button-name').addEventListener('click', renameMap);
	$('#button-save').addEventListener('click', saveMap);

	$('#input-name').placeholder = $('#input-save').placeholder = defaultName;

	let forms = document.querySelectorAll('form');
	for(let i of forms)
	{
		i.addEventListener('submit', function(e){e.preventDefault();});
	}

	loadTempMaps();
}

async function loadFromUrl(url)
{
	let res = await fetch(url);
	let json = await res.json();
	console.info('Loaded: ' + url);

	return json;
}

async function loadLocalFiles(files, storageName, fileList)
{
	// let lst = await api.getFileList('defaultSamples');
	let staticFiles = JSON.parse(localStorage.getItem(storageName)) || {};
	let onLocalStorageUpdate = false;
	for(let fileItem of fileList)
	{
		let staticFile = staticFiles[fileItem.name];

		if(staticFile && staticFile.version == fileItem.version)
		{
			console.info('Opened: ' + fileItem.name);
		}
		else
		{
			staticFiles[fileItem.name] = await loadFromUrl(fileItem.url);
			if(!staticFiles[fileItem.name].version){staticFiles[fileItem.name].version = fileItem.version;}
			onLocalStorageUpdate = true;
		}

		files[fileItem.name] = staticFiles[fileItem.name];
	}

	if(onLocalStorageUpdate)
	{
		localStorage.setItem(storageName, JSON.stringify(staticFiles));
	}
}

function initColorsDialog(colors)
{
	for(let i in colors)
	{
		let button = document.createElement('button');

		button.style.background = colors[i];
		button.style.color = colors[i];
		button.setAttribute('data-color', colors[i]);
		button.addEventListener('click', function(e){selectColor(button);});
		
		$('#colors-cont').appendChild(button);
	}
}

async function initFiles()
{
	let localSamplesList = [];
	localSamplesList.push({name: 'Palms', url: 'https://mind.entagir.ru/static/samples/Palms.json', version: 0});
	localSamplesList.push({name: 'MindEditorFeatures', url: 'https://mind.entagir.ru/static/samples/MindEditor%20Features.json', version: 0});
	await loadLocalFiles(localSamples, 'localSamples', localSamplesList);

	let systemFilesList = [];
	systemFilesList.push({name: 'Menu', url: 'https://mind.entagir.ru/static/system/Menu.json', version: 0});
	systemFilesList.push({name: 'Help', url: 'https://mind.entagir.ru/static/system/Help.json', version: 0});
	await loadLocalFiles(systemFiles, 'systemFiles', systemFilesList);

	// Menu map init
	mindMaps['start'] = new MindMap('start', systemFiles['Menu'].mindMap);
	mindMaps['start'].editable = false;
	if(!mindMap){selectMindMap('start');}

	// Help map init
	mindMaps['help'] = new MindMap('help', systemFiles['Help'].mindMap);
	mindMaps['help'].editable = false;

	// Samples list init
	let fileList = $('#file-list-samples');
	fileList.innerHTML = '';

	for(let i in localSamples)
	{
		let button = document.createElement('button');
		button.innerHTML = i;
		button.setAttribute('data-name', i);
		button.addEventListener('click', function(e)
		{
			showDialog('');

			addMindMap(i, localSamples[i]['mindMap']);
			setViewOnCenterOfWeight();
		});
		fileList.appendChild(button);
	}

	onLoading = false;
}

function checkBounds()
{
	// Check nodes and titles width and height

	let ctx = canvas.getContext('2d');

	for(let i in mindMap.nodes)
	{
		if(mindMap.nodes[i].parent === undefined)
		{
			let node = mindMap.nodes[i];

			let text = placeholder;
			drawRootText(ctx, node);

			node.textbox.w = ctx.measureText(text).width;
			node.textbox.h = ctx.measureText(text).actualBoundingBoxAscent + ctx.measureText(text).actualBoundingBoxDescent;
			
			node.boundbox.w = node.textbox.w + 20 * 2;
			node.boundbox.h = 20 * 3;

			if(node.name != '')
			{
				text = node.name;
				drawRootText(ctx, node);

				node.textbox.w = ctx.measureText(text).width;
				node.textbox.h = ctx.measureText(text).actualBoundingBoxAscent + ctx.measureText(text).actualBoundingBoxDescent;

				let currentBoundBox = {w: node.textbox.w + 20 * 2, h: 20 * 3};

				if(currentBoundBox.w > node.boundbox.w)
				{
					node.boundbox.w = currentBoundBox.w;
				}
				if(currentBoundBox.h > node.boundbox.h)
				{
					node.boundbox.h = currentBoundBox.h;
				}
			}
		}
		else
		{
			let node = mindMap.nodes[i];

			if(!node.textbox.minWidth) // Or changed font
			{
				let text = placeholder;
				drawNodeText(ctx, node);

				node.textbox.minWidth = ctx.measureText(text).width;
				node.textbox.minHeight = ctx.measureText(text).actualBoundingBoxAscent + ctx.measureText(text).actualBoundingBoxDescent;

			}

			let text = node.name || placeholder;
			drawNodeText(ctx, node);
			node.textbox.w = ctx.measureText(text).width;
			node.textbox.h = ctx.measureText(text).actualBoundingBoxAscent + ctx.measureText(text).actualBoundingBoxDescent;	

			let textOffset = {x: 0, y: 0};
			
			if(node.childs.length == 0)
			{
				textOffset.x = 20 + 5;
			
				if(node.parent.x > node.x)
				{
					textOffset.x *= -1;
				}
			}
			else
			{
				textOffset.x = 10 + 5;
				
				if(node.parent.x <= node.x)
				{
					textOffset.x *= -1;
				}
		
				textOffset.y = 20 + 5;
				
				if(node.parent.y >= node.y)
				{
					textOffset.y *= -1;
				}
			}

			let point = def({x:node.x, y:node.y});
			
			node.textbox.x = point.x + textOffset.x;
			
			if(textOffset.x < 0)
			{
				node.textbox.x -= node.textbox.w
			}
		
			node.textbox.y = point.y + textOffset.y - node.textbox.h / 2;
		}
	}
}

function draw(mindMap)
{
	let ctx = canvas.getContext('2d');

	canvas.width = canvas.width;

	ctx.fillStyle = colors['background'];
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	
	// Draw branches
	for(let i in mindMap.nodes)
	{
		if(mindMap.nodes[i].parent)
		{
			// Joint offset respect to elem center
			let startLine = {x: 0,y: 0};
			
			if(mindMap.nodes[i].parent.parent === undefined)
			{
				// Root elem to node branch

				let parent = mindMap.nodes[i].parent;

				if(mindMap.nodes[i].joint == 0){startLine = {x: 0, y: -parent.boundbox.h / 2};}
				if(mindMap.nodes[i].joint == 1){startLine = {x: parent.boundbox.w / 2, y: 0};}
				if(mindMap.nodes[i].joint == 2){startLine = {x: 0, y: parent.boundbox.h / 2};}
				if(mindMap.nodes[i].joint == 3){startLine = {x: -parent.boundbox.w / 2, y: 0};}
			}
			
			// Draw parent to child (this) branch
			let branchStart =
			{
				x: mindMap.nodes[i].parent.x + startLine.x,
				y: mindMap.nodes[i].parent.y + startLine.y
			};
			let branchEnd = {x: mindMap.nodes[i].x, y: mindMap.nodes[i].y};

			drawEdge(ctx, def(branchStart), def(branchEnd), mindMap.nodes[i].color);
		}
	}
	
	// Draw nodes
	for(let i in mindMap.nodes)
	{
		if(mindMap.nodes[i].parent)
		{
			// Draw child elem
			drawNode(ctx, mindMap.nodes[i]);
		}
		else
		{
			// Draw root elem
			drawRootNode(ctx, mindMap.nodes[i]);
		}
	}
}

function drawRootNode(ctx, node)
{
	let point = def({x:node.x, y:node.y});

	let joint_state = node.joint_state;

	ctx.fillStyle = node.color;
	ctx.lineWidth = 2;
	ctx.strokeStyle = colors['border'];

	drawRoundedRect(ctx, point.x - node.boundbox.w / 2, point.y - node.boundbox.h / 2, node.boundbox.w, node.boundbox.h, 10);
	drawRootText(ctx, node);

	if(!(renameMode && renamedNode == node))
	{
		// Draw connectors ("+" circles)
		drawConnector(ctx, point.x, point.y - node.boundbox.h / 2, node.color, node.joint_state == 0);
		drawConnector(ctx, point.x + node.boundbox.w / 2, point.y, node.color, node.joint_state == 1);
		drawConnector(ctx, point.x, point.y + node.boundbox.h / 2, node.color, node.joint_state == 2);
		drawConnector(ctx, point.x - node.boundbox.w / 2, point.y, node.color, node.joint_state == 3);
	}
}

function drawNode(ctx, node)
{
	let point = def({x:node.x, y:node.y});

	let state = node.state;

	// Draw connector
	drawConnector(ctx, point.x, point.y, node.color, state == 1);
	
	// Draw text
	drawNodeText(ctx, node);
}

function drawEdge(ctx, start, end, color)
{
	ctx.beginPath();
	
	drawBezier(start.x, start.y, end.x, end.y);

	ctx.lineWidth = 8;
	ctx.strokeStyle = color;
	ctx.stroke();
	ctx.closePath();

	function drawBezier(xs, ys, xf, yf)
	{
		let p1x = xs + (xf - xs) / 2;
		let p1y = ys;
		
		let p2x = xs + (xf - xs) / 2;
		let p2y = yf;

		ctx.moveTo(xs, ys);
		ctx.bezierCurveTo(p1x, p1y, p2x, p2y, xf, yf);

		if(DEBUG)
		{
			ctx.fillStyle = colors['lightgray'];

			ctx.fillRect( p1x, p1y, 10, 10);
			ctx.fillRect( p2x, p2y, 10, 10);
		}
	}
}

function drawRoundedRect(ctx, x, y, width, height, radius)
{
	ctx.beginPath();
	ctx.moveTo(x, y + radius);
	ctx.arcTo(x, y + height, x + radius, y + height, radius);
	ctx.arcTo(x + width, y + height, x + width, y + height - radius, radius);
	ctx.arcTo(x + width, y, x + width - radius, y, radius);
	ctx.arcTo(x, y, x, y + radius, radius);
	ctx.stroke();
	ctx.fill();
	ctx.closePath();
}

function drawRootText(ctx, node)
{
	let point = def({x:node.x, y:node.y});

	let text = placeholder;
	if(node.name != ''){text = node.name;}

	ctx.fillStyle = '#565656';
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';
	ctx.font = 'bold ' + 20 + 'px Arial';
	ctx.fillText(text, point.x, point.y);
}

function drawNodeText(ctx, node)
{
	ctx.font = 'bold ' + 15 + 'px Arial';
	ctx.fillStyle = colors['lightgray'];
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'left';

	let text = placeholder;
	if(node.name != '')
	{
		text = node.name;
		ctx.fillStyle = node.color;
	}

	ctx.fillText(text, node.textbox.x, node.textbox.y + node.textbox.h / 2);

	if(DEBUG)
	{
		ctx.strokeStyle = colors['lightgray'];
		ctx.strokeRect(node.textbox.x, node.textbox.y, node.textbox.w, node.textbox.h);
	}
	
	if(node.action)
	{
		ctx.fillRect(node.textbox.x, node.textbox.y + node.textbox.h, node.textbox.w, 0.5);
	}
}

function drawConnector(ctx, x, y, color, active)
{
	// Draw circle
	ctx.beginPath();

	ctx.fillStyle = color;
	let r = 5;
	if(active)
	{
		r = 15;
	}

	ctx.arc(x, y, r, 0, Math.PI * 2, false);
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = colors['background'];
	ctx.stroke();

	ctx.closePath();

	// Draw text
	if(active)
	{
		ctx.fillStyle = colors['background'];
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'center';

		ctx.font = 'bold ' + 20 + 'px Arial';
		ctx.fillText('+', x, y);
	}
}

function generateNodeCoords(node, jointNum)
{
	let center = {x: node.x, y: node.y}; // Center of circle
	let radius = 160; // Radius of circle
	
	let angle = 0;

	if(jointNum == 0)
	{
		center.y -= node.boundbox.h / 2;
		angle += 180;
	}
	if(jointNum == 1)
	{
		center.x += node.boundbox.w / 2;
		angle -= 90;
	}
	if(jointNum == 2)
	{
		center.y += node.boundbox.h / 2;
		angle -= 0;
	}
	if(jointNum == 3)
	{
		center.x -= node.boundbox.w / 2;
		angle += 90;
	}
	
	if(node.parent){center = {x: node.x, y: node.y};}
	
	let currentAngle = 90;
	
	while(true)
	{
		let angle_start_c = 90 - currentAngle / 2;
		let angle_offset = 0;
		
		let sym = 0;

		while(true)
		{
			let angle_start = angle_start_c;
			if(sym == 0)
			{
				if((jointNum == 0)||(jointNum == 1)){angle_start -= angle_offset;}
				else{angle_start += angle_offset;}
				sym = 1;
			}
			else
			{
				if((jointNum == 0) || (jointNum == 1)){angle_start += angle_offset;}
				else{angle_start -= angle_offset;}
				sym = 0;
			}
			
			let top = radius * Math.sin((angle + angle_start) * Math.PI/180) + center.y;
			let bottom = radius * Math.sin((angle + angle_start + currentAngle) * Math.PI/180) + center.y;
			let left = radius * Math.cos((angle + angle_start) * Math.PI/180) + center.x;
			let right = radius * Math.cos((angle + angle_start + currentAngle) * Math.PI/180) + center.x;
			
			if((jointNum == 2) || (jointNum == 3))
			{
				let temp = top;
				top = bottom;
				bottom = temp;
				
				temp = left;
				left = right;
				right = temp;
			}
			
			let flag = false;
			
			for(let i in node.childs)
			{
				if(node.childs[i].joint == jointNum)
				{
					if((jointNum == 1) || (jointNum == 3))
					{
						if((node.childs[i].y > top) && (node.childs[i].y < bottom))
						{
							flag = true;
							break;
						}
					}
					else
					{
						if((node.childs[i].x > left) && (node.childs[i].x < right))
						{
							flag = true;
							break;
						}
					}
				}
			}
			
			if(!flag)
			{
				let angle_new = (angle + angle_start + currentAngle/2) * Math.PI/180;
			
				let out_coords = {x:0, y:0};
				out_coords.x = radius * Math.cos(angle_new) + center.x;
				out_coords.y = radius * Math.sin(angle_new) + center.y;
				
				return out_coords;
			}
			
			if(sym == 0)
			{
				angle_offset += currentAngle/2;
				
				if(angle_start_c - angle_offset < 0){break;}
			}
		}
		
		currentAngle /= 2;
	}
}

function rename(node, auto)
{
	let text = node.name;
	let fs = 20; // Font Size (in px)
	
	if(node.parent === undefined)
	{
		fs = '20';
	}
	else
	{
		fs = '15';
	}

	renameAreaSet(node);

	let renameArea = $('#rename-area');
	renameArea.style.display = 'block';
	renameArea.style.fontSize = fs + 'px';
	renameArea.value = text;
	
	renameArea.focus();
	
	renameMode = true;
	renameAuto = auto || false;
	renamedNode = node;

	draw(mindMap);
}

function renameAreaSet(node)
{
	let point = def({x: node.x, y: node.y});
	let rect = {w: 0, h: 0};
	
	if(node.parent === undefined)
	{
		// Root elem
		rect.w = node.boundbox.w + 2;
		rect.h = node.boundbox.h + 2;
		
		point.x -= rect.w / 2;
		point.y -= rect.h / 2;
	}
	else
	{
		if(node.textbox.w > node.textbox.minWidth)
		{
			rect.w = node.textbox.w + 25;
		}
		else
		{
			rect.w = node.textbox.minWidth + 25;
		}

		if(node.textbox.w > node.textbox.minHeight)
		{
			rect.h = node.textbox.h + 15;
		}
		else
		{
			rect.h = node.textbox.minHeight + 15;
		}
		
		point.x = node.textbox.x - 25 / 2;
		point.y = node.textbox.y - 15 / 2;
	}

	let renameArea = $('#rename-area');
	renameArea.style.left = point.x + 'px';
	renameArea.style.top = point.y + 'px';
	renameArea.style.width = rect.w + 'px';
	renameArea.style.height = rect.h + 'px';
}

function completeRename()
{
	renameMode = false;

	let renameArea = $('#rename-area');
	renamedNode.name = renameArea.value;
	renameArea.style.display = 'none';

	checkBounds();
}

function deleteSelectedNode()
{
	lastActiveNode = -1;

	showContextMenu('');

	mindMap.delete_node(contextElem, true);
	checkBounds();

	draw(mindMap);
}

function renameSelectedNode()
{
	showContextMenu('');

	rename(contextElem);
}

function resetLastActiveNode()
{
	if(lastActiveNode != -1)
	{
		if(mindMap.nodes[lastActiveNode].parent)
		{
			mindMap.nodes[lastActiveNode].state = 0;
		}
		else
		{
			mindMap.nodes[lastActiveNode].joint_state = -1;
		}
	}
}

function moveNode(node, offsetX, offsetY)
{
	node.x -= offsetX;
	node.y -= offsetY;
	
	for(let i in node.childs)
	{
		moveNode(node.childs[i], offsetX, offsetY);
	}
}

function canvasClicked(e)
{
	// Complete drag if drag mode 
	if(dragEnd)
	{
		dragEnd = false;

		return;
	}

	let renamed = false;
	// Complete rename if rename mode 
	if(renameMode)
	{
		completeRename();
		canvasMouseMoved(e);
		
		renamed = true && !renameAuto;
	}

	if(contextFlag)
	{
		contextFlag = false;
		canvasMouseMoved(e);

		return;
	}
	
	// Click on node
	for(let i in mindMap.nodes)
	{
		if(mindMap.editable && mindMap.nodes[i].parent === undefined)
		{
			// Root elem
			if(!renamed)
			{
				// "+" circles
				let jointNum = isOverRootJoint(e, mindMap.nodes[i]);
				if(jointNum != -1)
				{
					// Add branch
					let coords = generateNodeCoords(mindMap.nodes[i], jointNum);
					let addedNode = mindMap.add_node(coords.x, coords.y, '', jointNum, mindMap.nodes[i]);

					checkBounds();
					draw(mindMap);
					rename(addedNode, true);
					
					return;
				}
			}

			// Root elem shape
			if(isOverRoot(e, mindMap.nodes[i]))
			{
				rename(mindMap.nodes[i]);
				
				return;
			}
		}
		else
		{
			// Node
			if(mindMap.editable && !renamed && isOverNode(e, mindMap.nodes[i]))
			{
				// Add sub-branch
				let coords = generateNodeCoords( mindMap.nodes[i], mindMap.nodes[i].joint);
				let addedNode = mindMap.add_node(coords.x, coords.y, '', mindMap.nodes[i].joint, mindMap.nodes[i]);
				
				checkBounds();
				draw(mindMap);
				rename(addedNode, true);
				
				return;
			}
			
			if(isOverNodeText(e, mindMap.nodes[i]))
			{
				if(mindMap.editable)
				{
					rename(mindMap.nodes[i]);
				}
				else
				{
					if(mindMap.nodes[i].action)
					{
						switch(mindMap.nodes[i].action)
						{
							case 'new': newFile(); break;
							case 'open': loadFromFile(); break;
							case 'help': openHelp(); break;
							case 'samples': openSamples(); break;
							case 'git': openLink('https://github.com/entagir/mindeditor'); break;
						}
					}
				}
				
				return;
			}
		}
	}
	
	// Click on canvas
}

function canvasContexted(e)
{
	e.preventDefault();
	if(onLoading){return;}

	if(!mindMap.editable){return;}

	// Complete rename if rename mode 
	if(renameMode)
	{
		completeRename();
		canvasMouseMoved(e);
	}
	
	for(let i in mindMap.nodes)
	{
		if(mindMap.nodes[i].parent === undefined)
		{
			// Root elem or "+" circles
			if(isOverRoot(e, mindMap.nodes[i]) || isOverRootJoint(e, mindMap.nodes[i]) > -1)
			{
				contextElem = mindMap.nodes[i];
				
				showContextMenu('branch', e.offsetX, e.offsetY);
				resetLastActiveNode();
				
				return;
			}
		}
		else
		{
			// Over node ("+") or node text (label)
			if(isOverNode(e, mindMap.nodes[i]) || isOverNodeText(e, mindMap.nodes[i]))
			{
				contextElem = mindMap.nodes[i];
				
				showContextMenu('branch', e.offsetX, e.offsetY);
				resetLastActiveNode();
				
				return;
			}
		}
	}

	showContextMenu('canvas', e.offsetX, e.offsetY);
}

function canvasMouseMoved(e)
{
	if(onLoading){return;}
	if(contextUp){return;}

	if(dragWait)
	{
		clearTimeout(dragTimer);
		initDrag();
	}

	if(dragWaitWorkspace)
	{
		clearTimeout(dragTimer);
		initDragWorkspace();
	}

	let x = e.offsetX;
	let y = e.offsetY;

	// Drag workspace
	if(onDrag)
	{
		shiftView((x - canvasOffset.x), (y - canvasOffset.y));

		canvasOffset.x = x;
		canvasOffset.y = y;

		checkBounds();
		draw(mindMap);

		if(renameMode)
		{
			renameAreaSet(renamedNode);
		}

		return;
	}
	
	// Drag object
	if(dragState == 2)
	{
		let cursor = undef({x:e.offsetX, y:e.offsetY});

		let ox = draggedElem.x - (cursor.x - cursorOffset.x);
		let oy = draggedElem.y - (cursor.y - cursorOffset.y);
		
		moveNode(draggedElem, ox, oy);

		checkBounds();
		draw(mindMap);
		
		if(renameMode)
		{
			renameAreaSet(renamedNode);
		}

		return;
	}

	resetLastActiveNode();
	
	for(let i in mindMap.nodes)
	{
		if(mindMap.editable && mindMap.nodes[i].parent === undefined)
		{
			let jointIndex = isOverRootJoint(e, mindMap.nodes[i]);

			// Root elem
			// "+" circles
			if(!renameMode || renameAuto)
			{
				mindMap.nodes[i].joint_state = jointIndex;
				
				draw(mindMap);
			}

			// Root elem
			if(isOverRoot(e, mindMap.nodes[i]) || (jointIndex > -1 && (!renameMode || renameAuto)))
			{
				lastActiveNode = i;

				canvas.style.cursor = 'pointer';
				dragState = 1;
				
				return;
			}
		}
		else
		{
			// Over node ("+")
			if(mindMap.editable && (!renameMode || renameAuto) && isOverNode(e, mindMap.nodes[i]))
			{
				lastActiveNode = i;

				mindMap.nodes[i].state = 1;
				canvas.style.cursor = 'pointer';
				dragState = 1;
				
				draw(mindMap);
				
				return;
			}
			
			// Over Node text (label)
			if(isOverNodeText(e, mindMap.nodes[i]))
			{
				canvas.style.cursor = 'pointer';
				
				return;
			}
		}
	}
	
	dragState = 0;
	canvas.style.cursor = 'grab';
	
	draw(mindMap);
}

function canvasMouseDowned(e)
{
	if(onLoading){return;}
	if(!mindMap.editable || (renameMode && !renameAuto)){return;}
	
	let x = e.offsetX;
	let y = e.offsetY;
	
	if(contextUp)
	{
		showContextMenu('');
	}

	if(e.which == 3){return;}
	
	if(dragWait || dragWaitWorkspace){return;}
	
	let onWorkspace = true;
	
	for(let i in mindMap.nodes)
	{
		if(mindMap.nodes[i].parent === undefined)
		{
			// Root elem
			if(isOverRoot(e, mindMap.nodes[i]) || isOverRootJoint(e, mindMap.nodes[i]) > -1)
			{
				if(dragState == 1)
				{
					initDragElem(mindMap.nodes[i]);
				}
				
				onWorkspace = false;
				
				return;
			}
		}
		else
		{
			// Over node ("+")
			if(isOverNode(e, mindMap.nodes[i]))
			{
				onWorkspace = false;
				
				if((dragState == 1)||(dragState == 2))
				{
					
					if(dragState !== 2)
					{
						initDragElem(mindMap.nodes[i]);
					}

					return;
				}
			}
			
			// Over Node text (label)
			if(isOverNodeText(e, mindMap.nodes[i]))
			{
				initDragElem(mindMap.nodes[i]);
				onWorkspace = false;
				
				return;
			}
		}
	}
		
	if((e.which == 1)&&(onWorkspace))
	{
		initDragWorkspace();

		return;
	}

	function initDragElem(node)
	{
		let cursor = undef({x:e.offsetX, y:e.offsetY});
												
		draggedElem = node;
		
		cursorOffset.x = cursor.x - node.x;
		cursorOffset.y = cursor.y - node.y;
		
		draw(mindMap);
		
		clearTimeout(dragTimer);
		dragTimer = setTimeout(initDrag, 200, e);
		dragWait = true;
	}
	
	function initDragWorkspace()
	{
		canvasOffset.x = x;
		canvasOffset.y = y;

		clearTimeout(dragTimer);
		dragTimer = setTimeout(initDragWorkspace, 200, e);
		dragWaitWorkspace = true;
	}
}

function canvasMouseUped(e)
{
	if(onLoading){return;}
	
	let x = e.offsetX;
	let y = e.offsetY;

	clearTimeout(dragTimer);
	dragWait = false;
	dragWaitWorkspace = false;

	if(onDrag)
	{
		onDrag = false;

		canvas.style.cursor = 'grab';
		
		canvasMouseMoved(e);
		
		return;
	}
	
	if((dragState == 1)||(dragState == 2))
	{
		dragState = 1;
		canvas.style.cursor = 'pointer';
		draw(mindMap);
		
		return;
	}
}

function canvasDblClicked(e)
{
	if(onLoading){return;}
	if(!mindMap.editable){return;}

	for(let i in mindMap.nodes)
	{
		if(mindMap.nodes[i].parent === undefined)
		{
			// "+" circles
			let joint_num = isOverRootJoint(e, mindMap.nodes[i]);
			if(joint_num != -1)
			{
				return;
			}

			// Root elem
			if(isOverRoot(e, mindMap.nodes[i]))
			{
				return;
			}
		}
		else
		{
			// Over node ("+")
			if(isOverNode(e, mindMap.nodes[i]))
			{
				return;
			}
			
			// Over Node text (label)
			if(isOverNodeText(e, mindMap.nodes[i]))
			{
				return;
			}
		}
	}

	// Double click on canvas
	
	let cursor = undef({x: e.offsetX, y: e.offsetY});
	mindMap.add_node(cursor.x, cursor.y);
	
	checkBounds();
	canvasMouseMoved(e); // Draw
}

function colorPickerChanged()
{
	contextElem.color = $('#color-picker').value;
	
	draw(mindMap);	
}

function loaderChanged(e)
{
	let loader = $('#uploader');

	loadFiles(loader.files);
}

function readerFileLoaded(e, fileName)
{
	let fileAsText = e.target.result;
	let file = JSON.parse(fileAsText);

	loadMindMap(file, fileName);
}

function canvasFilesDroped(e)
{
	e.preventDefault();

	loadFiles(e.dataTransfer.files);
}

function canvasFilesDragged(e)
{
	e.preventDefault();
}

function loadFiles(files)
{
	for(let file of files)
	{
		let fileName = file.name.split('.')[0];
		let fileExtention = file.name.split('.')[1];

		if(fileExtention != 'json'){continue;}
		// Check file on format ...

		let reader = new FileReader();
		reader.addEventListener('load', function(e){readerFileLoaded(e, fileName);}, false);
		reader.addEventListener('error', function(e){console.error('Error code: ' + e.target.error.code);}, false);
	
		reader.readAsText(file);
	}
}

function showContextMenu(context, x, y)
{
	let allContext = document.querySelectorAll('.context-menu');
	for(let i=0;i<allContext.length;i++)
	{
		allContext[i].style.display = 'none';
	}

	if(!context)
	{
		contextUp = false;
		contextFlag = true;

		draw(mindMap);
		return;
	}
	
	if(x === undefined){x = contextCoords.x; y = contextCoords.y;}
	contextCoords.x = x;
	contextCoords.y = y;
	
	let contextDomElem;
	if(context == 'canvas'){contextDomElem=$('#context-canvas');}
	if(context == 'branch'){contextDomElem=$('#context-branch');}
	if(context == 'colorpicker')
	{
		contextDomElem=$('#context-color-picker');
		$('#color-picker').value = contextElem.color;
	}

	contextDomElem.style.top = y + 'px';
	contextDomElem.style.left = x + 'px';
	contextDomElem.style.display = 'block';

	contextUp = true;
}

function showDialog(name)
{
	showContextMenu('');

	$('#dialogs-cont').style.display = 'none';

	let dialogs = $('#dialogs-cont').children;

	for(let i of dialogs)
	{
		i.style.display = 'none';
	}

	if(!name){return;}

	if(name == 'rename')
	{
		$('#input-name').value = mindMap.name || '';
	}
	if(name == 'save')
	{
		$('#input-save').value = mindMap.name || '';
	}

	$('#dialogs-cont').style.display = 'block';
	$('#dialog-' + name).style.display = 'block';
}

function selectColor(obj)
{
	$('#color-picker').value = obj.getAttribute('data-color');
	colorPickerChanged();

	showContextMenu('');
}

function loadMindMap(file, name)
{
	addMindMap(name, file['mindMap']);

	// Set view
	let centerOfView = {x: 0, y: 0};

	if(file['editorSetings'] && file['editorSetings']['centerOfView'])
	{
		centerOfView = file['editorSetings']['centerOfView'];
	}
	else
	{
		console.info(file);
		centerOfView.x = file['mindMap'][0].x;
		centerOfView.y = file['mindMap'][0].y;
	}

	setView(canvas.width / 2 - centerOfView.x, canvas.height / 2 - centerOfView.y);
}

function renameAreaInputed()
{
	let renameArea = $('#rename-area');
	renamedNode.name = renameArea.value;
	
	checkBounds();
	draw(mindMap);

	renameAreaSet(renamedNode);
}

function renameAreaKeyDowned(e)
{
	if(e.key == 'Enter')
	{
		completeRename();
		canvasMouseMoved(e);
	}
}

function renameAreaBlured(e)
{
	if(renameMode)
	{
		e.target.focus();
	}
}

function renameAreaMouseOver()
{
	resetLastActiveNode();
	draw(mindMap);
}

function isOverNodeText(event, node)
{
	let cursor = {x:event.offsetX, y:event.offsetY};
	let textbox = node.textbox;

	return ( (cursor.x>node.textbox.x)&&(cursor.x<node.textbox.x+node.textbox.w)&&(cursor.y>node.textbox.y)&&(cursor.y<node.textbox.y+node.textbox.h) );
}

function isOverNode(event, node)
{
	let cursor = undef({x:event.offsetX, y:event.offsetY});
	
	return ( Math.pow(cursor.x-node.x, 2) + Math.pow(cursor.y-node.y, 2) <= Math.pow( 20, 2 ) );
}

function isOverRoot(event, node)
{
	let cursor = undef({x:event.offsetX, y:event.offsetY});
	
	return ( (cursor.x>node.x-node.boundbox.w/2)&&(cursor.x<node.x+node.boundbox.w/2)&&(cursor.y>node.y-node.boundbox.h/2)&&(cursor.y<node.y+node.boundbox.h/2) );
}

function isOverRootJoint(event, node)
{
	function isOverCircle(circleX, circleY, circleRadius, cursorPoint)
	{
		return ( Math.pow(cursorPoint.x - circleX, 2) + 
		Math.pow(cursorPoint.y - circleY, 2) <= Math.pow( circleRadius, 2 ) );
	}

	let cursorPoint = undef({x:event.offsetX, y:event.offsetY});
	
	if(isOverCircle(node.x, node.y - node.boundbox.h/2, 20, cursorPoint)){return 0;}
	if(isOverCircle(node.x + node.boundbox.w/2, node.y, 20, cursorPoint)){return 1;}
	if(isOverCircle(node.x, node.y + node.boundbox.h/2, 20, cursorPoint)){return 2;}
	if(isOverCircle(node.x - node.boundbox.w/2, node.y, 20, cursorPoint)){return 3;}
	
	return -1;
}

function def(point)
{
	// Point {x,y}
	// Coords global --> canvas
	
	let res = {};
	res.x = point.x + mindMap.view.x;
	res.y = point.y + mindMap.view.y;
	
	return res;
}

function undef(point)
{
	// Point {x, y}
	// Coords click canvas --> global
	
	let res = {};
	res.x = point.x - mindMap.view.x;
	res.y = point.y - mindMap.view.y;
	
	return res;
}

function shiftView(x, y)
{
	mindMap.view.x += x;
	mindMap.view.y += y;
}

function setView(x, y)
{
	mindMap.view.x = x;
	mindMap.view.y = y;

	checkBounds();
	draw(mindMap);
}

function setViewOnCenterOfWeight()
{
	if(mindMap.nodes.flat().length == 0){return;} 

	let min = {left:Infinity, top:Infinity, right:0, bottom:0};

	for(let i in mindMap.nodes)
	{
		let x = mindMap.nodes[i].x;
		let y = mindMap.nodes[i].y;

		if(x < min.left){min.left = x;}
		if(x > min.right){min.right = x;}
		if(y < min.top){min.top = y;}
		if(y > min.bottom){min.bottom = y;}
	}

	let c = {x:(min.right+min.left)/2, y:(min.bottom+min.top)/2};

	setView(canvas.width/2-c.x, canvas.height/2-c.y);
}

function getCenterOfView(mindMap)
{
	return {x: canvas.width / 2 - mindMap.view.x, y: canvas.height / 2 - mindMap.view.y};
}

function openMenu()
{
	selectMindMap('start');
}

function openHelp()
{
	selectMindMap('help');
}

function openSamples()
{
	showDialog('open');
}

function newFile()
{
	addMindMap();
	// Check canvas width
	mindMap.add_node(canvas.width/2, canvas.height/2);

	checkBounds();
	draw(mindMap);
}

function loadFromFile()
{
	$('#uploader').click();
}

function saveFile()
{
	if(mindMapNum != 'start' && mindMapNum != 'help')
	{
		showDialog('save')
	};
}

function saveToFile()
{
	let file = getFileFromMap(mindMap);
	let fileAsText = JSON.stringify(file, undefined, 2);
	let downloader = $('#downloader');

	downloader.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(fileAsText);
	downloader.download = (mindMap.name || defaultName) + '.json';

	downloader.click();
}

function setNameMap(name)
{
	if(!name){name = defaultName;}

	mindMap.name = name;

	tabs.tabs[mindMapNum].setText(name);
}

function closeFile(num)
{
	if (!num)
	{
		num = mindMapNum;
	}

	if(num == 'start'){return;}

	if(mindMaps.flat().length > 1)
	{
		delete(mindMaps[num]);
		tabs.removeTab(tabs.tabs[num]);

		for(let i=num-1;i>=0;i--)
		{
			if(mindMaps[i])
			{
				selectMindMap(i);

				return;
			}
		}

		for(let i=num+1;i<mindMaps.length;i++)
		{
			if(mindMaps[i])
			{
				selectMindMap(i);

				return;
			}
		}
	}
	else
	{
		delete(mindMaps[num]);
		tabs.removeTab(tabs.tabs[num]);

		selectMindMap('start');
	}
}

function getFileFromMap(mindMap, view)
{
	let file = 
	{
		mindMap: mindMap.get_struct(),
		
		editorSetings: {},
	};

	if(view)
	{
		file.editorSetings['centerOfView'] = getCenterOfView(mindMap);
	}

	return file;
}

function addMindMap(name, source)
{
	mindMaps.push(new MindMap(name, source));

	let num = mindMaps.length - 1;

	tabs.addTab(name || defaultName, function()
	{
		if(mindMapNum == num){showDialog('rename');}

		selectMindMap(num);
	});

	selectMindMap(num);
}

function selectMindMap(num)
{
	if(renameMode){completeRename();}

	resetLastActiveNode();
	lastActiveNode = -1;

	mindMap = mindMaps[num];

	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;

	mindMapNum = num;

	if(num == 'start')
	{
		tabs.changeTab();
	}
	else
	{
		tabs.changeTab(tabs.tabs[num]);
	}

	if(num == 'start' || num == 'help')
	{
		setViewOnCenterOfWeight();
	}

	checkBounds();
	draw(mindMap);
}

function loadTempMaps()
{
	if(localStorage.temp)
	{
		let temp = JSON.parse(localStorage.temp);

		for(let i in temp['files'])
		{
			loadMindMap(temp['files'][i].file, temp['files'][i].name);
		}

		if(temp['selected'] != 'start' && temp['selected'] != 'help'){selectMindMap(temp['selected']);}
	}
}

function saveTempMaps()
{
	if(mindMaps.flat().length == 0)
	{
		localStorage.removeItem('temp');

		return;
	}

	let temp = {};
	temp['files'] = [];
	temp['selected'] = 'start';

	for(let i in mindMaps)
	{
		if(i == 'start' || i == 'help'){continue;}

		let file = getFileFromMap(mindMaps[i], true);

		temp['files'].push({file: file, name: mindMaps[i].name});

		if(mindMapNum == i)
		{
			temp['selected'] = temp['files'].length - 1;
		}
	}

	localStorage.setItem('temp', JSON.stringify(temp));
}

function renameMap()
{
	showDialog();

	let name = $('#input-name').value;

	setNameMap(name);
}

function saveMap()
{
	showDialog();

	let name = $('#input-save').value;
	setNameMap(name);

	saveToFile();
}

function initDrag()
{
	dragState = 2;
	dragWait = false;
	dragEnd = true;

	canvas.style.cursor = 'move';
}

function initDragWorkspace()
{
	onDrag = true;
	dragWaitWorkspace = false;
	dragEnd = true;

	canvas.style.cursor = 'grabbing';
}

function openLink(link)
{
	window.open(link, '_blank');
}

function openImg()
{
	showContextMenu('');

	let newTab = window.open();
	newTab.document.body.innerHTML = '<img src=\''+ canvas.toDataURL() +'\'>';
}

function randomInteger(min, max)
{
	let rand = min + Math.random() * (max + 1 - min);

	return Math.floor(rand);
}

function $(s){return document.querySelector(s);}