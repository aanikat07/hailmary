// app.js — Main Application Logic

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

// State
let myLineup = {}, oppLineup = {};
let myDragPlayer = null, oppDragPlayer = null;
let myActivePos = 'ALL', oppActivePos = 'ALL';
let mySearch = '', oppSearch = '';
let riskMode = 'safe'; // 'safe' | 'upside'
let oppManualScore = null;
let currentWeek = 18; // default to full season

// Pre-compute boom probs and archetypes — recalculated when week changes
let PLAYER_META = {};

function recomputeMeta() {
  PLAYER_META = {};
  PLAYER_DATA.forEach(p => {
    PLAYER_META[p.name] = {
      boom: computeBoomProb(p, currentWeek),
      archetype: getArchetype(p, currentWeek),
      // Week-specific MLE params (used in dist panel and lineup stats)
      weekMu: (() => {
        if (currentWeek > 2) {
          const mle = getMleAtWeek(p, currentWeek);
          return mle ? mle.mu : p.mu;
        }
        return p.mu;
      })(),
      weekSigma: (() => {
        if (currentWeek > 2) {
          const mle = getMleAtWeek(p, currentWeek);
          return mle ? mle.sigma : p.sigma;
        }
        return p.sigma;
      })(),
      actualScore: getActualScore(p, currentWeek)
    };
  });
}

function shortName(name) { return name.replace(/\s*\([^)]*\)/, ''); }
function getPlayers(lineup) {
  return Object.values(lineup).filter(Boolean).map(p => {
    const meta = PLAYER_META[p.name];
    return { ...p, mu: meta ? meta.weekMu : p.mu, sigma: meta ? meta.weekSigma : p.sigma };
  });
}

function boomColor(prob) {
  if (prob >= 0.35) return '#00e5a0';
  if (prob >= 0.25) return '#ffd166';
  return '#ff4757';
}
function boomLabel(prob) {
  if (prob >= 0.35) return '🔥 BOOM';
  if (prob >= 0.25) return '〜 AVG';
  return '❄ COLD';
}

// ── Player Pool ──────────────────────────────────────────────

