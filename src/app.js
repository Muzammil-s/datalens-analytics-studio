import {
  parseCSV,
  serializeCSV,
  profileDataset,
  cleanDataset,
  pearsonCorrelation,
  generateMarkdownReport,
  isMissing
} from './csvEngine.js';
import { SAMPLE_DATASETS } from './samples.js';

let rawHeaders = [];
let rawRecords = [];
let workingRecords = [];
let currentName = 'E-Commerce Orders (Sample Data)';
let cleaningLog = [];
let currentProfile = null;

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function loadDataset(csvText, name) {
  const parsed = parseCSV(csvText);
  rawHeaders = parsed.headers;
  rawRecords = parsed.records;
  workingRecords = parsed.records.map((r) => ({ ...r }));
  currentName = name;
  cleaningLog = [];
  refresh();
}

function refresh() {
  currentProfile = profileDataset(rawHeaders, workingRecords);
  renderKPIs();
  renderCleaningLog();
  populateSelectors();
  renderDistributionChart();
  renderScatterChart();
  renderStatsTable();
  renderCorrelationMatrix();
  renderDataPreview();
}

function renderKPIs() {
  const p = currentProfile;
  const numCount = p.columns.filter((c) => c.type === 'numeric').length;
  const catCount = p.columns.length - numCount;
  document.getElementById('kpi-rows').textContent = p.rowCount.toLocaleString();
  document.getElementById('kpi-source').textContent = currentName;
  document.getElementById('kpi-cols').textContent = p.columnCount;
  document.getElementById('kpi-types').textContent = `${numCount} numeric · ${catCount} categorical/other`;
  document.getElementById('kpi-complete').textContent = `${p.completenessPct}%`;
  document.getElementById('kpi-missing').textContent = `${p.totalMissing} missing cell(s)`;
  document.getElementById('kpi-dupes').textContent = p.duplicateRows;
  document.getElementById('kpi-clean-count').textContent = `${cleaningLog.length} cleaning step(s)`;
}

function renderCleaningLog() {
  const el = document.getElementById('cleaning-log');
  if (!cleaningLog.length) {
    el.textContent = 'Raw dataset active — no cleaning transformations applied yet.';
    return;
  }
  el.textContent = cleaningLog.join(' · ');
}

function populateSelectors() {
  const distSel = document.getElementById('sel-dist-col');
  const prevDist = distSel.value;
  distSel.replaceChildren();
  currentProfile.columns.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = `${c.name} (${c.type})`;
    distSel.append(opt);
  });
  if (rawHeaders.includes(prevDist)) distSel.value = prevDist;
  else if (currentProfile.numericCols[0]) distSel.value = currentProfile.numericCols[0];

  const xSel = document.getElementById('sel-x-col');
  const ySel = document.getElementById('sel-y-col');
  const prevX = xSel.value;
  const prevY = ySel.value;
  xSel.replaceChildren();
  ySel.replaceChildren();
  currentProfile.numericCols.forEach((col) => {
    const o1 = document.createElement('option'); o1.value = col; o1.textContent = `X: ${col}`;
    const o2 = document.createElement('option'); o2.value = col; o2.textContent = `Y: ${col}`;
    xSel.append(o1);
    ySel.append(o2);
  });
  if (currentProfile.numericCols.includes(prevX)) xSel.value = prevX;
  if (currentProfile.numericCols.includes(prevY)) ySel.value = prevY;
  else if (currentProfile.numericCols[1]) ySel.value = currentProfile.numericCols[1];
}

