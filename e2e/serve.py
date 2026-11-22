"""
Serves the exported web app (apps/mobile/dist) the way the API server does: /scan -> scan.html, unknown
paths -> index.html. For the browser tests, so they don't need Docker or the API.

    python3 e2e/serve.py apps/mobile/dist 8099
"""
import http.server
import json
import os
import sys

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'apps/mobile/dist')
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8099


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        # Just enough server for the app to know it's reachable and doesn't ask for sign-in (E2E_AUTH=none),
        # so the fridge opens as it does on a server without accounts.
        if self.path.split('?', 1)[0] == '/v1/status':
            body = json.dumps({
                'ok': True, 'db': True, 'ocr': True,
                'ai': {'enabled': False, 'model': '', 'usedToday': 0, 'limitPerDay': 0},
                'recipes': {'provider': 'themealdb', 'keyType': 'test'},
                'auth': {'provider': 'none'},
            }).encode()
            self.send_response(200)
            self.send_header('content-type', 'application/json')
            self.send_header('content-length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.startswith('/v1/'):
            self.send_error(404)
            return
        super().do_GET()

    def translate_path(self, path):
        clean = path.split('?', 1)[0].split('#', 1)[0]
        full = super().translate_path(clean)
        if os.path.isfile(full):
            return full
        for candidate in (full.rstrip('/') + '.html', os.path.join(full, 'index.html')):
            if os.path.isfile(candidate):
                return candidate
        return os.path.join(ROOT, 'index.html')

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
