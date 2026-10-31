import type { ErrorResponse, PostStandbyResponse, RoomRules } from "../../shared/types.js";

const userNameInputElement = document.getElementById("profile-name-input") as HTMLInputElement;

const nCheckboxElement = document.getElementById("n-checkbox") as HTMLInputElement;
const singleSoundCheckboxElement = document.getElementById("single-sound-checkbox") as HTMLInputElement;
const singleSoundLoseCheckboxElement = document.getElementById("single-sound-lose-checkbox") as HTMLInputElement;
const oneTimeCheckboxElement = document.getElementById("one-time-checkbox") as HTMLInputElement;
const oneTimeLoseCheckboxElement = document.getElementById("one-time-lose-checkbox") as HTMLInputElement;
const timeLimitCheckboxElement = document.getElementById("time-limit-checkbox") as HTMLInputElement;
const timeLimitInputElement = document.getElementById("time-limit-input") as HTMLInputElement;

const magicWordContainerElement = document.getElementById("magic-word-container") as HTMLElement;
const magicWordInputElement = document.getElementById("magic-word-input") as HTMLInputElement;

const backButtonElement = document.getElementById("back-button") as HTMLButtonElement;
const soloGameContainerElement = document.getElementById("solo-game-container") as HTMLElement;
const friendGameContainerElement = document.getElementById("friend-game-container") as HTMLElement;

const startButtonElement = document.getElementById("start-button") as HTMLButtonElement;
const applyButtonElement = document.getElementById("apply-button") as HTMLButtonElement;
const participateButtonElement = document.getElementById("participate-button") as HTMLButtonElement;

const errorMessageElement = document.getElementById("error-message") as HTMLElement;
const errorLocationElement = document.getElementById("error-location") as HTMLElement;

function getRoomRules(): RoomRules | null {
  const timeLimitSeconds = Number(timeLimitInputElement.value);
  if (!Number.isInteger(timeLimitSeconds) || timeLimitSeconds < 1 || timeLimitSeconds > 60) {
    alert("制限時間は1〜60秒で入力してください");
    return null;
  }
  if (singleSoundLoseCheckboxElement.checked && !singleSoundCheckboxElement.checked) {
    alert("一音の単語を使うと負けを有効にするには、一音の単語を使えない設定が必要です");
    return null;
  }
  if (oneTimeLoseCheckboxElement.checked && !oneTimeCheckboxElement.checked) {
    alert("一回使った単語を使うと負けを有効にするには、一回使った単語を使えない設定が必要です");
    return null;
  }

  return {
    n: nCheckboxElement.checked,
    singleSound: singleSoundCheckboxElement.checked,
    singleSoundLose: singleSoundLoseCheckboxElement.checked,
    oneTime: oneTimeCheckboxElement.checked,
    oneTimeLose: oneTimeLoseCheckboxElement.checked,
    timeLimit: timeLimitCheckboxElement.checked,
    timeLimitSeconds,
  };
}

async function joinRoom(isHost: boolean) {
  const userName = userNameInputElement.value.trim() || "Guest";
  const magicWord = magicWordInputElement.value.trim();
  const roomRules = isHost ? getRoomRules() : null;

  if (magicWord.length < 5 || magicWord.length > 50) {
    alert("あいことばは5〜50文字で入力してください");
    return;
  }
  if (isHost && !roomRules) return;

  const response = await fetch("/standby", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, magicWord, isHost, ...(roomRules ? { roomRules } : {}) }),
  });

  if (!response.ok) {
    const result = await response.json() as ErrorResponse;
    errorMessageElement.textContent = result.errorMessage;
    errorLocationElement.textContent = result.errorLocation;
    return;
  }

  const result = await response.json() as PostStandbyResponse;

  if (result.isFull) {
    alert("ルームが満員です");
    return;
  }

  if (!result.hasRoom && !isHost) {
    if (globalThis.confirm("ルームが存在しません。新しく作成しますか？")) {
      await joinRoom(true);
    }
    return;
  }
  if (result.hasRoom && isHost) {
    if (globalThis.confirm("ルームが既に存在します。参加しますか？")) {
      await joinRoom(false);
    }
    return;
  }

  const params = new URLSearchParams({
    "room-id": result.roomId as string,
    "user-name": userName,
    "is-host": String(isHost),
  });
  globalThis.location.href = `/standby/?${params.toString()}`;
}

async function startSoloGame() {
  const userName = userNameInputElement.value.trim() || "Guest";
  const roomRules = getRoomRules();
  if (!roomRules) return;

  const standbyResponse = await fetch("/standby", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, isHost: true, isSolo: true, roomRules }),
  });

  if (!standbyResponse.ok) {
    const result = await standbyResponse.json() as ErrorResponse;
    errorMessageElement.textContent = result.errorMessage;
    errorLocationElement.textContent = result.errorLocation;
    return;
  }

  const standbyResult = await standbyResponse.json() as PostStandbyResponse;
  if (!standbyResult.roomId) {
    errorMessageElement.textContent = "ルームIDが取得できませんでした";
    errorLocationElement.textContent = "startSoloGame";
    return;
  }

  const startResponse = await fetch("/start-room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: standbyResult.roomId,
      userName,
      isSolo: true,
      roomRules,
    }),
  });

  if (!startResponse.ok) {
    const result = await startResponse.json() as ErrorResponse;
    errorMessageElement.textContent = result.errorMessage;
    errorLocationElement.textContent = result.errorLocation;
    return;
  }

  const params = new URLSearchParams({
    "room-id": standbyResult.roomId as string,
    "user-name": userName,
    "is-host": "true",
  });
  globalThis.location.href = `/game/?${params.toString()}`;
}

globalThis.onload = () => {
  const params = new URLSearchParams(globalThis.location.search);
  const isSolo = params.get("is-solo");
  if (isSolo === "false") {
    magicWordContainerElement.hidden = false;
    soloGameContainerElement.hidden = true;
    friendGameContainerElement.hidden = false;
  }
  else {
    magicWordContainerElement.hidden = true;
    soloGameContainerElement.hidden = false;
    friendGameContainerElement.hidden = true;
  }
};
singleSoundLoseCheckboxElement.addEventListener("change", () => {
  if (singleSoundLoseCheckboxElement.checked) {
    singleSoundCheckboxElement.checked = true;
  }
  singleSoundCheckboxElement.disabled = singleSoundLoseCheckboxElement.checked;
});
oneTimeLoseCheckboxElement.addEventListener("change", () => {
  if (oneTimeLoseCheckboxElement.checked) {
    oneTimeCheckboxElement.checked = true;
  }
  oneTimeCheckboxElement.disabled = oneTimeLoseCheckboxElement.checked;
});

backButtonElement.addEventListener("click", () => {
  globalThis.location.href = "/";
});
startButtonElement.addEventListener("click", () => void startSoloGame());
applyButtonElement.addEventListener("click", () => void joinRoom(true));
participateButtonElement.addEventListener("click", () => void joinRoom(false));
