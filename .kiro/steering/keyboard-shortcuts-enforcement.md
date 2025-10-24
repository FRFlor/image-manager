# Keyboard Shortcuts Configuration Enforcement

## CRITICAL RULE: Always Use Centralized Configuration

**NEVER implement keyboard shortcuts directly in components or other files.**

## Required Approach for ALL Keyboard Shortcuts

When the user requests to add, modify, or remove keyboard shortcuts:

### 1. ALWAYS Use the Configuration File
- **Primary file**: `src/config/keyboardShortcuts.ts`
- This is the SINGLE SOURCE OF TRUTH for all keyboard shortcuts
- ALL shortcuts must be defined in the `KEYBOARD_SHORTCUTS` array

### 2. Implementation Steps
1. **First**: Add/modify the shortcut in `src/config/keyboardShortcuts.ts`
2. **Second**: If needed, add the action handler in the component
3. **Never**: Write inline keyboard event handling code

### 3. Correct Pattern
```typescript
// ✅ CORRECT: Add to keyboardShortcuts.ts
{
  key: 'n',
  modifiers: { ctrl: true },
  action: 'newAction',
  description: 'Description of what this does'
}

// ✅ CORRECT: Use in component
const matchingShortcut = KEYBOARD_SHORTCUTS.find(shortcut => matchesShortcut(event, shortcut))
```

### 4. FORBIDDEN Patterns
```typescript
// ❌ FORBIDDEN: Direct keyboard handling
if (event.key === 'n' && event.ctrlKey) {
  // Don't do this!
}

// ❌ FORBIDDEN: Switch statements for keys
switch (event.key) {
  case 'n':
    // Don't do this!
}

// ❌ FORBIDDEN: Hardcoded key checks
event.key === 'Enter' && doSomething()
```

## Benefits of This Approach
- **Single source of truth**: All shortcuts in one place
- **Easy maintenance**: Change shortcuts without touching component code
- **Type safety**: TypeScript interfaces prevent errors
- **Documentation**: Each shortcut has a clear description
- **Consistency**: All shortcuts work the same way

## Files to Reference
- **Configuration**: `src/config/keyboardShortcuts.ts`
- **Utilities**: `src/utils/shortcutHelpers.ts`
- **Documentation**: `src/config/README.md`
- **Implementation**: `src/components/ImageViewer.vue` (handleKeyDown function)

## When User Requests Keyboard Shortcuts
1. Always mention using the centralized configuration
2. Show them the `keyboardShortcuts.ts` file
3. Add the shortcut to the configuration array
4. Ensure the action is handled in the component
5. Never implement shortcuts outside this system

**Remember: The goal is maintainable, centralized keyboard shortcut management!**