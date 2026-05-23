const state = {
  rows: [],
  filtered: [],
  charts: {},
};

const els = {
  colourFilter: document.getElementById("colourFilter"),
  ecoFilter: document.getElementById("ecoFilter"),
  familyFilter: document.getElementById("familyFilter"),
  searchInput: document.getElementById("searchInput"),
  minGamesInput: document.getElementById("minGamesInput"),
  minPerfInput: document.getElementById("minPerfInput"),
  minAvgPlayerInput: document.getElementById("minAvgPlayerInput"),
  minWinPctInput: document.getElementById("minWinPctInput"),
  kpiTotalGames: document.getElementById("kpiTotalGames"),
  kpiOpenings: document.getElementById("kpiOpenings"),
  kpiTopOpening: document.getElementById("kpiTopOpening"),
  kpiWeightedWin: document.getElementById("kpiWeightedWin"),
  kpiAvgPerf: document.getElementById("kpiAvgPerf"),
  tableBody: document.querySelector("#dataTable tbody"),
};

function parseNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? NaN : n;
}

function getOpeningFamily(opening) {
  if (!opening) return "Unknown";
  const parts = opening.split("  ").map((x) => x.trim()).filter(Boolean);
  if (parts.length > 0) return parts[0];
  return opening.split(":")[0].trim();
}

function mapRow(r) {
  return {
    opening: String(r.Opening || "Unknown").trim(),
    family: getOpeningFamily(String(r.Opening || "Unknown")),
    colour: String(r.Colour || "Unknown").trim().toLowerCase(),
    numGames: parseNumber(r["Num Games"] || 0),
    eco: String(r.ECO || "Unknown").trim(),
    lastPlayed: String(r["Last Played"] || "").trim(),
    perfRating: parseNumber(r["Perf Rating"]),
    avgPlayer: parseNumber(r["Avg Player"]),
    playerWinPct: parseNumber(r["Player Win %"]),
    drawPct: parseNumber(r["Draw %"]),
    opponentWinPct: parseNumber(r["Opponent Win %"]),
  };
}

function setSelectOptions(selectEl, values, allLabel = "All") {
  const opts = [`<option value="All">${allLabel}</option>`];
  values.forEach((v) => opts.push(`<option value="${v}">${v}</option>`));
  selectEl.innerHTML = opts.join("");
}

function computeFilterValues(rows) {
  const colours = [...new Set(rows.map((r) => r.colour))].sort();
  const ecos = [...new Set(rows.map((r) => r.eco))].sort();
  const families = [...new Set(rows.map((r) => r.family))].sort();
  setSelectOptions(els.colourFilter, colours, "All Colours");
  setSelectOptions(els.ecoFilter, ecos, "All ECO");
  setSelectOptions(els.familyFilter, families, "All Families");
}

function applyFilters() {
  const q = els.searchInput.value.trim().toLowerCase();
  const colour = els.colourFilter.value;
  const eco = els.ecoFilter.value;
  const family = els.familyFilter.value;
  const minGames = parseNumber(els.minGamesInput.value) || 0;
  const minPerf = parseNumber(els.minPerfInput.value) || 0;
  const minAvgPlayer = parseNumber(els.minAvgPlayerInput.value) || 0;
  const minWinPct = parseNumber(els.minWinPctInput.value) || 0;

  state.filtered = state.rows.filter((r) => {
    const colourOk = colour === "All" || r.colour === colour;
    const ecoOk = eco === "All" || r.eco === eco;
    const familyOk = family === "All" || r.family === family;
    const queryOk =
      !q ||
      r.opening.toLowerCase().includes(q) ||
      r.eco.toLowerCase().includes(q) ||
      r.family.toLowerCase().includes(q);
    const gamesOk = r.numGames >= minGames;
    const perfOk = Number.isNaN(r.perfRating) ? false : r.perfRating >= minPerf;
    const avgPlayerOk = Number.isNaN(r.avgPlayer) ? false : r.avgPlayer >= minAvgPlayer;
    const winOk = Number.isNaN(r.playerWinPct) ? false : r.playerWinPct >= minWinPct;
    return colourOk && ecoOk && familyOk && queryOk && gamesOk && perfOk && avgPlayerOk && winOk;
  });
}

function updateKpis() {
  const rows = state.filtered;
  const totalGames = rows.reduce((s, r) => s + (Number.isNaN(r.numGames) ? 0 : r.numGames), 0);
  const top = [...rows].sort((a, b) => b.numGames - a.numGames)[0];

  const weightedWinRows = rows.filter((r) => !Number.isNaN(r.playerWinPct) && !Number.isNaN(r.numGames));
  const weightedWinNumerator = weightedWinRows.reduce((s, r) => s + r.playerWinPct * r.numGames, 0);
  const weightedWinDenominator = weightedWinRows.reduce((s, r) => s + r.numGames, 0);
  const weightedWin = weightedWinDenominator > 0 ? weightedWinNumerator / weightedWinDenominator : NaN;

  const avgPerfRows = rows.filter((r) => !Number.isNaN(r.perfRating));
  const avgPerf = avgPerfRows.length
    ? avgPerfRows.reduce((s, r) => s + r.perfRating, 0) / avgPerfRows.length
    : NaN;

  els.kpiTotalGames.textContent = totalGames.toLocaleString();
  els.kpiOpenings.textContent = rows.length.toLocaleString();
  els.kpiTopOpening.textContent = top ? top.opening : "-";
  els.kpiWeightedWin.textContent = Number.isNaN(weightedWin) ? "-" : `${weightedWin.toFixed(1)}%`;
  els.kpiAvgPerf.textContent = Number.isNaN(avgPerf) ? "-" : avgPerf.toFixed(0);
}

