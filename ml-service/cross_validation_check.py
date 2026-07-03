import sys
import warnings
import numpy as np
import pandas as pd
from sklearn.model_selection import cross_val_score, KFold, StratifiedKFold
from xgboost import XGBRegressor
from sklearn.ensemble import RandomForestClassifier

# Suppress warnings for cleaner terminal output
warnings.filterwarnings('ignore')

# ── Formatting like the terminal output ──────────────────────────────────────
print("Loading data for Cross-Validation...\n")
print("==================================================")
print("5-FOLD CROSS-VALIDATION RESULTS")
print("==================================================\n")

# ── 1. AQI Model ─────────────────────────────────────────────────────────────
print("Running Cross-Validation for AQI Model (Please wait...)")
try:
    df_aqi = pd.read_csv('../dataset/air_quality_india_7000.csv')
    features_aqi = ['PM2.5 (µg/m³)', 'PM10 (µg/m³)', 'NO₂ (µg/m³)', 'SO₂ (µg/m³)', 
                    'CO (mg/m³)', 'O₃ (µg/m³)', 'NH₃ (µg/m³)', 'Temperature (°C)', 
                    'Humidity (%)', 'Wind Speed (km/h)', 'Traffic Density (veh/hr)', 
                    'Industrial Activity (0-100)', 'Green Cover (%)', 
                    'Population Density (per km²)', 'Waste Management Score (0-10)']

    # Imputation mapping train_aqi_model.py
    for f in features_aqi + ['AQI']: 
        df_aqi[f] = df_aqi[f].fillna(df_aqi[f].mean())
        
    df_aqi['_pollution_index'] = (df_aqi['PM2.5 (µg/m³)']*0.35 + df_aqi['PM10 (µg/m³)']*0.25 + 
                                  df_aqi['NO₂ (µg/m³)']*0.12 + df_aqi['SO₂ (µg/m³)']*0.10 + 
                                  df_aqi['CO (mg/m³)']*8.0 + df_aqi['O₃ (µg/m³)']*0.08 + 
                                  df_aqi['NH₃ (µg/m³)']*0.10)
    df_aqi['_urban_stress'] = (df_aqi['Traffic Density (veh/hr)']/10000.0*0.4 + 
                               df_aqi['Industrial Activity (0-100)']/100.0*0.4 + 
                               df_aqi['Population Density (per km²)']/20000.0*0.2)
    df_aqi['_env_resilience'] = (df_aqi['Green Cover (%)']/100.0*0.5 + 
                                 df_aqi['Waste Management Score (0-10)']/10.0*0.3 + 
                                 (df_aqi['Wind Speed (km/h)']/50.0).clip(0, 1)*0.2)
    df_aqi['_pm_ratio'] = df_aqi['PM10 (µg/m³)']/(df_aqi['PM2.5 (µg/m³)']+1.0)
    df_aqi['_gas_cocktail'] = df_aqi['NO₂ (µg/m³)']*df_aqi['SO₂ (µg/m³)']/1000.0

    X_aqi = df_aqi[features_aqi + ['_pollution_index', '_urban_stress', '_env_resilience', '_pm_ratio', '_gas_cocktail']].values.astype(float)
    y_aqi = df_aqi['AQI'].values.astype(float)

    aqi_model = XGBRegressor(n_estimators=400, max_depth=5, learning_rate=0.05, 
                             subsample=0.8, colsample_bytree=0.7, colsample_bylevel=0.8, 
                             reg_alpha=0.1, reg_lambda=1.5, min_child_weight=5, 
                             random_state=42, n_jobs=-1, verbosity=0)
                             
    cv_aqi = KFold(n_splits=5, shuffle=True, random_state=42)
    scores_aqi = cross_val_score(aqi_model, X_aqi, y_aqi, cv=cv_aqi, scoring='r2', n_jobs=-1)

    scores_aqi_str = "[" + " ".join([f"{s:.8f}" for s in scores_aqi]) + "]"

    print(f"AQI CV Scores (5 folds): {scores_aqi_str}")
    print(f"AQI Average Accuracy:    {scores_aqi.mean()*100:.2f}%\n")
    
except Exception as e:
    print(f"[Error in AQI Model CV]: {e}\n")


# ── 2. Water Quality Model ───────────────────────────────────────────────────
print("Running Cross-Validation for Water Quality Model (Please wait...)")
try:
    df_water = pd.read_excel('../dataset/water_quality_8000_1000_outliersx.xlsx')
    features_water = ['pH', 'Hardness', 'Solids', 'Sulfate', 'Chloramines', 'Conductivity', 'Organic_carbon', 'Trihalomethanes', 'Turbidity']
    
    df_water.drop(columns=[c for c in ['Outlier', 'District'] if c in df_water.columns], inplace=True)
    for f in features_water: 
        df_water[f] = df_water[f].fillna(df_water[f].mean())
        
    df_water.dropna(subset=['Potability'], inplace=True)
    df_water['Potability'] = df_water['Potability'].astype(int)

    X_water = df_water[features_water].values.astype(float)
    y_water = df_water['Potability'].values

    water_model = RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42, 
                                         class_weight='balanced', n_jobs=-1)
                                         
    cv_water = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores_water = cross_val_score(water_model, X_water, y_water, cv=cv_water, scoring='accuracy', n_jobs=-1)

    scores_water_str = "[" + " ".join([f"{s:.8f}" for s in scores_water]) + "]"

    print(f"Water CV Scores (5 folds): {scores_water_str}")
    print(f"Water Average Accuracy:    {scores_water.mean()*100:.2f}%")
    
except Exception as e:
    print(f"[Error in Water Model CV]: {e}\n")


print("==================================================")
sys.exit(0)
