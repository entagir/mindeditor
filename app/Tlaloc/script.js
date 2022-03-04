// Tlaloc.js

let Tlaloc = {};

let T = Tlaloc;

Tlaloc.menu = function(name)
{
	let elem = document.getElementById(name);
	elem.classList.add('tlaloc-menu-bar');
	
	return new Menu(elem);
}

Tlaloc.contextMenu = function(name, action)
{
	let elem 
	
	if(name !== undefined)
	{
		elem = document.getElementById(name);
	}
	else
	{
		elem = document.body;
	}
		
	return new ContextMenu(elem, action);
}

Tlaloc.tabs = function(name, type)
{
	let elem = document.querySelector('#' + name);

	elem.classList.add('tlaloc-tabs-panel');
	
	return new Tabs(elem, type);
}

Tlaloc.dialog = function(name, title, type)
{
	let elem = document.getElementById(name);

	return new Dialog(elem, title, type);
}

class Item
{
	constructor(elem, action, level=0, checkable=false, enabled=true, freeze=false)
	{
		this.items = [];
		
		this._elem = elem;
		this._action = action;
		this._level = level;
		this._enabled = enabled;
		this._freeze = freeze;
		this._checkable = checkable;
		this._check = false;
	}

	addItem(text, action, hotkey, checkable=false, enabled=true, freeze=false)
	{
		let item = document.createElement('div');
		
		if(this._level == 0)
		{
			item.className = 'tlaloc-menu';
		}
		else
		{
			item.className = 'tlaloc-menu-item';
		}
		
		let button = document.createElement('div');
		button.className = 'tlaloc-menu-button';
		
		if(this._level > 0)
		{
			button.classList.add('submenu');
			
			let check = document.createElement('div');
			check.className = 'tlaloc-menu-button-check';
						
			button.append(check);
		}
		
		let buttonText = document.createElement('div');
		buttonText.append(document.createTextNode(text));
		buttonText.className = 'text';
		button.append(buttonText);
		
		if(hotkey !== undefined)
		{
			let key = document.createElement('div');
			key.className = 'tlaloc-menu-button-hotkey';
			key.append(document.createTextNode(hotkey));
			button.append(key);
			button.classList.add('hotkey');
		}

		let ul = document.createElement('div');
		if(this._level == 0)
		{
			ul.className = 'tlaloc-menu-list';
		}
		else
		{
			ul.className = 'tlaloc-sub-menu-list';
		}
		
		item.append(button);
		item.append(ul);
		this._elem.append(item);
		
		this.items.push(new Item(ul, action, this._level + 1, checkable, enabled, freeze));

		let cur = this.items[this.items.length - 1];
		
		let obj = this;

		if(this._level == 0)
		{
			button.addEventListener('click', function(event)
			{
				cur._show(obj); event.stopPropagation();
				if(cur._action !== undefined)
				{
					cur._action();
				}
				
			}, false);
		}
		else
		{
			button.addEventListener('mousemove', function(event) { cur._show(obj); event.stopPropagation(); }, false);
			
			button.addEventListener('click', function(event) { cur._click(); }, false);
		}
		
		if(this._level > 1)
		{
			let button = this._elem.parentElement.firstChild;
			button.classList.add('right-arrow');
			
			if(this.items.length == 1)
			{
				let arr = document.createElement('div');
				arr.className = 'tlaloc-menu-button-arrow';
				button.append(arr);
			}
		}
		
		cur.setEnabled(enabled);
		cur.setCheckable(checkable);

		return cur;
	}
	
	addSeparator()
	{
		let li = document.createElement('div');
		li.className = 'tlaloc-separator';
		
		this._elem.append(li);
	}
	
	setCheck(val)
	{
		if(this._checkable)
		{
			let flag = this._elem.parentElement.querySelector('.tlaloc-menu-button-check');
			
			if(val !== undefined)
			{
				this._check = !val;
			}
			
			if(this._check)
			{
				this._check = false;
				
				flag.classList.remove('checked');
				flag.classList.add('unchecked');
			}
			else
			{
				this._check = true;
				
				flag.classList.remove('unchecked');
				flag.classList.add('checked');
			}
		}
	}	
	
	setEnabled(val)
	{
		let but = this._elem.parentElement.firstChild;
		
		if(val)
		{
			this._enabled = true;

			but.classList.remove('disabled');
		}
		else
		{
			this._enabled = false;
			
			but.classList.add('disabled');
		}
	}
	
	getEnabled()
	{
		return this._enabled;
	}

