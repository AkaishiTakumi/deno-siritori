const soloPlayButton = document.getElementById("solo-play-button") as HTMLButtonElement;
const friendPlayButton = document.getElementById("friend-play-button") as HTMLButtonElement;
// const anywherePlayButton = document.getElementById("anywhere-play-button") as HTMLButtonElement;

soloPlayButton.addEventListener("click", () => {
  globalThis.location.href = "/mode-select/?is-solo=true";
});

friendPlayButton.addEventListener("click", () => {
  globalThis.location.href = "/mode-select/?is-solo=false";
});

// anywherePlayButton.addEventListener("click", () => {
//   globalThis.location.href = "/mode-select/";
// });
