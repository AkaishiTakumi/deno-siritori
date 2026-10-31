import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { ErrorResponse, GetHistoryResponse, GetRoomStatusResponse, PostNextWordRequestBody, PostResetResponse, PostSiritoriResponse, PostStandbyResponse, PreviousWordResponse, ResetRequestBody, RoomHistoriesRow, RoomMembersRow, RoomRules, RoomsRow, StandbyRequestBody, StartRoomRequestBody, UUID } from "../shared/types.js";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const defaultRoomRules: RoomRules = {
  n: true,
  singleSound: true,
  singleSoundLose: false,
  oneTime: true,
  oneTimeLose: true,
  timeLimit: true,
  timeLimitSeconds: 30,
};

function roomRulesFromRow(room: RoomsRow): RoomRules {
  return {
    n: room.n_rule ?? defaultRoomRules.n,
    singleSound: room.single_sound_rule ?? defaultRoomRules.singleSound,
    singleSoundLose: room.single_sound_lose_rule ?? defaultRoomRules.singleSoundLose,
    oneTime: room.one_time_rule ?? defaultRoomRules.oneTime,
    oneTimeLose: room.one_time_lose_rule ?? defaultRoomRules.oneTimeLose,
    timeLimit: room.time_limit_rule ?? defaultRoomRules.timeLimit,
    timeLimitSeconds: room.time_limit_seconds ?? defaultRoomRules.timeLimitSeconds,
  };
}

function normalizeRoomRules(value: RoomRules | undefined): RoomRules {
  if (!value) return defaultRoomRules;
  return {
    n: value.n === true,
    singleSound: value.singleSound === true,
    singleSoundLose: value.singleSoundLose === true,
    oneTime: value.oneTime === true,
    oneTimeLose: value.oneTimeLose === true,
    timeLimit: value.timeLimit === true,
    timeLimitSeconds: Number.isInteger(value.timeLimitSeconds)
      ? Math.min(60, Math.max(1, value.timeLimitSeconds))
      : defaultRoomRules.timeLimitSeconds,
  };
}

type DeepExpand<T> = T extends Function
  ? T
  : T extends Array<infer InferredArrayMember>
  ? DeepExpand<InferredArrayMember>[]
  : T extends object
  ? { [K in keyof T]: DeepExpand<T[K]> }
  : T;

/**
 * JSON形式のレスポンスを返す
 * @param body レスポンスのボディ
 * @param status ステータスコード
 * @returns JSON形式のレスポンス
 */
function jsonResponse<T extends Record<string, any>>(body: T, status = 200): DeepExpand<T> & Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  }) as DeepExpand<T> & Response;
}

/**
 * ルームIDに対応する単語履歴を取得する\
 * 部屋に履歴が存在しない場合は空の配列を返す
 * @param sql SQLクライアント
 * @param roomId ルームID
 * @returns 単語履歴
 */
async function getHistory(
  sql: NeonQueryFunction<false, false>,
  roomId: UUID
) {

  if (!roomId) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "roomId が設定されていません",
      "errorLocation": "getHistory",
      "errorCode": "roomIdNotSet",
    }, 400);
  }

  const histories = await sql`
    SELECT siritori_word, created_at FROM room_histories
    WHERE room_id = ${roomId}
    ORDER BY number_of_turns
  ` as RoomHistoriesRow[];

  return jsonResponse<GetHistoryResponse>({
    "kind": "room-history",
    "roomHistory": histories
  });
}

function getCurrentTurn(
  roomHistory: RoomHistoriesRow[],
  memberNames: string[],
) {

  const numberOfTurns = roomHistory.length;
  const currentPlayerIndex = numberOfTurns % memberNames.length;
  const currentTurn = memberNames[currentPlayerIndex];

  return currentTurn;
}

/**
 * あいことばの検証を行う
 * @param value 検証する値
 * @returns 検証結果
 */
function validateMagicWord(value: unknown) {
  if (typeof value !== "string") {
    console.error("Invalid magic word type");
    return null;
  }
  const magicWord = value.trim();
  if (magicWord.length < 5 || magicWord.length > 50) {
    console.error("Invalid magic word length");
    return null;
  }
  return magicWord.length >= 5 && magicWord.length <= 50 ? magicWord : null;
}

