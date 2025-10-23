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

## Rationale

- Faster installation and better disk space efficiency
- Strict dependency resolution prevents phantom dependencies
- Project already has `pnpm-lock.yaml` indicating pnpm usage
- Consistency across development environment

## Implementation

When suggesting or executing package management commands, always use pnpm syntax. If a command needs to be executed, verify pnpm is available before proceeding.