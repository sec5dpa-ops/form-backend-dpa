export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Headers': '*',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const datos = await req.json();
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'DPA Formulario <onboarding@resend.dev>',
        to: ['sec5dpa@gmail.com'],
        subject: `[ADMISION] ${datos.nombre} - ${datos.tramite}`,
        text: `Nombre: ${datos.nombre}\nDNI: ${datos.dni}\nTramite: ${datos.tramite}`,
        attachments: datos.pdfBase64 ? [{
          filename: `FDJ_${datos.nombre}.pdf`,
          content: datos.pdfBase64
        }] : []
      })
    });

    const result = await response.json();
    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
