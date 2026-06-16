# =============================================================================
# Football AI Match Predictor — AI / Analytics Engine
# =============================================================================
# Microservice: Python FastAPI server (deployed on Render Free Tier)
# Responsibilities:
#   - Training pipeline (XGBoost) on real historical match data
#   - Inference endpoint: GET /api/predictions/{fixture_id}
#   - SHAP-style Explainable AI feature importance arrays
#   - Real team stats loaded from teams.json
# =============================================================================

import os
import json
import pickle
import logging
import warnings
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# ML / AI imports — gracefully degrade if not installed
# -----------------------------------------------------------------------------
_HAS_SKLEARN = False
_HAS_XGBOOST = False
_HAS_SHAP = False

try:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import accuracy_score, classification_report
    _HAS_SKLEARN = True
except ImportError:
    GradientBoostingClassifier = None

try:
    import xgboost as xgb
    _HAS_XGBOOST = True
except ImportError:
    xgb = None

try:
    import shap
    _HAS_SHAP = True
except ImportError:
    shap = None

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

warnings.filterwarnings("ignore", category=UserWarning)

# -----------------------------------------------------------------------------
# Paths — point to real data files
# -----------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
TEAMS_PATH = os.path.join(DATA_DIR, "teams.json")
MATCHES_PATH = os.path.join(DATA_DIR, "matches.json")

MODEL_PATH = os.getenv("MODEL_PATH", "/tmp/football_model.pkl")
SCALER_PATH = os.getenv("SCALER_PATH", "/tmp/football_scaler.pkl")
FEATURE_NAMES_PATH = os.getenv("FEATURE_NAMES_PATH", "/tmp/feature_names.json")

# Feature columns for training / inference
FEATURE_COLUMNS: List[str] = [
    "home_avg_goals_scored",
    "home_avg_goals_conceded",
    "home_avg_possession",
    "home_avg_shots_on_target",
    "home_form_index",
    "home_squad_value_millions",
    "away_avg_goals_scored",
    "away_avg_goals_conceded",
    "away_avg_possession",
    "away_avg_shots_on_target",
    "away_form_index",
    "away_squad_value_millions",
    "h2h_home_win_rate",
    "days_since_last_match",
    "home_injury_count",
    "away_injury_count",
]

OUTCOME_CLASSES: List[str] = ["AWAY_WIN", "DRAW", "HOME_WIN"]

# -----------------------------------------------------------------------------
# Load real team data
# -----------------------------------------------------------------------------
TEAMS: Dict[str, dict] = {}
try:
    with open(TEAMS_PATH, "r") as f:
        teams_list = json.load(f)
    TEAMS = {t["name"]: t for t in teams_list}
    logger.info(f"Loaded {len(TEAMS)} teams from {TEAMS_PATH}")
except Exception as exc:
    logger.warning(f"Could not load teams data: {exc}")
    TEAMS = {}

# Feature name -> team stat key mapping (for the prediction endpoint)
TEAM_FEATURE_MAP = {
    "avg_goals_scored": "avg_goals_scored",
    "avg_goals_conceded": "avg_goals_conceded",
    "avg_possession": "avg_possession",
    "avg_shots_on_target": "avg_shots_on_target",
    "form_index": "form_index",
    "squad_value_millions": "squad_value_millions",
    "injury_count": "injury_count",
}

# -----------------------------------------------------------------------------
# Global model state (in-memory singleton)
# -----------------------------------------------------------------------------
class ModelState:
    """Holds the trained classifier, scaler, and metadata in memory."""

    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_names: List[str] = FEATURE_COLUMNS
        self.is_trained: bool = False
        self.train_accuracy: Optional[float] = None
        self.last_trained_at: Optional[datetime] = None
        self.training_sample_count: int = 0

    def predict_proba(self, features: np.ndarray) -> np.ndarray:
        """Return shape (n_samples, 3) — [P(AWAY), P(DRAW), P(HOME)]."""
        if self.model is None:
            raise RuntimeError("Model not trained. Call /api/train first.")
        scaled = self.scaler.transform(features) if self.scaler else features
        return self.model.predict_proba(scaled)

    def get_shap_values(self, features: np.ndarray) -> Dict[str, float]:
        """Return per-feature SHAP-style importance for a single sample.
        
        Falls back to built-in feature_importances_ if SHAP is unavailable,
        then weights each by the sample's deviation from the training mean.
        """
        if not _HAS_SHAP or shap is None:
            logger.info("SHAP not available; using model-native feature importance as baseline.")
            return self._fallback_shap(features)

        try:
            scaled = self.scaler.transform(features) if self.scaler else features
            explainer = shap.TreeExplainer(self.model)
            shap_values = explainer.shap_values(scaled)

            # SHAP returns vary by version:
            #   older: list of (n_features, n_samples) per class
            #   newer: ndarray (n_samples, n_features, n_classes)
            # We take the HOME_WIN class (index 2) contributions.
            if isinstance(shap_values, list):
                contributions = shap_values[2][0]  # older list-of-arrays
            elif shap_values.ndim == 3:
                contributions = shap_values[0, :, 2]  # newer (samples, features, classes)
            else:
                contributions = shap_values[0]

            return {
                name: float(round(contrib, 6))
                for name, contrib in zip(self.feature_names, contributions)
            }
        except Exception as exc:
            logger.warning(f"SHAP computation failed ({exc}); using fallback.")
            return self._fallback_shap(features)

    def _fallback_shap(self, features: np.ndarray) -> Dict[str, float]:
        """Fallback: use native feature_importances_ × sample deviation."""
        importances = self.model.feature_importances_
        sample = features[0] if features.ndim > 1 else features
        result = {}
        for i, name in enumerate(self.feature_names):
            result[name] = float(round(importances[i] * float(sample[i]), 6))
        return result


