# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router

print("⚡ Booting up Engineering Intelligence Hub API...")

# Initialize the FastAPI app
app = FastAPI(
    title="GraphRAG Engineering Copilot",
    description="Multimodal API powered by Neo4j, MongoDB, and Llama 3",
    version="1.0.0"
)

# --- CORS Configuration ---
# This allows your React frontend (usually running on port 3000 or 5173) to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your actual frontend URL!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Register Routes ---
# Mount all endpoints from api/routes.py under the /api prefix
app.include_router(router, prefix="/api")

# --- Root Health Check ---
@app.get("/")
async def health_check():
    return {
        "status": "online", 
        "engine": "Hybrid GraphRAG",
        "message": "Welcome to the Engineering Intelligence Hub. All systems nominal."
    }

# Execution block for running the server directly
if __name__ == "__main__":
    import uvicorn
    # Runs the server on localhost:8000 with hot-reloading enabled
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)