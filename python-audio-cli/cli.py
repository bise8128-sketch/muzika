import argparse
import sys
import os
import logging
from utils import setup_logging, cleanup_dir
from downloader import AudioDownloader
from separator import AudioSeparator

def main():
    parser = argparse.ArgumentParser(description="YouTube to Audio & Separation CLI")
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument("--format", choices=["mp3", "wav"], default="mp3", help="Audio format for download")
    parser.add_argument("--separate", action="store_true", help="Separate audio into stems")
    parser.add_argument("--output", default="output", help="Output directory")
    parser.add_argument("--keep-original", action="store_true", help="Keep the original downloaded file after separation")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    # Setup logging
    level = logging.DEBUG if args.verbose else logging.INFO
    logger = setup_logging(level)

    try:
        # Initialize components
        downloader = AudioDownloader(output_dir=os.path.join(args.output, "downloads"))
        
        if args.separate:
            separator = AudioSeparator(output_dir=os.path.join(args.output, "stems"))

        # Step 1: Download
        logger.info(f"Starting download for: {args.url}")
        audio_path = downloader.download(args.url, format=args.format)
        logger.info(f"Download complete: {audio_path}")

        # Step 2: Separation (optional)
        if args.separate:
            logger.info("Starting source separation...")
            stems = separator.separate(audio_path)
            logger.info("Separation complete!")
            for stem, path in stems.items():
                logger.info(f"  - {stem}: {path}")
            
            # Cleanup original if requested
            if not args.keep_original:
                logger.info("Removing original file...")
                os.remove(audio_path)

        logger.info("All tasks completed successfully.")

    except KeyboardInterrupt:
        logger.warning("Operation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        logger.critical(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
