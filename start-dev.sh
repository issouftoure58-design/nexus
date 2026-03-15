#!/bin/bash
# NEXUS Dev — Kill stale processes + restart backend & frontend
# Usage: ./start-dev.sh [backend|frontend|all]

MODE="${1:-all}"
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

kill_port() {
  local port=$1
  local pids=$(lsof -i :$port -t 2>/dev/null)
  if [ -n "$pids" ]; then
    echo -e "${RED}Killing stale process on port $port (PID: $pids)${NC}"
    echo "$pids" | xargs kill -9 2>/dev/null
    sleep 1
  fi
}

if [ "$MODE" = "backend" ] || [ "$MODE" = "all" ]; then
  echo -e "${CYAN}=== Backend ===${NC}"
  kill_port 5000
  cd /Users/hobb/Documents/Nexus/nexus/backend
  node --watch src/index.js &
  sleep 3
  if lsof -i :5000 -t >/dev/null 2>&1; then
    echo -e "${GREEN}Backend OK → http://localhost:5000${NC}"
  else
    echo -e "${RED}Backend FAILED${NC}"
  fi
fi

if [ "$MODE" = "frontend" ] || [ "$MODE" = "all" ]; then
  echo -e "${CYAN}=== Frontend admin-ui ===${NC}"
  kill_port 3001
  cd /Users/hobb/Documents/Nexus/nexus/admin-ui
  npx vite &
  sleep 3
  if lsof -i :3001 -t >/dev/null 2>&1; then
    echo -e "${GREEN}Frontend OK → http://localhost:3001${NC}"
  else
    echo -e "${RED}Frontend FAILED${NC}"
  fi
fi

echo ""
echo -e "${GREEN}=== NEXUS Dev Ready ===${NC}"
echo "  Backend:  http://localhost:5000"
echo "  Frontend: http://localhost:3001"
