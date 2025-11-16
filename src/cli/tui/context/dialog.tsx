/** @jsxImportSource @opentui/solid */
import { Show, createContext, useContext, type JSX, type ParentProps, getOwner, runWithOwner } from "solid-js"
import { createStore } from "solid-js/store"
import { useRenderer } from "@opentui/solid"
import { useToast } from "./toast"
import { DialogWrapper } from "@tui/ui/dialog-wrapper"

type DialogContent = (() => JSX.Element) | JSX.Element

type DialogContextValue = {
  readonly current: DialogContent | null
  show(content: () => JSX.Element): void
  close(): void
  handleInteractiveCommand(
    title: string,
    command: () => Promise<void>
  ): Promise<{ success: boolean; error?: Error }>
}

const DialogContext = createContext<DialogContextValue>()

export function DialogProvider(props: ParentProps) {
  const [store, setStore] = createStore<{ current: DialogContent | null }>({
    current: null,
  })
  const renderer = useRenderer()
  const toast = useToast()

  // Capture the provider's reactive owner
  const owner = getOwner()

  const value: DialogContextValue = {
    get current() {
      return store.current
    },
    show(content) {
      // Execute content function in provider's owner context
      const element = owner ? runWithOwner(owner, content) : content()
      setStore("current", element)
    },
    close() {
      setStore("current", null)
    },
    async handleInteractiveCommand(title, command) {
      try {
        renderer.suspend()
        console.clear()
        console.log(`\n${"═".repeat(60)}\n  ${title}\n${"═".repeat(60)}\n`)
        await command()
        console.log(`\n✓ Complete!\nReturning to CodeMachine...\n`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
        renderer.resume()
        return { success: true }
      } catch (error) {
        const err = error as Error
        console.error(`\n✗ Failed: ${err.message}\n`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
        renderer.resume()
        toast.show({
          variant: "error",
          message: `Failed: ${err.message}`,
        })
        return { success: false, error: err }
      }
    },
  }

  return (
    <DialogContext.Provider value={value}>
      {props.children}
      <Show when={store.current}>
        <DialogWrapper>{store.current as JSX.Element}</DialogWrapper>
      </Show>
    </DialogContext.Provider>
  )
}

export function useDialog() {
  const value = useContext(DialogContext)
  if (!value) {
    throw new Error("Dialog context must be used within a context provider")
  }
  return value
}
