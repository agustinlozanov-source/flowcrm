from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import content, rag

app = FastAPI(title="FlowCRM AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(content.router, prefix="/content", tags=["Content Studio"])
app.include_router(rag.router, prefix="/rag", tags=["RAG / Knowledge Base"])

@app.get("/")
def health():
    return {"status": "ok", "service": "FlowCRM AI Service", "version": "1.0.0"}
