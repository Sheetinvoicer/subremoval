#!/bin/bash

echo "🔧 Fixing supabase null checks in dashboard pages..."

# Find all dashboard page files that use supabase
find app/dashboard -name "page.tsx" -type f | while read file; do
  echo "Checking: $file"
  
  # Check if the file uses supabase without null check
  if grep -q "const supabase = createClient()" "$file"; then
    echo "  Fixing: $file"
    
    # Add null check and error handling
    sed -i '' 's/const supabase = createClient()/const supabase = createClient();\n    if (!supabase) {\n      setError("Failed to initialize Supabase client");\n      setLoading(false);\n      return;\n    }/g' "$file"
  fi
done

echo "✅ All files fixed!"