function renderDistributionChart() {
  const box = document.getElementById('dist-chart');
  const colName = document.getElementById('sel-dist-col').value;
  const col = currentProfile.columns.find((c) => c.name === colName);
  if (!col) { box.textContent = 'No column selected.'; return; }

  if (col.type === 'numeric' && col.stats) {
    const nums = workingRecords
      .map((r) => Number(String(r[colName] ?? '').replace(/,/g, '')))
      .filter((n) => Number.isFinite(n));
    const min = col.stats.min;
    const max = col.stats.max;
    const bins = 8;
    const width = (max - min) || 1;
    const counts = Array(bins).fill(0);
    for (const n of nums) {
      const idx = Math.min(bins - 1, Math.floor(((n - min) / width) * bins));
      counts[idx]++;
    }
    const maxC = Math.max(...counts, 1);
    box.innerHTML = counts.map((c, i) => {
      const lo = (min + (i * width) / bins).toFixed(1);
      const hi = (min + ((i + 1) * width) / bins).toFixed(1);
      const pct = Math.round((c / maxC) * 100);
      return `<div class="bar-item"><div class="bar-label"><span>${lo} – ${hi}</span><span>${c}</span></div><div class="bar-bg"><div class="bar-val" style="width:${pct}%"></div></div></div>`;
    }).join('');
  } else {
    const top = col.topValues || [];
    const maxC = Math.max(...top.map((t) => t.count), 1);
    box.innerHTML = top.length
      ? top.map((t) => `<div class="bar-item"><div class="bar-label"><span>${t.value}</span><span>${t.count}</span></div><div class="bar-bg"><div class="bar-val" style="width:${Math.round((t.count / maxC) * 100)}%"></div></div></div>`).join('')
      : '<p class="muted">No non-empty values.</p>';
  }
}

