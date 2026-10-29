from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from search.exa import searchWeb

searchRouter = APIRouter(prefix="/v1/search", tags=["Search"])


class SearchRequest(BaseModel):
    """Request payload schema for web search queries."""

    query: str = Field(
        ...,
        description="The query string to search for across the web.",
        examples=["latest breakthroughs in generative AI"],
    )
    numResults: int = Field(
        default=5,
        ge=1,
        le=50,
        description="Number of search results to retrieve (between 1 and 50).",
    )
    searchType: str = Field(
        default="auto",
        description="Search type algorithm: 'auto', 'neural', or 'fast'.",
    )
    includeHighlights: bool = Field(
        default=True,
        description="Whether to include content highlights and snippets for each result.",
    )


@searchRouter.post(
    "",
    summary="Search the Web",
    description="Performs semantic/neural web search using Exa and returns clean AI-ready URLs and snippets.",
)
async def performSearch(searchRequest: SearchRequest) -> dict:
    """Handles web search requests and returns standardized results."""
    searchResult = searchWeb(
        query=searchRequest.query,
        numResults=searchRequest.numResults,
        searchType=searchRequest.searchType,
        includeHighlights=searchRequest.includeHighlights,
    )

    if not searchResult["success"]:
        raise HTTPException(status_code=500, detail=searchResult["error"])

    return searchResult
