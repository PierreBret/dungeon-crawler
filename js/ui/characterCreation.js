export function drawCharacterCreation(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "20px Arial";

  ctx.fillText("CREATION DU PERSONNAGE", 20, 50);

  ctx.fillText("Appuie sur ENTER pour créer un personnage", 20, 120);
}
