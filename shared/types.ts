/// 型定義
interface UUID {
  uuid?: string;
}

interface RoomRules {
  n: boolean;
  singleSound: boolean;
  singleSoundLose: boolean;
  oneTime: boolean;
  oneTimeLose: boolean;
  timeLimit: boolean;
  timeLimitSeconds: number;
}

/// リクエストボディ
interface StandbyRequestBody {
  userName?: string;
  magicWord?: string;
  isHost?: boolean;
  isSolo?: boolean;
  roomRules?: RoomRules;
};

interface PostNextWordRequestBody {
  roomId: UUID;
  userName?: string;
  previousWord?: string;
  nextWord?: string;
}

interface StartRoomRequestBody {
  roomId: UUID;
  userName?: string;
  isSolo?: boolean;
  roomRules?: RoomRules;
}

/// レスポンス
interface ErrorResponse {
  kind: "error";
  errorMessage: string;
  errorLocation: string;
  errorCode: string;
}

interface GetHistoryResponse {
  kind: "room-history";
  roomHistory: RoomHistoriesRow[];
}

interface PreviousWordResponse {
  previousWord: string;
}

interface GetRoomStatusResponse {
  kind: "room-status";
  roomId: UUID;
  magicWord: string;
  hostName: string;
  maxPlayers: number;
  minPlayers: number;
  isActive: boolean;
  isStarted: boolean;
  shouldRejoin: boolean;
  startedAt: string | null;
  turnStartedAt: string | null;
  currentTurn: string | null;
  roomRules: RoomRules;
  players: PlayerInfo[];
  members: string[];
  previousWord: string;
}

interface PlayerInfo {
  userName: string;
  isHost: boolean;
}

interface GameState {
  isStarted: boolean;
  currentTurn: string | null;
  players: PlayerInfo[];
}

interface PostSiritoriResponse {
  previousWord?: string;
  foulMessage?: string;
  foulCode?: string;
  currentTurn?: string;
  isFoul: boolean;
}

interface PostStandbyResponse {
  hasRoom: boolean;
  isFull?: boolean;
  roomId?: UUID;
}

interface PostResetResponse {
  roomId: UUID;
  isActive: boolean;
  shouldRejoin: boolean;
}

interface ResetRequestBody {
  roomId: UUID;
  userName?: string;
}

/// カラム
interface RoomsRow {
  id: UUID;
  magic_word: string;
  host_name: string;
  max_players: number;
  is_active: boolean;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  n_rule: boolean;
  single_sound_rule: boolean;
  single_sound_lose_rule: boolean;
  one_time_rule: boolean;
  one_time_lose_rule: boolean;
  time_limit_rule: boolean;
  time_limit_seconds: number;
}

interface RoomMembersRow {
  id: UUID;
  room_id: UUID;
  user_name: string;
  created_at: string;
  updated_at: string;
}

interface RoomHistoriesRow {
  id: UUID;
  room_id: UUID;
  user_name: string;
  number_of_turns: number;
  siritori_word: string;
  created_at: string;
  updated_at: string;
}

// interface RoomsRow {
//   id: UUID;
//   magic_word: string;
//   host_user_id: UUID;
//   max_players: number;
//   is_active: boolean;
//   started_at: string | null;
//   finished_at: string | null;
//   created_at: string;
//   updated_at: string;
// }
// 
// interface RoomMembersRow {
//   id: UUID;
//   room_id: UUID;
//   order: number;
//   user_id: UUID;
//   created_at: string;
//   updated_at: string;
// }
// 
// interface RoomHistoriesRow {
//   id: UUID;
//   room_id: UUID;
//   number_of_turns: number;
//   user_id: UUID;
//   siritori_word: string;
//   created_at: string;
//   updated_at: string;
// }
// 
// interface UsersRow {
//   id: UUID;
//   user_name: string;
//   created_at: string;
//   updated_at: string;
// }

export type { ErrorResponse, GameState, GetHistoryResponse, GetRoomStatusResponse, PlayerInfo, PostNextWordRequestBody, PostResetResponse, PostSiritoriResponse, PostStandbyResponse, PreviousWordResponse, ResetRequestBody, RoomHistoriesRow, RoomMembersRow, RoomRules, RoomsRow, StandbyRequestBody, StartRoomRequestBody, UUID };
