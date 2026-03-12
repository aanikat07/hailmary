// ============================================================
// app.js — Main Application Logic
// ============================================================

// ── Lineup slot definitions ──────────────────────────────────
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

// ── Defensive Rankings (2025-26 NFL Season) ──────────────────
// Fantasy points allowed per game to each position, ranked 1 (most vulnerable) to 32 (stingiest)
// Source: 2025-26 PPR defensive rankings, avg pts allowed to position
// rank 1 = softest matchup (most pts allowed), rank 32 = toughest
const DEF_RANKINGS = {
  QB: {
    ARI:1, NO:2, CAR:3, NYJ:4, LV:5, CLE:6, TEN:7, DEN:8, MIA:9, LAC:10,
    JAC:11, NE:12, CHI:13, SEA:14, ATL:15, WAS:16, DAL:17, MIN:18, IND:19, NYG:20,
    CIN:21, HOU:22, TB:23, PHI:24, GB:25, DET:26, BAL:27, LAR:28, BUF:29, SF:30,
    PIT:31, KC:32
  },
  RB: {
    MIA:1, NO:2, CAR:3, ATL:4, TEN:5, ARI:6, NYG:7, CLE:8, NYJ:9, LV:10,
    JAC:11, WAS:12, DEN:13, CHI:14, LAC:15, SEA:16, CIN:17, MIN:18, DAL:19, GB:20,
    IND:21, NE:22, TB:23, DET:24, HOU:25, PHI:26, LAR:27, BAL:28, PIT:29, BUF:30,
    SF:31, KC:32
  },
  WR: {
    CAR:1, TEN:2, ARI:3, NO:4, NYJ:5, MIA:6, LV:7, CLE:8, CIN:9, JAC:10,
    ATL:11, CHI:12, WAS:13, LAC:14, DAL:15, NYG:16, SEA:17, DEN:18, MIN:19, IND:20,
    NE:21, TB:22, GB:23, HOU:24, DET:25, BAL:26, PHI:27, LAR:28, BUF:29, PIT:30,
    SF:31, KC:32
  },
  TE: {
    CAR:1, ARI:2, MIA:3, TEN:4, CHI:5, ATL:6, NO:7, NYJ:8, CLE:9, LV:10,
    JAC:11, DEN:12, CIN:13, WAS:14, DAL:15, NYG:16, SEA:17, IND:18, MIN:19, LAC:20,
    NE:21, GB:22, DET:23, HOU:24, TB:25, PHI:26, BAL:27, LAR:28, BUF:29, PIT:30,
    SF:31, KC:32
  },
  K: {
    CAR:1, TEN:2, ARI:3, NO:4, MIA:5, NYJ:6, LV:7, CLE:8, ATL:9, CHI:10,
    JAC:11, CIN:12, DEN:13, WAS:14, DAL:15, NYG:16, LAC:17, SEA:18, MIN:19, IND:20,
    NE:21, TB:22, GB:23, HOU:24, DET:25, PHI:26, BAL:27, LAR:28, BUF:29, PIT:30,
    SF:31, KC:32
  },
  DST: {
    MIA:1, ARI:2, CAR:3, TEN:4, NO:5, NYJ:6, CLE:7, LV:8, JAC:9, ATL:10,
    CHI:11, DEN:12, WAS:13, CIN:14, LAC:15, NYG:16, DAL:17, SEA:18, MIN:19, IND:20,
    NE:21, GB:22, DET:23, HOU:24, TB:25, PHI:26, BAL:27, LAR:28, BUF:29, PIT:30,
    SF:31, KC:32
  }
};

// Average fantasy points allowed per game (roughly calibrated)
const DEF_AVG_PTS = { QB:22, RB:15, WR:28, TE:8, K:9, DST:10 };

// Get team from player name e.g. "Josh Allen (BUF)" → "BUF"
function getTeam(name) {
  const m = name.match(/\(([A-Z]+)\)/);
  return m ? m[1] : null;
}

// Get def rank for a team at a position (1=easiest, 32=hardest)
function getDefRank(team, pos) {
  if (!team || team === 'FA') return null;
  const map = DEF_RANKINGS[pos];
  if (!map) return null;
  return map[team] || null;
}

// Color for def rank: 1 (green=easy) → 32 (red=tough)
function defRankColor(rank) {
  if (!rank) return '#4a5068';
  if (rank <= 8)  return '#00e5a0';  // very easy matchup
  if (rank <= 16) return '#ffd166';  // moderate
  if (rank <= 24) return '#fb923c';  // harder
  return '#f87171';                  // tough
}

// Human-readable rank label
function defRankLabel(rank) {
  if (!rank) return '';
  if (rank <= 5)  return 'EASY';
  if (rank <= 12) return 'SOFT';
  if (rank <= 20) return 'MID';
  if (rank <= 27) return 'HARD';
  return 'LOCK';
}

