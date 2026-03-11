// ── DATA ──
const PLAYERS = [
  // QBs
  { id:'p1',  name:'Josh Allen',        pos:'QB',  mu:28.4, sigma:5.2, team:'BUF', tag:'boom' },
  { id:'p2',  name:'Drake Maye',        pos:'QB',  mu:21.4, sigma:3.9, team:'NE',  tag:'cold' },
  { id:'p3',  name:'Trevor Lawrence',   pos:'QB',  mu:19.8, sigma:4.1, team:'JAX', tag:null },
  { id:'p4',  name:'Matthew Stafford',  pos:'QB',  mu:22.1, sigma:4.4, team:'LAR', tag:null },
  { id:'p5',  name:'Patrick Mahomes',   pos:'QB',  mu:26.3, sigma:5.0, team:'KC',  tag:'boom' },
  { id:'p6',  name:'Justin Herbert',    pos:'QB',  mu:23.5, sigma:4.6, team:'LAC', tag:null },
  { id:'p7',  name:'Jalen Hurts',       pos:'QB',  mu:27.0, sigma:5.5, team:'PHI', tag:'boom' },
  { id:'p8',  name:'Lamar Jackson',     pos:'QB',  mu:29.1, sigma:6.2, team:'BAL', tag:'boom' },
  { id:'p9',  name:'Jayden Daniels',    pos:'QB',  mu:20.5, sigma:4.8, team:'WAS', tag:null },
  { id:'p10', name:'C.J. Stroud',       pos:'QB',  mu:21.8, sigma:4.0, team:'HOU', tag:null },
  // RBs
  { id:'p11', name:'Derrick Henry',     pos:'RB',  mu:18.2, sigma:5.8, team:'BAL', tag:'boom' },
  { id:'p12', name:'Bijan Robinson',    pos:'RB',  mu:16.4, sigma:4.9, team:'ATL', tag:null },
  { id:'p13', name:'Saquon Barkley',    pos:'RB',  mu:19.8, sigma:6.1, team:'PHI', tag:'boom' },
  { id:'p14', name:'Josh Jacobs',       pos:'RB',  mu:14.2, sigma:4.3, team:'GB',  tag:'bust' },
  { id:'p15', name:"De'Von Achane",     pos:'RB',  mu:17.6, sigma:7.2, team:'MIA', tag:'boom' },
  { id:'p16', name:'Breece Hall',       pos:'RB',  mu:15.8, sigma:5.2, team:'NYJ', tag:null },
  { id:'p17', name:'Aaron Jones',       pos:'RB',  mu:13.4, sigma:4.1, team:'MIN', tag:'bust' },
  // WRs
  { id:'p18', name:"Ja'Marr Chase",     pos:'WR',  mu:22.3, sigma:6.8, team:'CIN', tag:'boom' },
  { id:'p19', name:'Tyreek Hill',       pos:'WR',  mu:19.5, sigma:7.1, team:'MIA', tag:'boom' },
  { id:'p20', name:'Davante Adams',     pos:'WR',  mu:16.2, sigma:5.4, team:'LV',  tag:null },
  { id:'p21', name:'Stefon Diggs',      pos:'WR',  mu:14.8, sigma:5.2, team:'HOU', tag:'bust' },
  { id:'p22', name:'CeeDee Lamb',       pos:'WR',  mu:21.0, sigma:6.3, team:'DAL', tag:'boom' },
  { id:'p23', name:'Amon-Ra St. Brown', pos:'WR',  mu:17.4, sigma:4.9, team:'DET', tag:null },
  { id:'p24', name:'Puka Nacua',        pos:'WR',  mu:15.6, sigma:5.0, team:'LAR', tag:null },
  { id:'p25', name:'Caleb Williams',    pos:'WR',  mu:12.8, sigma:3.8, team:'CHI', tag:'cold' },
  // TEs
  { id:'p26', name:'Sam LaPorta',       pos:'TE',  mu:12.4, sigma:4.2, team:'DET', tag:null },
  { id:'p27', name:'Dallas Goedert',    pos:'TE',  mu:13.8, sigma:4.8, team:'PHI', tag:null },
  { id:'p28', name:'Travis Kelce',      pos:'TE',  mu:16.2, sigma:5.1, team:'KC',  tag:'boom' },
  { id:'p29', name:'Mark Andrews',      pos:'TE',  mu:14.1, sigma:4.6, team:'BAL', tag:null },
  // Ks
  { id:'p30', name:'Tyler Bass',        pos:'K',   mu:8.4,  sigma:2.8, team:'BUF', tag:null },
  { id:'p31', name:'Evan McPherson',    pos:'K',   mu:9.1,  sigma:3.0, team:'CIN', tag:'boom' },
  { id:'p32', name:'Jake Elliott',      pos:'K',   mu:8.8,  sigma:2.6, team:'PHI', tag:null },
  // DSTs
  { id:'p33', name:'SF 49ers DST',      pos:'DST', mu:8.6,  sigma:3.9, team:'SF',  tag:null },
  { id:'p34', name:'DAL Cowboys DST',   pos:'DST', mu:7.4,  sigma:3.6, team:'DAL', tag:null },
  { id:'p35', name:'NYJ Jets DST',      pos:'DST', mu:9.2,  sigma:4.2, team:'NYJ', tag:'boom' },
];

