#!/bin/bash

# CLI screenshot script for WSL2
# Usage: ./screenshot.sh [output_filename]

# Default output filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT="${1:-screenshot_${TIMESTAMP}.png}"

# Convert WSL path to Windows path for output
WIN_OUTPUT=$(wslpath -w "$(pwd)/$OUTPUT")

# Check if we're in WSL
if grep -qi microsoft /proc/version; then
    echo "Taking screenshot using Windows..."

    # Use PowerShell to take screenshot
    /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "
    Add-Type -AssemblyName System.Windows.Forms,System.Drawing;
    \$screen = [System.Windows.Forms.Screen]::PrimaryScreen;
    \$bounds = \$screen.Bounds;
    \$bmp = New-Object System.Drawing.Bitmap \$bounds.Width, \$bounds.Height;
    \$graphics = [System.Drawing.Graphics]::FromImage(\$bmp);
    \$graphics.CopyFromScreen(\$bounds.Location, [System.Drawing.Point]::Empty, \$bounds.Size);
    \$bmp.Save('$WIN_OUTPUT', [System.Drawing.Imaging.ImageFormat]::Png);
    \$graphics.Dispose();
    \$bmp.Dispose();
    "

    if [ $? -eq 0 ]; then
        echo "Screenshot saved to: $OUTPUT"
    else
        echo "Error: Failed to take screenshot"
        exit 1
    fi
else
    # Fallback to Linux screenshot tools
    if command -v gnome-screenshot &> /dev/null; then
        gnome-screenshot -f "$OUTPUT"
        echo "Screenshot saved to: $OUTPUT"
    elif command -v scrot &> /dev/null; then
        scrot "$OUTPUT"
        echo "Screenshot saved to: $OUTPUT"
    elif command -v import &> /dev/null; then
        import -window root "$OUTPUT"
        echo "Screenshot saved to: $OUTPUT"
    else
        echo "Error: No screenshot tool found."
        exit 1
    fi
fi
