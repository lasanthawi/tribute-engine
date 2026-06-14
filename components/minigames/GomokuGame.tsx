import { useEffect, useMemo, useState } from 'react'
import { api, GomokuMatchDto } from '@/lib/api-client'
import {
  applyGomokuMove,
  chooseComputerMove,
  createGomokuBoard,
  evaluateGomokuWinner,
  GomokuBoard,
  GomokuMark,
} from '@/lib/gomoku-rules'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'
import Confetti from '@/components/ui/Confetti'
import { BOT_NAME } from '@/lib/bot'

type Mode = 'computer' | 'remote'

const MARK_ICON: Record<GomokuMark, string> = { X: '🔥', O: '❄️' }

function cellKey(row: number, col: number) {
  return `${row}:${col}`
}

function hasWinningCell(cells: Array<[number, number]>, row: number, col: number): boolean {
  return cells.some(([r, c]) => r === row && c === col)
}

function statusText(match: GomokuMatchDto | null, board: GomokuBoard, turn: GomokuMark, winner: GomokuMark | 'draw' | null) {
  if (match) {
    if (match.status === 'waiting') return 'Waiting for Player O to join'
    if (match.winnerMark === 'draw') return 'Draw game'
    if (match.winnerMark) return `${match.winnerMark} wins the room`
    if (!match.myMark) return 'Spectating room'
    return match.currentTurn === match.myMark ? 'Your move' : `Player ${match.currentTurn} is thinking`
  }
  if (winner === 'draw') return 'Draw game'
  if (winner) return winner === 'X' ? 'You win' : `${BOT_NAME} wins`
  const moveCount = board.flat().filter(Boolean).length
  if (moveCount === 0) return 'Place the first stone'
  return turn === 'X' ? 'Your move' : `${BOT_NAME} is thinking`
}

