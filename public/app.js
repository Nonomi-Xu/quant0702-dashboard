const formatNumber = (value, digits = 4) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(digits);
};

const formatPercent = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(digits)}%`;
};

function formatDateTimeMinute(value) {
  if (!value) return "-";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text} 00:00`;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 16);

  const pad = (number) => String(number).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const summaryLabels = {
  factor: "因子名",
  horizon: "调仓周期（天）",
  ic_mean: "IC均值",
  ic_ir: "ICIR",
  ic_abs_gt_002_ratio: "|IC|>0.02比例",
  ic_positive_ratio: "IC为正比例",
  long_short_gross_mean: "多空平均收益（扣费前）",
  long_short_mean: "多空平均收益",
  long_short_sharpe: "多空年化夏普",
  long_short_max_drawdown: "最大回撤",
  transaction_cost_mean: "平均交易成本",
  win_rate: "胜率",
  long_group_turnover: "最高组换手",
  short_group_turnover: "最低组换手",
  long_short_turnover: "多空换手率",
  ic_observations: "IC观测数",
  updated_at: "更新时间",
};

const percentKeys = new Set([
  "ic_abs_gt_002_ratio",
  "ic_positive_ratio",
  "long_short_gross_mean",
  "long_short_mean",
  "long_short_max_drawdown",
  "transaction_cost_mean",
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
  "ic_positive_ratio",
  "long_short_gross_mean",
  "long_short_mean",
  "long_short_sharpe",
  "long_short_max_drawdown",
  "transaction_cost_mean",
  "win_rate",
  "long_group_turnover",
  "short_group_turnover",
  "long_short_turnover",
  "ic_observations",
];

const hiddenKpiKeys = new Set(["factor", "updated_at"]);
const factorLabelMap = new Map();
const tableSortState = {};
let candidateLibraryRows = [];
const tableThreeDigitKeys = new Set(["ic_mean", "ic_ir", "long_short_mean", "long_short_sharpe"]);
const primaryKpiKeys = new Set(["ic_mean", "ic_ir", "long_short_mean", "long_short_sharpe"]);
const costKpiKeys = new Set(["long_short_gross_mean", "transaction_cost_mean"]);
const kpiKeyOrder = [
  "ic_mean",
  "ic_ir",
  "long_short_mean",
  "long_short_sharpe",
  "long_short_gross_mean",
  "transaction_cost_mean",
  "ic_abs_gt_002_ratio",
  "ic_positive_ratio",
  "win_rate",
  "long_short_max_drawdown",
  "long_short_turnover",
  "long_group_turnover",
  "short_group_turnover",
  "ic_observations",
  "horizon",
];

function escapeHtml(value) {
  return String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showCandidateLibrary() {
  document.body.dataset.view = "candidate";
  document.querySelectorAll(".detail-section").forEach((section) => section.classList.add("hidden"));
  document.querySelector("#candidate-factor-library").classList.remove("hidden");
}

function showFactorDetail() {
  document.body.dataset.view = "detail";
  document.querySelector("#candidate-factor-library").classList.add("hidden");
  document.querySelectorAll(".detail-section").forEach((section) => section.classList.remove("hidden"));
}

function formatSummaryValue(key, value, digits = 4) {
  if (key === "factor") return factorLabelMap.get(value) ?? value ?? "-";
  if (key === "horizon") return formatNumber(value, 1);
  if (percentKeys.has(key)) return formatPercent(value, digits);
  if (typeof value === "number") return formatNumber(value, digits);
  return value ?? "-";
}

function summaryTableColumns(rows) {
  const presentKeys = new Set(rows.flatMap((row) => Object.keys(row)));
  const orderedKeys = summaryKeyOrder.filter((key) => presentKeys.has(key));
  const extraKeys = [...presentKeys]
    .filter((key) => !summaryKeyOrder.includes(key) && key !== "factor_key" && key !== "updated_at")
    .sort();
  return [...orderedKeys, ...extraKeys];
}

function compareSummaryRows(left, right, key, direction) {
  const leftValue = left[key];
  const rightValue = right[key];
  const leftNumber = Number(leftValue);
  const rightNumber = Number(rightValue);
  const multiplier = direction === "desc" ? -1 : 1;

  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return (leftNumber - rightNumber) * multiplier;
  }

  return String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "zh-Hans-CN") * multiplier;
}

function renderTableHeader(target, key) {
  const label = key === "horizon" ? "调仓周期（天）" : summaryLabels[key] ?? key;
  if (key === "factor") return `<th>${escapeHtml(label)}</th>`;

  const state = tableSortState[target];
  const marker = state?.key === key ? (state.direction === "asc" ? " ↑" : " ↓") : "";
  return `
    <th>
      <button class="sort-button" type="button" data-table-target="${escapeHtml(target)}" data-sort-key="${escapeHtml(key)}">
        ${escapeHtml(label)}${marker}
      </button>
    </th>
  `;
}

