#!/bin/bash
export OPENAI_API_KEY=$(grep OPENAI_API_KEY .env.local | cut -d'"' -f2)
junie --openai-api-key "$OPENAI_API_KEY" "Fix the recurring page error in app/dashboard/recurring/page.tsx by adding the loadRecurringInvoices function with proper error handling."
