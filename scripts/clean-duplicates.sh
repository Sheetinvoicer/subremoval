#!/bin/bash

echo "🧹 CLEANING DUPLICATE STATE DECLARATIONS"

for file in app/dashboard/*/page.tsx app/dashboard/page.tsx; do
  if [ -f "$file" ]; then
    echo "📝 Cleaning: $file"
    
    # Remove duplicate loading declarations
    sed -i '' '/const \[loading, setLoading\]/d' "$file"
    sed -i '' '/const \[error, setError\]/d' "$file"
    
    # Add them back ONCE at the top
    sed -i '' '/export default function/ a\
  const [loading, setLoading] = useState(true);\
  const [error, setError] = useState<string | null>(null);
' "$file"
    
    echo "  ✅ Cleaned: $file"
  fi
done

echo "✅ All duplicates removed!"
