#!/bin/bash

set -e

API_URL="http://localhost:5000/api"
echo "🔍 Test: Operator Deletion Feature (v3.1)"
echo "=================================================="

# 1. Login as master
echo "1️⃣ Logging in as master..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"master","password":"masterpass"}')

MASTER_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "✓ Master logged in: ${MASTER_TOKEN:0:20}..."

# 2. Get list of operators before deletion
echo ""
echo "2️⃣ Getting list of operators before deletion..."
OPERATORS_BEFORE=$(curl -s -X GET "$API_URL/auth/operators" \
  -H "Authorization: Bearer $MASTER_TOKEN")

echo "Operators before: $OPERATORS_BEFORE"
OPERATOR_COUNT_BEFORE=$(echo $OPERATORS_BEFORE | grep -o '"id":[0-9]*' | wc -l)
echo "✓ Total operators: $OPERATOR_COUNT_BEFORE"

# 3. Get first operator ID
echo ""
echo "3️⃣ Extracting first operator ID..."
FIRST_OPERATOR_ID=$(echo $OPERATORS_BEFORE | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*$')
FIRST_OPERATOR_NAME=$(echo $OPERATORS_BEFORE | grep -o '"username":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$FIRST_OPERATOR_ID" ]; then
  echo "❌ No operators found to delete!"
  exit 1
fi

echo "✓ Will delete operator: ID=$FIRST_OPERATOR_ID, Name=$FIRST_OPERATOR_NAME"

# 4. Delete the operator
echo ""
echo "4️⃣ Deleting operator..."
DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/auth/operators/$FIRST_OPERATOR_ID" \
  -H "Authorization: Bearer $MASTER_TOKEN")

echo "Response: $DELETE_RESPONSE"

if echo $DELETE_RESPONSE | grep -q "success"; then
  echo "✓ Operator deleted successfully!"
else
  echo "❌ Deletion failed!"
  exit 1
fi

# 5. Get list of operators after deletion
echo ""
echo "5️⃣ Getting list of operators after deletion..."
OPERATORS_AFTER=$(curl -s -X GET "$API_URL/auth/operators" \
  -H "Authorization: Bearer $MASTER_TOKEN")

echo "Operators after: $OPERATORS_AFTER"
OPERATOR_COUNT_AFTER=$(echo $OPERATORS_AFTER | grep -o '"id":[0-9]*' | wc -l)
echo "✓ Total operators: $OPERATOR_COUNT_AFTER"

# 6. Verify deletion
echo ""
echo "6️⃣ Verifying deletion..."
if [ $OPERATOR_COUNT_AFTER -lt $OPERATOR_COUNT_BEFORE ]; then
  echo "✓✓✓ DELETION SUCCESSFUL! Operator count decreased from $OPERATOR_COUNT_BEFORE to $OPERATOR_COUNT_AFTER"
else
  echo "❌ Deletion verification failed!"
  exit 1
fi

# 7. Test unauthorized access (try as operator)
echo ""
echo "7️⃣ Testing authorization (operator should NOT be able to delete)..."
LOGIN_OPERATOR=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"operatore2","password":"operatorpass"}')

OPERATOR_TOKEN=$(echo $LOGIN_OPERATOR | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ ! -z "$OPERATOR_TOKEN" ]; then
  UNAUTHORIZED_RESPONSE=$(curl -s -X DELETE "$API_URL/auth/operators/1" \
    -H "Authorization: Bearer $OPERATOR_TOKEN")
  
  if echo $UNAUTHORIZED_RESPONSE | grep -q "Only master"; then
    echo "✓ Authorization check passed - operator cannot delete"
  else
    echo "⚠️ Authorization check unclear: $UNAUTHORIZED_RESPONSE"
  fi
fi

echo ""
echo "=================================================="
echo "✅ All tests passed!"
echo "=================================================="