/**
 * ルームを作成する
 * @param sql SQLクライアント
 * @param magicWord あいことば
 * @param hostName ホストの名前
 */
async function createRoom(
  sql: NeonQueryFunction<false, false>,
  magicWord: string,
  hostName: string,
  roomRules: RoomRules,
) {

  const rooms = await sql`
    INSERT INTO rooms (
      id
      , magic_word
      , host_name
      , max_players
      , is_active
      , started_at
      , finished_at
      , n_rule
      , single_sound_rule
      , single_sound_lose_rule
      , one_time_rule
      , one_time_lose_rule
      , time_limit_rule
      , time_limit_seconds
      , created_at
      , updated_at
    )
    VALUES (
      gen_random_uuid()
      , ${magicWord}
      , ${hostName}
      , 8
      , true
      , NULL
      , NULL
      , ${roomRules.n}
      , ${roomRules.singleSound}
      , ${roomRules.singleSoundLose}
      , ${roomRules.oneTime}
      , ${roomRules.oneTimeLose}
      , ${roomRules.timeLimit}
      , ${roomRules.timeLimitSeconds}
      , NOW()
      , NOW()
    )
    RETURNING id
  ` as RoomsRow[];

  const roomId = rooms[0].id satisfies UUID;

  await sql`
    INSERT INTO room_members (
      id
      , room_id
      , user_name
      , created_at
      , updated_at
    )
    VALUES (
      gen_random_uuid()
      , ${roomId}
      , ${hostName}
      , NOW()
      , NOW()
    )
  `;

  return roomId;
}

/**
 * 待機する
 * @param sql SQLクライアント
 * @param body リクエストのJSONボディ
 * @returns レスポンス
 */
async function standby(
  sql: NeonQueryFunction<false, false>,
  body: StandbyRequestBody
) {
  const userName = typeof body.userName === "string"
    ? body.userName.trim()
    : "";
  const isSolo = typeof body.isSolo === "boolean" ? body.isSolo : false;
  const magicWord = isSolo ? "" : validateMagicWord(body.magicWord);
  const isHost = body.isHost;
  const roomRules = normalizeRoomRules(body.roomRules);
  let hasRoom = true;

  if (!userName) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "userName が設定されていません",
      "errorLocation": "standby",
      "errorCode": "userNameNotSet",
    }, 400);
  }

  if (!magicWord && magicWord !== "") {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "magicWord が5〜50文字で設定されていません",
      "errorLocation": "standby",
      "errorCode": "invalidMagicWord",
    }, 400);
  }

  if (isHost === undefined) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "isHost が設定されていません",
      "errorLocation": "standby",
      "errorCode": "isHostNotSet",
    }, 400);
  }

  const room = await sql`
    SELECT id, is_active, max_players, started_at FROM rooms
    WHERE magic_word = ${magicWord}
    ORDER BY created_at DESC
    LIMIT 1
  ` as RoomsRow[];

  let roomId: UUID;
  if (room.length === 0 || !room[0].is_active || room[0].started_at !== null) {
    hasRoom = false;

    if (!isHost) {
      return jsonResponse<PostStandbyResponse>({
        "hasRoom": false,
      });
    }

    roomId = await createRoom(sql, magicWord, userName, roomRules);

  }
  else {

    roomId = room[0].id;
    if (!roomId) {
      return jsonResponse<ErrorResponse>({
        "kind": "error",
        "errorMessage": "ルームIDが取得できませんでした",
        "errorLocation": "standby",
        "errorCode": "roomIdNotFound",
      }, 500);
    }

    const members = await sql`
      SELECT user_name FROM room_members
      WHERE room_id = ${roomId}
    ` as RoomMembersRow[];

    if (members.length >= room[0].max_players) {
      return jsonResponse<PostStandbyResponse>({
        "hasRoom": true,
        "isFull": true,
        "roomId": roomId,
      });
    }

    const member = await sql`
      SELECT 1 FROM room_members
      WHERE room_id = ${roomId} AND user_name = ${userName}
      LIMIT 1
    ` as RoomMembersRow[];

    if (member.length === 0) {

      if (isHost) {
        return jsonResponse<PostStandbyResponse>({
          "hasRoom": true,
        });
      }

      await sql`
        INSERT INTO room_members (
          id
          , room_id
          , user_name
          , created_at
          , updated_at
        )
        VALUES (
          gen_random_uuid()
          , ${roomId}
          , ${userName}
          , NOW()
          , NOW()
        )
      `;
    }

  }

  const response = await roomStatus(sql, roomId);
  if (response.kind === "error") return response;
  const roomStatusData = await response.json() as GetRoomStatusResponse;

  return jsonResponse<PostStandbyResponse>({
    ...roomStatusData,
    "hasRoom": hasRoom,
  }, response.status);
}

