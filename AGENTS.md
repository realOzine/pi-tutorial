# Pi tutorial development

This repository holds the course, its local HTML pages, and TypeScript labs. The sibling `../pi` checkout is a read-only reference, pinned in `docs/sources.md`.

## Teaching and writing

- Write Chinese lessons using the explicitly requested `readable-writing` skill at `/Users/ozine/Documents/Obsidian/ozine/90 system/Skills/readable-writing/SKILL.md`.
- Start with a concrete problem, show the execution trace, then explain the mechanism and its trade-offs.
- Distinguish source facts, author statements, teaching simplifications, design inference, and measured results.
- Keep the learner's key implementation unfinished. Put runnable reference implementations in `solutions/`; never overwrite learner work to make checks pass.
- Mark planned lessons as planned. Never imply a scaffold or simulated trace is a working model integration.
- Keep credentials out of HTML and tracked files. Labs must not call paid models by default.

## Implementation

- Use buildless HTML/CSS/JavaScript for the course and erasable TypeScript for Node labs. No framework is needed for the first lesson.
- Use top-level imports, no `any`, and no speculative abstractions. Validate imported trace files and local-server request paths.
- Read each file completely before editing it. Re-read changes before committing.
- Add focused tests for new behavior. Run `npm run check`; run affected learner checks separately and report intentional initial failures.
- Do not run `npm test`. Install exact versions with `npm install --ignore-scripts` or `npm ci --ignore-scripts`.
- Serve only `site/`, bound to loopback. Runtime outputs go in ignored `artifacts/`.

## Git workflow

- The user authorizes small commits and merges for this course. Use `docs:`, `feat:`, or `fix:` messages.
- Parallel work uses separate worktrees and disjoint file ownership. Stage explicit paths only.
- Review and validate before merging. Do not modify the sibling pi repository.
- Remove only this task's clean, merged worktrees and branches after verifying their commits are reachable from `main`.
- Never use force cleanup, hard reset, broad staging, or discard another session's changes.
- Update `docs/progress.md` with actual delivery and verification boundaries; do not mark future lessons complete.
