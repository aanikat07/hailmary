// ============================================================
// app.js — Main Application Logic
//
// Handles:
//   - State management (lineup, filters, search)
//   - Drag and drop
//   - Rendering player pool, lineup slots, distribution panel
// ============================================================


// ── Lineup Slot Definitions ──────────────────────────────────

const SLOTS = [
  { id: 'QB',   label: 'QB',   accepts: ['QB'] },
  { id: 'RB1',  label: 'RB',   accepts: ['RB'] },
  { id: 'RB2',  label: 'RB',   accepts: ['RB'] },
  { id: 'WR1',  label: 'WR',   accepts: ['WR'] },
  { id: 'WR2',  label: 'WR',   accepts: ['WR'] },
  { id: 'TE',   label: 'TE',   accepts: ['TE'] },
  { id: 'FLEX', label: 'FLEX', accepts: ['RB', 'WR', 'TE'] },
  { id: 'K',    label: 'K',    accepts: ['K'] },
  { id: 'DST',  label: 'DST',  accepts: ['DST'] },
];


// ── App State ────────────────────────────────────────────────

let lineup = {};       // slotId -> player object
let dragPlayer = null; // currently dragged player
let activePos = 'ALL'; // active position filter
let searchQuery = '';  // search bar text
let oppScore = 120;    // opponent projected score


// ── Helpers ──────────────────────────────────────────────────

/** Strip team abbreviation from player name for display */
function shortName(name) {
  return name.replace(/\s*\([^)]*\)/, '');
}

/** Get all players currently in the lineup (no nulls) */
function getLineupPlayers() {
  return Object.values(lineup).filter(Boolean);
}


// ── Render: Player Pool ──────────────────────────────────────

function renderPlayerList() {
  const list = document.getElementById('playerList');
  const inLineup = new Set(getLineupPlayers().map(p => p.name));

  const filtered = PLAYER_DATA.filter(p => {
    const posMatch = activePos === 'ALL' || p.position === activePos;
    const searchMatch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return posMatch && searchMatch;
  });

  list.innerHTML = '';

  filtered.forEach(player => {
    const inL = inLineup.has(player.name);
    const card = document.createElement('div');
    card.className = `player-card pos-${player.position}${inL ? ' in-lineup' : ''}`;
    card.draggable = true;
    card.dataset.name = player.name;

    card.innerHTML = `
      <div class="card-top">
        <div class="card-name">${shortName(player.name)}</div>
        <div class="card-pos">${player.position}</div>
      </div>
      <div class="card-stats">
        <div class="stat-item">μ <span>${player.mu}</span></div>
        <div class="stat-item">σ <span>${player.sigma}</span></div>
        <div class="stat-item">n=<span>${player.weeks}</span></div>
      </div>
      <canvas class="mini-dist" id="mini-${player.name.replace(/\W/g, '_')}"></canvas>
    `;

    // Drag events
    card.addEventListener('dragstart', e => {
      dragPlayer = player;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    list.appendChild(card);

    // Draw sparkline after DOM paint
    requestAnimationFrame(() => {
      const canvas = document.getElementById(`mini-${player.name.replace(/\W/g, '_')}`);
      if (canvas) drawMiniDist(canvas, player.mu, player.sigma, POS_COLORS[player.position]);
    });
  });
}


// ── Render: Lineup Slots ─────────────────────────────────────

function renderLineup() {
  const container = document.getElementById('lineupSlots');
  container.innerHTML = '';

  SLOTS.forEach(slot => {
    const player = lineup[slot.id];
    const el = document.createElement('div');
    el.className = `lineup-slot slot-${slot.label}${player ? ' filled' : ''}`;
    el.dataset.slotId = slot.id;

    // Slot label
    el.innerHTML = `<div class="slot-label">${slot.label}</div>`;

    if (player) {
      // Filled slot: show player info + mini distribution
      el.innerHTML += `
        <div class="slot-player">
          <div class="slot-player-info">
            <div class="slot-player-name">${shortName(player.name)}</div>
            <div class="slot-player-stats">μ=${player.mu} · σ=${player.sigma} · n=${player.weeks}</div>
          </div>
          <canvas class="slot-dist" id="slot-dist-${slot.id}"></canvas>
          <button class="remove-btn" data-slot="${slot.id}">×</button>
        </div>
      `;
    } else {
      // Empty slot: show placeholder
      el.innerHTML += `
        <div class="slot-empty-text">Drop ${slot.accepts.join('/')} here</div>
      `;
    }

    // Drop zone events
    el.addEventListener('dragover', e => {
      if (!dragPlayer) return;
      if (slot.accepts.includes(dragPlayer.position)) {
        e.preventDefault();
        el.classList.add('drag-over');
      }
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (!dragPlayer || !slot.accepts.includes(dragPlayer.position)) return;
      lineup[slot.id] = dragPlayer;
      dragPlayer = null;
      renderAll();
    });

    container.appendChild(el);
  });

  // Draw slot sparklines and wire remove buttons after paint
  requestAnimationFrame(() => {
    SLOTS.forEach(slot => {
      const player = lineup[slot.id];
      if (player) {
        const canvas = document.getElementById(`slot-dist-${slot.id}`);
        const color = POS_COLORS[slot.label] || POS_COLORS[player.position];
        if (canvas) drawMiniDist(canvas, player.mu, player.sigma, color);
      }
    });

    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        delete lineup[btn.dataset.slot];
        renderAll();
      });
    });
  });
}


