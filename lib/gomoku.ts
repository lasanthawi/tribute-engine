import type { GomokuMatchDto } from './api-client'
import {
  applyGomokuMove,
  createGomokuBoard,
  evaluateGomokuWinner,
  getOppositeMark,
  GomokuBoard,
  GomokuMark,
} from './gomoku-rules'
import { supabase } from './supabase'

interface GomokuMatchRow {
  id: number
  share_code: string
  status: 'waiting' | 'active' | 'settled' | 'cancelled'
  creator_id: number
  opponent_id: number | null
  x_user_id: number
  o_user_id: number | null
  current_turn: GomokuMark
  winner_mark: GomokuMark | 'draw' | null
  winning_cells: Array<[number, number]>
  created_at: string
  updated_at: string
  completed_at: string | null
}

interface GomokuMoveRow {
  id: number
  match_id: number
  user_id: number
  mark: GomokuMark
  row_index: number
  col_index: number
  move_number: number
  created_at: string
}

function generateShareCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

function buildBoard(moves: GomokuMoveRow[]): GomokuBoard {
  return moves
    .sort((a, b) => a.move_number - b.move_number)
    .reduce((board, move) => applyGomokuMove(board, move.row_index, move.col_index, move.mark), createGomokuBoard())
}

function playerLabel(mark: GomokuMark, userId: number | null, viewerId: number): { id: number; label: string } | null {
  if (!userId) return null
  return { id: userId, label: userId === viewerId ? 'You' : `Player ${mark}` }
}

function toDto(match: GomokuMatchRow, moves: GomokuMoveRow[], viewerId: number): GomokuMatchDto {
  let myMark: GomokuMark | null = null
  if (match.x_user_id === viewerId) myMark = 'X'
  if (match.o_user_id === viewerId) myMark = 'O'

  return {
    id: match.id,
    shareCode: match.share_code,
    status: match.status,
    board: buildBoard(moves),
    currentTurn: match.current_turn,
    myMark,
    winnerMark: match.winner_mark,
    winningCells: match.winning_cells ?? [],
    moveCount: moves.length,
    players: {
      X: playerLabel('X', match.x_user_id, viewerId),
      O: playerLabel('O', match.o_user_id, viewerId),
    },
  }
}

async function getMoves(matchId: number): Promise<GomokuMoveRow[]> {
  const { data, error } = await supabase
    .from('gomoku_moves')
    .select('*')
    .eq('match_id', matchId)
    .order('move_number', { ascending: true })
  if (error) throw error
  return (data ?? []) as GomokuMoveRow[]
}

async function getMatchById(matchId: number): Promise<GomokuMatchRow | null> {
  const { data, error } = await supabase.from('gomoku_matches').select('*').eq('id', matchId).maybeSingle()
  if (error) throw error
  return data as GomokuMatchRow | null
}

export async function createGomokuMatch(userId: number): Promise<GomokuMatchDto> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const shareCode = generateShareCode()
    const { data, error } = await supabase
      .from('gomoku_matches')
      .insert({
        share_code: shareCode,
        creator_id: userId,
        x_user_id: userId,
        current_turn: 'X',
        status: 'waiting',
      })
      .select('*')
      .single()

    if (!error && data) return toDto(data as GomokuMatchRow, [], userId)
    if (error?.code !== '23505') throw error
  }
  throw new Error('Could not create room')
}

export async function joinGomokuMatch(userId: number, shareCode: string): Promise<GomokuMatchDto> {
  const normalized = shareCode.trim().toUpperCase()
  const { data: match, error } = await supabase
    .from('gomoku_matches')
    .select('*')
    .eq('share_code', normalized)
    .maybeSingle()
  if (error) throw error
  if (!match) throw new Error('Room not found')

  const row = match as GomokuMatchRow
  if (row.x_user_id === userId || row.o_user_id === userId) {
    return toDto(row, await getMoves(row.id), userId)
  }
  if (row.status !== 'waiting' || row.o_user_id) throw new Error('Room is already full')

  const { data: joined, error: updateError } = await supabase
    .from('gomoku_matches')
    .update({
      opponent_id: userId,
      o_user_id: userId,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('status', 'waiting')
    .is('o_user_id', null)
    .select('*')
    .single()
  if (updateError) throw updateError

  return toDto(joined as GomokuMatchRow, await getMoves(row.id), userId)
}

export async function getGomokuMatch(userId: number, matchId: number): Promise<GomokuMatchDto> {
  const match = await getMatchById(matchId)
  if (!match) throw new Error('Room not found')
  if (match.x_user_id !== userId && match.o_user_id !== userId) throw new Error('Not in this room')
  return toDto(match, await getMoves(matchId), userId)
}

export async function playGomokuMove(userId: number, matchId: number, row: number, col: number): Promise<GomokuMatchDto> {
  const match = await getMatchById(matchId)
  if (!match) throw new Error('Room not found')
  if (match.status !== 'active') throw new Error('Match is not active')

  const myMark = match.x_user_id === userId ? 'X' : match.o_user_id === userId ? 'O' : null
  if (!myMark) throw new Error('Not in this room')
  if (myMark !== match.current_turn) throw new Error('Not your turn')

  const moves = await getMoves(matchId)
  const board = buildBoard(moves)
  const nextBoard = applyGomokuMove(board, row, col, myMark)
  const result = evaluateGomokuWinner(nextBoard)
  const moveNumber = moves.length + 1

  const { error: moveError } = await supabase.from('gomoku_moves').insert({
    match_id: matchId,
    user_id: userId,
    mark: myMark,
    row_index: row,
    col_index: col,
    move_number: moveNumber,
  })
  if (moveError) {
    if (moveError.code === '23505') throw new Error('Cell is already occupied')
    throw moveError
  }

  const status = result.winnerMark ? 'settled' : 'active'
  const { data: updated, error: updateError } = await supabase
    .from('gomoku_matches')
    .update({
      status,
      current_turn: getOppositeMark(myMark),
      winner_mark: result.winnerMark,
      winning_cells: result.winningCells,
      updated_at: new Date().toISOString(),
      completed_at: result.winnerMark ? new Date().toISOString() : null,
    })
    .eq('id', matchId)
    .select('*')
    .single()
  if (updateError) throw updateError

  return toDto(updated as GomokuMatchRow, [...moves, {
    id: 0,
    match_id: matchId,
    user_id: userId,
    mark: myMark,
    row_index: row,
    col_index: col,
    move_number: moveNumber,
    created_at: new Date().toISOString(),
  }], userId)
}
