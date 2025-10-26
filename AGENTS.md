# Repository Guidelines

## Project Structure & Module Organization
- `src/` hosts the Vue 3 client; key folders: `components/` for UI widgets, `composables/` for shared state helpers, `services/` for Tauri bridges, `utils/` for pure helpers, and `types/` for shared TypeScript interfaces.
- `src-tauri/` contains the Rust backend and Tauri config; commands live in `src-tauri/src/`, capabilities under `src-tauri/capabilities/`, and distribution metadata in `tauri.conf.json`.
- `public/` provides static assets loaded at build time, while `src/assets/` houses images bundled by Vite.
- `scripts/clear-cache.js` removes the desktop cache (`metadata.db`) when local data becomes inconsistent.

## Build, Test, and Development Commands
- `pnpm install` sets up dependencies; run after pulling new Rust or front-end changes.
- `pnpm tauri:dev` launches the desktop shell with hot-reloading Vue frontend; use for daily development.
- `pnpm dev` spins up the browser-only Vite server for quick UI experimentation.
- `pnpm build` executes `vue-tsc -b` plus `vite build` to ensure the TypeScript project compiles and outputs production assets to `dist/`.
- `pnpm tauri:build` generates signed desktop bundles; confirm `tauri.conf.json` targets are accurate beforehand.
- `pnpm cache:clear` invokes the cache cleanup script; helpful after altering schema or when metadata is stale.

## Coding Style & Naming Conventions
- TypeScript runs in strict mode; fix `noUnused*` issues proactively.
- Follow Vue SFC patterns with `<script setup lang="ts">`, 2-space indentation, and trailing commas for multiline objects.
- Components and composables use PascalCase filenames (`ImageViewer.vue`, `useUIConfigurations.ts`); utility modules and emitters remain lower camel case.
- Avoid implicit `any`; share reusable shapes via `src/types/`. Store UI styles in `style.css` or component-scoped blocks.

## Testing Guidelines
- Automated tests are not yet wired in; prefer adding `vitest` + Vue Test Utils suites under `src/__tests__/` when introducing complex logic.
- For Rust commands, add coverage with `cargo test --manifest-path src-tauri/Cargo.toml` once modules expose pure functions.
- Before shipping, run through recent features in `pnpm tauri:dev` and verify session persistence, zoom controls, and menu-backed actions.

## Commit & Pull Request Guidelines
- Commits follow short, imperative subjects (`Keep track of recent sessions`); keep to ~50 characters and focus on one change set.
- Ensure builds succeed locally, include screenshots or screen recordings for UI tweaks, and link related issues in the PR body.
- Call out migrations (cache schema, Tauri config) explicitly and document manual steps in the PR description.
