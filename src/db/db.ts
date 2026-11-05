import Dexie, { Table } from 'dexie';
import {
  ExamSettings,
  MockTest,
  MistakeEntry,
  PaperTest,
  PaperAttempt,
  CompressedImage,
  ImportBatch,
  StudyTask,
  ExamProfile,
  SectionConfig,
  CanonicalTopic,
  SyllabusProgress,
  PYQ,
  StudyNote,
  Pattern,
  StudySession,
  AvailabilityPhase,
  Quest,
  UserXPState,
  SkillTreeNode,
  CS_ERROR_TYPES
} from '../types';

export const DEFAULT_QUANT_TOPICS = [
  'Percentage',
  'Profit & Loss',
  'SI/CI',
  'Ratio',
  'Average',
  'Mixture',
  'Time & Work',
  'Time Speed Distance',
  'Number System',
  'Algebra',
  'Geometry/Mensuration',
  'Probability/P&C',
  'Data Interpretation',
  'Simplification/Approximation',
  'Number Series',
  'Quadratic equations'
];

export const DEFAULT_REASONING_TOPICS = [
  'Syllogism',
  'Seating Arrangement',
  'Puzzles',
  'Blood Relations',
  'Direction Sense',
  'Coding-Decoding',
  'Inequality',
  'Order & Ranking',
  'Input-Output',
  'Data Sufficiency',
  'Logical/Verbal reasoning',
  'Series'
];

export const DEFAULT_ENGLISH_TOPICS = [
  'Reading Comprehension',
  'Cloze Test',
  'Error Spotting',
  'Sentence Improvement',
  'Para Jumbles',
  'Fill in the Blanks',
  'Vocabulary (synonyms/antonyms/idioms)',
  'Para Completion'
];

export const DEFAULT_CS_TOPICS = [
  'Data Structures',
  'Algorithms',
  'Operating Systems',
  'DBMS',
  'Computer Networks',
  'Theory of Computation',
  'Compiler Design',
  'Digital Logic',
  'Computer Architecture',
  'Software Engineering',
  'Discrete Mathematics',
  'Programming (C/C++/Python)'
];

export const DEFAULT_GENERAL_AWARENESS_TOPICS = [
  'Current Affairs',
  'Banking & Financial Awareness',
  'Static GK',
  'History',
  'Polity & Constitution',
  'Geography',
  'Economics',
  'General Science'
];

export const DEFAULT_ERROR_TYPES = [
  ...CS_ERROR_TYPES
];

