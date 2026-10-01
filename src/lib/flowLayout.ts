/**
 * Pure layered (Sugiyama-lite) layout for a job-flow DAG. No rendering, no React,
 * no external deps, so it is unit-testable in isolation. Each edge `from -> to`
 * means `to` sits at least one layer after `from` (a child, or a dependency
 * consumer). Nodes are placed in columns by layer (left to right) and stacked
 * vertically within each column, then every column is centred.
 *
 * Cycle-safe: a genuine cycle (which a job DAG should never contain, but a
 * corrupt/looping `dependsOn` could) can't starve the queue — a depth-first pass
 * (input order) drops only the back-edges that close a cycle before layering,
 * so every remaining edge, including ones into or out of the cycle, still puts
 * its target in a later column.
 */
export type FlowEdgeKind = 'child' | 'depends';
export interface FlowEdge {
  from: string;
  to: string;
  kind: FlowEdgeKind;
}
export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  layer: number;
}
export interface FlowLayout {
  nodes: PositionedNode[];
  width: number;
  height: number;
}

export interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  colGap?: number;
  rowGap?: number;
  padding?: number;
}

const DEFAULTS = { nodeWidth: 168, nodeHeight: 60, colGap: 72, rowGap: 20, padding: 24 };

/**
 * Compute the layer of every node via longest-path (Kahn's algorithm on the DAG,
 * relaxing `layer[to] = max(layer[to], layer[from] + 1)`). Returns a layer index
 * for each id; ids not present in any edge stay at layer 0.
 */
export function computeLayers(ids: string[], edges: FlowEdge[]): Map<string, number> {
  const layer = new Map<string, number>();
  const targets = new Map<string, string[]>();
  for (const id of ids) {
    layer.set(id, 0);
    targets.set(id, []);
  }
  for (const e of edges) {
    if (!layer.has(e.from) || !layer.has(e.to) || e.from === e.to) continue;
    targets.get(e.from)?.push(e.to);
  }
  const out = withoutBackEdges(ids, targets);
  const indeg = new Map<string, number>();
  for (const id of ids) indeg.set(id, 0);
  for (const list of out.values()) {
    for (const to of list) indeg.set(to, (indeg.get(to) ?? 0) + 1);
  }
  // The remaining graph is acyclic, so Kahn's algorithm places every node.
  const queue = [...layer.keys()].filter((id) => (indeg.get(id) ?? 0) === 0);
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head];
    for (const v of out.get(u) ?? []) {
      layer.set(v, Math.max(layer.get(v) ?? 0, (layer.get(u) ?? 0) + 1));
      const d = (indeg.get(v) ?? 0) - 1;
      indeg.set(v, d);
      if (d === 0) queue.push(v);
    }
  }
  return layer;
}

/**
 * Iterative DFS (input order, so deep flows cannot overflow the call stack) that
 * keeps every edge except back-edges — edges into a node still on the DFS stack,
 * i.e. exactly the edges that close a cycle. Forcing a cyclic node ready instead
 * would ignore all of its incoming edges, including acyclic prerequisites.
 */
function withoutBackEdges(ids: string[], targets: Map<string, string[]>): Map<string, string[]> {
  const kept = new Map<string, string[]>();
  for (const id of ids) kept.set(id, []);
  const onStack = new Set<string>();
  const visited = new Set<string>();
  for (const root of ids) {
    if (visited.has(root)) continue;
    visited.add(root);
    onStack.add(root);
    const stack: Array<{ id: string; next: number }> = [{ id: root, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const list = targets.get(frame.id) ?? [];
      if (frame.next >= list.length) {
        onStack.delete(frame.id);
        stack.pop();
        continue;
      }
      const to = list[frame.next++];
      if (onStack.has(to)) continue;
      kept.get(frame.id)?.push(to);
      if (visited.has(to)) continue;
      visited.add(to);
      onStack.add(to);
      stack.push({ id: to, next: 0 });
    }
  }
  return kept;
}

/** Lay the DAG out in columns (one per layer), each column vertically centred. */
export function layoutDag(
  ids: string[],
  edges: FlowEdge[],
  options: LayoutOptions = {}
): FlowLayout {
  const o = { ...DEFAULTS, ...options };
  const layer = computeLayers(ids, edges);

  // Group node ids by layer, preserving input order for stable placement.
  const byLayer = new Map<number, string[]>();
  let maxLayer = 0;
  for (const id of ids) {
    const l = layer.get(id) ?? 0;
    maxLayer = Math.max(maxLayer, l);
    const arr = byLayer.get(l);
    if (arr) arr.push(id);
    else byLayer.set(l, [id]);
  }

  let tallest = 0;
  for (const arr of byLayer.values()) tallest = Math.max(tallest, arr.length);
  const colHeight = tallest * o.nodeHeight + Math.max(0, tallest - 1) * o.rowGap;

  const nodes: PositionedNode[] = [];
  for (let l = 0; l <= maxLayer; l++) {
    const arr = byLayer.get(l) ?? [];
    const thisHeight = arr.length * o.nodeHeight + Math.max(0, arr.length - 1) * o.rowGap;
    const startY = o.padding + (colHeight - thisHeight) / 2;
    arr.forEach((id, i) => {
      nodes.push({
        id,
        layer: l,
        x: o.padding + l * (o.nodeWidth + o.colGap),
        y: startY + i * (o.nodeHeight + o.rowGap),
      });
    });
  }

  const width = o.padding * 2 + (maxLayer + 1) * o.nodeWidth + maxLayer * o.colGap;
  const height = o.padding * 2 + colHeight;
  return { nodes, width, height };
}
