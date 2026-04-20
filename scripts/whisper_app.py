import sys
import json
import argparse
from faster_whisper import WhisperModel

def format_timestamp(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

def write_burst_srt(segments, filename, word_limit=3):
    """Generates viral 'Burst' subtitles with few words per segment."""
    with open(filename, "w", encoding="utf-8") as f:
        counter = 1
        for segment in segments:
            # Check if segment has word-level timestamps
            if hasattr(segment, 'words') and segment.words:
                words = segment.words
                # Group words into bursts
                for i in range(0, len(words), word_limit):
                    chunk = words[i:i + word_limit]
                    start = chunk[0].start
                    end = chunk[-1].end
                    text = " ".join([w.word.strip() for w in chunk])
                    
                    f.write(f"{counter}\n")
                    f.write(f"{format_timestamp(start)} --> {format_timestamp(end)}\n")
                    f.write(f"{text.upper()}\n\n") # Viral style often uses UPPERCASE
                    counter += 1
            else:
                # Fallback to standard segment if no word info
                f.write(f"{counter}\n")
                f.write(f"{format_timestamp(segment.start)} --> {format_timestamp(segment.end)}\n")
                f.write(f"{segment.text.strip().upper()}\n\n")
                counter += 1

def main():
    parser = argparse.ArgumentParser(description="Transcribe video with Viral Burst subtitles")
    parser.add_argument("--video", required=True, help="Path to the video file")
    parser.add_argument("--output-dir", default=".", help="Directory to save output files")
    parser.add_argument("--model", default="base", help="Whisper model size (base, small, medium, etc)")
    args = parser.parse_args()

    model_size = args.model
    print(f"Loading {model_size} model...")
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    print(f"Transcribing with Word-Level Timestamps: {args.video}...")
    # Enable word_timestamps for Burst subtitles
    segments, info = model.transcribe(args.video, beam_size=5, word_timestamps=True)

    total_duration = info.duration
    transcript = []
    all_segments_for_srt = []
    
    for segment in segments:
        transcript.append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text
        })
        all_segments_for_srt.append(segment)
        
        if total_duration > 0:
            percent = min(100, int((segment.end / total_duration) * 100))
            print(f"PROGRESS:{percent}")
            sys.stdout.flush()

    import os
    json_path = os.path.join(args.output_dir, "transcript_output.json")
    srt_path = os.path.join(args.output_dir, "transcript_output.srt")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"language": info.language, "segments": transcript}, f, ensure_ascii=False, indent=2)

    write_burst_srt(all_segments_for_srt, srt_path)
    print(f"Transcription complete. Viral Burst SRT generated at: {srt_path}")

if __name__ == "__main__":
    main()