export default function GomokuGame({ onClose, initialJoinCode }: { onClose: () => void; initialJoinCode?: string }) {
  const [mode, setMode] = useState<Mode>('computer')
  const [board, setBoard] = useState<GomokuBoard>(() => createGomokuBoard())
  const [turn, setTurn] = useState<GomokuMark>('X')
  const [winner, setWinner] = useState<GomokuMark | 'draw' | null>(null)
  const [winningCells, setWinningCells] = useState<Array<[number, number]>>([])
  const [lastMove, setLastMove] = useState<[number, number] | null>(null)
  const [thinking, setThinking] = useState(false)
  const [remoteMatch, setRemoteMatch] = useState<GomokuMatchDto | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [remoteBusy, setRemoteBusy] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [waitingNudge, setWaitingNudge] = useState(false)

  const emptyRemoteBoard = useMemo(() => createGomokuBoard(), [])
  const activeBoard = mode === 'remote' ? remoteMatch?.board ?? emptyRemoteBoard : board
  const activeWinner = mode === 'remote' ? remoteMatch?.winnerMark ?? null : winner
  const activeWinningCells = mode === 'remote' ? remoteMatch?.winningCells ?? [] : winningCells
  const activeTurn = mode === 'remote' ? remoteMatch?.currentTurn ?? 'X' : turn
  const remoteMatchId = remoteMatch?.id
  const remoteMatchStatus = remoteMatch?.status
  const canPlayRemote =
    !!remoteMatch &&
    remoteMatch.status === 'active' &&
    remoteMatch.myMark === remoteMatch.currentTurn &&
    !remoteMatch.winnerMark &&
    !remoteBusy

  const message = useMemo(
    () => (mode === 'remote' && !remoteMatch ? 'Create or join a live room' : statusText(remoteMatch, board, turn, winner)),
    [mode, remoteMatch, board, turn, winner]
  )

  const playerXLabel = mode === 'remote' ? remoteMatch?.players.X?.label ?? 'Player X' : 'You'
  const playerOLabel = mode === 'remote' ? remoteMatch?.players.O?.label ?? 'Waiting...' : BOT_NAME

  const resultHeadline = useMemo(() => {
    if (!activeWinner) return null
    if (activeWinner === 'draw') return 'Draw Game'
    if (mode === 'remote') return activeWinner === remoteMatch?.myMark ? 'You Win!' : `${activeWinner} Wins`
    return activeWinner === 'X' ? 'You Win!' : `${BOT_NAME} Wins`
  }, [activeWinner, mode, remoteMatch?.myMark])

  useEffect(() => {
    if (!remoteMatchId || remoteMatchStatus === 'settled') return
    const id = window.setInterval(async () => {
      try {
        const res = await api.getGomokuMatch(remoteMatchId)
        setRemoteMatch(res.match)
      } catch {
        // Keep the last visible state if polling briefly fails.
      }
    }, 1800)
    return () => window.clearInterval(id)
  }, [remoteMatchId, remoteMatchStatus])

  useEffect(() => {
    if (!initialJoinCode) return
    const code = initialJoinCode.trim().toUpperCase()
    setMode('remote')
    setJoinCode(code)
    setRemoteBusy(true)
    setRemoteError(null)
    api
      .joinGomokuMatch(code)
      .then((res) => {
        setRemoteMatch(res.match)
        hapticNotify('success')
      })
      .catch((error: any) => {
        setRemoteError(error.message || 'Could not join room')
        hapticNotify('error')
      })
      .finally(() => setRemoteBusy(false))
  }, [initialJoinCode])

  useEffect(() => {
    if (remoteMatch?.status !== 'waiting') {
      setWaitingNudge(false)
      return
    }
    const id = window.setTimeout(() => setWaitingNudge(true), 18_000)
    return () => window.clearTimeout(id)
  }, [remoteMatch?.status, remoteMatch?.id])

  const resetComputer = () => {
    setBoard(createGomokuBoard())
    setTurn('X')
    setWinner(null)
    setWinningCells([])
    setLastMove(null)
    setThinking(false)
  }

  const finishIfWon = (nextBoard: GomokuBoard): boolean => {
    const result = evaluateGomokuWinner(nextBoard)
    if (result.winnerMark) {
      setWinner(result.winnerMark)
      setWinningCells(result.winningCells)
      hapticNotify(result.winnerMark === 'X' ? 'success' : 'warning')
      return true
    }
    return false
  }

  const playComputerCell = (row: number, col: number) => {
    if (mode !== 'computer' || thinking || winner || turn !== 'X' || board[row][col]) return
    try {
      const playerBoard = applyGomokuMove(board, row, col, 'X')
      setBoard(playerBoard)
      setLastMove([row, col])
      haptic('medium')
      if (finishIfWon(playerBoard)) return

      setTurn('O')
      setThinking(true)
      window.setTimeout(() => {
        const move = chooseComputerMove(playerBoard, 'O')
        if (!move) {
          setWinner('draw')
          setThinking(false)
          return
        }
        const computerBoard = applyGomokuMove(playerBoard, move[0], move[1], 'O')
        setBoard(computerBoard)
        setLastMove(move)
        setThinking(false)
        if (!finishIfWon(computerBoard)) setTurn('X')
      }, 520)
    } catch {
      hapticNotify('error')
    }
  }

  const createRemoteRoom = async () => {
    setRemoteBusy(true)
    setRemoteError(null)
    try {
      const res = await api.createGomokuMatch()
      setRemoteMatch(res.match)
      setMode('remote')
      hapticNotify('success')
    } catch (error: any) {
      setRemoteError(error.message || 'Could not create room')
      hapticNotify('error')
    } finally {
      setRemoteBusy(false)
    }
  }

  const joinRemoteRoom = async () => {
    setRemoteBusy(true)
    setRemoteError(null)
    try {
      const res = await api.joinGomokuMatch(joinCode)
      setRemoteMatch(res.match)
      setMode('remote')
      hapticNotify('success')
    } catch (error: any) {
      setRemoteError(error.message || 'Could not join room')
      hapticNotify('error')
    } finally {
      setRemoteBusy(false)
    }
  }

  const playRemoteCell = async (row: number, col: number) => {
    if (!remoteMatch || !canPlayRemote || activeBoard[row][col]) return
    setRemoteBusy(true)
    setRemoteError(null)
    try {
      setLastMove([row, col])
      const res = await api.playGomokuMove(remoteMatch.id, row, col)
      setRemoteMatch(res.match)
      haptic('medium')
      if (res.match.winnerMark) hapticNotify(res.match.winnerMark === remoteMatch.myMark ? 'success' : 'warning')
    } catch (error: any) {
      setRemoteError(error.message || 'Move failed')
      hapticNotify('error')
    } finally {
      setRemoteBusy(false)
    }
  }

  const handleCell = (row: number, col: number) => {
    if (mode === 'remote') {
      playRemoteCell(row, col)
    } else {
      playComputerCell(row, col)
    }
  }

  const copyCode = async () => {
    if (!remoteMatch) return
    await navigator.clipboard?.writeText(remoteMatch.shareCode)
    hapticNotify('success')
  }

  const copyInvite = async () => {
    if (!remoteMatch || typeof window === 'undefined') return
    const invite = `${window.location.origin}/?gomoku=${encodeURIComponent(remoteMatch.shareCode)}`
    await navigator.clipboard?.writeText(invite)
    hapticNotify('success')
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet gomoku-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="gomoku-hero">
          <div>
            <div className="gomoku-kicker">Gomoku Blitz</div>
            <h3 className="gomoku-title">Connect 5 on an 8x8 arena</h3>
          </div>
          <div className="gomoku-turn-orb" data-turn={activeTurn}>
            {MARK_ICON[activeTurn]}
          </div>
        </div>

        <div className="gomoku-players">
          <div className={`gomoku-player-chip${activeTurn === 'X' && !activeWinner ? ' active' : ''}`} data-mark="X">
            <span className="gomoku-player-icon">{MARK_ICON.X}</span>
            <span className="gomoku-player-name">{playerXLabel}</span>
          </div>
          <div className="gomoku-vs">VS</div>
          <div className={`gomoku-player-chip${activeTurn === 'O' && !activeWinner ? ' active' : ''}`} data-mark="O">
            <span className="gomoku-player-icon">{MARK_ICON.O}</span>
            <span className="gomoku-player-name">{playerOLabel}</span>
          </div>
        </div>

        <div className="gomoku-mode-tabs" role="tablist" aria-label="Gomoku mode">
          <button className={mode === 'computer' ? 'active' : ''} onClick={() => setMode('computer')}>
            🤖 vs {BOT_NAME}
          </button>
          <button className={mode === 'remote' ? 'active' : ''} onClick={() => setMode('remote')}>
            Remote
          </button>
        </div>

        {mode === 'remote' && !remoteMatch && (
          <div className="gomoku-remote-panel">
            <button className="btn-primary" disabled={remoteBusy} onClick={createRemoteRoom}>
              {remoteBusy ? 'Creating...' : 'Create live room'}
            </button>
            <div className="gomoku-join-row">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                maxLength={8}
              />
              <button className="game-play-btn" disabled={remoteBusy || joinCode.trim().length < 4} onClick={joinRemoteRoom}>
                Join
              </button>
            </div>
            <p className="gomoku-note">Remote rooms use server-validated moves and refresh live every few seconds.</p>
          </div>
        )}

        {remoteMatch && (
          <div className="gomoku-room-strip">
            <span>Room {remoteMatch.shareCode}</span>
            <div className="gomoku-room-actions">
              <button onClick={copyCode}>Code</button>
              <button onClick={copyInvite}>Invite</button>
            </div>
          </div>
        )}

        {waitingNudge && remoteMatch?.status === 'waiting' && (
          <div className="gomoku-wait-alert">
            <div>
              <strong>Still waiting?</strong>
              <span>Keep the room open, or play a quick match against {BOT_NAME} while you wait.</span>
            </div>
            <div className="gomoku-wait-actions">
              <button onClick={() => setWaitingNudge(false)}>Wait longer</button>
              <button
                onClick={() => {
                  resetComputer()
                  setRemoteMatch(null)
                  setMode('computer')
                }}
              >
                Play {BOT_NAME}
              </button>
            </div>
          </div>
        )}

        <div className="gomoku-status" data-mode={mode}>
          <span>{message}</span>
          {remoteMatch && <strong>You are {remoteMatch.myMark ?? 'watching'}</strong>}
        </div>

        <div className="gomoku-board-wrap">
          <div className="gomoku-board" role="grid" aria-label="Gomoku board">
            {activeBoard.map((rowCells, row) =>
              rowCells.map((cell, col) => {
                const isWin = hasWinningCell(activeWinningCells, row, col)
                const isLast = lastMove ? lastMove[0] === row && lastMove[1] === col : false
                return (
                  <button
                    key={cellKey(row, col)}
                    className="gomoku-cell"
                    data-mark={cell ?? 'empty'}
                    data-win={isWin ? 'true' : 'false'}
                    data-last={isLast ? 'true' : 'false'}
                    disabled={!!cell || !!activeWinner || (mode === 'computer' ? turn !== 'X' || thinking : !canPlayRemote)}
                    onClick={() => handleCell(row, col)}
                    aria-label={`Row ${row + 1}, column ${col + 1}${cell ? `, ${cell}` : ''}`}
                  >
                    {cell && <span>{cell}</span>}
                  </button>
                )
              })
            )}
          </div>

          {activeWinner && (
            <div className="gomoku-result-banner">
              <div className="gomoku-result-emoji">{activeWinner === 'draw' ? '🤝' : MARK_ICON[activeWinner]}</div>
              <div className="gomoku-result-title">{resultHeadline}</div>
            </div>
          )}
        </div>

        {remoteError && <div className="gomoku-error">{remoteError}</div>}

        <div className="gomoku-actions">
          {mode === 'computer' && (
            <button className="game-play-btn" onClick={resetComputer}>
              Rematch {BOT_NAME}
            </button>
          )}
          {mode === 'remote' && remoteMatch && (
            <button className="game-play-btn" onClick={() => setRemoteMatch(null)}>
              Leave room
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {activeWinner && activeWinner !== 'draw' && <Confetti />}
      </div>
    </div>
  )
}
