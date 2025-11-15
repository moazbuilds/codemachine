/** @jsxImportSource solid-js */
import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"
import { useRenderer } from "@opentui/solid"
import { useToast } from "./toast"
import type { JSX } from "solid-js"

export const { use: useDialog, provider: DialogProvider } = createSimpleContext({
  name: "Dialog",
  init: () => {
    const [store, setStore] = createStore<{
      current: JSX.Element | null
    }>({
      current: null,
    })

    const renderer = useRenderer()
    const toast = useToast()

    return {
      get current() {
        return store.current
      },
      show(content: JSX.Element) {
        setStore("current", content)
      },
      close() {
        setStore("current", null)
      },
      /**
       * Handles interactive external commands by suspending the TUI,
       * running the command in a clean terminal, then resuming the TUI.
       *
       * This is critical for commands like `codex login` that need
       * full terminal control.
       */
      async handleInteractiveCommand(
        title: string,
        command: () => Promise<void>
      ): Promise<{ success: boolean; error?: Error }> {
        try {
          // Suspend TUI - release terminal control
          renderer.suspend()

          // Clear screen and show header
          console.clear()
          console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}\n`)

          // Run the external command
          await command()

          // Show completion message
          console.log(`\n✓ Complete!\nReturning to CodeMachine...\n`)
          await new Promise(resolve => setTimeout(resolve, 1000))

          // Resume TUI
          renderer.resume()

          return { success: true }
        } catch (error) {
          const err = error as Error
          console.error(`\n✗ Failed: ${err.message}\n`)
          await new Promise(resolve => setTimeout(resolve, 2000))

          // Always resume TUI even on error
          renderer.resume()

          // Show error toast
          toast.show({
            variant: "error",
            message: `Failed: ${err.message}`,
          })

          return { success: false, error: err }
        }
      },
    }
  },
})
