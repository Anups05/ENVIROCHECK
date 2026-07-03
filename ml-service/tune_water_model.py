import os
import warnings
warnings.filterwarnings("ignore")

import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, "..", "dataset", "water_quality_8000_1000_outliersx.xlsx")

FEATURES = ["pH", "Hardness", "Solids", "Sulfate", "Chloramines",
            "Conductivity", "Organic_carbon", "Trihalomethanes", "Turbidity"]
TARGET   = "Potability"

def main():
    print("Loading dataset...")
    df = pd.read_excel(DATASET_PATH)

    to_drop = [c for c in ["Outlier", "District"] if c in df.columns]
    if to_drop:
        df.drop(columns=to_drop, inplace=True)

    for feat in FEATURES:
        df[feat].fillna(df[feat].mean(), inplace=True)

    df.dropna(subset=[TARGET], inplace=True)
    df[TARGET] = df[TARGET].astype(int)

    X = df[FEATURES].values.astype(float)
    y = df[TARGET].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # Creating a pipeline with scaler and random forest estimator
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('estimator', RandomForestClassifier(random_state=42, class_weight="balanced"))
    ])

    # Parameter grid for tuning
    param_grid = {
        'estimator__n_estimators': [50, 100, 150],
        'estimator__max_depth': [10, 20, None],
        'estimator__min_samples_split': [2, 5]
    }

    print("Running GridSearchCV for hyperparameter tuning. This may take a moment...\n")
    print("=" * 60)
    
    # GridSearchCV implementation
    grid_search = GridSearchCV(
        pipeline,
        param_grid,
        cv=5,
        scoring='accuracy',
        n_jobs=-1
    )

    grid_search.fit(X_train, y_train)

    # Replicating the exact requested output format
    print(f"Values Tested For: {param_grid}")
    print(f"Values giving Highest Accuracy (Best Params): {grid_search.best_params_}")
    print(f"Highest Accuracy Achieved: {grid_search.best_score_ * 100:.2f}%")
    print("======================================================")

if __name__ == "__main__":
    main()
