# Shared rules and instructions for all prompts

NO_HALLUCINATIONS_RULE = """No Hallucinations: If any information is missing or unclear, you MUST return `null` or skip it as appropriate. Do not guess, infer, invent, or hallucinate missing data."""

STRICT_JSON_INSTRUCTION = """You must respond with valid JSON only. No markdown, no code blocks, no explanation. Just the raw JSON object."""
