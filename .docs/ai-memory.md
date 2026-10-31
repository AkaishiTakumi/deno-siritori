# AI Memory

## Current Status
- Main features: Multi-player and solo DB-backed shiritori rooms with room rules.
- Current task: Validate room-rule and reset flows.
- Recent changes: Added per-room rule types/storage, server rule enforcement, per-turn timers, host-only reset, and reset navigation for all room users.
- Next steps: Run build/type checks and verify room creation, rule enforcement, timer expiry, loss shutdown, and reset navigation.

## Important Rules
- Do not scan the whole repository unless needed.
- Do not refactor unrelated files.
- Keep changes small and focused.
- Prefer Ask mode for questions.
- Use Agent mode only when multi-file edits or investigation are needed.

## Last Work Summary
- Changed `src/worker.ts`, `shared/types.ts`, `public/mode-select/script.ts`, and `public/game/script.ts`.
- Room rules are sent by host, stored in `rooms`, returned by room status, and enforced server-side.
- Game timer resets per turn; loss ends room; host reset sends all users to `/mode-select/`.

## Next Task
- Run build/type checks.
- Verify room-rule behavior and reset navigation end-to-end.