	setCheckable(val)
	{
		if(this._level == 0){ return false; }
		
		let but = this._elem.parentElement.firstChild.firstChild;
		
		if(val)
		{
			this._checkable = true;

			but.classList.remove('none');
			
			this.setCheck(this._check);
		}
		else
		{
			this._checkable = false;
			
			but.classList.add('none');
		}
	}
	
	getCheckable()
	{
		return this._checkable;
	}
	
	setFreeze(val)
	{
		if(this._level == 0){ return false; }
		
		this._freeze = val;
	}
	
	getFreeze()
	{
		return this._freeze;
	}
	
	_click()
	{
		if(!this.getEnabled())
		{
			event.stopPropagation();
			
			return false;
		}
		
		if(this.getCheckable())
		{
			this.setCheck();
		}
		
		if(this._action !== undefined)
		{
			this._action();
		}
		
		if(this.getFreeze())
		{
			event.stopPropagation();
		}
	}
	
	_show(par)
	{
		if(this._active == 1){return;}
		
		par._hideChilds();
		
		let ul;

		ul = this._elem;

		if(ul.innerHTML == '')
		{
			return;
		}
		
		ul.style.display = 'grid';

		ul.parentElement.firstChild.classList.add('selected');

		this._active = 1;
	}
	
	_hide()
	{
		this._elem.style.display = 'none';
		
		this._elem.parentElement.firstChild.classList.remove('selected');
		
		this._active = 0;
		
		this._hideChilds();
	}
	
	_hideChilds()
	{
		for(let i in this.items)
		{
			this.items[i]._hide();
		}
	}
}

class Menu extends Item
{
	constructor(elem)
	{
		super(elem, 0);

		let obj = this;
		document.body.addEventListener('click', function(event){obj._hideChilds();}, false);
	}
}

class ContextMenu extends Item
{
	constructor(elem, action)
	{
		let cmenu = document.createElement('div');
		cmenu.classList.add('tlaloc-context-menu');
		cmenu.addEventListener('mousedown', function(event){event.stopPropagation(); return false;}, false);
		cmenu.addEventListener('mouseup', function(event){event.stopPropagation();}, false);
		document.body.append(cmenu);
		
		super(cmenu, action, 1);

		let obj = this;
		
		elem.oncontextmenu = function(){return false;};

		elem.addEventListener('contextmenu', function(event)
		{
			if(obj._action !== undefined)
			{
				obj._action(event);
			}
			else
			{
				obj._show(event); 
			}
			
			event.stopPropagation(); 
			
			return false;
		}, false);
		
		document.body.addEventListener('mouseup', function(event){obj._hide(event);}, false);
		elem.addEventListener('click', function(event){obj._hide(event);}, false);

		this._space = elem;
	}
	
	addItem(text, action, hotkey, checkable=false, enabled=true, freeze=false)
	{
		let obj = this;
		super.addItem(text, function()
		{
			if(action !== undefined)
			{
				action();
			}
			obj._hide();
		}, hotkey, checkable, enabled, freeze);
	}
	
	_show(event)
	{
		let x = event.offsetX;
		let y = event.offsetY;

		let gc = this._space.getBoundingClientRect();

		this._elem.style.display = 'grid';
		this._elem.style.left = x + gc.left + 'px';
		this._elem.style.top = y + gc.top + 'px';

		this.onContextMenu = true;
		env.onContextMenu = true;
	}
	
	_hide()
	{
		if(this.onContextMenu)
		{
			this._elem.style.display = 'none';
		
			this.onContextMenu = false;
			env.onContextMenu = false;
			
			env.onContextMenuClosed = true;
			
			env.canvas_mouse_move(event);
		}
	}
}

class Tabs
{
	constructor(elem, type)
	{
		this._elem = elem;
		this.type = type;
		this.selectedTab = undefined;
		
		this.tabs = [];
	}
	
	addTab(name, action)
	{
		let tab = document.createElement('div');
		tab.className = 'tlaloc-tab';
	
		this.tabs.push(new Tab(name, tab, action));
		
		let obj = this;
		let cur = this.tabs[this.tabs.length - 1];
		
		tab.addEventListener('click', function(e)
		{
			obj.changeTab(cur);
			
			if(cur._action !== undefined)
			{
				cur._action();
			}
		}, false);
		
		tab.append(document.createTextNode(name));
		
		this._elem.append(tab);
		
		if(this.tabs.length == 1)
		{
			cur._elem.classList.add('active');
			
			this.changeTab(cur);
		}
		
		return cur;
	}
	