function renderPool(side) {
  const isMe = side === 'my';
  const search = isMe ? mySearch : oppSearch;
  const activePos = isMe ? myActivePos : oppActivePos;
  const lineup = isMe ? myLineup : oppLineup;
  const listId = isMe ? 'myPlayerList' : 'oppPlayerList';

  const inLineup = new Set(getPlayers(lineup).map(p => p.name));
  const filtered = PLAYER_DATA.filter(p => {
    const posOk = activePos === 'ALL' || p.position === activePos;
    const searchOk = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return posOk && searchOk;
  });

  const list = document.getElementById(listId);
  list.innerHTML = '';

  filtered.forEach(player => {
    const meta = PLAYER_META[player.name];
    const boom = meta.boom;
    const arch = meta.archetype;
    const inL = inLineup.has(player.name);
    const wmu = meta.weekMu.toFixed(1);
    const wsigma = meta.weekSigma.toFixed(1);
    const actual = meta.actualScore;

    const card = document.createElement('div');
    card.className = `player-card pos-${player.position}${inL ? ' in-lineup' : ''}`;
    card.draggable = true;
    card.dataset.name = player.name;

    card.innerHTML = `
      <div class="card-row1">
        <div class="card-name">${shortName(player.name)}</div>
        <div class="card-badges">
          <span class="archetype-badge" style="background:${arch.color}22;color:${arch.color}">${arch.label}</span>
          <span class="boom-badge" style="background:${boomColor(boom)}22;color:${boomColor(boom)}">${boomLabel(boom)}</span>
          <span class="card-pos">${player.position}</span>
        </div>
      </div>
      <div class="card-row2">
        <span class="card-stat">μ <span>${wmu}</span></span>
        <span class="card-stat">σ <span>${wsigma}</span></span>
        <span class="card-stat">n=<span>${Math.min(currentWeek - 1, player.weeks)}</span></span>
        ${actual !== null ? `<span class="card-stat actual-score">Wk${currentWeek}: <span style="color:${actual > parseFloat(wmu) ? '#00e5a0' : '#ff4757'}">${actual}</span></span>` : ''}
      </div>
      <canvas class="mini-dist" id="mini-${side}-${player.name.replace(/\W/g,'_')}"></canvas>
    `;

    card.addEventListener('dragstart', e => {
      if (isMe) myDragPlayer = player; else oppDragPlayer = player;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    list.appendChild(card);

    requestAnimationFrame(() => {
      const c = document.getElementById(`mini-${side}-${player.name.replace(/\W/g,'_')}`);
      if (c) drawMiniDist(c, meta.weekMu, meta.weekSigma, POS_COLORS[player.position]);
    });
  });
}

// ── Lineup Slots ─────────────────────────────────────────────

function renderLineupSlots(side) {
  const isMe = side === 'my';
  const lineup = isMe ? myLineup : oppLineup;
  const containerId = isMe ? 'myLineupSlots' : 'oppLineupSlots';
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  SLOTS.forEach(slot => {
    const player = lineup[slot.id];
    const el = document.createElement('div');
    el.className = `lineup-slot slot-${slot.label}${player ? ' filled' : ''}`;
    el.dataset.slotId = slot.id;

    el.innerHTML = `<div class="slot-label">${slot.label}</div>`;

    if (player) {
      const meta = PLAYER_META[player.name];
      const wmu = meta.weekMu.toFixed(1);
      const wsigma = meta.weekSigma.toFixed(1);
      const actual = meta.actualScore;
      el.innerHTML += `
        <div class="slot-player">
          <div class="slot-player-info">
            <div class="slot-player-name">${shortName(player.name)}</div>
            <div class="slot-player-sub">μ=${wmu} · σ=${wsigma} · <span style="color:${boomColor(meta.boom)}">${boomLabel(meta.boom)} ${(meta.boom*100).toFixed(0)}%</span>${actual !== null ? ` · <span style="color:${actual > parseFloat(wmu) ? '#00e5a0' : '#ff4757'}">actual: ${actual}</span>` : ''}</div>
          </div>
          <canvas class="slot-dist" id="slot-dist-${side}-${slot.id}"></canvas>
          <button class="remove-btn" data-slot="${slot.id}" data-side="${side}">×</button>
        </div>`;
    } else {
      el.innerHTML += `<div class="slot-empty">Drop ${slot.accepts.join('/')} here</div>`;
    }

    el.addEventListener('dragover', e => {
      const dp = isMe ? myDragPlayer : oppDragPlayer;
      if (dp && slot.accepts.includes(dp.position)) {
        e.preventDefault(); el.classList.add('drag-over');
      }
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('drag-over');
      const dp = isMe ? myDragPlayer : oppDragPlayer;
      if (!dp || !slot.accepts.includes(dp.position)) return;
      if (isMe) { myLineup[slot.id] = dp; myDragPlayer = null; }
      else { oppLineup[slot.id] = dp; oppDragPlayer = null; }
      renderAll();
    });

    container.appendChild(el);
  });

  requestAnimationFrame(() => {
    SLOTS.forEach(slot => {
      const player = lineup[slot.id];
      if (player) {
        const c = document.getElementById(`slot-dist-${side}-${slot.id}`);
        const meta = PLAYER_META[player.name];
        if (c) drawMiniDist(c, meta.weekMu, meta.weekSigma, POS_COLORS[slot.label] || POS_COLORS[player.position]);
      }
    });
    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.side === 'my') delete myLineup[btn.dataset.slot];
        else delete oppLineup[btn.dataset.slot];
        renderAll();
      });
    });
  });
}

// ── Distribution Panel ───────────────────────────────────────

