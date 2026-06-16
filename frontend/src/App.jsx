import { useState, useEffect, useCallback, useRef } from 'react';

// ──────────────────────────────────────────────
// Constants — World Cup 2026
// ──────────────────────────────────────────────

/** All 48 qualified teams for the 2026 World Cup */
const ALL_TEAMS = [
  // Group A
  'Mexico', 'South Korea', 'Czech Republic', 'South Africa',
  // Group B
  'Switzerland', 'Canada', 'Qatar', 'Bosnia and Herzegovina',
  // Group C
  'Scotland', 'Morocco', 'Brazil', 'Haiti',
  // Group D
  'United States', 'Australia', 'Turkey', 'Paraguay',
  // Group E
  'Germany', 'Ivory Coast', 'Ecuador', 'Curaçao',
  // Group F
  'Sweden', 'Japan', 'Netherlands', 'Tunisia',
  // Group G
  'Belgium', 'Egypt', 'Iran', 'New Zealand',
  // Group H
  'Uruguay', 'Saudi Arabia', 'Spain', 'Cape Verde',
  // Group I
  'France', 'Senegal', 'Iraq', 'Norway',
  // Group J
  'Argentina', 'Algeria', 'Austria', 'Jordan',
  // Group K
  'Portugal', 'DR Congo', 'Uzbekistan', 'Colombia',
  // Group L
  'England', 'Croatia', 'Ghana', 'Panama',
];

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

const TABS = [
  { id: 'predictor', label: '🔮 Match Predictor' },
  { id: 'fixtures',  label: '⚽ Fixtures & Live' },
  { id: 'standings', label: '🏆 Group Standings' },
  { id: 'about',     label: 'ℹ️ About WC 2026' },
];

// ──────────────────────────────────────────────
// Helper Components
// ──────────────────────────────────────────────

const Spinner = ({ text = 'Loading…' }) => (
  <div className="spinner-wrapper">
    <div className="spinner" />
    <span className="spinner-text">{text}</span>
  </div>
);

/** Color-coded status badge */
const StatusBadge = ({ status }) => {
  const config = {
    live:     { bg: '#065f46', text: '#6ee7b7', icon: '🟢' },
    upcoming: { bg: '#1e3a5f', text: '#93c5fd', icon: '🔵' },
    finished: { bg: '#374151', text: '#9ca3af', icon: '⚪' },
  };
  const c = config[status] || config.finished;
  return (
    <span className="status-badge" style={{ background: c.bg, color: c.text }}>
      {c.icon} {status.toUpperCase()}
    </span>
  );
};

