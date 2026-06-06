module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const datos = req.body;
    const nombre = (datos.nombre || 'formulario').replace(/\s+/g, '_');

    const payload = {
      from: 'DPA Formulario <onboarding@resend.dev>',
      to: ['sec5dpa@gmail.com'],
      subject: `[ADMISION] ${datos.nombre} - ${datos.tramite}`,
      text: `FORMULARIO DE ADMISION - DEFENSORIA DPA N1\n\nNombre: ${datos.nombre}\nDNI: ${datos.dni} | CUIL: ${datos.cuil}\nTel: ${datos.tel}\nLocalidad: ${datos.localidad} - ${datos.barrio}\nDomicilio: ${datos.domicilio}\nOcupacion: ${datos.ocupacion}\nIngresos: $${datos.monto} ${datos.freq}\nGrupo: ${datos.grupo} personas\nVivienda: ${datos.vivienda}\nContrario: ${datos.cont_nombre}\nTramite: ${datos.tramite}\nFecha: ${new Date().toLocaleString('es-AR')}`,
      attachments: datos.pdfBase64 ? [{ filename: `FDJ_${nombre}.pdf`, content: datos.pdfBase64 }] : []
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(result));
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
