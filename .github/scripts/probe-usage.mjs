// Read-only diagnostics (run by .github/workflows/probe.yml): Firestore reads, writes
// and API calls per hour for the last 2 days (Cloud Monitoring), so optimizations can
// be aimed at real numbers.
import { call, getAccessToken, loadServiceAccount, notice, warn } from './lib/google.mjs'

const key = loadServiceAccount()
const project = key.project_id
const H = { Authorization: `Bearer ${await getAccessToken(key)}` }

async function series(metric, groupBy) {
  const q = new URLSearchParams({
    filter: `metric.type="${metric}"`,
    'interval.startTime': new Date(Date.now() - 48 * 3600_000).toISOString(), 'interval.endTime': new Date().toISOString(),
    'aggregation.alignmentPeriod': '3600s', 'aggregation.perSeriesAligner': 'ALIGN_SUM', 'aggregation.crossSeriesReducer': 'REDUCE_SUM',
  })
  if (groupBy) q.append('aggregation.groupByFields', groupBy)
  const r = await call(`https://monitoring.googleapis.com/v3/projects/${project}/timeSeries?${q}`, { headers: H })
  if (!r.ok) { warn(`Monitoring ${metric} failed (${r.status}) ${JSON.stringify(r.json).slice(0, 300)}`); return }
  for (const s of r.json.timeSeries ?? []) {
    const pts = (s.points ?? []).map(p => [p.interval.endTime.slice(5, 13).replace('T', ' '), Number(p.value.int64Value ?? p.value.doubleValue ?? 0)]).reverse()
    notice(`${metric.split('/').slice(-2).join('/')} ${JSON.stringify(s.metric.labels ?? {})} total48h=${pts.reduce((a, [, v]) => a + v, 0)} hourly(UTC)=` + pts.filter(([, v]) => v).map(([t, v]) => `${t}h:${v}`).join(' '))
  }
}
await series('firestore.googleapis.com/document/read_count', 'metric.label.type')
await series('firestore.googleapis.com/document/write_count')
await series('firestore.googleapis.com/api/request_count', 'metric.label.method')
