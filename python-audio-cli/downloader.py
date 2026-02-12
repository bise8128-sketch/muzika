import os
import yt_dlp
import logging
from utils import ensure_dir

logger = logging.getLogger('Downloader')

class AudioDownloader:
    def __init__(self, output_dir="downloads"):
        self.output_dir = output_dir
        ensure_dir(self.output_dir)

    def _get_random_user_agent(self):
        import random
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0'
        ]
        return random.choice(user_agents)

    def download(self, url, format='mp3'):
        """
        Downloads audio from a YouTube URL.
        Returns the path to the downloaded file.
        """
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(self.output_dir, '%(title)s.%(ext)s'),
            'restrictfilenames': True,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': format,
                'preferredquality': '192',
            }],
            'logger': logger,
            'quiet': False, # Let user see progress
            'overwrites': True,
            'noplaylist': True,
            'http_headers': {
                'User-Agent': self._get_random_user_agent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            # 'nocheckcertificate': True, # REMOVED: Enable SSL verification for security
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                # Filename might have changed due to postprocessing
                filename = ydl.prepare_filename(info)
                base, _ = os.path.splitext(filename)
                final_filename = f"{base}.{format}"
                
                logger.info(f"Downloaded: {final_filename}")
                return final_filename
        except Exception as e:
            logger.error(f"Download failed: {e}")
            raise
