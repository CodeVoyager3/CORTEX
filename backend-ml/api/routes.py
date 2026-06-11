# api/routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os

# Import our clean, modular services
from services.ingestion import ingestion_service
from services.hybrid_search import hybrid_search

# Create the router (similar to express.Router())
router = APIRouter()

# --- 1. Define Request/Response Models ---
# This ensures the React frontend sends the exact right data shape
class ChatRequest(BaseModel):
    question: str

class ChatResponse(BaseModel):
    answer: str
    target_entity: str
    dependencies: list[str]

import tempfile
import shutil
from git import Repo

# Rename to source_path since it can be a URL or a directory
class IngestRequest(BaseModel):
    source_path: str

# --- 2. Define the Endpoints ---

@router.post("/chat", response_model=ChatResponse)
async def ask_copilot(request: ChatRequest):
    """
    Takes a natural language question from the frontend, 
    runs the GraphRAG pipeline, and returns the LLM synthesis.
    """
    try:
        if not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty.")
            
        result = hybrid_search.execute_search(request.question)
        return result
        
    except Exception as e:
        print(f"⚠️ Search API Error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during search.")

@router.post("/ingest")
async def trigger_ingestion(request: IngestRequest):
    """
    Tells the backend to crawl a repository. 
    Accepts BOTH local directory paths and live GitHub URLs.
    """
    source = request.source_path.strip()

    try:
        # --- SCENARIO A: User provides a GitHub URL ---
        if source.startswith("http://") or source.startswith("https://") or source.startswith("git@"):
            print(f"🌐 GitHub URL detected! Cloning {source}...")
            
            # Create a temporary folder on your computer
            temp_dir = tempfile.mkdtemp()
            
            try:
                # Clone the repo into the temp folder
                Repo.clone_from(source, temp_dir)
                
                # Run your GraphRAG ingestion engine on the temp folder
                ingestion_service.ingest_directory(temp_dir)
                
                return {"status": "success", "message": f"Successfully cloned and indexed GitHub repo: {source}"}
            
            finally:
                # ALWAYS clean up the temporary folder when done, even if it fails
                shutil.rmtree(temp_dir, ignore_errors=True)
                print("🧹 Temporary repository files cleaned up.")

        # --- SCENARIO B: User provides a local folder path ---
        elif os.path.exists(source):
            print(f"📂 Local directory detected! Indexing {source}...")
            ingestion_service.ingest_directory(source)
            return {"status": "success", "message": f"Successfully indexed local folder: {source}"}
            
        else:
            raise HTTPException(status_code=404, detail="Invalid source. Must be a valid local path or GitHub URL.")

    except Exception as e:
        print(f"⚠️ Ingestion API Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process repository: {str(e)}")