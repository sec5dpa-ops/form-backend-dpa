// api/formulario.js — Backend DPA N°1
// Recibe el formulario, genera la demanda en Word y envía todo por email via Resend
// También crea carpeta en Drive y registra en Sheets via Google Apps Script

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// ── URL del Apps Script (reemplazar tras desplegar) ──────────────────────────
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

// ── Helpers ─────────────────────────────────────────────────────────────────

// Convierte número a texto para porcentajes (20 → "VEINTE POR CIENTO (20%)")
function porcentajeTexto(n) {
  const palabras = {
    20: 'VEINTE POR CIENTO (20%)',
    25: 'VEINTICINCO POR CIENTO (25%)',
    30: 'TREINTA POR CIENTO (30%)',
    35: 'TREINTA Y CINCO POR CIENTO (35%)',
    40: 'CUARENTA POR CIENTO (40%)',
  };
  return palabras[parseInt(n)] || `${n} POR CIENTO (${n}%)`;
}

function porcentajeTextoSimple(n) {
  const palabras = {
    20: 'veinte por ciento',
    25: 'veinticinco por ciento',
    30: 'treinta por ciento',
    35: 'treinta y cinco por ciento',
    40: 'cuarenta por ciento',
  };
  return palabras[parseInt(n)] || `${n} por ciento`;
}