	removeTab(obj)
	{
		let t = this.tabs.flat();
		
		let i = t.indexOf(obj);
		
		if(this.selectedTab == obj)
		{
			if(i > 0)
			{
				this.changeTab(t[i - 1]);
			}
			else
			{
				this.changeTab(t[i + 1]);
			}
		}
		
		obj._elem.remove();
		
		delete(this.tabs[this.tabs.indexOf(obj)]);
	}
	
	changeTab(obj)
	{
		let but = this._elem.querySelector('.active');
		
		if(but){but.classList.remove('active');}
		
		if(obj){obj._elem.classList.add('active');}
		
		this.selectedTab = obj;
	}
	
	remove()
	{
		this._elem.innerHTML = '';
	}
}

class Tab
{
	constructor(name, elem, action)
	{
		this._elem = elem;
		this._action = action;
		this._name = name;
	}
	
	setText(text)
	{
		this._name = text;
		
		this._elem.innerHTML = text;
	}
	
	getText()
	{
		return this._name;
	}
}

class Dialog
{
	constructor(cont, title=' ', type)
	{
		this.type = type;
		this._onDrag = false;
		this._dragOffset = {x:0, y:0};

		cont.classList.add('tlaloc-dialog-cont');
		
		let head = document.createElement('div');
		head.classList.add('tlaloc-dialog-head');
		let headControls = document.createElement('div');
		headControls.classList.add('tlaloc-dialog-head-controls');
		let headControlsClose = document.createElement('div');
		headControlsClose.classList.add('tlaloc-dialog-head-controls-close');
		//headControls.append(document.createTextNode('x _ +'));
		headControls.append(headControlsClose);
		let headTitle = document.createElement('div');
		headTitle.classList.add('tlaloc-dialog-head-title');
		headTitle.append(document.createTextNode(title));
		head.append(headControls);
		head.append(headTitle);
		
		let main = document.createElement('div');
		main.classList.add('tlaloc-dialog-main');
		
		main.innerHTML = cont.innerHTML;
		cont.innerHTML = '';
		
		cont.append(head);
		cont.append(main);
		
		this._cont = cont;
		this._head = head;
		this._main = main;
		this._titleElem = headTitle;
		
		let obj = this;
		
		//document.body.addEventListener('click', function(event){obj.hide();}, false);
		
		headControlsClose.addEventListener('click', function(){obj.hide();}, false);
		head.addEventListener('mousedown', function(e){obj.mouseDown(e);}, false);
		head.addEventListener('mouseup', function(e){obj.mouseUp(e);}, false);
		document.body.addEventListener('mousemove', function(e){obj.mouseMove(e);}, false);
	}
	
	show()
	{
		this._cont.style.display = 'grid';
		
		this.moveToCenter();
		
		env.onDialog = true;
	}
	
	hide()
	{
		this._cont.style.display = 'none';
		
		env.onDialog = false;
	}
	
	setTitle(title)
	{
		this._titleElem.innerHTML = title;
	}
	
	move(x, y)
	{
		if(x < 0){ x = 0; }
		if(y < 0){ y = 0; }
		if(x + this._cont.clientWidth > document.body.clientWidth)
		{
			x = document.body.clientWidth - this._cont.clientWidth;
		}
		if(y + this._cont.clientHeight > document.body.clientHeight)
		{
			y = document.body.clientHeight - this._cont.clientHeight;
		}
		
		this._cont.style.left = x + 'px';
		this._cont.style.top = y + 'px';
	}
	
	moveToCenter()
	{
		let x = document.body.clientWidth / 2 - this._cont.clientWidth / 2;
		let y = document.body.clientHeight / 2 - this._cont.clientHeight / 2;
		
		this.move(x, y);
	}
	
	mouseMove(e)
	{
		if(!this._onDrag){return;}
		
		this.move(e.pageX - this._dragOffset.x, e.pageY - this._dragOffset.y);
	}
	
	mouseDown(e)
	{
		let x = e.pageX - this._cont.getBoundingClientRect().left + pageXOffset;
		let y = e.pageY - this._cont.getBoundingClientRect().top + pageYOffset;
		
		this._dragOffset.x = e.pageX - this._cont.getBoundingClientRect().left + pageXOffset;
		this._dragOffset.y = e.pageY - this._cont.getBoundingClientRect().top + pageYOffset;
		
		this._onDrag = true;
		this._head.style.cursor = 'move';
	}
	
	mouseUp(e)
	{
		this._onDrag = false;
		this._head.style.cursor = 'default';
	}
}

export {T, Tlaloc};