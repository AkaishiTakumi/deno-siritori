const params = new URLSearchParams(globalThis.location.search);
const roomId = params.get("room-id");
const isHost = params.get("is-host") === "true";

if (!roomId) {
  throw new Error("roomId が設定されていません");
}

const magicWordElement = document.getElementById("magic-word") as HTMLElement;
const playerListElement = document.getElementById("player-list") as HTMLElement;
const numberOfPlayersElement = document.getElementById("number-of-players") as HTMLElement;

const startElement = document.getElementById("start-button") as HTMLDivElement;

if (!magicWordElement || !playerListElement || !numberOfPlayersElement) {
  throw new Error("standby elements are not found");
}

async function updateRoom() {
  if (!roomId) {
    throw new Error("roomId が設定されていません");
  }
  const response = await fetch(`/room-status?room-id=${encodeURIComponent(roomId)}`);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.errorMessage ?? "ルーム情報の取得に失敗しました");
  }

  magicWordElement.textContent = result.magicWord;
  numberOfPlayersElement.textContent = `${result.numberOfPlayers}人`;
  playerListElement.textContent = "";
  for (const member of result.members as string[]) {
    const element = document.createElement("div");
    element.textContent = member;
    playerListElement.append(element);
  }
}

if (startElement) {
  startElement.addEventListener("click", () => {
    if (!isHost) {
      alert("ホストのみ開始できます");
      return;
    }
    globalThis.window.location.href = `/public/game/?room-id=${encodeURIComponent(roomId)}`;
  });
}

await updateRoom();
globalThis.setInterval(() => void updateRoom(), 2000);
