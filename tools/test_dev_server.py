import threading
import unittest
from functools import partial
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import urlopen

from dev_server import Handler, WEB_ROOT


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(WEB_ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_page_and_module_have_isolation_headers(self):
        for path in ('/', '/runtime-probes.mjs'):
            with self.subTest(path=path), urlopen(self.base + path) as response:
                self.assertEqual(response.headers['Cross-Origin-Opener-Policy'], 'same-origin')
                self.assertEqual(response.headers['Cross-Origin-Embedder-Policy'], 'require-corp')
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
                self.assertTrue(response.read())
                if path.endswith('.mjs'):
                    self.assertEqual(response.headers.get_content_type(), 'text/javascript')

    def test_repository_source_is_not_served(self):
        with self.assertRaises(HTTPError) as error:
            urlopen(self.base + '/tools/fetch_target.py')
        self.assertEqual(error.exception.code, 404)


if __name__ == '__main__':
    unittest.main()
