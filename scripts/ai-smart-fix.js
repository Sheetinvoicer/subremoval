const OpenAI = require('openai');
const fs = require('fs');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Files that need fixing (starting with the one with errors)
const files = [
  'app/dashboard/clients/page.tsx',
  'app/dashboard/clients/[id]/page.tsx',
  'app/dashboard/estimates/page.tsx',
  'app/dashboard/estimates/[id]/page.tsx',
  'app/dashboard/estimates/new/page.tsx',
  'app/dashboard/expenses/page.tsx',
  'app/dashboard/expenses/[id]/edit/page.tsx',
  'app/dashboard/expenses/new/page.tsx',
  'app/dashboard/invoices/page.tsx',
  'app/dashboard/invoices/[id]/page.tsx',
  'app/dashboard/invoices/[id]/edit/page.tsx',
  'app/dashboard/invoices/new/page.tsx',
  'app/dashboard/recurring/page.tsx',
  'app/dashboard/reports/page.tsx',
  'app/dashboard/settings/currency/page.tsx',
  'app/dashboard/subscription/page.tsx',
];

async function fixFile(filePath) {
  try {
    console.log(`\n📝 Fixing: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Read the file to make sure it exists
    console.log(`   Size: ${content.length} characters`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a TypeScript/Next.js expert. Fix this ONE file completely.

          RULES:
          1. Add 'use client' at the VERY TOP if missing
          2. Import useRouter from 'next/navigation' (NOT 'next/router')
          3. Remove ANY imports from '@supabase/supabase-js'
          4. Define ALL interfaces in the file
          5. Fix .from<Client>() → .from('clients')
          6. Use const { data, error: queryError } pattern
          7. Add supabase null check: if (!supabase) { setError(...); return; }
          8. Keep ALL JSX and functionality EXACTLY as is
          9. Return ONLY the complete fixed code, no explanations`
        },
        {
          role: "user",
          content: `Fix this file completely. Keep all functionality exactly the same. Return only the code:\n\n${content}`
        }
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });
    
    let fixed = response.choices[0].message.content;
    fixed = fixed.replace(/```tsx|```typescript|```ts|```/g, '').trim();
    
    // Ensure 'use client' is first
    if (!fixed.startsWith("'use client'") && !fixed.startsWith('"use client"')) {
      fixed = "'use client';\n\n" + fixed;
    }
    
    // Write the fixed file
    fs.writeFileSync(filePath, fixed);
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 SMART AI FIX - One file at a time\n');
  
  for (const file of files) {
    if (fs.existsSync(file)) {
      const success = await fixFile(file);
      if (!success) {
        console.log(`⚠️  Skipping: ${file}`);
      }
    } else {
      console.log(`⏭️  Not found: ${file}`);
    }
  }
  
  console.log('\n✅ All files processed!');
  console.log('🚀 Now run: npm run build');
}

main().catch(console.error);
