import { neon } from "@neon/serverless";
import "@std/dotenv/load";
import { serveDir } from "@std/http";

const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const sql = neon(databaseUrl);

// 直前の単語を保持しておく
const wordHistories: string[] = [];

/**
 * ルームを作成する
 * @param magicWord 魔法の単語
 * @param hostName ホストの名前
 */
async function createRoom(
  magicWord: string,
  hostName: string,
) {

  await sql`
    INSERT INTO rooms (id, magic_word, host_name, number_of_players, is_active, started_at, finished_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      ${magicWord},
      ${hostName},
      1,
      true,
      NOW(),
      NULL,
      NOW(),
      NOW()
    )
  `;

}

async function standby(request: Request) {

  const requestJson = await request.json();

  const userName = requestJson["userName"];
  const magicWord = requestJson["magicWord"];
  const isHost = requestJson["isHost"];

  if (!userName) {
    return new Response(
      JSON.stringify({
        "errorMessage": "userName is not set",
        "errorCode": "userNameNotSet",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  if (!magicWord) {
    return new Response(
      JSON.stringify({
        "errorMessage": "magicWord is not set",
        "errorCode": "magicWordNotSet",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  if (isHost === undefined) {
    return new Response(
      JSON.stringify({
        "errorMessage": "isHost is not set",
        "errorCode": "isHostNotSet",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  // create_atが最新のroomがactiveかclosedかを判定する
  const room = await sql`
    SELECT * FROM rooms
    WHERE magic_word = ${magicWord}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (room.length === 0) {
    await createRoom(magicWord, userName);
  } else {
    const isActive = room[0].is_active;
    if (!isActive) {
      await createRoom(magicWord, userName);
    }
  }

  return new Response(
    JSON.stringify({
      "message": "standby success",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );

}

/**
 * 直前の単語を返す
 * @returns 直前の単語
 */
function getPreviousWord() {

  return new Response(
    wordHistories.slice(-1)[0]
      ? wordHistories.slice(-1)[0]
      : "しりとり",
  );

};

/**
 * リセットする
 * @returns レスポンス
 */
function reset() {

  wordHistories.length = 0;
  return new Response(
    JSON.stringify({ "previousWord": "しりとり" }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );

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
 * @param previousWord 直前の単語
 * @param word 判定する単語
 * @returns 過去に使用したことのある単語かどうか
 */
function isUsedWord(previousWord: string, word: string) {
  return wordHistories.includes(word) || previousWord === word;
}

/**
 * 次の単語を受け取って保存する
 * @param request リクエスト
 * @returns レスポンス
 */
async function postNextWord(request: Request) {

  const requestJson = await request.json();

  const nextWord = requestJson["nextWord"];
  const previousWord = requestJson["previousWord"];

  const checkCharLength = isSmallKana(previousWord) ? 2 : 1;
  const isMatchCheck = previousWord.slice(-checkCharLength) === nextWord.slice(0, checkCharLength);

  if (!isMatchCheck) {
    return new Response(
      JSON.stringify({
        "previousWord": previousWord,
        "errorMessage": "前の単語に続いていません",
        "errorCode": "nextWordNotMatchPreviousWord",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  if (nextWord.slice(-1) === "ん") {
    return new Response(
      JSON.stringify({
        "errorMessage": "「ん」で終わる単語は使えません",
        "errorCode": "nnEndWord",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  if (!isHiragana(nextWord)) {
    return new Response(
      JSON.stringify({
        "errorMessage": "ひらがな以外の文字は使えません",
        "errorCode": "notHiragana",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  if (isUsedWord(previousWord, nextWord)) {
    return new Response(
      JSON.stringify({
        "errorMessage": "過去に使用した単語は使えません",
        "errorCode": "usedWord",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  if (nextWord.length === checkCharLength) {
    return new Response(
      JSON.stringify({
        "errorMessage": "一音の単語は使えません",
        "errorCode": "singleSoundWord",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  wordHistories.push(previousWord);

  return new Response(
    JSON.stringify({ "previousWord": nextWord }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );

};

// localhostにDenoのHTTPサーバーを展開
export function startServer() {

  Deno.serve({ port: 8000 }, async (request) => {
    // パス名を取得する
    const pathname = new URL(request.url).pathname;

    // GET /shiritori: 直前の単語を返す
    if (request.method === "GET" && pathname === "/shiritori") {
      return getPreviousWord();
    }

    // POST /shiritori: 次の単語を受け取って保存する
    if (request.method === "POST" && pathname === "/shiritori") {
      return await postNextWord(request);
    }

    // POST /reset: リセットする
    if (request.method === "POST" && pathname === "/reset") {
      return reset();
    }

    // POST /standby: 待機する
    if (request.method === "POST" && pathname === "/standby") {
      return await standby(request);
    }

    return serveDir(
      request,
      {
        /*
        - fsRoot: 公開するフォルダを指定
        - urlRoot: フォルダを展開するURLを指定。今回はlocalhost:8000/に直に展開する
        - enableCors: CORSの設定を付加するか
        */
        fsRoot: "dist",
        urlRoot: "",
        enableCors: true,
      },
    );
  });
};
