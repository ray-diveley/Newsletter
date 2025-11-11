# Newsletter (refactor)

This repo provides a small Express app that builds an internal engineering newsletter by querying JIRA and using OpenAI for summarization.

What changed in this refactor:
- Moved small helper functions into `src/lib/utils.js`
- Moved JIRA search and JQL building into `src/lib/jira.js`
- Moved OpenAI summarization functions into `src/lib/summarizer.js`
- Kept `src/index.js` as the HTTP/server wiring and route handlers

Quick start:
1. Copy your `.env` variables (JIRA_EMAIL, JIRA_API_TOKEN, JIRA_DOMAIN, OPENAI_API_KEY)
2. Install deps: `npm install`
3. Start: `npm start` (or `npm run dev` for nodemon)

Notes:
- The refactor is minimal and behaviour should remain unchanged. The summarizer functions expect an OpenAI client; `src/index.js` constructs and passes it.
- If you want tests/linting added I can add them next.
