const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

// ──────────────────────────────────────────────
// Fixture Data – inline (72 group-stage fixtures)
// ──────────────────────────────────────────────
const FIXTURES = [{"id":1,"group":"A","home":"Mexico","away":"South Korea","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Estadio Azteca, Mexico City","date":"2026-06-13"},{"id":2,"group":"A","home":"Czech Republic","away":"South Africa","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Estadio BBVA, Monterrey","date":"2026-06-14"},{"id":3,"group":"A","home":"Mexico","away":"Czech Republic","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Estadio Akron, Guadalajara","date":"2026-06-15"},{"id":4,"group":"A","home":"South Korea","away":"South Africa","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Estadio Universitario, San Nicol\u00e1s","date":"2026-06-16"},{"id":5,"group":"A","home":"Mexico","away":"South Africa","status":"finished","homeScore":2,"awayScore":0,"stadium":"Estadio Azteca, Mexico City","date":"2026-06-17"},{"id":6,"group":"A","home":"South Korea","away":"Czech Republic","status":"finished","homeScore":2,"awayScore":1,"stadium":"Estadio BBVA, Monterrey","date":"2026-06-18"},{"id":7,"group":"B","home":"Switzerland","away":"Canada","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"BC Place, Vancouver","date":"2026-06-14"},{"id":8,"group":"B","home":"Qatar","away":"Bosnia and Herzegovina","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"BMO Field, Toronto","date":"2026-06-15"},{"id":9,"group":"B","home":"Switzerland","away":"Qatar","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Stade Olympique, Montreal","date":"2026-06-16"},{"id":10,"group":"B","home":"Canada","away":"Bosnia and Herzegovina","status":"finished","homeScore":1,"awayScore":1,"stadium":"Commonwealth Stadium, Edmonton","date":"2026-06-17"},{"id":11,"group":"B","home":"Switzerland","away":"Bosnia and Herzegovina","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"BC Place, Vancouver","date":"2026-06-18"},{"id":12,"group":"B","home":"Canada","away":"Qatar","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"BMO Field, Toronto","date":"2026-06-19"},{"id":13,"group":"C","home":"Scotland","away":"Morocco","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Maracan\u00e3, Rio de Janeiro","date":"2026-06-15"},{"id":14,"group":"C","home":"Brazil","away":"Haiti","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Arena Corinthians, S\u00e3o Paulo","date":"2026-06-16"},{"id":15,"group":"C","home":"Scotland","away":"Brazil","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Est\u00e1dio Nacional, Bras\u00edlia","date":"2026-06-17"},{"id":16,"group":"C","home":"Morocco","away":"Haiti","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Arena do Gr\u00eamio, Porto Alegre","date":"2026-06-18"},{"id":17,"group":"C","home":"Scotland","away":"Haiti","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Maracan\u00e3, Rio de Janeiro","date":"2026-06-19"},{"id":18,"group":"C","home":"Morocco","away":"Brazil","status":"finished","homeScore":1,"awayScore":2,"stadium":"Arena Corinthians, S\u00e3o Paulo","date":"2026-06-20"},{"id":19,"group":"D","home":"United States","away":"Australia","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"SoFi Stadium, Los Angeles","date":"2026-06-13"},{"id":20,"group":"D","home":"Turkey","away":"Paraguay","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"MetLife Stadium, New York","date":"2026-06-14"},{"id":21,"group":"D","home":"United States","away":"Turkey","status":"finished","homeScore":1,"awayScore":0,"stadium":"AT&T Stadium, Dallas","date":"2026-06-15"},{"id":22,"group":"D","home":"Australia","away":"Paraguay","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"NRG Stadium, Houston","date":"2026-06-16"},{"id":23,"group":"D","home":"United States","away":"Paraguay","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"SoFi Stadium, Los Angeles","date":"2026-06-17"},{"id":24,"group":"D","home":"Australia","away":"Turkey","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"MetLife Stadium, New York","date":"2026-06-18"},{"id":25,"group":"E","home":"Germany","away":"Ivory Coast","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Allianz Arena, Munich","date":"2026-06-14"},{"id":26,"group":"E","home":"Ecuador","away":"Cura\u00e7ao","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Olympiastadion, Berlin","date":"2026-06-15"},{"id":27,"group":"E","home":"Germany","away":"Ecuador","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Signal Iduna Park, Dortmund","date":"2026-06-16"},{"id":28,"group":"E","home":"Ivory Coast","away":"Cura\u00e7ao","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Mercedes-Benz Arena, Stuttgart","date":"2026-06-17"},{"id":29,"group":"E","home":"Germany","away":"Cura\u00e7ao","status":"finished","homeScore":4,"awayScore":0,"stadium":"Allianz Arena, Munich","date":"2026-06-18"},{"id":30,"group":"E","home":"Ivory Coast","away":"Ecuador","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Olympiastadion, Berlin","date":"2026-06-19"},{"id":31,"group":"F","home":"Sweden","away":"Japan","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Amsterdam Arena, Amsterdam","date":"2026-06-15"},{"id":32,"group":"F","home":"Netherlands","away":"Tunisia","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"De Kuip, Rotterdam","date":"2026-06-16"},{"id":33,"group":"F","home":"Sweden","away":"Netherlands","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Johan Cruyff Arena, Amsterdam","date":"2026-06-17"},{"id":34,"group":"F","home":"Japan","away":"Tunisia","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Philips Stadion, Eindhoven","date":"2026-06-18"},{"id":35,"group":"F","home":"Sweden","away":"Tunisia","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Amsterdam Arena, Amsterdam","date":"2026-06-19"},{"id":36,"group":"F","home":"Japan","away":"Netherlands","status":"finished","homeScore":1,"awayScore":2,"stadium":"De Kuip, Rotterdam","date":"2026-06-20"},{"id":37,"group":"G","home":"Belgium","away":"Egypt","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"King Baudouin Stadium, Brussels","date":"2026-06-13"},{"id":38,"group":"G","home":"Iran","away":"New Zealand","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Stade Roi Baudouin, Brussels","date":"2026-06-14"},{"id":39,"group":"G","home":"Belgium","away":"Iran","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Stade de Sclessin, Li\u00e8ge","date":"2026-06-15"},{"id":40,"group":"G","home":"Egypt","away":"New Zealand","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Jan Breydel Stadium, Bruges","date":"2026-06-16"},{"id":41,"group":"G","home":"Belgium","away":"New Zealand","status":"finished","homeScore":2,"awayScore":0,"stadium":"King Baudouin Stadium, Brussels","date":"2026-06-17"},{"id":42,"group":"G","home":"Egypt","away":"Iran","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Stade Roi Baudouin, Brussels","date":"2026-06-18"},{"id":43,"group":"H","home":"Uruguay","away":"Saudi Arabia","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Santiago Bernab\u00e9u, Madrid","date":"2026-06-14"},{"id":44,"group":"H","home":"Spain","away":"Cape Verde","status":"finished","homeScore":3,"awayScore":0,"stadium":"Camp Nou, Barcelona","date":"2026-06-15"},{"id":45,"group":"H","home":"Uruguay","away":"Spain","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Metropolitano Stadium, Madrid","date":"2026-06-16"},{"id":46,"group":"H","home":"Saudi Arabia","away":"Cape Verde","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"La Cartuja, Seville","date":"2026-06-17"},{"id":47,"group":"H","home":"Uruguay","away":"Cape Verde","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Santiago Bernab\u00e9u, Madrid","date":"2026-06-18"},{"id":48,"group":"H","home":"Saudi Arabia","away":"Spain","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Camp Nou, Barcelona","date":"2026-06-19"},{"id":49,"group":"I","home":"France","away":"Senegal","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Stade de France, Paris","date":"2026-06-15"},{"id":50,"group":"I","home":"Iraq","away":"Norway","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Parc des Princes, Paris","date":"2026-06-16"},{"id":51,"group":"I","home":"France","away":"Iraq","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Stade V\u00e9lodrome, Marseille","date":"2026-06-17"},{"id":52,"group":"I","home":"Senegal","away":"Norway","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Groupama Stadium, Lyon","date":"2026-06-18"},{"id":53,"group":"I","home":"France","away":"Norway","status":"finished","homeScore":2,"awayScore":0,"stadium":"Stade de France, Paris","date":"2026-06-19"},{"id":54,"group":"I","home":"Senegal","away":"Iraq","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Parc des Princes, Paris","date":"2026-06-20"},{"id":55,"group":"J","home":"Argentina","away":"Algeria","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Estadio Monumental, Buenos Aires","date":"2026-06-13"},{"id":56,"group":"J","home":"Austria","away":"Jordan","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Estadio Libertadores, Buenos Aires","date":"2026-06-14"},{"id":57,"group":"J","home":"Argentina","away":"Austria","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Estadio Mario Kempes, C\u00f3rdoba","date":"2026-06-15"},{"id":58,"group":"J","home":"Algeria","away":"Jordan","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Estadio Ciudad de La Plata, La Plata","date":"2026-06-16"},{"id":59,"group":"J","home":"Argentina","away":"Jordan","status":"finished","homeScore":3,"awayScore":0,"stadium":"Estadio Monumental, Buenos Aires","date":"2026-06-17"},{"id":60,"group":"J","home":"Algeria","away":"Austria","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Estadio Libertadores, Buenos Aires","date":"2026-06-18"},{"id":61,"group":"K","home":"Portugal","away":"DR Congo","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Est\u00e1dio da Luz, Lisbon","date":"2026-06-14"},{"id":62,"group":"K","home":"Uzbekistan","away":"Colombia","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Est\u00e1dio Jos\u00e9 Alvalade, Lisbon","date":"2026-06-15"},{"id":63,"group":"K","home":"Portugal","away":"Uzbekistan","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Est\u00e1dio do Drag\u00e3o, Porto","date":"2026-06-16"},{"id":64,"group":"K","home":"DR Congo","away":"Colombia","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Est\u00e1dio Algarve, Faro","date":"2026-06-17"},{"id":65,"group":"K","home":"Portugal","away":"Colombia","status":"finished","homeScore":2,"awayScore":1,"stadium":"Est\u00e1dio da Luz, Lisbon","date":"2026-06-18"},{"id":66,"group":"K","home":"DR Congo","away":"Uzbekistan","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Est\u00e1dio Jos\u00e9 Alvalade, Lisbon","date":"2026-06-19"},{"id":67,"group":"L","home":"England","away":"Croatia","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Wembley Stadium, London","date":"2026-06-15"},{"id":68,"group":"L","home":"Ghana","away":"Panama","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Old Trafford, Manchester","date":"2026-06-16"},{"id":69,"group":"L","home":"England","away":"Ghana","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Anfield, Liverpool","date":"2026-06-17"},{"id":70,"group":"L","home":"Croatia","away":"Panama","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Tottenham Hotspur Stadium, London","date":"2026-06-18"},{"id":71,"group":"L","home":"England","away":"Panama","status":"finished","homeScore":2,"awayScore":0,"stadium":"Wembley Stadium, London","date":"2026-06-19"},{"id":72,"group":"L","home":"Croatia","away":"Ghana","status":"upcoming","homeScore":null,"awayScore":null,"stadium":"Old Trafford, Manchester","date":"2026-06-20"}];