export const DEFAULT_CANONICAL_TOPICS: CanonicalTopic[] = [
  // Core CS
  { id: 'discrete_math', name: 'Discrete Math', category: 'Core CS', subtopics: ['Propositional & First-Order Logic', 'Sets, Relations, Functions, Partial Orders, Lattices', 'Monoids, Groups', 'Graphs: connectivity, matching, coloring', 'Combinatorics: counting, recurrence, generating functions'], examTags: ['gate-cs'], overlapExams: ['gate-cs'] },
  { id: 'linear_algebra', name: 'Linear Algebra', category: 'Core CS', subtopics: ['Matrices, determinants', 'System of linear equations', 'Eigenvalues and Eigenvectors', 'LU decomposition'], examTags: ['gate-cs'], overlapExams: ['gate-cs'] },
  { id: 'calculus', name: 'Calculus', category: 'Core CS', subtopics: ['Limits, continuity and differentiability', 'Maxima and minima', 'Mean value theorem', 'Integration'], examTags: ['gate-cs'], overlapExams: ['gate-cs'] },
  { id: 'prob_stats', name: 'Probability and Statistics', category: 'Core CS', subtopics: ['Random variables', 'Uniform, normal, exponential, Poisson, binomial distributions', 'Mean, median, mode, standard deviation', 'Conditional probability and Bayes theorem'], examTags: ['gate-cs', 'sebi-it'], overlapExams: ['gate-cs', 'sebi-it'] },
  { id: 'digital_logic', name: 'Digital Logic', category: 'Core CS', subtopics: ['Boolean algebra', 'Combinational circuits (Multiplexers, decoders)', 'Sequential circuits (Flip-flops, counters, registers)', 'Number representations and computer arithmetic'], examTags: ['gate-cs'], overlapExams: ['gate-cs'] },
  { id: 'coa', name: 'Computer Organization and Architecture', category: 'Core CS', subtopics: ['Machine instructions and addressing modes', 'ALU, data-path and control unit', 'Instruction pipelining and hazards', 'Memory hierarchy: cache, main memory, virtual memory', 'I/O interface (interrupt and DMA mode)'], examTags: ['gate-cs', 'sebi-it', 'ibps-so-it'], overlapExams: ['gate-cs', 'sebi-it', 'ibps-so-it'] },
  { id: 'prog_ds', name: 'Programming and Data Structures', category: 'Core CS', subtopics: ['Programming in C (recursion, parameter passing, pointers)', 'Arrays, stacks, queues, linked lists', 'Trees, binary search trees, binary heaps', 'Graphs (representations)'], examTags: ['gate-cs', 'sebi-it', 'ibps-so-it'], overlapExams: ['gate-cs', 'sebi-it', 'ibps-so-it'] },
  { id: 'algorithms', name: 'Algorithms', category: 'Core CS', subtopics: ['Asymptotic worst and average time complexity', 'Searching, sorting, hashing', 'Greedy algorithms', 'Dynamic programming', 'Divide-and-conquer', 'Graph traversals, minimum spanning trees, shortest paths'], examTags: ['gate-cs', 'sebi-it', 'ibps-so-it'], overlapExams: ['gate-cs', 'sebi-it', 'ibps-so-it'] },
  { id: 'toc', name: 'Theory of Computation', category: 'Core CS', subtopics: ['Regular expressions and finite automata', 'Context-free grammars and push-down automata', 'Regular and context-free languages, pumping lemma', 'Turing machines and undecidability'], examTags: ['gate-cs'], overlapExams: ['gate-cs'] },
  { id: 'compiler_design', name: 'Compiler Design', category: 'Core CS', subtopics: ['Lexical analysis', 'Parsing (LL, LR parsers)', 'Syntax-directed translation', 'Intermediate code generation', 'Runtime environments, code optimization'], examTags: ['gate-cs'], overlapExams: ['gate-cs'] },
  { id: 'os', name: 'Operating Systems', category: 'Core CS', subtopics: ['Processes, threads, inter-process communication', 'Concurrency and synchronization, deadlocks', 'CPU and process scheduling', 'Memory management and virtual memory', 'File systems, disk scheduling'], examTags: ['gate-cs', 'sebi-it', 'ibps-so-it'], overlapExams: ['gate-cs', 'sebi-it', 'ibps-so-it'] },
  { id: 'dbms', name: 'Databases', category: 'Core CS', subtopics: ['ER-model, relational model', 'Relational algebra, tuple calculus, SQL', 'Integrity constraints, normal forms (1NF to BCNF)', 'File organization, indexing (B and B+ trees)', 'Transactions and concurrency control (ACID, 2PL)'], examTags: ['gate-cs', 'sebi-it', 'ibps-so-it'], overlapExams: ['gate-cs', 'sebi-it', 'ibps-so-it'] },
  { id: 'cn', name: 'Computer Networks', category: 'Core CS', subtopics: ['OSI and TCP/IP stack', 'Data link layer (framing, error detection, flow control, sliding window)', 'Network layer (routing algorithms, IPv4/IPv6, CIDR subnetting)', 'Transport layer (TCP, UDP, congestion control)', 'Application layer (DNS, SMTP, HTTP, FTP)'], examTags: ['gate-cs', 'sebi-it', 'ibps-so-it'], overlapExams: ['gate-cs', 'sebi-it', 'ibps-so-it'] },
  { id: 'software_engineering', name: 'Software Engineering', category: 'Core CS', subtopics: ['SDLC models (Waterfall, Agile, Scrum)', 'Requirement analysis, design concepts', 'Software metrics, software maintenance', 'UML diagrams'], examTags: ['sebi-it', 'ibps-so-it'], overlapExams: ['sebi-it', 'ibps-so-it'] },
  { id: 'web_tech', name: 'Web Technologies', category: 'Core CS', subtopics: ['HTML, CSS, JavaScript basics', 'Client-server architecture', 'REST APIs and JSON', 'Web security fundamentals'], examTags: ['sebi-it', 'ibps-so-it'], overlapExams: ['sebi-it', 'ibps-so-it'] },
  
  // IT-officer extras
  { id: 'info_sec', name: 'Information Security', category: 'IT-officer', subtopics: ['Symmetric & Asymmetric Cryptography (AES, RSA)', 'Authentication protocols, digital signatures', 'Network security (Firewalls, IDS/IPS, VPN)', 'Common threats: XSS, SQLi, CSRF, DDoS', 'Cyber laws & compliance (IT Act)'], examTags: ['sebi-it', 'ibps-so-it'], overlapExams: ['sebi-it', 'ibps-so-it'] },
  { id: 'cloud_virt', name: 'Cloud & Virtualization', category: 'IT-officer', subtopics: ['Cloud service models (IaaS, PaaS, SaaS)', 'Public, Private, Hybrid deployment', 'Hypervisors, containers (Docker, Kubernetes)', 'Cloud storage and scalability'], examTags: ['sebi-it', 'ibps-so-it'], overlapExams: ['sebi-it', 'ibps-so-it'] },
  { id: 'software_testing', name: 'Software Testing', category: 'IT-officer', subtopics: ['Black box & white box testing', 'Unit, integration, system, acceptance testing', 'Regression testing, performance testing', 'Test cases and bug lifecycles'], examTags: ['sebi-it', 'ibps-so-it'], overlapExams: ['sebi-it', 'ibps-so-it'] },
  { id: 'emerging_tech', name: 'Emerging Tech (AI/ML basics)', category: 'IT-officer', subtopics: ['Supervised vs Unsupervised learning', 'Neural networks basics', 'NLP & Computer Vision high-level concepts', 'Blockchain & IoT overviews'], examTags: ['sebi-it', 'ibps-so-it'], overlapExams: ['sebi-it', 'ibps-so-it'] },
  
  // Common (non-tech)
  { id: 'quant_common', name: 'Quantitative Aptitude', category: 'Common', subtopics: ['Number Systems', 'Percentages, Profit & Loss', 'Ratio, Proportion, Mixture', 'Time & Work, Pipes & Cisterns', 'Time, Speed & Distance', 'Data Interpretation (DI tables, charts, graphs)'], examTags: ['sebi-it', 'ibps-so-it'], overlapExams: ['sebi-it', 'ibps-so-it'] },
  { id: 'reasoning_common', name: 'Reasoning Ability', category: 'Common', subtopics: ['Puzzles & Seating Arrangements', 'Syllogisms', 'Inequalities', 'Blood Relations', 'Coding-Decoding', 'Critical / Logical Reasoning'], examTags: ['sebi-it', 'ibps-so-it'], overlapExams: ['sebi-it', 'ibps-so-it'] },
  { id: 'english_common', name: 'English Language', category: 'Common', subtopics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting & Grammar', 'Para Jumbles', 'Vocabulary & Sentence Improvement'], examTags: ['sebi-it', 'ibps-so-it'], overlapExams: ['sebi-it', 'ibps-so-it'] },
  { id: 'ga_common', name: 'General/Financial Awareness', category: 'Common', subtopics: ['Banking & Financial Awareness', 'Current Affairs (last 6 months)', 'Economic Survey & Budget highlights', 'SEBI & RBI circulars/regulations', 'Static GK'], examTags: ['sebi-it', 'ibps-so-it'], overlapExams: ['sebi-it', 'ibps-so-it'] }
];

export const DEFAULT_QUESTS: Quest[] = [
  { id: 'daily-review-10', type: 'daily', title: 'Review 10 Mistakes', description: 'Clear 10 mistakes in SRS queue', target: 10, current: 0, xpReward: 25, completed: false, expiresAt: new Date().toISOString().split('T')[0] },
  { id: 'daily-nat-5', type: 'daily', title: 'Solve 5 NAT Questions', description: 'Practice 5 Numerical Answer Type questions', target: 5, current: 0, xpReward: 30, completed: false, expiresAt: new Date().toISOString().split('T')[0] },
  { id: 'daily-focus-60', type: 'daily', title: '1 Hour Deep Focus', description: 'Log 60 minutes in Focus Mode', target: 60, current: 0, xpReward: 20, completed: false, expiresAt: new Date().toISOString().split('T')[0] },
  { id: 'weekly-cn-mastery', type: 'weekly', title: 'Master Computer Networks', description: 'Solve 15 CN routing/CIDR questions', target: 15, current: 0, xpReward: 100, completed: false, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] },
  { id: 'weekly-mock-60', type: 'weekly', title: 'Score > 60% on Mock', description: 'Attempt a full or sectional mock with >= 60% accuracy', target: 1, current: 0, xpReward: 150, completed: false, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] }
];

