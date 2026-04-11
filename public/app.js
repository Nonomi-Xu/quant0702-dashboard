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
  event_count: "事件数",
  bullish_event_count: "看涨事件数",
  bearish_event_count: "看跌事件数",
  avg_forward_return: "平均未来收益",
  median_forward_return: "中位未来收益",
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
  avg_daily_sample_count: "日均有效股票数",
  min_daily_sample_count: "最小有效股票数",
  max_daily_sample_count: "最大有效股票数",
  updated_at: "更新时间",
};

const percentKeys = new Set([
  "avg_forward_return",
  "median_forward_return",
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
  "avg_daily_sample_count",
  "min_daily_sample_count",
  "max_daily_sample_count",
];

const hiddenKpiKeys = new Set(["factor", "updated_at", "horizon"]);
const factorLabelMap = new Map();
const patternFactorLabelMap = new Map();
const tableSortState = {};
let candidateLibraryRows = [];
let candidateMetadataRows = [];
let patternMetadataRows = [];
let patternLibraryRows = [];
const tableThreeDigitKeys = new Set([
  "avg_forward_return",
  "median_forward_return",
  "ic_mean",
  "ic_ir",
  "long_short_mean",
  "long_short_sharpe",
  "long_short_gross_mean",
  "transaction_cost_mean",
]);
const primaryKpiKeys = new Set(["ic_mean", "ic_ir", "long_short_mean", "long_short_sharpe"]);
const costKpiKeys = new Set(["long_short_gross_mean", "transaction_cost_mean"]);
const sampleKpiKeys = new Set(["avg_daily_sample_count", "min_daily_sample_count", "max_daily_sample_count"]);
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
  "avg_daily_sample_count",
  "min_daily_sample_count",
  "max_daily_sample_count",
];

function escapeHtml(value) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showCandidateLibrary() {
  document.body.dataset.view = "candidate-library";
  document.querySelectorAll(".top-page").forEach((section) => section.classList.add("hidden"));
  document.querySelectorAll(".detail-section").forEach((section) => section.classList.add("hidden"));
  document.querySelector("#candidate-factor-library").classList.remove("hidden");
}

function showCandidateDashboard() {
  document.body.dataset.view = "candidate-dashboard";
  document.querySelectorAll(".top-page").forEach((section) => section.classList.add("hidden"));
  document.querySelectorAll(".detail-section").forEach((section) => section.classList.add("hidden"));
  document.querySelector("#candidate-factor-dashboard").classList.remove("hidden");
}

function showFactorDetail() {
  document.body.dataset.view = "detail";
  document.querySelectorAll(".top-page").forEach((section) => section.classList.add("hidden"));
  document.querySelectorAll(".detail-section").forEach((section) => section.classList.remove("hidden"));
}

function showFactorFilterRules() {
  document.body.dataset.view = "rules";
  document.querySelectorAll(".top-page").forEach((section) => section.classList.add("hidden"));
  document.querySelectorAll(".detail-section").forEach((section) => section.classList.add("hidden"));
  document.querySelector("#factor-filter-rules").classList.remove("hidden");
}

function showPatternFactorLibrary() {
  document.body.dataset.view = "pattern-library";
  document.querySelectorAll(".top-page").forEach((section) => section.classList.add("hidden"));
  document.querySelectorAll(".detail-section").forEach((section) => section.classList.add("hidden"));
  document.querySelector("#pattern-factor-library").classList.remove("hidden");
}

function showPatternFactorDashboard() {
  document.body.dataset.view = "pattern-dashboard";
  document.querySelectorAll(".top-page").forEach((section) => section.classList.add("hidden"));
  document.querySelectorAll(".detail-section").forEach((section) => section.classList.add("hidden"));
  document.querySelector("#pattern-factor-dashboard").classList.remove("hidden");
}

function navigateTopView(targetView) {
  if (targetView === "candidate-factor-library") {
    setActiveTopNav("#candidate-factor-library");
    setActiveCandidateSubnav(targetView);
    showCandidateLibrary();
    return;
  }

  if (targetView === "candidate-factor-dashboard") {
    setActiveTopNav("#candidate-factor-library");
    setActiveCandidateSubnav(targetView);
    showCandidateDashboard();
    return;
  }

  if (targetView === "factor-filter-rules") {
    setActiveTopNav("#factor-filter-rules");
    showFactorFilterRules();
    return;
  }

  if (targetView === "pattern-factor-library") {
    setActiveTopNav("#pattern-factor-library");
    setActivePatternSubnav(targetView);
    showPatternFactorLibrary();
    return;
  }

  if (targetView === "pattern-factor-dashboard") {
    setActiveTopNav("#pattern-factor-library");
    setActivePatternSubnav(targetView);
    showPatternFactorDashboard();
  }
}

