// --- AI OPPONENTS ENGINE ---
// Provides AI logic for board games and quiz battles
// Difficulty levels: 'easy', 'medium', 'hard'

(function() {
  'use strict';

  const AI_DIFFICULTY = {
    easy: { label: 'Easy', icon: '🟢', description: 'Learning the ropes', color: '#10b981' },
    medium: { label: 'Medium', icon: '🟡', description: 'A fair challenge', color: '#f59e0b' },
    hard: { label: 'Hard', icon: '🔴', description: 'Battle-hardened bot', color: '#ef4444' }
  };

  // ============================================================
  // BOARD GAME AI
  // ============================================================

  // --- TIC TAC TOE AI ---
  const TicTacToeAI = {
    getMove(board, aiSymbol, difficulty) {
      const oppSymbol = aiSymbol === 'X' ? 'O' : 'X';
      const empty = board.map((c, i) => c === null ? i : -1).filter(i => i >= 0);
      if (empty.length === 0) return -1;

      if (difficulty === 'easy') {
        // 40% chance of smart move, else random
        if (Math.random() < 0.4) return this._bestMove(board, aiSymbol, oppSymbol);
        return empty[Math.floor(Math.random() * empty.length)];
      }
      if (difficulty === 'medium') {
        // 75% chance of smart move
        if (Math.random() < 0.75) return this._bestMove(board, aiSymbol, oppSymbol);
        return empty[Math.floor(Math.random() * empty.length)];
      }
      // hard: always optimal (minimax)
      return this._bestMove(board, aiSymbol, oppSymbol);
    },

    _bestMove(board, ai, opp) {
      // Check for winning move
      const winMove = this._findWinningMove(board, ai);
      if (winMove !== -1) return winMove;
      // Block opponent winning move
      const blockMove = this._findWinningMove(board, opp);
      if (blockMove !== -1) return blockMove;
      // Take center
      if (board[4] === null) return 4;
      // Take corner
      const corners = [0, 2, 6, 8].filter(i => board[i] === null);
      if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
      // Take any
      const empty = board.map((c, i) => c === null ? i : -1).filter(i => i >= 0);
      return empty[Math.floor(Math.random() * empty.length)];
    },

    _findWinningMove(board, symbol) {
      const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for (const [a, b, c] of lines) {
        if (board[a] === symbol && board[b] === symbol && board[c] === null) return c;
        if (board[a] === symbol && board[c] === symbol && board[b] === null) return b;
        if (board[b] === symbol && board[c] === symbol && board[a] === null) return a;
      }
      return -1;
    }
  };

  // --- CONNECT 4 AI ---
  const Connect4AI = {
    getMove(board, aiColor, difficulty, rows, cols) {
      rows = rows || 6;
      cols = cols || 7;
      const oppColor = aiColor === 'R' ? 'Y' : 'R';

      // Get valid columns
      const validCols = [];
      for (let c = 0; c < cols; c++) {
        if (board[0][c] === null) validCols.push(c);
      }
      if (validCols.length === 0) return -1;

      if (difficulty === 'easy') {
        // Mostly random, occasionally blocks
        if (Math.random() < 0.3) return this._smartMove(board, aiColor, oppColor, rows, cols);
        return validCols[Math.floor(Math.random() * validCols.length)];
      }
      if (difficulty === 'medium') {
        if (Math.random() < 0.7) return this._smartMove(board, aiColor, oppColor, rows, cols);
        return validCols[Math.floor(Math.random() * validCols.length)];
      }
      // Hard: always smart + lookahead
      return this._smartMove(board, aiColor, oppColor, rows, cols);
    },

    _smartMove(board, ai, opp, rows, cols) {
      const validCols = [];
      for (let c = 0; c < cols; c++) {
        if (board[0][c] === null) validCols.push(c);
      }

      // Check for winning move
      for (const col of validCols) {
        const row = this._getDropRow(board, col, rows);
        if (row === -1) continue;
        board[row][col] = ai;
        if (this._checkConnect4(board, row, col, ai, rows, cols)) { board[row][col] = null; return col; }
        board[row][col] = null;
      }

      // Block opponent win
      for (const col of validCols) {
        const row = this._getDropRow(board, col, rows);
        if (row === -1) continue;
        board[row][col] = opp;
        if (this._checkConnect4(board, row, col, opp, rows, cols)) { board[row][col] = null; return col; }
        board[row][col] = null;
      }

      // Prefer center columns
      const centerPreference = [3, 2, 4, 1, 5, 0, 6];
      for (const col of centerPreference) {
        if (validCols.includes(col)) return col;
      }
      return validCols[0];
    },

    _getDropRow(board, col, rows) {
      for (let r = rows - 1; r >= 0; r--) {
        if (board[r][col] === null) return r;
      }
      return -1;
    },

    _checkConnect4(board, row, col, color, rows, cols) {
      const directions = [[0,1],[1,0],[1,1],[1,-1]];
      for (const [dr, dc] of directions) {
        let count = 1;
        for (let d = 1; d <= 3; d++) {
          const nr = row + dr * d, nc = col + dc * d;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === color) count++;
          else break;
        }
        for (let d = 1; d <= 3; d++) {
          const nr = row - dr * d, nc = col - dc * d;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === color) count++;
          else break;
        }
        if (count >= 4) return true;
      }
      return false;
    }
  };

  // --- CHECKERS AI ---
  const CheckersAI = {
    getMove(board, aiPiece, difficulty) {
      const allMoves = this._getAllMoves(board, aiPiece);
      if (allMoves.length === 0) return null;

      if (difficulty === 'easy') {
        return allMoves[Math.floor(Math.random() * allMoves.length)];
      }
      if (difficulty === 'medium') {
        // Prefer captures, then random
        const captures = allMoves.filter(m => m.captures && m.captures.length > 0);
        if (captures.length > 0 && Math.random() < 0.8) {
          return captures[Math.floor(Math.random() * captures.length)];
        }
        return allMoves[Math.floor(Math.random() * allMoves.length)];
      }
      // Hard: prefer captures, then advance pieces, prefer kings
      const captures = allMoves.filter(m => m.captures && m.captures.length > 0);
      if (captures.length > 0) {
        // Pick capture that takes the most pieces
        captures.sort((a, b) => b.captures.length - a.captures.length);
        return captures[0];
      }
      // Advance toward king row
      const scored = allMoves.map(m => {
        let score = 0;
        const piece = board[m.from[0]][m.from[1]];
        // Prefer advancing toward promotion
        if (piece === 'L') score += m.to[0]; // L moves down
        if (piece === 'D') score += (7 - m.to[0]); // D moves up
        // Prefer center columns
        score += (3.5 - Math.abs(m.to[1] - 3.5)) * 0.5;
        return { move: m, score };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored[0].move;
    },

    _getAllMoves(board, piece) {
      const moves = [];
      let hasCapture = false;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = board[r][c];
          if (!cell || !cell.startsWith(piece[0])) continue;

          const isKing = cell.includes('K');
          let dirs = [];
          if (cell.startsWith('D')) dirs.push(-1);
          if (cell.startsWith('L')) dirs.push(1);
          if (isKing) dirs = [-1, 1];

          // Check captures
          const captures = this._getCaptures(board, r, c, cell, dirs);
          if (captures.length > 0) {
            hasCapture = true;
            moves.push(...captures);
          }
        }
      }

      if (hasCapture) return moves;

      // Simple moves
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = board[r][c];
          if (!cell || !cell.startsWith(piece[0])) continue;

          const isKing = cell.includes('K');
          let dirs = [];
          if (cell.startsWith('D')) dirs.push(-1);
          if (cell.startsWith('L')) dirs.push(1);
          if (isKing) dirs = [-1, 1];

          for (const dr of dirs) {
            for (const dc of [-1, 1]) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !board[nr][nc]) {
                moves.push({ from: [r, c], to: [nr, nc], captures: [] });
              }
            }
          }
        }
      }

      return moves;
    },

    _getCaptures(board, r, c, piece, dirs) {
      const captures = [];
      for (const dr of dirs) {
        for (const dc of [-1, 1]) {
          const mr = r + dr, mc = c + dc;
          const nr = r + dr * 2, nc = c + dc * 2;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const middle = board[mr][mc];
            if (middle && middle[0] !== piece[0] && !board[nr][nc]) {
              captures.push({ from: [r, c], to: [nr, nc], captures: [[mr, mc]] });
            }
          }
        }
      }
      return captures;
    }
  };

  // --- CHESS AI ---
  const ChessAI = {
    getMove(board, aiColor, difficulty) {
      const allMoves = this._getAllMoves(board, aiColor);
      if (allMoves.length === 0) return null;

      if (difficulty === 'easy') {
        // Random moves, occasionally captures
        const captures = allMoves.filter(m => m.captured);
        if (captures.length > 0 && Math.random() < 0.3) {
          return captures[Math.floor(Math.random() * captures.length)];
        }
        return allMoves[Math.floor(Math.random() * allMoves.length)];
      }

      // Score each move
      const scored = allMoves.map(m => {
        let score = 0;
        // Capture value
        if (m.captured) {
          score += this._pieceValue(m.captured) * 10;
        }
        // Center control bonus
        if ((m.to[0] >= 2 && m.to[0] <= 5) && (m.to[1] >= 2 && m.to[1] <= 5)) {
          score += 1;
        }
        // Pawn advancement
        if (m.piece[1] === 'p') {
          const advance = aiColor === 'w' ? (6 - m.to[0]) : m.to[0] - 1;
          score += advance * 0.5;
        }
        // Avoid moving king unless capturing
        if (m.piece[1] === 'k' && !m.captured) score -= 2;

        // Medium: some randomness
        if (difficulty === 'medium') score += Math.random() * 3;

        return { move: m, score };
      });

      scored.sort((a, b) => b.score - a.score);

      if (difficulty === 'medium') {
        // Pick from top 3
        const topN = Math.min(3, scored.length);
        return scored[Math.floor(Math.random() * topN)].move;
      }

      // Hard: simple 1-ply lookahead - check if opponent can recapture
      const best = scored.slice(0, Math.min(5, scored.length));
      for (const entry of best) {
        const m = entry.move;
        // Simulate move
        const origFrom = board[m.from[0]][m.from[1]];
        const origTo = board[m.to[0]][m.to[1]];
        board[m.from[0]][m.from[1]] = null;
        board[m.to[0]][m.to[1]] = m.piece;

        // Check if opponent can capture back
        const oppColor = aiColor === 'w' ? 'b' : 'w';
        const oppMoves = this._getAllMoves(board, oppColor);
        const recaptures = oppMoves.filter(om => om.to[0] === m.to[0] && om.to[1] === m.to[1]);
        if (recaptures.length > 0 && m.captured) {
          entry.score -= this._pieceValue(m.piece) * 5;
        }

        // Undo
        board[m.from[0]][m.from[1]] = origFrom;
        board[m.to[0]][m.to[1]] = origTo;
      }

      best.sort((a, b) => b.score - a.score);
      return best[0].move;
    },

    _pieceValue(piece) {
      if (!piece) return 0;
      const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
      return values[piece[1]] || 0;
    },

    _getAllMoves(board, color) {
      const moves = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (!piece || piece[0] !== color) continue;
          const pieceMoves = this._getPieceMoves(board, r, c, piece);
          for (const [tr, tc] of pieceMoves) {
            moves.push({
              from: [r, c],
              to: [tr, tc],
              piece: piece,
              captured: board[tr][tc]
            });
          }
        }
      }
      return moves;
    },

    _getPieceMoves(board, r, c, piece) {
      const type = piece[1];
      const color = piece[0];
      const moves = [];

      switch (type) {
        case 'p': {
          const dir = color === 'w' ? -1 : 1;
          const startRow = color === 'w' ? 6 : 1;
          if (r + dir >= 0 && r + dir < 8 && !board[r + dir][c]) {
            moves.push([r + dir, c]);
            if (r === startRow && !board[r + dir * 2][c]) moves.push([r + dir * 2, c]);
          }
          for (const dc of [-1, 1]) {
            const nr = r + dir, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] && board[nr][nc][0] !== color) {
              moves.push([nr, nc]);
            }
          }
          break;
        }
        case 'r':
          this._addSliding(board, r, c, color, [[0,1],[0,-1],[1,0],[-1,0]], moves);
          break;
        case 'b':
          this._addSliding(board, r, c, color, [[1,1],[1,-1],[-1,1],[-1,-1]], moves);
          break;
        case 'q':
          this._addSliding(board, r, c, color, [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]], moves);
          break;
        case 'n':
          for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && (!board[nr][nc] || board[nr][nc][0] !== color)) moves.push([nr, nc]);
          }
          break;
        case 'k':
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && (!board[nr][nc] || board[nr][nc][0] !== color)) moves.push([nr, nc]);
            }
          }
          break;
      }
      return moves;
    },

    _addSliding(board, r, c, color, directions, moves) {
      for (const [dr, dc] of directions) {
        for (let d = 1; d < 8; d++) {
          const nr = r + dr * d, nc = c + dc * d;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
          if (board[nr][nc]) {
            if (board[nr][nc][0] !== color) moves.push([nr, nc]);
            break;
          }
          moves.push([nr, nc]);
        }
      }
    }
  };

  // --- REVERSI AI ---
  const ReversiAI = {
    getMove(board, aiColor, difficulty) {
      const moves = this._getAllValidMoves(board, aiColor);
      if (moves.length === 0) return null;

      if (difficulty === 'easy') {
        return moves[Math.floor(Math.random() * moves.length)];
      }

      // Score moves by strategic value
      const scored = moves.map(([r, c]) => {
        let score = 0;
        const flips = this._getFlips(board, r, c, aiColor);
        score += flips.length;

        // Corner bonus (huge)
        if ((r === 0 || r === 7) && (c === 0 || c === 7)) score += 50;
        // Edge bonus
        else if (r === 0 || r === 7 || c === 0 || c === 7) score += 5;
        // Avoid squares adjacent to corners (X-squares)
        if ((r === 1 || r === 6) && (c === 1 || c === 6)) score -= 10;
        // Avoid C-squares (adjacent to corners on edges)
        if (((r === 0 || r === 7) && (c === 1 || c === 6)) ||
            ((r === 1 || r === 6) && (c === 0 || c === 7))) score -= 5;

        if (difficulty === 'medium') score += Math.random() * 4;

        return { move: [r, c], score };
      });

      scored.sort((a, b) => b.score - a.score);

      if (difficulty === 'medium') {
        const topN = Math.min(3, scored.length);
        return scored[Math.floor(Math.random() * topN)].move;
      }

      return scored[0].move;
    },

    _getAllValidMoves(board, color) {
      const moves = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (board[r][c] === null && this._getFlips(board, r, c, color).length > 0) {
            moves.push([r, c]);
          }
        }
      }
      return moves;
    },

    _getFlips(board, r, c, color) {
      const opp = color === 'B' ? 'W' : 'B';
      const flips = [];
      const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
      for (const [dr, dc] of dirs) {
        const lineFlips = [];
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opp) {
          lineFlips.push([nr, nc]);
          nr += dr; nc += dc;
        }
        if (lineFlips.length > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === color) {
          flips.push(...lineFlips);
        }
      }
      return flips;
    }
  };

  // --- BATTLESHIPS AI ---
  const BattleshipsAI = {
    // Generate ship placements for AI
    placeShips(gridSize) {
      gridSize = gridSize || 8;
      const ships = [
        { name: 'Carrier', size: 4 },
        { name: 'Cruiser', size: 3 },
        { name: 'Destroyer', size: 2 },
        { name: 'Sub', size: 2 }
      ];
      const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
      const placedShips = [];

      for (const ship of ships) {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 100) {
          attempts++;
          const horizontal = Math.random() < 0.5;
          const r = Math.floor(Math.random() * gridSize);
          const c = Math.floor(Math.random() * gridSize);
          const cells = [];
          let valid = true;

          for (let i = 0; i < ship.size; i++) {
            const nr = horizontal ? r : r + i;
            const nc = horizontal ? c + i : c;
            if (nr >= gridSize || nc >= gridSize || grid[nr][nc] === 'S') {
              valid = false;
              break;
            }
            cells.push([nr, nc]);
          }

          if (valid) {
            for (const [sr, sc] of cells) grid[sr][sc] = 'S';
            placedShips.push({ name: ship.name, cells, hits: 0 });
            placed = true;
          }
        }
      }

      return { grid, ships: placedShips };
    },

    // Get attack coordinates
    getAttack(attackGrid, gridSize, difficulty) {
      gridSize = gridSize || 8;

      // Find cells we haven't attacked yet
      const untried = [];
      const hits = [];
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (!attackGrid[r][c]) untried.push([r, c]);
          if (attackGrid[r][c] === 'hit') hits.push([r, c]);
        }
      }
      if (untried.length === 0) return null;

      if (difficulty === 'easy') {
        // Pure random
        return untried[Math.floor(Math.random() * untried.length)];
      }

      // Hunt/target mode: if we have hits, attack adjacent cells
      if (hits.length > 0) {
        const adjacent = [];
        for (const [hr, hc] of hits) {
          for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nr = hr + dr, nc = hc + dc;
            if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize && !attackGrid[nr][nc]) {
              // Avoid duplicates
              if (!adjacent.some(([ar, ac]) => ar === nr && ac === nc)) {
                adjacent.push([nr, nc]);
              }
            }
          }
        }

        if (adjacent.length > 0) {
          if (difficulty === 'hard') {
            // Try to detect ship direction from multiple hits
            const lineHits = this._detectShipLine(hits, attackGrid, gridSize);
            if (lineHits) return lineHits;
          }
          return adjacent[Math.floor(Math.random() * adjacent.length)];
        }
      }

      // Checkerboard pattern for medium/hard
      if (difficulty !== 'easy') {
        const checkerboard = untried.filter(([r, c]) => (r + c) % 2 === 0);
        if (checkerboard.length > 0) {
          return checkerboard[Math.floor(Math.random() * checkerboard.length)];
        }
      }

      return untried[Math.floor(Math.random() * untried.length)];
    },

    _detectShipLine(hits, attackGrid, gridSize) {
      // Check if hits form a line and attack the ends
      for (const [hr, hc] of hits) {
        // Horizontal line?
        const hLine = hits.filter(([r, c]) => r === hr).sort((a, b) => a[1] - b[1]);
        if (hLine.length >= 2) {
          const minC = hLine[0][1] - 1;
          const maxC = hLine[hLine.length - 1][1] + 1;
          if (minC >= 0 && !attackGrid[hr][minC]) return [hr, minC];
          if (maxC < gridSize && !attackGrid[hr][maxC]) return [hr, maxC];
        }
        // Vertical line?
        const vLine = hits.filter(([r, c]) => c === hc).sort((a, b) => a[0] - b[0]);
        if (vLine.length >= 2) {
          const minR = vLine[0][0] - 1;
          const maxR = vLine[vLine.length - 1][0] + 1;
          if (minR >= 0 && !attackGrid[minR][hc]) return [minR, hc];
          if (maxR < gridSize && !attackGrid[maxR][hc]) return [maxR, hc];
        }
      }
      return null;
    }
  };

  // ============================================================
  // QUIZ BATTLE AI
  // ============================================================

  const QuizBattleAI = {
    // Returns simulated score updates over time
    // accuracyRange: [min, max] percentage (0-1)
    // speedRange: [minMs, maxMs] per question
    getConfig(difficulty) {
      switch (difficulty) {
        case 'easy':
          return { accuracy: [0.3, 0.5], speedMs: [3000, 7000], name: 'Easy Bot' };
        case 'medium':
          return { accuracy: [0.5, 0.7], speedMs: [2000, 5000], name: 'Medium Bot' };
        case 'hard':
          return { accuracy: [0.7, 0.9], speedMs: [1000, 3000], name: 'Hard Bot' };
        default:
          return { accuracy: [0.5, 0.7], speedMs: [2000, 5000], name: 'Bot' };
      }
    },

    // Simulate the AI answering all questions, returns array of {correct, delayMs}
    simulateAnswers(totalQuestions, difficulty) {
      const config = this.getConfig(difficulty);
      const answers = [];
      const accuracy = config.accuracy[0] + Math.random() * (config.accuracy[1] - config.accuracy[0]);

      for (let i = 0; i < totalQuestions; i++) {
        const correct = Math.random() < accuracy;
        const delayMs = config.speedMs[0] + Math.random() * (config.speedMs[1] - config.speedMs[0]);
        answers.push({ correct, delayMs: Math.round(delayMs) });
      }

      return answers;
    }
  };

  // ============================================================
  // LOCAL GAME MANAGER (for AI board games - bypasses DB)
  // ============================================================

  class LocalGameManager {
    constructor(gameType, difficulty) {
      this.gameType = gameType;
      this.difficulty = difficulty;
      this.aiThinkDelay = difficulty === 'easy' ? 1500 : difficulty === 'medium' ? 1000 : 600;
    }

    // Create a fake match object for local play
    createLocalMatch(gameType) {
      const myId = window.currentUser?.id || 'player';
      const aiId = 'ai-opponent';
      return {
        id: 'local-' + Date.now(),
        game_type: gameType,
        challenger_id: myId,
        opponent_id: aiId,
        current_turn: myId, // Player goes first
        coin_bet: 0,
        status: 'active',
        game_state: null,
        move_count: 0,
        is_local: true, // Flag for local game
        ai_difficulty: this.difficulty
      };
    }
  }

  // ============================================================
  // EXPOSE GLOBALS
  // ============================================================

  window.GameAI = {
    TicTacToe: TicTacToeAI,
    Connect4: Connect4AI,
    Checkers: CheckersAI,
    Chess: ChessAI,
    Reversi: ReversiAI,
    Battleships: BattleshipsAI,
    QuizBattle: QuizBattleAI,
    LocalGameManager,
    DIFFICULTY: AI_DIFFICULTY
  };

})();