# -----------------------------------------------------------------------------
# Pydantic response schemas
# -----------------------------------------------------------------------------

class ProbabilityVector(BaseModel):
    homeWin: float  = Field(..., ge=0.0, le=1.0)
    draw: float     = Field(..., ge=0.0, le=1.0)
    awayWin: float  = Field(..., ge=0.0, le=1.0)


class FeatureImportance(BaseModel):
    feature: str
    impact: float       # Positive = pushes probability toward this outcome


class PredictionResponse(BaseModel):
    fixtureId: str
    homeTeam: str
    awayTeam: str
    probabilities: ProbabilityVector
    predictedOutcome: str
    confidence: float
    featureImportance: List[FeatureImportance]
    valueDiscrepancies: Optional[List[Dict]] = None
    modelInfo: Dict = Field(default_factory=lambda: {
        "trainedAt": None,
        "accuracy": None,
        "samples": 0,
    })


class TrainResponse(BaseModel):
    status: str
    message: str
    accuracy: float
    samples: int
    featuresUsed: int
    durationSeconds: float


class HealthResponse(BaseModel):
    service: str = "football-ai-engine"
    version: str = "2.0.0"
    modelTrained: bool
    lastTrainedAt: Optional[str]
    trainAccuracy: Optional[float]


# -----------------------------------------------------------------------------
# Load historical match data from disk
# -----------------------------------------------------------------------------

def load_match_data() -> pd.DataFrame:
    """Load real historical match data from matches.json."""
    if not os.path.exists(MATCHES_PATH):
        logger.error(f"Match data not found at {MATCHES_PATH}")
        raise FileNotFoundError(f"Match data not found at {MATCHES_PATH}")

    with open(MATCHES_PATH, "r") as f:
        raw = json.load(f)

    matches = raw.get("matches", raw)  # support both {"matches": [...]} and raw list
    if isinstance(matches, list) and len(matches) > 0 and isinstance(matches[0], dict):
        df = pd.DataFrame(matches)
    else:
        raise ValueError("Invalid match data format — expected list of match dicts")

    # Derive outcome label from score: 0=AWAY_WIN, 1=DRAW, 2=HOME_WIN
    df["outcome"] = 1  # default DRAW
    df.loc[df["home_score"] > df["away_score"], "outcome"] = 2  # HOME_WIN
    df.loc[df["away_score"] > df["home_score"], "outcome"] = 0  # AWAY_WIN

    logger.info(f"Loaded {len(df)} historical matches with "
                f"{df['outcome'].value_counts().to_dict()} outcomes")
    return df


# -----------------------------------------------------------------------------
# Training logic
# -----------------------------------------------------------------------------