export const DEFAULT_PROFILES: ExamProfile[] = [
  {
    id: 'gate-cs',
    name: 'GATE CS (2027)',
    examName: 'GATE Computer Science & Information Technology',
    targetYear: 2027,
    sourceUrl: 'https://gate2025.iitr.ac.in',
    unverifiedFields: ['cutoffMarks'],
    isDefault: true,
    createdAt: new Date().toISOString(),
    totalTimeMinutes: 180,
    targetScore: 65,
    overallCutoff: 28,
    errorTypes: [...DEFAULT_ERROR_TYPES],
    stages: [
      {
        id: 'cbt',
        name: 'Computer Based Test',
        durationMinutes: 180,
        totalMarks: 100,
        cutoffMarks: 28, // UNVERIFIED, confirm: approximate General qualifying cutoff
        sections: [
          {
            id: 'general_aptitude',
            name: 'General Aptitude',
            totalQuestions: 10,
            marksPerCorrect: 1.5,
            negativeMark: 0.5,
            timeLimitMinutes: 25,
            sectionalCutoff: 0,
            topics: ['Quantitative Aptitude', 'Reasoning Ability', 'English Language']
          },
          {
            id: 'cs_it',
            name: 'Computer Science & IT',
            totalQuestions: 55,
            marksPerCorrect: 1.54,
            negativeMark: 0.51,
            timeLimitMinutes: 155,
            sectionalCutoff: 0,
            topics: [
              'Discrete Math', 'Linear Algebra', 'Calculus', 'Probability and Statistics',
              'Digital Logic', 'Computer Organization and Architecture', 'Programming and Data Structures',
              'Algorithms', 'Theory of Computation', 'Compiler Design', 'Operating Systems',
              'Databases', 'Computer Networks'
            ]
          }
        ],
        markingRules: [
          { questionType: 'MCQ', marks: 1, negativeMarks: 0.3333, allowPartialCredit: false },
          { questionType: 'MCQ', marks: 2, negativeMarks: 0.6667, allowPartialCredit: false },
          { questionType: 'MSQ', marks: 1, negativeMarks: 0, allowPartialCredit: false },
          { questionType: 'MSQ', marks: 2, negativeMarks: 0, allowPartialCredit: false },
          { questionType: 'NAT', marks: 1, negativeMarks: 0, natTolerance: 0 },
          { questionType: 'NAT', marks: 2, negativeMarks: 0, natTolerance: 0 }
        ]
      }
    ],
    sections: [
      {
        id: 'general_aptitude',
        name: 'General Aptitude',
        totalQuestions: 10,
        marksPerCorrect: 1.5,
        negativeMark: 0.5,
        timeLimitMinutes: 25,
        sectionalCutoff: 0,
        topics: ['Quantitative Aptitude', 'Reasoning Ability', 'English Language']
      },
      {
        id: 'cs_it',
        name: 'Computer Science & IT',
        totalQuestions: 55,
        marksPerCorrect: 1.54,
        negativeMark: 0.51,
        timeLimitMinutes: 155,
        sectionalCutoff: 0,
        topics: [
          'Discrete Math', 'Linear Algebra', 'Calculus', 'Probability and Statistics',
          'Digital Logic', 'Computer Organization and Architecture', 'Programming and Data Structures',
          'Algorithms', 'Theory of Computation', 'Compiler Design', 'Operating Systems',
          'Databases', 'Computer Networks'
        ]
      }
    ]
  },
  {
    id: 'sebi-it',
    name: 'SEBI Grade A (IT)',
    examName: 'SEBI Grade A Officer (Information Technology)',
    sourceUrl: 'https://www.sebi.gov.in',
    unverifiedFields: [],
    isDefault: false,
    createdAt: new Date().toISOString(),
    totalTimeMinutes: 100,
    targetScore: 120,
    overallCutoff: 80,
    errorTypes: [...DEFAULT_ERROR_TYPES],
    stages: [
      {
        id: 'phase-1',
        name: 'Phase 1 Online Exam',
        durationMinutes: 100,
        totalMarks: 200,
        cutoffMarks: 80, // 40% aggregate
        sections: [
          {
            id: 'paper-1',
            name: 'Paper 1 (GA, English, Quant, Reasoning)',
            totalQuestions: 80,
            marksPerCorrect: 1.25,
            negativeMark: 0.3125,
            timeLimitMinutes: 60,
            sectionalCutoff: 30, // 30% cutoff
            topics: ['General/Financial Awareness', 'English Language', 'Quantitative Aptitude', 'Reasoning Ability']
          },
          {
            id: 'paper-2',
            name: 'Paper 2 (Specialized IT Stream)',
            totalQuestions: 50,
            marksPerCorrect: 2.0,
            negativeMark: 0.5,
            timeLimitMinutes: 40,
            sectionalCutoff: 40, // 40% cutoff
            topics: [
              'Algorithms', 'Programming and Data Structures', 'Databases', 'Operating Systems',
              'Computer Networks', 'Information Security', 'Software Engineering', 'Cloud & Virtualization'
            ]
          }
        ],
        markingRules: [
          { questionType: 'MCQ', marks: 1.25, negativeMarks: 0.3125 },
          { questionType: 'MCQ', marks: 2.0, negativeMarks: 0.5 }
        ]
      },
      {
        id: 'phase-2',
        name: 'Phase 2 Online Exam',
        durationMinutes: 100,
        totalMarks: 200,
        cutoffMarks: 100, // 50% aggregate
        sections: [
          {
            id: 'p2-paper-1',
            name: 'Paper 1 (English Descriptive)',
            totalQuestions: 3,
            marksPerCorrect: 33.33,
            negativeMark: 0,
            timeLimitMinutes: 60,
            sectionalCutoff: 30,
            topics: ['Essay', 'Precis Writing', 'Reading Comprehension']
          },
          {
            id: 'p2-paper-2',
            name: 'Paper 2 (IT Stream Coding & Technical)',
            totalQuestions: 50,
            marksPerCorrect: 2.0,
            negativeMark: 0.5,
            timeLimitMinutes: 40,
            sectionalCutoff: 40,
            topics: ['Algorithms', 'Databases', 'Computer Networks', 'Information Security']
          }
        ],
        markingRules: [
          { questionType: 'descriptive', marks: 100, negativeMarks: 0 },
          { questionType: 'MCQ', marks: 2.0, negativeMarks: 0.5 }
        ]
      }
    ],
    sections: [
      {
        id: 'paper-1',
        name: 'Paper 1 (GA, English, Quant, Reasoning)',
        totalQuestions: 80,
        marksPerCorrect: 1.25,
        negativeMark: 0.3125,
        timeLimitMinutes: 60,
        sectionalCutoff: 30,
        topics: ['General/Financial Awareness', 'English Language', 'Quantitative Aptitude', 'Reasoning Ability']
      },
      {
        id: 'paper-2',
        name: 'Paper 2 (Specialized IT Stream)',
        totalQuestions: 50,
        marksPerCorrect: 2.0,
        negativeMark: 0.5,
        timeLimitMinutes: 40,
        sectionalCutoff: 40,
        topics: [
          'Algorithms', 'Programming and Data Structures', 'Databases', 'Operating Systems',
          'Computer Networks', 'Information Security', 'Software Engineering', 'Cloud & Virtualization'
        ]
      }
    ]
  },
  {
    id: 'ibps-so-it',
    name: 'IBPS SO (IT Officer)',
    examName: 'IBPS Specialist Officer Scale-I (IT)',
    sourceUrl: 'https://www.ibps.in',
    unverifiedFields: ['cutoffMarks'],
    isDefault: false,
    createdAt: new Date().toISOString(),
    totalTimeMinutes: 120,
    targetScore: 85,
    overallCutoff: 65,
    errorTypes: [...DEFAULT_ERROR_TYPES],
    stages: [
      {
        id: 'prelims',
        name: 'Preliminary Examination',
        durationMinutes: 120,
        totalMarks: 125,
        cutoffMarks: 65, // UNVERIFIED, confirm: cutoff varies yearly
        sections: [
          {
            id: 'english',
            name: 'English Language',
            totalQuestions: 50,
            marksPerCorrect: 0.5,
            negativeMark: 0.125,
            timeLimitMinutes: 40,
            sectionalCutoff: 10,
            topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting & Grammar', 'Para Jumbles']
          },
          {
            id: 'reasoning',
            name: 'Reasoning Ability',
            totalQuestions: 50,
            marksPerCorrect: 1.0,
            negativeMark: 0.25,
            timeLimitMinutes: 40,
            sectionalCutoff: 15,
            topics: ['Puzzles & Seating Arrangements', 'Syllogisms', 'Inequalities', 'Blood Relations']
          },
          {
            id: 'quant',
            name: 'Quantitative Aptitude',
            totalQuestions: 50,
            marksPerCorrect: 1.0,
            negativeMark: 0.25,
            timeLimitMinutes: 40,
            sectionalCutoff: 15,
            topics: ['Data Interpretation', 'Number Series', 'Quadratic Equations', 'Arithmetic Problems']
          }
        ],
        markingRules: [
          { questionType: 'MCQ', marks: 0.5, negativeMarks: 0.125 },
          { questionType: 'MCQ', marks: 1.0, negativeMarks: 0.25 }
        ]
      },
      {
        id: 'mains',
        name: 'Main Examination',
        durationMinutes: 45,
        totalMarks: 60,
        cutoffMarks: 32, // UNVERIFIED, confirm
        sections: [
          {
            id: 'professional_knowledge',
            name: 'Professional Knowledge (IT)',
            totalQuestions: 60,
            marksPerCorrect: 1.0,
            negativeMark: 0.25,
            timeLimitMinutes: 45,
            sectionalCutoff: 15,
            topics: [
              'Databases', 'Operating Systems', 'Computer Networks', 'Programming and Data Structures',
              'Software Engineering', 'Information Security', 'Web Technologies'
            ]
          }
        ],
        markingRules: [
          { questionType: 'MCQ', marks: 1.0, negativeMarks: 0.25 }
        ]
      }
    ],
    sections: [
      {
        id: 'english',
        name: 'English Language',
        totalQuestions: 50,
        marksPerCorrect: 0.5,
        negativeMark: 0.125,
        timeLimitMinutes: 40,
        sectionalCutoff: 10,
        topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting & Grammar', 'Para Jumbles']
      },
      {
        id: 'reasoning',
        name: 'Reasoning Ability',
        totalQuestions: 50,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 40,
        sectionalCutoff: 15,
        topics: ['Puzzles & Seating Arrangements', 'Syllogisms', 'Inequalities', 'Blood Relations']
      },
      {
        id: 'quant',
        name: 'Quantitative Aptitude',
        totalQuestions: 50,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 40,
        sectionalCutoff: 15,
        topics: ['Data Interpretation', 'Number Series', 'Quadratic Equations', 'Arithmetic Problems']
      }
    ]
  },
  {
    id: 'competitive-cs',
    name: 'Competitive Exam (CS)',
    examName: 'Competitive Exam (General)',
    totalTimeMinutes: 120,
    targetScore: 100,
    overallCutoff: 60,
    isDefault: false,
    createdAt: new Date().toISOString(),
    errorTypes: [...DEFAULT_ERROR_TYPES],
    stages: [],
    unverifiedFields: [],
    sections: [
      {
        id: 'quant',
        name: 'Quantitative Aptitude',
        totalQuestions: 25,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 30,
        sectionalCutoff: 10,
        topics: [...DEFAULT_QUANT_TOPICS]
      },
      {
        id: 'reasoning',
        name: 'Reasoning',
        totalQuestions: 25,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 30,
        sectionalCutoff: 10,
        topics: [...DEFAULT_REASONING_TOPICS]
      },
      {
        id: 'english',
        name: 'English',
        totalQuestions: 25,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 20,
        sectionalCutoff: 8,
        topics: [...DEFAULT_ENGLISH_TOPICS]
      },
      {
        id: 'cs',
        name: 'Computer Science',
        totalQuestions: 25,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 40,
        sectionalCutoff: 10,
        topics: [...DEFAULT_CS_TOPICS]
      }
    ]
  }
];