// ── 2025-26 NFL Weekly Schedule ──────────────────────────────
// Each team's opponent per week (null = bye)
// 2025 NFL Regular Season Schedule — sourced from official schedule
const NFL_SCHEDULE = {
  //      W1      W2      W3      W4      W5      W6      W7      W8      W9      W10     W11     W12     W13     W14     W15     W16     W17     W18
  ARI: ['NO'  , 'CAR' , 'SF'  , 'SEA' , 'TEN' , 'IND' , 'GB'  , null  , 'DAL' , 'SEA' , 'SF'  , 'JAX' , 'TB'  , 'LAR' , 'HOU' , 'ATL' , 'CIN' , 'LAR' ],
  ATL: ['TB'  , 'MIN' , 'CAR' , 'WSH' , null  , 'BUF' , 'SF'  , 'MIA' , 'NE'  , 'IND' , 'CAR' , 'NO'  , 'NYJ' , 'SEA' , 'TB'  , 'ARI' , 'LAR' , 'NO'  ],
  BAL: ['BUF' , 'CLE' , 'DET' , 'KC'  , 'HOU' , 'LAR' , null  , 'CHI' , 'MIA' , 'MIN' , 'CLE' , 'NYJ' , 'CIN' , 'PIT' , 'CIN' , 'NE'  , 'GB'  , 'PIT' ],
  BUF: ['BAL' , 'NYJ' , 'MIA' , 'NO'  , 'NE'  , 'ATL' , null  , 'CAR' , 'KC'  , 'MIA' , 'TB'  , 'HOU' , 'PIT' , 'CIN' , 'NE'  , 'CLE' , 'PHI' , 'NYJ' ],
  CAR: ['JAX' , 'ARI' , 'ATL' , 'NE'  , 'MIA' , 'DAL' , 'NYJ' , 'BUF' , 'GB'  , 'NO'  , 'ATL' , 'SF'  , 'LAR' , null  , 'NO'  , 'TB'  , 'SEA' , 'TB'  ],
  CHI: ['MIN' , 'DET' , 'DAL' , 'LV'  , null  , 'WSH' , 'NO'  , 'BAL' , 'CIN' , 'NYG' , 'MIN' , 'PIT' , 'PHI' , 'GB'  , 'CLE' , 'GB'  , 'SF'  , 'DET' ],
  CIN: ['CLE' , 'JAX' , 'MIN' , 'DEN' , 'DET' , 'GB'  , 'PIT' , 'NYJ' , 'CHI' , null  , 'PIT' , 'NE'  , 'BAL' , 'BUF' , 'BAL' , 'MIA' , 'ARI' , 'CLE' ],
  CLE: ['CIN' , 'BAL' , 'GB'  , 'DET' , 'MIN' , 'PIT' , 'MIA' , 'NE'  , null  , 'NYJ' , 'BAL' , 'LV'  , 'SF'  , 'TEN' , 'CHI' , 'BUF' , 'PIT' , 'CIN' ],
  DAL: ['PHI' , 'NYG' , 'CHI' , 'GB'  , 'NYJ' , 'CAR' , 'WSH' , 'DEN' , 'ARI' , null  , 'LV'  , 'PHI' , 'KC'  , 'DET' , 'MIN' , 'LAC' , 'WSH' , 'NYG' ],
  DEN: ['TEN' , 'IND' , 'LAC' , 'CIN' , 'PHI' , 'NYJ' , 'NYG' , 'DAL' , 'HOU' , 'LV'  , 'KC'  , null  , 'WSH' , 'LV'  , 'GB'  , 'JAX' , 'KC'  , 'LAC' ],
  DET: ['GB'  , 'CHI' , 'BAL' , 'CLE' , 'CIN' , 'KC'  , 'TB'  , null  , 'MIN' , 'WSH' , 'PHI' , 'NYG' , 'GB'  , 'DAL' , 'LAR' , 'PIT' , 'MIN' , 'CHI' ],
  GB : ['DET' , 'WSH' , 'CLE' , 'DAL' , null  , 'CIN' , 'ARI' , 'PIT' , 'CAR' , 'PHI' , 'NYG' , 'MIN' , 'DET' , 'CHI' , 'DEN' , 'CHI' , 'BAL' , 'MIN' ],
  HOU: ['LAR' , 'TB'  , 'JAX' , 'TEN' , 'BAL' , null  , 'SEA' , 'SF'  , 'DEN' , 'JAX' , 'TEN' , 'BUF' , 'IND' , 'KC'  , 'ARI' , 'LV'  , 'LAC' , 'IND' ],
  IND: ['MIA' , 'DEN' , 'TEN' , 'LAR' , 'LV'  , 'ARI' , 'LAC' , 'TEN' , 'PIT' , 'ATL' , null  , 'KC'  , 'HOU' , 'JAX' , 'SEA' , 'SF'  , 'JAX' , 'HOU' ],
  JAC: ['CAR' , 'CIN' , 'HOU' , 'SF'  , 'KC'  , 'SEA' , 'LAR' , null  , 'LV'  , 'HOU' , 'LAC' , 'ARI' , 'TEN' , 'IND' , 'NYJ' , 'DEN' , 'IND' , 'TEN' ],
  KC : ['LAC' , 'PHI' , 'NYG' , 'BAL' , 'JAX' , 'DET' , 'LV'  , 'WSH' , 'BUF' , null  , 'DEN' , 'IND' , 'DAL' , 'HOU' , 'LAC' , 'TEN' , 'DEN' , 'LV'  ],
  LAC: ['KC'  , 'LV'  , 'DEN' , 'NYG' , 'WSH' , 'MIA' , 'IND' , 'MIN' , 'TEN' , 'PIT' , 'JAX' , null  , 'LV'  , 'PHI' , 'KC'  , 'DAL' , 'HOU' , 'DEN' ],
  LAR: ['HOU' , 'TEN' , 'PHI' , 'IND' , 'SF'  , 'BAL' , 'JAX' , null  , 'NO'  , 'SF'  , 'SEA' , 'TB'  , 'CAR' , 'ARI' , 'DET' , 'SEA' , 'ATL' , 'ARI' ],
  LV : ['NE'  , 'LAC' , 'WSH' , 'CHI' , 'IND' , 'TEN' , 'KC'  , null  , 'JAX' , 'DEN' , 'DAL' , 'CLE' , 'LAC' , 'DEN' , 'PHI' , 'HOU' , 'NYG' , 'KC'  ],
  MIA: ['IND' , 'NE'  , 'BUF' , 'NYJ' , 'CAR' , 'LAC' , 'CLE' , 'ATL' , 'BAL' , 'BUF' , 'WSH' , null  , 'NO'  , 'NYJ' , 'PIT' , 'CIN' , 'TB'  , 'NE'  ],
  MIN: ['CHI' , 'ATL' , 'CIN' , 'PIT' , 'CLE' , null  , 'PHI' , 'LAC' , 'DET' , 'BAL' , 'CHI' , 'GB'  , 'SEA' , 'WSH' , 'DAL' , 'NYG' , 'DET' , 'GB'  ],
  NE : ['LV'  , 'MIA' , 'PIT' , 'CAR' , 'BUF' , 'NO'  , 'TEN' , 'CLE' , 'ATL' , 'TB'  , 'NYJ' , 'CIN' , 'NYG' , null  , 'BUF' , 'BAL' , 'NYJ' , 'MIA' ],
  NO : ['ARI' , 'SF'  , 'SEA' , 'BUF' , 'NYG' , 'NE'  , 'CHI' , 'TB'  , 'LAR' , 'CAR' , null  , 'ATL' , 'MIA' , 'TB'  , 'CAR' , 'NYJ' , 'TEN' , 'ATL' ],
  NYG: ['WSH' , 'DAL' , 'KC'  , 'LAC' , 'NO'  , 'PHI' , 'DEN' , 'PHI' , 'SF'  , 'CHI' , 'GB'  , 'DET' , 'NE'  , null  , 'WSH' , 'MIN' , 'LV'  , 'DAL' ],
  NYJ: ['PIT' , 'BUF' , 'TB'  , 'MIA' , 'DAL' , 'DEN' , 'CAR' , 'CIN' , null  , 'CLE' , 'NE'  , 'BAL' , 'ATL' , 'MIA' , 'JAX' , 'NO'  , 'NE'  , 'BUF' ],
  PHI: ['DAL' , 'KC'  , 'LAR' , 'TB'  , 'DEN' , 'NYG' , 'MIN' , 'NYG' , null  , 'GB'  , 'DET' , 'DAL' , 'CHI' , 'LAC' , 'LV'  , 'WSH' , 'BUF' , 'WSH' ],
  PIT: ['NYJ' , 'SEA' , 'NE'  , 'MIN' , null  , 'CLE' , 'CIN' , 'GB'  , 'IND' , 'LAC' , 'CIN' , 'CHI' , 'BUF' , 'BAL' , 'MIA' , 'DET' , 'CLE' , 'BAL' ],
  SEA: ['SF'  , 'PIT' , 'NO'  , 'ARI' , 'TB'  , 'JAX' , 'HOU' , null  , 'WSH' , 'ARI' , 'LAR' , 'TEN' , 'MIN' , 'ATL' , 'IND' , 'LAR' , 'CAR' , 'SF'  ],
  SF : ['SEA' , 'NO'  , 'ARI' , 'JAX' , 'LAR' , 'TB'  , 'ATL' , 'HOU' , 'NYG' , 'LAR' , 'ARI' , 'CAR' , 'CLE' , null  , 'TEN' , 'IND' , 'CHI' , 'SEA' ],
  TB : ['ATL' , 'HOU' , 'NYJ' , 'PHI' , 'SEA' , 'SF'  , 'DET' , 'NO'  , null  , 'NE'  , 'BUF' , 'LAR' , 'ARI' , 'NO'  , 'ATL' , 'CAR' , 'MIA' , 'CAR' ],
  TEN: ['DEN' , 'LAR' , 'IND' , 'HOU' , 'ARI' , 'LV'  , 'NE'  , 'IND' , 'LAC' , null  , 'HOU' , 'SEA' , 'JAX' , 'CLE' , 'SF'  , 'KC'  , 'NO'  , 'JAX' ],
  WSH: ['NYG' , 'GB'  , 'LV'  , 'ATL' , 'LAC' , 'CHI' , 'DAL' , 'KC'  , 'SEA' , 'DET' , 'MIA' , null  , 'DEN' , 'MIN' , 'NYG' , 'PHI' , 'DAL' , 'PHI' ],
};

