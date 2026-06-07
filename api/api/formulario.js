// api/formulario.js — Backend DPA N°1
// Recibe el formulario desde el HTML, envía email con PDF adjunto via Resend

module.exports = async function handler(req, res) {
  // CORS — permite cualquier origen (necesario para llamadas desde Netlify)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo acepta POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const datos = req.body;

    if (!datos || !datos.nombre) {
      return res.status(400).json({ error: 'Datos del formulario incompletos' });
    }

    const nombre = (datos.nombre || 'solicitante').replace(/\s+/g, '_');
    const tramite = datos.tramite || 'SIN_TRAMITE';

    // Cuerpo del email con todos los datos del formulario
    const cuerpoEmail = `
FORMULARIO DE ADMISIÓN — DEFENSORÍA DE POBRES Y AUSENTES N°1
=============================================================

DATOS PERSONALES
----------------
Nombre y apellido : ${datos.nombre || ''}
DNI               : ${datos.dni || ''}
CUIL              : ${datos.cuil || ''}
Fecha de nac.     : ${datos.fnac || ''}
Teléfono          : ${datos.tel || ''}
Email             : ${datos.email || ''}
Localidad         : ${datos.localidad || ''}
Barrio            : ${datos.barrio || ''}
Domicilio         : ${datos.domicilio || ''}

SITUACIÓN ECONÓMICA
-------------------
Ocupación         : ${datos.ocupacion || ''}
Ingresos          : $${datos.monto || ''} (${datos.freq || ''})
Recibe recibo     : ${datos.recibo || ''}
Recibe planes     : ${datos.planes || ''}
Tipo de plan      : ${datos.tipo_plan || ''}
Monto plan        : $${datos.monto_plan || ''}
Grupo familiar    : ${datos.grupo || ''} personas
Total ingresos    : $${datos.total_ing || ''}
Vivienda          : ${datos.vivienda || ''}
Años en vivienda  : ${datos.anios_vivienda || ''}

CONTRAPARTE
-----------
Nombre            : ${datos.cont_nombre || ''}
DNI               : ${datos.cont_dni || ''}
Edad              : ${datos.cont_edad || ''}
Localidad         : ${datos.cont_localidad || ''}
Barrio            : ${datos.cont_barrio || ''}
Domicilio         : ${datos.cont_domicilio || ''}
Teléfono          : ${datos.cont_tel || ''}
Trabajo           : ${datos.cont_trabajo || ''}
Tiene ingresos    : ${datos.cont_ing || ''}

TRÁMITE SOLICITADO
------------------
Trámite           : ${tramite}
Cantidad de hijos : ${datos.cant_hijos || ''}
Datos de hijos    : ${datos.datos_hijos || ''}
Convivencia       : ${datos.se_fue === 'SI' ? 'No conviven' : 'Conviven'}
Causa judicial    : ${datos.causa || ''}
N° de expediente  : ${datos.nro_exp || ''}
Observaciones     : ${datos.observaciones || ''}

=============================================================
Formulario recibido automáticamente desde el sistema de admisión digital.
    `.trim();

    // Armar adjuntos — el PDF viene en base64 desde el formulario
    const attachments = [];
    if (datos.pdfBase64) {
      attachments.push({
        filename: `FDJ_${nombre}_${tramite}.pdf`,
        content: datos.pdfBase64  // Resend acepta base64 directamente
      });
    }

    // Llamada a la API de Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'DPA Formulario <onboarding@resend.dev>',
        to: ['sec5dpa@gmail.com'],
        subject: `[ADMISIÓN] ${datos.nombre} — ${tramite}`,
        text: cuerpoEmail,
        attachments: attachments
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error Resend:', result);
      throw new Error(result.message || JSON.stringify(result));
    }

    console.log('Email enviado OK:', result.id);
    return res.status(200).json({ success: true, emailId: result.id });

  } catch (error) {
    console.error('Error handler:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};