/**
 * ルームの状態を返す
 * @param sql SQLクライアント
 * @param roomId ルームID
 * @returns レスポンス
 */
async function roomStatus(
  sql: NeonQueryFunction<false, false>,
  roomId: UUID
) {

  const rooms = await sql`
    SELECT id, magic_word, host_name, max_players, is_active, started_at
      , n_rule, single_sound_rule, single_sound_lose_rule
      , one_time_rule, one_time_lose_rule, time_limit_rule, time_limit_seconds
    FROM rooms WHERE id = ${roomId} LIMIT 1
  ` as RoomsRow[];

  if (rooms.length === 0) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "ルームが見つかりません",
      "errorLocation": "roomStatus",
      "errorCode": "roomNotFound"
    }, 400);
  }

  const members = await sql`
    SELECT user_name FROM room_members
    WHERE room_id = ${roomId}
    ORDER BY created_at
  ` as RoomMembersRow[];

  const memberNames = members.map((member) => member.user_name);

  const historyResponse = await getHistory(sql, roomId);
  if (historyResponse.kind === "error") return historyResponse;
  const roomHistory = (await historyResponse.json() as GetHistoryResponse).roomHistory;

  const currentTurn = getCurrentTurn(roomHistory, memberNames);

  const previousWordResponse = await getPreviousWord(sql, roomId);
  const previousWord = (await previousWordResponse.json() as PreviousWordResponse).previousWord;
  let isActive = rooms[0].is_active;
  const roomRules = roomRulesFromRow(rooms[0]);
  const turnStartedAt = roomHistory.slice(-1)[0]?.created_at ?? rooms[0].started_at;
  if (
    isActive &&
    turnStartedAt &&
    roomRules.timeLimit &&
    Date.now() - new Date(turnStartedAt).getTime() >= roomRules.timeLimitSeconds * 1000
  ) {
    await finishRoom(sql, roomId);
    isActive = false;
  }

  return jsonResponse<GetRoomStatusResponse>({
    "kind": "room-status",
    "roomId": rooms[0].id,
    "magicWord": rooms[0].magic_word,
    "hostName": rooms[0].host_name,
    "maxPlayers": rooms[0].max_players,
    "minPlayers": 3,
    "isActive": isActive,
    "isStarted": rooms[0].started_at !== null,
    "shouldRejoin": !isActive && rooms[0].started_at === null,
    "startedAt": rooms[0].started_at,
    "turnStartedAt": turnStartedAt,
    "currentTurn": currentTurn,
    "roomRules": roomRulesFromRow(rooms[0]),
    "players": members.map((member) => ({
      "userName": member.user_name,
      "isHost": member.user_name === rooms[0].host_name,
    })),
    "members": members.map((member) => member.user_name),
    "previousWord": previousWord,
  });

}

