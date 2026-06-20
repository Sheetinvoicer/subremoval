#!/bin/bash

echo "🧠 SMART FIX - Only fix what's broken"
echo "======================================"

# Function to fix a file intelligently
fix_file() {
  local file=$1
  
  echo "📝 Analyzing: $file"
  
  # Check what's missing
  local has_error=$(grep -c "const \[error, setError\]" "$file")
  local has_loading=$(grep -c "const \[loading, setLoading\]" "$file")
  local has_bad_check=$(grep -c "const supabase = createClient();" "$file" | head -1)
  
  if [ "$has_error" -eq 0 ]; then
    echo "  ➕ Adding error state"
    sed -i '' '/useState(/a\
  const [error, setError] = useState<string | null>(null);
' "$file"
  fi
  
  if [ "$has_loading" -eq 0 ]; then
    echo "  ➕ Adding loading state"
    sed -i '' '/useState(/a\
  const [loading, setLoading] = useState(true);
' "$file"
  fi
  
  if [ "$has_bad_check" -gt 0 ]; then
    echo "  🔧 Fixing supabase null check"
    # This requires manual fix for complex files
    # We'll flag it for review
    echo "  ⚠️  Manual review needed for supabase check"
  fi
}

# Fix each file
files=(
  "app/dashboard/clients/[id]/page.tsx"
  "app/dashboard/clients/page.tsx"
  "app/dashboard/estimates/[id]/page.tsx"
  "app/dashboard/estimates/new/page.tsx"
  "app/dashboard/estimates/page.tsx"
  "app/dashboard/expenses/[id]/edit/page.tsx"
  "app/dashboard/expenses/new/page.tsx"
  "app/dashboard/expenses/page.tsx"
  "app/dashboard/invoices/[id]/edit/page.tsx"
  "app/dashboard/invoices/[id]/page.tsx"
  "app/dashboard/invoices/new/page.tsx"
  "app/dashboard/invoices/page.tsx"
  "app/dashboard/page.tsx"
  "app/dashboard/recurring/page.tsx"
  "app/dashboard/reports/page.tsx"
  "app/dashboard/settings/currency/page.tsx"
  "app/dashboard/subscription/page.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    fix_file "$file"
  fi
done

echo ""
echo "✅ Smart fix complete!"
echo "⚠️  Some files may need manual review"
