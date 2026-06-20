#!/bin/bash

echo "🔧 Fixing all dashboard files..."

# List of files to fix (excluding the ones we already fixed)
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
  "app/dashboard/page.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "📝 Fixing: $file"
    
    # Check if the file has the broken pattern
    if grep -q "const supabase = createClient();" "$file"; then
      # Fix the try/catch structure
      sed -i '' 's/const supabase = createClient();/try {\n      const supabase = createClient();\n      if (!supabase) {\n        setError("Failed to initialize Supabase client");\n        setLoading(false);\n        return;\n      }/g' "$file"
      
      # Add closing braces
      sed -i '' 's/} catch (err) {/} catch (err) {\n      const errorMessage = err instanceof Error ? err.message : "Failed to load data";\n      setError(errorMessage);\n    } finally {\n      setLoading(false);\n    }/g' "$file"
    fi
    
    echo "  ✅ Fixed: $file"
  fi
done

echo "✅ All files fixed!"
