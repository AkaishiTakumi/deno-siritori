import { serveDir } from "@std/http";

// 直前の単語を保持しておく
const wordHistories: string[] = [];

// localhostにDenoのHTTPサーバーを展開
export function startServer() {

  Deno.serve({ port: 8000 }, async (request) => {
    // パス名を取得する
    const pathname = new URL(request.url).pathname;

    // GET /shiritori: 直前の単語を返す
    if (request.method === "GET" && pathname === "/shiritori") {

      return new Response(
        wordHistories.slice(-1)[0]
          ? wordHistories.slice(-1)[0]
          : "しりとり",
      );

    }

    // POST /shiritori: 次の単語を受け取って保存する
    if (request.method === "POST" && pathname === "/shiritori") {

      // リクエストのペイロードを取得
      const requestJson = await request.json();
      // JSONの中からnextWordを取得
      const nextWord = requestJson["nextWord"];
      const previousWord = requestJson["previousWord"];

      let minChar;
      let matchCheck = false;

      // wordHistoriesの末尾2文字とnextWordの先頭2文字が同一か確認
      if (
        /[ぁぃぅぇぉっゃゅょゎ]$/.test(previousWord)
      ) {
        if (previousWord.slice(-2) === nextWord.slice(0, 2)) {
          // 小音が末尾の場合は2文字以下を禁止
          minChar = 2;

          matchCheck = true;
        } // wordHistoriesの末尾とnextWordの先頭が同一か確認
      } else if (
        previousWord.slice(-1) === nextWord.slice(0, 1)
      ) {
        // 通常文字数は1文字以下を禁止
        minChar = 1;

        matchCheck = true;
      }

      //
      if (matchCheck) {
        // ひらがな以外が入力された場合
        if (!/^[ぁ-んー]+$/.test(nextWord)) {
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

        // 一文字の単語を入力した場合
        if (nextWord.length === minChar) {
          return new Response(
            JSON.stringify({
              "errorMessage": "一文字の単語は使えません",
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

        // 過去に使用した単語になっている場合
        if (wordHistories.includes(nextWord) || previousWord === nextWord) {
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

        // 末尾が「ん」になっている場合
        // ifの中に入力された単語の末尾が「ん」になっていることを確認する条件式を追加
        if (nextWord.slice(-1) === "ん") {
          // エラーを返す処理を追加
          // errorCodeを固有のものにして、末尾が「ん」の時に発生したエラーだとWeb側に通知できるようにする
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

    // ./public以下のファイルを公開
    return serveDir(
      request,
      {
        /*
        - fsRoot: 公開するフォルダを指定
        - urlRoot: フォルダを展開するURLを指定。今回はlocalhost:8000/に直に展開する
        - enableCors: CORSの設定を付加するか
        */
        fsRoot: "./public/",
        urlRoot: "",
        enableCors: true,
      },
    );
  });
};
