#!/bin/bash
cd /c/Users/Administrator/CascadeProjects/tese
# Clean the Vite cache
rm -rf node_modules/.vite 2>/dev/null
# Start Vite and capture stderr
npx vite --host 127.0.0.1 --port 5173 2>/tmp/vite_err.txt &
VITE_PID=$!
sleep 6
# Check if Vite is running
if kill -0 $VITE_PID 2>/dev/null; then
    echo "VITE_RUNNING_PID=$VITE_PID"
    # Check response
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/)
    echo "HTTP_CODE=$HTTP_CODE"
    # Check DataPanel
    DP_SIZE=$(curl -s "http://127.0.0.1:5173/src/ui/DataPanel.tsx" | wc -c)
    echo "DP_SIZE=$DP_SIZE"
    # Check errors
    echo "STDERR:"
    cat /tmp/vite_err.txt 2>/dev/null
else
    echo "VITE_DIED"
    echo "STDERR:"
    cat /tmp/vite_err.txt 2>/dev/null
fi
