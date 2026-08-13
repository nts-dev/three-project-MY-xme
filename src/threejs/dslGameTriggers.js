export const DSL_COMMAND_REQUESTED = "dsl-command-requested";
export const DSL_GAME_TRIGGER = "dsl-game-trigger";

export function requestDslCommand(command, payload = {}) {
  if (typeof window === "undefined" || !command) return;
  
  window.dispatchEvent(new CustomEvent(DSL_COMMAND_REQUESTED, {
    detail: {
      command,
      payload,
      createdAt: Date.now(),
    },
  }));
}

export function dispatchGameTrigger(type, payload = {}) {
  if (typeof window === "undefined" || !type) return;
  window.dispatchEvent(new CustomEvent(DSL_GAME_TRIGGER, {
    detail: {
      type,
      payload,
      createdAt: Date.now(),
    },
  }));
}
