import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_PUBLIC_BOT_TOKEN;
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

async function sendMessage(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function executeRecipe(recipeId: string, params: any = {}) {
  const response = await fetch('https://backend.composio.dev/api/v1/recipes/execute', {
    method: 'POST',
    headers: {
      'X-API-Key': COMPOSIO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipe_id: recipeId, params }),
  });
  return await response.json();
}

export async function GET(request: NextRequest) {
  try {
    // Get pending jobs
    const { data: jobs } = await supabase
      .from('generation_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    for (const job of jobs) {
      // Mark as processing
      await supabase
        .from('generation_queue')
        .update({ status: 'processing' })
        .eq('id', job.id);

      try {
        const params = job.command === 'custom' && job.params ? {
          custom_location: job.params.split(',')[0]?.trim(),
          custom_occasion: job.params.split(',')[1]?.trim(),
          custom_pose: job.params.split(',')[2]?.trim(),
        } : {};

        const result = await executeRecipe('rcp_xTlvCq1gSt4p', params);

        // Mark as done
        await supabase
          .from('generation_queue')
          .update({ 
            status: 'completed', 
            result: result,
            processed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        // Notify user
        await sendMessage(job.chat_id,
          '✅ *Posted Successfully!*\n\n' +
          'Check @pollianasela for your travel photo! 📸'
        );
      } catch (error: any) {
        // Mark as failed
        await supabase
          .from('generation_queue')
          .update({ 
            status: 'failed', 
            error: error.message,
            processed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        await sendMessage(job.chat_id,
          '❌ *Generation Failed*\n\n' +
          'Something went wrong. Try /generate again.'
        );
      }
    }

    return NextResponse.json({ processed: jobs.length });
  } catch (error: any) {
    console.error('[Processor] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}