console.log(`[World Cup 2026] Loaded ${FIXTURES.length} fixtures inline`);

// ──────────────────────────────────────────────
// Group label helper (for display/commentary only)
// ──────────────────────────────────────────────
function groupLabel(group) {
  return `Group ${group.toUpperCase()}`;
}

// ──────────────────────────────────────────────
// In-Memory Cache (15-min TTL)
// ──────────────────────────────────────────────
class MemoryCache {
  constructor(ttlMs = 15 * 60 * 1000) {
    this._store = new Map();
    this._ttlMs = ttlMs;
    this._hits = 0;
    this._misses = 0;
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) {
      this._misses++;
      return null;
    }
    if (Date.now() - entry.ts > this._ttlMs) {
      this._store.delete(key);
      this._misses++;
      return null;
    }
    this._hits++;
    return entry.data;
  }

  set(key, data) {
    this._store.set(key, { data, ts: Date.now() });
  }

  stats() {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      total,
      rate: total > 0 ? (this._hits / total * 100).toFixed(1) + '%' : '0%',
      entries: this._store.size,
      ttlMs: this._ttlMs
    };
  }
}

const cache = new MemoryCache();

// ──────────────────────────────────────────────
// World Cup 2026 Commentary Templates
// ──────────────────────────────────────────────
const COMMENTARY_TEMPLATES = [
  'Group {group} match: {home} push forward in the {minute}th minute!',
  'World Cup debut! {away} are making their first appearance count!',
  '{home} launching a dangerous attack — the crowd at {stadium} roars!',
  'The {group} standings could shift dramatically if {away} score here!',
  '{home} controlling the midfield, passing with confidence on the world stage.',
  'A crunching World Cup tackle — the referee reaches for the card!',
  '{away} with a swift counter — this is World Cup football at its finest!',
  'The {group} clash heating up! Both teams desperate for points.',
  '{home} whip in a dangerous cross — cleared by the {away} defence!',
  'Free kick in a dangerous area for {home}... a real World Cup moment.',
  '{away} testing the keeper from distance — a save low to the right!',
  'The stadium erupts as {home} push forward in search of a goal!',
  'VAR check ongoing — the referee is heading to the monitor!',
  'BOOKING for {away} — a cynical challenge in the World Cup.',
  '{home} applying pressure — they smell blood in this {group} encounter!',
  'Near post! {away} almost caught the defence napping!',
  'Slick passing from {home} — playing beautiful football on the biggest stage!',
  'World Cup debutants {away} showing no fear against the established side.',
  'The physio is on — {home} player down after a heavy World Cup challenge.',
  '{away} work it short from the corner — deflected out for a throw.',
  'GOAL! {home} take the lead in this {group} showdown! What a moment!',
  'GOAL! {away} hit back — it\'s all level in this World Cup thriller!',
  'Substitution for {away} — fresh legs coming on in the World Cup.',
  'The fourth official signals {x} minutes of added time.',
  'This {group} group is wide open — nothing separating the sides yet!',
  '{home} are dominating possession — the World Cup tempo is relentless!'
];

