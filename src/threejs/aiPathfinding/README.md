# AI Pathfinding

Small A* pathfinding helpers for game projects. The core files are pure logic, while `AIChaserDebug` is a React Three Fiber visual test that draws a red dot and red path line toward the player/avatar.

```jsx
import { AIChaserDebug, GridGraph } from "./aiPathfinding";

const graph = new GridGraph({
  width: 80,
  depth: 80,
  cellSize: 1,
  walkable: (node, worldPosition) => true,
});

<AIChaserDebug graph={graph} avatarRef={playerRef} speed={3} />;
```

Performance notes:

- Repaths are throttled with `repathMs`.
- A* only reruns after the target moves by `targetMoveThreshold`.
- `maxIterations` caps worst-case search work.
- Movement updates every frame, but path search does not.
