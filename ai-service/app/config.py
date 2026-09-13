import os
from dotenv import load_dotenv
from supabase import create_client, Client
from langchain_groq import ChatGroq

# Load .env from project root
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Allow passing keys via creating the client if needed, but for now global is fine
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL or SUPABASE_KEY (SUPABASE_ANON_KEY) is not set in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_llm():
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not set")
    return ChatGroq(
        temperature=0.2, 
        model_name="llama-3.3-70b-versatile", 
        api_key=GROQ_API_KEY
    )
