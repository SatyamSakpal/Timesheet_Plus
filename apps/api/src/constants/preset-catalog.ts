import type { TaskFieldSchema } from "../types/domain";

export const PRESET_DEPARTMENT_KEYS = {
  juniorCollege: "junior_college_department",
  bca: "bca_department",
  bscIt: "bsc_it_department",
  bcom: "bcom_department",
  bba: "bba_department",
  ba: "ba_department",
  mscIt: "msc_it_department"
} as const;

export interface PresetDepartmentCatalogSeed {
  key: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface PresetTaskTemplateCatalogSeed {
  key: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
  assignedDepartmentKeys: string[];
  fields: TaskFieldSchema[];
}

const ALL_DEPARTMENTS = ["*"];

const COMMON_ACTIVITY_FIELDS: TaskFieldSchema[] = [
  { key: "work_summary", label: "Work Summary", type: "textarea", required: true },
  { key: "outcome", label: "Outcome", type: "textarea", required: false },
  { key: "support_needed", label: "Support Needed", type: "textarea", required: false }
];

function withCommonFields(fields: TaskFieldSchema[]): TaskFieldSchema[] {
  return [...fields, ...COMMON_ACTIVITY_FIELDS];
}

export const PRESET_DEPARTMENT_CATALOG_SEED: PresetDepartmentCatalogSeed[] = [
  {
    key: PRESET_DEPARTMENT_KEYS.juniorCollege,
    name: "Junior College",
    description: "11th and 12th standard academic programs.",
    order: 1,
    isActive: true
  },
  {
    key: PRESET_DEPARTMENT_KEYS.bca,
    name: "BCA",
    description: "Bachelor of Computer Applications.",
    order: 2,
    isActive: true
  },
  {
    key: PRESET_DEPARTMENT_KEYS.bscIt,
    name: "BSc IT",
    description: "Bachelor of Science in Information Technology.",
    order: 3,
    isActive: true
  },
  {
    key: PRESET_DEPARTMENT_KEYS.bcom,
    name: "BCom",
    description: "Bachelor of Commerce.",
    order: 4,
    isActive: true
  },
  {
    key: PRESET_DEPARTMENT_KEYS.bba,
    name: "BBA",
    description: "Bachelor of Business Administration.",
    order: 5,
    isActive: true
  },
  {
    key: PRESET_DEPARTMENT_KEYS.ba,
    name: "BA",
    description: "Bachelor of Arts.",
    order: 6,
    isActive: true
  },
  {
    key: PRESET_DEPARTMENT_KEYS.mscIt,
    name: "MSc IT",
    description: "Master of Science in Information Technology.",
    order: 7,
    isActive: true
  }
];

export const PRESET_TASK_TEMPLATE_CATALOG_SEED: PresetTaskTemplateCatalogSeed[] = [
  {
    key: "lecture_delivery",
    name: "Lecture Delivery",
    description: "Conducting theory classes and covering planned topics.",
    order: 1,
    isActive: true,
    assignedDepartmentKeys: ALL_DEPARTMENTS,
    fields: withCommonFields([
      { key: "subject", label: "Subject", type: "text", required: true },
      {
        key: "semester",
        label: "Semester/Class",
        type: "select",
        required: true,
        options: [
          "FYJC",
          "SYJC",
          "Semester 1",
          "Semester 2",
          "Semester 3",
          "Semester 4",
          "Semester 5",
          "Semester 6",
          "PG Semester 1",
          "PG Semester 2",
          "PG Semester 3",
          "PG Semester 4"
        ]
      },
      { key: "division_batch", label: "Division/Batch", type: "text", required: false },
      { key: "students_present", label: "Students Present", type: "number", required: true, min: 0 },
      { key: "topics_covered", label: "Topics Covered", type: "textarea", required: true }
    ])
  },
  {
    key: "practical_lab_session",
    name: "Practical/Lab Session",
    description: "Conducting practicals and supervising lab activity.",
    order: 2,
    isActive: true,
    assignedDepartmentKeys: [PRESET_DEPARTMENT_KEYS.bca, PRESET_DEPARTMENT_KEYS.bscIt, PRESET_DEPARTMENT_KEYS.mscIt],
    fields: withCommonFields([
      { key: "subject", label: "Subject", type: "text", required: true },
      { key: "lab_or_experiment", label: "Lab/Experiment", type: "text", required: true },
      { key: "batch", label: "Batch", type: "text", required: true },
      { key: "students_present", label: "Students Present", type: "number", required: true, min: 0 },
      { key: "lab_issues", label: "Lab Issues", type: "textarea", required: false }
    ])
  },
  {
    key: "attendance_student_mentoring",
    name: "Attendance & Student Mentoring",
    description: "Mentoring students and handling attendance-related interventions.",
    order: 3,
    isActive: true,
    assignedDepartmentKeys: ALL_DEPARTMENTS,
    fields: withCommonFields([
      { key: "class_batch", label: "Class/Batch", type: "text", required: true },
      {
        key: "mentoring_type",
        label: "Mentoring Type",
        type: "select",
        required: true,
        options: ["Academic", "Attendance", "Behavioural", "Career", "Personal"]
      },
      { key: "students_addressed", label: "Students Addressed", type: "number", required: true, min: 0 },
      { key: "at_risk_students", label: "At-Risk Students", type: "number", required: false, min: 0 },
      { key: "action_taken", label: "Action Taken", type: "textarea", required: true }
    ])
  },
  {
    key: "assignment_test_evaluation",
    name: "Assignment/Test Evaluation",
    description: "Evaluating assignments and test papers.",
    order: 4,
    isActive: true,
    assignedDepartmentKeys: ALL_DEPARTMENTS,
    fields: withCommonFields([
      {
        key: "assessment_type",
        label: "Assessment Type",
        type: "select",
        required: true,
        options: ["Assignment", "Class Test", "Unit Test", "Practical", "Viva", "Project Review"]
      },
      { key: "subject", label: "Subject", type: "text", required: true },
      { key: "scripts_evaluated", label: "Scripts Evaluated", type: "number", required: true, min: 0 },
      { key: "average_score", label: "Average Score", type: "number", required: false, min: 0, max: 100 },
      { key: "remarks", label: "Remarks", type: "textarea", required: false }
    ])
  },
  {
    key: "internal_marks_entry",
    name: "Internal Marks Entry",
    description: "Recording and validating internal marks.",
    order: 5,
    isActive: true,
    assignedDepartmentKeys: ALL_DEPARTMENTS,
    fields: withCommonFields([
      {
        key: "exam_component",
        label: "Exam Component",
        type: "select",
        required: true,
        options: ["Internal Test 1", "Internal Test 2", "Assignment", "Practical", "Viva", "Attendance", "Project"]
      },
      { key: "class_batch", label: "Class/Batch", type: "text", required: true },
      { key: "records_updated", label: "Records Updated", type: "number", required: true, min: 0 },
      {
        key: "status",
        label: "Status",
        type: "radio",
        required: true,
        options: ["Completed", "Partially Completed", "Blocked"]
      },
      { key: "discrepancy_notes", label: "Discrepancy Notes", type: "textarea", required: false }
    ])
  },
  {
    key: "syllabus_lesson_plan_update",
    name: "Syllabus & Lesson Plan Update",
    description: "Updating coverage and lesson plans.",
    order: 6,
    isActive: true,
    assignedDepartmentKeys: ALL_DEPARTMENTS,
    fields: withCommonFields([
      { key: "subject", label: "Subject", type: "text", required: true },
      { key: "unit_or_module", label: "Unit/Module", type: "text", required: true },
      {
        key: "update_type",
        label: "Update Type",
        type: "select",
        required: true,
        options: ["Lesson Plan", "Syllabus Coverage", "Teaching Material", "Question Bank", "Course File"]
      },
      { key: "coverage_percent", label: "Coverage %", type: "number", required: false, min: 0, max: 100 },
      { key: "revision_notes", label: "Revision Notes", type: "textarea", required: true }
    ])
  },
  {
    key: "exam_paper_setting_moderation",
    name: "Exam Paper Setting / Moderation",
    description: "Preparing and moderating exam papers.",
    order: 7,
    isActive: true,
    assignedDepartmentKeys: ALL_DEPARTMENTS,
    fields: withCommonFields([
      { key: "exam_name", label: "Exam Name", type: "text", required: true },
      { key: "subject", label: "Subject", type: "text", required: true },
      {
        key: "paper_stage",
        label: "Paper Stage",
        type: "select",
        required: true,
        options: ["Drafted", "Submitted for Moderation", "Moderated", "Finalized"]
      },
      { key: "moderation_done", label: "Moderation Done", type: "checkbox", required: false },
      { key: "moderation_comments", label: "Moderation Comments", type: "textarea", required: false }
    ])
  },
  {
    key: "exam_coordination",
    name: "Exam Coordination",
    description: "Handling exam operations and duty responsibilities.",
    order: 8,
    isActive: true,
    assignedDepartmentKeys: ALL_DEPARTMENTS,
    fields: withCommonFields([
      {
        key: "exam_type",
        label: "Exam Type",
        type: "select",
        required: true,
        options: ["Internal Exam", "University Exam", "Board Exam", "Practical Exam"]
      },
      {
        key: "duty_type",
        label: "Duty Type",
        type: "select",
        required: true,
        options: ["Invigilation", "Chief Conductor", "Paper Distribution", "Evaluation Coordination", "Control Room"]
      },
      { key: "sessions_handled", label: "Sessions Handled", type: "number", required: true, min: 0 },
      { key: "incident_reported", label: "Incident Reported", type: "checkbox", required: false },
      { key: "incident_details", label: "Incident Details", type: "textarea", required: false }
    ])
  },
  {
    key: "result_analysis_remedial_planning",
    name: "Result Analysis & Remedial Planning",
    description: "Analyzing exam performance and planning interventions.",
    order: 9,
    isActive: true,
    assignedDepartmentKeys: ALL_DEPARTMENTS,
    fields: withCommonFields([
      { key: "class_batch", label: "Class/Batch", type: "text", required: true },
      { key: "pass_percentage", label: "Pass Percentage", type: "number", required: true, min: 0, max: 100 },
      { key: "failed_count", label: "Failed Count", type: "number", required: true, min: 0 },
      { key: "top_performers_count", label: "Top Performers Count", type: "number", required: false, min: 0 },
      { key: "remedial_plan", label: "Remedial Plan", type: "textarea", required: true }
    ])
  },
  {
    key: "parent_student_counselling",
    name: "Parent/Student Counselling",
    description: "Counselling sessions for academic and welfare support.",
    order: 10,
    isActive: true,
    assignedDepartmentKeys: [
      PRESET_DEPARTMENT_KEYS.juniorCollege,
      PRESET_DEPARTMENT_KEYS.bcom,
      PRESET_DEPARTMENT_KEYS.bba,
      PRESET_DEPARTMENT_KEYS.ba
    ],
    fields: withCommonFields([
      {
        key: "counselling_for",
        label: "Counselling For",
        type: "radio",
        required: true,
        options: ["Student", "Parent", "Both"]
      },
      { key: "cases_handled", label: "Cases Handled", type: "number", required: true, min: 0 },
      { key: "major_concerns", label: "Major Concerns", type: "textarea", required: true },
      { key: "action_plan", label: "Action Plan", type: "textarea", required: true },
      { key: "followup_date", label: "Follow-up Date", type: "date", required: false }
    ])
  },
  {
    key: "department_meeting_documentation",
    name: "Department Meeting & Academic Documentation",
    description: "Department-level planning, decisions, and records.",
    order: 11,
    isActive: true,
    assignedDepartmentKeys: ALL_DEPARTMENTS,
    fields: withCommonFields([
      {
        key: "meeting_type",
        label: "Meeting Type",
        type: "select",
        required: true,
        options: ["Department Meeting", "Academic Planning", "NAAC/IQAC Documentation", "Result Review", "Curriculum Review"]
      },
      { key: "participants_count", label: "Participants Count", type: "number", required: true, min: 0 },
      { key: "agenda_points", label: "Agenda Points", type: "textarea", required: true },
      { key: "decisions_taken", label: "Decisions Taken", type: "textarea", required: true },
      { key: "mom_shared", label: "MoM Shared", type: "checkbox", required: false }
    ])
  },
  {
    key: "project_dissertation_guidance",
    name: "Project / Dissertation Guidance",
    description: "Guiding student projects and dissertations.",
    order: 12,
    isActive: true,
    assignedDepartmentKeys: [PRESET_DEPARTMENT_KEYS.bca, PRESET_DEPARTMENT_KEYS.bscIt, PRESET_DEPARTMENT_KEYS.mscIt],
    fields: withCommonFields([
      { key: "project_title", label: "Project/Dissertation Title", type: "text", required: true },
      { key: "student_or_team", label: "Student/Team", type: "text", required: true },
      {
        key: "stage",
        label: "Stage",
        type: "select",
        required: true,
        options: ["Topic Finalization", "Proposal Review", "Implementation", "Testing", "Documentation", "Final Review"]
      },
      { key: "progress_percent", label: "Progress %", type: "number", required: true, min: 0, max: 100 },
      { key: "blockers", label: "Blockers", type: "textarea", required: false }
    ])
  },
  {
    key: "seminar_workshop_coordination",
    name: "Seminar / Workshop Coordination",
    description: "Planning and coordinating seminars or workshops.",
    order: 13,
    isActive: true,
    assignedDepartmentKeys: ALL_DEPARTMENTS,
    fields: withCommonFields([
      { key: "event_title", label: "Event Title", type: "text", required: true },
      {
        key: "role",
        label: "Role",
        type: "select",
        required: true,
        options: ["Organizer", "Co-ordinator", "Speaker", "Panelist", "Support Team"]
      },
      {
        key: "audience_type",
        label: "Audience Type",
        type: "select",
        required: true,
        options: ["Students", "Faculty", "Mixed", "External Participants"]
      },
      { key: "participants_count", label: "Participants Count", type: "number", required: false, min: 0 },
      { key: "key_outcomes", label: "Key Outcomes", type: "textarea", required: true }
    ])
  },
  {
    key: "placement_internship_coordination",
    name: "Placement / Internship Coordination",
    description: "Coordinating placement and internship readiness efforts.",
    order: 14,
    isActive: true,
    assignedDepartmentKeys: [
      PRESET_DEPARTMENT_KEYS.bca,
      PRESET_DEPARTMENT_KEYS.bscIt,
      PRESET_DEPARTMENT_KEYS.bcom,
      PRESET_DEPARTMENT_KEYS.bba,
      PRESET_DEPARTMENT_KEYS.mscIt
    ],
    fields: withCommonFields([
      { key: "company_or_partner", label: "Company/Industry Partner", type: "text", required: true },
      {
        key: "activity_type",
        label: "Activity Type",
        type: "select",
        required: true,
        options: ["Company Outreach", "Campus Drive", "Mock Interview", "Resume Workshop", "Internship Coordination", "Industry Visit"]
      },
      { key: "students_involved", label: "Students Involved", type: "number", required: true, min: 0 },
      { key: "selected_or_shortlisted", label: "Selected/Shortlisted", type: "number", required: false, min: 0 },
      { key: "next_steps", label: "Next Steps", type: "textarea", required: true }
    ])
  },
  {
    key: "admission_counselling_enrollment_support",
    name: "Admission Counselling & Enrollment Support",
    description: "Handling admission enquiries and conversion support.",
    order: 15,
    isActive: true,
    assignedDepartmentKeys: ALL_DEPARTMENTS,
    fields: withCommonFields([
      {
        key: "programme",
        label: "Programme",
        type: "select",
        required: true,
        options: ["Junior College", "BCA", "BSc IT", "BCom", "BBA", "BA", "MSc IT"]
      },
      { key: "enquiries_handled", label: "Enquiries Handled", type: "number", required: true, min: 0 },
      { key: "admissions_confirmed", label: "Admissions Confirmed", type: "number", required: false, min: 0 },
      {
        key: "counselling_mode",
        label: "Counselling Mode",
        type: "radio",
        required: true,
        options: ["In-person", "Phone", "Online"]
      },
      { key: "remarks", label: "Remarks", type: "textarea", required: false }
    ])
  },
  {
    key: "other_activity",
    name: "Other Activity",
    description: "Fallback activity for work that does not fit predefined templates.",
    order: 16,
    isActive: true,
    assignedDepartmentKeys: ALL_DEPARTMENTS,
    fields: [{ key: "description", label: "Description", type: "textarea", required: true }]
  }
];
