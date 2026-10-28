const userNameElement = document.getElementById("user-name") as HTMLInputElement;
const magicWordElement = document.getElementById("magic-word") as HTMLInputElement;
const startButtonElement = document.getElementById("start-button") as HTMLButtonElement;
const applyButtonElement = document.getElementById("apply-button") as HTMLButtonElement;
const participateButtonElement = document.getElementById("participate-button") as HTMLButtonElement;

if (!userNameElement || !magicWordElement || !startButtonElement || !applyButtonElement || !participateButtonElement) {
  throw new Error("mode-select elements are not found");
}

async function joinRoom(isHost: boolean) {
  const userName = userNameElement.value.trim();
  const magicWord = magicWordElement.value.trim();

  if (!userName) {
    alert("ユーザー名を入力してください");
    return;
  }
  if (magicWord.length < 5 || magicWord.length > 50) {
    alert("あいことばは5〜50文字で入力してください");
    return;
  }

  const response = await fetch("/standby", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, magicWord, isHost }),
  });
  const result = await response.json();
  if (!response.ok) {
    alert(result.errorMessage ?? "ルーム参加に失敗しました");
    return;
  }

  const params = new URLSearchParams({
    roomId: result.roomId,
    userName,
    isHost: String(isHost),
  });
  globalThis.location.href = `/public/standby/?${params.toString()}`;
}

applyButtonElement.addEventListener("click", () => void joinRoom(true));
participateButtonElement.addEventListener("click", () => void joinRoom(false));
