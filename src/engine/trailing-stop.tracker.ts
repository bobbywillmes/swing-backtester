import { TrailingStopState } from "../types/engine.types.js";

export function initializeTrailingStopState(
  entryPrice: number
): TrailingStopState {
  return {
    entryPrice,
    runningHigh: entryPrice,
    trailActive: false,
    trailFloor: entryPrice, // Will be recalculated on first update if trailingStopPct is set
    targetUnlocked: false, // Set to true when target is hit in "unlock trail" mode
  };
}

export function updateTrailingStopState(
  state: TrailingStopState,
  barHigh: number,
  trailingStopPct: number | null,
  trailActivateAfterPct: number | null
): TrailingStopState {
  // Update running high
  const newRunningHigh = Math.max(state.runningHigh, barHigh);

  // Check if trailing stop should activate (from price gain OR from target unlock)
  const unrealizedGainPct = (newRunningHigh - state.entryPrice) / state.entryPrice;
  const activateThreshold = trailActivateAfterPct ?? 0;
  const shouldActivate = unrealizedGainPct >= activateThreshold || state.targetUnlocked;
  const newTrailActive = state.trailActive || shouldActivate;

  // Recalculate trail floor if trailing stop is configured
  let newTrailFloor = state.trailFloor;
  if (trailingStopPct !== null && newTrailActive) {
    newTrailFloor = newRunningHigh * (1 + trailingStopPct);
  }

  return {
    entryPrice: state.entryPrice,
    runningHigh: newRunningHigh,
    trailActive: newTrailActive,
    trailFloor: newTrailFloor,
    targetUnlocked: state.targetUnlocked,
  };
}

export function getTrailActivationPrice(
  entryPrice: number,
  trailActivateAfterPct: number | null
): number {
  const threshold = trailActivateAfterPct ?? 0;
  return entryPrice * (1 + threshold);
}
