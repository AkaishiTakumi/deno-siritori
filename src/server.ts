import { neon } from "@neon/serverless";
import "@std/dotenv/load";
import { serveDir } from "@std/http";

import type { PostNextWordRequestBody, StandbyRequestBody, UUID } from "./types.ts";

const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const sql = neon(databaseUrl);

const wordHistories = new Map<UUID, string[]>();

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * JSON形式のレスポンスを返す
 * @param body レスポンスのボディ
 * @param status ステータスコード
 * @returns JSON形式のレスポンス
 */
function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

/**
 * ルームIDに対応する単語履歴を取得する\
 * 履歴が存在しない場合は空の配列を返す
 * @param roomId ルームID
 * @returns 単語履歴
 */
function getHistory(roomId: UUID) {

  if (!roomId) {
    throw new Error("roomId is not set");
  }

  if (!wordHistories.has(roomId)) {
    wordHistories.set(roomId, []);
  }

  return wordHistories.get(roomId)!;
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
 * @param magicWord あいことば
 * @param hostName ホストの名前
 */
async function createRoom(
  magicWord: string,
  hostName: string,
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
      , created_at
      , updated_at
    )
    VALUES (
      gen_random_uuid()
      , ${magicWord}
      , ${hostName}
      , 2
      , true
      , NOW()
      , NULL
      , NOW()
      , NOW()
    )
    RETURNING id
  `;
  const roomId: UUID = rooms[0].id as UUID;
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
 * @param body リクエストのJSONボディ
 * @returns レスポンス
 */
async function standby(body: StandbyRequestBody) {
  const userName = typeof body.userName === "string"
    ? body.userName.trim()
    : "";
  const magicWord = validateMagicWord(body.magicWord);
  const isHost = body.isHost;

  if (!userName) {
    return jsonResponse({
      "errorMessage": "userName is not set",
      "errorCode": "userNameNotSet",
    }, 400);
  }

  if (!magicWord) {
    return jsonResponse({
      "errorMessage": "magicWord must be 5-50 characters",
      "errorCode": "invalidMagicWord",
    }, 400);
  }

  if (isHost === undefined) {
    return jsonResponse({
      "errorMessage": "isHost is not set",
      "errorCode": "isHostNotSet",
    }, 400);
  }

  const room = await sql`
    SELECT id, is_active FROM rooms
    WHERE magic_word = ${magicWord}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  let roomId: UUID;
  if (room.length === 0 || !room[0].is_active) {
    if (!isHost) {
      return jsonResponse({
        "errorMessage": "参加できるルームがありません",
        "errorCode": "roomNotFound",
      }, 404);
    }
    roomId = await createRoom(magicWord, userName);
  } else {
    roomId = room[0].id;
    const member = await sql`
      SELECT 1 FROM room_members
      WHERE room_id = ${roomId} AND user_name = ${userName}
      LIMIT 1
    `;
    if (member.length === 0) {
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

  return roomStatus(roomId);
}

/**
 * ルームの状態を返す
 * @param roomId ルームID
 * @returns レスポンス
 */
async function roomStatus(roomId: UUID) {
  const rooms = await sql`
    SELECT id, magic_word, host_name, max_players, is_active
    FROM rooms WHERE id = ${roomId} LIMIT 1
  `;
  if (rooms.length === 0) {
    return jsonResponse({ "errorCode": "roomNotFound" }, 404);
  }
  const members = await sql`
    SELECT user_name FROM room_members
    WHERE room_id = ${roomId}
    ORDER BY created_at
  `;
  return jsonResponse({
    "roomId": rooms[0].id,
    "magicWord": rooms[0].magic_word,
    "hostName": rooms[0].host_name,
    "maxPlayers": rooms[0].max_players,
    "isActive": rooms[0].is_active,
    "members": members.map((member) => member.user_name),
  });
}

/**
 * 直前の単語を返す
 * @param roomId ルームID
 * @returns 直前の単語
 */
function getPreviousWord(roomId: UUID) {
  const history = getHistory(roomId);
  const previousWord = history.slice(-1)[0] ?? "しりとり";
  return jsonResponse({ "previousWord": previousWord });
};

/**
 * リセットする
 * @param roomId ルームID
 * @returns レスポンス
 */
function reset(roomId: UUID) {
  getHistory(roomId).length = 0;
  return jsonResponse({ "previousWord": "しりとり" });
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
function isUsedWord(wordHistory: string[], previousWord: string, word: string) {
  return wordHistory.includes(word) || previousWord === word;
}

/**
 * 次の単語を受け取って保存する
 * @param body リクエストのJSONボディ
 * @returns レスポンス
 */
function postNextWord(body: PostNextWordRequestBody) {

  const nextWord = body.nextWord ?? "";
  const previousWord = body.previousWord ?? "";
  const history = getHistory(body.roomId);

  const checkCharLength = isSmallKana(previousWord) ? 2 : 1;
  const isMatchCheck = previousWord.slice(-checkCharLength) === nextWord.slice(0, checkCharLength);

  if (!isMatchCheck) {
    return jsonResponse({
      "previousWord": previousWord,
      "errorMessage": "前の単語に続いていません",
      "errorCode": "nextWordNotMatchPreviousWord",
    }, 400);
  }

  if (nextWord.slice(-1) === "ん") {
    return jsonResponse({
      "errorMessage": "「ん」で終わる単語は使えません",
      "errorCode": "nnEndWord",
    }, 400);
  }

  if (!isHiragana(nextWord)) {
    return jsonResponse({
      "errorMessage": "ひらがな以外の文字は使えません",
      "errorCode": "notHiragana",
    }, 400);
  }

  if (isUsedWord(history, previousWord, nextWord)) {
    return jsonResponse({
      "errorMessage": "過去に使用した単語は使えません",
      "errorCode": "usedWord",
    }, 400);
  }

  if (nextWord.length === checkCharLength) {
    return jsonResponse({
      "errorMessage": "一音の単語は使えません",
      "errorCode": "singleSoundWord",
    }, 400);
  }

  history.push(previousWord);

  return jsonResponse({ "previousWord": nextWord });
};

// localhostにDenoのHTTPサーバーを展開
export function startServer() {

  Deno.serve({ port: 8000 }, async (request) => {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // GET /siritori: 直前の単語を返す
      if (request.method === "GET" && pathname === "/siritori") {
        const roomId: UUID = url.searchParams.get("room-id") as UUID;
        return getPreviousWord(roomId);
      }

      // POST /siritori: 次の単語を受け取って保存する
      if (request.method === "POST" && pathname === "/siritori") {
        const body = await request.json() as PostNextWordRequestBody;
        return postNextWord(body);
      }

      // POST /reset: リセットする
      if (request.method === "POST" && pathname === "/reset") {
        const body = await request.json().catch(() => ({})) as { roomId: UUID; };
        return reset(body.roomId);
      }

      // POST /standby: 待機する
      if (request.method === "POST" && pathname === "/standby") {
        const body = await request.json();
        if (!body) {
          console.error("Request body is not set");
        }
        if (typeof body.userName !== "string") {
          console.error("Request body userName is not a string");
        }
        if (typeof body.magicWord !== "string") {
          console.error("Request body magicWord is not a string");
        }
        if (typeof body.isHost !== "boolean") {
          console.error("Request body isHost is not a boolean");
        }
        return await standby(body);
      }

      // GET /room-status: ルームの状態を返す
      if (request.method === "GET" && pathname === "/room-status") {
        const roomId: UUID = url.searchParams.get("room-id") as UUID;
        return roomId
          ? await roomStatus(roomId)
          : jsonResponse({
            "errorMessage": "roomId が設定されていません",
            "errorCode": "roomIdNotSet",
          }, 400);
      }

    } catch (e) {
      return jsonResponse({
        "error": e instanceof Error ? `エラー: ${e.message}` : "エラー: Unknown error",
        "stack": e instanceof Error ? e.stack : "undefined",
      }, 500);
    }

    return serveDir(
      request,
      {
        fsRoot: "dist",
        urlRoot: "",
        enableCors: true,
      },
    );

  });
};
