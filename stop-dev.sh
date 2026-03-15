#!/bin/bash
# NEXUS Dev — Stop all dev processes
echo "Stopping NEXUS dev..."
lsof -i :5000 -t 2>/dev/null | xargs kill -9 2>/dev/null && echo "Backend (5000) stopped" || echo "Backend not running"
lsof -i :3001 -t 2>/dev/null | xargs kill -9 2>/dev/null && echo "Frontend (3001) stopped" || echo "Frontend not running"
echo "Done."
