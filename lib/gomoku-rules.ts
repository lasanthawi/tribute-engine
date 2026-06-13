export const GOMOKU_BOARD_SIZE = 8
export const GOMOKU_CONNECT = 5

export type GomokuMark = 'X' | 'O'
export type GomokuCell = GomokuMark | null
export type GomokuBoard = GomokuCell[][]
export type GomokuStatus = 'waiting' | 'active' | 'settled' | 'cancelled'

export interface GomokuWinner {
  winnerMark: GomokuMark | 'draw' | null
  winningCells: Array<[number, number]>
}

export function createGomokuBoard(): GomokuBoard {
  return Array.from({ length: GOMOKU_BOARD_SIZE }, () => Array<GomokuCell>(GOMOKU_BOARD_SIZE).fill(null))
}

export function cloneGomokuBoard(board: GomokuBoard): GomokuBoard {
  return board.map((row) => [...row])
}

export function isBoardFull(board: GomokuBoard): boolean {
  return board.every((row) => row.every(Boolean))
}

export function getOppositeMark(mark: GomokuMark): GomokuMark {
  return mark === 'X' ? 'O' : 'X'
}

export function evaluateGomokuWinner(board: GomokuBoard): GomokuWinner {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const

  for (let row = 0; row < GOMOKU_BOARD_SIZE; row++) {
    for (let col = 0; col < GOMOKU_BOARD_SIZE; col++) {
      const mark = board[row][col]
      if (!mark) continue

      for (const [dr, dc] of directions) {
        const cells: Array<[number, number]> = [[row, col]]
        for (let step = 1; step < GOMOKU_CONNECT; step++) {
          const nextRow = row + dr * step
          const nextCol = col + dc * step
          if (
            nextRow < 0 ||
            nextRow >= GOMOKU_BOARD_SIZE ||
            nextCol < 0 ||
            nextCol >= GOMOKU_BOARD_SIZE ||
            board[nextRow][nextCol] !== mark
          ) {
            break
          }
          cells.push([nextRow, nextCol])
        }
        if (cells.length === GOMOKU_CONNECT) return { winnerMark: mark, winningCells: cells }
      }
    }
  }

  return { winnerMark: isBoardFull(board) ? 'draw' : null, winningCells: [] }
}

export function applyGomokuMove(board: GomokuBoard, row: number, col: number, mark: GomokuMark): GomokuBoard {
  if (row < 0 || row >= GOMOKU_BOARD_SIZE || col < 0 || col >= GOMOKU_BOARD_SIZE) {
    throw new Error('Move is outside the board')
  }
  if (board[row][col]) throw new Error('Cell is already occupied')
  const next = cloneGomokuBoard(board)
  next[row][col] = mark
  return next
}

function scoreLine(board: GomokuBoard, row: number, col: number, mark: GomokuMark, dr: number, dc: number): number {
  let count = 1
  for (const direction of [-1, 1]) {
    for (let step = 1; step < GOMOKU_CONNECT; step++) {
      const nextRow = row + dr * step * direction
      const nextCol = col + dc * step * direction
      if (
        nextRow < 0 ||
        nextRow >= GOMOKU_BOARD_SIZE ||
        nextCol < 0 ||
        nextCol >= GOMOKU_BOARD_SIZE ||
        board[nextRow][nextCol] !== mark
      ) {
        break
      }
      count += 1
    }
  }
  return count
}

function scoreMove(board: GomokuBoard, row: number, col: number, mark: GomokuMark): number {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const
  let score = 0
  for (const [dr, dc] of directions) {
    const line = scoreLine(board, row, col, mark, dr, dc)
    score += line * line * line
    if (line >= GOMOKU_CONNECT) score += 10_000
  }
  const center = (GOMOKU_BOARD_SIZE - 1) / 2
  score += Math.max(0, 8 - Math.abs(row - center) - Math.abs(col - center))
  return score
}

export function chooseComputerMove(board: GomokuBoard, computerMark: GomokuMark): [number, number] | null {
  const playerMark = getOppositeMark(computerMark)
  const open: Array<[number, number]> = []
  for (let row = 0; row < GOMOKU_BOARD_SIZE; row++) {
    for (let col = 0; col < GOMOKU_BOARD_SIZE; col++) {
      if (!board[row][col]) open.push([row, col])
    }
  }
  if (open.length === 0) return null

  for (const [row, col] of open) {
    const next = applyGomokuMove(board, row, col, computerMark)
    if (evaluateGomokuWinner(next).winnerMark === computerMark) return [row, col]
  }
  for (const [row, col] of open) {
    const next = applyGomokuMove(board, row, col, playerMark)
    if (evaluateGomokuWinner(next).winnerMark === playerMark) return [row, col]
  }

  const best = open
    .map(([row, col]) => ({
      row,
      col,
      score: scoreMove(board, row, col, computerMark) + scoreMove(board, row, col, playerMark) * 0.9,
    }))
    .sort((a, b) => b.score - a.score)[0]
  return best ? [best.row, best.col] : null
}