function setActiveTopNav(targetHref) {
  document.querySelectorAll(".top-nav-item").forEach((navItem) => navItem.classList.remove("active"));
  document.querySelectorAll(".top-nav-group").forEach((group) => group.classList.remove("active"));
  if (!targetHref) return;

  const directItem = document.querySelector(`.top-nav-item[href="${targetHref}"]`);
  if (directItem) {
    directItem.classList.add("active");
    return;
  }

  const candidateGroup = document.querySelector('[data-nav-group="candidate-factor"]');
  const candidateTrigger = candidateGroup?.querySelector(".top-nav-trigger");
  if (candidateGroup && candidateTrigger) {
    if (targetHref === "#candidate-factor-library") {
      candidateGroup.classList.add("active");
      candidateTrigger.classList.add("active");
      return;
    }
  }

  const patternGroup = document.querySelector('[data-nav-group="pattern-factor"]');
  const patternTrigger = patternGroup?.querySelector(".top-nav-trigger");
  if (patternGroup && patternTrigger && targetHref === "#pattern-factor-library") {
    patternGroup.classList.add("active");
    patternTrigger.classList.add("active");
  }
}

function setActiveCandidateSubnav(targetView) {
  document.querySelectorAll('[data-nav-group="candidate-factor"] .top-subnav-item').forEach((item) => {
    item.classList.toggle("active", item.dataset.viewTarget === targetView);
  });
}

