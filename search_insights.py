import os
os.system("grep -rin 'Insight' js/dashboard/ > search_results.txt")
with open("search_results.txt", "r") as f:
    print(f.read())
