import { readonly, ref } from 'vue'

export type ShortcutContext = 'default' | 'image-pan'

const context = ref<ShortcutContext>('default')

export function useShortcutContext() {
  const setShortcutContext = (value: ShortcutContext) => {
    context.value = value
  }

  const resetShortcutContext = () => {
    context.value = 'default'
  }

  return {
    shortcutContext: readonly(context),
    setShortcutContext,
    resetShortcutContext
  }
}
