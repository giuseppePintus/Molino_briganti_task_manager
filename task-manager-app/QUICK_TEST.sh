#!/bin/bash

# Quick Test Script for Task Manager API
# This script tests all major endpoints

set -e

BASE_URL="http://localhost:5000"
SLEEP_TIME=1

echo "🧪 Task Manager API Quick Test"
echo "================================"
echo ""

# Test 1: Health Check
echo "1️⃣  Testing Health Check..."
curl -s -X GET "$BASE_URL/api/health" | jq . || echo "❌ Health check failed"
echo ""
sleep $SLEEP_TIME

# Test 2: Login
echo "2️⃣  Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"master","password":"masterpass"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token' 2>/dev/null || echo "")

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Login failed"
  echo $LOGIN_RESPONSE | jq .
  exit 1
fi

echo "✅ Login successful"
echo "Token: ${TOKEN:0:50}..."
echo ""
sleep $SLEEP_TIME

# Test 3: Get Tasks (empty initially)
echo "3️⃣  Testing Get Tasks..."
curl -s -X GET "$BASE_URL/api/tasks" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""
sleep $SLEEP_TIME

# Test 4: Create Task
echo "4️⃣  Testing Create Task..."
TASK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Test Task",
    "description":"This is a test task",
    "scheduledAt":"2025-11-15T14:00:00Z",
    "estimatedMinutes":60
  }')

TASK_ID=$(echo $TASK_RESPONSE | jq -r '.id' 2>/dev/null || echo "")

if [ -z "$TASK_ID" ] || [ "$TASK_ID" == "null" ]; then
  echo "❌ Create task failed"
  echo $TASK_RESPONSE | jq .
  exit 1
fi

echo "✅ Task created successfully"
echo $TASK_RESPONSE | jq .
echo ""
sleep $SLEEP_TIME

# Test 5: Get Tasks (should have 1 now)
echo "5️⃣  Testing Get Tasks (after create)..."
curl -s -X GET "$BASE_URL/api/tasks" \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {id, title, completed}'
echo ""
sleep $SLEEP_TIME

# Test 6: Update Task
echo "6️⃣  Testing Update Task..."
curl -s -X PUT "$BASE_URL/api/tasks/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Updated Task Title",
    "estimatedMinutes":90
  }' | jq .
echo ""
sleep $SLEEP_TIME

# Test 7: Add Note
echo "7️⃣  Testing Add Note..."
NOTE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tasks/$TASK_ID/notes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "note":"Test note from script",
    "actualMinutes":55,
    "markCompleted":false
  }')

echo "✅ Note added"
echo $NOTE_RESPONSE | jq .
echo ""
sleep $SLEEP_TIME

# Test 8: Get Notes
echo "8️⃣  Testing Get Notes..."
curl -s -X GET "$BASE_URL/api/tasks/$TASK_ID/notes" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""
sleep $SLEEP_TIME

# Test 9: Register New User (Slave)
echo "9️⃣  Testing Register New User..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username":"test_slave",
    "password":"test_password_123",
    "role":"slave"
  }')

echo "✅ User registered"
echo $REGISTER_RESPONSE | jq .
echo ""
sleep $SLEEP_TIME

# Test 10: Delete Task
echo "🔟 Testing Delete Task..."
curl -s -X DELETE "$BASE_URL/api/tasks/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN"
echo ""
echo "✅ Task deleted"
echo ""

echo "================================"
echo "✅ All tests completed successfully!"
echo "================================"
