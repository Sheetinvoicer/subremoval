const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a TypeScript expert. Fix this Next.js component code. Fix all TypeScript errors. Return only the fixed code."
      },
      {
        role: "user",
        content: content
      }
    ]
  });
  
  const fixed = response.choices[0].message.content;
  fs.writeFileSync(filePath, fixed);
  console.log(`✅ Fixed: ${filePath}`);
}

// Fix all dashboard files
const files = [
  'app/dashboard/clients/page.tsx',
  'app/dashboard/clients/[id]/page.tsx',
  // add more files here
];

files.forEach(fixFile);
