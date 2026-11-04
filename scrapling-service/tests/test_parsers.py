import os
import pytest
from fastapi.testclient import TestClient

from app import app
from parsers.summary_parser import parse_summary
from parsers.question_paper_parser import parse_question_paper
from parsers.solution_parser import parse_solution

FIXTURE_PATH = "/Users/red/Desktop/proj/sampletestbook.html"

@pytest.fixture(scope="session")
def sample_html():
    if not os.path.exists(FIXTURE_PATH):
        pytest.skip(f"Fixture file not found: {FIXTURE_PATH}")
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        return f.read()

@pytest.fixture
def client():
    return TestClient(app)

def test_summary_parser(sample_html):
    summary = parse_summary(sample_html)
    
    assert summary.overallScore == pytest.approx(85.93, rel=1e-2)
    assert len(summary.sections) == 2
    assert summary.totalQuestions == 130

    # Paper 1: 80 questions, 27 correct, 9 incorrect, 44 skipped, 30.93 marks
    p1 = summary.sections[0]
    assert p1.sectionName == "Paper 1"
    assert p1.questionCount == 80
    assert p1.correctCount == 27
    assert p1.incorrectCount == 9
    assert p1.skippedCount == 44
    assert p1.marks == pytest.approx(30.93, rel=1e-2)

    # Paper 2: 50 questions, 30 correct, 10 incorrect, 10 skipped, 55 marks
    p2 = summary.sections[1]
    assert p2.sectionName == "Paper 2"
    assert p2.questionCount == 50
    assert p2.correctCount == 30
    assert p2.incorrectCount == 10
    assert p2.skippedCount == 10
    assert p2.marks == pytest.approx(55.0, rel=1e-2)

def test_question_paper_parser(sample_html):
    questions = parse_question_paper(sample_html)
    
    assert len(questions) == 130

    paper1_questions = [q for q in questions if "Paper 1" in q.section]
    paper2_questions = [q for q in questions if "Paper 2" in q.section]

    assert len(paper1_questions) == 80
    assert len(paper2_questions) == 50

    q1 = questions[0]
    assert q1.questionNumber == 1
    assert "Tamil Nadu" in q1.questionText
    assert len(q1.options) == 5

def test_solution_parser(sample_html):
    sol = parse_solution(sample_html)
    
    assert sol.questionNumber == 1
    assert sol.status.lower() == "skipped"
    assert "Tamil Nadu" in sol.questionText
    assert len(sol.options) == 5
    assert "Puliyankudi Acid Lime" in sol.explanation
    assert sol.correctAnswer is not None
    assert "Puliyankudi Acid Lime" in sol.correctAnswer

def test_api_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "scrapling_version" in data

def test_api_summary_endpoint(client, sample_html):
    res = client.post("/parse/summary", json={"html": sample_html})
    assert res.status_code == 200
    data = res.json()
    assert data["totalQuestions"] == 130
    assert len(data["sections"]) == 2
    assert data["overallScore"] == pytest.approx(85.93, rel=1e-2)

def test_api_question_paper_endpoint(client, sample_html):
    res = client.post("/parse/question-paper", json={"html": sample_html})
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 130

def test_api_solution_endpoint(client, sample_html):
    res = client.post("/parse/solution", json={"html": sample_html})
    assert res.status_code == 200
    data = res.json()
    assert data["questionNumber"] == 1
    assert "Puliyankudi Acid Lime" in data["explanation"]

