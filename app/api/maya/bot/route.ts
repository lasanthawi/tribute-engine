import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_PUBLIC_BOT_TOKEN;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.message) return NextResponse.json({ ok: true });

    const { chat, text = '' } = body.message;
    const chatId = chat.id.toString();
    const command = text.split(' ')[0].toLowerCase();

    console.log('[Bot]', command, 'from', chatId);

    if (command === '/start') {
      await sendMessage(chatId,
        '👋 *Welcome to Polliana Travel Bot!*\n\n' +
        '🌍 Generate beautiful travel content\n\n' +
        '*/generate* - Random travel post\n' +
        '*/custom* location, occasion, pose\n' +
        '*/help* - All commands'
      );
      return NextResponse.json({ ok: true });
    }

    if (command === '/help') {
      await sendMessage(chatId,
        '*📚 Commands*\n\n' +
        '🎲 */generate* - Auto travel post (~30s)\n' +
        '✨ */custom* loc, occasion, pose\n' +
        '_Ex: /custom Bali, sunset yoga, tree pose_\n\n' +
        '📜 */history* - Recent posts\n' +
        '🔍 */status* - Bot health'
      );
      return NextResponse.json({ ok: true });
    }

    if (command === '/generate') {
      // Queue the generation
      const { error } = await supabase.from('generation_queue').insert({
        chat_id: chatId,
        command: 'generate',
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      if (error) {
        await sendMessage(chatId, '❌ Failed to queue. Try again.');
        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId,
        '📸 *Generating Travel Photo...*\n\n' +
        'Creating photorealistic moment for @pollianasela\n\n' +
        '⏳ ~30 seconds... I\'ll notify you when done!'
      );
      
      return NextResponse.json({ ok: true });
    }

    if (command === '/custom') {
      const customText = text.substring(7).trim();
      if (!customText) {
        await sendMessage(chatId,
          '❌ *Format:* /custom location, occasion, pose\n' +
          '*Ex:* /custom Fiji, sunset, sitting'
        );
        return NextResponse.json({ ok: true });
      }

      const { error } = await supabase.from('generation_queue').insert({
        chat_id: chatId,
        command: 'custom',
        params: customText,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      if (error) {
        await sendMessage(chatId, '❌ Failed to queue. Try again.');
        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId,
        '✨ *Generating Custom Post...*\n\n' +
        `📍 ${customText}\n\n` +
        '⏳ Creating your custom moment!'
      );
      
      return NextResponse.json({ ok: true });
    }

    if (command === '/status') {
      await sendMessage(chatId,
        '✅ *Bot: Active*\n\n' +
        '🤖 Online & ready\n' +
        '📡 Webhook connected\n' +
        '📢 Channel: @pollianasela'
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Bot] Error:', error);
    return NextResponse.json({ ok: true });
  }
}