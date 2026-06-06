from http.server import BaseHTTPRequestHandler
import json
import base64
import os
import urllib.request
import urllib.error
from datetime import datetime

RESEND_API_KEY = os.getenv('RESEND_API_KEY')

class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            datos = json.loads(self.rfile.read(length).decode('utf-8'))
            enviar_email(datos)
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode())

    def log_message(self, *args):
        pass

def enviar_email(datos):
    pdf_b64 = datos.get('pdfBase64', '')
    nombre = datos.get('nombre', 'formulario').replace(' ', '_')
    
    cuerpo = f"""FORMULARIO DE ADMISION - DEFENSORIA DPA N1

Nombre: {datos.get('nombre')}
DNI: {datos.get('dni')} | CUIL: {datos.get('cuil')}
Tel: {datos.get('tel')} | Email: {datos.get('email','---')}
Localidad: {datos.get('localidad')} - {datos.get('barrio')}
Domicilio: {datos.get('domicilio')}

Ocupacion: {datos.get('ocupacion')}
Ingresos: ${datos.get('monto')} {datos.get('freq')}
Recibo: {datos.get('recibo')} | Planes: {datos.get('planes')}
Grupo: {datos.get('grupo')} personas | Total: ${datos.get('total_ing')}
Vivienda: {datos.get('vivienda')} ({datos.get('anios_vivienda')} anios)

Contrario: {datos.get('cont_nombre')} | DNI: {datos.get('cont_dni','---')}
Localidad: {datos.get('cont_localidad')} - {datos.get('cont_barrio')}
Domicilio: {datos.get('cont_domicilio')}
Tel: {datos.get('cont_tel','---')} | Trabajo: {datos.get('cont_trabajo','---')}

Tramite: {datos.get('tramite')}
Hijos: {datos.get('datos_hijos','---')}
Expediente: {datos.get('nro_exp','---')}
Observaciones: {datos.get('observaciones','---')}

Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}"""

    payload = {
        "from": "DPA Formulario <onboarding@resend.dev>",
        "to": ["sec5dpa@gmail.com"],
        "subject": f"[ADMISION] {datos.get('nombre')} - {datos.get('tramite')}",
        "text": cuerpo
    }

    if pdf_b64:
        payload["attachments"] = [{
            "filename": f"FDJ_{nombre}_{datetime.now().strftime('%Y%m%d')}.pdf",
            "content": pdf_b64
        }]

    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        'https://api.resend.com/emails',
        data=data,
        headers={
            'Authorization': f'Bearer {RESEND_API_KEY}',
            'Content-Type': 'application/json'
        }
    )
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())
