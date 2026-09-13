import pydantic
import uvicorn
from datetime import datetime
from fastapi import FastAPI, HTTPException
from app.graph import app_graph
from app.schemas import AnalysisRequest, AnalysisResponse, ProcessingStats

app = FastAPI(title="SocialSync AI Decision Layer", version="1.0")

@app.get("/")
def read_root():
    return {
        "message": "SocialSync AI Decision Layer is running",
        "docs": "/docs",
        "health": "/health",
        "analyze": "/api/analyze (POST)"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": str(datetime.now())}

@app.post("/api/analyze", response_model=AnalysisResponse)
def analyze_content(request: AnalysisRequest):
    """
    Triggers the AI analysis workflow for pending content.
    """
    try:
        print(f"Received analysis request for batch size {request.batch_size}")
        
        # Initial state
        initial_state = {
            "batch_size": request.batch_size,
            "batch_id": None,
            "content_batch": [],
            "stats": ProcessingStats().model_dump()
        }
        
        # Run graph (Sync execution in threadpool)
        final_state = app_graph.invoke(initial_state)
        
        stats = final_state["stats"]
        return AnalysisResponse(**stats)
        
    except Exception as e:
        print(f"Error in analyze_content: {e}")
        # Return error response structure if possible, or raise HTTP exc
        raise HTTPException(status_code=500, detail=str(e))

import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

