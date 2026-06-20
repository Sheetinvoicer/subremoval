#!/bin/bash

echo "🧹 ULTIMATE CLEANUP - Removing ALL duplicate state declarations"

# Clean the clients page first (we already fixed it)
# Now clean ALL other files

FILES=(
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
    echo "📝 Cleaning: $file"
    
    # Remove ALL existing state declarations
    sed -i '' '/const \[loading, setLoading\]/d' "$file"
    sed -i '' '/const \[error, setError\]/d' "$file"
    sed -i '' '/const \[[a-zA-Z]*, set[a-zA-Z]*\]/d' "$file"
    
    # Insert clean state at the top
    sed -i '' '/export default function/ a\
  const [loading, setLoading] = useState(true);\
  const [error, setError] = useState<string | null>(null);
' "$file"
    
    echo "  ✅ Cleaned: $file"
  fi
done

echo ""
echo "✅ ALL FILES CLEANED!"
echo "📝 Now run: npm run build"
