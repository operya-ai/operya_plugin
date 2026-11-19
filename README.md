# Operya Agents for Claude

This plugin connects Claude Code and local Cowork sessions to the [Operya Agents gateway](https://agents.operya.ai/llms.txt). It supplies three MCP tools: authenticated GraphQL schema discovery, GraphQL execution, and HTTP calls to documented gateway paths. The configured agent key controls which vertical and records the gateway permits. The bridge sends requests only to `https://agents.operya.ai`; it does not store the key or responses.

## Install and configure

Add the repository as a Claude Code marketplace with `claude plugin marketplace add operya-ai/operya_plugin`, then install with `claude plugin install operya-agents@operya-ai`. To test a checkout without installing, run `claude --plugin-dir .`. In the plugin's **Configure options**, enter a scoped Operya agent key. A Hiring key, Sales key, Marketing key, HR key, or Dispatch key selects its own API surface. Obtain the key in the applicable Operya product; the plugin does not create credentials. Node.js 20 or later is required where the local MCP server runs.

The `userConfig.agent_token` option is marked sensitive. Claude Code injects it into the local MCP process as `OPERYA_AGENT_TOKEN`; the bridge sends it only as a Bearer token to the Operya gateway. Do not commit keys or put them in prompts.

The plugin's `use-operya-agents` skill tells Claude to discover the schema, read before writing, and handle Dispatch claim receipts and leases. For example, ask Claude to show the queues available to your Dispatch key or list open Hiring jobs. Writes affect live Operya records and remain subject to the gateway's key scopes and business checks.

## Scope and current limitation

The bundled MCP server runs locally through `node server.mjs`. Claude chat on claude.ai does not start local MCP servers, so this plugin's tools work in Claude Code and local Cowork only. A chat compatible version requires a deployed HTTPS MCP server with OAuth, added as a remote connector. Do not point `.mcp.json` at `/graphql`: that endpoint speaks GraphQL, not MCP. [Claude's plugin documentation](https://claude.com/docs/plugins/build) explains the app support and connector requirements.

`agents_http` accepts GET and POST paths on the fixed gateway origin. JSON responses are limited to 256 KiB and binary downloads to 1 MiB; larger downloads need a dedicated authorized client. The tool never follows redirects. This plugin makes no calls to third party services and installs no packages.

## Development and validation

Run `node --test` for the local MCP protocol checks. If Claude Code is installed, run `claude plugin validate .` and `claude --plugin-dir .`; use `/mcp` to check the connection. For directory submission, enter this repository in the [Claude developer portal](https://claude.ai/directory/manage), validate its current commit, and submit the plugin bundle. Directory review and publication are separate steps performed in the portal.
