export type Client = {
  name: string;
  category: string;
  url?: string;
  product: "LMS" | "TMS" | "LMS + TMS";
  description: string;
  metrics?: { label: string; value: string }[];
  logo?: string;
  lmsUrl?: string;
};

export const CLIENTS: Client[] = [
  {
    name: "IES Digital Academy",
    category: "Professional engineering body · IES.org.sg",
    url: "https://www.ies.org.sg/",
    lmsUrl: "https://learnify-iesa-lms.vercel.app/platform",
    logo: "/clients/ies-logo.png",
    product: "LMS + TMS",
    description:
      "Multi-tenant Learnify deployment powering the Institution of Engineers Singapore (IES) Digital Academy — course catalogue, programmes, learner enrolment, and revenue dashboards for IES members and corporate cohorts.",
  },
  {
    name: "Intellisoft Systems",
    category: "Training provider · WSQ ATO",
    url: "https://www.intellisoft.com.sg/",
    lmsUrl: "https://lms.intellisoftcourses.com/",
    logo: "/clients/intellisoft-logo.gif",
    product: "LMS",
    description:
      "Branded LMS for IT and digital-skills training. Hosts course catalogue, learner enrolment, content delivery, and assessment workflows tied to SkillsFuture-claimable courses.",
  },
  {
    name: "Chariot Learning & Consultancy",
    category: "Training provider · WSQ ATO",
    url: "https://chariot-learning.com/",
    lmsUrl: "https://chariot-learning.net/",
    logo: "/clients/chariot-logo.png",
    product: "LMS",
    description:
      "White-labelled LMS supporting Chariot Learning's full course catalogue with learner accounts, progress tracking, and online assessment.",
  },
];

export const TESTIMONIALS = [
  {
    quote:
      "We submit WSQ assessments without manual prep now. The system has the audit trail baked in.",
    author: "Head of Training",
    company: "Tertiary Courses",
  },
  {
    quote:
      "The Claude Code agent drafts our courseware. What used to take a week of curriculum work is a day.",
    author: "Senior Trainer",
    company: "Tertiary Infotech Academy",
  },
];