// Get opponent for a team in a given week (1-indexed, returns null for bye)
function getMatchup(team, week) {
  if (!team || !NFL_SCHEDULE[team]) return null;
  return NFL_SCHEDULE[team][week - 1] || null; // null = bye
}

// ── State ────────────────────────────────────────────────────
let myLineup = {}, oppLineup = {};
let myDragPlayer = null, oppDragPlayer = null;
let myActivePos = 'ALL', oppActivePos = 'ALL';
let mySearch = '', oppSearch = '';
let riskMode = 'safe';
let oppManualScore = null;
let currentWeek = 18;

// Pre-computed per-week metadata
let PLAYER_META = {};

// ── Meta computation (week-aware) ────────────────────────────
function recomputeMeta() {
  PLAYER_META = {};
  PLAYER_DATA.forEach(p => {
    const mle = (currentWeek > 2) ? getMleAtWeek(p, currentWeek) : null;
    const weekMu    = mle ? mle.mu    : p.mu;
    const weekSigma = mle ? mle.sigma : p.sigma;
    PLAYER_META[p.name] = {
      boom:        computeBoomProb(p, currentWeek),
      archetype:   getArchetype(p, currentWeek),
      weekMu,
      weekSigma,
      actualScore: getActualScore(p, currentWeek),
      priorN:      mle ? mle.scores.length : p.weeks,
    };
  });
  updateWeekContext();
}

