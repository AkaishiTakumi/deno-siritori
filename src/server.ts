import { serveDir } from "@std/http";

// 直前の単語を保持しておく
const wordHistories: string[] = [];

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

  // リクエストのペイロードを取得
  const requestJson = await request.json();
  // JSONの中からnextWordを取得
  const nextWord = requestJson["nextWord"];
  const previousWord = requestJson["previousWord"];

  const checkCharLength = isSmallKana(previousWord) ? 2 : 1;
  const isMatchCheck = previousWord.slice(-checkCharLength) === nextWord.slice(0, checkCharLength);

  if (!isMatchCheck) {
    return new Response(
      JSON.stringify({
        "previousWord": previousWord,
        "errorMessage": "前の単語に続いていません",
        "errorCode": "10001",
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
        "errorCode": "10002",
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
        "errorCode": "10003",
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
        "errorCode": "10004",
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
        "errorCode": "10005",
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
