use std::io::{self, Read};
use serde::{Deserialize, Serialize};

#[path = "../engine.rs"]
mod engine;

use engine::KeyFlipEngine;

#[derive(Deserialize)]
struct TestCase {
    text: String,
    l1: String,
    l2: String,
}

#[derive(Serialize)]
struct TestResult {
    converted: String,
    from_1_to_2: bool,
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).expect("Failed to read stdin");

    let cases: Vec<TestCase> = serde_json::from_str(&input).expect("Failed to parse JSON");
    let engine = KeyFlipEngine::global();

    let results: Vec<TestResult> = cases
        .into_iter()
        .map(|c| {
            let (converted, from_1_to_2) = engine.convert_text_between(&c.text, &c.l1, &c.l2);
            TestResult { converted, from_1_to_2 }
        })
        .collect();

    println!("{}", serde_json::to_string(&results).unwrap());
}
