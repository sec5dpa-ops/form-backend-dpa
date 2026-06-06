from http.server import BaseHTTPRequestHandler
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.utils import formatdate
from email import encoders
import json
import base64
import os
from datetime import datetime

GMAIL_EMAIL = os.getenv('GMAIL_EMAIL', 'sec5dpa@gmail.com')
GMAIL_PASSWORD = os.getenv('GMAIL_PASSWORD')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
}

class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'ok'}).encode())

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            datos = json.loads(body.decode('utf-8'))
            enviar_email(datos)
            self._respond(200, {'success': True, 'message': 'Email enviado'})
        except Exception as e:
            self._respond(500, {'success': False, 'error': str(e)})

    def _respond(self, code, data):
        self.send_response(code)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, *args):
        pass

def enviar_email(datos):
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.starttls()
    server.login(GMAIL_EMAIL, GMAIL_PASSWORD)

    msg = MIMEMultipart()
    msg['From'] = GMAIL_EMAIL
    msg['To'] = 'sec5dpa@gmail.com'
    msg['Date'] = formatdate(localtime=True)
    msg['Subject'] = f"[ADMISION] {datos.get('nombre')} - {datos.get('tramite')}"

    cuerpo = f"""FORMULARIO DE ADMISION - DEFENSORIA DE POBRES Y AUSENTES N1
{'='*55}

DATOS DEL SOLICITANTE:
Nombre: {datos.get('nombre')}
DNI: {datos.get('dni')} | CUIL: {datos.get('cuil')}
Fecha Nac: {datos.get('fnac')} | Tel: {datos.get('tel')}
Email: {datos.get('email','No proporcionado')}
Localidad: {datos.get('localidad')} - {datos.get('barrio')}
Domicilio: {datos.get('domicilio')}

SITUACION ECONOMICA:
Ocupacion: {datos.get('ocupacion')}
Ingresos: ${datos.get('monto')} {datos.get('freq')} | Recibo: {datos.get('recibo')}
Planes Sociales: {datos.get('planes')}
Grupo Familiar: {datos.get('grupo')} personas | Total: ${datos.get('total_ing')}
Vivienda: {datos.get('vivienda')} ({datos.get('anios_vivienda')} anios)

DATOS DE LA OTRA PERSONA:
Nombre: {datos.get('cont_nombre')} | DNI: {datos.get('cont_dni','---')}
Localidad: {datos.get('cont_localidad')} - {datos.get('cont_barrio')}
Domicilio: {datos.get('cont_domicilio')}
Tel: {datos.get('cont_tel','---')} | Trabajo: {datos.get('cont_trabajo','---')}
Ingresos: {datos.get('cont_ing')}

TRAMITE SOLICITADO:
Tipo: {datos.get('tramite')}
Hijos ({datos.get('cant_hijos','---')}): {datos.get('datos_hijos','---')}
Expediente: {datos.get('nro_exp','---')}
Observaciones: {datos.get('observaciones','---')}

{'='*55}
Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}
"""

    msg.attach(MIMEText(cuerpo, 'plain', 'utf-8'))

    pdf_b64 = datos.get('pdfBase64', '')
    if pdf_b64:
        att = MIMEBase('application', 'octet-stream')
        att.set_payload(base64.b64decode(pdf_b64))
        encoders.encode_base64(att)
        nombre = datos.get('nombre', 'formulario').replace(' ', '_')
        att.add_header('Content-Disposition', 'attachment',
                       filename=f"FDJ_{nombre}_{datetime.now().strftime('%Y%m%d')}.pdf")
        msg.attach(att)

    server.send_message(msg)
    server.quit()
