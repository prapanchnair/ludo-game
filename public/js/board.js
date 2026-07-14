/**
 * Shared Ludo board geometry & rules constants.
 * Loaded both in Node (server) via require() and in the browser via <script>.
 * Coordinates are (row, col) on a 15x15 grid, the classic Ludo board layout.
 */
(function (root) {
  var COLORS = ['red', 'green', 'yellow', 'blue'];

  // The 52 shared path cells, in clockwise order starting at red's exit cell.
  var PATH = [
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
    [0, 7],
    [0, 8],
    [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
    [6, 9],
    [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
    [7, 14],
    [8, 14],
    [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
    [9, 8],
    [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
    [14, 7],
    [14, 6],
    [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
    [8, 5],
    [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
    [7, 0],
    [6, 0]
  ];

  // Index on PATH where each color enters the shared track.
  var START_OFFSET = { red: 0, green: 13, yellow: 26, blue: 39 };

  // Safe cells (start cells + star cells): no captures happen here.
  var SAFE_INDEXES = [0, 8, 13, 21, 26, 34, 39, 47];

  // Each color's 6-cell home stretch, leading into the center (7,7).
  var HOME_COLUMN = {
    red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
    green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
    yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
    blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]]
  };

  var CENTER = [7, 7];

  // Visual slots for tokens sitting in their base yard (2x2 per color).
  var BASE_SLOTS = {
    red: [[2, 2], [2, 3], [3, 2], [3, 3]],
    green: [[2, 11], [2, 12], [3, 11], [3, 12]],
    yellow: [[11, 11], [11, 12], [12, 11], [12, 12]],
    blue: [[11, 2], [11, 3], [12, 2], [12, 3]]
  };

  var HOME_ENTRY_OFFSET = [[7, 1.4], [7.4, 1], [7, 0.6], [6.6, 1]]; // small spread for tokens stacked at center

  // Token movement: stepsTaken ranges 0..58
  //   0            -> sitting in base
  //   1..51        -> PATH[(START_OFFSET[color] + stepsTaken - 1) % 52]
  //   52..57       -> HOME_COLUMN[color][stepsTaken - 52]
  //   58           -> finished (center)
  var TOTAL_STEPS = 58;
  var HOME_COLUMN_START = 52;

  function cellForToken(color, stepsTaken) {
    if (stepsTaken <= 0) return { type: 'base', coord: null };
    if (stepsTaken >= TOTAL_STEPS) return { type: 'finished', coord: CENTER };
    if (stepsTaken < HOME_COLUMN_START) {
      var idx = (START_OFFSET[color] + stepsTaken - 1) % 52;
      return { type: 'path', pathIndex: idx, coord: PATH[idx] };
    }
    var homeIdx = stepsTaken - HOME_COLUMN_START;
    return { type: 'home', coord: HOME_COLUMN[color][homeIdx] };
  }

  function isSafePathIndex(idx) {
    return SAFE_INDEXES.indexOf(idx) !== -1;
  }

  var api = {
    COLORS: COLORS,
    PATH: PATH,
    START_OFFSET: START_OFFSET,
    SAFE_INDEXES: SAFE_INDEXES,
    HOME_COLUMN: HOME_COLUMN,
    CENTER: CENTER,
    BASE_SLOTS: BASE_SLOTS,
    HOME_ENTRY_OFFSET: HOME_ENTRY_OFFSET,
    TOTAL_STEPS: TOTAL_STEPS,
    HOME_COLUMN_START: HOME_COLUMN_START,
    cellForToken: cellForToken,
    isSafePathIndex: isSafePathIndex
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.BOARD = api;
  }
})(typeof window !== 'undefined' ? window : this);
