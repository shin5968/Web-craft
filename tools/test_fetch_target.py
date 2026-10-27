import hashlib
import unittest
from unittest.mock import patch

from fetch_target import read_url, verified_download


class DownloadTests(unittest.TestCase):
    def test_unapproved_url_is_rejected(self):
        for url in ('http://piston-data.mojang.com/x', 'https://example.com/x'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                read_url(url)

    @patch('fetch_target.read_url', return_value=b'fixture')
    def test_hash_and_size_verification(self, read):
        item = {'url':'https://piston-data.mojang.com/x',
                'sha1':hashlib.sha1(b'fixture').hexdigest(), 'size':7}
        self.assertEqual(verified_download(item), b'fixture')
        with self.assertRaises(ValueError):
            verified_download({**item, 'size':8})
        with self.assertRaises(ValueError):
            verified_download({**item, 'sha1':'0' * 40})


if __name__ == '__main__':
    unittest.main()