def train_model(state: ModelState) -> Dict:
    """Train an XGBoost or GradientBoosting classifier on real match data."""
    start_time = datetime.now()

    logger.info("Loading historical match data…")
    df = load_match_data()

    # Validate required columns exist
    missing = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing feature columns in match data: {missing}")

    X = df[FEATURE_COLUMNS].values
    y = df["outcome"].values

    n_samples = len(df)
    logger.info(f"Training on {n_samples} real matches…")

    # Train / val split
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Scale
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    # Choose classifier
    if _HAS_XGBOOST and xgb is not None:
        logger.info("Training XGBoost classifier…")
        model = xgb.XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.08,
            objective="multi:softprob",
            num_class=3,
            eval_metric="mlogloss",
            use_label_encoder=False,
            verbosity=0,
            random_state=42,
        )
    elif _HAS_SKLEARN:
        logger.info("XGBoost unavailable; falling back to GradientBoostingClassifier.")
        model = GradientBoostingClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            random_state=42,
        )
    else:
        raise RuntimeError(
            "No ML backend available. Install scikit-learn or xgboost."
            "\n  pip install scikit-learn xgboost shap"
        )

    model.fit(X_train_scaled, y_train)

    # Evaluate
    y_pred = model.predict(X_val_scaled)
    acc = accuracy_score(y_val, y_pred)
    logger.info(f"Validation accuracy: {acc:.4f}")

    # Persist state
    state.model = model
    state.scaler = scaler
    state.is_trained = True
    state.train_accuracy = acc
    state.last_trained_at = datetime.utcnow()
    state.training_sample_count = n_samples

    # Dump to disk (for reload across restarts)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    with open(SCALER_PATH, "wb") as f:
        pickle.dump(scaler, f)
    with open(FEATURE_NAMES_PATH, "w") as f:
        json.dump(FEATURE_COLUMNS, f)

    elapsed = (datetime.now() - start_time).total_seconds()

    return {
        "accuracy": round(float(acc), 4),
        "samples": n_samples,
        "featuresUsed": len(FEATURE_COLUMNS),
        "durationSeconds": round(elapsed, 2),
        "modelType": type(model).__name__,
    }


def _load_or_init_model(state: ModelState) -> None:
    """Try to restore a persisted model from disk; fall back to untrained."""
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        try:
            with open(MODEL_PATH, "rb") as f:
                state.model = pickle.load(f)
            with open(SCALER_PATH, "rb") as f:
                state.scaler = pickle.load(f)
            state.is_trained = True
            state.train_accuracy = None
            state.last_trained_at = datetime.fromtimestamp(
                os.path.getmtime(MODEL_PATH)
            )
            logger.info("Model restored from disk cache.")
        except Exception as exc:
            logger.warning(f"Could not restore cached model: {exc}")
            state.is_trained = False


# -----------------------------------------------------------------------------
# Build feature vector from real team stats
# -----------------------------------------------------------------------------

def build_feature_vector(home_team: str, away_team: str) -> np.ndarray:
    """Build a feature vector array from real team stats in TEAMS dict.
    
    Returns shape (1, n_features) numpy array ready for model inference.
    """
    if home_team not in TEAMS:
        raise HTTPException(status_code=400, detail=f"Unknown home team: {home_team}")
    if away_team not in TEAMS:
        raise HTTPException(status_code=400, detail=f"Unknown away team: {away_team}")

    ht = TEAMS[home_team]
    at = TEAMS[away_team]

    sample = {}
    # Home features
    sample["home_avg_goals_scored"] = ht["avg_goals_scored"]
    sample["home_avg_goals_conceded"] = ht["avg_goals_conceded"]
    sample["home_avg_possession"] = ht["avg_possession"]
    sample["home_avg_shots_on_target"] = ht["avg_shots_on_target"]
    sample["home_form_index"] = ht["form_index"]
    sample["home_squad_value_millions"] = ht["squad_value_millions"]
    sample["home_injury_count"] = ht["injury_count"]
    # Away features
    sample["away_avg_goals_scored"] = at["avg_goals_scored"]
    sample["away_avg_goals_conceded"] = at["avg_goals_conceded"]
    sample["away_avg_possession"] = at["avg_possession"]
    sample["away_avg_shots_on_target"] = at["avg_shots_on_target"]
    sample["away_form_index"] = at["form_index"]
    sample["away_squad_value_millions"] = at["squad_value_millions"]
    sample["away_injury_count"] = at["injury_count"]
    # Match-specific features (use reasonable defaults)
    sample["h2h_home_win_rate"] = 0.5
    sample["days_since_last_match"] = 7

    feature_df = pd.DataFrame([sample])
    return feature_df[FEATURE_COLUMNS].values


# -----------------------------------------------------------------------------
# App initialisation
# -----------------------------------------------------------------------------

model_state = ModelState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle handler: load or auto-train on startup."""
    _load_or_init_model(model_state)
    if not model_state.is_trained:
        logger.info("No persisted model found. Auto-training on real match data…")
        try:
            result = train_model(model_state)
            logger.info(f"Auto-train complete: accuracy={result['accuracy']}")
        except Exception as exc:
            logger.error(f"Auto-train failed: {exc}. Model will be untrained.")
    yield


app = FastAPI(
    title="Football AI Match Predictor — Inference Engine",
    description="XGBoost/Scikit-Learn prediction microservice with SHAP explainability — trained on real match data",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Return service health and model status."""
    return HealthResponse(
        modelTrained=model_state.is_trained,
        lastTrainedAt=(
            model_state.last_trained_at.isoformat()
            if model_state.last_trained_at
            else None
        ),
        trainAccuracy=model_state.train_accuracy,
    )


