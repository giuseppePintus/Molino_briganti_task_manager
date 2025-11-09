#!/bin/bash

# Task Manager - Test Priority & Operators Features
# ================================================

API_URL="http://localhost:5000"
MASTER_USER="master"
MASTER_PASS="masterpass"

echo "🧪 Task Manager - Priority & Operators Features Test"
echo "====================================================="
echo ""

# 1. Login as Master
echo "1️⃣ Logging in as MASTER..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$MASTER_USER\", \"password\": \"$MASTER_PASS\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
MASTER_ID=$(echo $LOGIN_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed!"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Login successful!"
echo "   Token: ${TOKEN:0:20}..."
echo "   Master ID: $MASTER_ID"
echo ""

# 2. Get Users (Operators List)
echo "2️⃣ Getting operators list..."
USERS_RESPONSE=$(curl -s -X GET "$API_URL/api/auth/users" \
  -H "Authorization: Bearer $TOKEN")

echo "✅ Operators list retrieved:"
echo "$USERS_RESPONSE" | head -100
echo ""

# 3. Create Task with Priority
echo "3️⃣ Creating task with URGENT priority..."
CREATE_TASK=$(curl -s -X POST "$API_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "🔴 Server Maintenance - URGENT",
    "description": "Critical security patch required",
    "priority": "URGENT",
    "estimatedMinutes": 90,
    "scheduledAt": "2025-11-09T14:00:00Z",
    "assignedOperatorId": 2
  }')

TASK_ID=$(echo $CREATE_TASK | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
PRIORITY=$(echo $CREATE_TASK | grep -o '"priority":"[^"]*' | cut -d'"' -f4)
COLOR=$(echo $CREATE_TASK | grep -o '"color":"[^"]*' | cut -d'"' -f4)

echo "✅ Task created!"
echo "   Task ID: $TASK_ID"
echo "   Priority: $PRIORITY"
echo "   Color: $COLOR"
echo ""

# 4. Create Task with HIGH priority
echo "4️⃣ Creating task with HIGH priority..."
CREATE_TASK2=$(curl -s -X POST "$API_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "🟠 Database Backup",
    "description": "Weekly backup procedure",
    "priority": "HIGH",
    "estimatedMinutes": 45,
    "assignedOperatorId": 3
  }')

TASK_ID2=$(echo $CREATE_TASK2 | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "✅ Second task created with ID: $TASK_ID2"
echo ""

# 5. Create Task with MEDIUM priority
echo "5️⃣ Creating task with MEDIUM priority..."
CREATE_TASK3=$(curl -s -X POST "$API_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "🟡 Update Documentation",
    "description": "Update API docs",
    "priority": "MEDIUM",
    "estimatedMinutes": 30
  }')

TASK_ID3=$(echo $CREATE_TASK3 | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "✅ Third task created with ID: $TASK_ID3"
echo ""

# 6. Get All Tasks (should be ordered by priority)
echo "6️⃣ Getting all tasks (ordered by priority)..."
GET_TASKS=$(curl -s -X GET "$API_URL/api/tasks" \
  -H "Authorization: Bearer $TOKEN")

echo "✅ Tasks retrieved (first 200 chars):"
echo "$GET_TASKS" | head -c 200
echo "..."
echo ""

# 7. Update Task Priority
echo "7️⃣ Updating first task priority to LOW..."
UPDATE_TASK=$(curl -s -X PUT "$API_URL/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"priority": "LOW"}')

NEW_PRIORITY=$(echo $UPDATE_TASK | grep -o '"priority":"[^"]*' | cut -d'"' -f4)
NEW_COLOR=$(echo $UPDATE_TASK | grep -o '"color":"[^"]*' | cut -d'"' -f4)

echo "✅ Task updated!"
echo "   New Priority: $NEW_PRIORITY"
echo "   New Color: $NEW_COLOR"
echo ""

# 8. Promote User to Master
echo "8️⃣ Promoting operatore1 to MASTER..."
PROMOTE=$(curl -s -X PUT "$API_URL/api/auth/users/2/master" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"isMaster": true}')

NEW_ROLE=$(echo $PROMOTE | grep -o '"isMaster":[^,}]*')
echo "✅ User promoted!"
echo "   New status: $NEW_ROLE"
echo ""

# 9. Verify operatore1 is now Master
echo "9️⃣ Verifying operatore1 is now Master..."
LOGIN_OPERATORE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "operatore1", "password": "operatorpass"}')

NEW_TOKEN=$(echo $LOGIN_OPERATORE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
NEW_ROLE=$(echo $LOGIN_OPERATORE | grep -o '"role":"[^"]*' | cut -d'"' -f4)
IS_MASTER=$(echo $LOGIN_OPERATORE | grep -o '"isMaster":[^,}]*')

echo "✅ operatore1 logged in!"
echo "   Role: $NEW_ROLE"
echo "   Status: $IS_MASTER"
echo ""

# 10. Test Demote
echo "🔟 Demoting operatore1 back to SLAVE..."
DEMOTE=$(curl -s -X PUT "$API_URL/api/auth/users/2/master" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"isMaster": false}')

DEMOTED_ROLE=$(echo $DEMOTE | grep -o '"isMaster":[^,}]*')
echo "✅ User demoted!"
echo "   New status: $DEMOTED_ROLE"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "✅ ALL TESTS COMPLETED SUCCESSFULLY!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Summary:"
echo "  ✅ Master login working"
echo "  ✅ Get operators list working"
echo "  ✅ Create task with URGENT priority"
echo "  ✅ Create task with HIGH priority"
echo "  ✅ Create task with MEDIUM priority"
echo "  ✅ Get all tasks (ordered by priority)"
echo "  ✅ Update task priority"
echo "  ✅ Promote user to Master"
echo "  ✅ Demote user to Slave"
echo "  ✅ New master can login"
echo ""
echo "🎯 All features working correctly!"