// ──────────────────────────────────────────────
// Express + Socket.io Setup
// ──────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const START_TIME = Date.now();

// ──────────────────────────────────────────────
// WebSocket Commentary Simulation
// ──────────────────────────────────────────────
const simulationState = new Map(); // fixtureId -> { intervals, minute, scores, possession, etc }

function getOrInitSim(fixtureId) {
  const fixture = FIXTURES.find(f => f.id === fixtureId);
  if (!fixture) return null;
  if (!simulationState.has(fixtureId)) {
    simulationState.set(fixtureId, {
      minute: 0,
      homeScore: fixture.status === 'finished' ? fixture.homeScore : 0,
      awayScore: fixture.status === 'finished' ? fixture.awayScore : 0,
      possession: { home: 50, away: 50 },
      eventsDelivered: 0,
      finished: false,
      updateInterval: null,
      commentaryIntervals: []
    });
  }
  return simulationState.get(fixtureId);
}

function startFixtureSimulation(fixtureId, socket) {
  const fixture = FIXTURES.find(f => f.id === fixtureId);
  if (!fixture) return;

  const group = groupLabel(fixture.group);
  const stadium = fixture.stadium || 'the stadium';

  // Finished match — just show final result
  if (fixture.status === 'finished') {
    socket.emit('commentary', {
      text: `Full-time in ${group}: ${fixture.home} ${fixture.homeScore} - ${fixture.awayScore} ${fixture.away}`,
      minute: 90
    });
    return;
  }

  const state = getOrInitSim(fixtureId);
  if (!state || state.finished) return;

  // Start simulation if not already running for this fixture
  if (!state.updateInterval) {
    // Fixture update every 15s
    state.updateInterval = setInterval(() => {
      const s = simulationState.get(fixtureId);
      if (!s || s.finished) return;

      s.minute = Math.min(s.minute + 3, 90);

      // Possession drift
      s.possession.home = Math.min(80, Math.max(20, s.possession.home + (Math.random() - 0.5) * 8));
      s.possession.away = 100 - s.possession.home;

      // Random scoring chance
      if (s.minute <= 90 && Math.random() < 0.08) {
        if (Math.random() < 0.55) {
          s.homeScore++;
        } else {
          s.awayScore++;
        }
      }

      const fixtureUpdate = {
        fixtureId,
        minute: s.minute,
        homeScore: s.homeScore,
        awayScore: s.awayScore,
        possession: { home: Math.round(s.possession.home), away: Math.round(s.possession.away) }
      };

      io.to(`fixture:${fixtureId}`).emit('fixture:update', fixtureUpdate);

      // Full-time check
      if (s.minute >= 90) {
        s.finished = true;
        io.to(`fixture:${fixtureId}`).emit('commentary', {
          text: `FULL-TIME in ${group}! ${fixture.home} ${s.homeScore} - ${s.awayScore} ${fixture.away}`,
          minute: 90
        });
        io.to(`fixture:${fixtureId}`).emit('fixture:finished', {
          fixtureId,
          homeScore: s.homeScore,
          awayScore: s.awayScore
        });
        clearInterval(s.updateInterval);
        s.updateInterval = null;
        s.commentaryIntervals.forEach(t => clearTimeout(t));
        s.commentaryIntervals = [];
      }
    }, 15000);

    // Commentary every 8-15s (up to 12 events)
    let commentaryCount = 0;
    const scheduleCommentary = () => {
      if (state.finished || commentaryCount >= 12) return;
      const delay = 8000 + Math.random() * 7000;
      const timer = setTimeout(() => {
        if (state.finished) return;
        commentaryCount++;
        const template = COMMENTARY_TEMPLATES[Math.floor(Math.random() * COMMENTARY_TEMPLATES.length)];
        let text = template
          .replace(/{home}/g, fixture.home)
          .replace(/{away}/g, fixture.away)
          .replace(/{group}/g, group)
          .replace(/{stadium}/g, stadium)
          .replace(/{minute}/g, String(state.minute))
          .replace(/{x}/g, String(Math.floor(Math.random() * 7) + 1));
        io.to(`fixture:${fixtureId}`).emit('commentary', {
          text,
          minute: state.minute
        });
        if (commentaryCount < 12 && !state.finished) {
          scheduleCommentary();
        }
      }, delay);
      state.commentaryIntervals.push(timer);
    };
    scheduleCommentary();
  }
}

