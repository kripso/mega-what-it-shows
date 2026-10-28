import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupByCause, readAs, uniqueById } from '../src/lib/kb/causes.ts';
import { deskRef } from '../src/lib/kb/desk-ref.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const dataDir = path.join(root, 'src/lib/data');
const ticket = 4471;
const signature = 'kripso';
const reports = JSON.parse(await readFile(path.join(dataDir, 'reports-4471.json'), 'utf8'));
const notes = JSON.parse(await readFile(path.join(dataDir, 'desk-notes.json'), 'utf8'));
const tenantFiles = (await readdir(path.join(dataDir, 'tenants'))).filter((name) => name.endsWith('.json'));
const tenants = await Promise.all(
  tenantFiles.map(async (name) => JSON.parse(await readFile(path.join(dataDir, 'tenants', name), 'utf8'))),
);
const byHandle = new Map(tenants.map((tenant) => [tenant.handle, tenant]));
const merged = uniqueById(reports).filter((report) => report.mergedInto === ticket);
const groups = groupByCause(merged, (report) => byHandle.get(report.tenant));
const owner = groups.find((group) => group.mergedInto.includes(ticket))?.cause ?? null;

const escapeHtml = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const tags = (group) =>
  Object.entries(group.taggedAs)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => `${tag} ×${count}`)
    .join(' · ');
const rows = groups
  .map(
    (group) => `      <tr${group.cause === owner ? '' : ' class="wrong"'}>
        <td><code>${escapeHtml(group.cause)}</code></td>
        <td>${group.reports.length}</td>
        <td class="tags">${escapeHtml(tags(group))}</td>
        <td>${group.tenants}</td>
        <td>${escapeHtml(group.firstSeen)} → ${escapeHtml(group.lastSeen)}</td>
        <td>${group.cause === owner ? `#${ticket}` : 'not this ticket — no ticket of its own'}</td>
      </tr>`,
  )
  .join('\n');
const footnotes = groups
  .map((group) => ({ group, moved: readAs(group, notes.oneDayMove) }))
  .filter(({ moved }) => moved)
  .map(
    ({ group, moved }) =>
      `    <p class="note">${moved} reports read as a one-day move; filed under <code>${escapeHtml(group.cause)}</code> by tenant.</p>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>#4471 · two date-handling causes · support kb</title>
    <style>
      :root { --bg: #fbfaf7; --fg: #1d1d1b; --muted: #6b6a66; --line: #e3e0d8; --accent: #2f6f5e; --warn: #b4501f; --warn-bg: #fbeee6; --note-bg: #eef5f2; --mono: ui-monospace, 'Cascadia Code', Menlo, monospace; }
      @media (prefers-color-scheme: dark) { :root { --bg: #171716; --fg: #ecebe6; --muted: #9c9a93; --line: #34332f; --accent: #6fbfa6; --warn: #f0905d; --warn-bg: #3a2418; --note-bg: #1d2c27; } }
      body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, sans-serif; }
      table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.92rem; }
      th, td { border-bottom: 1px solid var(--line); padding: 0.35rem 0.5rem; text-align: left; }
      code { font-family: var(--mono); font-size: 0.88em; }
      a { color: var(--accent); }
      .kb { max-width: 760px; margin: 0 auto; padding: 2rem 16px 4rem; }
      .crumb { font: 0.8rem var(--mono); text-decoration: none; color: var(--muted); }
      h1 { margin: 0.25rem 0 0.5rem; line-height: 1.2; }
      .meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; color: var(--muted); font-size: 0.85rem; margin: 0; }
      .status { border: 1px solid var(--line); border-radius: 99px; padding: 0 0.6rem; }
      aside { border-left: 4px solid var(--accent); padding: 0.5rem 1rem; margin: 1rem 0; background: var(--note-bg); }
      .sum { font-size: 1.1rem; }
      .tags, .note { color: var(--muted); font-size: 0.85em; }
      .wrong td { background: var(--warn-bg); }
      .wrong td:last-child { color: var(--warn); font-weight: 600; }
      .stamp { margin: 2rem 0 0; font: 0.85rem var(--mono); color: var(--muted); }
      .stamp b { color: var(--accent); letter-spacing: 0.04em; }
      footer { margin-top: 3rem; color: var(--muted); font-size: 0.8rem; border-top: 1px solid var(--line); padding-top: 1rem; }
    </style>
  </head>
  <body>
    <div class="kb">
      <header>
        <a class="crumb" href="/kb">support desk · kb</a>
        <h1>#4471 · two date-handling causes</h1>
        <p class="meta"><span>owner <b>kripso</b></span><span class="status triaged">triaged</span><span>reviewed 2026-10-28</span></p>
      </header>
      <main>
        <p>Ticket #4471 is not one parser bug. The export has overlapping pages, so each report ID counts once. A report's cause comes from its tenant's locale and booking form, not the browser-based intake tag.</p>
        <aside class="note">Two causes need two tickets. The parser and date-hint failures need different fixes.</aside>
        <h2>What was merged</h2>
        <p class="sum"><strong>${merged.length}</strong> reports merged into #${ticket} · <strong>${groups.length}</strong> causes</p>
        <table>
          <thead><tr><th>cause</th><th>reports</th><th>tagged as</th><th>tenants</th><th>seen</th><th></th></tr></thead>
          <tbody>
${rows}
          </tbody>
        </table>
${footnotes}
        <h2>Parser: month-first reading</h2>
        <p>The shared parser reads every date month first. For a day-first tenant, app, email and booking-v2 form reports can flip the day and month. This remains the primary cause in #4471.</p>
        <h2>Hint: contradictory format guidance</h2>
        <p>The booking-v3 form prints <code>MM/DD/YYYY</code>, but reads the tenant's day-first format. Reports through that form are the <code>hint</code> cause, even when intake tagged them <code>parser</code>.</p>
        <h2>Triage note</h2>
        <p>Reports that read as a one-day move stay with the cause supplied by tenant and form; the desk note does not make a third cause. Matching subjects explain the merge, not a shared root cause.</p>
        <p class="stamp">desk ref <b>${deskRef(signature)}</b></p>
      </main>
      <footer>Pages are written by people. Tables and charts are built from data at render time.</footer>
    </div>
  </body>
</html>
`;

const output = path.join(root, 'rendered/kb/incidents/4471-causes/index.html');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(JSON.stringify({ output: path.relative(root, output), merged: merged.length, groups: groups.map((group) => ({ cause: group.cause, reports: group.reports.length })) }, null, 2));
