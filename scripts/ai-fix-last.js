const OpenAI = require('openai');
const fs = require('fs');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const filePath = 'app/dashboard/clients/[id]/page.tsx';

async function fixFile() {
  console.log('📝 Sending to OpenAI...');
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a TypeScript expert. Fix this Next.js component.
        
        Rules:
        1. Fix the Client type error - define the Client interface
        2. Use 'use client' at the top
        3. Use next/navigation, not next/router
        4. Return ONLY the fixed code, no explanations`
      },
      {
        role: "user",
        content: `Fix this file:\n\n${content}`
      }
    ],
    temperature: 0.3,
  });
  
  const fixed = response.choices[0].message.content;
  const clean = fixed.replace(/```tsx|```typescript|```ts|```/g, '').trim();
  
  fs.writeFileSync(filePath, clean);
  console.log('✅ Fixed!');
}

fixFile().then(() => {
  console.log('🚀 Now run: npm run build');
}).catch(console.error);
