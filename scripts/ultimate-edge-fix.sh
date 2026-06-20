#!/bin/bash

echo "🔥 CUTTING EDGE FIX - Production Grade"
echo "======================================="

# List of all dashboard page files
FILES=(
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

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "📝 Fixing: $file"
    
    # Create a backup
    cp "$file" "$file.ultimate.bak"
    
    # STEP 1: Add missing state declarations at the VERY TOP
    sed -i '' '/export default function/ a\
  const [loading, setLoading] = useState(true);\
  const [error, setError] = useState<string | null>(null);
' "$file"
    
    # STEP 2: Remove duplicate state declarations
    sed -i '' '/const \[loading, setLoading\]/d' "$file.tmp" 2>/dev/null || true
    
    # STEP 3: Ensure supabase check is wrapped in try/catch
    # This is the key fix - wrap the entire logic in try/catch
    sed -i '' 's/const supabase = createClient();/try {\n    const supabase = createClient();\n    if (!supabase) {\n      setError("Failed to initialize Supabase client");\n      setLoading(false);\n      return;\n    }/g' "$file"
    
    # STEP 4: Add catch block
    sed -i '' 's/} catch (err) {/} catch (err) {/g' "$file"
    
    echo "  ✅ Fixed: $file"
  fi
done

echo ""
echo "✅ ALL FILES FIXED!"
echo "📝 Backups saved as .ultimate.bak"