function renderSummaryCell(key, row) {
  if (key === "factor" && row.factor_key) {
    const horizon = row.horizon ?? document.querySelector("#horizon-input").value;
    return `
      <td>
        <button class="factor-link" type="button" data-factor="${escapeHtml(row.factor_key)}" data-horizon="${escapeHtml(horizon)}">
          ${escapeHtml(formatSummaryValue(key, row[key], tableThreeDigitKeys.has(key) ? 3 : 1))}
        </button>
      </td>
    `;
  }

  return `<td>${escapeHtml(formatSummaryValue(key, row[key], tableThreeDigitKeys.has(key) ? 3 : 1))}</td>`;
}

function renderCandidateLibraryTable(rows) {
  candidateLibraryRows = rows;
  renderSummaryTable("#candidate-factor-table", rows);
}

function renderSummaryTable(target, rows) {
  const table = document.querySelector(target);
  if (!rows?.length) {
    table.innerHTML = `<tbody><tr><td class="empty-cell">暂无已完成的评测结果</td></tr></tbody>`;
    return;
  }

  const shouldHideColumn = (key) => (
    target === "#factor-horizon-table"
    && ["ic_observations", "ic_observation", "ic_count", "IC观测数"].includes(key)
  );
  const columns = summaryTableColumns(rows).filter((key) => !shouldHideColumn(key));
  const sortedRows = [...rows];
  const sortState = tableSortState[target];
  if (sortState?.key) {
    sortedRows.sort((left, right) => compareSummaryRows(left, right, sortState.key, sortState.direction));
  }

  table.innerHTML = `
    <thead>
      <tr>${columns.map((key) => renderTableHeader(target, key)).join("")}</tr>
    </thead>
    <tbody>
      ${sortedRows.map((row) => `
        <tr>
          ${columns.map((key) => renderSummaryCell(key, row)).join("")}
        </tr>
      `).join("")}
    </tbody>
  `;
}

function renderKpis(summary) {
  const grid = document.querySelector("#kpi-grid");
  const presentKeys = new Set(Object.keys(summary));
  const orderedKeys = [
    ...kpiKeyOrder.filter((key) => presentKeys.has(key)),
    ...Object.keys(summary)
      .filter((key) => !kpiKeyOrder.includes(key) && !hiddenKpiKeys.has(key))
      .sort(),
  ];

  grid.innerHTML = orderedKeys
    .filter((key) => !hiddenKpiKeys.has(key))
    .map((key) => [key, summary[key]])
    .map(([key, value]) => {
      const cardClass = primaryKpiKeys.has(key)
        ? "primary-kpi"
        : costKpiKeys.has(key)
          ? "cost-kpi"
          : "secondary-kpi";
      const digits = primaryKpiKeys.has(key) || costKpiKeys.has(key) ? 3 : 2;
      return `
      <article class="kpi-card ${cardClass}">
        <span class="kpi-label">${escapeHtml(summaryLabels[key] ?? key)}</span>
        <span class="kpi-value">${escapeHtml(formatSummaryValue(key, value, digits))}</span>
      </article>
    `;
    })
    .join("");
}

function renderFactorInfo(data) {
  const metadata = data.metadata ?? {};
  const fieldName = metadata.field_name ?? data.factor ?? "-";
  const displayLabel = metadata.display_label
    ?? factorLabelMap.get(data.factor)
    ?? metadata.display_name
    ?? metadata.label
    ?? data.factor
    ?? "-";
  document.querySelector("#hero-title").textContent = displayLabel;
  document.querySelector("#hero-subtitle").textContent = fieldName;
  document.querySelector("#factor-parameters").textContent = metadata.parameter_text || "-";
  document.querySelector("#factor-formula").textContent = metadata.formula ?? "-";
  document.querySelector("#rebalance-period").textContent = `${data.horizon ?? "-"} 个交易日`;
}

