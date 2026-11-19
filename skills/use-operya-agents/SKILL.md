---
name: use-operya-agents
description: Use when the user asks Claude to inspect or operate Operya hiring, sales, marketing, HR, maintenance, or Dispatch data through a scoped Operya Agents key.
---

# Operya Agents

Use the `operya-agents` MCP tools for live Operya data. Start with `agents_schema`; the configured key selects one vertical's authenticated GraphQL schema. Use `agents_graphql` for that schema's queries and mutations. Use `agents_http` only for a documented gateway REST path, such as Dispatch queue endpoints or an authorized attachment download.

Read before a write. Use the user's requested scope, current record identifiers, and the schema's input and receipt rules. Ask for missing business decisions before a mutation. Never infer broader access from another vertical's schema, and never paste or request the full key in chat.

For Dispatch, discover queues and jobs before claiming. Keep the claim `request_id` stable across uncertain outcomes, keep `lease_token` private, and heartbeat active claims at least once a minute. Reconcile with `/v1/me` before retrying an uncertain claim. Use a fresh claim only when the prior request has been resolved. After any uncertain write response, read back the record or documented receipt before retrying.

Summarize the result and any business identifier, status, or error. Do not include raw resumes, secrets, lease tokens, or whole API payloads unless the user specifically needs them.
