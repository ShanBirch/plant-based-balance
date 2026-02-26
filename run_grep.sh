cat dashboard.html | grep -n "OR CHALLENGE A FRIEND" > dash_grep.txt
cat dashboard.html | grep -n "sendChallenge" >> dash_grep.txt
cat dashboard.html | grep -n "Failed to send challenge" >> dash_grep.txt