// ── Render: Distribution Panel ───────────────────────────────

function renderDistPanel() {
  const content = document.getElementById('distContent');
  const players = getLineupPlayers();
  const stats = getLineupStats(players);

  // Empty state
  if (!stats) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-text">Add players to your lineup<br>to see the score distribution</div>
      </div>`;
    return;
  }

  const wp = winProbability(stats.mu, stats.sigma, oppScore) * 100;

  content.innerHTML = `
    <!-- Expected Score -->
    <div>
      <div class="dist-section-title">Expected Score</div>
      <div class="big-stat">
        <div class="big-stat-value">${stats.mu.toFixed(1)}</div>
        <div class="big-stat-label">PROJECTED FANTASY POINTS</div>
      </div>
    </div>

    <!-- Key Stats Grid -->
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-box-value">${stats.sigma.toFixed(1)}</div>
        <div class="stat-box-label">STD DEV (σ)</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-value">${stats.count}/9</div>
        <div class="stat-box-label">SLOTS FILLED</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-value">${(stats.mu - stats.sigma).toFixed(1)}</div>
        <div class="stat-box-label">FLOOR (μ−σ)</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-value">${(stats.mu + stats.sigma).toFixed(1)}</div>
        <div class="stat-box-label">CEILING (μ+σ)</div>
      </div>
    </div>

    <!-- Main Distribution Chart -->
    <div>
      <div class="dist-section-title">Score Distribution</div>
      <canvas id="main-dist-canvas" style="width:100%;height:140px;"></canvas>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted);margin-top:6px;line-height:1.6;">
        T ~ N(${stats.mu.toFixed(1)}, ${stats.sigma.toFixed(1)}²)<br>
        CLT: sum of ${stats.count} independent Normals
      </div>
    </div>

    <!-- Opponent Input -->
    <div class="opponent-section">
      <div class="opp-label">OPPONENT PROJECTED SCORE</div>
      <div class="opp-input-row">
        <input class="opp-input" id="oppScoreInput" type="number" min="0" max="300" value="${oppScore}" />
        <input class="opp-slider" id="oppSlider" type="range" min="60" max="250" value="${oppScore}" />
      </div>
      <div class="win-prob-text">${wp.toFixed(1)}%</div>
      <div class="win-prob-sublabel">P(lineup total &gt; ${oppScore} pts)</div>
      <div class="win-prob-bar">
        <div class="win-prob-fill" style="width:${Math.min(100, wp)}%"></div>
      </div>
    </div>

    <!-- Player Breakdown -->
    <div>
      <div class="dist-section-title">Player Breakdown</div>
      <div class="player-breakdown">
        ${players.map(p => `
          <div class="breakdown-row">
            <div class="breakdown-name" style="color:${POS_COLORS[p.position]}">${shortName(p.name)}</div>
            <div class="breakdown-mu">μ=${p.mu}</div>
            <div class="breakdown-sigma">σ=${p.sigma}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Math Note -->
    <div class="math-note">
      MLE: μ̂ = (1/n)Σxᵢ &nbsp;·&nbsp; σ̂² = (1/n)Σ(xᵢ−μ̂)²<br>
      E[T] = Σμᵢ &nbsp;·&nbsp; Var[T] = Σσᵢ² (independence)<br>
      P(win) = 1 − Φ((opp − μ_T) / σ_T)
    </div>
  `;

  // Draw chart and wire opponent controls
  requestAnimationFrame(() => {
    const canvas = document.getElementById('main-dist-canvas');
    if (canvas) drawMainDist(canvas, stats.mu, stats.sigma, oppScore);

    const input = document.getElementById('oppScoreInput');
    const slider = document.getElementById('oppSlider');

    const updateOpp = val => {
      oppScore = parseFloat(val) || 0;
      if (input) input.value = oppScore;
      if (slider) slider.value = oppScore;
      renderDistPanel();
      // Redraw chart
      requestAnimationFrame(() => {
        const c = document.getElementById('main-dist-canvas');
        if (c) drawMainDist(c, stats.mu, stats.sigma, oppScore);
      });
    };

    if (input) input.addEventListener('input', e => updateOpp(e.target.value));
    if (slider) slider.addEventListener('input', e => updateOpp(e.target.value));
  });
}


// ── Render All ───────────────────────────────────────────────

function renderAll() {
  renderPlayerList();
  renderLineup();
  renderDistPanel();
}


// ── Event Listeners ──────────────────────────────────────────

// Position filter buttons
document.getElementById('posFilters').addEventListener('click', e => {
  const btn = e.target.closest('.pos-btn');
  if (!btn) return;
  activePos = btn.dataset.pos;
  document.querySelectorAll('.pos-btn').forEach(b => {
    b.className = 'pos-btn';
    if (b.dataset.pos === activePos) b.classList.add(`active-${activePos}`);
  });
  renderPlayerList();
});

// Search input
document.getElementById('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value;
  renderPlayerList();
});


// ── Initialize ───────────────────────────────────────────────

renderAll();