function renderDistPanel(side) {
  const isMe = side === 'my';
  const players = getPlayers(isMe ? myLineup : oppLineup);
  const stats = getLineupStats(players);
  const contentId = isMe ? 'myDistContent' : 'oppDistContent';
  const content = document.getElementById(contentId);
  const color = isMe ? '#00e5a0' : '#ff4757';

  if (!stats) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">${isMe ? '📊' : '🎯'}</div><div class="empty-text">Add players to see the distribution</div></div>`;
    return;
  }

  const oppScore = oppManualScore || stats.mu;
  const wp = winProbabilityVsScore(stats.mu, stats.sigma, oppScore) * 100;
  const ci = bootstrapCI(players.flatMap(p => p.scores), 300);

  content.innerHTML = `
    <div>
      <div class="section-label">Expected Score</div>
      <div class="big-number" style="color:${color}">${stats.mu.toFixed(1)}</div>
      <div class="big-number-label">PROJECTED FANTASY POINTS</div>
    </div>

    <div>
      <div class="section-label">Bootstrap 95% CI on μ</div>
      <div class="ci-bar-wrap" id="ci-wrap-${side}">
        <div class="ci-labels"><span>${ci.lower.toFixed(1)}</span><span>${stats.mu.toFixed(1)}</span><span>${ci.upper.toFixed(1)}</span></div>
        <div class="ci-bar-track">
          <div class="ci-bar-range" id="ci-range-${side}"></div>
          <div class="ci-bar-dot" id="ci-dot-${side}"></div>
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted)">
          95% CI: [${ci.lower.toFixed(1)}, ${ci.upper.toFixed(1)}] · width=${((ci.upper-ci.lower)).toFixed(1)} pts
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-box"><div class="stat-box-val">${stats.sigma.toFixed(1)}</div><div class="stat-box-lbl">STD DEV σ</div></div>
      <div class="stat-box"><div class="stat-box-val">${stats.count}/9</div><div class="stat-box-lbl">SLOTS FILLED</div></div>
      <div class="stat-box"><div class="stat-box-val">${(stats.mu - stats.sigma).toFixed(1)}</div><div class="stat-box-lbl">FLOOR μ−σ</div></div>
      <div class="stat-box"><div class="stat-box-val">${(stats.mu + stats.sigma).toFixed(1)}</div><div class="stat-box-lbl">CEILING μ+σ</div></div>
    </div>

    <div>
      <div class="section-label">Score Distribution</div>
      <div class="main-canvas-wrap"><canvas id="main-canvas-${side}" style="height:130px"></canvas></div>
      <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);margin-top:4px;line-height:1.7">
        T ~ N(${stats.mu.toFixed(1)}, ${stats.sigma.toFixed(1)}²) by CLT<br>
        E[T]=Σμᵢ · Var[T]=Σσᵢ² (independence)
      </div>
    </div>

    ${isMe ? `
    <div class="opp-section">
      <div class="section-label" style="margin-bottom:6px">VS FIXED SCORE</div>
      <div class="opp-row">
        <input class="opp-input" id="oppScoreNum" type="number" min="0" max="300" value="${oppScore.toFixed(0)}" />
        <input class="opp-slider" id="oppScoreSlider" type="range" min="60" max="250" value="${oppScore.toFixed(0)}" />
      </div>
      <div class="win-pct">${wp.toFixed(1)}% WIN</div>
      <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted)">P(score > ${oppScore.toFixed(0)} pts)</div>
      <div class="win-bar"><div class="win-bar-fill" style="width:${Math.min(100,wp)}%"></div></div>
    </div>` : ''}

    <div>
      <div class="section-label">Player Breakdown</div>
      <div class="breakdown-list">
        ${players.map(p => {
          const boom = PLAYER_META[p.name].boom;
          return `<div class="bk-row">
            <div class="bk-name" style="color:${POS_COLORS[p.position]}">${shortName(p.name)}</div>
            <div class="bk-mu">μ=${p.mu}</div>
            <div class="bk-sigma">σ=${p.sigma}</div>
            <div class="bk-boom" style="background:${boomColor(boom)}22;color:${boomColor(boom)}">${(boom*100).toFixed(0)}%</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="math-box">
      MLE: μ̂=(1/n)Σxᵢ · σ̂²=(1/n)Σ(xᵢ-μ̂)²<br>
      Bootstrap: resample n scores × 500 → CI<br>
      LogReg: P(boom)=σ(wᵀx+b), trained n=12,941 · acc=75.4%
    </div>
  `;

  requestAnimationFrame(() => {
    // CI bar positioning
    const range = document.getElementById(`ci-range-${side}`);
    const dot = document.getElementById(`ci-dot-${side}`);
    const span = ci.upper - ci.lower;
    const fullRange = (stats.mu + stats.sigma) - (stats.mu - stats.sigma);
    const low = Math.max(0, ci.lower - (stats.mu - stats.sigma));
    const high = Math.min(fullRange, ci.upper - (stats.mu - stats.sigma));
    if (range) {
      range.style.left = `${(low/fullRange)*100}%`;
      range.style.width = `${((high-low)/fullRange)*100}%`;
    }
    if (dot) dot.style.left = `50%`;

    // Main canvas
    const canvas = document.getElementById(`main-canvas-${side}`);
    if (canvas) drawMainDist(canvas, stats.mu, stats.sigma, isMe ? oppScore : null, color);

    // Opponent controls (my panel only)
    if (isMe) {
      const numInput = document.getElementById('oppScoreNum');
      const slider = document.getElementById('oppScoreSlider');
      const update = val => {
        oppManualScore = parseFloat(val) || null;
        if (numInput) numInput.value = val;
        if (slider) slider.value = val;
        renderDistPanel('my');
      };
      if (numInput) numInput.addEventListener('input', e => update(e.target.value));
      if (slider) slider.addEventListener('input', e => update(e.target.value));
    }
  });
}

// ── Battle Screen ─────────────────────────────────────────────

function renderBattle() {
  const myPlayers = getPlayers(myLineup);
  const oppPlayers = getPlayers(oppLineup);
  const myStats = getLineupStats(myPlayers);
  const oppStats = getLineupStats(oppPlayers);
  const content = document.getElementById('battleContent');

  if (!myStats || !oppStats || myStats.count < 3 || oppStats.count < 3) {
    content.innerHTML = `<div class="empty-state" style="height:100%;justify-content:center;"><div class="empty-icon" style="font-size:48px">⚡</div><div class="empty-text">Set both lineups (at least 3 players each)<br>to see the battle analysis</div></div>`;
    return;
  }

  const wp = winProbabilityVsDistribution(myStats, oppStats) * 100;
  const mu_D = myStats.mu - oppStats.mu;
  const sigma_D = Math.sqrt(myStats.variance + oppStats.variance);

  // Build matchup pairs by slot
  const matchups = [];
  SLOTS.forEach(slot => {
    const mine = myLineup[slot.id];
    const opp = oppLineup[slot.id];
    if (mine && opp) matchups.push({ slot, mine, opp });
  });

  // Sort matchups by edge for risk mode
  const sortedMatchups = [...matchups].sort((a, b) => {
    const edgeA = a.mine.mu - a.opp.mu;
    const edgeB = b.mine.mu - b.opp.mu;
    return riskMode === 'safe' ? edgeB - edgeA : Math.abs(edgeB) - Math.abs(edgeA);
  });

  content.innerHTML = `
    <!-- Hero -->
    <div class="battle-hero">
      <div class="battle-team mine">
        <div class="battle-team-label">YOUR LINEUP</div>
        <div class="battle-team-score">${myStats.mu.toFixed(1)}</div>
        <div class="battle-team-sigma">σ = ${myStats.sigma.toFixed(1)} pts</div>
      </div>
      <div class="battle-vs">
        <div class="vs-label">VS</div>
        <div class="win-prob-big">${wp.toFixed(1)}%</div>
        <div class="win-prob-sub">P(YOU WIN)</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);margin-top:4px;text-align:center">
          D ~ N(${mu_D.toFixed(1)}, ${sigma_D.toFixed(1)}²)<br>
          P(D>0) = 1 − Φ(0; μ_D, σ_D)
        </div>
      </div>
      <div class="battle-team opp">
        <div class="battle-team-label">OPPONENT</div>
        <div class="battle-team-score">${oppStats.mu.toFixed(1)}</div>
        <div class="battle-team-sigma">σ = ${oppStats.sigma.toFixed(1)} pts</div>
      </div>
    </div>

    <!-- Difference Distribution -->
    <div class="diff-dist-section">
      <div class="section-label" style="margin-bottom:8px">SCORE DIFFERENTIAL DISTRIBUTION — D = T_you − T_opp</div>
      <canvas id="diff-canvas" style="height:120px"></canvas>
      <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);margin-top:6px;line-height:1.7">
        D ~ N(μ_you − μ_opp, σ_you² + σ_opp²) = N(${mu_D.toFixed(1)}, ${sigma_D.toFixed(1)}²)<br>
        Green area = P(you win) = ${wp.toFixed(1)}% · Red area = P(opp wins) = ${(100-wp).toFixed(1)}%
      </div>
    </div>

    <!-- Risk Toggle -->
    <div class="risk-toggle">
      <div class="risk-label">RISK MODE — affects matchup priority order</div>
      <button class="risk-btn ${riskMode === 'safe' ? 'active-safe' : ''}" data-risk="safe">SAFE — PROTECT FLOOR</button>
      <button class="risk-btn ${riskMode === 'upside' ? 'active-upside' : ''}" data-risk="upside">UPSIDE — NEED A WIN</button>
    </div>

    <!-- Matchup Cards -->
    ${sortedMatchups.length > 0 ? `
    <div>
      <div class="section-label" style="margin-bottom:12px">POSITION MATCHUPS</div>
      <div class="matchups-grid" id="matchupsGrid">
        ${sortedMatchups.map((m, idx) => renderMatchupCard(m, idx)).join('')}
      </div>
    </div>` : ''}
  `;

  requestAnimationFrame(() => {
    // Draw diff canvas
    const dc = document.getElementById('diff-canvas');
    if (dc) drawDiffDist(dc, mu_D, sigma_D);

    // Draw matchup canvases
    sortedMatchups.forEach((m, idx) => {
      const c = document.getElementById(`matchup-canvas-${idx}`);
      if (c) drawMatchupDist(c, m.mine, m.opp, '#00e5a0', '#ff4757');
    });

    // Risk buttons
    document.querySelectorAll('.risk-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        riskMode = btn.dataset.risk;
        renderBattle();
      });
    });
  });
}

function renderMatchupCard(m, idx) {
  const edge = m.mine.mu - m.opp.mu;
  const myBoom = PLAYER_META[m.mine.name].boom;
  const oppBoom = PLAYER_META[m.opp.name].boom;
  const myArch = PLAYER_META[m.mine.name].archetype;
  const oppArch = PLAYER_META[m.opp.name].archetype;

  let edgeClass, edgeText;
  if (edge > 2)       { edgeClass = 'edge-you';  edgeText = `+${edge.toFixed(1)} YOUR EDGE`; }
  else if (edge < -2) { edgeClass = 'edge-opp';  edgeText = `${edge.toFixed(1)} OPP EDGE`; }
  else                { edgeClass = 'edge-even'; edgeText = 'EVEN MATCHUP'; }

  // Generate insight
  let insight = '';
  if (riskMode === 'safe') {
    if (m.mine.sigma < m.opp.sigma) insight = `Your ${shortName(m.mine.name)} is more consistent (σ=${m.mine.sigma} vs ${m.opp.sigma}). Floor advantage.`;
    else insight = `Their ${shortName(m.opp.name)} is more consistent. Variance risk here.`;
  } else {
    const myCeil = m.mine.mu + 1.5 * m.mine.sigma;
    const oppCeil = m.opp.mu + 1.5 * m.opp.sigma;
    if (myCeil > oppCeil) insight = `${shortName(m.mine.name)} ceiling ${myCeil.toFixed(1)} vs ${oppCeil.toFixed(1)}. Upside edge yours.`;
    else insight = `${shortName(m.opp.name)} has higher ceiling (${oppCeil.toFixed(1)} vs ${myCeil.toFixed(1)}). Watch out.`;
  }

  return `
    <div class="matchup-card">
      <div class="matchup-header">
        <div class="matchup-pos" style="color:${POS_COLORS[m.slot.label] || '#fff'}">${m.slot.label}</div>
        <div class="matchup-edge ${edgeClass}">${edgeText}</div>
      </div>
      <div class="matchup-players">
        <div class="matchup-player">
          <div class="mp-name" style="color:#00e5a0">${shortName(m.mine.name)}</div>
          <div class="mp-mu">μ=${m.mine.mu} · σ=${m.mine.sigma}</div>
          <div class="mp-boom" style="background:${boomColor(myBoom)}22;color:${boomColor(myBoom)}">${(myBoom*100).toFixed(0)}% boom</div>
          <div style="font-family:'DM Mono',monospace;font-size:8px;color:${myArch.color};margin-top:2px">${myArch.label}</div>
        </div>
        <div class="vs-small">VS</div>
        <div class="matchup-player">
          <div class="mp-name" style="color:#ff4757">${shortName(m.opp.name)}</div>
          <div class="mp-mu">μ=${m.opp.mu} · σ=${m.opp.sigma}</div>
          <div class="mp-boom" style="background:${boomColor(oppBoom)}22;color:${boomColor(oppBoom)}">${(oppBoom*100).toFixed(0)}% boom</div>
          <div style="font-family:'DM Mono',monospace;font-size:8px;color:${oppArch.color};margin-top:2px">${oppArch.label}</div>
        </div>
      </div>
      <canvas class="matchup-canvas" id="matchup-canvas-${idx}"></canvas>
      <div class="matchup-insight">${insight}</div>
    </div>
  `;
}

// ── Render All ───────────────────────────────────────────────

function renderAll() {
  renderPool('my');
  renderPool('opp');
  renderLineupSlots('my');
  renderLineupSlots('opp');
  renderDistPanel('my');
  renderDistPanel('opp');
  renderBattle();
}

// ── Tabs ─────────────────────────────────────────────────────

document.getElementById('tabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  const target = tab.dataset.tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  tab.classList.add('active');
  document.getElementById(`panel-${target}`).classList.add('active');
  if (target === 'battle') renderBattle();
});

// ── Pos Filters ──────────────────────────────────────────────

function setupFilters(side) {
  const filtersId = side === 'my' ? 'myPosFilters' : 'oppPosFilters';
  const searchId  = side === 'my' ? 'mySearchInput' : 'oppSearchInput';

  document.getElementById(filtersId).addEventListener('click', e => {
    const btn = e.target.closest('.pos-btn');
    if (!btn) return;
    const pos = btn.dataset.pos;
    if (side === 'my') myActivePos = pos; else oppActivePos = pos;
    document.querySelectorAll(`#${filtersId} .pos-btn`).forEach(b => {
      b.className = 'pos-btn';
      if (b.dataset.pos === pos) b.classList.add(`active-${pos}`);
    });
    renderPool(side);
  });

  document.getElementById(searchId).addEventListener('input', e => {
    if (side === 'my') mySearch = e.target.value; else oppSearch = e.target.value;
    renderPool(side);
  });
}

setupFilters('my');
setupFilters('opp');

// ── Week Selector ─────────────────────────────────────────────
document.getElementById('weekBtns').addEventListener('click', e => {
  const btn = e.target.closest('.week-btn');
  if (!btn) return;
  currentWeek = parseInt(btn.dataset.week);
  document.querySelectorAll('.week-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  recomputeMeta();
  renderAll();
});

// ── Init ─────────────────────────────────────────────────────
recomputeMeta();
renderAll();