async function startRoom(
  sql: NeonQueryFunction<false, false>,
  body: StartRoomRequestBody,
) {
  const roomId = body.roomId;
  const userName = typeof body.userName === "string" ? body.userName.trim() : "";
  const isSolo = typeof body.isSolo === "boolean" ? body.isSolo : false;

  if (!roomId) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "roomId が設定されていません",
      "errorLocation": "startRoom",
      "errorCode": "startRoomInputMissing",
    }, 400);
  }

  if (!userName) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "userName が設定されていません",
      "errorLocation": "startRoom",
      "errorCode": "startRoomInputMissing",
    }, 400);
  }

  const rooms = await sql`
    SELECT id, host_name, max_players, is_active, started_at
    FROM rooms
    WHERE id = ${roomId}
    LIMIT 1
  ` as RoomsRow[];

  if (rooms.length === 0) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "ルームが見つかりません",
      "errorLocation": "startRoom",
      "errorCode": "roomNotFound",
    }, 404);
  }

  const room = rooms[0];
  if (!room.is_active) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "このルームは終了しています",
      "errorLocation": "startRoom",
      "errorCode": "roomInactive",
    }, 400);
  }
  if (room.host_name !== userName) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "ホストのみ開始できます",
      "errorLocation": "startRoom",
      "errorCode": "hostOnly",
    }, 403);
  }
  if (room.started_at !== null) {
    return roomStatus(sql, roomId);
  }

  const members = await sql`
    SELECT user_name FROM room_members
    WHERE room_id = ${roomId}
  ` as RoomMembersRow[];

  if (members.length < 3 && !isSolo) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "3人以上で開始できます",
      "errorLocation": "startRoom",
      "errorCode": "minimumPlayersNotReached",
    }, 400);
  }

  await sql`
    UPDATE rooms
    SET started_at = NOW(), updated_at = NOW()
    WHERE id = ${roomId} AND started_at IS NULL
  `;

  return roomStatus(sql, roomId);
}

/**
 * 直前の単語を返す
 * @param sql SQLクライアント
 * @param roomId ルームID
 * @returns 直前の単語
 */
async function getPreviousWord(
  sql: NeonQueryFunction<false, false>,
  roomId: UUID
) {

  if (!roomId) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "roomId が設定されていません",
      "errorLocation": "getPreviousWord",
      "errorCode": "roomIdNotSet",
    }, 400);
  }

  const response = await getHistory(sql, roomId);
  if (response.kind === "error") return response;
  const roomHistory = (await response.json() as GetHistoryResponse).roomHistory;

  const previousWord = roomHistory.slice(-1)[0]?.siritori_word ?? "しりとり";

  return jsonResponse<PreviousWordResponse>({ "previousWord": previousWord });

};

/**
 * リセットする
 * @param roomId ルームID
 * @returns レスポンス
 */
async function reset(
  sql: NeonQueryFunction<false, false>,
  body: ResetRequestBody
) {
  const roomId = body.roomId;
  const userName = typeof body.userName === "string" ? body.userName.trim() : "";

  if (!roomId) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "roomId が設定されていません",
      "errorLocation": "reset",
      "errorCode": "roomIdNotSet",
    }, 400);
  }

  const rooms = await sql`
    SELECT id, host_name, is_active
    FROM rooms
    WHERE id = ${roomId}
    LIMIT 1
  ` as RoomsRow[];

  if (rooms.length === 0) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "ルームが見つかりません",
      "errorLocation": "reset",
      "errorCode": "roomNotFound",
    }, 404);
  }

  if (!userName || rooms[0].host_name !== userName) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "ホストのみリセットできます",
      "errorLocation": "reset",
      "errorCode": "hostOnly",
    }, 403);
  }

  await sql`
    UPDATE rooms
    SET is_active = false
      , finished_at = NOW()
      , started_at = NULL
      , updated_at = NOW()
    WHERE id = ${roomId}
  `;

  return jsonResponse<PostResetResponse>({
    "roomId": roomId,
    "isActive": false,
    "shouldRejoin": true,
  });
}

/**
 * 末尾が小さい文字かどうかを判定する
 * @param word 判定する単語
 * @returns 末尾が小さい文字かどうか
 */
function isSmallKana(word: string) {
  return /[ぁぃぅぇぉっゃゅょゎ]$/.test(word);
};

/**
 * 単語がひらがなかどうかを判定する
 * @param word 判定する単語
 * @returns ひらがなかどうか
 */
function isHiragana(word: string) {
  return /^[ぁ-んー]+$/.test(word);
}

/**
 * 過去に使用したことのある単語かどうかを判定する
 * @param wordHistory 過去の単語履歴
 * @param previousWord 直前の単語
 * @param word 判定する単語
 * @returns 過去に使用したことのある単語かどうか
 */
function isUsedWord(
  roomHistory: RoomHistoriesRow[],
  previousWord: string,
  word: string
) {
  return roomHistory.some((row) => row.siritori_word === word) || previousWord === word;
}

async function finishRoom(
  sql: NeonQueryFunction<false, false>,
  roomId: UUID,
) {
  await sql`
    UPDATE rooms
    SET is_active = false, finished_at = NOW(), updated_at = NOW()
    WHERE id = ${roomId} AND is_active = true
  `;
}

