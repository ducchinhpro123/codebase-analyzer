export const GRAPH_DRAG_THRESHOLD = 8;

export function shouldStartGraphDrag(deltaX: number, deltaY: number) {
  return Math.hypot(deltaX, deltaY) >= GRAPH_DRAG_THRESHOLD;
}