/** Probability bars for Home / Draw / Away */
const ProbabilityBars = ({ probs }) => {
  if (!probs) return null;
  const items = [
    { label: 'Home', value: probs.homeWin, color: '#6366f1' },
    { label: 'Draw', value: probs.draw,     color: '#a855f7' },
    { label: 'Away', value: probs.awayWin,  color: '#22c55e' },
  ];
  return (
    <div className="prob-bars">
      <p className="section-title">📊 Probability Distribution</p>
      {items.map(({ label, value, color }) => (
        <div key={label} className="prob-row">
          <span className="prob-label">{label}</span>
          <div className="prob-track">
            <div
              className="prob-fill"
              style={{ width: `${Math.round((value || 0) * 100)}%`, background: color }}
            />
          </div>
          <span className="prob-value">{((value || 0) * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
};

/** Small group badge pill */
const GroupBadge = ({ group }) => (
  <span className="group-badge">Group {group}</span>
);

// ──────────────────────────────────────────────
// TAB 1: 🔮 Match Predictor
// ──────────────────────────────────────────────

const PredictorTab = () => {
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handlePredict = useCallback(async () => {
    if (!homeTeam || !awayTeam) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Fetch all fixtures to find the matching one
      const res = await fetch('/api/fixtures');
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const json = await res.json();
      const fixtures = json.data || [];

      // Look for a fixture where these two teams play each other
      const match = fixtures.find(
        f =>
          (f.home === homeTeam && f.away === awayTeam) ||
          (f.home === awayTeam && f.away === homeTeam)
      );

      if (!match) {
        setError(`No scheduled match found between ${homeTeam} and ${awayTeam}. Try a different pairing.`);
        setLoading(false);
        return;
      }

      // Fetch detailed prediction for this fixture
      const detailRes = await fetch(`/api/fixtures/${match.id}`);
      if (!detailRes.ok) throw new Error(`Server responded with ${detailRes.status}`);
      const detailJson = await detailRes.json();
      setResult(detailJson.data || detailJson);
    } catch (err) {
      setError(err.message || 'Failed to fetch prediction');
    } finally {
      setLoading(false);
    }
  }, [homeTeam, awayTeam]);

  const outcomeLabel = (outcome) => {
    if (!outcome || !result) return '';
    const map = { HOME_WIN: `${result.home} Win`, DRAW: 'Draw', AWAY_WIN: `${result.away} Win` };
    return map[outcome] || outcome;
  };

  const isValid = homeTeam && awayTeam && homeTeam !== awayTeam;

  return (
    <div className="tab-content predictor-tab">
      <h2 className="tab-heading">🔮 AI Match Predictor</h2>
      <p className="tab-subtitle">
        Select any two teams to get an XGBoost-powered prediction
      </p>

      <div className="predictor-controls">
        <div className="select-group">
          <label>Team 1 (Home)</label>
          <select
            value={homeTeam}
            onChange={e => { setHomeTeam(e.target.value); setResult(null); setError(null); }}
          >
            <option value="">— Select team —</option>
            {ALL_TEAMS.map(t => (
              <option key={t} value={t} disabled={t === awayTeam}>{t}</option>
            ))}
          </select>
        </div>
        <div className="select-group">
          <label>Team 2 (Away)</label>
          <select
            value={awayTeam}
            onChange={e => { setAwayTeam(e.target.value); setResult(null); setError(null); }}
          >
            <option value="">— Select team —</option>
            {ALL_TEAMS.map(t => (
              <option key={t} value={t} disabled={t === homeTeam}>{t}</option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-accent"
          onClick={handlePredict}
          disabled={!isValid || loading}
        >
          {loading ? 'Predicting…' : '🔮 Predict'}
        </button>
      </div>

      {!isValid && homeTeam && awayTeam && homeTeam === awayTeam && (
        <p className="hint-warning">Please select two different teams.</p>
      )}

      {loading && <Spinner text="Running AI model…" />}

      {error && <div className="error-box">{error}</div>}

      {result && result.aiPrediction && (
        <div className="prediction-result card">
          <div className="prediction-header">
            <span className="matchup-label">
              <GroupBadge group={result.group} /> {result.home} vs {result.away}
            </span>
            <StatusBadge status={result.status} />
          </div>

          {result.stadium && (
            <p className="match-venue">📍 {result.stadium} &middot; {result.date}</p>
          )}

          <div className="prediction-outcome">
            <span className="outcome-badge">
              {outcomeLabel(result.aiPrediction.predictedOutcome)}
            </span>
            <span className="confidence">
              Confidence: <strong>{(result.aiPrediction.confidence * 100).toFixed(1)}%</strong>
            </span>
          </div>

          <ProbabilityBars probs={result.aiPrediction.probabilities} />

          {/* SHAP Feature Importance */}
          {result.aiPrediction.featureImportance &&
            result.aiPrediction.featureImportance.length > 0 && (
            <div className="feature-importance">
              <p className="section-title">🧠 Top Key Factors (SHAP)</p>
              {result.aiPrediction.featureImportance.slice(0, 5).map((f, i) => (
                <div key={i} className="feature-row">
                  <span className="feature-name">{f.feature || f.name}</span>
                  <div className="feature-track">
                    <div
                      className="feature-fill"
                      style={{
                        width: `${Math.min(Math.abs(f.impact || f.value || 0) * 50, 100)}%`,
                        background: (f.impact || f.value || 0) >= 0 ? '#22c55e' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="feature-impact">
                    {(f.impact || f.value || 0).toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Value Bets */}
          {result.aiPrediction.valueDiscrepancies &&
            result.aiPrediction.valueDiscrepancies.length > 0 && (
            <div className="value-bets">
              <p className="section-title">💰 Value Bets</p>
              {result.aiPrediction.valueDiscrepancies.map((vb, i) => (
                <div key={i} className="value-bet-row">
                  <span>{vb.market || vb.outcome || `Bet ${i + 1}`}</span>
                  <span
                    className="value-delta"
                    style={{ color: (vb.delta || 0) > 0 ? '#22c55e' : '#ef4444' }}
                  >
                    {(vb.delta || 0) > 0 ? '+' : ''}
                    {((vb.delta || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────
// TAB 2: ⚽ Fixtures & Live Scores
// ──────────────────────────────────────────────

const FixturesTab = () => {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const intervalRef = useRef(null);

  const fetchFixtures = useCallback(async () => {
    try {
      const res = await fetch('/api/fixtures');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setFixtures(json.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/fixtures/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDetail(json.data || json);
    } catch (err) {
      setDetail({ error: err.message });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFixtures();
    intervalRef.current = setInterval(fetchFixtures, 30000);
    return () => clearInterval(intervalRef.current);
  }, [fetchFixtures]);

  // Group fixtures by group (A-L)
  const grouped = {};
  GROUPS.forEach(g => { grouped[g] = []; });
  fixtures.forEach(f => {
    const g = f.group || 'A';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(f);
  });

  const outcomeLabel = (outcome, home, away) => {
    if (!outcome) return '';
    const map = { HOME_WIN: `${home} Win`, DRAW: 'Draw', AWAY_WIN: `${away} Win` };
    return map[outcome] || outcome;
  };

  return (
    <div className="tab-content matches-tab">
      <h2 className="tab-heading">⚽ Fixtures &amp; Live Scores</h2>
      <p className="tab-subtitle">
        All 50 matches &middot; Auto-refreshes every 30s &middot; Click any row for AI prediction
      </p>

      {loading && <Spinner />}

      {error && <div className="error-box">{error}</div>}

      {!loading && !error && (
        <>
          {GROUPS.map(group => {
            const groupFixtures = grouped[group] || [];
            if (groupFixtures.length === 0) return null;
            return (
              <div key={group} className="group-section">
                <h3 className="group-heading">
                  <span className="group-heading-badge">Group {group}</span>
                  <span className="group-match-count">{groupFixtures.length} match{groupFixtures.length !== 1 ? 'es' : ''}</span>
                </h3>
                <div className="fixture-list">
                  {groupFixtures.map(f => {
                    const isLive = f.status === 'live';
                    const isSelected = selectedId === f.id;
                    return (
                      <div
                        key={f.id}
                        className={`fixture-card ${isLive ? 'fixture-live' : ''} ${isSelected ? 'fixture-selected' : ''}`}
                        onClick={() => fetchDetail(f.id)}
                      >
                        <div className="fixture-card-main">
                          <GroupBadge group={f.group} />
                          <div className="fixture-teams">
                            <span className={`team-name ${isLive ? 'team-live' : ''}`}>{f.home}</span>
                            <span className="fixture-vs">
                              {f.status === 'upcoming'
                                ? <span className="vs-text">vs</span>
                                : <span className="fixture-score">{f.homeScore ?? '-'} &ndash; {f.awayScore ?? '-'}</span>
                              }
                            </span>
                            <span className={`team-name ${isLive ? 'team-live' : ''}`}>{f.away}</span>
                          </div>
                          <div className="fixture-meta">
                            <StatusBadge status={f.status} />
                            <span className="fixture-date">{f.date}</span>
                          </div>
                          {isLive && <span className="live-dot" />}
                        </div>

                        {/* Expanded detail panel */}
                        {isSelected && (
                          <div className="fixture-detail">
                            {detailLoading && <Spinner text="Loading prediction…" />}

                            {detail && detail.error && (
                              <div className="error-box">{detail.error}</div>
                            )}

                            {detail && !detail.error && (
                              <>
                                {detail.stadium && (
                                  <p className="match-venue">📍 {detail.stadium}</p>
                                )}

                                {detail.aiPrediction && (
                                  <div className="detail-ai">
                                    <p className="section-title">🤖 AI Prediction</p>
                                    <div className="prediction-outcome">
                                      <span className="outcome-badge">
                                        {outcomeLabel(
                                          detail.aiPrediction.predictedOutcome,
                                          detail.home,
                                          detail.away
                                        )}
                                      </span>
                                      <span className="confidence">
                                        Confidence:{' '}
                                        <strong>
                                          {(detail.aiPrediction.confidence * 100).toFixed(1)}%
                                        </strong>
                                      </span>
                                    </div>
                                    <ProbabilityBars probs={detail.aiPrediction.probabilities} />

                                    {detail.aiPrediction.featureImportance &&
                                      detail.aiPrediction.featureImportance.length > 0 && (
                                      <div className="feature-importance">
                                        <p className="section-title">🧠 Key Factors (SHAP)</p>
                                        {detail.aiPrediction.featureImportance.slice(0, 3).map((f, i) => (
                                          <div key={i} className="feature-row">
                                            <span className="feature-name">{f.feature || f.name}</span>
                                            <div className="feature-track">
                                              <div
                                                className="feature-fill"
                                                style={{
                                                  width: `${Math.min(Math.abs(f.impact || f.value || 0) * 50, 100)}%`,
                                                  background: (f.impact || f.value || 0) >= 0 ? '#22c55e' : '#ef4444',
                                                }}
                                              />
                                            </div>
                                            <span className="feature-impact">
                                              {(f.impact || f.value || 0).toFixed(3)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {detail.aiPrediction.valueDiscrepancies &&
                                      detail.aiPrediction.valueDiscrepancies.length > 0 && (
                                      <div className="value-bets">
                                        <p className="section-title">💰 Value Bets</p>
                                        {detail.aiPrediction.valueDiscrepancies.map((vb, i) => (
                                          <div key={i} className="value-bet-row">
                                            <span>{vb.market || vb.outcome || `Bet ${i + 1}`}</span>
                                            <span
                                              className="value-delta"
                                              style={{ color: (vb.delta || 0) > 0 ? '#22c55e' : '#ef4444' }}
                                            >
                                              {(vb.delta || 0) > 0 ? '+' : ''}
                                              {((vb.delta || 0) * 100).toFixed(1)}%
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {!detail.aiPrediction && detail.status === 'upcoming' && (
                                  <p className="hint-warning">AI prediction will be available closer to kickoff.</p>
                                )}

                                {!detail.aiPrediction && detail.status === 'finished' && (
                                  <p className="hint-warning">Final score. No AI prediction for finished matches.</p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {fixtures.length === 0 && !loading && (
            <p className="no-data">No fixtures available at this time.</p>
          )}
        </>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────
// TAB 3: 🏆 Group Standings
// ──────────────────────────────────────────────

const StandingsTab = () => {
  const [selectedGroup, setSelectedGroup] = useState('A');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/standings');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const currentGroup = data.find(g => g.group === selectedGroup);
  const teams = currentGroup ? (currentGroup.teams || []) : [];

  // Sort by points descending, then GD, then GF
  const sorted = [...teams].sort((a, b) => {
    const ptsA = a.points ?? a.pts ?? 0;
    const ptsB = b.points ?? b.pts ?? 0;
    if (ptsB !== ptsA) return ptsB - ptsA;
    const gdA = (a.goalsFor ?? 0) - (a.goalsAgainst ?? 0);
    const gdB = (b.goalsFor ?? 0) - (b.goalsAgainst ?? 0);
    if (gdB !== gdA) return gdB - gdA;
    return (b.goalsFor ?? 0) - (a.goalsFor ?? 0);
  });

  return (
    <div className="tab-content standings-tab">
      <h2 className="tab-heading">🏆 Group Standings</h2>
      <p className="tab-subtitle">World Cup 2026 &middot; Group stage table</p>

      <div className="standings-controls">
        <div className="select-group">
          <label>Select Group</label>
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
          >
            {GROUPS.map(g => (
              <option key={g} value={g}>Group {g}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <Spinner />}

      {error && <div className="error-box">{error}</div>}

      {!loading && !error && (
        <>
          {sorted.length > 0 ? (
            <div className="table-wrapper">
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Team</th>
                    <th>Pld</th>
                    <th>W</th>
                    <th>D</th>
                    <th>L</th>
                    <th>GF</th>
                    <th>GA</th>
                    <th>GD</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((team, idx) => {
                    const isTopTwo = idx < 2;
                    const pts = team.points ?? team.pts ?? 0;
                    const gf = team.goalsFor ?? team.gf ?? 0;
                    const ga = team.goalsAgainst ?? team.ga ?? 0;
                    const gd = gf - ga;
                    return (
                      <tr
                        key={team.team || team.name}
                        className={`standings-row ${isTopTwo ? 'standings-qualify' : ''} ${idx === 0 ? 'standings-first' : ''} ${idx === 1 ? 'standings-second' : ''}`}
                      >
                        <td className="standings-rank">
                          <span className={`rank-num ${isTopTwo ? 'rank-highlight' : ''}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="standings-team">
                          {isTopTwo && <span className="qualify-icon">✓ </span>}
                          {team.team || team.name}
                        </td>
                        <td>{team.played ?? team.pld ?? 0}</td>
                        <td>{team.won ?? team.w ?? 0}</td>
                        <td>{team.drawn ?? team.d ?? 0}</td>
                        <td>{team.lost ?? team.l ?? 0}</td>
                        <td className="standings-gf">{gf}</td>
                        <td className="standings-ga">{ga}</td>
                        <td className={`standings-gd ${gd > 0 ? 'gd-positive' : gd < 0 ? 'gd-negative' : ''}`}>
                          {gd > 0 ? '+' : ''}{gd}
                        </td>
                        <td className="standings-pts">{pts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-data">No standings data available for Group {selectedGroup}.</p>
          )}

          <div className="standings-legend">
            <span className="legend-item"><span className="legend-dot legend-gold" /> Top 2 — Advance to Knockouts</span>
            <span className="legend-item"><span className="legend-dot legend-green" /> Qualification zone</span>
          </div>
        </>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────
// TAB 4: ℹ️ About World Cup 2026
// ──────────────────────────────────────────────

const AboutTab = () => (
  <div className="tab-content about-tab">
    <h2 className="tab-heading">🏆 World Cup 2026</h2>
    <p className="tab-subtitle">The biggest World Cup ever — live now!</p>

    <div className="about-grid">
      <div className="card about-card">
        <div className="about-card-icon">🌍</div>
        <h3>Tournament Overview</h3>
        <ul className="about-list">
          <li><strong>48 teams</strong> — expanded from 32 for the first time</li>
          <li><strong>12 groups</strong> (A–L) with 4 teams each</li>
          <li>Top <strong>2 from each group</strong> advance to Round of 32</li>
          <li>8 best third-placed teams also advance</li>
          <li><strong>104 matches</strong> total across 16 host cities</li>
        </ul>
      </div>

      <div className="card about-card">
        <div className="about-card-icon">🇺🇸🇲🇽🇨🇦</div>
        <h3>Co-Hosts</h3>
        <ul className="about-list">
          <li><strong>USA</strong> — 11 venues including MetLife Stadium (final)</li>
          <li><strong>Mexico</strong> — 3 venues: Mexico City, Guadalajara, Monterrey</li>
          <li><strong>Canada</strong> — 2 venues: Toronto, Vancouver</li>
          <li>First World Cup hosted by three nations</li>
          <li>First World Cup in North America since 1994</li>
        </ul>
      </div>

      <div className="card about-card">
        <div className="about-card-icon">📊</div>
        <h3>AI Predictions</h3>
        <ul className="about-list">
          <li>Powered by <strong>XGBoost</strong> machine learning model</li>
          <li>Analyzes <strong>50+ features</strong> per match</li>
          <li>Features include: FIFA ranking, recent form, H2H history, squad value, injuries, and more</li>
          <li><strong>SHAP values</strong> explain which factors drive each prediction</li>
          <li><strong>Value bets</strong> compare AI probabilities vs market odds</li>
        </ul>
      </div>

      <div className="card about-card">
        <div className="about-card-icon">⚡</div>
        <h3>Live Features</h3>
        <ul className="about-list">
          <li>Real-time fixture updates every <strong>30 seconds</strong></li>
          <li><strong>Live</strong> matches highlighted with animated indicator</li>
          <li>Group standings updated automatically</li>
          <li>Click any fixture to expand AI prediction detail</li>
          <li>All 50 group-stage matches covered</li>
        </ul>
      </div>

      <div className="card about-card about-card-wide">
        <div className="about-card-icon">🎯</div>
        <h3>Tournament Facts</h3>
        <div className="about-facts">
          <div className="fact-item">
            <span className="fact-number">48</span>
            <span className="fact-label">Teams</span>
          </div>
          <div className="fact-item">
            <span className="fact-number">12</span>
            <span className="fact-label">Groups</span>
          </div>
          <div className="fact-item">
            <span className="fact-number">104</span>
            <span className="fact-label">Matches</span>
          </div>
          <div className="fact-item">
            <span className="fact-number">16</span>
            <span className="fact-label">Host Cities</span>
          </div>
          <div className="fact-item">
            <span className="fact-number">3</span>
            <span className="fact-label">Co-Hosts</span>
          </div>
          <div className="fact-item">
            <span className="fact-number">48</span>
            <span className="fact-label">Years Since '94</span>
          </div>
        </div>
      </div>
    </div>

    <div className="card about-footer-card">
      <p className="about-credit">
        Football AI Hub &middot; World Cup 2026 Edition &middot;
        Powered by <strong>XGBoost</strong> &middot;
        Data refreshes live from the API
      </p>
    </div>
  </div>
);

// ──────────────────────────────────────────────
// Root App Component
// ──────────────────────────────────────────────

function App() {
  const [activeTab, setActiveTab] = useState('predictor');

  const renderTab = () => {
    switch (activeTab) {
      case 'predictor': return <PredictorTab />;
      case 'fixtures':  return <FixturesTab />;
      case 'standings': return <StandingsTab />;
      case 'about':     return <AboutTab />;
      default:          return <PredictorTab />;
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="wc-banner">
            <span className="wc-trophy">🏆</span>
            <h1 className="app-title">World Cup 2026</h1>
            <span className="wc-trophy">🏆</span>
          </div>
          <p className="app-subtitle">
            AI-Powered Predictions &amp; Live Scores &middot; USA &middot; Mexico &middot; Canada
          </p>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <div
          className="tab-indicator"
          style={{
            width: `${100 / TABS.length}%`,
            transform: `translateX(${TABS.findIndex(t => t.id === activeTab) * 100}%)`,
          }}
        />
      </nav>

      {/* Tab Content */}
      <main className="app-main">
        <div className="tab-transition-wrapper" key={activeTab}>
          {renderTab()}
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          Football AI Hub &middot; World Cup 2026 Edition &copy; {new Date().getFullYear()}
          &mdash; Powered by XGBoost &middot; Data refreshes live
        </p>
      </footer>
    </div>
  );
}

export default App;