// ──────────────────────────────────────────────
// Socket.io Events
// ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('join:fixture', (fixtureId) => {
    const id = parseInt(fixtureId, 10);
    const fixture = FIXTURES.find(f => f.id === id);
    if (!fixture) {
      socket.emit('error', { message: 'Fixture not found' });
      return;
    }

    const room = `fixture:${id}`;
    socket.join(room);
    console.log(`[Socket.io] ${socket.id} joined room ${room}`);

    startFixtureSimulation(id, socket);

    socket.emit('fixture:update', {
      fixtureId: id,
      minute: 0,
      homeScore: fixture.homeScore || 0,
      awayScore: fixture.awayScore || 0,
      possession: { home: 50, away: 50 }
    });

    const group = groupLabel(fixture.group);
    socket.emit('commentary', {
      text: `🌍 Welcome to ${group}! ${fixture.home} vs ${fixture.away} at ${fixture.stadium || 'the venue'}`,
      minute: 0
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ──────────────────────────────────────────────
// Helper: Fetch AI predictions
// ──────────────────────────────────────────────
async function fetchAIPrediction(fixtureId, homeTeam, awayTeam) {
  try {
    const url = `http://localhost:8000/api/predictions/${fixtureId}?home_team=${encodeURIComponent(homeTeam)}&away_team=${encodeURIComponent(awayTeam)}`;
    const response = await axios.get(url, { timeout: 5000 });
    return response.data;
  } catch (err) {
    console.error(`[AI Engine] Prediction fetch failed for fixture ${fixtureId}: ${err.message}`);
    return null;
  }
}

// ──────────────────────────────────────────────
// Helper: Compute Group Standings
// ──────────────────────────────────────────────
function computeGroupStandings() {
  const finished = FIXTURES.filter(f => f.status === 'finished');
  const teams = {};

  // Pre-populate ALL 4 teams per group from fixtures (including upcoming)
  FIXTURES.forEach(f => {
    const grp = f.group;
    if (!teams[grp]) teams[grp] = {};
    if (!teams[grp][f.home]) {
      teams[grp][f.home] = { group: grp, team: f.home, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    }
    if (!teams[grp][f.away]) {
      teams[grp][f.away] = { group: grp, team: f.away, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    }
  });

  finished.forEach(f => {
    const grp = f.group;

    // Initialize group if needed
    if (!teams[grp]) teams[grp] = {};

    // Home team
    if (!teams[grp][f.home]) {
      teams[grp][f.home] = { group: grp, team: f.home, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    }
    // Away team
    if (!teams[grp][f.away]) {
      teams[grp][f.away] = { group: grp, team: f.away, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    }

    const home = teams[grp][f.home];
    const away = teams[grp][f.away];

    home.played++;
    away.played++;
    home.goalsFor += f.homeScore;
    home.goalsAgainst += f.awayScore;
    away.goalsFor += f.awayScore;
    away.goalsAgainst += f.homeScore;

    if (f.homeScore > f.awayScore) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (f.homeScore < f.awayScore) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      home.points += 1;
      away.drawn++;
      away.points += 1;
    }
  });

  // Build per-group standings sorted by points desc, then GD, then GF
  const result = {};
  const groupOrder = ['A','B','C','D','E','F','G','H','I','J','K','L'];

  groupOrder.forEach(g => {
    if (teams[g]) {
      const entries = Object.values(teams[g]);
      entries.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const gdA = a.goalsFor - a.goalsAgainst;
        const gdB = b.goalsFor - b.goalsAgainst;
        if (gdB !== gdA) return gdB - gdA;
        return b.goalsFor - a.goalsFor;
      });
      result[g] = {
        group: g,
        teams: entries.map((e, idx) => ({
          position: idx + 1,
          ...e
        }))
      };
    } else {
      // Group with no finished matches yet — empty
      result[g] = {
        group: g,
        teams: []
      };
    }
  });

  // Return as array, sorted by group letter
  return groupOrder.filter(g => result[g]).map(g => result[g]);
}

// ──────────────────────────────────────────────
// REST API Routes
// ──────────────────────────────────────────────

// GET /api/fixtures — List all fixtures sorted by group
app.get('/api/fixtures', (req, res) => {
  const cacheKey = 'fixtures:all';
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ data: cached, source: 'cache' });
  }

  const data = FIXTURES.map(f => ({
    id: f.id,
    group: f.group,
    home: f.home,
    away: f.away,
    status: f.status,
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    stadium: f.stadium,
    date: f.date
  }));

  cache.set(cacheKey, data);
  res.json({ data, source: 'live' });
});

