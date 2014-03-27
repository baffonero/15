function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = Math.pow(this.size,2) -1;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

  this.timer;

  this.setup();
}


// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  if (this.over || (this.won && !this.keepPlaying)) {
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
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.tilesToGo   = previousState.tilesToGo;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.tilesToGo   = this.startTiles;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;

    // Add the initial tiles
    this.addStartTiles();
  }

  this.startTimer();
  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 1; i <= this.startTiles; i++) {
     this.addStartTile(i);
  }
};

// Adds a tile in a random position
GameManager.prototype.addStartTile = function (value) {
  if (this.grid.cellsAvailable()) {
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    tilesToGo:  this.tilesToGo,
    won:        this.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.isGameTerminated()
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying,
    tilesToGo:   this.tilesToGo
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
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
    console.log("solved", solved, this.tilesToGo); 

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
         vTilesToGo -= 1;
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
    that.score += 1;
    that.actuator.updateScore(that.score);
  }
}

GameManager.prototype.stopTimer = function () {
  clearInterval(this.timer);
}

