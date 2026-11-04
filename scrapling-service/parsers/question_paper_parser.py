import re
from typing import List, Optional
from pydantic import BaseModel
from scrapling import Adaptor


class QuestionOption(BaseModel):
    index: int
    label: str
    text: str


class PaperQuestion(BaseModel):
    questionNumber: int
    section: str
    questionText: str
    options: List[QuestionOption]
    marks: Optional[float] = None
    status: Optional[str] = None


def parse_question_paper(html: str) -> List[PaperQuestion]:
    page = Adaptor(html)
    qp_container = page.css_first("#questionPaper")
    if not qp_container:
        qp_container = page

    section_divs = qp_container.css("div[ng-repeat*='section in test.sections']")
    if not section_divs:
        section_divs = [qp_container]

    questions: List[PaperQuestion] = []

    for sec_idx, sec in enumerate(section_divs):
        sec_h4 = sec.css_first("h4")
        if sec_h4 and sec_h4.text:
            sec_name = sec_h4.text.replace("Section:", "").strip()
        else:
            sec_name = f"Paper {sec_idx + 1}"

        q_items = sec.css("li.list-group-item")
        for item in q_items:
            item_text = item.text or ""

            # 1. Question Number
            q_match = re.search(r'Q\.\s*(\d+)\)', item_text)
            q_num = int(q_match.group(1)) if q_match else len(questions) + 1

            # 2. Marks & Status Badge
            marks = 0.0
            status = "unattempted"
            badge = item.css_first("span.badge")
            if badge:
                badge_text = badge.text or ""
                m_match = re.search(r'Marks[:\s]*([0-9.]+)', badge_text)
                if m_match:
                    marks = float(m_match.group(1))

                badge_cls = badge.attrib.get("class", "")
                if "bg-attempted" in badge_cls:
                    status = "correct"
                elif "bg-skipped" in badge_cls:
                    status = "incorrect"
                elif "bg-partial-correct" in badge_cls:
                    status = "partial"
                elif "bg-unattempt" in badge_cls:
                    status = "unattempted"

            # 3. Question Text
            q_box = item.css_first("span.qns-view-box")
            if q_box and q_box.text:
                q_text = q_box.text.strip()
            else:
                q_text = re.sub(r'Q\.\s*\d+\)', '', item_text)
                q_text = re.sub(r'Marks[:\s]*[0-9.]+', '', q_text).strip()

            # 4. Options
            options: List[QuestionOption] = []
            opt_items = item.css("ol li.option")
            for idx, opt in enumerate(opt_items):
                opt_raw = opt.text or ""
                label_m = re.search(r'\(([a-zA-Z0-9]+)\)', opt_raw)
                opt_label = label_m.group(1).upper() if label_m else chr(65 + idx)

                opt_span = opt.css_first("span.qns-view-box")
                if opt_span and opt_span.text:
                    opt_text = opt_span.text.strip()
                else:
                    opt_text = re.sub(r'^\([a-zA-Z0-9]+\)\s*', '', opt_raw).strip()

                options.append(QuestionOption(
                    index=idx,
                    label=opt_label,
                    text=opt_text
                ))

            questions.append(PaperQuestion(
                questionNumber=q_num,
                section=sec_name,
                questionText=q_text,
                options=options,
                marks=marks,
                status=status
            ))

    return questions