function setActivePatternSubnav(targetView) {
  document.querySelectorAll('[data-nav-group="pattern-factor"] .top-subnav-item').forEach((item) => {
    item.classList.toggle("active", item.dataset.viewTarget === targetView);
  });
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

function summaryColumnClass(key) {
  return `summary-col summary-col-${String(key).replace(/_/g, "-")}`;
}

function headerLabelHtml(target, key, label) {
  if (target !== "#candidate-factor-table") return escapeHtml(label);

  const wrappedLabels = {
    ic_abs_gt_002_ratio: '|IC| > 0.02<br><span class="header-sub">比例</span>',
    ic_positive_ratio: 'IC为正<br><span class="header-sub">比例</span>',
    long_short_gross_mean: '多空平均收益<br><span class="header-sub">扣费前</span>',
    long_short_mean: '多空平均<br><span class="header-sub">收益</span>',
    long_short_sharpe: '多空年化<br><span class="header-sub">夏普</span>',
    long_short_max_drawdown: '最大<br><span class="header-sub">回撤</span>',
    transaction_cost_mean: '平均<br><span class="header-sub">交易成本</span>',
    long_group_turnover: '最高组<br><span class="header-sub">换手</span>',
    short_group_turnover: '最低组<br><span class="header-sub">换手</span>',
    long_short_turnover: '多空<br><span class="header-sub">换手率</span>',
    avg_daily_sample_count: '日均有效<br><span class="header-sub">股票数</span>',
    min_daily_sample_count: '最小有效<br><span class="header-sub">股票数</span>',
    max_daily_sample_count: '最大有效<br><span class="header-sub">股票数</span>',
  };

  return wrappedLabels[key] ?? escapeHtml(label);
}

function isCandidateRuleHit(key, value) {
  const number = Number(value);
  if (Number.isNaN(number)) return false;

  if (key === "ic_mean") return number > 0.02;
  if (key === "ic_ir") return number > 0.5;
  if (key === "ic_abs_gt_002_ratio") return number > 0.4;
  if (key === "ic_positive_ratio") return number > 0.6 || number < 0.4;
  if (key === "long_short_turnover") return number < 0.4;
  return false;
}

function renderTableHeader(target, key) {
  const label = key === "horizon" ? "调仓周期（天）" : summaryLabels[key] ?? key;
  const columnClass = summaryColumnClass(key);
  if (key === "factor") return `<th class="${columnClass}">${headerLabelHtml(target, key, label)}</th>`;

  const state = tableSortState[target];
  const marker = state?.key === key ? (state.direction === "asc" ? " ↑" : " ↓") : "";
  return `
    <th class="${columnClass}">
      <button class="sort-button" type="button" data-table-target="${escapeHtml(target)}" data-sort-key="${escapeHtml(key)}">
        ${headerLabelHtml(target, key, label)}${escapeHtml(marker)}
      </button>
    </th>
  `;
}

function renderSummaryCell(target, key, row) {
  const cellClass = [
    summaryColumnClass(key),
    target === "#candidate-factor-table" && isCandidateRuleHit(key, row[key]) ? "candidate-rule-hit" : "",
  ].filter(Boolean).join(" ");

  if (key === "factor" && row.factor_key) {
    const horizon = row.horizon ?? document.querySelector("#horizon-input").value;
    return `
      <td class="${cellClass}">
        <button class="factor-link" type="button" data-factor="${escapeHtml(row.factor_key)}" data-horizon="${escapeHtml(horizon)}">
          ${escapeHtml(formatSummaryValue(key, row[key], tableThreeDigitKeys.has(key) ? 3 : 1))}
        </button>
      </td>
    `;
  }

  return `<td class="${cellClass}">${escapeHtml(formatSummaryValue(key, row[key], tableThreeDigitKeys.has(key) ? 3 : 1))}</td>`;
}

function renderCandidateLibraryTable(rows = candidateLibraryRows) {
  candidateLibraryRows = rows;
  renderSummaryTable("#candidate-factor-table", candidateLibraryRows);
}

function sortCandidateLibraryRows(rows) {
  return [...rows].sort((left, right) => (
    Number(left.horizon ?? 0) - Number(right.horizon ?? 0)
    || String(left.factor_key ?? left.factor ?? "").localeCompare(
      String(right.factor_key ?? right.factor ?? ""),
      "en",
      { sensitivity: "base" }
    )
  ));
}

function renderPatternLibraryTable(rows = patternLibraryRows) {
  patternLibraryRows = rows;
  renderSummaryTable("#pattern-factor-table", patternLibraryRows);
}

function sortCandidateMetadataRows(rows) {
  return [...rows].sort((left, right) => (
    String(left.field_name ?? "").localeCompare(String(right.field_name ?? ""), "en", { sensitivity: "base" })
  ));
}

function renderCandidateMetadataTable(rows = candidateMetadataRows) {
  candidateMetadataRows = sortCandidateMetadataRows(rows);
  const table = document.querySelector("#candidate-factor-metadata-table");
  if (!candidateMetadataRows.length) {
    table.innerHTML = `<tbody><tr><td class="empty-cell">暂无候选因子元信息</td></tr></tbody>`;
    return;
  }

  table.innerHTML = `
    <thead>
      <tr>
        <th>字段名</th>
        <th>中文名</th>
        <th>数学公式</th>
      </tr>
    </thead>
    <tbody>
      ${candidateMetadataRows.map((row) => `
        <tr>
          <td>${escapeHtml(row.field_name ?? "-")}</td>
          <td>
            <button class="factor-link" type="button" data-factor="${escapeHtml(row.field_name ?? "")}" data-horizon="5">
              ${escapeHtml(row.display_name ?? row.display_label ?? row.label ?? "-")}
            </button>
          </td>
          <td class="formula-cell">${escapeHtml(row.formula ?? "-")}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
}

function renderPatternMetadataTable(rows = patternMetadataRows) {
  patternMetadataRows = sortCandidateMetadataRows(rows);
  const table = document.querySelector("#pattern-factor-metadata-table");
  if (!patternMetadataRows.length) {
    table.innerHTML = `<tbody><tr><td class="empty-cell">暂无K线因子元信息</td></tr></tbody>`;
    return;
  }

  table.innerHTML = `
    <thead>
      <tr>
        <th>字段名</th>
        <th>中文名</th>
        <th>数学公式</th>
      </tr>
    </thead>
    <tbody>
      ${patternMetadataRows.map((row) => `
        <tr>
          <td>${escapeHtml(row.field_name ?? "-")}</td>
          <td>${escapeHtml(row.display_name ?? row.display_label ?? row.label ?? "-")}</td>
          <td class="formula-cell">${escapeHtml(row.formula ?? "-")}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
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
  } else if (target === "#candidate-factor-table" || target === "#pattern-factor-table") {
    sortedRows.sort((left, right) => (
      Number(left.horizon ?? 0) - Number(right.horizon ?? 0)
      || String(left.factor_key ?? left.factor ?? "").localeCompare(
        String(right.factor_key ?? right.factor ?? ""),
        "en",
        { sensitivity: "base" }
      )
    ));
  }

  table.innerHTML = `
    <thead>
      <tr>${columns.map((key) => renderTableHeader(target, key)).join("")}</tr>
    </thead>
    <tbody>
      ${sortedRows.map((row) => `
        <tr>
          ${columns.map((key) => renderSummaryCell(target, key, row)).join("")}
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
          : sampleKpiKeys.has(key)
            ? "sample-kpi"
            : "secondary-kpi";
      const digits = primaryKpiKeys.has(key) || costKpiKeys.has(key)
        ? 3
        : sampleKpiKeys.has(key)
          ? 0
          : 2;
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
  const factorResponse = await fetch(`/api/comparisons/factor/${encodeURIComponent(factor)}/summary`);

  if (factorResponse.ok) {
    const payload = await factorResponse.json();
    renderSummaryTable("#factor-horizon-table", payload.rows ?? []);
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
  const rows = sortCandidateLibraryRows(payloads.flatMap((payload) => payload.rows ?? []));
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
      renderCandidateLibraryTable();
      return;
    }
    if (target === "#pattern-factor-table") {
      renderPatternLibraryTable();
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
    return;
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

document.querySelector("#pattern-horizon-all").addEventListener("change", (event) => {
  document.querySelectorAll(".pattern-horizon").forEach((input) => {
    input.checked = event.target.checked;
  });
  loadPatternLibrary().catch((error) => {
    document.querySelector("#pattern-factor-table").innerHTML = `<tbody><tr><td class="empty-cell">${escapeHtml(error.message)}</td></tr></tbody>`;
  });
});

document.querySelectorAll(".pattern-horizon").forEach((input) => {
  input.addEventListener("change", () => {
    const horizonInputs = [...document.querySelectorAll(".pattern-horizon")];
    const checkedCount = horizonInputs.filter((item) => item.checked).length;
    document.querySelector("#pattern-horizon-all").checked = checkedCount === horizonInputs.length;
    loadPatternLibrary().catch((error) => {
      document.querySelector("#pattern-factor-table").innerHTML = `<tbody><tr><td class="empty-cell">${escapeHtml(error.message)}</td></tr></tbody>`;
    });
  });
});

document.querySelectorAll(".top-subnav-item").forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTopView(item.dataset.viewTarget);
  });
});

