import type { ErrorResponse, GetRoomStatusResponse } from "../../shared/types.js";

const params = new URLSearchParams(globalThis.location.search);
const roomId = params.get("room-id");
const isHost = params.get("is-host") === "true";
const userName = params.get("user-name") ?? "Guest";

const magicWordElement = document.getElementById("magic-word") as HTMLElement;
const playerListElement = document.getElementById("player-list") as HTMLElement;
const numberOfPlayersElement = document.getElementById("number-of-players") as HTMLElement;

const startElement = document.getElementById("start-button") as HTMLButtonElement;

const errorMessageElement = document.getElementById("error-message") as HTMLElement;
const errorLocationElement = document.getElementById("error-location") as HTMLElement;

async function updateRoom() {
  if (!roomId) {
    throw new Error("roomId が設定されていません");
  }
  const response = await fetch(`/room-status?room-id=${encodeURIComponent(roomId)}`, { method: "GET" });

  if (!response.ok) {
    const result = await response.json() as ErrorResponse;
    errorMessageElement.textContent = result.errorMessage;
    errorLocationElement.textContent = result.errorLocation;
    return;
  }

  const result = await response.json() as GetRoomStatusResponse;

  magicWordElement.textContent = result.magicWord;
  numberOfPlayersElement.textContent = `${result.members.length}/${result.maxPlayers}人`;
  playerListElement.textContent = "";
  for (const member of result.members) {
    const element = document.createElement("div");
    element.textContent = member;
    playerListElement.appendChild(element);
  }

  startElement.disabled = !isHost || result.members.length < result.minPlayers;
  if (result.isStarted) {
    globalThis.window.location.href =
      `/game/?room-id=${encodeURIComponent(roomId)}&user-name=${encodeURIComponent(userName)}`;
  }
}

startElement.addEventListener("click", async () => {
  if (!isHost) {
    alert("ホストのみ開始できます");
    return;
  }
  if (!roomId) {
    throw new Error("roomId が設定されていません");
  }
  if (!userName) {
    throw new Error("userName が設定されていません");
  }
  const response = await fetch("/start-room", {
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
  globalThis.window.location.href =
    `/game/?room-id=${encodeURIComponent(roomId)}&user-name=${encodeURIComponent(userName)}`;
});

globalThis.onload = () => {
  startElement.hidden = !isHost;
};

updateRoom();
globalThis.setInterval(() => void updateRoom(), 2000);