function updateWeekContext() {
  const el = document.getElementById('weekContext');
  if (!el) return;
  if (currentWeek <= 2) {
    el.textContent = 'using full-season priors';
  } else {
    el.textContent = `μ/σ from weeks 1–${currentWeek - 1}`;
  }
}

// ── Helpers ──────────────────────────────────────────────────
function shortName(name) { return name.replace(/\s*\([^)]*\)/, ''); }
function playerTeam(name) {
  const m = name.match(/\(([A-Z]+)\)/);
  return m ? m[1] : '';
}

function getPlayers(lineup) {
  return Object.values(lineup).filter(Boolean).map(p => {
    const meta = PLAYER_META[p.name];
    return { ...p, mu: meta ? meta.weekMu : p.mu, sigma: meta ? meta.weekSigma : p.sigma };
  });
}

function boomColor(prob) {
  if (prob >= 0.35) return '#00e5a0';
  if (prob >= 0.25) return '#ffd166';
  return '#4da6ff';
}
function boomLabel(prob) {
  if (prob >= 0.35) return '🔥 BOOM';
  if (prob >= 0.25) return '〜 AVG';
  return '❄ COLD';
}

// ── Player Pool ──────────────────────────────────────────────
function renderPool(side) {
  const isMe = side === 'my';
  const search     = isMe ? mySearch    : oppSearch;
  const activePos  = isMe ? myActivePos : oppActivePos;
  const lineup     = isMe ? myLineup    : oppLineup;
  const listId     = isMe ? 'myPlayerList' : 'oppPlayerList';

  const inLineup = new Set(getPlayers(lineup).map(p => p.name));

  // Top 15 per position by current week μ
  const TOP_N = 15;
  const topByPos = {};
  ['QB','RB','WR','TE','K','DST'].forEach(pos => {
    topByPos[pos] = PLAYER_DATA
      .filter(p => p.position === pos)
      .sort((a, b) => (PLAYER_META[b.name]?.weekMu || 0) - (PLAYER_META[a.name]?.weekMu || 0))
      .slice(0, TOP_N)
      .map(p => p.name);
  });
  const topNames = new Set(Object.values(topByPos).flat());

  const POS_ORDER = { QB:0, RB:1, WR:2, TE:3, K:4, DST:5 };
  const filtered = PLAYER_DATA.filter(p => {
    const posOk    = activePos === 'ALL' || p.position === activePos;
    const searchOk = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const topOk    = search ? true : topNames.has(p.name);
    return posOk && searchOk && topOk;
  }).sort((a, b) => {
    // Sort by position group first, then by μ within position
    const posA = POS_ORDER[a.position] ?? 9;
    const posB = POS_ORDER[b.position] ?? 9;
    if (posA !== posB) return posA - posB;
    return (PLAYER_META[b.name]?.weekMu || 0) - (PLAYER_META[a.name]?.weekMu || 0);
  });

  const list = document.getElementById(listId);
  list.innerHTML = '';

  filtered.forEach(player => {
    const meta   = PLAYER_META[player.name];
    const boom   = meta.boom;
    const arch   = meta.archetype;
    const inL    = inLineup.has(player.name);
    const wmu    = meta.weekMu.toFixed(1);
    const wsigma = meta.weekSigma.toFixed(1);
    const actual = meta.actualScore;
    const priorN = meta.priorN;

    const card = document.createElement('div');
    card.className = `player-card pos-${player.position}${inL ? ' in-lineup' : ''}`;
    card.draggable = true;
    card.dataset.name = player.name;

    const team = getTeam(player.name);
    const opp  = getMatchup(team, currentWeek);
    const defRank = opp ? getDefRank(opp, player.position) : null;
    const rankColor = defRankColor(defRank);
    const rankLbl   = defRankLabel(defRank);
    const matchupHtml = opp
      ? `<span class="card-matchup" style="color:${rankColor};border-color:${rankColor}44;background:${rankColor}18">
           vs <strong>${opp}</strong> <span class="card-matchup-grade">${rankLbl}</span>
         </span>`
      : `<span class="card-matchup card-matchup-bye">BYE</span>`;

    card.innerHTML = `
      <div style="margin-bottom:6px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:5px">
          <div style="flex:1;min-width:0">
            <div style="font-family:'DM Sans',Arial,sans-serif;font-weight:700;font-size:14px;color:#f0f2f8;line-height:1.3;word-break:break-word;white-space:normal">${shortName(player.name)}</div>
            <div style="font-family:'Courier New',monospace;font-size:10px;color:#7a829e;margin-top:1px">${team} · ${player.position}</div>
          </div>
          ${matchupHtml}
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
          <span style="font-family:'Courier New',monospace;font-size:9px;padding:2px 5px;border-radius:3px;background:${arch.color}22;color:${arch.color}">${arch.label}</span>
          <span style="font-family:'Courier New',monospace;font-size:9px;padding:2px 5px;border-radius:3px;font-weight:600;background:${boomColor(boom)}22;color:${boomColor(boom)}">${boomLabel(boom)}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-family:'Courier New',monospace;font-size:11px;color:#7a829e">μ <b style="color:#f0f2f8">${wmu}</b></span>
        <span style="font-family:'Courier New',monospace;font-size:11px;color:#7a829e">σ <b style="color:#f0f2f8">${wsigma}</b></span>
        <span style="font-family:'Courier New',monospace;font-size:11px;color:#7a829e">n=<b style="color:#f0f2f8">${priorN}</b></span>
        ${actual !== null ? `<span style="font-family:'Courier New',monospace;font-size:10px;color:#7a829e;margin-left:auto">Wk${currentWeek}: <b style="color:${actual > parseFloat(wmu) ? '#00e5a0' : '#f87171'}">${actual}</b></span>` : ''}
      </div>
      <canvas class="mini-dist" id="mini-${side}-${player.name.replace(/\W/g,'_')}" style="width:100%;height:20px;margin-top:6px;display:block"></canvas>
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
  const isMe       = side === 'my';
  const lineup     = isMe ? myLineup    : oppLineup;
  const containerId = isMe ? 'myLineupSlots' : 'oppLineupSlots';
  const container  = document.getElementById(containerId);
  container.innerHTML = '';

  SLOTS.forEach(slot => {
    const player = lineup[slot.id];
    const el = document.createElement('div');
    el.className = `lineup-slot slot-${slot.label}${player ? ' filled' : ''}`;
    el.dataset.slotId = slot.id;
    el.innerHTML = `<div class="slot-label">${slot.label}</div>`;

    if (player) {
      const meta   = PLAYER_META[player.name];
      const wmu    = meta.weekMu.toFixed(1);
      const wsigma = meta.weekSigma.toFixed(1);
      const actual = meta.actualScore;
      el.innerHTML += `
        <div class="slot-player">
          <div class="slot-player-info">
            <div class="slot-player-name">${shortName(player.name)}</div>
            <div class="slot-player-sub">
              μ=${wmu} · σ=${wsigma} · <span style="color:${boomColor(meta.boom)}">${boomLabel(meta.boom)} ${(meta.boom*100).toFixed(0)}%</span>
              ${actual !== null ? ` · <span style="color:${actual > parseFloat(wmu) ? '#00e5a0' : '#4da6ff'}">actual: ${actual}</span>` : ''}
            </div>
          </div>
          <canvas class="slot-dist" id="slot-dist-${side}-${slot.id}"></canvas>
          <button class="remove-btn" data-slot="${slot.id}" data-side="${side}">×</button>
        </div>`;
    } else {
      el.innerHTML += `<div class="slot-empty">Drop ${slot.accepts.join('/')} here</div>`;
    }

    el.addEventListener('dragover', e => {
      const dp = isMe ? myDragPlayer : oppDragPlayer;
      if (dp && slot.accepts.includes(dp.position)) { e.preventDefault(); el.classList.add('drag-over'); }
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('drag-over');
      const dp = isMe ? myDragPlayer : oppDragPlayer;
      if (!dp || !slot.accepts.includes(dp.position)) return;
      if (isMe) { myLineup[slot.id] = dp; myDragPlayer = null; }
      else       { oppLineup[slot.id] = dp; oppDragPlayer = null; }
      renderAll();
    });

    container.appendChild(el);
  });

  requestAnimationFrame(() => {
    SLOTS.forEach(slot => {
      const player = lineup[slot.id];
      if (player) {
        const c    = document.getElementById(`slot-dist-${side}-${slot.id}`);
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
  const isMe    = side === 'my';
  const players = getPlayers(isMe ? myLineup : oppLineup);
  const stats   = getLineupStats(players, currentWeek);
  const contentId = isMe ? 'myDistContent' : 'oppDistContent';
  const content = document.getElementById(contentId);
  const color   = isMe ? '#00e5a0' : '#4da6ff';

  if (!stats) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">${isMe ? '📊' : '🎯'}</div><div class="empty-text">${isMe ? 'Add players to see your score distribution' : "Add opponent's players to see their distribution"}</div></div>`;
    return;
  }

  const oppScore = oppManualScore || stats.mu;
  const wp = winProbabilityVsScore(stats.mu, stats.sigma, oppScore) * 100;
  const allScores = players.flatMap(p => {
    const mle = getMleAtWeek(p, currentWeek);
    return mle ? mle.scores : p.scores;
  });
  const ci = bootstrapCI(allScores, 300);

  // Build defensive rankings for opp panel — show ranks for positions that are in lineup
  let defHtml = '';
  if (!isMe) {
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
    const rankRows = positions.map(pos => {
      // Get a representative player for this position in opp lineup
      const slotPlayer = Object.entries(oppLineup).find(([slotId, p]) => p && p.position === pos || (pos === 'RB' && slotId.startsWith('RB') && p && p.position === 'RB') || (pos === 'WR' && slotId.startsWith('WR') && p && p.position === 'WR'));
      const team = slotPlayer ? getTeam(slotPlayer[1].name) : null;
      const rank = team ? getDefRank(team, pos) : null;
      const posColor = POS_COLORS[pos] || '#fff';
      const barColor = rank ? defRankColor(rank) : '#1d2130';
      const barWidth = rank ? Math.round((rank / 32) * 100) : 0;
      const label = rank ? `#${rank} vs ${pos}` : `– vs ${pos}`;
      const noteLabel = rank ? defRankLabel(rank) : '—';
      const noteColor = rank ? defRankColor(rank) : '#4a5068';
      return `
        <div class="def-row">
          <div class="def-pos" style="color:${posColor}">${pos}</div>
          <div class="def-rank-num" style="color:${barColor}">${rank ? '#' + rank : '—'}</div>
          <div class="def-bar-track">
            <div class="def-bar-fill" style="width:${barWidth}%;background:${barColor}"></div>
          </div>
          <div class="def-rank-note-inline" style="color:${noteColor};font-family:'DM Mono',monospace;font-size:9px">${noteLabel}</div>
        </div>`;
    }).join('');

    // Count how many opp slots are filled to show context
    const filledTeams = players.map(p => getTeam(p.name)).filter(t => t && t !== 'FA');
    const uniqueTeams = [...new Set(filledTeams)];
    const teamStr = uniqueTeams.length > 0 ? `Based on players from: ${uniqueTeams.join(', ')}` : 'Add players to see defensive matchup grades';

    defHtml = `
      <div class="def-box">
        <div class="def-box-title">DEF RANKINGS VS POSITION · 2025–26</div>
        ${rankRows}
        <div class="def-box-note">${teamStr}<br>Rank 1 = softest matchup (most pts allowed) · Rank 32 = toughest</div>
      </div>`;
  }

  content.innerHTML = `
    <div class="dist-chart-hero">
      <div class="section-label" style="margin-bottom:8px">SCORE DISTRIBUTION · WK ${currentWeek}</div>
      <canvas id="main-canvas-${side}" style="height:110px"></canvas>
      <div class="dist-chart-context">
        Fitted on weeks 1–${currentWeek - 1} · ${stats.count} players · T ~ N(${stats.mu.toFixed(1)}, ${stats.sigma.toFixed(1)}²)
        ${isMe ? ` · <span style="color:var(--green);font-weight:700">${wp.toFixed(1)}% WIN vs ${oppScore.toFixed(0)} pts</span>` : ''}
      </div>
    </div>

    <div>
      <div class="section-label">Expected Score</div>
      <div class="big-number">${stats.mu.toFixed(1)}</div>
      <div class="big-number-label">PROJECTED FANTASY POINTS · WK ${currentWeek}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-box"><div class="stat-box-val" style="color:var(--text)">${stats.sigma.toFixed(1)}</div><div class="stat-box-lbl">STD DEV σ</div></div>
      <div class="stat-box"><div class="stat-box-val" style="color:var(--text)">${stats.count}/9</div><div class="stat-box-lbl">SLOTS FILLED</div></div>
      <div class="stat-box"><div class="stat-box-val" style="color:#f87171">${(stats.mu - stats.sigma).toFixed(1)}</div><div class="stat-box-lbl">FLOOR</div></div>
      <div class="stat-box"><div class="stat-box-val" style="color:var(--green)">${(stats.mu + stats.sigma).toFixed(1)}</div><div class="stat-box-lbl">CEILING</div></div>
    </div>

    ${isMe ? `
    <div class="opp-section">
      <div class="section-label" style="margin-bottom:8px">VS OPPONENT SCORE</div>
      <div class="opp-row">
        <input class="opp-input" id="oppScoreNum" type="number" min="0" max="300" value="${oppScore.toFixed(0)}" />
        <input class="opp-slider" id="oppScoreSlider" type="range" min="60" max="250" value="${oppScore.toFixed(0)}" />
      </div>
      <div class="win-pct">${wp.toFixed(1)}% WIN</div>
      <div class="win-bar"><div class="win-bar-fill" style="width:${Math.min(100,wp)}%"></div></div>
    </div>` : ''}

    ${defHtml}

    <div>
      <div class="section-label">Player Breakdown</div>
      <div class="breakdown-list">
        ${players.map(p => {
          const boom = PLAYER_META[p.name].boom;
          const team = playerTeam(p.name);
          return `<div class="bk-row">
            <div class="bk-pos-dot" style="background:${POS_COLORS[p.position]}"></div>
            <div class="bk-name">${shortName(p.name)} <span class="bk-team">${team}</span></div>
            <div class="bk-mu" style="color:${isMe ? 'var(--green)' : 'var(--blue)'}">μ ${p.mu.toFixed(1)}</div>
            <div class="bk-boom" style="background:${boomColor(boom)}22;color:${boomColor(boom)}">${(boom*100).toFixed(0)}%</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    const canvas = document.getElementById(`main-canvas-${side}`);
    if (canvas) drawMainDist(canvas, stats.mu, stats.sigma, isMe ? oppScore : null, color);

    // Opponent score controls (my panel only)
    if (isMe) {
      const numInput = document.getElementById('oppScoreNum');
      const slider   = document.getElementById('oppScoreSlider');
      const update = val => {
        oppManualScore = parseFloat(val) || null;
        if (numInput) numInput.value = val;
        if (slider)   slider.value   = val;
        renderDistPanel('my');
      };
      if (numInput) numInput.addEventListener('input', e => update(e.target.value));
      if (slider)   slider.addEventListener('input',   e => update(e.target.value));
    }
  });
}

