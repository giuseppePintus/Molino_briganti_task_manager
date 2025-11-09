#!/bin/bash

# Quick Start Script for Task Manager App
# Usage: ./start.sh [dev|prod|build|seed]

set -e

APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$APP_DIR"

case "${1:-prod}" in
  dev)
    echo "🚀 Starting development server..."
    npm run dev
    ;;
  prod)
    echo "🏗️  Building project..."
    npm run build
    echo "🚀 Starting production server..."
    npm start
    ;;
  build)
    echo "🏗️  Building project..."
    npm run build
    echo "✅ Build complete!"
    ;;
  seed)
    echo "🌱 Seeding database..."
    npm run prisma:seed
    echo "✅ Database seeded!"
    ;;
  stop)
    echo "🛑 Stopping server..."
    pkill -f "node server/dist/index.js" || true
    echo "✅ Server stopped!"
    ;;
  *)
    echo "Usage: $0 [dev|prod|build|seed|stop]"
    echo ""
    echo "Commands:"
    echo "  dev   - Start development server (auto-reload)"
    echo "  prod  - Build and start production server"
    echo "  build - Compile TypeScript only"
    echo "  seed  - Initialize database"
    echo "  stop  - Stop server"
    exit 1
    ;;
esac