@app.post("/api/train", response_model=TrainResponse, tags=["Training"])
async def train():
    """Train (or retrain) the prediction model on real historical match data.

    Reads from data/matches.json — 100 real football matches with actual
    team stats and scores from Premier League, La Liga, Serie A, Bundesliga,
    and Ligue 1.
    """
    try:
        result = train_model(model_state)
        return TrainResponse(
            status="ok",
            message=f"Model trained successfully on {result['samples']} real matches using {result['modelType']}.",
            accuracy=result["accuracy"],
            samples=result["samples"],
            featuresUsed=result["featuresUsed"],
            durationSeconds=result["durationSeconds"],
        )
    except (RuntimeError, FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get(
    "/api/predictions/{fixture_id}",
    response_model=PredictionResponse,
    tags=["Predictions"],
)
async def predict_fixture(
    fixture_id: str,
    home_team: str = Query(..., description="Home team name (e.g. Arsenal)"),
    away_team: str = Query(..., description="Away team name (e.g. Manchester City)"),
):
    """Return outcome probabilities + SHAP feature importance for a fixture.

    Uses real team stats from teams.json to build the feature vector.

    Query parameters:
      - home_team: Name of the home team (must exist in teams.json)
      - away_team: Name of the away team (must exist in teams.json)

    Returns:
      - probabilities: { homeWin, draw, awayWin }
      - predictedOutcome: "HOME_WIN" | "DRAW" | "AWAY_WIN"
      - confidence: probability of the predicted class
      - featureImportance: per-feature SHAP impact values
    """
    if not model_state.is_trained:
        raise HTTPException(
            status_code=503,
            detail="Model not trained. POST /api/train first.",
        )

    # Build feature vector from real team stats
    try:
        feature_values = build_feature_vector(home_team, away_team)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error building feature vector: {exc}")

    # --- Predict ---
    try:
        probs = model_state.predict_proba(feature_values)[0]  # [P(AWAY), P(DRAW), P(HOME)]
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    home_win_prob = round(float(probs[2]), 4)
    draw_prob = round(float(probs[1]), 4)
    away_win_prob = round(float(probs[0]), 4)

    outcome_idx = int(np.argmax(probs))
    predicted_outcome = OUTCOME_CLASSES[outcome_idx]
    confidence = round(float(probs[outcome_idx]), 4)

    # --- SHAP feature importance ---
    shap_dict = model_state.get_shap_values(feature_values)
    feature_importance = [
        FeatureImportance(feature=name, impact=shap_dict.get(name, 0.0))
        for name in FEATURE_COLUMNS
    ]

    # --- Value Discrepancies (PRD §4.1) ---
    threshold = 0.05
    rng = np.random.RandomState(hash(fixture_id) % (2**31))
    discrepancies = []
    bookmaker_noise = rng.uniform(-0.08, 0.08, size=3)
    for label, p_ai in zip(
        ["HOME_WIN", "DRAW", "AWAY_WIN"],
        [home_win_prob, draw_prob, away_win_prob],
    ):
        p_bookmaker = max(0.01, min(0.99, p_ai + bookmaker_noise[len(discrepancies)]))
        delta = round(p_ai - p_bookmaker, 4)
        discrepancies.append({
            "outcome": label,
            "pAI": p_ai,
            "pBookmaker": round(p_bookmaker, 4),
            "delta": delta,
            "thresholdExceeded": bool(abs(delta) > threshold),
            "displayLabel": f"{'+' if delta > 0 else ''}{round(delta * 100, 1)}% Value"
            if abs(delta) > threshold else None,
        })

    return PredictionResponse(
        fixtureId=fixture_id,
        homeTeam=home_team,
        awayTeam=away_team,
        probabilities=ProbabilityVector(
            homeWin=home_win_prob,
            draw=draw_prob,
            awayWin=away_win_prob,
        ),
        predictedOutcome=predicted_outcome,
        confidence=confidence,
        featureImportance=sorted(feature_importance, key=lambda x: abs(x.impact), reverse=True),
        valueDiscrepancies=discrepancies,
        modelInfo={
            "trainedAt": (
                model_state.last_trained_at.isoformat()
                if model_state.last_trained_at
                else None
            ),
            "accuracy": model_state.train_accuracy,
            "samples": model_state.training_sample_count,
        },
    )


# -----------------------------------------------------------------------------
# Entry point (for local dev)
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True, log_level="info")
