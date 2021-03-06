// File for Interface with the HTML

// helper tool functions
if (typeof(String.prototype.trim) === "undefined") {
	String.prototype.trim = function() {
		return String(this).replace(/^\s+|\s+$/g, '');
	};
}
if (typeof(String.prototype.escapeRegExp) === "undefined") {
	String.prototype.escapeRegExp = function() {
		return String(this).replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	}
}

// Global callback
var cleanChoiceCallback = function(choiceid) {return false;};
var cleanMoveCallback = function(x,y) {return false;};

// Objects
function cleanTextArea(div_id) {
	this.textArea = document.getElementById(div_id);
}

cleanTextArea.prototype.update = function(game, readtext, dofade) {
	var front;
	var back;
	// parse out any unavailible choices, and make links
	front = readtext.indexOf('{');
	while (front !== -1) {
		var available = false;
		var choosable = false;

		var tag = readtext.slice(front+1,readtext.indexOf('}',front+1)).trim();
		var front_tag = new RegExp('\\{\\s*'+ tag.escapeRegExp() +'\\s*\\}', 'g');
		var back_tag = new RegExp('\\{\\s*\\/\\s*'+ tag.escapeRegExp() +'\\s*\\}', 'g');

		// first check if this is a '#' statement 
		if (tag.startsWith('#')) {
			// set up expected variables
			var B = game.getCurrentBranchCounter();
			console.log("B = " + B);
			// eval the contents, expecting a boolean return
			available = eval(tag.slice(1));
		} else {
			var choiceid = +(tag);
			available = game.choiceAvailable(choiceid);
			if (available) {
				choosable = game.choiceChooseable(choiceid);
			}
		}

		if (!available) {
			// remove this bit
			var rmfront = front;
			var rmback = readtext.search(back_tag);
			if (rmback === -1) {
				throw new Error("Malformed text");
			}
			var rmbackback = readtext.indexOf('}', rmback);
			readtext = readtext.slice(0, rmfront) + readtext.slice(rmbackback+1);
		} else if (!choosable) {
			// just remove the tags around it
			readtext = readtext.replace(front_tag, '');
			readtext = readtext.replace(back_tag, '');
		} else {
			// turn this part to a link
			readtext = readtext.replace(front_tag, '<a class="choice" id="choice'+ tag +'" onclick="cleanChoiceCallback('+ tag.trim() +');">');
			readtext = readtext.replace(back_tag, '</a>');
		}
		front = readtext.indexOf('{');
	}

	// if you want to do +=, you have to first parse out the links previous
	// a better way would be to add to some history subdiv or something
	// TODO
	if (dofade) {
		var that = this;
		Velocity(that.textArea, {opacity:0.0},{duration:100, complete:function() {
			that.textArea.innerHTML = readtext;
		}});
		Velocity(that.textArea, {opacity:1.0},{});
	} else {
		this.textArea.innerHTML = readtext;
	}
};

function cleanMapArea(div_id) {
	this.mapArea = document.getElementById(div_id);
	this.ns = "http://www.w3.org/2000/svg";

	// cached for animating reasons
	this.xpad = 0;
	this.ypad = 0;
	this.boxsize = 0;
};

cleanMapArea.prototype.clear = function() {
	while (this.mapArea.firstChild) {
		this.mapArea.removeChild(this.mapArea.firstChild);
	}
};

cleanMapArea.prototype.coord2px = function(x,y) {
	var ret = {};
	ret.x = this.xpad + (this.boxsize * x);
	ret.y = this.ypad + (this.boxsize * y);
	return ret;
};

cleanMapArea.prototype.update = function(game) {
	this.clear();
	if (game.currentRoomName !== undefined) {
		return;
	}
	if (game.player.position === undefined) {
		throw new Error("Tried to draw map with no player position set");
	}

	var rec = this.mapArea.getBoundingClientRect();
	var map = game.maps[game.player.position.mapName];
	var ylen = map.tiles.length;
	var xlen = map.tiles[0].length;
	this.xpad = 0;
	this.ypad = 0;
	this.boxsize = 0;

	// Draw map
	if (rec.width / xlen > rec.height / ylen) {
		// pad x
		this.boxsize = rec.height / ylen;
		this.xpad = (rec.width - (xlen * this.boxsize)) / 2;
	} else {
		// pad y
		this.boxsize = rec.width / xlen;
		this.ypad = (rec.height - (ylen * this.boxsize)) / 2;
	}

	for (var y=0; y<ylen; y++) {
		for (var x=0; x<xlen; x++) {
			var tile = document.createElementNS(this.ns, 'image');
			tile.setAttribute('href', map.tiles[y][x].iconPath);
			tile.setAttribute('x', this.xpad + (this.boxsize * x));
			tile.setAttribute('y', this.ypad + (this.boxsize * y));
			tile.setAttribute('width', this.boxsize);
			tile.setAttribute('height', this.boxsize);
			if (map.tiles[y][x].movable) {
				tile.setAttribute('onclick', 'cleanMoveCallback('+ x +','+ y +');');
			}
			this.mapArea.appendChild(tile);
		}
	}

	// Draw Rooms
	game.rooms.forEach(function(room) {
		if (room.active && room.iconPath !== undefined && room.position != undefined && room.position.mapName == map.name) {
			var tile = document.createElementNS(this.ns, 'image');
			tile.setAttribute('href', room.iconPath);
			tile.setAttribute('x', this.xpad + (this.boxsize * room.position.x));
			tile.setAttribute('y', this.ypad + (this.boxsize * room.position.y));
			tile.setAttribute('width', this.boxsize);
			tile.setAttribute('height', this.boxsize);
			this.mapArea.appendChild(tile);
		}
	});

	// Draw Player
	if (game.player.iconPath !== undefined) {
			var tile = document.createElementNS(this.ns, 'image');
			tile.setAttribute('href', game.player.iconPath);
			tile.setAttribute('x', this.xpad + (this.boxsize * game.player.position.x));
			tile.setAttribute('y', this.ypad + (this.boxsize * game.player.position.y));
			tile.setAttribute('width', this.boxsize);
			tile.setAttribute('height', this.boxsize);
			tile.setAttribute('id','playericon');
			this.mapArea.appendChild(tile);
	}
	
};