// ── STATE ──
let currentPosFilter = 'ALL';
let currentSearch = '';
let draggedId = null;
const slotData = {}; // slotId -> player object

let chart = null;

// ── INIT ──
renderPlayerList();
initChart();

// ── PLAYER LIST ──
function renderPlayerList() {
  const q = currentSearch.toLowerCase();
  const list = PLAYERS.filter(p => {
    const matchPos = currentPosFilter === 'ALL' || p.pos === currentPosFilter;
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q);
    const notPlaced = !Object.values(slotData).some(s => s && s.id === p.id);
    return matchPos && matchSearch && notPlaced;
  });

  const el = document.getElementById('playerList');
  el.innerHTML = list.map(p => `
    <div class="player-card" id="card-${p.id}" draggable="true"
      ondragstart="onDragStart(event,'${p.id}')"
      ondragend="onDragEnd(event)">
      <span class="pos-badge ${p.pos}">${p.pos}</span>
      <div class="player-info">
        <div class="player-name">${p.name}</div>
        <div class="player-meta">${p.team} · σ=${p.sigma}</div>
      </div>
      <div class="player-mu">μ ${p.mu}</div>
      ${p.tag ? `<span class="tag ${p.tag}">${p.tag.toUpperCase()}</span>` : ''}
    </div>
  `).join('');
}

function filterPos(pos, btn) {
  currentPosFilter = pos;
  document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPlayerList();
}

function filterPlayers() {
  currentSearch = document.getElementById('searchInput').value;
  renderPlayerList();
}

// ── DRAG & DROP ──
function onDragStart(e, id) {
  draggedId = id;
  setTimeout(() => {
    const el = document.getElementById('card-' + id);
    if (el) el.classList.add('dragging');
  }, 0);
}

function onDragEnd(e) {
  document.querySelectorAll('.player-card').forEach(c => c.classList.remove('dragging'));
}

function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDrop(e, zone) {
  e.preventDefault();
  zone.classList.remove('drag-over');

  const player = PLAYERS.find(p => p.id === draggedId);
  if (!player) return;

  const slotPos = zone.dataset.pos;
  const flexOk = slotPos === 'FLEX' && ['RB','WR','TE'].includes(player.pos);
  if (slotPos !== player.pos && !flexOk) {
    zone.style.borderColor = 'var(--blue)';
    setTimeout(() => zone.style.borderColor = '', 600);
    return;
  }

  // If slot already filled, old player returns to pool automatically
  slotData[zone.id] = player;
  renderSlot(zone, player);
  renderPlayerList();
  updateStats();
}

function renderSlot(zone, player) {
  zone.classList.add('filled');
  zone.innerHTML = `
    <div class="slot-player">
      <span class="pos-badge ${player.pos}">${player.pos}</span>
      <div style="flex:1">
        <div class="slot-player-name">${player.name}</div>
        <div class="slot-player-stats">${player.team} · σ=${player.sigma}${player.tag ? ' · <span style="color:var(--'+tagColor(player.tag)+')">' + player.tag.toUpperCase() + '</span>' : ''}</div>
      </div>
      <div class="slot-player-mu">μ ${player.mu}</div>
      <button class="slot-remove" onclick="removeSlot('${zone.id}')">✕</button>
    </div>
  `;
}

function tagColor(tag) {
  if (tag === 'boom') return 'green';
  if (tag === 'bust') return 'blue';
  if (tag === 'cold') return 'blue';
  return 'muted';
}

function removeSlot(slotId) {
  delete slotData[slotId];
  const zone = document.getElementById(slotId);
  zone.classList.remove('filled');
  zone.innerHTML = `<span class="drop-placeholder">${getPlaceholder(slotId)}</span>`;
  renderPlayerList();
  updateStats();
}

function getPlaceholder(slotId) {
  if (slotId === 'slot-FLEX') return 'Drop RB / WR / TE here';
  const pos = slotId.replace('slot-','').replace(/\d/,'');
  return `Drop ${pos} here`;
}

