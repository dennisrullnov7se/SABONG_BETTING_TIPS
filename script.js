const STORAGE_ENTRIES = 'sabong_entries_v1';
const STORAGE_PATTERNS = 'sabong_patterns_v1';

const startNumberInput = document.getElementById('startNumber');
const winnerSelect = document.getElementById('winnerSelect');
const sideSelect = document.getElementById('sideSelect');
const undoButton = document.getElementById('undoButton');
const redoButton = document.getElementById('redoButton');
const submitButton = document.getElementById('submitButton');
const resetButton = document.getElementById('resetButton');
const gameResultList = document.getElementById('gameResultList');
const tallyTableBody = document.getElementById('tallyTableBody');
const pustaNaCard = document.getElementById('pustaNaCard');
const historyTableBody = document.getElementById('historyTableBody');
const historyGraph = document.getElementById('historyGraph');
const meronWalaStreaks = document.getElementById('meronWalaStreaks');
const meronWalaGraph = document.getElementById('meronWalaGraph');
const lyamadoDehadoStreaks = document.getElementById('lyamadoDehadoStreaks');
const lyamadoDehadoGraph = document.getElementById('lyamadoDehadoGraph');
const statSuggestion = document.getElementById('statSuggestion');
const statConfidence = document.getElementById('statConfidence');
const statAnalysis = document.getElementById('statAnalysis');
const patternInput = document.getElementById('patternInput');
const patternResultInput = document.getElementById('patternResultInput');
const addPatternButton = document.getElementById('addPatternButton');
const patternList = document.getElementById('patternList');
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanes = document.querySelectorAll('.tab-pane');

let entries = [];
let patterns = [];
let redoStack = [];
let editingPatternId = null;

const COMBOS = [
  'Wala Lyamado',
  'Meron Lyamado',
  'Wala Dehado',
  'Meron Dehado'
];

const VALID_WINNERS = ['Meron', 'Wala'];
const VALID_SIDES = ['Lyamado', 'Dehado'];

function loadData() {
  const storedEntries = localStorage.getItem(STORAGE_ENTRIES);
  const storedPatterns = localStorage.getItem(STORAGE_PATTERNS);
  entries = storedEntries ? JSON.parse(storedEntries) : [];
  patterns = storedPatterns ? JSON.parse(storedPatterns) : [];
}

function saveData() {
  localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(entries));
  localStorage.setItem(STORAGE_PATTERNS, JSON.stringify(patterns));
}

function createEntry(start, winner, side) {
  return {
    id: Date.now() + Math.random(),
    start,
    winner,
    side,
    combo: getComboLabel(winner, side),
    createdAt: new Date().toISOString()
  };
}

function getComboLabel(winner, side) {
  if (VALID_WINNERS.includes(winner) && VALID_SIDES.includes(side)) {
    return `${winner} ${side}`;
  }
  if (winner === 'NC' || side === 'NC') {
    return 'NC';
  }
  if (winner === 'Draw' || side === 'Draw') {
    return 'Draw';
  }
  return 'Other';
}

function renderTabs() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(button.dataset.tab).classList.add('active');
    });
  });
}

function renderMainView() {
  const lastFive = [...entries]
    .slice(-5)
    .sort((a, b) => (a.start || 0) - (b.start || 0));
  gameResultList.innerHTML = lastFive.length === 0 ? '<div class="result-item">No recent results yet.</div>' : lastFive.map(entry => `
    <div class="result-item ${entry.winner ? entry.winner.toLowerCase() : ''}">
      <div>${entry.start ?? '—'} . ${entry.combo}</div>
    </div>
  `).join('');

  const comboData = getCombosCounts();
  const totalComboCount = COMBOS.reduce((sum, combo) => sum + (comboData[combo] || 0), 0);
  const tallySummary = document.getElementById('tallySummary');
  if (tallySummary) tallySummary.textContent = `Total combos: ${totalComboCount}`;
  tallyTableBody.innerHTML = COMBOS.map(combo => {
    const count = comboData[combo] || 0;
    if (count === 0) {
      return '';
    }
    const percentage = totalComboCount ? ((count / totalComboCount) * 100).toFixed(1) : '0.0';
    return `<tr><td>${combo}</td><td>${count}</td><td>${percentage}%</td></tr>`;
  }).join('') || '<tr><td colspan="3" class="muted">No valid combos yet.</td></tr>';

  const allPercentages = COMBOS.map(combo => ({ combo, percent: totalComboCount ? (comboData[combo] / totalComboCount) : 0 }));
  const top = allPercentages.reduce((best, current) => current.percent > best.percent ? current : best, { percent: -1 });
  Array.from(tallyTableBody.children).forEach(row => {
    if (row.children[0] && row.children[0].textContent === top.combo) {
      row.style.background = 'rgba(56, 189, 248, 0.12)';
    }
  });

  const suggestion = computeSuggestion();
  const confidence = getPrimaryConfidence();
  if (suggestion === 'PASS') {
    pustaNaCard.textContent = 'PASS';
  } else {
    pustaNaCard.textContent = `${suggestion} ${confidence !== null ? '(' + Math.round(confidence * 100) + '%)' : ''}`;
  }
}

