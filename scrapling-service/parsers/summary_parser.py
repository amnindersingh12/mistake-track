import re
from typing import List, Optional
from pydantic import BaseModel
from scrapling import Adaptor


class SectionSummary(BaseModel):
    sectionName: str
    questionCount: int
    correctCount: int
    incorrectCount: int
    skippedCount: int
    marks: float


class ExtractedResultSummary(BaseModel):
    examName: Optional[str] = None
    mockName: Optional[str] = None
    overallScore: float
    maxScore: Optional[float] = None
    totalQuestions: int
    sections: List[SectionSummary]


def parse_summary(html: str) -> ExtractedResultSummary:
    page = Adaptor(html)

    # 1. Exam / Mock Name
    mock_name = None
    exam_el = page.css_first(".top-header h6, #questionPaper h3, .test-top-bar h6")
    if exam_el and exam_el.text:
        mock_name = exam_el.text.strip()

    # 2. Overall Score
    overall_score = 0.0
    total_marks_el = page.css_first("#summaryModal h4, #questionPaper .header-inner h4")
    if total_marks_el and total_marks_el.text:
        m = re.search(r'(?:Total Marks|Marks)[:\s]*([0-9.]+)', total_marks_el.text, re.IGNORECASE)
        if m:
            overall_score = float(m.group(1))

    # 3. Section Breakdown from #summaryModal table
    sections: List[SectionSummary] = []
    rows = page.css("#summaryModal table tbody tr")

    if rows:
        for r in rows:
            sec_name_el = r.css_first('td[data-prompt="Section"]')
            if not sec_name_el or not sec_name_el.text.strip():
                cols = r.css('td')
                if len(cols) >= 6:
                    sec_name = cols[0].text.strip()
                    q_cnt = int(cols[1].text.strip())
                    corr = int(cols[2].text.strip())
                    incorr = int(cols[3].text.strip())
                    skip = int(cols[4].text.strip())
                    sec_marks = float(cols[5].text.strip())
                else:
                    continue
            else:
                sec_name = sec_name_el.text.strip()
                q_cnt_el = r.css_first('td[data-prompt="No. of questions"]')
                corr_el = r.css_first('td[data-prompt="Correct"]')
                incorr_el = r.css_first('td[data-prompt="Incorrect"]')
                skip_el = r.css_first('td[data-prompt="Skipped"]')
                marks_el = r.css_first('td[data-prompt="Marks"]')

                q_cnt = int(q_cnt_el.text.strip()) if q_cnt_el and q_cnt_el.text.strip() else 0
                corr = int(corr_el.text.strip()) if corr_el and corr_el.text.strip() else 0
                incorr = int(incorr_el.text.strip()) if incorr_el and incorr_el.text.strip() else 0
                skip = int(skip_el.text.strip()) if skip_el and skip_el.text.strip() else 0
                sec_marks = float(marks_el.text.strip()) if marks_el and marks_el.text.strip() else 0.0

            sections.append(SectionSummary(
                sectionName=sec_name,
                questionCount=q_cnt,
                correctCount=corr,
                incorrectCount=incorr,
                skippedCount=skip,
                marks=sec_marks
            ))

    # Fallback to #sectionNavTabs if modal table wasn't present
    if not sections:
        nav_tabs = page.css("#sectionNavTabs > li.dropdown")
        for tab in nav_tabs:
            name_el = tab.css_first("a span.hidden-xs, a span")
            sec_name = name_el.text.strip() if name_el else "Section"
            corr_el = tab.css_first(".correct-answer")
            incorr_el = tab.css_first(".wrong-answer")
            unatt_el = tab.css_first(".unattempted-que")

            corr = int(corr_el.text.strip()) if corr_el and corr_el.text.strip() else 0
            incorr = int(incorr_el.text.strip()) if incorr_el and incorr_el.text.strip() else 0
            skip = int(unatt_el.text.strip()) if unatt_el and unatt_el.text.strip() else 0
            q_cnt = corr + incorr + skip

            sections.append(SectionSummary(
                sectionName=sec_name,
                questionCount=q_cnt,
                correctCount=corr,
                incorrectCount=incorr,
                skippedCount=skip,
                marks=0.0
            ))

    total_questions = sum(s.questionCount for s in sections)

    return ExtractedResultSummary(
        examName=mock_name,
        mockName=mock_name,
        overallScore=overall_score,
        maxScore=None,
        totalQuestions=total_questions,
        sections=sections
    )

