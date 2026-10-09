import type { LayoutOptions } from '@/lib/flowLayout';

export const FLOW_NODE_WIDTH = 168;
export const FLOW_NODE_HEIGHT = 60;
export const FLOW_LAYOUT: LayoutOptions = {
  nodeWidth: FLOW_NODE_WIDTH,
  nodeHeight: FLOW_NODE_HEIGHT,
};
export const MAX_FLOW_NODES = 500;
export const MAX_FLOW_DEPTH = 100;
export const MAX_PARENT_HOPS = 100;
export const DEMO_FLOW_ROOT = 'flow-order-9a3f';

// Node chrome per state, on the job-state tokens (index.css). `waiting-children` reads as
// waiting; the dashed border keeps it distinguishable from a plain waiting job.
const STATE_STYLE: Record<string, string> = {
  completed: 'border-state-completed-fg/50 bg-state-completed-bg text-state-completed-fg',
  failed: 'border-state-failed-fg/50 bg-state-failed-bg text-state-failed-fg',
  active: 'border-state-active-fg/50 bg-state-active-bg text-state-active-fg',
  delayed: 'border-state-delayed-fg/50 bg-state-delayed-bg text-state-delayed-fg',
  waiting: 'border-state-waiting-fg/50 bg-state-waiting-bg text-state-waiting-fg',
  prioritized: 'border-state-prioritized-fg/50 bg-state-prioritized-bg text-state-prioritized-fg',
  'waiting-children':
    'border-dashed border-state-waiting-fg/60 bg-state-waiting-bg text-state-waiting-fg',
};

export const flowStateStyle = (state?: string) =>
  (state && STATE_STYLE[state]) || 'border-line bg-surface-2 text-muted';

export const shortFlowId = (id: string) =>
  id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
