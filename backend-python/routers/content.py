from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
import os

router = APIRouter()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ScriptRequest(BaseModel):
    topic: str
    tone: str = "profesional"
    duration_seconds: int = 60
    language: str = "es"

class NewsRequest(BaseModel):
    industry: str
    topics: list[str] = []

@router.post("/script")
async def generate_script(req: ScriptRequest):
    """Genera un guión para video basado en el tema y tono."""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"Eres un experto en creación de contenido de video. Genera guiones en {req.language}, tono {req.tone}, para videos de aproximadamente {req.duration_seconds} segundos."
                },
                {
                    "role": "user",
                    "content": f"Genera un guión para un video sobre: {req.topic}"
                }
            ],
            max_tokens=1000,
        )
        return {"script": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/news")
async def get_news_radar(req: NewsRequest):
    """Genera un resumen de noticias relevantes para la industria."""
    try:
        topics_str = ", ".join(req.topics) if req.topics else req.industry
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Eres un analista de noticias de negocios. Proporciona resúmenes de tendencias actuales relevantes para la industria indicada."
                },
                {
                    "role": "user",
                    "content": f"Dame 5 tendencias o noticias relevantes para la industria: {req.industry}. Temas de interés: {topics_str}"
                }
            ],
            max_tokens=800,
        )
        return {"news": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