// GET /api/fixtures/group/:group — Fixtures for a specific group
app.get('/api/fixtures/group/:group', (req, res) => {
  const group = req.params.group.toUpperCase();
  const validGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  if (!validGroups.includes(group)) {
    return res.status(400).json({ error: `Invalid group '${group}'. Use A-L.` });
  }

  const cacheKey = `fixtures:group:${group}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ data: cached, source: 'cache' });
  }

  const fixtures = FIXTURES
    .filter(f => f.group === group)
    .map(f => ({
      id: f.id,
      group: f.group,
      home: f.home,
      away: f.away,
      status: f.status,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      stadium: f.stadium,
      date: f.date
    }));

  cache.set(cacheKey, fixtures);
  res.json({ data: fixtures, source: 'live' });
});

// GET /api/fixtures/:id — Single fixture detail with AI predictions
app.get('/api/fixtures/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const fixture = FIXTURES.find(f => f.id === id);
  if (!fixture) {
    return res.status(404).json({ error: 'Fixture not found' });
  }

  const cacheKey = `fixture:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ data: cached, source: 'cache' });
  }

  const result = {
    id: fixture.id,
    group: fixture.group,
    home: fixture.home,
    away: fixture.away,
    status: fixture.status,
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    stadium: fixture.stadium,
    date: fixture.date,
    aiPrediction: null
  };

  // Fetch AI prediction for upcoming/live fixtures
  if (fixture.status === 'upcoming' || fixture.status === 'live') {
    const aiData = await fetchAIPrediction(fixture.id, fixture.home, fixture.away);
    if (aiData) {
      result.aiPrediction = aiData;
    } else {
      result.aiPrediction = { note: 'AI prediction engine unavailable' };
    }
  }

  cache.set(cacheKey, result);
  res.json({ data: result, source: 'live' });
});

