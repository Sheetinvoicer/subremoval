#!/bin/bash

echo "🏆 MASTER SOLUTION - Fixes All Dashboard Files"
echo "=============================================="

# Function to fix a single file
fix_file() {
  local file="$1"
  
  if [ ! -f "$file" ]; then
    return
  fi
  
  echo "📝 Fixing: $file"
  
  # Create backup
  cp "$file" "$file.master.bak"
  
  # Read the file content
  content=$(cat "$file")
  
  # Check if the file has the pattern we need to fix
  if grep -q "const supabase = createClient();" "$file"; then
    # Fix the state order - move state declarations before supabase
    sed -i '' '/export default function/ a\
  const [loading, setLoading] = useState(true);\
  const [error, setError] = useState<string | null>(null);
' "$file"
    
    # Fix the supabase usage - wrap in try/catch with null check
    sed -i '' 's/const supabase = createClient();/try {\n    const supabase = createClient();\n    if (!supabase) {\n      setError("Failed to initialize Supabase client");\n      setLoading(false);\n      return;\n    }/g' "$file"
    
    # Make sure we have proper catch blocks
    sed -i '' 's/} catch (err) {/} catch (err) {\n    const errorMessage = err instanceof Error ? err.message : "Failed to load data";\n    setError(errorMessage);\n  } finally {\n    setLoading(false);\n  }/g' "$file"
    
    echo "  ✅ Fixed: $file"
  else
    echo "  ⏭️  Skipping (no supabase pattern): $file"
  fi
}

# List of all dashboard files
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

echo ""
echo "📁 Processing ${#FILES[@]} files..."
echo ""

for file in "${FILES[@]}"; do
  fix_file "$file"
done

echo ""
echo "✅ MASTER FIX COMPLETE!"
echo "📝 Backups saved as .master.bak"
echo ""
echo "🚀 Running build..."