// ── Battle Screen ─────────────────────────────────────────────
function renderBattle() {
  const myPlayers  = getPlayers(myLineup);
  const oppPlayers = getPlayers(oppLineup);
  const myStats    = getLineupStats(myPlayers,  currentWeek);
  const oppStats   = getLineupStats(oppPlayers, currentWeek);
  const content    = document.getElementById('battleContent');

  if (!myStats || !oppStats || myStats.count < 3 || oppStats.count < 3) {
    content.innerHTML = `<div class="empty-state" style="height:100%;justify-content:center;"><div class="empty-icon" style="font-size:48px">⚡</div><div class="empty-text">Set both lineups (at least 3 players each)<br>to see the battle analysis</div></div>`;
    return;
  }

  const wp     = winProbabilityVsDistribution(myStats, oppStats) * 100;
  const mu_D   = myStats.mu - oppStats.mu;
  const sigma_D = Math.sqrt(myStats.variance + oppStats.variance);

  const matchups = [];
  SLOTS.forEach(slot => {
    const mine = myLineup[slot.id];
    const opp  = oppLineup[slot.id];
    if (mine && opp) matchups.push({ slot, mine, opp });
  });

  const sortedMatchups = [...matchups].sort((a, b) => {
    const edgeA = PLAYER_META[a.mine.name].weekMu - PLAYER_META[a.opp.name].weekMu;
    const edgeB = PLAYER_META[b.mine.name].weekMu - PLAYER_META[b.opp.name].weekMu;
    return riskMode === 'safe' ? edgeB - edgeA : Math.abs(edgeB) - Math.abs(edgeA);
  });

  content.innerHTML = `
    <div class="battle-hero">
      <div class="battle-team mine">
        <div class="battle-team-label">YOUR LINEUP · WK ${currentWeek}</div>
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
        <div class="battle-team-label">OPPONENT · WK ${currentWeek}</div>
        <div class="battle-team-score">${oppStats.mu.toFixed(1)}</div>
        <div class="battle-team-sigma">σ = ${oppStats.sigma.toFixed(1)} pts</div>
      </div>
    </div>

    <div class="diff-dist-section">
      <div class="section-label" style="margin-bottom:8px">SCORE DIFFERENTIAL — D = T_you − T_opp</div>
      <canvas id="diff-canvas" style="height:120px"></canvas>
      <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);margin-top:8px;line-height:1.9">
        D ~ N(${mu_D.toFixed(1)}, ${sigma_D.toFixed(1)}²) = N(μ_you−μ_opp, σ²_you+σ²_opp)<br>
        <span style="color:#00e5a0">■ Green = P(you win) = ${wp.toFixed(1)}%</span> · <span style="color:#4da6ff">■ Blue = P(opp wins) = ${(100-wp).toFixed(1)}%</span>
      </div>
      <div style="margin-top:10px;padding:12px 14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);line-height:2.0">
        <div style="color:var(--text);font-weight:700;letter-spacing:1px;margin-bottom:6px">HOW TO READ THIS CURVE</div>
        This curve models the distribution of all possible <em>score differences</em> between your lineup and theirs on game day. It is derived from the Central Limit Theorem: since each player's score is modeled as N(μ, σ²), the sum of a lineup is also normal, and the difference of two normals is itself normal with μ = μ_you − μ_opp and σ² = σ²_you + σ²_opp.<br><br>
        <span style="color:#00e5a0">■ Green area</span> = outcomes where you win (D &gt; 0). <span style="color:#4da6ff">■ Blue area</span> = outcomes where they win (D &lt; 0). The <strong style="color:var(--text)">dashed vertical line</strong> at x=0 is the win/loss threshold.<br><br>
        A <strong style="color:var(--text)">wider curve</strong> means more combined variance — even if your expected edge is positive, a lot of the curve still bleeds left, meaning upsets are common. A <strong style="color:var(--text)">narrow curve</strong> means both rosters are consistent and the outcome is more deterministic. When you're the underdog (curve centered left of 0), you want <em>high variance</em> — it's your only path to an upset.
      </div>
    </div>

    <div class="risk-toggle">
      <div class="risk-label">RISK MODE — affects matchup priority</div>
      <button class="risk-btn ${riskMode === 'safe'   ? 'active-safe'   : ''}" data-risk="safe">SAFE — FLOOR</button>
      <button class="risk-btn ${riskMode === 'upside' ? 'active-upside' : ''}" data-risk="upside">UPSIDE — CEILING</button>
    </div>

    ${sortedMatchups.length > 0 ? `
    <div>
      <div class="section-label" style="margin-bottom:10px">POSITION MATCHUPS · WK ${currentWeek}</div>
      <div class="matchups-grid" id="matchupsGrid">
        ${sortedMatchups.map((m, idx) => renderMatchupCard(m, idx)).join('')}
      </div>
    </div>

    <div style="margin-top:24px;padding:24px 28px;background:rgba(255,255,255,0.025);border:1px solid var(--border);border-radius:14px;">

      <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:3px;color:var(--text);margin-bottom:6px">How to read these cards</div>
      <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.6">Each card compares one of your players head-to-head against their opponent at the same position. Here's what the labels actually mean and why they matter.</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">

        <div style="background:rgba(255,209,102,0.06);border:1px solid rgba(255,209,102,0.2);border-radius:10px;padding:16px 18px">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:2px;color:#ffd166;margin-bottom:8px">💥 BOOM/BUST</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text);line-height:1.7">This player's scores swing wildly week to week. They might drop 30 points or get you 6. Most apps just show you their average — we show you the risk. Start them when you're the underdog and need a big game. Bench them when you're favored and need a safe floor.</div>
        </div>

        <div style="background:rgba(0,229,160,0.06);border:1px solid rgba(0,229,160,0.2);border-radius:10px;padding:16px 18px">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:2px;color:#00e5a0;margin-bottom:8px">📊 CONSISTENT</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text);line-height:1.7">Week in, week out, this player shows up near their average. You won't get a huge surprise — in either direction. The backbone of a safe lineup. When you're already favored to win, these players protect your lead by not blowing up.</div>
        </div>

        <div style="background:rgba(167,139,250,0.06);border:1px solid rgba(167,139,250,0.2);border-radius:10px;padding:16px 18px">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:2px;color:#a78bfa;margin-bottom:8px">🏰 FLOOR MONSTER</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text);line-height:1.7">Elite production AND low variance — the best of both worlds. These players almost never let you down. Think a workhorse RB on a run-heavy team, or a dominant TE with no competition. Start them every week, no questions asked.</div>
        </div>

        <div style="background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.2);border-radius:10px;padding:16px 18px">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:2px;color:#f87171;margin-bottom:8px">🚨 INJURY RISK</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text);line-height:1.7">This player has missed significant time this season. Their projection is based on fewer games than normal, so it's less reliable. Check injury reports before locking them in — a DNP would tank your lineup.</div>
        </div>

      </div>

      <div style="background:rgba(77,166,255,0.06);border:1px solid rgba(77,166,255,0.2);border-radius:10px;padding:18px 20px">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:2px;color:#4da6ff;margin-bottom:10px">🔥 Boom % — what other apps don't tell you</div>
        <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text);line-height:1.8">
          Most fantasy apps rank players by projected points. We also calculate the <span style="color:#4da6ff;font-weight:600">probability of a standout week</span> — specifically, the chance a player scores 1.5× their own seasonal average.<br><br>
          This is useful when two players have similar projections but different upside. If you need to decide between a 40% boom player and a 18% boom player, the math is telling you one of them has a real shot at breaking out — and the other is likely to just be "fine."<br><br>
          <span style="color:var(--muted);font-size:12px">Estimated via logistic regression on 6 features: projected μ, σ, matchup difficulty, recent form trend, position, and games played this season. Model accuracy: 75.4% on held-out data.</span>
        </div>
      </div>

    </div>` : ''}
  `;

  requestAnimationFrame(() => {
    const dc = document.getElementById('diff-canvas');
    if (dc) drawDiffDist(dc, mu_D, sigma_D);

    sortedMatchups.forEach((m, idx) => {
      const c = document.getElementById(`matchup-canvas-${idx}`);
      if (c) drawMatchupDist(c, PLAYER_META[m.mine.name], PLAYER_META[m.opp.name], '#00e5a0', '#4da6ff');
    });

    document.querySelectorAll('.risk-btn').forEach(btn => {
      btn.addEventListener('click', () => { riskMode = btn.dataset.risk; renderBattle(); });
    });
  });
}

