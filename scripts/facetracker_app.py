import sys
import cv2
import json
import argparse
import os

# Try to import mediapipe, fallback to simple center-crop if missing
try:
    import mediapipe as mp
    mp_face_detection = mp.solutions.face_detection
    HAS_MEDIAPIPE = True
except ImportError:
    HAS_MEDIAPIPE = False

def calculate_smart_center(video_path):
    if not os.path.exists(video_path):
        return 0.5  # Default center

    if not HAS_MEDIAPIPE:
        print("DEBUG: MediaPipe not found. Falling back to default center-crop.")
        return 0.5

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 0.5

    # Sample every 30 frames to save time
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    sample_interval = max(1, int(fps / 2)) # Every 0.5 seconds
    
    face_centers_x = []
    
    with mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5) as face_detection:
        for i in range(0, total_frames, sample_interval):
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            success, image = cap.read()
            if not success:
                break

            # Convert to RGB for MediaPipe
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = face_detection.process(image_rgb)

            if results.detections:
                # Get the largest face in frame
                largest_face = max(results.detections, key=lambda d: d.location_data.relative_bounding_box.width * d.location_data.relative_bounding_box.height)
                bbox = largest_face.location_data.relative_bounding_box
                center_x = bbox.xmin + (bbox.width / 2)
                face_centers_x.append(center_x)
            
            # Progress update for UI
            progress = int((i / total_frames) * 100)
            print(f"PROGRESS:{progress}")
            sys.stdout.flush()

    cap.release()

    if not face_centers_x:
        return 0.5 # Default to center if no faces found
    
    # Calculate median X to avoid outliers
    face_centers_x.sort()
    median_x = face_centers_x[len(face_centers_x) // 2]
    
    return float(median_x)

def main():
    parser = argparse.ArgumentParser(description="Analyze video for smart AI face cropping")
    parser.add_argument("--video", required=True, help="Path to the video file")
    parser.add_argument("--output-dir", default=".", help="Directory to save output files")
    args = parser.parse_args()

    print(f"Analyzing face movement in {args.video}...")
    
    try:
        smart_x_ratio = calculate_smart_center(args.video)
        
        result = {
            "center_x_ratio": smart_x_ratio,
            "aspect_ratio": "9:16",
            "method": "AI_SMART_CENTER" if HAS_MEDIAPIPE else "DEFAULT_CENTER"
        }
        
        output_path = os.path.join(args.output_dir, "face_tracking_output.json")
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)
            
        print(f"Face tracking complete. Result saved to: {output_path}")
    except Exception as e:
        print(f"ERROR: {str(e)}")
        # Save a default result on error so the pipeline doesn't break
        output_path = os.path.join(args.output_dir, "face_tracking_output.json")
        with open(output_path, "w") as f:
            json.dump({"center_x_ratio": 0.5, "method": "FALLBACK_ERROR"}, f)

if __name__ == "__main__":
    main()
