const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Files to fix
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
    console.log(`📝 Fixing: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a TypeScript expert for Next.js 14 App Router.
          
          Rules:
          1. Fix all TypeScript errors
          2. Keep all functionality identical
          3. Add proper interfaces
          4. Ensure supabase null checks
          5. Use 'use client' when needed
          6. Return ONLY the fixed code, no explanations`
        },
        {
          role: "user",
          content: `Fix this Next.js component:\n\n${content}`
        }
      ],
      temperature: 0.3,
    });
    
    const fixed = response.choices[0].message.content;
    
    // Clean up markdown if present
    const cleanCode = fixed.replace(/```tsx|```typescript|```ts|```/g, '').trim();
    
    fs.writeFileSync(filePath, cleanCode);
    console.log(`✅ Fixed: ${filePath}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting AI-powered fix...\n');
  
  let fixed = 0;
  let failed = 0;
  
  for (const file of files) {
    if (fs.existsSync(file)) {
      const success = await fixFile(file);
      if (success) fixed++;
      else failed++;
    }
  }
  
  console.log(`\n✅ Fixed: ${fixed} files`);
  console.log(`❌ Failed: ${failed} files`);
  console.log(`\n📊 Total: ${files.length} files`);
}

main().catch(console.error);
