import { matchPath } from 'react-router-dom';
import {
  IconAlerts,
  IconArrowRight,
  IconCron,
  IconDatabase,
  IconDlq,
  IconEye,
  IconJobs,
  IconLightning,
  IconLogs,
  IconMetrics,
  IconOverview,
  IconQueues,
  IconS3,
  IconSettings,
  IconUsage,
  IconWorkers,
} from '@/components/ui/icons';

export type NavItemDef = { to: string; label: string; icon: typeof IconOverview; end?: boolean };
export type NavGroupDef = { section: string | null; items: NavItemDef[] };

// The single source of truth for the app's navigation. The sidebar, the breadcrumb and the
// command palette (Cmd/Ctrl-K) all read it, so a new section shows up in each automatically.
export const NAV: NavGroupDef[] = [
  {
    section: null,
    items: [
      { to: '/', label: 'Overview', icon: IconOverview, end: true },
      { to: '/fleet', label: 'Fleet', icon: IconWorkers, end: true },
    ],
  },
  {
    section: 'Queues',
    items: [
      // Exact matching prevents both Queues + a queue detail, or Jobs + Bulk
      // Add, from being announced as the current page at the same time.
      { to: '/queues', label: 'Queues', icon: IconQueues, end: true },
      { to: '/jobs', label: 'Jobs', icon: IconJobs, end: true },
      { to: '/dlq', label: 'Dead Letter Queue', icon: IconDlq },
      { to: '/cron', label: 'Cron Jobs', icon: IconCron },
    ],
  },
  {
    section: 'Workflow',
    items: [
      { to: '/workflows', label: 'Overview', icon: IconOverview, end: true },
      { to: '/flows', label: 'Job Flows', icon: IconArrowRight, end: true },
      { to: '/workflows/executions', label: 'Executions', icon: IconJobs, end: true },
      { to: '/workflows/waiting', label: 'Waiting & Signals', icon: IconCron, end: true },
      { to: '/workflows/compensation', label: 'Compensation', icon: IconDlq, end: true },
      { to: '/workflows/archive', label: 'Archive', icon: IconDatabase, end: true },
    ],
  },
  {
    section: 'Monitoring',
    items: [
      { to: '/metrics', label: 'Metrics', icon: IconMetrics },
      { to: '/workers', label: 'Workers', icon: IconWorkers },
      { to: '/logs', label: 'Logs', icon: IconLogs },
      { to: '/alerts', label: 'Alerts', icon: IconAlerts },
    ],
  },
  {
    section: 'Control',
    items: [
      { to: '/server', label: 'Server', icon: IconWorkers },
      { to: '/add-job', label: 'Add Job', icon: IconJobs },
      { to: '/jobs/bulk-add', label: 'Bulk Add', icon: IconJobs },
      { to: '/job', label: 'Job Inspector', icon: IconEye },
      { to: '/queue-control', label: 'Queue Control', icon: IconQueues },
      { to: '/dlq-control', label: 'DLQ Control', icon: IconDlq },
      { to: '/webhooks', label: 'Webhooks', icon: IconLightning },
      { to: '/diagnostics', label: 'Diagnostics', icon: IconMetrics },
      { to: '/benchmark', label: 'Benchmark', icon: IconLightning },
    ],
  },
  {
    section: 'Management',
    items: [
      { to: '/database', label: 'Database', icon: IconDatabase },
      { to: '/mcp', label: 'MCP', icon: IconLightning },
      { to: '/usage', label: 'Usage', icon: IconUsage },
      { to: '/s3', label: 'S3 Backup', icon: IconS3 },
      { to: '/settings', label: 'Settings', icon: IconSettings },
    ],
  },
];

export type NavLocation = {
  /** Group heading, or null for the unlabelled root group. */
  section: string | null;
  /** The matching item's label, or null when the route is not a nav destination. */
  label: string | null;
};

/**
 * Which nav group (and item) a pathname belongs to. The most specific item wins, so
 * `/workflows/executions` is not claimed by `/workflows`. A queue detail page
 * (`/queues/:name`) is not an item of its own but still lives under Queues. Returns
 * null for routes outside the nav (classic pages, 404).
 */
export function locateNav(pathname: string): NavLocation | null {
  let best: { section: string | null; item: NavItemDef } | null = null;
  for (const group of NAV) {
    for (const item of group.items) {
      if (!matchPath({ path: item.to, end: item.end ?? false }, pathname)) continue;
      if (!best || item.to.length > best.item.to.length) best = { section: group.section, item };
    }
  }
  if (best) return { section: best.section, label: best.item.label };
  if (/^\/queues\/[^/]/i.test(pathname)) return { section: 'Queues', label: null };
  return null;
}
