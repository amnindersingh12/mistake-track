import scrapling
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

from parsers.summary_parser import parse_summary, ExtractedResultSummary
from parsers.question_paper_parser import parse_question_paper, PaperQuestion
from parsers.solution_parser import parse_solution, QuestionSolution

app = FastAPI(
    title="Scrapling Parsing Service",
    description="Dedicated Testbook and mock test parser using Scrapling",
    version="1.0.0"
)

class HtmlPayload(BaseModel):
    html: str

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "scrapling-service",
        "scrapling_version": getattr(scrapling, "__version__", "unknown")
    }

@app.post("/parse/summary", response_model=ExtractedResultSummary)
def extract_summary(payload: HtmlPayload):
    if not payload.html or not payload.html.strip():
        raise HTTPException(status_code=400, detail="HTML content is required")
    try:
        return parse_summary(payload.html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summary parsing error: {str(e)}")

@app.post("/parse/question-paper", response_model=List[PaperQuestion])
def extract_question_paper(payload: HtmlPayload):
    if not payload.html or not payload.html.strip():
        raise HTTPException(status_code=400, detail="HTML content is required")
    try:
        return parse_question_paper(payload.html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Question paper parsing error: {str(e)}")

@app.post("/parse/solution", response_model=QuestionSolution)
def extract_solution(payload: HtmlPayload):
    if not payload.html or not payload.html.strip():
        raise HTTPException(status_code=400, detail="HTML content is required")
    try:
        return parse_solution(payload.html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solution parsing error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8787, reload=False)

