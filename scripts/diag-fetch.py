import os
import traceback
from dotenv import load_dotenv
from supabase import create_client

def main():
    env_path = os.path.join(os.getcwd(), '.env')
    load_dotenv(dotenv_path=env_path)
    
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_ANON_KEY')
    
    print(f"URL: {url}")
    print(f"Key set: {key is not None}")
    
    s = create_client(url, key)
    
    try:
        print("Executing fetch...")
        r = s.table('content_queue').select('*').eq('status', 'pending').limit(1).execute()
        print(f"Success! Fetched {len(r.data)} items.")
        if len(r.data) > 0:
            print(f"Sample item: {r.data[0]['id']} - {r.data[0]['title']}")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    main()
