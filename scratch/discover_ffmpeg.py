import static_ffmpeg
import os
import inspect

print(f"File: {static_ffmpeg.__file__}")
# Try common patterns
from static_ffmpeg import run
try:
    # Let's see what attributes it has
    import static_ffmpeg.run
    print(f"Dir of run: {dir(static_ffmpeg.run)}")
except:
    pass
