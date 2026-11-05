import re
import unicodedata
from typing import List, Optional
from pydantic import BaseModel

DEVANAGARI = re.compile(r'[\u0900-\u097F]')
LABEL = re.compile(r'^\(?([A-Ea-e]|[1-5])[\).:\-]\s+')
from scrapling import Adaptor


class SolutionOption(BaseModel):
    index: int
    label: str
    text: str
    isCorrect: bool = False
    isSelected: bool = False
    stat: Optional[str] = None


class QuestionSolution(BaseModel):
    questionNumber: int
    section: Optional[str] = None
    questionText: str
    options: List[SolutionOption]
    correctAnswer: Optional[str] = None
    userAnswer: Optional[str] = None
    status: str
    marks: Optional[float] = None
    timeTaken: Optional[str] = None
    avgTime: Optional[str] = None
    explanation: str


def parse_solution(html: str) -> QuestionSolution:
    page = Adaptor(html)

    # 1. Question Number
    q_num = 1
    q_no_el = page.css_first(".tp-ques-number")
    if q_no_el and q_no_el.get_all_text():
        m = re.search(r'(\d+)', q_no_el.get_all_text())
        if m:
            q_num = int(m.group(1))

    # 2. Section Name
    sec_name = None
    active_sec_el = page.css_first("#sectionNavTabs li.active a span.hidden-xs, #sectionNavTabs li.active a span")
    if active_sec_el and active_sec_el.get_all_text():
        sec_name = active_sec_el.get_all_text().strip()

    # 3. Status Badge
    status = "skipped"
    status_el = page.css_first(".tp-info span.badge")
    if status_el and status_el.get_all_text():
        status = status_el.get_all_text().strip().lower()

    # 4. Timing
    time_taken = None
    avg_time = None
    info_el = page.css_first(".tp-info")
    if info_el and info_el.get_all_text():
        info_text = info_el.get_all_text()
        m_you = re.search(r'You:\s*([0-9:]+)', info_text)
        if m_you:
            time_taken = m_you.group(1)
        m_avg = re.search(r'Avg:\s*([0-9:]+)', info_text)
        if m_avg:
            avg_time = m_avg.group(1)

    # 5. Marks
    marks = 0.0
    marks_el = page.css_first(".tp-info .border-l1 span.badge")
    if marks_el and marks_el.get_all_text():
        m_marks = re.search(r'([0-9.-]+)', marks_el.get_all_text())
        if m_marks:
            marks = float(m_marks.group(1))

    # 6. Question Text
    q_desc_el = page.css_first("#questions [ng-bind-html*='getQuestionDesc'], #questions .mar-b16.qns-view-box, [ng-bind-html*='getQuestionDesc']")
    question_text = ""
    if q_desc_el:
        raw_q = q_desc_el.get_all_text() or q_desc_el.text or ""
        question_text = re.sub(r'\s+', ' ', raw_q.strip())

    # 7. Options
    raw_candidates = []
    # Target the active options list in #questions
    opt_elements = page.css("#questions ul.list-unstyled.clearfix.mar-b24 li.option")
    if not opt_elements:
        opt_elements = page.css("#questions ul.list-unstyled li.option:not(.ng-hide)")
    if not opt_elements:
        opt_elements = page.css(".detailed-question ul.list-unstyled li.option")

    for opt in opt_elements:
        desc_el = opt.css_first('[ng-bind-html*="parseDesc"], .qns-view-box, label')
        raw_text = (desc_el.get_all_text() or desc_el.text if desc_el else opt.get_all_text() or opt.text) or ""
        text = unicodedata.normalize('NFKC', raw_text)
        text = re.sub(r'\s+', ' ', text).strip()
        text = LABEL.sub('', text).strip()
        if not text:
            continue

        cls = opt.attrib.get("class", "")
        classes = set(cls.split())
        is_corr = bool({"correct-option", "correct-icon", "reattempt-correct-option"} & classes) and "incorrect-option" not in classes
        is_sel = bool({"incorrect-option", "actual-incorrect-option", "reattempt-icon", "selected"} & classes) and "correct-option" not in classes

        stat_el = opt.css_first(".option-stat")
        stat = (stat_el.get_all_text() or stat_el.text if stat_el else "").strip() or None

        raw_candidates.append({
            "text": text,
            "is_corr": is_corr,
            "is_sel": is_sel,
            "stat": stat
        })

    # If English and Hindi are mixed, keep the English set
    english = [item for item in raw_candidates if not DEVANAGARI.search(item["text"])]
    if len(english) >= 2 and len(english) < len(raw_candidates):
        raw_candidates = english

    # Dedupe by lowercased text, preserving order
    seen_texts = set()
    deduped = []
    for item in raw_candidates:
        key = item["text"].lower()
        if key not in seen_texts:
            seen_texts.add(key)
            deduped.append(item)

    options: List[SolutionOption] = []
    correct_answer = None
    user_answer = None

    for idx, item in enumerate(deduped):
        label = chr(65 + idx)
        if item["is_corr"]:
            correct_answer = item["text"]
        if item["is_sel"]:
            user_answer = item["text"]

        options.append(SolutionOption(
            index=idx,
            label=label,
            text=item["text"],
            isCorrect=item["is_corr"],
            isSelected=item["is_sel"],
            stat=item["stat"]
        ))

    # 8. Explanation
    sol_el = page.css_first('[ng-bind-html*="getSolutionDesc"], .sol-view-box, div[ng-show="isSet(1)"] .qns-view-box')
    explanation = ""
    if sol_el:
        raw_sol = sol_el.get_all_text() or sol_el.text or ""
        explanation = re.sub(r'\s+', ' ', raw_sol.strip())

    if not correct_answer and explanation:
        m_ans = re.search(r'The correct answer is\s*([^\n\r.]+)', explanation, re.IGNORECASE)
        if m_ans:
            correct_answer = m_ans.group(1).strip()

    return QuestionSolution(
        questionNumber=q_num,
        section=sec_name,
        questionText=question_text,
        options=options,
        correctAnswer=correct_answer,
        userAnswer=user_answer,
        status=status,
        marks=marks,
        timeTaken=time_taken,
        avgTime=avg_time,
        explanation=explanation
    )
