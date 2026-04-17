export function createPlayer(dungeon) {
  if (!dungeon) {
    return { x: 1, y: 1 };
  }

  const walkableTiles = [];

  for (let y = 0; y < dungeon.length; y++) {
    for (let x = 0; x < dungeon[y].length; x++) {
      if (dungeon[y][x] === 0) {
        walkableTiles.push({ x, y });
      }
    }
  }

  if (walkableTiles.length === 0) {
    return { x: 1, y: 1 };
  }

  return walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
}

export function movePlayer(player, dx, dy, dungeon) {
  const newX = player.x + dx;
  const newY = player.y + dy;

  if (dungeon[newY][newX] === 0) {
    player.x = newX;
    player.y = newY;
  }
}
