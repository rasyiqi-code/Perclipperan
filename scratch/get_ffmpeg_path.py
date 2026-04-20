from static_ffmpeg import run
try:
    ffmpeg, ffprobe = run.get_or_fetch_platform_executables_else_raise()
    print(ffmpeg)
except Exception as e:
    print(f"ERROR:{e}")
