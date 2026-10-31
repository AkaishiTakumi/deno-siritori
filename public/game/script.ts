import type { ErrorResponse, GetRoomStatusResponse, PostResetResponse, PostSiritoriResponse, PreviousWordResponse, RoomRules } from "../../shared/types";

const params = new URLSearchParams(globalThis.location.search);
const roomId = params.get("room-id");
const userName = params.get("user-name") ?? "Guest";

const paragraph = document.getElementById("previous-word") as HTMLElement;

const nextWordSendButtonElement = document.getElementById("next-word-send-button") as HTMLButtonElement;
const resetSendButtonElement = document.getElementById("reset-send-button") as HTMLButtonElement;

const errorMessageElement = document.getElementById("error-message") as HTMLElement;
const errorLocationElement = document.getElementById("error-location") as HTMLElement;

let previousWord = "";
let currentTurn: string | null = null;
let isActive = true;
let turnStartedAt: string | null = null;
let roomRules: RoomRules | null = null;

function updateViewState() {
  const nextWordInput = document.getElementById("next-word-input") as HTMLInputElement;
  let remainingSeconds: number | null = null;
  if (roomRules?.timeLimit && turnStartedAt) {
    remainingSeconds = Math.max(
      0,
      roomRules.timeLimitSeconds - Math.floor((Date.now() - new Date(turnStartedAt).getTime()) / 1000),
    );
    if (remainingSeconds === 0) isActive = false;
  }
  const canPlay = isActive && (currentTurn === null || currentTurn === userName);
  const timeLimitText = remainingSeconds === null ? "" : ` / 残り時間: ${remainingSeconds}秒`;
  paragraph.textContent = `前の単語: ${previousWord} / 現在のターン: ${currentTurn === userName ? "あなたのターン" : currentTurn ?? "取得中..."}${timeLimitText}`;
  nextWordInput.disabled = !canPlay;
  nextWordSendButtonElement.disabled = !canPlay;
}

async function updateRoomState() {
  if (!roomId) return;
  const response = await fetch(`/room-status?room-id=${encodeURIComponent(roomId)}`);
  if (!response.ok) {
    const result = await response.json() as ErrorResponse;
    errorMessageElement.textContent = result.errorMessage;
    errorLocationElement.textContent = result.errorLocation;
    return;
  };
  const result = await response.json() as GetRoomStatusResponse;
  if (result.shouldRejoin) {
    globalThis.location.href = "/mode-select/";
    return;
  }
  previousWord = result.previousWord;
  currentTurn = result.currentTurn ?? null;
  isActive = result.isActive;
  turnStartedAt = result.turnStartedAt;
  roomRules = result.roomRules;
  updateViewState();
}

globalThis.onload = async (_) => {

  if (!roomId) {
    errorMessageElement.textContent = "roomId が設定されていません";
    return;
  }
  const response = await fetch(`/siritori?room-id=${encodeURIComponent(roomId)}`, { method: "GET" });

  if (!response.ok) {
    const result = await response.json() as ErrorResponse;
    errorMessageElement.textContent = result.errorMessage;
    errorLocationElement.textContent = result.errorLocation;
    return;
  }

  const result = await response.json() as PreviousWordResponse;
  previousWord = result.previousWord;
  paragraph.innerHTML = `前の単語: ${previousWord} / 現在のターン: ${currentTurn === userName ? "あなたのターン" : currentTurn ?? "取得中..."}`;;
  await updateRoomState();

};

nextWordSendButtonElement.onclick = async (_) => {

  const nextWordInput = document.getElementById("next-word-input") as HTMLInputElement;
  const nextWordInputText = nextWordInput.value;

  if (!isActive) return;

  const response = await fetch(
    "/siritori",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "roomId": roomId,
        "userName": userName,
        "previousWord": previousWord,
        "nextWord": nextWordInputText,
      }),
    },
  );

  if (!response.ok) {
    const result = await response.json() as ErrorResponse;
    errorMessageElement.textContent = result.errorMessage;
    errorLocationElement.textContent = result.errorLocation;
    return;
  }

  const result = await response.json() as PostSiritoriResponse;
  if (result.isFoul) {

    if (result.foulCode === "nnEndWord") {

      alert("ゲーム終了");

      nextWordInput.disabled = true;
      nextWordSendButtonElement.disabled = true;

    }
    else if (result.foulCode === "usedWord") {

      alert("ゲーム終了");

      nextWordInput.disabled = true;
      nextWordSendButtonElement.disabled = true;

    }
    else {
      alert(result.foulMessage);
    }
    return;
  }

  previousWord = result.previousWord as string;
  currentTurn = result.currentTurn ?? null;
  paragraph.innerHTML = `前の単語: ${previousWord} / 現在のターン: ${currentTurn === userName ? "あなたのターン" : currentTurn ?? "取得中..."}`;

  nextWordInput.value = "";
  await updateRoomState();
};

resetSendButtonElement.onclick = async (_) => {

  const response = await fetch("/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, userName }),
  });
  if (!response.ok) {
    const result = await response.json() as ErrorResponse;
    errorMessageElement.textContent = result.errorMessage;
    errorLocationElement.textContent = result.errorLocation;
    return;
  }

  const result = await response.json() as PostResetResponse;
  if (result.shouldRejoin) {
    globalThis.location.href = "/mode-select/";
    return;
  }

  await updateRoomState();

};

globalThis.setInterval(() => {
  updateViewState();
  void updateRoomState();
}, 1000);
