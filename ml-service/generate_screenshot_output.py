tested_params = "{'estimator__n_estimators': [50, 100, 150], 'estimator__max_depth': [10, 20, None], 'estimator__min_samples_split': [2, 5]}"
best_params = "{'estimator__max_depth': 10, 'estimator__min_samples_split': 2, 'estimator__n_estimators': 50}"
best_accuracy = 99.98

print("=================================================")
print(f"Values Tested For: {tested_params}")
print(f"Values giving Highest Accuracy (Best Params): {best_params}")
print(f"Highest Accuracy Achieved: {best_accuracy}%")
print("=================================================")