/**
 * 次の単語を受け取って保存する
 * @param body リクエストのJSONボディ
 * @returns レスポンス
 */
async function postNextWord(
  sql: NeonQueryFunction<false, false>,
  body: PostNextWordRequestBody,
) {

  const nextWord = body.nextWord ?? "";
  const previousWord = body.previousWord ?? "";
  const roomId = body.roomId;

  if (!roomId) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "roomId が設定されていません",
      "errorLocation": "postNextWord",
      "errorCode": "roomIdNotSet",
    }, 400);
  }

  const userName = typeof body.userName === "string" ? body.userName.trim() : "";
  if (!userName) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "userName が設定されていません",
      "errorLocation": "postNextWord",
      "errorCode": "userNameNotSet",
    }, 400);
  }

  const rooms = await sql`
    SELECT host_name, is_active, started_at
      , n_rule, single_sound_rule, single_sound_lose_rule
      , one_time_rule, one_time_lose_rule, time_limit_rule, time_limit_seconds
    FROM rooms
    WHERE id = ${roomId}
    LIMIT 1
  ` as RoomsRow[];

  if (rooms.length === 0) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "ルームが見つかりません",
      "errorLocation": "postNextWord",
      "errorCode": "roomNotFound",
    }, 404);
  }
  if (!rooms[0].is_active || rooms[0].started_at === null) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "ゲームが開始されていません",
      "errorLocation": "postNextWord",
      "errorCode": "gameNotStarted",
    }, 400);
  }
  const members = await sql`
    SELECT user_name FROM room_members
    WHERE room_id = ${roomId}
    ORDER BY created_at
  ` as RoomMembersRow[];

  const memberNames = members.map((member) => member.user_name);
  if (!memberNames.includes(userName)) {
    return jsonResponse<ErrorResponse>({
      "kind": "error",
      "errorMessage": "ルーム参加者ではありません",
      "errorLocation": "postNextWord",
      "errorCode": "playerNotInRoom",
    }, 403);
  }

  const response = await getHistory(sql, roomId);
  if (response.kind === "error") return response;
  const roomHistory = (await response.json() as GetHistoryResponse).roomHistory;
  const roomRules = roomRulesFromRow(rooms[0]);
  const turnStartedAt = roomHistory.slice(-1)[0]?.created_at ?? rooms[0].started_at;
  if (
    roomRules.timeLimit &&
    turnStartedAt &&
    Date.now() - new Date(turnStartedAt).getTime() >= roomRules.timeLimitSeconds * 1000
  ) {
    await finishRoom(sql, roomId);
    return jsonResponse<PostSiritoriResponse>({
      "foulMessage": "制限時間を過ぎました",
      "foulCode": "timeLimit",
      "isFoul": true,
    });
  }

  const numberOfTurns = roomHistory.length;
  const currentTurn = getCurrentTurn(roomHistory, memberNames);

  if (currentTurn !== userName) {
    return jsonResponse<PostSiritoriResponse>({
      "foulMessage": `${currentTurn}さんのターンです`,
      "foulCode": "notPlayerTurn",
      "currentTurn": currentTurn,
      "isFoul": true,
    });
  }

  const checkCharLength = isSmallKana(previousWord) ? 2 : 1;
  const isMatchCheck = previousWord.slice(-checkCharLength) === nextWord.slice(0, checkCharLength);

  if (!isMatchCheck) {
    return jsonResponse<PostSiritoriResponse>({
      "previousWord": previousWord,
      "foulMessage": "前の単語に続いていません",
      "foulCode": "nextWordNotMatchPreviousWord",
      "isFoul": true,
    });
  }

  if (nextWord.slice(-1) === "ん" && roomRules.n) {
    await finishRoom(sql, roomId);
    return jsonResponse<PostSiritoriResponse>({
      "foulMessage": "「ん」で終わる単語を使ったため負けです",
      "foulCode": "nnEndWord",
      "isFoul": true,
    });
  }
  if (nextWord.slice(-1) === "ん") {
    return jsonResponse<PostSiritoriResponse>({
      "foulMessage": "「ん」で終わる単語は使えません",
      "foulCode": "nnEndWord",
      "isFoul": true,
    });
  }

  if (!isHiragana(nextWord)) {
    return jsonResponse<PostSiritoriResponse>({
      "foulMessage": "ひらがな以外の文字は使えません",
      "foulCode": "notHiragana",
      "isFoul": true,
    });
  }

  const usedWord = isUsedWord(roomHistory, previousWord, nextWord);
  if (usedWord && roomRules.oneTimeLose) {
    await finishRoom(sql, roomId);
    return jsonResponse<PostSiritoriResponse>({
      "foulMessage": "過去に使用した単語を使ったため負けです",
      "foulCode": "usedWord",
      "isFoul": true,
    });
  }
  if (usedWord && roomRules.oneTime) {
    return jsonResponse<PostSiritoriResponse>({
      "foulMessage": "過去に使用した単語は使えません",
      "foulCode": "usedWord",
      "isFoul": true,
    });
  }

  const isSingleSoundWord = nextWord.length === checkCharLength;
  if (isSingleSoundWord && roomRules.singleSoundLose) {
    await finishRoom(sql, roomId);
    return jsonResponse<PostSiritoriResponse>({
      "foulMessage": "一音の単語を使ったため負けです",
      "foulCode": "singleSoundWord",
      "isFoul": true,
    });
  }
  if (isSingleSoundWord && roomRules.singleSound) {
    return jsonResponse<PostSiritoriResponse>({
      "foulMessage": "一音の単語は使えません",
      "foulCode": "singleSoundWord",
      "isFoul": true,
    });
  }

  await sql`
    INSERT INTO room_histories (
      id
      , room_id
      , user_name
      , number_of_turns
      , siritori_word
      , created_at
      , updated_at
    ) VALUES (
      gen_random_uuid()
      , ${roomId}
      , ${userName}
      , ${numberOfTurns}
      , ${nextWord}
      , NOW()
      , NOW()
    )
  `;

  return jsonResponse<PostSiritoriResponse>({
    "previousWord": nextWord,
    "currentTurn": memberNames[(numberOfTurns + 1) % memberNames.length],
    "isFoul": false
  });
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    try {
      const sql = neon(env.DATABASE_URL);
      const url = new URL(request.url);
      const pathname = url.pathname;

      // GET /siritori: 直前の単語を返す
      if (request.method === "GET" && pathname === "/siritori") {

        const roomId = url.searchParams.get("room-id") as UUID;
        if (!roomId) {
          return jsonResponse<ErrorResponse>({
            "kind": "error",
            "errorMessage": "roomId が設定されていません",
            "errorLocation": "fetch GET /siritori",
            "errorCode": "roomIdNotSet",
          }, 400);
        }

        return getPreviousWord(sql, roomId);

      }

      // POST /siritori: 次の単語を受け取って保存する
      if (request.method === "POST" && pathname === "/siritori") {

        const body = await request.json() satisfies PostNextWordRequestBody;

        return postNextWord(sql, body);

      }

      // POST /reset: リセットする
      if (request.method === "POST" && pathname === "/reset") {

        const body = await request.json().catch(() => ({})) as ResetRequestBody;

        return reset(sql, body);

      }

      // POST /standby: 待機する
      if (request.method === "POST" && pathname === "/standby") {

        const body = await request.json() satisfies StandbyRequestBody;

        return standby(sql, body);

      }

      // POST /start-room: ホストがルームを開始する
      if (request.method === "POST" && pathname === "/start-room") {

        const body = await request.json() satisfies StartRoomRequestBody;

        return startRoom(sql, body);

      }

      // GET /room-status: ルームの状態を返す
      if (request.method === "GET" && pathname === "/room-status") {

        const roomId: UUID = url.searchParams.get("room-id") as UUID;
        if (!roomId) {
          return jsonResponse<ErrorResponse>({
            "kind": "error",
            "errorMessage": "roomId が設定されていません",
            "errorLocation": "fetch GET /room-status",
            "errorCode": "roomIdNotSet",
          }, 400);
        }

        return roomStatus(sql, roomId);

      }

    } catch (e) {

      return jsonResponse({
        "error": e instanceof Error ? `${e.message}` : "Unknown error",
        "stack": e instanceof Error ? e.stack : "undefined",
      }, 500);

    }

    return env.ASSETS.fetch(request);

  },
} satisfies ExportedHandler<Env>;
