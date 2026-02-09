
from b2sdk.v2 import *

KEY_ID = "0055c4034c6a45e0000000001"
APP_KEY = "K005rPzmGgPJnFwNycp12DCxs24Eer4"
BUCKET_NAME = "shannonsvideos"

def main():
    print("Connecting to B2...")
    info = InMemoryAccountInfo()
    b2_api = B2Api(info)
    b2_api.authorize_account("production", KEY_ID, APP_KEY)
    
    bucket = b2_api.get_bucket_by_name(BUCKET_NAME)
    print(f"Bucket: {bucket.name}")
    print(f"Current Type: {bucket.type}")
    
    print("Setting bucket to Public...")
    bucket.update(bucket_type='allPublic')
    print("Bucket updated to allPublic.")

if __name__ == "__main__":
    main()
