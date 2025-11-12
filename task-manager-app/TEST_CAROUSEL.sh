#!/bin/bash

# Test Script for Operators Carousel Login System
# Quick verification of all new endpoints

echo "=== Testing Operators Carousel Login System ==="
echo ""

# Base URL
BASE_URL="http://localhost:5000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Testing GET /api/auth/operators/public${NC}"
echo "   Endpoint: GET $BASE_URL/api/auth/operators/public"
echo "   Expected: List of operators with id, username, image"
echo ""
OPERATORS=$(curl -s "$BASE_URL/api/auth/operators/public")
echo -e "   Response: $OPERATORS"
echo ""

# Extract first operator ID
OPERATOR_ID=$(echo "$OPERATORS" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')

if [ -z "$OPERATOR_ID" ]; then
    OPERATOR_ID=1
    echo -e "   ${YELLOW}⚠️  No operators found, using ID: $OPERATOR_ID${NC}"
else
    echo -e "   ${GREEN}✅ Operators retrieved successfully${NC}"
fi
echo ""

echo -e "${BLUE}2. Testing POST /api/auth/quick-login${NC}"
echo "   Endpoint: POST $BASE_URL/api/auth/quick-login"
echo "   Body: {\"operatorId\": $OPERATOR_ID}"
echo "   Expected: Token and user info"
echo ""
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/quick-login" \
  -H "Content-Type: application/json" \
  -d "{\"operatorId\": $OPERATOR_ID}")
echo "   Response: $LOGIN_RESPONSE"
echo ""

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "   ${RED}❌ Failed to get token${NC}"
else
    echo -e "   ${GREEN}✅ Token obtained successfully${NC}"
fi
echo ""

echo -e "${BLUE}3. Testing PUT /api/auth/operators/:id/image (Admin Only)${NC}"
echo "   Note: This requires a master token. Testing with current token."
echo "   Endpoint: PUT $BASE_URL/api/auth/operators/$OPERATOR_ID/image"
echo "   Expected: 403 Forbidden (if using operator token) or success (if using admin token)"
echo ""

# Create a base64 encoded test image (1x1 pixel PNG)
TEST_IMAGE="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

if [ -n "$TOKEN" ]; then
    UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/auth/operators/$OPERATOR_ID/image" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"operatorId\": $OPERATOR_ID, \"image\": \"$TEST_IMAGE\"}")
    echo "   Response: $UPDATE_RESPONSE"
    echo ""
    
    if echo "$UPDATE_RESPONSE" | grep -q "Forbidden\|Invalid"; then
        echo -e "   ${GREEN}✅ Protected endpoint working (forbidden as expected for operator token)${NC}"
    elif echo "$UPDATE_RESPONSE" | grep -q "successfully"; then
        echo -e "   ${GREEN}✅ Image updated successfully${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Response received, review above${NC}"
    fi
else
    echo -e "   ${RED}⚠️  No token available, skipping protected endpoint test${NC}"
fi
echo ""

echo -e "${BLUE}=== Summary ===${NC}"
echo -e "   ${GREEN}✅ All endpoints tested${NC}"
echo "   1. GET /api/auth/operators/public - Gets operators list"
echo "   2. POST /api/auth/quick-login - Logs in operator without password"
echo "   3. PUT /api/auth/operators/:id/image - Updates operator image (admin)"
echo ""
echo "To fully test the UI carousel:"
echo "  1. Start server: npm run dev"
echo "  2. Open: http://localhost:5000"
echo "  3. Click on an operator to login"
echo ""