// ── STATS & CHART ──
function updateStats() {
  const filled = Object.values(slotData).filter(Boolean);
  const n = filled.length;
  const total = 9;

  document.getElementById('slotsFilled').textContent = `${n}/${total}`;

  if (n === 0) {
    document.getElementById('expectedScore').textContent = '—';
    document.getElementById('stdDev').textContent = '—';
    document.getElementById('floorScore').textContent = '—';
    document.getElementById('ceilScore').textContent = '—';
    document.getElementById('ciLow').textContent = '—';
    document.getElementById('ciHigh').textContent = '—';
    document.getElementById('ciMid').textContent = 'μ';
    document.getElementById('playerBreakdown').innerHTML = `
      <div class="empty-state"><div class="big">📊</div>Drop players into the lineup<br>to see their distribution breakdown.</div>`;
    updateChart(null);
    return;
  }

  const mu = filled.reduce((s,p) => s + p.mu, 0);
  const variance = filled.reduce((s,p) => s + p.sigma*p.sigma, 0);
  const sigma = Math.sqrt(variance);
  const floor = mu - sigma;
  const ceil  = mu + sigma;
  const ciLow  = +(mu - 1.96*sigma).toFixed(1);
  const ciHigh = +(mu + 1.96*sigma).toFixed(1);

  document.getElementById('expectedScore').textContent = mu.toFixed(1);
  document.getElementById('stdDev').textContent = sigma.toFixed(1);
  document.getElementById('floorScore').textContent = floor.toFixed(1);
  document.getElementById('ceilScore').textContent = ceil.toFixed(1);
  document.getElementById('ciLow').textContent = ciLow;
  document.getElementById('ciHigh').textContent = ciHigh;
  document.getElementById('ciMid').textContent = mu.toFixed(1);

  // CI bar
  const range = ciHigh - ciLow;
  const trackMin = ciLow - range * 0.1;
  const trackMax = ciHigh + range * 0.1;
  const trackRange = trackMax - trackMin;
  const fillLeft = ((ciLow - trackMin) / trackRange * 100).toFixed(1);
  const fillWidth = ((ciHigh - ciLow) / trackRange * 100).toFixed(1);
  const dotLeft = ((mu - trackMin) / trackRange * 100).toFixed(1);
  document.getElementById('ciBar').style.left = fillLeft + '%';
  document.getElementById('ciBar').style.width = fillWidth + '%';
  document.getElementById('ciDot').style.left = dotLeft + '%';

  updateChart({ mu, sigma });
  renderBreakdown(filled);
}

function renderBreakdown(players) {
  const el = document.getElementById('playerBreakdown');
  el.innerHTML = players.map(p => {
    const boomPct = Math.round((1 - normalCDF((p.mu * 1.3 - p.mu) / p.sigma)) * 100);
    const cls = boomPct >= 30 ? 'high' : boomPct >= 15 ? 'med' : 'low';
    return `
      <div class="breakdown-row">
        <span class="pos-badge ${p.pos}">${p.pos}</span>
        <div class="breakdown-name">${p.name}</div>
        <div class="breakdown-mu">μ ${p.mu}</div>
        <span class="boom-pct ${cls}">${boomPct}%</span>
      </div>
    `;
  }).join('');
}

function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z*z/2);
  const p = d*t*(0.3193815+t*(-0.3565638+t*(1.7814779+t*(-1.8212560+t*1.3302744))));
  return z > 0 ? 1 - p : p;
}

function normalPDF(x, mu, sigma) {
  return Math.exp(-0.5 * ((x - mu)/sigma)**2) / (sigma * Math.sqrt(2*Math.PI));
}

function initChart() {
  const ctx = document.getElementById('distChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{
      data: [],
      borderColor: 'rgba(77,166,255,0.9)',
      backgroundColor: 'rgba(77,166,255,0.15)',
      borderWidth: 2.5,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
    }]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false, beginAtZero: true }
      },
      animation: { duration: 400 }
    }
  });
}

function updateChart(params) {
  if (!chart) return;
  if (!params) {
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.update();
    return;
  }
  const { mu, sigma } = params;
  const lo = mu - 3.5 * sigma, hi = mu + 3.5 * sigma;
  const steps = 80;
  const labels = [], data = [];
  for (let i = 0; i <= steps; i++) {
    const x = lo + (hi - lo) * i / steps;
    labels.push(x.toFixed(1));
    data.push(normalPDF(x, mu, sigma));
  }
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update();
}

// ── TABS & WEEKS ──
function setTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const titles = { yours: "Your Lineup", opponent: "Opponent's Lineup", battle: "⚡ Battle View" };
  document.getElementById('lineupTitle').textContent = titles[tab] || "Lineup";
}

function setWeek(w, btn) {
  document.querySelectorAll('.week-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function toggleGuide() {
  document.getElementById('guidePanel').classList.toggle('open');
}

// Close guide on outside click
document.addEventListener('click', e => {
  const panel = document.getElementById('guidePanel');
  const btn = document.querySelector('.guide-btn');
  if (!panel.contains(e.target) && e.target !== btn) {
    panel.classList.remove('open');
  }
});