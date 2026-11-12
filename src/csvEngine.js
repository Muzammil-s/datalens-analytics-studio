// Pure RFC-4180 CSV Parser, Schema Inference, Data Cleaning & Descriptive Statistics Engine

export function parseCSV(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const s = String(text || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (!nonEmpty.length) throw new Error('CSV file contains no readable rows.');

  const headers = nonEmpty[0].map((h, idx) => h.trim() || `column_${idx + 1}`);
  const records = nonEmpty.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] !== undefined ? r[idx] : '';
    });
    return obj;
  });
  return { headers, records };
}

export function serializeCSV(headers, records) {
  const escapeCell = (val) => {
    const str = String(val ?? '');
    if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const lines = [headers.map(escapeCell).join(',')];
  for (const rec of records) {
    lines.push(headers.map((h) => escapeCell(rec[h])).join(','));
  }
  return lines.join('\n');
}

export function isMissing(val) {
  if (val === null || val === undefined) return true;
  const t = String(val).trim().toLowerCase();
  return t === '' || t === 'null' || t === 'na' || t === 'n/a' || t === 'nan' || t === 'none';
}

export function inferColumnType(values) {
  const nonNull = values.filter((v) => !isMissing(v)).map((v) => String(v).trim());
  if (!nonNull.length) return 'empty';
  const numCount = nonNull.filter((v) => /^-?\d+(\.\d+)?$/.test(v.replace(/,/g, ''))).length;
  if (numCount / nonNull.length >= 0.85) return 'numeric';
  const boolCount = nonNull.filter((v) => ['true', 'false', 'yes', 'no'].includes(v.toLowerCase())).length;
  if (boolCount / nonNull.length >= 0.9) return 'boolean';
  const dateCount = nonNull.filter((v) => /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v))).length;
  if (dateCount / nonNull.length >= 0.85) return 'date';
  return 'categorical';
}

export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function profileDataset(headers, records) {
  const seenRows = new Set();
  let duplicateRows = 0;
  for (const r of records) {
    const sig = JSON.stringify(headers.map((h) => String(r[h] ?? '').trim()));
    if (seenRows.has(sig)) duplicateRows++;
    else seenRows.add(sig);
  }

  let totalMissing = 0;
  const columns = headers.map((name) => {
    const rawVals = records.map((r) => r[name]);
    const missingCount = rawVals.filter(isMissing).length;
    totalMissing += missingCount;
    const type = inferColumnType(rawVals);
    const nonNull = rawVals.filter((v) => !isMissing(v)).map((v) => String(v).trim());
    const uniqueCount = new Set(nonNull).size;

    const col = {
      name,
      type,
      count: records.length,
      nonNullCount: nonNull.length,
      missingCount,
      missingPct: records.length ? Number(((missingCount / records.length) * 100).toFixed(1)) : 0,
      uniqueCount,
      stats: null,
      topValues: []
    };

    if (type === 'numeric') {
      const nums = nonNull
        .map((v) => Number(v.replace(/,/g, '')))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      if (nums.length) {
        const sum = nums.reduce((a, b) => a + b, 0);
        const mean = sum / nums.length;
        const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
        const std = Math.sqrt(variance);
        const q1 = quantile(nums, 0.25);
        const median = quantile(nums, 0.5);
        const q3 = quantile(nums, 0.75);
        const iqr = q3 - q1;
        const lowFence = q1 - 1.5 * iqr;
        const highFence = q3 + 1.5 * iqr;
        const outliers = nums.filter((n) => n < lowFence || n > highFence).length;
        col.stats = {
          min: nums[0],
          q1: Number(q1.toFixed(3)),
          median: Number(median.toFixed(3)),
          mean: Number(mean.toFixed(3)),
          q3: Number(q3.toFixed(3)),
          max: nums[nums.length - 1],
          std: Number(std.toFixed(3)),
          sum: Number(sum.toFixed(2)),
          outliers
        };
      }
    } else {
      const freq = {};
      for (const v of nonNull) freq[v] = (freq[v] || 0) + 1;
      col.topValues = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([value, count]) => ({ value, count }));
    }

    return col;
  });

  const numericCols = columns.filter((c) => c.type === 'numeric').map((c) => c.name);
  const correlations = {};
  for (const a of numericCols) {
    correlations[a] = {};
    for (const b of numericCols) {
      correlations[a][b] = pearsonCorrelation(records, a, b);
    }
  }

  return {
    rowCount: records.length,
    columnCount: headers.length,
    duplicateRows,
    totalMissing,
    completenessPct: records.length && headers.length
      ? Number((((records.length * headers.length - totalMissing) / (records.length * headers.length)) * 100).toFixed(1))
      : 100,
    columns,
    numericCols,
    correlations
  };
}

