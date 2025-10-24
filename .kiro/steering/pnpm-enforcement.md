# PNPM Package Manager Enforcement

## Package Manager Standard

This project uses **pnpm** as the package manager. All Node.js package management commands must use pnpm instead of npm or yarn.

## Required Commands

- **Install dependencies**: `pnpm install` (not `npm install`)
- **Add packages**: `pnpm add <package>` (not `npm install <package>`)
- **Add dev dependencies**: `pnpm add -D <package>` (not `npm install --save-dev <package>`)
- **Remove packages**: `pnpm remove <package>` (not `npm uninstall <package>`)
- **Run scripts**: `pnpm run <script>` or `pnpm <script>` (not `npm run <script>`)
- **Execute binaries**: `pnpm exec <command>` (not `npx <command>`)

## Tauri-Specific Commands

This is a Tauri application. Use these specific commands:

- **Start development server**: `pnpm tauri:dev` (not `pnpm run dev` or `pnpm dev`)
- **Build for production**: `pnpm tauri:build` (not `pnpm run build`)
- **Tauri commands**: `pnpm tauri <command>` for any Tauri CLI operations

The `pnpm tauri:dev` command starts both the Vite frontend development server AND the Tauri desktop application window. Using `pnpm run dev` only starts the web server without the native desktop functionality.

## Rationale

- Faster installation and better disk space efficiency
- Strict dependency resolution prevents phantom dependencies
- Project already has `pnpm-lock.yaml` indicating pnpm usage
- Consistency across development environment

## Implementation

When suggesting or executing package management commands, always use pnpm syntax. If a command needs to be executed, verify pnpm is available before proceeding.