function cleanInterface(gameobj) {
	this.game = gameobj
	this.textArea = new cleanTextArea("gametext");
	this.texthid = false;
	this.mapArea = new cleanMapArea("gamemap");
	this.maphid = false;
	this.animating = false;

	var that = this
	cleanChoiceCallback = function(choiceid) {
		that.makeChoice(choiceid);
		return false;
	};
	cleanMoveCallback = function(x,y) {
		that.move(x,y);
		return false;
	}
	document.addEventListener('keydown', function(evt) {
		var ret = false;
		var x = that.game.player.position.x;
		var y = that.game.player.position.y;

		if (evt.keyCode == 37) {
			that.move(x-1, y);
		} else if (evt.keyCode == 39) {
			that.move(x+1, y);
		} else if (evt.keyCode == 38) {
			that.move(x,y-1);
		} else if (evt.keyCode == 40) {
			that.move(x,y+1);
		} else {
			ret = true;
		}
		evt.returnValue = ret;
		return ret;
	});

	this.cmdArea = document.getElementById("gamecontrols-output");

	this.invArea = document.getElementById("gamecontrols-inventory");
	this.showinv = false;
	Velocity(this.cmdArea, 'slideUp',{duration:1});
	this.invArea.addEventListener('click', function(evt) {
		if (that.showinv) {
			that.fadeSwitchText(that.invArea, "Inventory");
			Velocity(that.cmdArea, 'slideUp',{});
			that.showinv = false;
		} else {
			that.fadeSwitchText(that.invArea, "Hide Inventory");
			Velocity(that.cmdArea, 'slideDown',{});
			that.showinv = true;
		}
	});
	this.saveArea = document.getElementById("gamecontrols-save");
	this.saveArea.addEventListener('click', function(evt) {
		Velocity(that.saveArea, {opacity:0.0},{complete:function() {
			that.saveArea.innerText = "Game Saved";
		}});
		Velocity(that.saveArea, {opacity:1.0},{duration:1000});
		that.saveGame(function() {
			Velocity(that.saveArea, {opacity:0.0},{delay:500, complete:function() {
				that.saveArea.innerText = "Save";
			}});
			Velocity(that.saveArea, {opacity:1.0},{});
		});
	});
	this.loadArea = document.getElementById("gamecontrols-load");
	this.loadArea.addEventListener('click', function(evt) {
		Velocity(that.loadArea, {opacity:0.0},{complete:function() {
			that.loadArea.innerText = "Game Loaded";
		}});
		Velocity(that.loadArea, {opacity:1.0},{duration:1000});
		that.loadGame(function() {
			Velocity(that.loadArea, {opacity:0.0},{delay:500, complete:function() {
				that.loadArea.innerText = "Load";
			}});
			Velocity(that.loadArea, {opacity:1.0},{});
		});
	});
	this.muteArea = document.getElementById("gamecontrols-mute");
	this.muted = false;
	this.muteArea.addEventListener('click', function(evt) {
		if (that.muted) {
			that.muted = false;
			that.fadeSwitchText(that.muteArea, "Mute");
		} else {
			that.muted = true;
			that.fadeSwitchText(that.muteArea, "Unmute");
		}
	});
}

cleanInterface.prototype.fadeSwitchText = function(node, newtext) {
	Velocity(node, {opacity:0.0},{duration:100, complete:function() {
		node.innerText = newtext;
	}});
	Velocity(node, {opacity:1.0},{});
}

cleanInterface.prototype.saveGame = function(callback) {
	callback();
}

cleanInterface.prototype.loadGame = function(callback) {
	callback();
}

cleanInterface.prototype.updateInventory = function() {
	this.cmdArea.innerHTML = "Inventory : ";
	for (var i=0; i<this.game.player.inventory.length; i++) {
		if (this.game.player.inventory[i].visible) {
			var itemstr = "";
			if (this.game.player.inventory[i].count > 1) {
				itemstr += ""+ this.game.player.inventory[i].count+" x ";
			}
			itemstr += this.game.player.inventory[i].name;
			if (i < this.game.player.inventory.length - 1) {
				itemstr += ", ";
			}
			this.cmdArea.innerHTML += itemstr;
		}
	}
};