// Formatea una fecha ISO (YYYY-MM-DD) a texto legible
function fechaTexto(iso) {
  if (!iso) return '';
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`;
}

// Calcula años entre dos fechas
function aniosEntre(fechaIso1, fechaIso2) {
  if (!fechaIso1 || !fechaIso2) return '';
  const d1 = new Date(fechaIso1);
  const d2 = new Date(fechaIso2);
  const años = Math.abs(Math.round((d2 - d1) / (1000 * 60 * 60 * 24 * 365)));
  return años.toString();
}

// Formatea DNI con puntos (31655988 → 31.655.988)
function formatDNI(dni) {
  if (!dni) return '';
  const n = dni.replace(/\D/g, '');
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Elige qué template usar según los datos del formulario
function elegirTemplate(datos) {
  const tramite = (datos.tramite || '').toUpperCase();
  if (tramite === 'ALIMENTOS') {
    if (datos.dem_trabajo_reg === 'SI') return 'tpl_alimentos_registrado.docx';
    return 'tpl_alimentos_informal.docx';
  }
  if (tramite === 'DIVORCIO') {
    if (datos.tiene_bienes === 'SI' || datos.hijos_menores === 'SI') {
      return 'tpl_divorcio_con_propuesta.docx';
    }
    return 'tpl_divorcio_sin_propuesta.docx';
  }
  return null; // Otros trámites: sin demanda automática por ahora
}

// Construye el objeto de datos para llenar el template
function construirContexto(d) {
  // Nombre corto del hijo (iniciales) para el template de alimentos informal
  const hijoNombreCorto = d.hijo_nombre
    ? d.hijo_nombre.split(' ').map(p => p[0]).join('.') + '.'
    : '';

  return {
    // Solicitante
    solicitante_nombre:    (d.nombre || '').toUpperCase(),
    solicitante_dni:       formatDNI(d.dni),
    solicitante_cuil:      d.cuil || '',
    solicitante_domicilio: d.domicilio ? `${d.domicilio}, ${d.localidad}` : d.localidad || '',
    solicitante_tel:       d.tel || '',
    solicitante_email:     d.email || '',

    // Hijo/a
    hijo_nombre:           (d.hijo_nombre || '').toUpperCase(),
    hijo_nombre_corto:     hijoNombreCorto.toUpperCase(),
    hijo_dni:              formatDNI(d.hijo_dni),
    hijo_cuil:             d.hijo_cuil || '',
    hijo_fecha_nac:        fechaTexto(d.hijo_fnac),

    // Demandado/a (contraparte)
    demandado_nombre:      (d.cont_nombre || '').toUpperCase(),
    demandado_dni:         formatDNI(d.cont_dni),
    demandado_cuil:        d.cont_cuil || '',
    demandado_domicilio:   d.cont_domicilio ? `${d.cont_domicilio}, ${d.cont_localidad || ''}` : d.cont_localidad || '',
    demandado_tel:         d.cont_tel || '',
    demandado_trabajo_tipo: d.dem_trabajo_tipo || 'trabajador/a informal',

    // Empresa (alimentos registrado)
    empresa_nombre:        (d.empresa_nombre || '').toUpperCase(),
    empresa_cuil:          d.empresa_cuil || '',
    empresa_domicilio:     d.empresa_domicilio || '',
    empresa_ciudad:        d.empresa_ciudad ? `la Ciudad de ${d.empresa_ciudad}` : 'su ciudad',

    // Porcentajes alimentos
    porcentaje_prov_texto: porcentajeTexto(d.porcentaje_prov || 20),
    porcentaje_def:        d.porcentaje_def || '30',
    porcentaje_def_texto:  porcentajeTextoSimple(d.porcentaje_def || 30),

    // Abuelos (vía subsidiaria)
    abuelo_nombre:         (d.abuelo_nombre || '').toUpperCase(),
    abuelo_dni:            formatDNI(d.abuelo_dni),
    abuelo_domicilio:      d.abuelo_domicilio || '',
    abuelo_trabajo:        d.abuelo_trabajo || 'trabajador informal',
    abuelo_tel:            d.abuelo_tel || '',
    abuela_nombre:         (d.abuela_nombre || '').toUpperCase(),
    abuela_dni:            formatDNI(d.abuela_dni),
    abuela_domicilio:      d.abuela_domicilio || '',
    abuela_trabajo:        d.abuela_trabajo || '',
    abuela_tel:            d.abuela_tel || '',

    // Divorcio - cónyuge
    conyuge_nombre:        (d.cont_nombre || '').toUpperCase(),
    conyuge_dni:           formatDNI(d.cont_dni),
    conyuge_cuil:          d.cont_cuil || '',
    conyuge_domicilio:     d.cont_domicilio ? `${d.cont_domicilio}, ${d.cont_localidad || ''}` : d.cont_localidad || '',
    conyuge_tel:           d.cont_tel || '',

    // Divorcio - matrimonio
    fecha_matrimonio_texto: fechaTexto(d.fecha_matrimonio),
    mat_acta_nro:          d.mat_acta_nro || '____',
    mat_tomo:              d.mat_tomo || '____',
    mat_folio:             d.mat_folio || '____',
    mat_anio:              d.mat_anio || '____',
    mat_ciudad:            d.mat_ciudad || 'Corrientes',
    fecha_separacion_texto: fechaTexto(d.fecha_separacion),
    anios_separacion:      aniosEntre(d.fecha_separacion, new Date().toISOString().split('T')[0]),

    // Apellido del demandado (para alimentos informal)
    demandado_apellido:    d.cont_nombre ? d.cont_nombre.split(' ')[0] : '[REVISAR: apellido demandado]',

    // Divorcio - hijos y bienes
    hijos_nombres:         d.datos_hijos_div || '[REVISAR: consignar nombres, DNI y edades de los hijos]',
    desc_bienes:           d.desc_bienes || '[REVISAR: describir el bien]',

    // Convenio regulador - cuidado personal (texto dinámico según si hay hijos menores)
    convenio_cuidado_personal: (d.hijos_menores === 'SI' && d.datos_hijos_div)
      ? `de nuestra unión han nacido hijos/as menores de edad: ${d.datos_hijos_div}. [REVISAR: acordar cuidado personal, régimen de comunicación y cuota alimentaria].`
      : `de nuestra unión han nacido hijos/as que a la fecha son todos mayores de edad, por lo que no corresponde el tratamiento de cuestiones relativas al cuidado personal, régimen de comunicación ni fijación de cuota alimentaria.`,

    // Convenio regulador - bienes (texto dinámico)
    convenio_bienes: d.desc_bienes
      ? `se propone la siguiente distribución respecto del bien/inmueble: ${d.desc_bienes}. [REVISAR: completar propuesta según el caso].`
      : '[REVISAR: describir los bienes y formular propuesta de distribución].',

    // Situación laboral — usada en divorcio con propuesta y alimentos informal
    solicitante_ocupacion: d.ocupacion
      ? `${d.ocupacion.toLowerCase()}${d.recibo === 'SI' ? '' : ' de manera informal'}`
      : '[REVISAR: describir ocupación]',

    solicitante_situacion_laboral: d.ocupacion
      ? `no tengo empleo registrado, ya que me dedico a ${d.ocupacion.toLowerCase()} de manera ${d.recibo === 'SI' ? 'registrada' : 'informal'}, percibiendo ingresos de aproximadamente $${d.monto || '____'} ${(d.freq || 'mensuales').toLowerCase()}`
      : '[REVISAR: describir situación laboral del/la solicitante]',
  };
}

// Genera el .docx relleno y devuelve un Buffer
function generarDocx(templatePath, contexto) {
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });
  doc.render(contexto);
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ── Llama al Apps Script para Drive + Sheets ─────────────────────────────────
async function llamarAppsScript(datos, docxBase64) {
  if (!APPS_SCRIPT_URL) return null;
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...datos, docxBase64 }),
      redirect: 'follow',
    });
    const json = await resp.json();
    return json.success ? json : null;
  } catch (err) {
    console.warn('Apps Script error (no crítico):', err.message);
    return null;
  }
}

// ── Handler principal ────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const datos = req.body;
    if (!datos || !datos.nombre) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const nombre    = datos.nombre.replace(/\s+/g, '_');
    const tramite   = datos.tramite || 'ADMISION';
    const contexto  = construirContexto(datos);
    const adjuntos  = [];
    let   docxBase64 = null;

    // 1. PDF de la Declaración Jurada (viene del formulario)
    if (datos.pdfBase64) {
      adjuntos.push({
        filename: `FDJ_${nombre}_${tramite}.pdf`,
        content:  datos.pdfBase64,
      });
    }

    // 2. Demanda en Word (generada automáticamente)
    const templateName = elegirTemplate(datos);
    if (templateName) {
      const templatePath = path.join(process.cwd(), 'templates', templateName);
      if (fs.existsSync(templatePath)) {
        const docxBuffer = generarDocx(templatePath, contexto);
        docxBase64 = docxBuffer.toString('base64');
        adjuntos.push({
          filename: `DEMANDA_${nombre}_${tramite}.docx`,
          content:  docxBase64,
        });
      } else {
        console.warn('Template no encontrado:', templatePath);
      }
    }

    // 3. Crear carpeta en Drive + registrar en Sheets (via Apps Script)
    const driveResult = await llamarAppsScript(datos, docxBase64);
    const carpetaUrl  = driveResult?.carpetaUrl || null;
    const sheetUrl    = driveResult?.sheetUrl   || null;

    // 4. Cuerpo del email con todos los datos
    const cuerpo = `
FORMULARIO DE ADMISIÓN — DEFENSORÍA DE POBRES Y AUSENTES N°1
=============================================================
Trámite : ${tramite}
Fecha   : ${new Date().toLocaleDateString('es-AR')}

SOLICITANTE
-----------
Nombre   : ${datos.nombre}
DNI      : ${datos.dni}
CUIL     : ${datos.cuil}
Tel      : ${datos.tel}
Domicilio: ${datos.domicilio}, ${datos.localidad}

CONTRAPARTE
-----------
Nombre   : ${datos.cont_nombre}
DNI      : ${datos.cont_dni}
Domicilio: ${datos.cont_domicilio}, ${datos.cont_localidad || ''}
Tel      : ${datos.cont_tel || ''}

${tramite === 'ALIMENTOS' ? `DATOS ALIMENTOS
---------------
Hijo/a   : ${datos.hijo_nombre} (DNI ${datos.hijo_dni})
Trabajo dem.: ${datos.dem_trabajo_reg === 'SI' ? `Registrado — ${datos.empresa_nombre || ''}` : 'Informal'}
Vía subsidiaria: ${datos.tiene_abuelos || 'No'}` : ''}

${tramite === 'DIVORCIO' ? `DATOS DIVORCIO
--------------
Matrimonio : ${fechaTexto(datos.fecha_matrimonio)} en ${datos.mat_ciudad || 'Corrientes'}
Separación : ${fechaTexto(datos.fecha_separacion)}
Hijos menores: ${datos.hijos_menores || 'No'}
Bienes       : ${datos.tiene_bienes || 'No'}` : ''}

Observaciones: ${datos.observaciones || '—'}

${carpetaUrl ? `CARPETA EN DRIVE
----------------
${carpetaUrl}` : ''}
${sheetUrl ? `\nPLANILLA ADMISIONES\n-------------------\n${sheetUrl}` : ''}
=============================================================
    `.trim();

    // 6. Enviar por Resend
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:        'DPA Formulario <onboarding@resend.dev>',
        to:          ['sec5dpa@gmail.com'],
        subject:     `[ADMISIÓN] ${datos.nombre} — ${tramite}`,
        text:        cuerpo,
        attachments: adjuntos,
      }),
    });

    const result = await resp.json();
    if (!resp.ok) throw new Error(result.message || JSON.stringify(result));

    console.log('Email enviado OK:', result.id);
    return res.status(200).json({
      success: true,
      emailId: result.id,
      ...(carpetaUrl ? { carpetaUrl } : {}),
    });

  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};
