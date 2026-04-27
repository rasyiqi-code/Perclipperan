import sys
import json
import argparse
import os
import urllib.request
import urllib.error
import re
import subprocess

def parse_llm_json(text):
    # LLM might return markdown ```json ... ```
    match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    return json.loads(text)

def main():
    if len(sys.argv) < 3:
        print("FATAL: Missing arguments. Expected: [transcript_path] [output_dir] [llm_provider] [api_key] [app_dir]")
        sys.exit(1)

    transcript_path = sys.argv[1]
    output_dir = sys.argv[2]
    llm_provider = sys.argv[3] if len(sys.argv) > 3 else "openrouter"
    api_key = sys.argv[4] if len(sys.argv) > 4 else ""
    app_dir = sys.argv[5] if len(sys.argv) > 5 else output_dir
    llm_model = sys.argv[6] if len(sys.argv) > 6 else ("openrouter/free" if llm_provider == "openrouter" else "openai/gpt-4o-mini")

    try:
        with open(transcript_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading transcript at {transcript_path}: {e}")
        sys.exit(1)

    segments = data.get("segments", [])
    if not segments:
        print("No segments found in transcript.")
        return

    # Build transcript text for prompt
    transcript_text = ""
    for seg in segments:
        transcript_text += f"[{seg['start']:.1f} - {seg['end']:.1f}] {seg['text'].strip()}\n"

    prompt = f"""You are an expert viral video editor like OpusClip. 
Analyze the following transcript and find the most engaging, viral, and complete thoughts to turn into short-form videos (TikTok/Reels/Shorts).
Each clip MUST be between 60 and 180 seconds long. Do not generate clips shorter than 60 seconds or longer than 180 seconds.
Ensure that the start and end times match the natural start and end of sentences. Do not cut someone off mid-sentence.
Provide a catchy hook, a short summary, and a virality score (1-100).

Return ONLY a JSON object in the exact format:
{{
  "clips": [
    {{
      "id": "1",
      "hook": "Catchy Hook Here",
      "summary": "Brief summary",
      "start_time": 10.5,
      "end_time": 45.2,
      "score": 95
    }}
  ]
}}

Transcript:
{transcript_text}"""

    print("PROGRESS:20")
    print(f"Sending transcript to {llm_provider} (Model: {llm_model})...")
    sys.stdout.flush()

    clips = []
    try:
        if llm_provider == "openrouter":
            if not api_key:
                raise ValueError("OpenRouter selected but no API key provided")
            
            url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": llm_model,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "temperature": 0
            }
            
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req) as response:
                result_data = json.loads(response.read().decode('utf-8'))
                if 'choices' not in result_data:
                    print(f"FATAL: API Error - {json.dumps(result_data)}")
                    sys.exit(1)
                response_text = result_data['choices'][0]['message']['content']
                parsed_result = parse_llm_json(response_text)
                clips = parsed_result.get("clips", [])

        elif llm_provider == "local_standalone":
            print("STANDALONE-AI: Loading engine and model...")
            sys.stdout.flush()
            
            llama_cli = os.path.join(app_dir, "llama_bin", "llama-cli.exe")
            model_path = os.path.join(app_dir, "phi-3-mini.gguf")
            
            if not os.path.exists(llama_cli):
                raise FileNotFoundError(f"Llama engine not found at {llama_cli}. Please download it in Settings.")
            if not os.path.exists(model_path):
                raise FileNotFoundError(f"Model not found at {model_path}. Please download it in Settings.")
            
            # Simple call to llama-cli
            # We use -n 512 for max tokens and --temp 0 for deterministic output
            cmd = [
                llama_cli, 
                "-m", model_path, 
                "-p", prompt, 
                "-n", "1024",
                "--temp", "0.2",
                "--no-display-prompt"
            ]
            
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
            stdout, stderr = process.communicate()
            
            if process.returncode != 0:
                print(f"Llama CLI Error: {stderr}")
                raise Exception("Llama engine failed to process the transcript.")
            
            # Find JSON in the output
            parsed_result = parse_llm_json(stdout)
            clips = parsed_result.get("clips", [])

        else: # ollama (fallback)
            url = "http://localhost:11434/api/chat"
            headers = {"Content-Type": "application/json"}
            payload = {
                "model": "llama3",
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "format": "json"
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req) as response:
                result_data = json.loads(response.read().decode('utf-8'))
                response_text = result_data['message']['content']
                parsed_result = parse_llm_json(response_text)
                clips = parsed_result.get("clips", [])
            
    except urllib.error.URLError as e:
        print(f"FATAL: Network error connecting to {llm_provider}. Make sure it is running or you have internet. Details: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"FATAL: AI Analysis failed: {str(e)}")
        sys.exit(1)

    result = {
        "clips": clips,
        "total_clips": len(clips)
    }

    json_path = os.path.join(output_dir, "analysis_output.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        
    print("PROGRESS:100")
    print(f"Transcript Analysis Complete. Generated {len(clips)} semantic clips.")
    sys.stdout.flush()

if __name__ == "__main__":
    main()
