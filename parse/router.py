from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from parse.extractor import extractStructuredData

parseRouter = APIRouter(prefix="/v1/parse", tags=["Parse"])


class ParseRequest(BaseModel):
    """Request payload schema for structured JSON extraction."""

    url: str | None = Field(
        default=None,
        description="The webpage URL to scrape and extract structured data from.",
        examples=["https://zerodaily.in"],
    )
    markdown: str | None = Field(
        default=None,
        description="Pre-scraped markdown content to extract from directly (optional if url is provided).",
    )
    prompt: str | None = Field(
        default=None,
        description="Natural language instruction specifying what to extract.",
        examples=["Extract the top stories, their short summary, and category."],
    )
    schemaDefinition: dict | None = Field(
        default=None,
        alias="schema",
        description="Target JSON Schema defining the expected output structure.",
    )
    model: str = Field(
        default="openai/gpt-oss-120b",
        description="Groq model identifier (e.g. 'openai/gpt-oss-120b' or 'llama-3.3-70b-versatile').",
    )


@parseRouter.post(
    "",
    summary="Parse & Extract Structured JSON",
    description="Extracts strictly typed JSON from a webpage or markdown document using Groq LLM inference.",
)
async def performParse(parseRequest: ParseRequest) -> dict:
    """Handles structured data extraction requests."""
    try:
        parseResult = await extractStructuredData(
            url=parseRequest.url,
            markdownContent=parseRequest.markdown,
            extractionPrompt=parseRequest.prompt,
            targetSchema=parseRequest.schemaDefinition,
            preferredModel=parseRequest.model,
        )
        return parseResult
    except ValueError as validationError:
        raise HTTPException(status_code=400, detail=str(validationError))
    except Exception as serverError:
        raise HTTPException(status_code=500, detail=str(serverError))
