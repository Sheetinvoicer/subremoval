#!/bin/bash

echo "🔧 Fixing catch block error handling..."

find app/api -name "route.ts" -o -name "route.tsx" -type f | while read file; do
  echo "Checking: $file"
  
  # Replace error.message with proper error handling
  sed -i '' 's/return NextResponse.json({ error: error.message }, { status: 500 })/const errorMessage = error instanceof Error ? error.message : "Internal server error";\n    return NextResponse.json({ error: errorMessage }, { status: 500 })/g' "$file"
  
  # Add console.error if not present
  if ! grep -q "console.error" "$file"; then
    sed -i '' '/catch (error) {/a\
    console.error("API error:", error);
' "$file"
  fi
done

echo "✅ All catch blocks fixed!"
