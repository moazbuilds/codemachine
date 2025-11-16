/** @jsxImportSource @opentui/solid */
import type { JSX } from "solid-js"
import { RGBA } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useTerminalDimensions } from "@opentui/solid"

export interface DialogWrapperProps {
  children: JSX.Element
}

export function DialogWrapper(props: DialogWrapperProps) {
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()

  // Full-screen backdrop with dark semi-transparent overlay (dimming effect)
  const backdropOverlay = RGBA.fromInts(0, 0, 0, 144) // ~56% opacity black overlay

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width={dimensions().width}
      height={dimensions().height}
      backgroundColor={backdropOverlay}
      alignItems="center"
      justifyContent="center"
      zIndex={2000}
    >
      <box
        width={Math.min(70, dimensions().width - 4)}
        backgroundColor={theme.background}
        borderColor={theme.border}
        border={["top", "bottom", "left", "right"]}
        borderStyle="rounded"
        padding={2}
      >
        {props.children}
      </box>
    </box>
  )
}
