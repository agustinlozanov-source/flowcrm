from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
import os

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class QueryRequest(BaseModel):
    org_id: str
    query: str
    context_docs: list[str] = []

class ProcessPDFRequest(BaseModel):
    org_id: str
    file_name: str
    content: str  # Base64 or plain text extracted

@router.post("/query")
async def query_knowledge_base(req: QueryRequest):
    """Consulta la base de conocimiento con RAG."""
    try:
        context = "\n\n".join(req.context_docs) if req.context_docs else "No hay contexto adicional disponible."
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"Eres un asistente experto. Usa el siguiente contexto para responder:\n\n{context}"
                },
                {"role": "user", "content": req.query}
            ],
            max_tokens=600,
        )
        return {"answer": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process-pdf")
async def process_pdf(req: ProcessPDFRequest):
    """Procesa un PDF y extrae información clave para la base de conocimiento."""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Extrae y estructura la información clave del siguiente documento para usarla como base de conocimiento."
                },
                {"role": "user", "content": f"Archivo: {req.file_name}\n\nContenido:\n{req.content[:4000]}"}
            ],
            max_tokens=1000,
        )
        return {"summary": response.choices[0].message.content, "org_id": req.org_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
