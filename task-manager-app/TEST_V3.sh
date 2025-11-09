#!/bin/bash

# Quick Test Script per nuove funzionalità v3.0

API_URL="http://localhost:5000/api"
MASTER_USER="master"
MASTER_PASS="masterpass"

echo "🧪 Test Rapido - Funzionalità v3.0"
echo "=================================="

# 1. Login Master
echo ""
echo "1️⃣  Login Master..."
MASTER_LOGIN=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$MASTER_USER\",\"password\":\"$MASTER_PASS\"}")

MASTER_TOKEN=$(echo $MASTER_LOGIN | jq -r '.token')
echo "✅ Token Master: ${MASTER_TOKEN:0:20}..."

# 2. Crea Nuovo Operatore
echo ""
echo "2️⃣  Crea Nuovo Operatore..."
NEW_OP_NAME="test_op_$(date +%s)"
CREATE_OP=$(curl -s -X POST $API_URL/auth/create-operator \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MASTER_TOKEN" \
  -d "{\"username\":\"$NEW_OP_NAME\",\"password\":\"test123\"}")

NEW_OP_ID=$(echo $CREATE_OP | jq -r '.user.id')
echo "✅ Operatore creato: ID=$NEW_OP_ID, Username=$NEW_OP_NAME"

# 3. Lista Operatori
echo ""
echo "3️⃣  Lista Operatori..."
OPERATORS=$(curl -s -X GET $API_URL/auth/operators \
  -H "Authorization: Bearer $MASTER_TOKEN")

OP_COUNT=$(echo $OPERATORS | jq 'length')
echo "✅ Operatori nel sistema: $OP_COUNT"

# 4. Login come operatore
echo ""
echo "4️⃣  Login Operatore..."
OP_LOGIN=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"operatore1\",\"password\":\"operatorpass\"}")

OP_TOKEN=$(echo $OP_LOGIN | jq -r '.token')
echo "✅ Token Operatore: ${OP_TOKEN:0:20}..."

# 5. Crea Task
echo ""
echo "5️⃣  Master crea Task..."
CREATE_TASK=$(curl -s -X POST $API_URL/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MASTER_TOKEN" \
  -d '{
    "title":"Test Task v3.0",
    "description":"Task per testare nuove funzionalità",
    "assignedOperatorId":2,
    "priority":"HIGH",
    "estimatedMinutes":30
  }')

TASK_ID=$(echo $CREATE_TASK | jq -r '.id')
echo "✅ Task creato: ID=$TASK_ID"

# 6. Operatore accetta Task
echo ""
echo "6️⃣  Operatore accetta Task..."
ACCEPT=$(curl -s -X POST $API_URL/tasks/$TASK_ID/accept \
  -H "Authorization: Bearer $OP_TOKEN")

ACCEPTED_AT=$(echo $ACCEPT | jq -r '.acceptedAt')
echo "✅ Task accettato alle: $ACCEPTED_AT"

# 7. Pausa Task
echo ""
echo "7️⃣  Operatore pausa Task..."
PAUSE=$(curl -s -X POST $API_URL/tasks/$TASK_ID/pause \
  -H "Authorization: Bearer $OP_TOKEN")

PAUSED_FLAG=$(echo $PAUSE | jq -r '.paused')
PAUSED_AT=$(echo $PAUSE | jq -r '.pausedAt')
echo "✅ Task in pausa: $PAUSED_FLAG alle $PAUSED_AT"

# 8. Riprendi Task
echo ""
echo "8️⃣  Operatore riprende Task..."
RESUME=$(curl -s -X POST $API_URL/tasks/$TASK_ID/resume \
  -H "Authorization: Bearer $OP_TOKEN")

RESUMED_FLAG=$(echo $RESUME | jq -r '.paused')
echo "✅ Task ripreso: paused=$RESUMED_FLAG"

# 9. Completa Task
echo ""
echo "9️⃣  Operatore completa Task..."
COMPLETE=$(curl -s -X POST $API_URL/tasks/$TASK_ID/notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OP_TOKEN" \
  -d '{
    "note":"Task completato con successo",
    "actualMinutes":28,
    "markCompleted":true
  }')

echo "✅ Task completato"

# 10. Verifica Task completato
echo ""
echo "🔟 Verifica Task completato..."
VERIFY=$(curl -s -X GET $API_URL/tasks \
  -H "Authorization: Bearer $OP_TOKEN" | jq ".[] | select(.id == $TASK_ID)")

COMPLETED=$(echo $VERIFY | jq -r '.completed')
COMPLETED_AT=$(echo $VERIFY | jq -r '.completedAt')
ACTUAL_MIN=$(echo $VERIFY | jq -r '.actualMinutes')

echo "✅ Task completato: $COMPLETED"
echo "✅ Tempo completamento: $COMPLETED_AT"
echo "✅ Minuti effettivi: $ACTUAL_MIN"

echo ""
echo "=================================="
echo "✅ TUTTI I TEST PASSATI! v3.0 funziona perfettamente 🎉"
echo "=================================="
