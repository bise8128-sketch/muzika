import os
import yt_dlp
import logging
from utils import ensure_dir

logger = logging.getLogger('Downloader')

class AudioDownloader:
    def __init__(self, output_dir="downloads"):
        self.output_dir = output_dir
        ensure_dir(self.output_dir)

    def download(self, url, format='mp3'):
        """
        Downloads audio from a YouTube URL.
        Returns the path to the downloaded file.
        """
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(self.output_dir, '%(title)s.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': format,
                'preferredquality': '192',
            }],
            'logger': logger,
            'quiet': False, # Let user see progress
            'overwrites': True,
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