export const DEFAULT_SETTINGS: ExamSettings = {
  id: 'current',
  examName: 'Competitive Exam',
  currentExamId: 'gate-cs',
  currentStageId: 'cbt',
  totalTimeMinutes: 120,
  targetScore: 100,
  overallCutoff: 60,
  sections: [
    {
      id: 'quant',
      name: 'Quantitative Aptitude',
      totalQuestions: 25,
      marksPerCorrect: 1.0,
      negativeMark: 0.25,
      timeLimitMinutes: 30,
      sectionalCutoff: 10,
      topics: [...DEFAULT_QUANT_TOPICS]
    },
    {
      id: 'reasoning',
      name: 'Reasoning',
      totalQuestions: 25,
      marksPerCorrect: 1.0,
      negativeMark: 0.25,
      timeLimitMinutes: 30,
      sectionalCutoff: 10,
      topics: [...DEFAULT_REASONING_TOPICS]
    },
    {
      id: 'english',
      name: 'English',
      totalQuestions: 25,
      marksPerCorrect: 1.0,
      negativeMark: 0.25,
      timeLimitMinutes: 20,
      sectionalCutoff: 8,
      topics: [...DEFAULT_ENGLISH_TOPICS]
    },
    {
      id: 'cs',
      name: 'Computer Science',
      totalQuestions: 25,
      marksPerCorrect: 1.0,
      negativeMark: 0.25,
      timeLimitMinutes: 40,
      sectionalCutoff: 10,
      topics: [...DEFAULT_CS_TOPICS]
    }
  ],
  errorTypes: [...DEFAULT_ERROR_TYPES]
};