cleanInterface.prototype.pathfind = function(sx,sy) {
	var x = this.game.player.position.x;
	var y = this.game.player.position.y;
	var map = this.game.maps[this.game.player.position.mapName].tiles;
	var fmap = [[]];
	for (var dy=0; dy<map.length; dy++) {
		fmap[dy] = [];
	}
	var q = [];
	fmap[y][x] = {px:x, py:y};
	q.push({x:x, y:y});
	var reached = false;
	while (q.length > 0) {
		// check if we made it
		if (q[0].x == sx && q[0].y == sy) {
			reached = true;
			break;
		} else {
			// add all eligible neighbors
			for (var dy=-1; dy<=1; dy++) {
				for (var dx=-1; dx<=1; dx++) {
					// No diagonal
					if (dy !== 0 && dx !== 0) {
						continue;
					}
					if (dy === 0 && dx === 0) {
						continue;
					}
					var mx = q[0].x + dx;
					var my = q[0].y + dy;
					// check in bounds
					if (mx < 0 || mx > map[0].length || my < 0 || my > map.length) {
						continue;
					}
				// check movable
					if (!map[my][mx].movable) {
						continue;
					}
					// check not already traversed
					if (fmap[my][mx] !== undefined) {
						continue;
					}
					// add it's previous
					fmap[my][mx] = {px: q[0].x, py: q[0].y};
					// add to q
					q.push({x:mx, y:my});
				}
			}
		}
		q.shift(1);
	}
	if (reached) {
		// make path 
		var path = [];
		var px = sx;
		var py = sy;
		while (true) {
			// end
			if (px == x && py == y) {
				break;
			}
			path.push({x:px, y:py});
			var next = fmap[py][px];
			px = next.px;
			py = next.py;
		}
		return path;
	}
	return [];
};

cleanInterface.prototype.move = function(x,y) {
	if (this.game.currentRoomName !== undefined) {
		return;
	} else {
		// if we are animating, return
		if (this.animating) {
			return;
		}
		// get path
		var path = this.pathfind(x,y);
		var that = this;
		if (path.length > 0) {	
			this.animating = true;
		}
		for (var i=path.length - 1; i>=0; i--) {
			var newx = path[i].x;
			var newy = path[i].y;
			var newpx = this.mapArea.coord2px(path[i].x, path[i].y);
			Velocity(document.getElementById("playericon"),{x:newpx.x, y:newpx.y}, {duration: 100,
				complete: (i==0)?function() {
					that.game.player.position.x = newx;
					that.game.player.position.y = newy;
					that.animating = false;
					that.game.updateOverRoom();
					that.update();
				} : undefined
			});
		}
	}
};

cleanInterface.prototype.expandAllMap = function() {
	var that = this;
	if (this.maphid) {
		var third = window.innerHeight * 0.6;
		Velocity(document.getElementById("gamemap"), {height:third},{duration: 200, complete: function () {
			that.mapArea.update(that.game);
		}});
		Velocity(document.getElementById("gamemap"), {opacity:1.0},{});
		this.maphid = false;
	}
	if (!this.texthid) {
		Velocity(document.getElementById("gametext"), 'slideUp',{});
		this.texthid = true;
	}
};

cleanInterface.prototype.expandHalfHalf = function() {
	var that = this;
	if (this.maphid) {
		var third = window.innerHeight * 0.6;
		Velocity(document.getElementById("gamemap"), {height:third},{duration: 200, complete: function () {
			that.mapArea.update(that.game);
		}});
		Velocity(document.getElementById("gamemap"), {opacity:1.0},{duration: 200});
		this.maphid = false;
	}
	if (this.texthid) {
		Velocity(document.getElementById("gametext"), 'slideDown',{duration: 100});
		this.texthid = false;
	}
};

cleanInterface.prototype.expandAllText = function() {
	var that = this;
	if (!this.maphid) {
		Velocity(document.getElementById("gamemap"), {height:1},{complete: function () {
			that.mapArea.update(that.game);
		}});
		Velocity(document.getElementById("gamemap"), {opacity:0.0},{duration: 100});
		this.maphid = true;
	}
	if (this.texthid) {
		Velocity(document.getElementById("gametext"), 'slideDown',{});
		this.texthid = false;
	}
};

cleanInterface.prototype.update = function() {
	this.updateInventory();
	if (this.game.currentRoomName !== undefined) {
		this.textArea.update(this.game, this.game.read(), !this.texthid);
		this.expandAllText();
	} else if (this.game.overRoomName !== undefined) {
		this.textArea.update(this.game, this.game.read(), !this.texthid);
		this.expandHalfHalf();
	} else {
		this.expandAllMap();
	}
};

cleanInterface.prototype.makeChoice = function(choiceid) {
	this.game.makeChoice(choiceid);
	this.update();	
};

// Run the story
cleanInterface.prototype.runGame = function() {
	this.update();
};
