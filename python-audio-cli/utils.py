import logging
import colorlog
import re
import os
import shutil

def setup_logging(level=logging.INFO):
    """Configures colorized logging."""
    handler = colorlog.StreamHandler()
    handler.setFormatter(colorlog.ColoredFormatter(
        '%(log_color)s%(levelname)s:%(name)s:%(message)s',
        log_colors={
            'DEBUG': 'cyan',
            'INFO': 'green',
            'WARNING': 'yellow',
            'ERROR': 'red',
            'CRITICAL': 'red,bg_white',
        }
    ))
    logger = colorlog.getLogger()
    logger.addHandler(handler)
    logger.setLevel(level)
    return logger

def sanitize_filename(filename):
    """Sanitizes a string to be safe for filenames."""
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def ensure_dir(path):
    """Ensures a directory exists."""
    if not os.path.exists(path):
        os.makedirs(path)

def cleanup_dir(path):
    """Removes a directory and its contents."""
    if os.path.exists(path):
        shutil.rmtree(path)
