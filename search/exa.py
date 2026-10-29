import os
import time
from dotenv import load_dotenv
from exa_py import Exa

load_dotenv()


def getExaClient() -> Exa:
    """Initializes and returns the Exa client using the environment API key."""
    exaApiKey = os.getenv("EXA_API_KEY")
    if not exaApiKey:
        raise ValueError("EXA_API_KEY environment variable is not set.")
    return Exa(exaApiKey)


def searchWeb(
    query: str,
    numResults: int = 5,
    searchType: str = "auto",
    includeHighlights: bool = True,
) -> dict:
    """Executes a web search using the Exa AI search engine.

    Args:
        query: The search text or query string.
        numResults: Maximum number of search results to return.
        searchType: Exa search algorithm ('auto', 'neural', 'fast').
        includeHighlights: Whether to include relevant content snippets/highlights.

    Returns:
        A dictionary containing the search results and status.
    """
    startTime = time.time()
    try:
        exaClient = getExaClient()
        searchResponse = exaClient.search(
            query=query,
            num_results=numResults,
            type=searchType,
            contents={
                "highlights": includeHighlights,
            },
        )

        formattedResults = []
        for resultItem in searchResponse.results:
            formattedResults.append(
                {
                    "title": resultItem.title,
                    "url": resultItem.url,
                    "id": resultItem.id,
                    "publishedDate": getattr(resultItem, "published_date", None),
                    "author": getattr(resultItem, "author", None),
                    "highlights": getattr(resultItem, "highlights", []),
                }
            )

        executionDurationMs = round((time.time() - startTime) * 1000, 2)

        return {
            "success": True,
            "data": {
                "results": formattedResults,
                "total": len(formattedResults),
            },
            "metrics": {
                "durationMs": executionDurationMs,
            },
            "error": None,
        }

    except Exception as errorOccurred:
        executionDurationMs = round((time.time() - startTime) * 1000, 2)
        return {
            "success": False,
            "data": None,
            "metrics": {
                "durationMs": executionDurationMs,
            },
            "error": str(errorOccurred),
        }


if __name__ == "__main__":
    testQuery = "what is zerodaily.in"
    print(f"Executing search for: {testQuery} ...")
    searchOutput = searchWeb(testQuery, numResults=2)
    print(searchOutput)