export class MistakeNotebookDatabase extends Dexie {
  settings!: Table<ExamSettings, string>;
  mocks!: Table<MockTest, number>;
  mistakes!: Table<MistakeEntry, number>;
  papers!: Table<PaperTest, number>;
  paperAttempts!: Table<PaperAttempt, number>;
  images!: Table<CompressedImage, number>;
  importBatches!: Table<ImportBatch, number>;
  tasks!: Table<StudyTask, number>;
  profiles!: Table<ExamProfile, string>;
  topics!: Table<CanonicalTopic, string>;
  syllabusProgress!: Table<SyllabusProgress, number>;
  pyqs!: Table<PYQ, number>;
  notes!: Table<StudyNote, number>;
  patterns!: Table<Pattern, number>;
  studySessions!: Table<StudySession, number>;
  availabilityPhases!: Table<AvailabilityPhase, number>;
  quests!: Table<Quest, string>;
  xpState!: Table<UserXPState, string>;
  skillTree!: Table<SkillTreeNode, string>;

  constructor() {
    super('MistakeNotebookDB');

    this.version(1).stores({
      settings: 'id',
      mocks: '++id, name, date, source, totalNetScore, overallAccuracy',
      mistakes: '++id, mockId, sectionId, topic, resultType, status, interval, nextReviewDate, createdAt'
    });

    this.version(2).stores({
      settings: 'id',
      mocks: '++id, name, date, source, attemptType, totalNetScore, overallAccuracy',
      mistakes: '++id, mockId, paperId, sectionId, topic, resultType, status, interval, nextReviewDate, createdAt',
      papers: '++id, examName, year, isMemoryBased, createdAt'
    });

    this.version(3).stores({
      settings: 'id',
      mocks: '++id, name, date, source, attemptType, totalNetScore, overallAccuracy',
      mistakes: '++id, mockId, paperId, sectionId, topic, resultType, status, interval, nextReviewDate, createdAt',
      papers: '++id, examName, year, isMemoryBased, createdAt',
      tasks: '++id, dueDate, isCompleted, priority, subject, topic, createdAt',
      profiles: 'id, name, isDefault, createdAt'
    }).upgrade(async tx => {
      const profilesTable = tx.table('profiles');
      const count = await profilesTable.count();
      if (count === 0) {
        await profilesTable.bulkPut(DEFAULT_PROFILES);
      }
    });

    this.version(4).stores({
      settings: 'id',
      mocks: '++id, name, date, source, attemptType, totalNetScore, overallAccuracy',
      mistakes: '++id, mockId, paperId, questionId, sectionId, topic, subtopic, resultType, status, batchId, interval, nextReviewDate, createdAt',
      papers: '++id, examName, year, isMemoryBased, createdAt',
      paperAttempts: '++id, paperId, mockId, questionId, selected, correct, timeSpentSeconds, attemptedAt',
      images: '++id, mimeType, createdAt',
      importBatches: '++id, source, status, importedAt',
      tasks: '++id, dueDate, isCompleted, priority, subject, topic, createdAt',
      profiles: 'id, name, isDefault, createdAt'
    }).upgrade(async tx => {
      const mocks = await tx.table('mocks').toArray();
      const mockIds = new Set(mocks.map((m: { id?: number }) => m.id));
      const mistakes = await tx.table('mistakes').toArray();
      const migrated = mistakes.map((mistake: MistakeEntry) => {
        const next: any = { ...mistake };
        if (next.mockId !== undefined && !mockIds.has(next.mockId)) {
          delete next.mockId;
        }
        if (next.mockId === undefined && (!next.mockName || next.mockName === 'Mock Test')) {
          next.mockName = 'External / unlinked';
        }
        if (!Array.isArray(next.errorTypes)) {
          next.errorTypes = next.errorType ? [next.errorType] : ['Unclassified'];
        }
        if (!Array.isArray(next.tags)) {
          next.tags = ['user-logged'];
        }
        return next;
      });
      if (migrated.length > 0) {
        await tx.table('mistakes').bulkPut(migrated);
      }
    });

    this.version(5).stores({
      settings: 'id',
      mocks: '++id, examId, stage, name, date, source, attemptType, totalNetScore, overallAccuracy',
      mistakes: '++id, examId, stage, mockId, paperId, questionId, sectionId, topic, subtopic, questionType, resultType, status, batchId, interval, nextReviewDate, createdAt',
      papers: '++id, examId, stage, examName, year, isMemoryBased, createdAt',
      paperAttempts: '++id, paperId, mockId, questionId, selected, correct, timeSpentSeconds, attemptedAt',
      images: '++id, mimeType, createdAt',
      importBatches: '++id, source, status, importedAt',
      tasks: '++id, dueDate, isCompleted, priority, subject, topic, createdAt',
      profiles: 'id, name, isDefault, createdAt',
      topics: 'id, category, name',
      syllabusProgress: '++id, [examId+topicId], examId, stage, topicId, status',
      pyqs: '++id, examId, year, stage, topicId, questionType, source, firstAttemptCorrect',
      notes: '++id, topicId, title, createdAt, updatedAt',
      patterns: '++id, topicId, title, createdAt',
      studySessions: '++id, examId, topicId, type, startedAt',
      availabilityPhases: '++id, name, isCurrent, startDate, endDate',
      quests: 'id, type, completed, expiresAt',
      xpState: 'id',
      skillTree: 'id, subject, status'
    }).upgrade(async tx => {
      // 1. Ensure presets in profiles
      const profilesTable = tx.table('profiles');
      for (const p of DEFAULT_PROFILES) {
        await profilesTable.put(p);
      }
      // 2. Ensure default canonical topics
      const topicsTable = tx.table('topics');
      for (const t of DEFAULT_CANONICAL_TOPICS) {
        await topicsTable.put(t);
      }
      // 3. Ensure xpState
      const xpTable = tx.table('xpState');
      const existingXp = await xpTable.get('current');
      if (!existingXp) {
        await xpTable.put({
          id: 'current',
          totalXp: 0,
          currentLevel: 1,
          rankTitle: 'Aspirant',
          currentStreak: 0,
          streakFreezesAvailable: 2,
          lastActiveDate: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString()
        });
      }
      // 4. Ensure quests
      const questsTable = tx.table('quests');
      const questCount = await questsTable.count();
      if (questCount === 0) {
        await questsTable.bulkPut(DEFAULT_QUESTS);
      }
      // 5. Backfill examId and stage on mocks, mistakes, papers if missing
      const mistakesTable = tx.table('mistakes');
      const mistakes = await mistakesTable.toArray();
      const updatedMistakes = mistakes.map((m: any) => ({
        ...m,
        examId: m.examId || 'gate-cs',
        stage: m.stage || 'cbt',
        questionType: m.questionType || 'MCQ'
      }));
      if (updatedMistakes.length > 0) {
        await mistakesTable.bulkPut(updatedMistakes);
      }

      const mocksTable = tx.table('mocks');
      const mocks = await mocksTable.toArray();
      const updatedMocks = mocks.map((m: any) => ({
        ...m,
        examId: m.examId || 'gate-cs',
        stage: m.stage || 'cbt'
      }));
      if (updatedMocks.length > 0) {
        await mocksTable.bulkPut(updatedMocks);
      }

      const papersTable = tx.table('papers');
      const papers = await papersTable.toArray();
      const updatedPapers = papers.map((p: any) => ({
        ...p,
        examId: p.examId || 'gate-cs',
        stage: p.stage || 'cbt'
      }));
      if (updatedPapers.length > 0) {
        await papersTable.bulkPut(updatedPapers);
      }
    });
  }
}

