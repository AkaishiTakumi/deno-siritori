// 前の単語を保持する変数
let previousWord: string;

const nextWordSendButtonElement = document.querySelector("#nextWordSendButton") as HTMLButtonElement;

const resetSendButtonElement = document.querySelector("#resetSendButton") as HTMLButtonElement;

window.onload = async (_) => {
  // GET /shiritoriを実行
  const response = await fetch("/shiritori", { method: "GET" });
  // responseの中からレスポンスのテキストデータを取得
  previousWord = await response.text();
  // id: previousWordのタグを取得
  const paragraph = document.querySelector("#previousWord") as HTMLElement;
  // 取得したタグの中身を書き換える
  paragraph.innerHTML = `前の単語: ${previousWord}`;
};

// 送信ボタンの押下時に実行
nextWordSendButtonElement.onclick = async (_) => {
  // inputタグを取得
  const nextWordInput = document.querySelector("#nextWordInput") as HTMLInputElement;
  // inputの中身を取得
  const nextWordInputText = nextWordInput.value;

  // POST /shiritoriを実行
  // 次の単語をresponseに格納
  const response = await fetch(
    "/shiritori",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "previousWord": previousWord,
        "nextWord": nextWordInputText,
      }),
    },
  );

  // status: 200以外が返ってきた場合にエラーを表示
  if (response.status !== 200) {
    const responseJson = await response.json();
    // errorCodeが、末尾が「ん」の時のエラーだったら、ゲームを終了する
    if (responseJson["errorCode"] === "10002") {
      alert("ゲーム終了");

      // inputタグと送信ボタンを無効化する
      nextWordInput.disabled = true;
      nextWordSendButtonElement.disabled = true;
    } // errorCodeが、過去に使用した単語の時のエラーだったら、ゲームを終了する
    else if (responseJson["errorCode"] === "10003") {
      alert("ゲーム終了");

      // inputタグと送信ボタンを無効化する
      nextWordInput.disabled = true;
      nextWordSendButtonElement.disabled = true;
    } else {
      alert(responseJson["errorMessage"]);
    }
    return;
  }

  const responseJson = await response.json();

  // id: previousWordのタグを取得
  const paragraph = document.querySelector("#previousWord") as HTMLElement;

  // previousWordを更新
  previousWord = responseJson["previousWord"];

  // 取得したタグの中身を書き換える
  paragraph.innerHTML = `前の単語: ${previousWord}`;

  // inputタグの中身を消去する
  nextWordInput.value = "";
};

// 送信ボタンの押下時に実行
resetSendButtonElement.onclick = async (_) => {
  // POST /resetを実行
  await fetch("/reset", { method: "POST" });
  // ページをリロードする
  location.reload();
};
