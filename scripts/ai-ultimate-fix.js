const OpenAI = require('openai');
const fs = require('fs');
const { execSync } = require('child_process');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ALL dashboard files
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

// Get current errors
function getErrors() {
  try {
    const output = execSync('npm run build 2>&1', { encoding: 'utf8', timeout: 30000 });
    return output;
  } catch (error) {
    return error.stdout || error.message;
  }
}

async function fixAllFiles() {
  console.log('🔍 Analyzing errors...\n');
  
  // Get current build errors
  const errors = getErrors();
  
  // Extract error summaries
  const errorSummary = errors
    .split('\n')
    .filter(line => line.includes('error') || line.includes('Type error'))
    .slice(0, 50)
    .join('\n');
  
  console.log(`📋 Found errors: ${errorSummary.split('\n').length} lines\n`);
  
  // Read all files
  const fileContents = {};
  for (const file of files) {
    if (fs.existsSync(file)) {
      fileContents[file] = fs.readFileSync(file, 'utf8');
    }
  }
  
  console.log('🧠 Sending to OpenAI for analysis and fix...\n');
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are the WORLD'S BEST TypeScript/Next.js expert. Your task is to fix ALL errors.

        CRITICAL RULES (MUST FOLLOW):
        1. EVERY file must start with "'use client';" as the FIRST line
        2. Import from 'next/navigation' (NOT 'next/router')
        3. NEVER import from '@supabase/supabase-js' - define interfaces locally
        4. Define ALL interfaces directly in each file
        5. Fix .from<Client>() → remove generic, use .from('table')
        6. Use: const { data, error: queryError } = await supabase.from('table').select('*')
        7. ALWAYS check: if (!supabase) { setError('...'); return; }
        8. ALWAYS use try/catch with proper error handling
        9. Keep ALL existing JSX and functionality EXACTLY as is
        10. Return COMPLETE fixed files, no explanations, no markdown

        COMMON FIXES:
        - Remove: import { Client } from '@supabase/supabase-js'
        - Remove: import { User } from '@supabase/supabase-js'
        - Remove: import { SupabaseClient, PostgrestError } from '@supabase/supabase-js'
        - Change: import { useRouter } from 'next/router' → import { useRouter } from 'next/navigation'
        - Change: .from<Client>('clients') → .from('clients')
        - Add: 'use client' at top of every file

        FIX ALL FILES COMPLETELY. ZERO ERRORS.`
      },
      {
        role: "user",
        content: `Here are the build errors:\n\n${errorSummary}\n\nHere are all the files that need fixing:\n\n${JSON.stringify(fileContents, null, 2)}\n\nFix ALL of them. Return a JSON object with filename as key and fixed code as value.`
      }
    ],
    temperature: 0.1,
    max_tokens: 8000,
  });
  
  const result = response.choices[0].message.content;
  
  // Parse JSON response
  let fixes = {};
  try {
    // Try to extract JSON from the response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      fixes = JSON.parse(jsonMatch[0]);
    } else {
      // Fallback - try to parse the whole response
      fixes = JSON.parse(result);
    }
  } catch (e) {
    console.log('⚠️  Could not parse JSON response, using fallback...');
    // Fallback: try to extract each file
    for (const file of files) {
      const fileName = file.split('/').pop();
      const regex = new RegExp(`"${fileName}"[\\s]*:[\\s]*"([\\s\\S]*?)"[,}]`);
      const match = result.match(regex);
      if (match) {
        fixes[file] = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }
  }
  
  // Write fixed files
  let fixedCount = 0;
  for (const [file, content] of Object.entries(fixes)) {
    if (content && typeof content === 'string') {
      // Clean up the content
      let cleanContent = content
        .replace(/^```tsx?|```$/g, '')
        .replace(/^```typescript|```$/g, '')
        .replace(/^```jsx?|```$/g, '')
        .trim();
      
      // Ensure 'use client'
      if (!cleanContent.startsWith("'use client'") && !cleanContent.startsWith('"use client"')) {
        cleanContent = "'use client';\n\n" + cleanContent;
      }
      
      fs.writeFileSync(file, cleanContent);
      console.log(`✅ Fixed: ${file}`);
      fixedCount++;
    }
  }
  
  console.log(`\n📊 Fixed ${fixedCount} files`);
  console.log('\n🚀 Building...\n');
  
  // Run build
  try {
    execSync('npm run build', { stdio: 'inherit', encoding: 'utf8' });
  } catch (e) {
    console.log('⚠️  Build still has errors. Let me check...');
    const newErrors = getErrors();
    console.log(newErrors.slice(0, 1000));
  }
}

fixAllFiles().catch(console.error);
