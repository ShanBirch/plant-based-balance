import os
import shutil

# Config
SOURCE_DIR = r"c:\Users\shann\.gemini\antigravity\plant_based_balance"
DEST_DIR = r"c:\Users\shann\.gemini\antigravity\plant_based_balance\deploy_package"

# Clean start
if os.path.exists(DEST_DIR):
    shutil.rmtree(DEST_DIR)
os.makedirs(DEST_DIR)

# Root files to copy (by extension)
VALID_EXTENSIONS = {'.html', '.css', '.js', '.toml', '.txt'} 
# Explicit files to exclude even if they match above (if any)
EXCLUDE_FILES = {'bulk_transactions.txt', 'jul_sep_data.txt', 'stripe_data.txt'}

# Folders to copy recursively
VALID_FOLDERS = ['app', 'assets', 'netlify', 'backend'] # backend might be needed if it has server middleware, but mostly it's python scripts. content says backend in file list was empty? No, it has subdirs? Check.
# list_dir showed backend as empty or small? Step 57 said "Empty directory" for backend! 
# But let's check if it has content, if empty ignore. 
# Step 57 said "Empty directory" for backend. So ignore backend.

# Actually, copy explicit folders:
FOLDERS_TO_COPY = ['app', 'assets', 'netlify'] 

def copy_root_files():
    for filename in os.listdir(SOURCE_DIR):
        src_path = os.path.join(SOURCE_DIR, filename)
        
        if os.path.isfile(src_path):
            ext = os.path.splitext(filename)[1].lower()
            if ext in VALID_EXTENSIONS and filename not in EXCLUDE_FILES:
                shutil.copy2(src_path, os.path.join(DEST_DIR, filename))
                print(f"Copied {filename}")
            elif filename == "_headers" or filename == "_redirects":
                shutil.copy2(src_path, os.path.join(DEST_DIR, filename))
                print(f"Copied {filename}")

def copy_folders():
    for folder in FOLDERS_TO_COPY:
        src = os.path.join(SOURCE_DIR, folder)
        dst = os.path.join(DEST_DIR, folder)
        if os.path.exists(src):
            shutil.copytree(src, dst)
            print(f"Copied folder {folder}")

if __name__ == "__main__":
    copy_root_files()
    copy_folders()
    print("Deploy package created at: " + DEST_DIR)
