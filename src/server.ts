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
 * 末尾が小さい文字かどうかを判定する
 * @param word 判定する単語
 * @returns 末尾が小さい文字かどうか
 */
function isSmallKana(word: string) {
  return /[ぁぃぅぇぉっゃゅょゎ]$/.test(word);
}

/**
 * 2つの単語が指定された文字数で一致するかどうかを判定する
 * @param previousWord 前の単語
 * @param nextWord 次の単語
 * @param checkLength 照合する文字数
 * @returns 一致するかどうか
 */
function isMatch(
  previousWord: string
  , nextWord: string
  , checkLength: number = 1
) {
  return previousWord.slice(-checkLength) === nextWord.slice(0, checkLength);
}

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

// 次の単語を受け取って保存する
async function postNextWord(request: Request) {

  // リクエストのペイロードを取得
  const requestJson = await request.json();
  // JSONの中からnextWordを取得
  const nextWord = requestJson["nextWord"];
  const previousWord = requestJson["previousWord"];

  let minChar;
  let isMatchCheck = false;

  if (isSmallKana(previousWord)) {
    if (isMatch(previousWord, nextWord, 2)) {
      minChar = 2;
      isMatchCheck = true;
    }
  } else if ((isMatch(previousWord, nextWord))) {
    minChar = 1;
    isMatchCheck = true;
  }

  if (isMatchCheck) {
    if (!isHiragana(nextWord)) {
      return new Response(
        JSON.stringify({
          "errorMessage": "ひらがな以外の文字は使えません",
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

    if (nextWord.length === minChar) {
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

    if (isUsedWord(previousWord, nextWord)) {
      return new Response(
        JSON.stringify({
          "errorMessage": "過去に使用した単語は使えません",
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

    // 同一であれば、wordHistoriesを更新
    wordHistories.push(previousWord);
  } // 同一でない単語の入力時に、エラーを返す
  else {
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

  // 現在の単語を返す
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
    // request.methodとpathnameを確認
    if (request.method === "POST" && pathname === "/reset") {

      // 既存の単語の履歴を初期化する
      // 初期化した単語を返す
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
