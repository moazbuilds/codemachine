/** @jsxImportSource @opentui/solid */
import type { JSX } from "solid-js"
import { RGBA } from "@opentui/core"
import { useTheme } from "@tui/context/theme"

export interface DialogWrapperProps {
  children: JSX.Element
}

export function DialogWrapper(props: DialogWrapperProps) {
  const { theme } = useTheme()

  // Create semi-transparent background (85% opacity)
  const transparentBg = RGBA.fromValues(
    theme.backgroundPanel.r,
    theme.backgroundPanel.g,
    theme.backgroundPanel.b,
    0.85
  )

  return (
    <box
      position="absolute"
      left={10}
      right={10}
      top={5}
      bottom={5}
      backgroundColor={transparentBg}
      borderColor={theme.border}
      border={["top", "bottom", "left", "right"]}
      padding={2}
      zIndex={2000}
    >
      {props.children}
    </box>
  )
}
