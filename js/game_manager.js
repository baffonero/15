function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = Math.pow(this.size,2) -1;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));

  this.timer;

  this.setup();
}


// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  if (this.over || this.won) {
    this.stopTimer();
    return true;
  } else {
    return false;
  }
};

// Set up the game
GameManager.prototype.setup = function () {

  var previousState = this.storageManager.getGameState();
  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.time        = previousState.time;
    this.over        = previousState.over;
    this.tilesToGo   = previousState.tilesToGo;
    this.won         = previousState.won;
  } else {
    this.time       = 0;
    this.tilesToGo   = this.startTiles;
    this.over        = false;
    this.won         = false;

    // Add the initial tiles
    this.setupGrid();
  }
  
  // Update the actuator
  this.checkSolved();
  this.actuate();
  this.startTimer();
};

GameManager.prototype.setupGrid = function () {
  do
    {
      this.grid        = new Grid(this.size);
      this.addStartTiles();
    }
  while (!this.isSolvable()); 
};
// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 1; i <= this.startTiles; i++) {
    if (this.grid.cellsAvailable()) {
      var tile = new Tile(this.grid.randomAvailableCell(), i);

      this.grid.insertTile(tile);
    }    
  }
};
 

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.won && this.time < this.storageManager.getBestTime() ) {
    this.storageManager.setBestTime(this.time);
  }
  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    time:       this.time,
    over:       this.over,
    tilesToGo:  this.tilesToGo,
    won:        this.won,
    bestTime:   this.storageManager.getBestTime(),
    terminated: this.isGameTerminated()
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    time:        this.time,
    over:        this.over,
    won:         this.won,
    tilesToGo:   this.tilesToGo
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var moved      = false;
  var freeCell   = this.grid.availableCells()[0];

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  cell = { x: freeCell.x - vector.x, y: freeCell.y - vector.y };
  if (this.grid.withinBounds(cell)) {
    tile = this.grid.cellContent(cell);
    // Move tile
    this.moveTile(tile, freeCell);
    moved = true; 

    var solved = this.checkSolved();

    if (solved === true) {
      this.won = true;
    }

    this.actuate();
  }
};

GameManager.prototype.checkSolved = function () {
  var vTilesToGo = this.startTiles;
  var attvalue;
  var that = this;
  this.grid.eachCell(function (x, y, tile) {
    attvalue = x + 1 + y*that.size;
    if (tile) {
      if (tile.value == attvalue) {
        tile.placed = true;
         vTilesToGo -= 1;
      } else {
        tile.placed = false;
      }
    }
  });

  that.tilesToGo = vTilesToGo;

  if (that.tilesToGo > 0) {
    return (false);
  } else {
    return (true);       
  }

};
GameManager.prototype.isSolvable = function () {
  var that = this;
  var tiles = this.grid.allCells();
  var totInv = 0;
  var partInv;
  for (var i = 0; i < tiles.length - 1; i++) {
    if (tiles[i] > 1) {
      partInv = 0;  
      for (var n = i + 1; n < tiles.length; n++) {
        if (tiles[n] < tiles[i]) {
          totInv += 1;
        }  
      }  
    }
  }
  
  if (totInv%2 === 0) {
    return (true);
  } else {
    return (false);
  }
  
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  return traversals;
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

GameManager.prototype.startTimer = function () {
  clearInterval(this.timer);
  this.timer =setInterval(function(){incrTimer()},1000);
  
  var that = this;
  function incrTimer() {
    that.time += 1;
    that.actuator.updateTime(that.time);
    that.storageManager.setGameState(that.serialize());
  }
}

GameManager.prototype.stopTimer = function () {
  clearInterval(this.timer);
}

