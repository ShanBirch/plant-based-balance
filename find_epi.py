import os
import sys

def search():
    for root, _, files in os.walk("."):
        for file in files:
            if file.endswith(".js") or file.endswith(".html") or file.endswith(".sql"):
                try:
                    with open(os.path.join(root, file), "r", encoding="utf-8") as f:
                        if "epigenetic alterations" in f.read():
                            print(os.path.join(root, file))
                except:
                    pass

if __name__ == "__main__":
    search()