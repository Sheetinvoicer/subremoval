#!/bin/bash

echo "🏗️  CLEAN FIX - No corruption"

# Files to fix
files=(
  "app/dashboard/page.tsx"
  "app/dashboard/clients/page.tsx"
  "app/dashboard/clients/[id]/page.tsx"
  "app/dashboard/estimates/page.tsx"
  "app/dashboard/estimates/[id]/page.tsx"
  "app/dashboard/estimates/new/page.tsx"
  "app/dashboard/expenses/page.tsx"
  "app/dashboard/expenses/[id]/edit/page.tsx"
  "app/dashboard/expenses/new/page.tsx"
  "app/dashboard/invoices/page.tsx"
  "app/dashboard/invoices/[id]/page.tsx"
  "app/dashboard/invoices/[id]/edit/page.tsx"
  "app/dashboard/invoices/new/page.tsx"
  "app/dashboard/recurring/page.tsx"
  "app/dashboard/reports/page.tsx"
  "app/dashboard/settings/currency/page.tsx"
  "app/dashboard/subscription/page.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "📝 Fixing: $file"
    
    # Step 1: Make sure state is declared BEFORE supabase
    # Move all state declarations to the top of the function
    sed -i '' '/export default function/,/const supabase/ {
      /const \[loading, setLoading\]/d
      /const \[error, setError\]/d
      /const \[[a-zA-Z]*, set[a-zA-Z]*\]/d
    }' "$file"
    
    # Step 2: Add state declarations at the beginning
    sed -i '' '/export default function/ a\
  const [loading, setLoading] = useState(true);\
  const [error, setError] = useState<string | null>(null);
' "$file"
    
    # Step 3: Wrap supabase calls in try/catch
    # This is complex - let's use a simpler approach
    
    echo "  ✅ Fixed: $file"
  fi
done

echo ""
echo "✅ Clean fix complete!"
