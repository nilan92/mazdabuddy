#!/bin/bash

# MazdaBuddy App Health Check Script
# This script performs basic checks on your app

echo "🔍 MazdaBuddy App Health Check"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if dev server is running
echo "📡 Checking dev server..."
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${GREEN}✓${NC} Dev server is running on port 5173"
else
    echo -e "${RED}✗${NC} Dev server is NOT running"
    echo "   Run: npm run dev"
fi
echo ""

# Check if node_modules exists
echo "📦 Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
else
    echo -e "${RED}✗${NC} node_modules not found"
    echo "   Run: npm install"
fi
echo ""

# Check if .env file exists
echo "🔐 Checking environment variables..."
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    
    # Check for required variables (without showing values)
    if grep -q "VITE_SUPABASE_URL" .env; then
        echo -e "${GREEN}✓${NC} VITE_SUPABASE_URL is set"
    else
        echo -e "${RED}✗${NC} VITE_SUPABASE_URL is missing"
    fi
    
    if grep -q "VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY" .env; then
        echo -e "${GREEN}✓${NC} VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY is set"
    else
        echo -e "${RED}✗${NC} VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY is missing"
    fi
else
    echo -e "${RED}✗${NC} .env file not found"
    echo "   Create .env with Supabase credentials"
fi
echo ""

# Check critical files
echo "📄 Checking critical files..."
files=(
    "index.html"
    "public/manifest.json"
    "src/main.tsx"
    "src/App.tsx"
    "src/context/AuthContext.tsx"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file is missing"
    fi
done
echo ""

# Check manifest.json for PWA
echo "📱 Checking PWA configuration..."
if [ -f "public/manifest.json" ]; then
    if grep -q '"start_url": "./"' public/manifest.json; then
        echo -e "${GREEN}✓${NC} Manifest has relative start_url"
    else
        echo -e "${YELLOW}⚠${NC} Manifest start_url might not be relative"
    fi
    
    if grep -q '"name": "AutoPulse OS"' public/manifest.json; then
        echo -e "${GREEN}✓${NC} App name is 'AutoPulse OS'"
    else
        echo -e "${YELLOW}⚠${NC} App name might be different"
    fi
fi
echo ""

# Check for common issues in code
echo "🔍 Checking for potential code issues..."

# Check for console.log (should be removed in production)
log_count=$(find src -name "*.tsx" -o -name "*.ts" | xargs grep -c "console.log" 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
if [ "$log_count" -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Found $log_count console.log statements (consider removing for production)"
else
    echo -e "${GREEN}✓${NC} No console.log statements found"
fi

# Check for TODO comments
todo_count=$(find src -name "*.tsx" -o -name "*.ts" | xargs grep -c "TODO" 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
if [ "$todo_count" -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Found $todo_count TODO comments"
else
    echo -e "${GREEN}✓${NC} No TODO comments found"
fi

# Check for proper cleanup in useEffect
echo ""
echo "🧹 Checking for Supabase cleanup..."
cleanup_files=$(find src -name "*.tsx" | xargs grep -l "supabase.channel" | wc -l | tr -d ' ')
if [ "$cleanup_files" -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Found $cleanup_files files using Supabase channels"
    echo "   Ensure all channels have proper cleanup with removeChannel()"
else
    echo -e "${GREEN}✓${NC} No Supabase channel usage found (or all cleaned up)"
fi
echo ""

# Check build
echo "🏗️  Testing production build..."
if npm run build > /tmp/build.log 2>&1; then
    echo -e "${GREEN}✓${NC} Production build successful"
    
    # Check build size
    if [ -d "dist" ]; then
        build_size=$(du -sh dist | cut -f1)
        echo -e "${GREEN}✓${NC} Build size: $build_size"
    fi
else
    echo -e "${RED}✗${NC} Production build failed"
    echo "   Check /tmp/build.log for details"
fi
echo ""

# Summary
echo "================================"
echo "✅ Health check complete!"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Check browser console for errors (F12)"
echo "3. Test authentication flow"
echo "4. Test all main features"
echo "5. Review TESTING_GUIDE.md for detailed checklist"
echo ""
echo "For detailed testing, see: TESTING_GUIDE.md"
