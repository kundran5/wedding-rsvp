// supabase/functions/send-rsvp-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL");

serve(async (req) => {
  const method = req.method;
  const origin = req.headers.get("origin") ?? "*";
  const acrMethod = req.headers.get("access-control-request-method") ?? "POST";
  const acrHeaders = req.headers.get("access-control-request-headers") ?? "authorization, x-client-info, apikey, content-type";

  const base = {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
  };

  // Preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...base,
        "Access-Control-Allow-Methods": `POST, OPTIONS, HEAD`,
        "Access-Control-Allow-Headers": acrHeaders,
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Health/HEAD
  if (method === "HEAD") {
    return new Response(null, { status: 204, headers: base });
  }

  // Enforce POST for main path
  if (method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { ...base, "Allow": "POST, OPTIONS, HEAD", "Content-Type": "application/json" },
    });
  }

  try {
    // Guard content-type
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), {
        status: 415,
        headers: { ...base, "Content-Type": "application/json" },
      });
    }

    const rsvpData = await req.json(); // Only here for POST JSON

    // Minimal validation
    for (const k of ["name", "email", "guest_count", "non_veg", "veg"]) {
      if (!(k in rsvpData)) {
        return new Response(JSON.stringify({ error: `Missing field: ${k}` }), {
          status: 400,
          headers: { ...base, "Content-Type": "application/json" },
        });
      }
    }

    const emailHtml = `
      <html><body style="font-family: Arial, sans-serif;">
        <h2>Thank You for your RSVP, ${rsvpData.name}!</h2>
        <p>Here is a summary:</p>
        <div>
          <p><strong>Total Guests:</strong> ${rsvpData.guest_count}</p>
          <p><strong>Non-Veg Meals:</strong> ${rsvpData.non_veg}</p>
          <p><strong>Veg Meals:</strong> ${rsvpData.veg}</p>
          ${rsvpData.comments ? `<p><strong>Comments:</strong> ${rsvpData.comments}</p>` : ""}
        </div>
        <p>With love,<br>Muhil & Kalyanni</p>
      </body></html>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Muhil & Kalyanni <${FROM_EMAIL}>`,
        to: [rsvpData.email],
        subject: "✓ Your RSVP is Confirmed!",
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text().catch(() => "");
      return new Response(JSON.stringify({ error: "Resend failed", detail }), {
        status: 502,
        headers: { ...base, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Email sent successfully!" }), {
      status: 200,
      headers: { ...base, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 400,
      headers: { ...base, "Content-Type": "application/json" },
    });
  }
});
