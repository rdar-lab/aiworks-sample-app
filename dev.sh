#!/bin/bash
set -e

cleanup() {
    # Kill each server's process group (leader + all children) cleanly.

    for sig in TERM KILL; do

        [ -n "$BACKEND_PG" ] && kill -"$sig" -"$BACKEND_PG" 2>/dev/null || true
        [ -n "$FRONTEND_PG" ] && kill -"$sig" -"$FRONTEND_PG" 2>/dev/null || true
        [ "$sig" = TERM ] && sleep 2
    done
}

trap cleanup EXIT

echo "Starting backend (Django)..."
cd backend
source venv/bin/activate
setsid python manage.py runserver &
BACKEND_PG=$!
cd ..

echo "Starting frontend (Vite)..."
cd frontend
npm ci
setsid npm run dev &
FRONTEND_PG=$!
cd ..

echo ""
echo "Backend process group: $BACKEND_PG"
echo "Frontend process group: $FRONTEND_PG"
echo ""
echo "Press Ctrl+C to stop both servers"

wait