// GET /api/standings — Group standings (calculated from finished matches)
app.get('/api/standings', (req, res) => {
  const cacheKey = 'standings:all';
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ data: cached, source: 'cache' });
  }

  const standings = computeGroupStandings();
  cache.set(cacheKey, standings);
  res.json({ data: standings, source: 'live' });
});

// GET /api/cache/stats — Cache statistics
app.get('/api/cache/stats', (req, res) => {
  res.json({ data: cache.stats() });
});

// GET /health — Service health
app.get('/health', (req, res) => {
  const stats = cache.stats();
  res.json({
    status: 'ok',
    service: 'World Cup 2026 Backend',
    uptime: Math.floor((Date.now() - START_TIME) / 1000) + 's',
    startedAt: new Date(START_TIME).toISOString(),
    fixtures: FIXTURES.length,
    groups: 12,
    cache: stats,
    connectedClients: io.engine.clientsCount,
    activeSimulations: simulationState.size,
    nodeVersion: process.version,
    platform: process.platform
  });
});

// ──────────────────────────────────────────────
// Start Server
// ──────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[World Cup 2026] Backend server running on port ${PORT}`);
  console.log(`[World Cup 2026] REST API: http://localhost:${PORT}/api/fixtures`);
  console.log(`[World Cup 2026] Standings: http://localhost:${PORT}/api/standings`);
  console.log(`[World Cup 2026] Health:    http://localhost:${PORT}/health`);
  console.log(`[World Cup 2026] Socket.io: ws://localhost:${PORT}`);
  console.log(`[World Cup 2026] ${FIXTURES.length} fixtures loaded across 12 groups (A-L)`);
});

module.exports = { app, server, io };
