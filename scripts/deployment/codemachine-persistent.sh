#!/usr/bin/env bash
# Persistent launcher for CodeMachine on VPS/remote servers
# Survives SSH disconnections using nohup

set -e

CODEMACHINE_DIR="${CODEMACHINE_DIR:-$(pwd)}"
LOG_DIR="$CODEMACHINE_DIR/.codemachine/logs"
PID_FILE="$CODEMACHINE_DIR/.codemachine/codemachine.pid"

mkdir -p "$LOG_DIR"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          CodeMachine Persistent Launcher                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "⚠️  CodeMachine already running (PID: $OLD_PID)"
        echo ""
        echo "Use: $0 --force  to stop and restart"
        exit 1
    fi
    echo "🧹 Cleaning up stale PID file..."
    rm "$PID_FILE"
fi

# Force restart if requested
if [ "$1" = "--force" ]; then
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        echo "🛑 Stopping existing process (PID: $OLD_PID)..."
        kill -TERM "$OLD_PID" 2>/dev/null || true
        sleep 2
        kill -KILL "$OLD_PID" 2>/dev/null || true
        rm "$PID_FILE"
    fi
fi

cd "$CODEMACHINE_DIR" || exit 1

echo "📂 Working directory: $CODEMACHINE_DIR"
echo "📝 Logs: $LOG_DIR"
echo ""

# Launch with nohup (survives SSH disconnect)
nohup bash -c "
    echo \$\$ > '$PID_FILE'
    cd '$CODEMACHINE_DIR'
    exec codemachine start >> '$LOG_DIR/persistent-output.log' 2>> '$LOG_DIR/persistent-error.log'
" > /dev/null 2>&1 &

sleep 2

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ CodeMachine started successfully (PID: $PID)"
        echo ""
        echo "📊 Monitor with:"
        echo "   ./scripts/deployment/codemachine-status.sh"
        echo ""
        echo "📋 Watch logs:"
        echo "   tail -f $LOG_DIR/persistent-output.log"
        echo ""
        echo "🛑 Stop with:"
        echo "   ./scripts/deployment/codemachine-stop.sh"
    else
        echo "❌ Failed to start CodeMachine"
        exit 1
    fi
else
    echo "❌ Failed to create PID file"
    exit 1
fi
