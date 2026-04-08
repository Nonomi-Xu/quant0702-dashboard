const formatNumber = (value, digits = 4) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(digits);
};

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(2)}%`;
};

const summaryLabels = {
  factor: "因子名",
  horizon: "调仓周期",
  ic_mean: "IC均值",
  ic_ir: "ICIR",
  ic_abs_gt_002_ratio: "|IC|>0.02比例",
  long_short_mean: "多空平均收益",
  long_short_sharpe: "多空年化夏普",
  long_short_max_drawdown: "最大回撤",
  win_rate: "胜率",
  long_group_turnover: "最高组换手",
  short_group_turnover: "最低组换手",
  long_short_turnover: "多空换手率",
  ic_observations: "IC观测数",
};

const percentKeys = new Set([
  "ic_abs_gt_002_ratio",
  "long_short_mean",
  "long_short_max_drawdown",
  "win_rate",
  "long_group_turnover",
  "short_group_turnover",
  "long_short_turnover",
]);

const summaryKeyOrder = [
  "horizon",
  "factor",
  "ic_mean",
  "ic_ir",
  "ic_abs_gt_002_ratio",
  "long_short_mean",
  "long_short_sharpe",
  "long_short_max_drawdown",
  "win_rate",
  "long_group_turnover",
  "short_group_turnover",
  "long_short_turnover",
  "ic_observations",
];

const hiddenKpiKeys = new Set(["factor"]);
const factorLabelMap = new Map();

function escapeHtml(value) {
  return String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSummaryValue(key, value) {
  if (key === "factor") return factorLabelMap.get(value) ?? value ?? "-";
  if (percentKeys.has(key)) return formatPercent(value);
  if (typeof value === "number") return formatNumber(value);
  return value ?? "-";
}

function summaryTableColumns(rows) {
  const presentKeys = new Set(rows.flatMap((row) => Object.keys(row)));
  const orderedKeys = summaryKeyOrder.filter((key) => presentKeys.has(key));
  const extraKeys = [...presentKeys].filter((key) => !summaryKeyOrder.includes(key)).sort();
  return [...orderedKeys, ...extraKeys];
}

function renderSummaryTable(target, rows) {
  const table = document.querySelector(target);
  if (!rows?.length) {
    table.innerHTML = `<tbody><tr><td class="empty-cell">暂无已完成的评测结果</td></tr></tbody>`;
    return;
  }

  const columns = summaryTableColumns(rows);
  table.innerHTML = `
    <thead>
      <tr>${columns.map((key) => `<th>${escapeHtml(summaryLabels[key] ?? key)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          ${columns.map((key) => `<td>${escapeHtml(formatSummaryValue(key, row[key]))}</td>`).join("")}
        </tr>
      `).join("")}
    </tbody>
  `;
}

function renderKpis(summary) {
  const grid = document.querySelector("#kpi-grid");
  grid.innerHTML = Object.entries(summary)
    .filter(([key]) => !hiddenKpiKeys.has(key))
    .map(([key, value]) => `
      <article class="kpi-card">
        <span class="kpi-label">${escapeHtml(summaryLabels[key] ?? key)}</span>
        <span class="kpi-value">${escapeHtml(formatSummaryValue(key, value))}</span>
      </article>
    `)
    .join("");
}

function renderFactorInfo(data) {
  const metadata = data.metadata ?? {};
  document.querySelector("#factor-field").textContent = metadata.field_name ?? data.factor ?? "-";
  document.querySelector("#factor-description").textContent = metadata.display_name ?? metadata.label ?? "-";
  document.querySelector("#factor-formula").textContent = metadata.formula ?? "-";
  document.querySelector("#rebalance-period").textContent = `${data.horizon ?? "-"} 个交易日`;
}

function drawLineChart(canvas, rows) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width = canvas.clientWidth * devicePixelRatio;
  const height = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  const padding = 34;
  const values = rows.map((row) => Number(row.ic));
  const min = Math.min(-0.06, ...values);
  const max = Math.max(0.06, ...values);
  const xStep = (canvas.clientWidth - padding * 2) / Math.max(rows.length - 1, 1);
  const y = (value) => padding + (max - value) / (max - min) * (canvas.clientHeight - padding * 2);

  ctx.strokeStyle = "rgba(23, 33, 27, 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y(0));
  ctx.lineTo(canvas.clientWidth - padding, y(0));
  ctx.stroke();

  ctx.strokeStyle = "#164c37";
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = padding + xStep * index;
    const pointY = y(value);
    if (index === 0) ctx.moveTo(x, pointY);
    else ctx.lineTo(x, pointY);
  });
  ctx.stroke();

  ctx.fillStyle = "#bd5734";
  values.forEach((value, index) => {
    const x = padding + xStep * index;
    ctx.beginPath();
    ctx.arc(x, y(value), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGroupChart(canvas, groupReturns) {
  const ctx = canvas.getContext("2d");
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  const groups = ["group_1", "group_2", "group_3", "group_4", "group_5", "long_short"];
  const labels = ["G1", "G2", "G3", "G4", "G5", "L-S"];
  const values = groups.map((key) => Number(groupReturns[key] ?? 0));
  const maxAbs = Math.max(0.01, ...values.map(Math.abs));
  const padding = 34;
  const chartHeight = canvas.clientHeight - padding * 2;
  const zeroY = padding + chartHeight / 2;
  const barWidth = (canvas.clientWidth - padding * 2) / groups.length * 0.58;

  ctx.strokeStyle = "rgba(23, 33, 27, 0.18)";
  ctx.beginPath();
  ctx.moveTo(padding, zeroY);
  ctx.lineTo(canvas.clientWidth - padding, zeroY);
  ctx.stroke();

  values.forEach((value, index) => {
    const x = padding + index * ((canvas.clientWidth - padding * 2) / groups.length) + barWidth * 0.35;
    const height = Math.abs(value) / maxAbs * (chartHeight / 2);
    const y = value >= 0 ? zeroY - height : zeroY;
    ctx.fillStyle = value >= 0 ? "#164c37" : "#bd5734";
    ctx.fillRect(x, y, barWidth, height);
    ctx.fillStyle = "#68766f";
    ctx.font = "12px Avenir Next";
    ctx.fillText(labels[index], x + 2, canvas.clientHeight - 12);
  });
}

function renderMetrics(target, payload) {
  const entries = [
    ["日期", payload.trade_date],
    ["样本数", payload.sample_count],
    ["空值数", payload.null_count],
    ["均值", formatNumber(payload.factor_mean)],
    ["标准差", formatNumber(payload.factor_std)],
    ["覆盖率", formatPercent(payload.coverage_ratio)],
  ];

  document.querySelector(target).innerHTML = entries
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("");
}

async function loadDashboard(factor, horizon) {
  if (!factor || !horizon) {
    document.querySelector("#dataset-label").textContent = "暂无已完成的因子评测结果";
    return;
  }

  const response = await fetch(`/api/analysis?factor=${encodeURIComponent(factor)}&horizon=${encodeURIComponent(horizon)}`);
  if (!response.ok) throw new Error(`请求失败: ${response.status}`);
  const data = await response.json();

  const factorLabel = factorLabelMap.get(data.factor) ?? data.factor;
  document.querySelector("#dataset-label").textContent = `${factorLabel} / horizon_${data.horizon}`;
  document.querySelector("#updated-label").textContent = `更新时间: ${data.updated_at}`;

  renderFactorInfo(data);
  renderKpis(data.summary);
  renderMetrics("#monitor-list", data.monitor_latest);
  renderMetrics("#raw-monitor-list", data.raw_monitor_latest);
  drawLineChart(document.querySelector("#ic-chart"), data.ic_timeseries);
  drawGroupChart(document.querySelector("#group-chart"), data.group_returns);
  await loadSummaryComparisons(factor, horizon);
}

async function loadSummaryComparisons(factor, horizon) {
  const [factorResponse, horizonResponse] = await Promise.all([
    fetch(`/api/comparisons/factor/${encodeURIComponent(factor)}/summary`),
    fetch(`/api/comparisons/horizon/${encodeURIComponent(horizon)}/summary`),
  ]);

  if (factorResponse.ok) {
    const payload = await factorResponse.json();
    renderSummaryTable("#factor-horizon-table", payload.rows ?? []);
  }

  if (horizonResponse.ok) {
    const payload = await horizonResponse.json();
    renderSummaryTable("#horizon-factor-table", payload.rows ?? []);
  }
}

async function loadFactorOptions() {
  const response = await fetch("/api/factors");
  if (!response.ok) return [];
  const data = await response.json();
  const factors = data.factors ?? [];
  factorLabelMap.clear();
  (data.factor_options ?? []).forEach((option) => {
    factorLabelMap.set(option.value, option.label);
  });
  const select = document.querySelector("#factor-input");
  const factorOptions = data.factor_options?.length
    ? data.factor_options
    : factors.map((factor) => ({ value: factor, label: factor }));
  select.innerHTML = factorOptions
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");
  return factors;
}

async function loadHorizonOptions(factor) {
  const response = await fetch(`/api/factors/${encodeURIComponent(factor)}/horizons`);
  if (!response.ok) return;
  const data = await response.json();
  const select = document.querySelector("#horizon-input");
  const currentValue = select.value;
  const horizons = data.horizons ?? [];
  select.innerHTML = horizons
    .map((horizon) => `<option value="${horizon}">${horizon} 个交易日</option>`)
    .join("");
  select.value = [...select.options].some((option) => option.value === currentValue)
    ? currentValue
    : select.options[0]?.value ?? "";
}

document.querySelector("#query-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const factor = document.querySelector("#factor-input").value.trim();
  loadHorizonOptions(factor).then(() => loadDashboard(
    factor,
    document.querySelector("#horizon-input").value
  )).catch((error) => {
    document.querySelector("#dataset-label").textContent = error.message;
  });
});

async function bootDashboard() {
  const factors = await loadFactorOptions();
  const initialFactor = factors[0] ?? "";
  const factorInput = document.querySelector("#factor-input");
  factorInput.value = initialFactor;
  if (!initialFactor) {
    document.querySelector("#dataset-label").textContent = "暂无已完成的因子评测结果";
    return;
  }
  await loadHorizonOptions(initialFactor);
  await loadDashboard(initialFactor, document.querySelector("#horizon-input").value);
}

document.querySelector("#factor-input").addEventListener("change", (event) => {
  const factor = event.target.value;
  loadHorizonOptions(factor)
    .then(() => loadDashboard(factor, document.querySelector("#horizon-input").value))
    .catch((error) => {
      document.querySelector("#dataset-label").textContent = error.message;
    });
});

document.querySelector("#horizon-input").addEventListener("change", () => {
  const factor = document.querySelector("#factor-input").value;
  loadDashboard(factor, document.querySelector("#horizon-input").value)
    .catch((error) => {
      document.querySelector("#dataset-label").textContent = error.message;
    });
});

bootDashboard().catch((error) => {
  document.querySelector("#dataset-label").textContent = error.message;
});
