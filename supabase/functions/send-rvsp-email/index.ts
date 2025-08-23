// File: supabase/functions/send-rsvp-email/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

interface RsvpData {
  name: string;
  email: string;
  guest_count: number;
  non_veg: number;
  veg: number;
  comments?: string;
}

// Get the Resend API key and your verified 'from' email
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') // e.g., "rsvp@your-verified-domain.com"

serve(async (req) => {
  // CORS headers for browser security
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // For production, replace '*' with your website's domain
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rsvpData: RsvpData = await req.json()

    // Validate essential data
    if (!rsvpData.email || !rsvpData.name) {
      return new Response(JSON.stringify({ error: 'Email and name are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // The HTML content for the email remains the same
    const emailHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #c4a77d;">Thank You for your RSVP, ${rsvpData.name}!</h2>
          <p>We're thrilled that you'll be joining us. Here is a summary of your response:</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #c4a77d; margin: 20px 0;">
            <p><strong>Total Guests:</strong> ${rsvpData.guest_count}</p>
            <p><strong>Non-Veg Meals:</strong> ${rsvpData.non_veg}</p>
            <p><strong>Veg Meals:</strong> ${rsvpData.veg}</p>
            ${rsvpData.comments ? `<p><strong>Your Comments:</strong> ${rsvpData.comments}</p>` : ''}
          </div>
          <p>If you need to make any changes, please don't hesitate to contact us directly.</p>
          <p>With love,<br>Muhil & Kalyanni</p>
        </body>
      </html>
    `;

    // **CHANGED PART**: Use the Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Muhil & Kalyanni <${FROM_EMAIL}>`, // Resend requires this format
        to: [rsvpData.email],
        subject: "✓ Your RSVP is Confirmed for Muhil & Kalyanni's Wedding",
        html: emailHtml,
      }),
    });

    if (!response.ok) {
        const errorBody = await response.json();
        console.error('Resend API Error:', errorBody);
        throw new Error(`Resend failed: ${errorBody.message}`);
    }

    // Return a success message
    return new Response(JSON.stringify({ message: 'Confirmation email sent successfully!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});