export const db = new MistakeNotebookDatabase();

/**
 * Ensures initial default settings and profiles exist.
 * Preserves all user entered mocks, mistakes, papers, and tasks.
 */
export function extractExamNameFromMock(mockName: string): string {
  if (!mockName) return '';
  const cleaned = mockName
    .replace(/(?:[-_:\s]+)?(?:Mock(?:\s*Test)?|Test|Full\s*Mock|Paper)\s*#?\d+.*$/i, '')
    .replace(/\s*-\s*$/, '')
    .trim();
  return cleaned || mockName;
}

export async function ensureSettings(): Promise<ExamSettings> {
  const current = await db.settings.get('current');
  
  // Also ensure profiles exist
  const profileCount = await db.profiles.count();
  if (profileCount === 0) {
    await db.profiles.bulkPut(DEFAULT_PROFILES);
  }

  // Ensure topics exist
  const topicCount = await db.topics.count();
  if (topicCount === 0) {
    await db.topics.bulkPut(DEFAULT_CANONICAL_TOPICS);
  }

  // Ensure xpState exists
  const currentXp = await db.xpState.get('current');
  if (!currentXp) {
    await db.xpState.put({
      id: 'current',
      totalXp: 0,
      currentLevel: 1,
      rankTitle: 'Aspirant',
      currentStreak: 0,
      streakFreezesAvailable: 2,
      lastActiveDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString()
    });
  }

  if (!current) {
    await db.settings.put(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }

  let modified = false;

  // Ensure CS section is present if using legacy profile
  if (!current.sections.some((s) => s.id === 'cs' || s.id === 'cs_it')) {
    current.sections.push({
      id: 'cs_it',
      name: 'Computer Science & IT',
      totalQuestions: 55,
      marksPerCorrect: 1.54,
      negativeMark: 0.51,
      timeLimitMinutes: 155,
      sectionalCutoff: 0,
      topics: [...DEFAULT_CS_TOPICS]
    });
    modified = true;
  }

  if (modified) {
    await db.settings.put(current);
  }

  return current;
}

/**
 * Switch the active exam profile without touching mocks or mistakes.
 */
export async function switchProfile(profileId: string, stageId?: string): Promise<ExamSettings> {
  const profile = await db.profiles.get(profileId);
  if (!profile) {
    throw new Error(`Profile with id "${profileId}" not found`);
  }

  // Update isDefault across all profiles
  const allProfiles = await db.profiles.toArray();
  for (const p of allProfiles) {
    if (p.id === profileId && !p.isDefault) {
      await db.profiles.update(p.id, { isDefault: true });
    } else if (p.id !== profileId && p.isDefault) {
      await db.profiles.update(p.id, { isDefault: false });
    }
  }

  const activeStage = stageId
    ? profile.stages?.find(s => s.id === stageId) || profile.stages?.[0]
    : profile.stages?.[0];

  const updatedSettings: ExamSettings = {
    id: 'current',
    examName: profile.examName,
    currentExamId: profile.id,
    currentStageId: activeStage?.id || 'cbt',
    totalTimeMinutes: profile.totalTimeMinutes || activeStage?.durationMinutes || 180,
    targetScore: profile.targetScore || 65,
    overallCutoff: profile.overallCutoff || activeStage?.cutoffMarks || 28,
    sections: activeStage?.sections?.length ? activeStage.sections : (profile.sections || []),
    errorTypes: profile.errorTypes || [...CS_ERROR_TYPES]
  };

  await db.settings.put(updatedSettings);
  return updatedSettings;
}

/**
 * Clears user data completely.
 */
export async function clearAllUserData(): Promise<void> {
  await db.mistakes.clear();
  await db.mocks.clear();
  await db.papers.clear();
  await db.paperAttempts.clear();
  await db.images.clear();
  await db.importBatches.clear();
  await db.tasks.clear();
  await db.syllabusProgress.clear();
  await db.pyqs.clear();
  await db.notes.clear();
  await db.patterns.clear();
  await db.studySessions.clear();
  await db.settings.put(DEFAULT_SETTINGS);
}
