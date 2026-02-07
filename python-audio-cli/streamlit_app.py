import streamlit as st
import os
import sys
import logging

# Add current directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from downloader import AudioDownloader
from separator import AudioSeparator

st.set_page_config(page_title="Muzika AI Audio Tool", layout="wide")

st.title("🎵 YouTube to Audio & AI Separation")
st.markdown("Download high-quality audio from YouTube and separate it into stems using Demucs AI.")

with st.sidebar:
    st.header("Settings")
    format_option = st.selectbox("Download Format", ["mp3", "wav"], index=0)
    separate_option = st.checkbox("Separate Stems", value=True, help="Split audio into Vocals, Drums, Bass, and Other")
    keep_original = st.checkbox("Keep Original File", value=True)

url = st.text_input("YouTube URL", placeholder="https://www.youtube.com/watch?v=...")

if st.button("Start Processing", type="primary"):
    if not url:
        st.error("Please enter a valid YouTube URL.")
    else:
        try:
            # Setup directories
            base_dir = "output"
            download_dir = os.path.join(base_dir, "downloads")
            stems_dir = os.path.join(base_dir, "stems")
            
            # Initialize components
            downloader = AudioDownloader(output_dir=download_dir)
            
            # Step 1: Download
            with st.status("Processing...", expanded=True) as status:
                st.write("📥 Downloading audio from YouTube...")
                audio_path = downloader.download(url, format=format_option)
                st.write(f"✅ Download complete: `{os.path.basename(audio_path)}`")
                
                # Show original audio
                st.audio(audio_path)
                
                # Step 2: Separation
                if separate_option:
                    st.write("🤖 Loading AI model and separating sources...")
                    separator = AudioSeparator(output_dir=stems_dir)
                    stems = separator.separate(audio_path)
                    st.write("✨ Separation complete!")
                    
                    status.update(label="Processing Complete!", state="complete", expanded=False)
                    
                    # Display Results
                    st.divider()
                    st.subheader("Separated Stems")
                    
                    # Create columns for stems
                    cols = st.columns(len(stems))
                    for i, (stem_name, stem_path) in enumerate(stems.items()):
                        with cols[i]:
                            st.markdown(f"**{stem_name.capitalize()}**")
                            st.audio(stem_path)
                            with open(stem_path, "rb") as f:
                                st.download_button(
                                    label=f"⬇️ {stem_name}",
                                    data=f,
                                    file_name=os.path.basename(stem_path),
                                    mime="audio/wav"
                                )
                else:
                    status.update(label="Download Complete!", state="complete", expanded=False)
                    with open(audio_path, "rb") as f:
                        st.download_button(
                            label="⬇️ Download Audio",
                            data=f,
                            file_name=os.path.basename(audio_path),
                            mime=f"audio/{format_option}"
                        )

        except Exception as e:
            st.error(f"An error occurred: {str(e)}")
            st.exception(e)

st.markdown("---")
st.caption("Powered by yt-dlp and Demucs (via torchaudio)")
