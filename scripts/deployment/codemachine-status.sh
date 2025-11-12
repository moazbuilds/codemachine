#!/usr/bin/env bash
# Enhanced status monitoring for CodeMachine

CODEMACHINE_DIR="${CODEMACHINE_DIR:-$(pwd)}"
PID_FILE="$CODEMACHINE_DIR/.codemachine/codemachine.pid"
LOG_DIR="$CODEMACHINE_DIR/.codemachine/logs"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          CodeMachine Status Monitor                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check PID file
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ Process: RUNNING (PID: $PID)"
        ps -p "$PID" -o pid,ppid,etime,cmd --no-headers | sed 's/^/   /'
        echo ""
    else
        echo "❌ Process: NOT RUNNING (stale PID: $PID)"
        rm -f "$PID_FILE"
        exit 1
    fi
else
    echo "❌ Process: NOT RUNNING (no PID file)"

    # Check for orphaned processes
    PIDS=$(pgrep -f "codemachine start" 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "⚠️  Found orphaned processes: $PIDS"
    fi
    exit 1
fi

# Show current agent status
if [ -f "$LOG_DIR/registry.json" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Agent Status"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Show running agents
    RUNNING=$(jq -r 'to_entries[] | select(.value.status == "running") | "   🔄 \(.value.id): \(.value.name)"' "$LOG_DIR/registry.json" 2>/dev/null)
    if [ -n "$RUNNING" ]; then
        echo "$RUNNING"
    fi

    # Show last 5 completed agents
    COMPLETED=$(jq -r 'to_entries | sort_by(.value.id) | .[-5:] | .[] | select(.value.status == "completed") | "   ✅ \(.value.id): \(.value.name)"' "$LOG_DIR/registry.json" 2>/dev/null)
    if [ -n "$COMPLETED" ]; then
        echo "$COMPLETED"
    fi

    # Show failed agents
    FAILED=$(jq -r 'to_entries[] | select(.value.status == "failed") | "   ❌ \(.value.id): \(.value.name) - \(.value.error)"' "$LOG_DIR/registry.json" 2>/dev/null)
    if [ -n "$FAILED" ]; then
        echo "$FAILED"
    fi

    echo ""
fi

# Show recently updated log files
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Recently Updated Files (last 5)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -lht "$LOG_DIR"/*.log "$LOG_DIR"/registry.json 2>/dev/null | head -6 | tail -5 | awk '{printf "   %s %s %s: %s\n", $6, $7, $8, $9}'
echo ""

# Show last 10 lines from persistent-output.log
if [ -f "$LOG_DIR/persistent-output.log" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 Last 10 Lines: persistent-output.log"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    tail -10 "$LOG_DIR/persistent-output.log" | sed 's/^/   /'
    echo ""
fi

# Show error log if has content
if [ -f "$LOG_DIR/persistent-error.log" ] && [ -s "$LOG_DIR/persistent-error.log" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  Errors (last 5 lines)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    tail -5 "$LOG_DIR/persistent-error.log" | sed 's/^/   /'
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Quick Commands"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Start:      ./scripts/deployment/codemachine-persistent.sh"
echo "   Stop:       ./scripts/deployment/codemachine-stop.sh"
echo "   Watch logs: tail -f $LOG_DIR/persistent-output.log"
echo "   Errors:     tail -f $LOG_DIR/persistent-error.log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