document.querySelectorAll('.top-nav-item[href]').forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    const href = item.getAttribute("href");
    if (href === "#factor-filter-rules") {
      navigateTopView("factor-filter-rules");
      return;
    }
    if (href === "#pattern-factor-library") {
      navigateTopView("pattern-factor-library");
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

async function loadPatternFactorOptions() {
  const response = await fetch("/api/pattern-factors");
  if (!response.ok) return [];
  const data = await response.json();
  const factors = data.factors ?? [];
  patternFactorLabelMap.clear();
  (data.factor_options ?? []).forEach((option) => {
    patternFactorLabelMap.set(option.value, option.label);
  });
  return factors;
}

async function loadCandidateMetadata(factors = []) {
  const response = await fetch("/api/factor-metadata");
  if (!response.ok) {
    renderCandidateMetadataTable([]);
    return;
  }

  const payload = await response.json();
  const metadata = payload.metadata ?? {};
  const keys = factors.length ? factors : Object.keys(metadata);
  const rows = keys.map((factor) => {
    const item = metadata[factor] ?? {};
    return {
      field_name: item.field_name ?? factor,
      display_name: item.display_name ?? item.display_label ?? item.label ?? factorLabelMap.get(factor) ?? factor,
      formula: item.formula ?? "-",
    };
  });

  renderCandidateMetadataTable(rows.filter((row) => row.field_name));
}

async function loadPatternFactorMetadata() {
  const factors = await loadPatternFactorOptions();
  const response = await fetch("/api/pattern-factor-metadata");
  if (!response.ok) {
    renderPatternMetadataTable([]);
    return;
  }

  const payload = await response.json();
  const metadata = payload.metadata ?? {};
  const keys = factors.length ? factors : Object.keys(metadata);
  const rows = keys.map((factor) => {
    const item = metadata[factor] ?? {};
    return {
      field_name: item.field_name ?? factor,
      display_name: item.display_name ?? item.display_label ?? item.label ?? patternFactorLabelMap.get(factor) ?? factor,
      formula: item.formula ?? "-",
    };
  });

  renderPatternMetadataTable(rows.filter((row) => row.field_name));
}

function selectedPatternHorizons() {
  return [...document.querySelectorAll(".pattern-horizon")]
    .filter((input) => input.checked)
    .map((input) => input.value);
}

async function loadPatternLibrary() {
  const horizons = selectedPatternHorizons();
  if (!horizons.length) {
    renderPatternLibraryTable([]);
    return;
  }

  const responses = await Promise.all(
    horizons.map((horizon) => fetch(`/api/pattern-comparisons/horizon/${encodeURIComponent(horizon)}/summary`))
  );
  const payloads = await Promise.all(
    responses
      .filter((response) => response.ok)
      .map((response) => response.json())
  );
  const rows = sortCandidateLibraryRows(payloads.flatMap((payload) => payload.rows ?? []));
  renderPatternLibraryTable(rows);
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
  await loadCandidateMetadata(factors);
  await loadPatternFactorMetadata();
  const initialFactor = factors[0] ?? "";
  const factorInput = document.querySelector("#factor-input");
  factorInput.value = initialFactor;
  if (!initialFactor) {
    document.querySelector("#dataset-label").textContent = "暂无已完成的因子评测结果";
    return;
  }
  await loadHorizonOptions(initialFactor);
  await loadCandidateLibrary();
  await loadPatternLibrary();
  setActiveTopNav("#candidate-factor-library");
  setActiveCandidateSubnav("candidate-factor-library");
  setActivePatternSubnav("pattern-factor-library");
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
