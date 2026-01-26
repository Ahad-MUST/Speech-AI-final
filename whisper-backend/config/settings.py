# config/settings.py - Configuration Constants (UPDATED WITH AUDIOS_DIR)

import os
from pathlib import Path

# LLM Configuration
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "qwen2.5:7b-instruct")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
MAX_CHUNK_SIZE = 7000

# Directory Configuration
UPLOAD_DIR = Path("uploads")  # Temporary uploads (will be moved to audios/)
OUTPUT_DIR = Path("outputs")  # Processing outputs (transcripts, etc.)
STATIC_DIR = Path("static")  # Static files
AUDIOS_DIR = Path("audios")  # NEW: Permanent audio file storage (organized by user)

# Ensure directories exist
for directory in [UPLOAD_DIR, OUTPUT_DIR, STATIC_DIR, AUDIOS_DIR]:
    directory.mkdir(exist_ok=True)

# Fallback prompts (if database not available)
LLM_PROMPTS = {
    "summary": {
        "name": "Conversation Summary",
        "description": "Generate a comprehensive summary of the entire conversation",
        "prompt": """Analyze this conversation transcript and provide a comprehensive summary:

{transcript}

Provide:
1. **Main Topics**: Key subjects discussed
2. **Key Points**: Important details and insights
3. **Participants**: Speakers and their contributions
4. **Tone**: Overall conversation atmosphere
5. **Conclusions**: Any decisions or agreements reached

Keep the summary concise but comprehensive.""",
        "max_tokens": 2000,
        "usage_count": 0
    },
    "action_items": {
        "name": "Action Items & Tasks",
        "description": "Extract actionable tasks and commitments from the conversation",
        "prompt": """Extract all action items, tasks, and commitments from this transcript:

{transcript}

Format each action item as:
**Action**: [What needs to be done]
**Owner**: [Who is responsible]
**Deadline**: [When it's due, if mentioned]
**Status**: [New/In Progress/Completed]

Focus on concrete, actionable items that were explicitly mentioned or agreed upon.""",
        "max_tokens": 1500,
        "usage_count": 0
    }
}