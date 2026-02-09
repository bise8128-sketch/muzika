#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting YouTube Integration Verification...${NC}"

# Check Python Backend Health
echo -e "\n${GREEN}1. Checking Python Backend Health...${NC}"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health)
if [ "$HEALTH_STATUS" == "200" ]; then
    echo "✅ Python Backend is Healthy"
else
    echo -e "${RED}❌ Python Backend Unhealthy (Status: $HEALTH_STATUS)${NC}"
    exit 1
fi

# Check Proxy Download Endpoint
echo -e "\n${GREEN}2. Testing YouTube Extraction (Proxy)...${NC}"
# Use a very short video to save time/bandwidth
TEST_URL="https://www.youtube.com/watch?v=jNQXAC9IVRw" 
RESPONSE=$(curl -s -X POST http://localhost:3000/api/extract-youtube \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$TEST_URL\", \"format\": \"mp3\"}")

if echo "$RESPONSE" | grep -q "success"; then
    echo "✅ Extraction Successful"
    FILENAME=$(echo "$RESPONSE" | grep -o '"filename":"[^"]*' | cut -d'"' -f4)
    echo "   Filename: $FILENAME"
else
    echo -e "${RED}❌ Extraction Failed${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi

# Check Proxy Separation Endpoint
echo -e "\n${GREEN}3. Testing Audio Separation (Proxy)...${NC}"
SEP_RESPONSE=$(curl -s -X POST http://localhost:3000/api/python-processing \
    -H "Content-Type: application/json" \
    -d "{\"filename\": \"$FILENAME\"}")

if echo "$SEP_RESPONSE" | grep -q "completed"; then
    echo "✅ Separation Job Started/Completed"
else
    echo -e "${RED}❌ Separation Failed${NC}"
    echo "Response: $SEP_RESPONSE"
    exit 1
fi

echo -e "\n${GREEN}✅ Verification Complete! System is operational.${NC}"
