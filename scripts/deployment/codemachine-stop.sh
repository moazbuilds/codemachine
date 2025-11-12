#!/usr/bin/env bash
# Graceful shutdown for CodeMachine

set -e

CODEMACHINE_DIR="${CODEMACHINE_DIR:-$(pwd)}"
PID_FILE="$CODEMACHINE_DIR/.codemachine/codemachine.pid"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          CodeMachine Shutdown                                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ ! -f "$PID_FILE" ]; then
    echo "⚠️  CodeMachine not running (no PID file)"
    exit 0
fi

PID=$(cat "$PID_FILE")

if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "⚠️  CodeMachine not running (stale PID)"
    rm "$PID_FILE"
    exit 0
fi

echo "🛑 Stopping CodeMachine (PID: $PID)..."

# Try graceful shutdown first
kill -TERM "$PID" 2>/dev/null || true

# Wait up to 10 seconds
for i in {1..10}; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ CodeMachine stopped gracefully"
        rm "$PID_FILE"
        exit 0
    fi
    sleep 1
done

# Force kill if needed
echo "⚠️  Graceful shutdown timeout, forcing..."
kill -KILL "$PID" 2>/dev/null || true
rm "$PID_FILE"
echo "✅ CodeMachine killed"
