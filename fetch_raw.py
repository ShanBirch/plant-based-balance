import urllib.request
url = 'https://raw.githubusercontent.com/ShanBirch/plant-based-balance/main/dashboard.html'
with urllib.request.urlopen(url) as response:
    html = response.read().decode('utf-8')
with open('dashboard_raw.html', 'w') as f:
    f.write(html)