function renderHistory() {
  historyTableBody.innerHTML = entries.map((entry) => `
    <tr>
      <td>${entry.start ?? '—'}</td>
      <td>${entry.winner}</td>
      <td>${entry.side}</td>
      <td>${entry.combo}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" class="muted">No entries yet.</td></tr>';

  const comboData = getCombosCounts();
  const data = COMBOS.map(combo => ({ combo, count: comboData[combo] || 0 }))
    .filter(item => item.count > 0)
    .sort((a, b) => a.count - b.count);

  historyGraph.innerHTML = data.length === 0 ? '<div class="result-item">No graph data yet.</div>' : data.map(item => renderBarRow(item.combo, item.count, getComboPercent(item.count))).join('');
}

function renderMeronWala() {
  const winnerEntries = entries.filter(entry => VALID_WINNERS.includes(entry.winner)).map(entry => ({ value: entry.winner, round: entry.start ?? null }));
  meronWalaStreaks.innerHTML = winnerEntries.length === 0 ? '<div class="result-item">No Meron/Wala streaks yet.</div>' : buildStreakMarkup(winnerEntries, 'winner');

  const counts = { Meron: 0, Wala: 0 };
  winnerEntries.forEach(entry => counts[entry.value]++);
  const data = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.count - b.count);

  meronWalaGraph.innerHTML = data.length === 0 ? '<div class="result-item">No Meron/Wala graph yet.</div>' : data.map(item => {
    const label = item.label;
    const value = (item.count / winnerEntries.length) * 100;
    return renderBarRow(label, item.count, value, label === 'Meron' ? 'var(--meron)' : 'var(--wala)');
  }).join('');
}

function renderLyamadoDehado() {
  const sideEntries = entries.filter(entry => VALID_SIDES.includes(entry.side)).map(entry => ({ value: entry.side, round: entry.start ?? null }));
  lyamadoDehadoStreaks.innerHTML = sideEntries.length === 0 ? '<div class="result-item">No Lyamado/Dehado streaks yet.</div>' : buildStreakMarkup(sideEntries, 'side');

  const counts = { Lyamado: 0, Dehado: 0 };
  sideEntries.forEach(entry => counts[entry.value]++);
  const data = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.count - b.count);

  lyamadoDehadoGraph.innerHTML = data.length === 0 ? '<div class="result-item">No Lyamado/Dehado graph yet.</div>' : data.map(item => {
    const label = item.label;
    const value = (item.count / sideEntries.length) * 100;
    const color = label === 'Lyamado' ? 'var(--lyamado)' : 'var(--dehado)';
    return renderBarRow(label, item.count, value, color);
  }).join('');
}

function renderStatistic() {
  const winners = entries.filter(entry => VALID_WINNERS.includes(entry.winner)).map(entry => entry.winner);
  const computed = computeMarkov(winners);
  const suggestion = computeSuggestion();
  const probability = computed.probability;
  const forecast = computed.forecast || '—';
  const primaryConfidence = getPrimaryConfidence();
  const confidenceScore = getConfidenceLabel(primaryConfidence);

  statSuggestion.textContent = suggestion;
  statConfidence.textContent = `${confidenceScore.label} (${Math.round(confidenceScore.score * 100)}%)`;

  const lines = [];
  if (winners.length === 0) {
    lines.push('<p>No valid Meron/Wala entries available yet for statistic analysis.</p>');
  } else {
    lines.push(`<p>Last winner entries: ${winners.join(' → ')}</p>`);
    lines.push(`<p>Markov forecast after last entry (${winners[winners.length - 1]}): <strong>${forecast}</strong> with probability <strong>${Math.round(probability * 100)}%</strong>.</p>`);
    if (suggestion === 'PASS') {
      lines.push('<p>No saved pattern matched the last sequence, so the main recommendation is PASS.</p>');
      lines.push('<p>If you still want a forecast, the Markov model provides a reference prediction based on historical transitions.</p>');
    } else {
      lines.push(`<p>Pattern suggestion from Settings: <strong>${suggestion}</strong>.</p>`);
      lines.push('<p>The confidence level combines that pattern suggestion with the transition probability.</p>');
    }
  }
  statAnalysis.innerHTML = lines.join('');
}

function renderSettings() {
  if (patterns.length === 0) {
    patternList.innerHTML = '<div class="result-item">No patterns added yet.</div>';
  } else {
    patternList.innerHTML = patterns.map(pattern => `
      <div class="pattern-item" data-id="${pattern.id}">
        <div><strong>${pattern.seq.join(', ')}</strong> → ${pattern.result}</div>
        <div class="pattern-actions">
          <button type="button" class="edit-pattern" data-id="${pattern.id}">Edit</button>
          <button type="button" class="delete-pattern" data-id="${pattern.id}">Delete</button>
        </div>
      </div>
    `).join('');

    // attach delegated handlers for edit/delete
    patternList.querySelectorAll('.edit-pattern').forEach(btn => btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      editPattern(id);
    }));
    patternList.querySelectorAll('.delete-pattern').forEach(btn => btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      removePattern(id);
    }));
  }
}

function buildStreakMarkup(items, type) {
  const streakRows = [];
  let currentRow = [];
  let currentValue = null;

  items.forEach(item => {
    if (currentValue === null || currentValue === item.value) {
      currentRow.push(item);
      currentValue = item.value;
    } else {
      streakRows.push(currentRow);
      currentRow = [item];
      currentValue = item.value;
    }
  });
  if (currentRow.length > 0) streakRows.push(currentRow);

  // Render each streak as a vertical column of boxes
  return streakRows.map(row => `
    <div class="streak-column">
      ${row.map(item => `
        <div class="streak-box ${getStreakClass(item.value)}">
          ${item.value}<br><small>${item.round ?? ''}</small>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function getStreakClass(value) {
  if (value === 'Meron') return 'meron';
  if (value === 'Wala') return 'wala';
  if (value === 'Lyamado') return 'lyamado';
  if (value === 'Dehado') return 'dehado';
  return '';
}

function renderBarRow(label, count, value, color = 'var(--accent)') {
  return `
    <div class="bar-row">
      <div class="bar-label"><span>${label}</span><span>${count} (${value.toFixed(1)}%)</span></div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${value.toFixed(1)}%; background: ${color};"></div>
      </div>
    </div>
  `;
}

function getComboPercent(count) {
  const total = COMBOS.reduce((sum, combo) => sum + (getCombosCounts()[combo] || 0), 0);
  return total === 0 ? 0 : (count / total) * 100;
}

function getCombosCounts() {
  return entries.reduce((acc, entry) => {
    if (COMBOS.includes(entry.combo)) {
      acc[entry.combo] = (acc[entry.combo] || 0) + 1;
    }
    return acc;
  }, {});
}

// Helpers for pattern target inference and matching
function inferPatternTargetFromSeq(seq) {
  const lower = seq.map(s => s.toLowerCase());
  const allWinner = lower.every(v => VALID_WINNERS.some(w => w.toLowerCase() === v));
  const allSide = lower.every(v => VALID_SIDES.some(s => s.toLowerCase() === v));
  if (allWinner) return 'winner';
  if (allSide) return 'side';
  return null;
}

function matchPatternForSequence(sequence, target) {
  if (!sequence || sequence.length === 0) return null;

  // Try patterns with explicit target first, then fallback to inferred ones
  const candidates = patterns
    .filter(p => p.seq && p.seq.length > 0)
    .filter(p => {
      if (p.target) return p.target === target;
      const inferred = inferPatternTargetFromSeq(p.seq);
      return inferred === target;
    })
    .sort((a, b) => b.seq.length - a.seq.length);

  const recent = sequence.slice(-10);
  for (const pattern of candidates) {
    const lowerPattern = pattern.seq.map(s => s.toLowerCase());
    const candidate = recent.slice(-pattern.seq.length).map(s => s.toLowerCase());
    if (candidate.join(',') === lowerPattern.join(',')) return pattern.result;
  }

  return null;
}

function computeSuggestion() {
  const winners = entries.filter(entry => VALID_WINNERS.includes(entry.winner)).map(entry => entry.winner);
  const sides = entries.filter(entry => VALID_SIDES.includes(entry.side)).map(entry => entry.side);

  if (patterns.length === 0) return 'PASS';

  const winnerSuggestion = matchPatternForSequence(winners, 'winner');
  const sideSuggestion = matchPatternForSequence(sides, 'side');

  if (winnerSuggestion && sideSuggestion) {
    if (winnerSuggestion === 'PASS' && sideSuggestion === 'PASS') return 'PASS';
    if (winnerSuggestion === 'PASS') return sideSuggestion;
    if (sideSuggestion === 'PASS') return winnerSuggestion;
    if (winnerSuggestion === sideSuggestion) return winnerSuggestion;
    return `${winnerSuggestion} + ${sideSuggestion}`;
  }

  return winnerSuggestion || sideSuggestion || 'PASS';
}

function computeMarkov(winners) {
  if (winners.length < 2) {
    return { probability: 0.5, forecast: winners[winners.length - 1] || '—' };
  }

  const transitions = {
    Meron: { Meron: 0, Wala: 0 },
    Wala: { Meron: 0, Wala: 0 }
  };

  for (let i = 1; i < winners.length; i += 1) {
    const previous = winners[i - 1];
    const current = winners[i];
    if (transitions[previous] && transitions[previous][current] !== undefined) {
      transitions[previous][current] += 1;
    }
  }

  const last = winners[winners.length - 1];
  const counts = transitions[last];
  const total = counts.Meron + counts.Wala;
  if (total === 0) {
    return { probability: 0.5, forecast: last };
  }

  const pMeron = counts.Meron / total;
  const pWala = counts.Wala / total;
  const forecast = pMeron >= pWala ? 'Meron' : 'Wala';
  const probability = Math.max(pMeron, pWala);

  return { probability, forecast };
}

function computeMarkovForSequence(seq, states) {
  if (!seq || seq.length < 2) return { probability: 0.5, forecast: seq[seq.length - 1] || '—' };
  const transitions = {};
  states.forEach(s => transitions[s] = {});
  for (const s of states) states.forEach(t => transitions[s][t] = 0);
  for (let i = 1; i < seq.length; i++) {
    const prev = seq[i-1];
    const cur = seq[i];
    if (transitions[prev] && transitions[prev][cur] !== undefined) transitions[prev][cur] += 1;
  }
  const last = seq[seq.length-1];
  const counts = transitions[last];
  const total = Object.values(counts).reduce((a,b) => a+b, 0);
  if (total === 0) return { probability: 0.5, forecast: last };
  const best = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  return { probability: best[1]/total, forecast: best[0] };
}

function computeSuggestionConfidence() {
  const suggestion = computeSuggestion();
  if (!suggestion || suggestion === 'PASS') return null;
  const winners = entries.filter(e => VALID_WINNERS.includes(e.winner)).map(e=>e.winner);
  const sides = entries.filter(e => VALID_SIDES.includes(e.side)).map(e=>e.side);
  const parts = suggestion.split('+').map(p=>p.trim());
  const scores = [];
  for (const part of parts) {
    if (VALID_WINNERS.includes(part)) {
      const res = computeMarkovForSequence(winners, VALID_WINNERS);
      scores.push(res.probability);
    } else if (VALID_SIDES.includes(part)) {
      const res = computeMarkovForSequence(sides, VALID_SIDES);
      scores.push(res.probability);
    }
  }
  if (scores.length === 0) return null;
  return scores.reduce((a,b)=>a+b,0)/scores.length;
}

function getPrimaryConfidence() {
  const suggestionConfidence = computeSuggestionConfidence();
  if (suggestionConfidence !== null) return suggestionConfidence;
  const winners = entries.filter(entry => VALID_WINNERS.includes(entry.winner)).map(entry => entry.winner);
  return computeMarkov(winners).probability;
}

function getConfidenceLabel(probability) {
  const value = probability || 0.5;
  if (value >= 0.7) {
    return { label: 'Strong', score: value };
  }
  if (value >= 0.5) {
    return { label: 'Moderate', score: value };
  }
  return { label: 'Weak', score: value };
}

function addPattern() {
  const rawSequence = patternInput.value.trim();
  const result = patternResultInput.value.trim();
  if (!rawSequence || !result) {
    return;
  }
  const seq = rawSequence.split(',').map(item => item.trim()).filter(Boolean);
  if (seq.length === 0) {
    return;
  }
  // prevent duplicate exact seq+result
  const exists = patterns.some(p => String(p.id) !== String(editingPatternId) && p.result.toLowerCase() === result.toLowerCase() && p.seq.join(',').toLowerCase() === seq.join(',').toLowerCase());
  if (exists) {
    alert('Duplicate pattern exists.');
    return;
  }
  if (editingPatternId) {
    patterns = patterns.map(p => p.id === editingPatternId ? { ...p, seq, result } : p);
    editingPatternId = null;
    // reset UI
    const cancelBtn = document.getElementById('cancelPatternButton');
    const addBtn = document.getElementById('addPatternButton');
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (addBtn) addBtn.textContent = 'Add Pattern';
  } else {
    patterns.push({ id: Date.now() + Math.random(), seq, result });
  }
  saveData();
  renderSettings();
  renderStatistic();
  patternInput.value = '';
  patternResultInput.value = '';
}

function editPattern(id) {
  const p = patterns.find(x => String(x.id) === String(id));
  if (!p) return;
  editingPatternId = id;
  patternInput.value = p.seq.join(', ');
  patternResultInput.value = p.result;
  // show cancel button and change add button label
  const cancelBtn = document.getElementById('cancelPatternButton');
  const addBtn = document.getElementById('addPatternButton');
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
  if (addBtn) addBtn.textContent = 'Save';
}

function cancelPattern() {
  editingPatternId = null;
  patternInput.value = '';
  patternResultInput.value = '';
  const cancelBtn = document.getElementById('cancelPatternButton');
  const addBtn = document.getElementById('addPatternButton');
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (addBtn) addBtn.textContent = 'Add Pattern';
}

function removePattern(id) {
  patterns = patterns.filter(pattern => String(pattern.id) !== String(id));
  saveData();
  renderSettings();
  renderStatistic();
}

window.removePattern = removePattern;

function updateButtons() {
  undoButton.disabled = entries.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

function renderAll() {
  renderMainView();
  renderHistory();
  renderMeronWala();
  renderLyamadoDehado();
  renderStatistic();
  renderSettings();
  updateButtons();
}

function handleSubmit() {
  let startValue = startNumberInput.value ? Number(startNumberInput.value) : null;
  const lastStart = entries.length ? (entries[entries.length - 1].start || 0) : 0;

  if (startValue === null || Number.isNaN(startValue) || startValue <= lastStart) {
    startValue = lastStart + 1;
  }

  const winner = winnerSelect.value;
  const side = sideSelect.value;
  entries.push(createEntry(startValue, winner, side));
  redoStack = [];
  saveData();
  startNumberInput.value = startValue + 1;
  renderAll();
}

function handleUndo() {
  if (entries.length === 0) return;
  redoStack.push(entries.pop());
  saveData();
  renderAll();
}

function handleRedo() {
  if (redoStack.length === 0) return;
  entries.push(redoStack.pop());
  saveData();
  renderAll();
}

function handleReset() {
  if (confirm('Reset all recorded data? Settings will remain intact.')) {
    entries = [];
    redoStack = [];
    saveData();
    renderAll();
  }
}

submitButton.addEventListener('click', handleSubmit);
undoButton.addEventListener('click', handleUndo);
redoButton.addEventListener('click', handleRedo);
resetButton.addEventListener('click', handleReset);
addPatternButton.addEventListener('click', addPattern);
document.getElementById('cancelPatternButton').addEventListener('click', cancelPattern);

loadData();
renderTabs();
renderAll();