function destroyCharts() {
  Object.values(state.charts).forEach((chart) => chart.destroy());
}

function renderCharts() {
  destroyCharts();
  const rows = state.filtered;

  const topOpenings = [...rows]
    .sort((a, b) => b.numGames - a.numGames)
    .slice(0, 15);

  const colourMap = rows.reduce((acc, r) => {
    acc[r.colour] = (acc[r.colour] || 0) + r.numGames;
    return acc;
  }, {});

  const ecoMap = rows.reduce((acc, r) => {
    acc[r.eco] = (acc[r.eco] || 0) + r.numGames;
    return acc;
  }, {});
  const ecoTop = Object.entries(ecoMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  state.charts.top = new Chart(document.getElementById("topOpeningsChart"), {
    type: "bar",
    data: {
      labels: topOpenings.map((x) => x.opening),
      datasets: [{ label: "Num Games", data: topOpenings.map((x) => x.numGames), backgroundColor: "#3b82f6" }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { display: false } },
    },
  });

  state.charts.colour = new Chart(document.getElementById("colourChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(colourMap),
      datasets: [{ data: Object.values(colourMap), backgroundColor: ["#10b981", "#3b82f6", "#f59e0b"] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.8,
    },
  });

  state.charts.scatter = new Chart(document.getElementById("scatterChart"), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Openings",
          data: rows
            .filter((r) => !Number.isNaN(r.playerWinPct))
            .slice(0, 200)
            .map((r) => ({ x: r.numGames, y: r.playerWinPct })),
          backgroundColor: "#10b981",
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: "Num Games" } },
        y: { title: { display: true, text: "Player Win %" }, min: 0, max: 100 },
      },
    },
  });

  state.charts.eco = new Chart(document.getElementById("ecoChart"), {
    type: "bar",
    data: {
      labels: ecoTop.map((x) => x[0]),
      datasets: [{ label: "Num Games", data: ecoTop.map((x) => x[1]), backgroundColor: "#8b5cf6" }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

function renderTable() {
  const slice = state.filtered.slice(0, 300);
  const rowsHtml = slice
    .map(
      (r) => `<tr>
      <td>${r.opening}</td>
      <td>${r.family}</td>
      <td>${r.colour}</td>
      <td>${r.numGames}</td>
      <td>${r.eco}</td>
      <td>${Number.isNaN(r.perfRating) ? "-" : r.perfRating}</td>
      <td>${Number.isNaN(r.avgPlayer) ? "-" : r.avgPlayer}</td>
      <td>${Number.isNaN(r.playerWinPct) ? "-" : r.playerWinPct}</td>
      <td>${Number.isNaN(r.drawPct) ? "-" : r.drawPct}</td>
      <td>${Number.isNaN(r.opponentWinPct) ? "-" : r.opponentWinPct}</td>
      <td>${r.lastPlayed || "-"}</td>
    </tr>`
    )
    .join("");
  els.tableBody.innerHTML = rowsHtml;
}

function refreshView() {
  applyFilters();
  updateKpis();
  renderCharts();
  renderTable();
}

function loadFromText(csvText) {
  Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      state.rows = (res.data || []).map(mapRow).filter((r) => r.opening && !Number.isNaN(r.numGames));
      computeFilterValues(state.rows);
      refreshView();
    },
  });
}

async function loadDefaultCsv() {
  try {
    if (window.location.protocol === "file:") {
      throw new Error("fetch_blocked_on_file_protocol");
    }
    const response = await fetch("./openings_commas_cleaned_dates_fixed.csv");
    if (!response.ok) {
      throw new Error(`http_${response.status}`);
    }
    const text = await response.text();
    loadFromText(text);
  } catch (error) {
    alert("Could not load default CSV from this page. Please open via http://localhost (serve the folder with a local static server).");
  }
}

[
  els.colourFilter,
  els.ecoFilter,
  els.familyFilter,
  els.searchInput,
  els.minGamesInput,
  els.minPerfInput,
  els.minAvgPlayerInput,
  els.minWinPctInput,
].forEach((el) => {
  el.addEventListener("input", refreshView);
  el.addEventListener("change", refreshView);
});

computeFilterValues([]);

// Auto-load workspace CSV on page open.
loadDefaultCsv();
