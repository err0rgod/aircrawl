import json
import os
import time
from dotenv import load_dotenv
from groq import AsyncGroq

from scrape.scrape import scrapeUrl
from scrape.security import validateTargetUrl

load_dotenv()


def getGroqClient() -> AsyncGroq:
    """Returns an initialized AsyncGroq client using environment credentials."""
    groqApiKey = os.getenv("GROQ_API_KEY")
    if not groqApiKey:
        raise ValueError("GROQ_API_KEY environment variable is not set. Please add it to your .env file.")
    return AsyncGroq(api_key=groqApiKey)


async def extractStructuredData(
    url: str | None = None,
    markdownContent: str | None = None,
    extractionPrompt: str | None = None,
    targetSchema: dict | None = None,
    preferredModel: str = "openai/gpt-oss-120b",
) -> dict:
    """Extracts structured JSON from a URL or raw markdown using Groq LLM.

    Args:
        url: Webpage URL to scrape and parse.
        markdownContent: Raw markdown content if already scraped.
        extractionPrompt: Instructions describing what information to extract.
        targetSchema: The JSON Schema structure the output must conform to.
        preferredModel: The model to use (default: 'openai/gpt-oss-120b').

    Returns:
        A dictionary containing the parsed JSON data, usage metadata, and timing metrics.
    """
    startTime = time.time()

    # Step 1: Ensure we have content (either directly provided or fetched via scrapeUrl)
    resolvedContent = markdownContent
    sourceUrl = url

    if url:
        validateTargetUrl(url)

    if not resolvedContent and url:
        scrapeResponse = await scrapeUrl(url=url, formats=["markdown"])
        if not scrapeResponse["success"]:
            raise RuntimeError(f"Failed to scrape webpage before parsing: {scrapeResponse['error']}")
        resolvedContent = scrapeResponse["data"].get("markdown", "")

    if not resolvedContent or not resolvedContent.strip():
        raise ValueError("No content available to parse. Please provide either a valid 'url' or 'markdownContent'.")

    # Step 2: Assemble System Prompt and Instructions
    systemInstruction = (
        "You are an expert structured data extraction engine. "
        "Your task is to analyze the provided web document and extract the requested fields "
        "into a valid JSON object. Follow any provided JSON schema strictly. "
        "Do not wrap your output in markdown code blocks like ```json. Output ONLY the raw JSON object."
    )

    userPromptContent = f"Web Document Content:\n\n{resolvedContent}\n\n"
    if extractionPrompt:
        userPromptContent += f"Extraction Instructions:\n{extractionPrompt}\n\n"
    if targetSchema:
        userPromptContent += f"Target JSON Schema Requirements:\n{json.dumps(targetSchema, indent=2)}\n\n"

    userPromptContent += "Extract the requested information and respond with the resulting JSON object only."

    # Step 3: Call Groq API with fallback capability
    groqClient = getGroqClient()
    modelsToAttempt = [preferredModel, "llama-3.3-70b-versatile"]
    chatCompletion = None
    modelUsed = preferredModel

    for candidateModel in modelsToAttempt:
        try:
            chatCompletion = await groqClient.chat.completions.create(
                model=candidateModel,
                messages=[
                    {"role": "system", "content": systemInstruction},
                    {"role": "user", "content": userPromptContent},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            modelUsed = candidateModel
            break
        except Exception as groqError:
            # If the specific model isn't recognized or available, try the fallback model
            if candidateModel == modelsToAttempt[-1]:
                raise groqError

    if not chatCompletion or not chatCompletion.choices:
        raise RuntimeError("Groq LLM returned an empty response.")

    rawJsonOutput = chatCompletion.choices[0].message.content.strip()
    parsedStructuredData = json.loads(rawJsonOutput)
    executionDurationMs = round((time.time() - startTime) * 1000, 2)

    usageInfo = getattr(chatCompletion, "usage", None)

    return {
        "success": True,
        "data": {
            "extracted": parsedStructuredData,
            "metadata": {
                "sourceUrl": sourceUrl,
                "modelUsed": modelUsed,
                "promptTokens": getattr(usageInfo, "prompt_tokens", None) if usageInfo else None,
                "completionTokens": getattr(usageInfo, "completion_tokens", None) if usageInfo else None,
                "totalTokens": getattr(usageInfo, "total_tokens", None) if usageInfo else None,
            },
        },
        "metrics": {
            "durationMs": executionDurationMs,
        },
        "error": None,
    }


if __name__ == "__main__":
    import asyncio
    import sys

    if sys.stdout.encoding != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")

    async def runTest() -> None:
        sampleMarkdown = """
        # Acme Cloud Pricing
        - Starter Plan: $19/month. Includes 5 team members and 10GB storage.
        - Pro Plan: $49/month. Includes 25 team members and 100GB storage.
        - Enterprise Plan: Custom pricing. Dedicated support and unlimited storage.
        """
        sampleSchema = {
            "type": "object",
            "properties": {
                "pricingPlans": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "planName": {"type": "string"},
                            "price": {"type": "string"},
                            "storage": {"type": "string"},
                        },
                        "required": ["planName", "price"],
                    },
                }
            },
            "required": ["pricingPlans"],
        }

        print("Testing extractStructuredData on sample markdown...")
        try:
            result = await extractStructuredData(
                markdownContent=sampleMarkdown,
                extractionPrompt="Extract all available pricing tiers",
                targetSchema=sampleSchema,
            )
            print("Extracted Data:", json.dumps(result, indent=2))
        except Exception as testError:
            print(f"Error during test: {testError}")

    asyncio.run(runTest())
