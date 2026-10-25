const magicWordElement = document.getElementById("magic-word") as HTMLDivElement;

const applyButtonElement = document.getElementById("apply-button") as HTMLButtonElement;
const participateButtonElement = document.getElementById("participate-button") as HTMLButtonElement;

applyButtonElement.addEventListener("click", () => {
  const magicWord = magicWordElement.innerText;
});

participateButtonElement.addEventListener("click", () => {
  const magicWord = magicWordElement.innerText;
});
