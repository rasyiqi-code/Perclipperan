use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoClip {
    #[serde(default = "default_id")]
    pub id: String,
    pub hook: String,
    pub summary: String,
    #[serde(default = "default_start")]
    pub start_time: f64,
    #[serde(default = "default_end")]
    pub end_time: f64,
    #[serde(default = "default_score")]
    pub score: i32,
}

fn default_id() -> String { "1".to_string() }
fn default_start() -> f64 { 0.0 }
fn default_end() -> f64 { 30.0 }
fn default_score() -> i32 { 90 }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalysisResult {
    pub clips: Vec<VideoClip>,
    pub total_clips: usize,
}
