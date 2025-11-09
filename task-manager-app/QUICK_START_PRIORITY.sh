#!/bin/bash
# 🚀 QUICK START - Task Manager con Priority & Operators

echo "🎯 Task Manager - Quick Start Guide"
echo "===================================="
echo ""

# 1. Check Node.js
echo "1️⃣ Checking Node.js..."
NODE_VERSION=$(node -v)
echo "✅ Node.js version: $NODE_VERSION"
echo ""

# 2. Install dependencies
echo "2️⃣ Installing dependencies (if needed)..."
if [ ! -d "node_modules" ]; then
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi
echo ""

# 3. Build TypeScript
echo "3️⃣ Building TypeScript..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi
echo ""

# 4. Setup Prisma
echo "4️⃣ Setting up Prisma..."
export DATABASE_URL="file:./server/prisma/data/tasks.db"
npx prisma generate --schema ./server/prisma/schema.prisma
echo "✅ Prisma setup complete"
echo ""

# 5. Start server
echo "5️⃣ Starting server..."
npm start &
SERVER_PID=$!
echo "✅ Server started (PID: $SERVER_PID)"
echo ""

# 6. Wait for server to start
echo "6️⃣ Waiting for server to initialize..."
sleep 3

# 7. Test connection
echo "7️⃣ Testing connection..."
RESPONSE=$(curl -s http://localhost:5000/api/health)
if echo "$RESPONSE" | grep -q "ok"; then
    echo "✅ Server is running!"
else
    echo "⚠️  Server might still be starting..."
fi
echo ""

# 8. Show access info
echo "════════════════════════════════════════════"
echo "🎉 Task Manager Ready!"
echo "════════════════════════════════════════════"
echo ""
echo "🌐 Web UI: http://localhost:5000"
echo ""
echo "📝 Demo Credentials:"
echo "   Username: master"
echo "   Password: masterpass"
echo ""
echo "📋 Additional Users:"
echo "   Username: operatore1 / operatore2 / operatore3"
echo "   Password: operatorpass"
echo ""
echo "🎯 Features:"
echo "   ✅ Priority Levels (LOW, MEDIUM, HIGH, URGENT)"
echo "   ✅ Operators Management (Master)"
echo "   ✅ Task CRUD Operations"
echo "   ✅ Real-time Statistics"
echo ""
echo "📚 Documentation:"
echo "   - PRIORITY_OPERATORS_FEATURES.md"
echo "   - API_DOCUMENTATION.md"
echo "   - README.md"
echo ""
echo "🧪 Run Tests:"
echo "   ./TEST_PRIORITY_OPERATORS.sh"
echo ""
echo "⏹️  To stop the server: kill $SERVER_PID"
echo "════════════════════════════════════════════"