export function pearsonCorrelation(records, colA, colB) {
  const pairs = [];
  for (const r of records) {
    if (isMissing(r[colA]) || isMissing(r[colB])) continue;
    const x = Number(String(r[colA]).replace(/,/g, ''));
    const y = Number(String(r[colB]).replace(/,/g, ''));
    if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const meanX = pairs.reduce((s, p) => s + p[0], 0) / n;
  const meanY = pairs.reduce((s, p) => s + p[1], 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return 0;
  return Number((num / denom).toFixed(3));
}

export function cleanDataset(headers, records, options = {}) {
  let rows = records.map((r) => ({ ...r }));
  const log = [];

  if (options.trimWhitespace) {
    let trimmed = 0;
    rows = rows.map((r) => {
      const next = {};
      for (const h of headers) {
        const orig = String(r[h] ?? '');
        const clean = orig.trim();
        if (orig !== clean) trimmed++;
        next[h] = clean;
      }
      return next;
    });
    log.push(`Trimmed whitespace in ${trimmed} cell(s).`);
  }

  if (options.removeDuplicates) {
    const before = rows.length;
    const seen = new Set();
    rows = rows.filter((r) => {
      const sig = JSON.stringify(headers.map((h) => String(r[h] ?? '').trim()));
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
    log.push(`Removed ${before - rows.length} duplicate row(s).`);
  }

  if (options.missingStrategy === 'drop') {
    const before = rows.length;
    rows = rows.filter((r) => headers.every((h) => !isMissing(r[h])));
    log.push(`Dropped ${before - rows.length} row(s) containing missing values.`);
  } else if (options.missingStrategy === 'impute') {
    const profile = profileDataset(headers, rows);
    let filled = 0;
    for (const col of profile.columns) {
      if (col.missingCount === 0) continue;
      let fillVal = 'Unknown';
      if (col.type === 'numeric' && col.stats) {
        fillVal = String(options.numericImpute === 'mean' ? col.stats.mean : col.stats.median);
      } else if (col.topValues.length) {
        fillVal = col.topValues[0].value;
      }
      rows.forEach((r) => {
        if (isMissing(r[col.name])) {
          r[col.name] = fillVal;
          filled++;
        }
      });
    }
    log.push(`Imputed ${filled} missing cell(s) (${options.numericImpute || 'median'} for numeric, mode for categorical).`);
  }

  return { records: rows, log };
}

export function generateMarkdownReport(datasetName, profile, cleaningLog) {
  const lines = [
    `# DataLens Analytics Report — ${datasetName}`,
    '',
    `- **Generated:** ${new Date().toISOString()}`,
    `- **Rows:** ${profile.rowCount} | **Columns:** ${profile.columnCount}`,
    `- **Completeness:** ${profile.completenessPct}% (${profile.totalMissing} missing cells)`,
    `- **Duplicate Rows Detected:** ${profile.duplicateRows}`,
    ''
  ];
  if (cleaningLog.length) {
    lines.push('## Cleaning Operations Applied', ...cleaningLog.map((l) => `- ${l}`), '');
  }
  lines.push('## Column Summary', '', '| Column | Type | Missing | Unique | Summary |', '|---|---|---:|---:|---|');
  for (const col of profile.columns) {
    const summary = col.stats
      ? `mean=${col.stats.mean}, median=${col.stats.median}, std=${col.stats.std}, range=[${col.stats.min}, ${col.stats.max}]`
      : col.topValues.slice(0, 3).map((t) => `${t.value} (${t.count})`).join(', ') || '—';
    lines.push(`| ${col.name} | ${col.type} | ${col.missingCount} (${col.missingPct}%) | ${col.uniqueCount} | ${summary} |`);
  }
  return lines.join('\n');
}
