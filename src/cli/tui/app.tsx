/** @jsxImportSource @opentui/solid */
import { render, useTerminalDimensions, useKeyboard, useRenderer } from "@opentui/solid"
import { VignetteEffect, applyScanlines } from "@opentui/core"
import { ErrorBoundary, createSignal } from "solid-js"
import { KVProvider } from "@tui/context/kv"
import { ToastProvider } from "@tui/context/toast"
import { ThemeProvider, useTheme } from "@tui/context/theme"
import { DialogProvider } from "@tui/context/dialog"
import { SessionProvider } from "@tui/context/session"
import { Home } from "@tui/routes/home"

/**
 * Detects terminal background color by querying with OSC 11 escape sequence
 * Returns "dark" or "light" based on luminance calculation
 */
async function getTerminalBackgroundColor(): Promise<"dark" | "light"> {
  // Can't set raw mode if not a TTY
  if (!process.stdin.isTTY) return "dark"

  return new Promise((resolve) => {
    let timeout: NodeJS.Timeout

    const cleanup = () => {
      process.stdin.setRawMode(false)
      process.stdin.removeListener("data", handler)
      clearTimeout(timeout)
      // Pause stdin to drain any buffered input before OpenTUI takes over
      process.stdin.pause()
    }

    const handler = (data: Buffer) => {
      const str = data.toString()
      const match = str.match(/\x1b]11;([^\x07\x1b]+)/)
      if (match) {
        cleanup()
        const color = match[1]
        // Parse RGB values from color string
        // Formats: rgb:RR/GG/BB or #RRGGBB or rgb(R,G,B)
        let r = 0,
          g = 0,
          b = 0

        if (color.startsWith("rgb:")) {
          const parts = color.substring(4).split("/")
          r = parseInt(parts[0], 16) >> 8 // Convert 16-bit to 8-bit
          g = parseInt(parts[1], 16) >> 8
          b = parseInt(parts[2], 16) >> 8
        } else if (color.startsWith("#")) {
          r = parseInt(color.substring(1, 3), 16)
          g = parseInt(color.substring(3, 5), 16)
          b = parseInt(color.substring(5, 7), 16)
        } else if (color.startsWith("rgb(")) {
          const parts = color.substring(4, color.length - 1).split(",")
          r = parseInt(parts[0])
          g = parseInt(parts[1])
          b = parseInt(parts[2])
        }

        // Calculate luminance using relative luminance formula
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

        // Determine if dark or light based on luminance threshold
        resolve(luminance > 0.5 ? "light" : "dark")
      }
    }

    process.stdin.setRawMode(true)
    process.stdin.on("data", handler)
    process.stdout.write("\x1b]11;?\x07")

    timeout = setTimeout(() => {
      cleanup()
      resolve("dark") // Default to dark if no response
    }, 1000)
  })
}

/**
 * Main TUI entry point
 * Detects terminal background and launches OpenTUI renderer
 */
export async function startTUI(): Promise<void> {
  return new Promise<void>(async (resolve) => {
    const mode = await getTerminalBackgroundColor()

    // Wait for stdin to settle after background detection
    // This prevents focus/mouse events from leaking through before OpenTUI's filters are active
    await new Promise((r) => setTimeout(r, 100))

    // Create vignette effect with refined, subtle strength
    const vignetteEffect = new VignetteEffect(0.35)

    render(
      () => <Root mode={mode} onExit={resolve} />,
      {
        targetFps: 60,
        gatherStats: false,
        exitOnCtrlC: false,
        useKittyKeyboard: true,
        useMouse: false, // Disable mouse tracking to prevent escape sequences
        postProcessFns: [
          // Apply vignette for professional focus on center
          (buffer) => vignetteEffect.apply(buffer),
          // Apply subtle scanlines for refined CRT aesthetic
          (buffer) => applyScanlines(buffer, 0.92, 2), // Very subtle (8% darkening) every 2nd line
        ],
      }
    )
  })
}

/**
 * Root component with all providers
 */
function Root(props: { mode: "dark" | "light"; onExit: () => void }) {
  return (
    <ErrorBoundary fallback={(error) => <ErrorComponent error={error} onExit={props.onExit} />}>
      <KVProvider>
        <ToastProvider>
          <ThemeProvider mode={props.mode}>
            <DialogProvider>
              <SessionProvider>
                <App />
              </SessionProvider>
            </DialogProvider>
          </ThemeProvider>
        </ToastProvider>
      </KVProvider>
    </ErrorBoundary>
  )
}

/**
 * Main App component - wraps Home with full-screen background
 */
function App() {
  const dimensions = useTerminalDimensions()
  const { theme } = useTheme()
  const renderer = useRenderer()

  // Global Ctrl+C handler to exit gracefully
  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === "c") {
      evt.preventDefault()
      renderer.destroy()
      process.exit(0)
    }
  })

  return (
    <box width={dimensions().width} height={dimensions().height} backgroundColor={theme.background}>
      <Home />
    </box>
  )
}

/**
 * Error boundary fallback component
 */
function ErrorComponent(props: { error: Error; onExit: () => void }) {
  const term = useTerminalDimensions()
  const [copied, setCopied] = createSignal(false)

  const copyError = () => {
    const errorText = `CodeMachine Error:\n\n${props.error.stack || props.error.message}`
    // Use Bun's clipboard if available, otherwise just set copied state
    try {
      if (typeof navigator !== "undefined" && "clipboard" in navigator) {
        navigator.clipboard.writeText(errorText).then(() => setCopied(true))
      } else {
        setCopied(true)
      }
    } catch {
      setCopied(true)
    }
  }

  return (
    <box flexDirection="column" gap={1} padding={2}>
      <box flexDirection="row" gap={2} alignItems="center">
        <text attributes={1}>Fatal Error Occurred</text>
        <box onMouseUp={copyError} backgroundColor="#565f89" padding={1}>
          <text attributes={1}>Copy Error</text>
        </box>
        {copied() && <text>✓ Copied</text>}
      </box>
      <box flexDirection="row" gap={2}>
        <text>Press Ctrl+C to exit</text>
        <box onMouseUp={props.onExit} backgroundColor="#565f89" padding={1}>
          <text>Exit Now</text>
        </box>
      </box>
      <box height={1} />
      <scrollbox height={Math.floor(term().height * 0.7)}>
        <text>{props.error.stack || props.error.message}</text>
      </scrollbox>
    </box>
  )
}