function renderScatterChart() {
  const box = document.getElementById('scatter-chart');
  const meta = document.getElementById('scatter-meta');
  const xCol = document.getElementById('sel-x-col').value;
  const yCol = document.getElementById('sel-y-col').value;

  if (!xCol || !yCol) {
    meta.textContent = 'Need at least 2 numeric columns for scatter correlation.';
    box.innerHTML = '';
    return;
  }

  const pts = [];
  for (const r of workingRecords) {
    if (isMissing(r[xCol]) || isMissing(r[yCol])) continue;
    const x = Number(String(r[xCol]).replace(/,/g, ''));
    const y = Number(String(r[yCol]).replace(/,/g, ''));
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]);
  }

  const rVal = pearsonCorrelation(workingRecords, xCol, yCol);
  meta.textContent = `Valid pairs: ${pts.length} | Pearson r = ${rVal ?? 'N/A'}`;
  if (!pts.length) { box.innerHTML = '<p class="muted">No numeric pairs.</p>'; return; }

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = 440, h = 220, pad = 26;

  const circles = pts.map(([x, y]) => {
    const cx = pad + ((x - minX) / ((maxX - minX) || 1)) * (w - pad * 2);
    const cy = (h - pad) - ((y - minY) / ((maxY - minY) || 1)) * (h - pad * 2);
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="#2dd4bf" fill-opacity="0.82"><title>${xCol}: ${x}, ${yCol}: ${y}</title></circle>`;
  }).join('');

  box.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;background:#090f19;border:1px solid #24324a;border-radius:8px">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#334155" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="#334155" />
      ${circles}
      <text x="${w / 2}" y="${h - 6}" text-anchor="middle" fill="#93a4bd" font-size="10" font-family="monospace">${xCol}</text>
      <text x="10" y="15" fill="#93a4bd" font-size="10" font-family="monospace">${yCol}</text>
    </svg>
  `;
}

function renderStatsTable() {
  const tbody = document.getElementById('stats-tbody');
  tbody.innerHTML = currentProfile.columns.map((c) => {
    const s = c.stats;
    return `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td><span class="type-pill">${c.type}</span></td>
        <td class="mono">${c.missingCount} (${c.missingPct}%)</td>
        <td class="mono">${c.uniqueCount}</td>
        <td class="mono">${s ? s.mean : '—'}</td>
        <td class="mono">${s ? s.median : '—'}</td>
        <td class="mono">${s ? s.std : '—'}</td>
        <td class="mono">${s ? `${s.min} / ${s.max}` : '—'}</td>
        <td class="mono">${s ? `${s.outliers} IQR outlier(s)` : c.topValues.slice(0, 2).map((t) => `${t.value} (${t.count})`).join(', ')}</td>
      </tr>
    `;
  }).join('');
}

function renderCorrelationMatrix() {
  const wrap = document.getElementById('corr-matrix');
  const cols = currentProfile.numericCols;
  if (cols.length < 2) {
    wrap.innerHTML = '<p class="muted">Load a dataset with at least 2 numeric columns to compute correlations.</p>';
    return;
  }
  const head = `<tr><th></th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>`;
  const body = cols.map((a) => {
    const cells = cols.map((b) => {
      const r = currentProfile.correlations[a][b];
      const alpha = r === null ? 0 : Math.min(0.65, Math.abs(r) * 0.65);
      const bg = r === null ? 'transparent' : (r >= 0 ? `rgba(45,212,191,${alpha})` : `rgba(248,113,113,${alpha})`);
      return `<td class="corr-cell" style="background:${bg}">${r ?? '—'}</td>`;
    }).join('');
    return `<tr><td><strong>${a}</strong></td>${cells}</tr>`;
  }).join('');
  wrap.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function renderDataPreview() {
  const wrap = document.getElementById('preview-wrap');
  const q = document.getElementById('row-search').value.trim().toLowerCase();
  const rows = workingRecords.filter((r) => !q || rawHeaders.some((h) => String(r[h] ?? '').toLowerCase().includes(q))).slice(0, 100);
  const head = `<tr>${rawHeaders.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  const body = rows.map((r) => `<tr>${rawHeaders.map((h) => `<td class="mono">${String(r[h] ?? '') || '<span style="color:#f87171">null</span>'}</td>`).join('')}</tr>`).join('');
  wrap.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

document.getElementById('sample-select').addEventListener('change', (e) => {
  const ds = SAMPLE_DATASETS[e.target.value];
  if (ds) loadDataset(ds.csv, ds.label);
});

document.getElementById('csv-upload').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  loadDataset(await file.text(), file.name);
});

const dropzone = document.getElementById('dropzone');
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files?.[0];
  if (file) loadDataset(await file.text(), file.name);
});

document.getElementById('btn-clean').addEventListener('click', () => {
  const res = cleanDataset(rawHeaders, workingRecords, {
    trimWhitespace: document.getElementById('chk-trim').checked,
    removeDuplicates: document.getElementById('chk-dupes').checked,
    missingStrategy: document.getElementById('sel-missing').value,
    numericImpute: document.getElementById('sel-impute').value
  });
  workingRecords = res.records;
  cleaningLog.push(...res.log);
  refresh();
});

document.getElementById('btn-reset').addEventListener('click', () => {
  workingRecords = rawRecords.map((r) => ({ ...r }));
  cleaningLog = [];
  refresh();
});

document.getElementById('sel-dist-col').addEventListener('change', renderDistributionChart);
document.getElementById('sel-x-col').addEventListener('change', renderScatterChart);
document.getElementById('sel-y-col').addEventListener('change', renderScatterChart);
document.getElementById('row-search').addEventListener('input', renderDataPreview);

document.getElementById('btn-export-csv').addEventListener('click', () => {
  downloadFile('datalens-cleaned.csv', serializeCSV(rawHeaders, workingRecords), 'text/csv;charset=utf-8');
});
document.getElementById('btn-export-md').addEventListener('click', () => {
  downloadFile('datalens-report.md', generateMarkdownReport(currentName, currentProfile, cleaningLog), 'text/markdown;charset=utf-8');
});
document.getElementById('btn-export-json').addEventListener('click', () => {
  downloadFile('datalens-summary.json', JSON.stringify({ dataset: currentName, cleaningLog, profile: currentProfile }, null, 2), 'application/json');
});

loadDataset(SAMPLE_DATASETS.ecommerce.csv, SAMPLE_DATASETS.ecommerce.label);