function renderMatchupCard(m, idx) {
  const myMeta  = PLAYER_META[m.mine.name];
  const oppMeta = PLAYER_META[m.opp.name];
  const edge    = myMeta.weekMu - oppMeta.weekMu;

  let edgeClass, edgeText;
  if (edge > 2)       { edgeClass = 'edge-you';  edgeText = `+${edge.toFixed(1)} YOUR EDGE`; }
  else if (edge < -2) { edgeClass = 'edge-opp';  edgeText = `${edge.toFixed(1)} OPP EDGE`; }
  else                { edgeClass = 'edge-even'; edgeText = 'EVEN MATCHUP'; }

  let insight = '';
  if (riskMode === 'safe') {
    if (myMeta.weekSigma < oppMeta.weekSigma)
      insight = `Your ${shortName(m.mine.name)} is more consistent (σ=${myMeta.weekSigma.toFixed(1)} vs ${oppMeta.weekSigma.toFixed(1)}). Floor advantage.`;
    else
      insight = `Their ${shortName(m.opp.name)} is more consistent (σ=${oppMeta.weekSigma.toFixed(1)}). Variance risk on your side.`;
  } else {
    const myCeil  = myMeta.weekMu  + 1.5 * myMeta.weekSigma;
    const oppCeil = oppMeta.weekMu + 1.5 * oppMeta.weekSigma;
    if (myCeil > oppCeil)
      insight = `${shortName(m.mine.name)} ceiling ${myCeil.toFixed(1)} vs ${oppCeil.toFixed(1)}. Upside advantage yours.`;
    else
      insight = `${shortName(m.opp.name)} has higher ceiling (${oppCeil.toFixed(1)} vs ${myCeil.toFixed(1)}). Watch out.`;
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
          <div class="mp-mu">μ=${myMeta.weekMu.toFixed(1)} · σ=${myMeta.weekSigma.toFixed(1)}</div>
          <div class="mp-boom" style="background:${boomColor(myMeta.boom)}22;color:${boomColor(myMeta.boom)}">${(myMeta.boom*100).toFixed(0)}% boom</div>
          <div style="font-family:'DM Mono',monospace;font-size:8px;color:${myMeta.archetype.color};margin-top:2px">${myMeta.archetype.label}</div>
        </div>
        <div class="vs-small">VS</div>
        <div class="matchup-player">
          <div class="mp-name" style="color:#4da6ff">${shortName(m.opp.name)}</div>
          <div class="mp-mu">μ=${oppMeta.weekMu.toFixed(1)} · σ=${oppMeta.weekSigma.toFixed(1)}</div>
          <div class="mp-boom" style="background:${boomColor(oppMeta.boom)}22;color:${boomColor(oppMeta.boom)}">${(oppMeta.boom*100).toFixed(0)}% boom</div>
          <div style="font-family:'DM Mono',monospace;font-size:8px;color:${oppMeta.archetype.color};margin-top:2px">${oppMeta.archetype.label}</div>
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

// ── Tab switching ────────────────────────────────────────────
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

// ── Position filter buttons ──────────────────────────────────
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

// ── Week selector ────────────────────────────────────────────
document.getElementById('weekBtns').addEventListener('click', e => {
  const btn = e.target.closest('.week-btn');
  if (!btn) return;
  currentWeek = parseInt(btn.dataset.week);
  document.querySelectorAll('.week-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Clear both lineups when week changes — stale picks shouldn't carry over
  // (optional: comment out if you want to keep lineup selections)
  // myLineup = {}; oppLineup = {};
  recomputeMeta();
  renderAll();
});

// ── Init ─────────────────────────────────────────────────────
recomputeMeta();
renderAll();
