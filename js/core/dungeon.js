export function generateDungeon(rows, cols, extraPath) {
  const dungeon = Array.from({ length: rows }, () => Array(cols).fill(1));

  if (rows < 3 || cols < 3) {
    return dungeon;
  }

  const startX = 1;
  const startY = 1;
  dungeon[startY][startX] = 0;

  const stack = [{ x: startX, y: startY }];
  const directions = [
    { dx: 2, dy: 0 },
    { dx: -2, dy: 0 },
    { dx: 0, dy: 2 },
    { dx: 0, dy: -2 },
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = [];

    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && dungeon[ny][nx] === 1) {
        neighbors.push({ x: nx, y: ny, between: { x: current.x + dx / 2, y: current.y + dy / 2 } });
      }
    }

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    dungeon[next.between.y][next.between.x] = 0;
    dungeon[next.y][next.x] = 0;
    stack.push({ x: next.x, y: next.y });
  }

  // Add extra passages to create more paths and crossroads
  const extraPassages = Math.floor((rows * cols) * extraPath);
  for (let i = 0; i < extraPassages; i++) {
    const x = Math.floor(Math.random() * (cols - 2)) + 1;
    const y = Math.floor(Math.random() * (rows - 2)) + 1;
    if (dungeon[y][x] === 1) {
      const adjacentPaths = [];
      if (x > 1 && dungeon[y][x - 2] === 0) adjacentPaths.push({ x: x - 1, y });
      if (x < cols - 2 && dungeon[y][x + 2] === 0) adjacentPaths.push({ x: x + 1, y });
      if (y > 1 && dungeon[y - 2][x] === 0) adjacentPaths.push({ x, y: y - 1 });
      if (y < rows - 2 && dungeon[y + 2][x] === 0) adjacentPaths.push({ x, y: y + 1 });

      if (adjacentPaths.length >= 2) {
        const candidateOpens = [{ x, y }, ...adjacentPaths];
        if (canCarveWithoutLargeRoom(dungeon, candidateOpens)) {
          dungeon[y][x] = 0;
          for (const pos of adjacentPaths) {
            dungeon[pos.y][pos.x] = 0;
          }
        }
      }
    }
  }

  return dungeon;
}

function canCarveWithoutLargeRoom(dungeon, newOpens) {
  const rows = dungeon.length;
  const cols = dungeon[0].length;
  const simulated = new Set(newOpens.map((pos) => `${pos.x},${pos.y}`));

  const isOpen = (x, y) => {
    if (x < 1 || x >= cols - 1 || y < 1 || y >= rows - 1) {
      return false;
    }
    return dungeon[y][x] === 0 || simulated.has(`${x},${y}`);
  };

  const forbiddenRects = [
    { width: 3, height: 3 },
    { width: 4, height: 2 },
    { width: 2, height: 4 },
  ];

  for (const pos of newOpens) {
    for (const rect of forbiddenRects) {
      for (let startX = pos.x - rect.width + 1; startX <= pos.x; startX += 1) {
        for (let startY = pos.y - rect.height + 1; startY <= pos.y; startY += 1) {
          let fullOpen = true;
          for (let xx = startX; xx < startX + rect.width; xx += 1) {
            for (let yy = startY; yy < startY + rect.height; yy += 1) {
              if (!isOpen(xx, yy)) {
                fullOpen = false;
                break;
              }
            }
            if (!fullOpen) {
              break;
            }
          }
          if (fullOpen) {
            return false;
          }
        }
      }
    }
  }

  return true;
}

export function isWalkable(dungeon, x, y) {
  return dungeon[y][x] === 0;
}
