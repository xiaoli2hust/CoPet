# Mock NianLun Server

Run from the repository root:

```bash
pnpm mock:nianlun
```

It serves `GET /api/health` and `POST /api/agent/chat` on
`http://127.0.0.1:8000`. Requests with `Accept: text/event-stream` receive
SSE events; normal requests receive one JSON response. Every answer is marked
as simulated data.
