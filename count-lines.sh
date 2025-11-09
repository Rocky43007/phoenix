#!/bin/bash

# Phoenix Project - Line Counter
# Counts lines of code by language, excluding generated files and dependencies

echo "=========================================="
echo "Phoenix Project - Lines of Code"
echo "=========================================="
echo ""

# Color codes
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to count lines
count_lines() {
    local pattern=$1
    local label=$2
    local color=$3

    local count=$(find . \
        -type f \
        -name "$pattern" \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -path "*/.expo/*" \
        ! -path "*/ios/Pods/*" \
        ! -path "*/android/build/*" \
        ! -path "*/android/.gradle/*" \
        ! -path "*/.git/*" \
        ! -path "*/coverage/*" \
        ! -path "*/__generated__/*" \
        ! -path "*/metro-cache/*" \
        ! -name "*.lock" \
        ! -name "package-lock.json" \
        ! -name "pnpm-lock.yaml" \
        -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')

    if [ -n "$count" ] && [ "$count" != "0" ]; then
        printf "${color}%-20s %10s lines${NC}\n" "$label" "$count"
    fi
}

# Count by language
count_lines "*.ts" "TypeScript" "$BLUE"
count_lines "*.tsx" "TypeScript (JSX)" "$BLUE"
count_lines "*.js" "JavaScript" "$YELLOW"
count_lines "*.jsx" "JavaScript (JSX)" "$YELLOW"
count_lines "*.kt" "Kotlin" "$GREEN"
count_lines "*.swift" "Swift" "$GREEN"
count_lines "*.m" "Objective-C" "$GREEN"
count_lines "*.java" "Java" "$GREEN"
count_lines "*.json" "JSON" "$NC"
count_lines "*.md" "Markdown" "$NC"

echo ""
echo "=========================================="

# Total count (excluding generated files)
total=$(find . \
    -type f \
    \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \
       -o -name "*.kt" -o -name "*.swift" -o -name "*.m" -o -name "*.java" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*" \
    ! -path "*/.expo/*" \
    ! -path "*/ios/Pods/*" \
    ! -path "*/android/build/*" \
    ! -path "*/android/.gradle/*" \
    ! -path "*/.git/*" \
    ! -path "*/coverage/*" \
    ! -path "*/__generated__/*" \
    ! -path "*/metro-cache/*" \
    ! -name "*.lock" \
    -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')

printf "${GREEN}Total Source Code:    %10s lines${NC}\n" "$total"
echo "=========================================="