function drawLineChart(canvas, rows) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width = canvas.clientWidth * devicePixelRatio;
  const height = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  const chartWidth = canvas.clientWidth;
  const chartHeight = canvas.clientHeight;
  const padding = { top: 28, right: 26, bottom: 58, left: 64 };
  const values = rows.map((row) => Number(row.ic));
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (!finiteValues.length) return;

  const min = Math.min(-0.06, ...finiteValues);
  const max = Math.max(0.06, ...finiteValues);
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const xStep = plotWidth / Math.max(rows.length - 1, 1);
  const x = (index) => padding.left + xStep * index;
  const y = (value) => padding.top + (max - value) / (max - min) * plotHeight;

  ctx.font = "12px Avenir Next";
  ctx.fillStyle = "#68766f";
  ctx.strokeStyle = "rgba(23, 33, 27, 0.18)";
  ctx.lineWidth = 1;

  const yTicks = 5;
  for (let index = 0; index <= yTicks; index += 1) {
    const value = min + (max - min) * index / yTicks;
    const tickY = y(value);
    ctx.beginPath();
    ctx.moveTo(padding.left, tickY);
    ctx.lineTo(chartWidth - padding.right, tickY);
    ctx.stroke();
    ctx.fillText(value.toFixed(3), 12, tickY + 4);
  }

  ctx.strokeStyle = "rgba(23, 33, 27, 0.55)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, chartHeight - padding.bottom);
  ctx.lineTo(chartWidth - padding.right, chartHeight - padding.bottom);
  ctx.stroke();

  ctx.fillStyle = "#17211b";
  ctx.font = "700 12px Avenir Next";
  ctx.fillText("IC", 14, padding.top - 10);
  ctx.fillText("交易日期", chartWidth - padding.right - 46, chartHeight - 18);

  const xTickCount = Math.min(6, rows.length);
  ctx.fillStyle = "#68766f";
  ctx.font = "12px Avenir Next";
  for (let index = 0; index < xTickCount; index += 1) {
    const rowIndex = Math.round(index * (rows.length - 1) / Math.max(xTickCount - 1, 1));
    const label = String(rows[rowIndex]?.trade_date ?? "");
    const tickX = x(rowIndex);
    ctx.beginPath();
    ctx.moveTo(tickX, chartHeight - padding.bottom);
    ctx.lineTo(tickX, chartHeight - padding.bottom + 5);
    ctx.stroke();
    ctx.save();
    ctx.translate(tickX - 18, chartHeight - padding.bottom + 24);
    ctx.rotate(-Math.PI / 7);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  ctx.strokeStyle = "rgba(189, 87, 52, 0.36)";
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(padding.left, y(0));
  ctx.lineTo(chartWidth - padding.right, y(0));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "#164c37";
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, index) => {
    const pointY = y(value);
    if (index === 0) ctx.moveTo(x(index), pointY);
    else ctx.lineTo(x(index), pointY);
  });
  ctx.stroke();
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
  const chartWidth = canvas.clientWidth;
  const chartHeight = canvas.clientHeight;
  const padding = { top: 20, right: 68, bottom: 24, left: 46 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const rowHeight = plotHeight / groups.length;
  const zeroX = padding.left + plotWidth / 2;
  const valueToWidth = (value) => Math.abs(value) / maxAbs * (plotWidth / 2);

  ctx.strokeStyle = "rgba(23, 33, 27, 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(zeroX, padding.top);
  ctx.lineTo(zeroX, chartHeight - padding.bottom);
  ctx.stroke();

  values.forEach((value, index) => {
    const centerY = padding.top + rowHeight * index + rowHeight / 2;
    const barHeight = Math.min(24, rowHeight * 0.56);
    const width = valueToWidth(value);
    const x = value >= 0 ? zeroX : zeroX - width;
    const y = centerY - barHeight / 2;

    ctx.fillStyle = value >= 0 ? "#164c37" : "#bd5734";
    ctx.fillRect(x, y, width, barHeight);

    ctx.fillStyle = "#68766f";
    ctx.font = "700 12px Avenir Next";
    ctx.fillText(labels[index], 14, centerY + 4);

    ctx.fillStyle = "#17211b";
    ctx.font = "700 12px Avenir Next";
    const formattedValue = `${(value * 100).toFixed(2)}%`;
    const labelX = value >= 0 ? x + width + 8 : x - ctx.measureText(formattedValue).width - 8;
    ctx.fillText(formattedValue, Math.max(padding.left, Math.min(labelX, chartWidth - padding.right + 22)), centerY + 4);
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

function renderSignalTable(target, rows) {
  const table = document.querySelector(target);
  if (!rows.length) {
    table.innerHTML = `<tbody><tr><td class="empty-cell">暂无最新信号数据</td></tr></tbody>`;
    return;
  }

  table.innerHTML = `
    <thead>
      <tr>
        <th>排名</th>
        <th>股票代码</th>
        <th>因子值</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.ts_code ?? "-")}</td>
          <td>${escapeHtml(formatNumber(row.factor_value, 4))}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
}

function renderStrongSignals(payload) {
  const updatedLabel = document.querySelector("#strong-signals-updated");
  const topRows = payload?.top_rows ?? payload?.rows ?? [];
  const bottomRows = payload?.bottom_rows ?? [];
  updatedLabel.textContent = `数据更新时间: ${payload?.updated_at ?? "-"}`;
  renderSignalTable("#top-signals-table", topRows);
  renderSignalTable("#bottom-signals-table", bottomRows);
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
  document.querySelector("#updated-label").textContent = `更新时间: ${formatDateTimeMinute(data.updated_at)}`;

  renderFactorInfo(data);
  renderKpis(data.summary);
  renderMetrics("#monitor-list", data.monitor_latest);
  renderMetrics("#raw-monitor-list", data.raw_monitor_latest);
  drawLineChart(document.querySelector("#ic-chart"), data.ic_timeseries);
  drawGroupChart(document.querySelector("#group-chart"), data.group_returns);
  renderStrongSignals(data.factor_signals ?? data.strong_signals);
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

function selectedCandidateHorizons() {
  return [...document.querySelectorAll(".candidate-horizon")]
    .filter((input) => input.checked)
    .map((input) => input.value);
}

async function loadCandidateLibrary() {
  const horizons = selectedCandidateHorizons();
  if (!horizons.length) {
    renderCandidateLibraryTable([]);
    return;
  }

  const responses = await Promise.all(
    horizons.map((horizon) => fetch(`/api/comparisons/horizon/${encodeURIComponent(horizon)}/summary`))
  );
  const payloads = await Promise.all(
    responses
      .filter((response) => response.ok)
      .map((response) => response.json())
  );
  const rows = payloads.flatMap((payload) => payload.rows ?? []);
  renderCandidateLibraryTable(rows);
}

function activateFactorFromTable(factor, horizon) {
  showFactorDetail();
  const factorInput = document.querySelector("#factor-input");
  factorInput.value = factor;
  loadHorizonOptions(factor)
    .then(() => {
      const horizonInput = document.querySelector("#horizon-input");
      if ([...horizonInput.options].some((option) => option.value === String(horizon))) {
        horizonInput.value = String(horizon);
      }
      return loadDashboard(factor, horizonInput.value);
    })
    .then(() => {
      document.querySelector("#factor-detail").scrollIntoView({ behavior: "smooth", block: "start" });
    })
    .catch((error) => {
      document.querySelector("#dataset-label").textContent = error.message;
    });
}

document.addEventListener("click", (event) => {
  const sortButton = event.target.closest(".sort-button");
  if (sortButton) {
    const target = sortButton.dataset.tableTarget;
    const key = sortButton.dataset.sortKey;
    const current = tableSortState[target];
    tableSortState[target] = {
      key,
      direction: current?.key === key && current.direction === "desc" ? "asc" : "desc",
    };
    if (target === "#candidate-factor-table") {
      renderCandidateLibraryTable(candidateLibraryRows);
      return;
    }
    loadSummaryComparisons(
      document.querySelector("#factor-input").value,
      document.querySelector("#horizon-input").value
    );
    return;
  }

  const factorLink = event.target.closest(".factor-link");
  if (factorLink) {
    activateFactorFromTable(factorLink.dataset.factor, factorLink.dataset.horizon);
  }
});

document.querySelector("#candidate-horizon-all").addEventListener("change", (event) => {
  document.querySelectorAll(".candidate-horizon").forEach((input) => {
    input.checked = event.target.checked;
  });
  loadCandidateLibrary().catch((error) => {
    document.querySelector("#candidate-factor-table").innerHTML = `<tbody><tr><td class="empty-cell">${escapeHtml(error.message)}</td></tr></tbody>`;
  });
});

document.querySelectorAll(".candidate-horizon").forEach((input) => {
  input.addEventListener("change", () => {
    const horizonInputs = [...document.querySelectorAll(".candidate-horizon")];
    const checkedCount = horizonInputs.filter((item) => item.checked).length;
    document.querySelector("#candidate-horizon-all").checked = checkedCount === horizonInputs.length;
    loadCandidateLibrary().catch((error) => {
      document.querySelector("#candidate-factor-table").innerHTML = `<tbody><tr><td class="empty-cell">${escapeHtml(error.message)}</td></tr></tbody>`;
    });
  });
});

document.querySelectorAll(".top-nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".top-nav-item").forEach((navItem) => navItem.classList.remove("active"));
    item.classList.add("active");
    if (item.getAttribute("href") === "#candidate-factor-library") {
      showCandidateLibrary();
    }
  });
});

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
  showFactorDetail();
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
  await loadCandidateLibrary();
  showCandidateLibrary();
}

document.querySelector("#factor-input").addEventListener("change", (event) => {
  const factor = event.target.value;
  showFactorDetail();
  loadHorizonOptions(factor)
    .then(() => loadDashboard(factor, document.querySelector("#horizon-input").value))
    .catch((error) => {
      document.querySelector("#dataset-label").textContent = error.message;
    });
});

document.querySelector("#horizon-input").addEventListener("change", () => {
  const factor = document.querySelector("#factor-input").value;
  showFactorDetail();
  loadDashboard(factor, document.querySelector("#horizon-input").value)
    .catch((error) => {
      document.querySelector("#dataset-label").textContent = error.message;
    });
});

bootDashboard().catch((error) => {
  document.querySelector("#dataset-label").textContent = error.message;
});
