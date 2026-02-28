import urllib.request
url = 'https://raw.githubusercontent.com/ShanBirch/plant-based-balance/main/dashboard.html'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    content = response.read().decode('utf-8')
with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(content)
