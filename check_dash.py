import sys
try:
    with open('dashboard.html', 'r', encoding='utf-8') as f:
        content = f.read()
        if 'Meal Insight' in content:
            print("Found Meal Insight in dashboard.html")
        else:
            print("Not in dashboard.html")
            
        if 'checkAndShowWorkoutTrendCard' in content:
            print("Found checkAndShowWorkoutTrendCard in dashboard.html")
            
except Exception as e:
    print(e)
