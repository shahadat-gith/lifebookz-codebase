import { PolicyScreen } from "../../src/components/PolicyScreen";

export default function ContentPolicyPage() {
  return (
    <PolicyScreen
      title="Content Guidelines"
      description="What is allowed on Lifebookz and what we will remove."
      updated="August 5, 2026"
      sections={[
        {
          title: "Our Commitment",
          paragraphs: [
            "Lifebookz exists to preserve personal stories and build a respectful community around them. This policy describes what is allowed on the platform and what we will remove. It applies to all content you publish — stories, comments, testimonials, profile details, and images — as well as to how you interact with others.",
          ],
        },
        {
          title: "Prohibited Content",
          paragraphs: [
            "The following types of content are not permitted. We may remove such content, and suspend or terminate accounts that repeatedly violate this policy:",
          ],
          bullets: [
            "Privacy & doxxing — do not publish someone's private information without their explicit consent.",
            "Hate speech & discrimination — attacks or demeaning content based on protected characteristics.",
            "Harassment & bullying — stalking, malicious shaming, and coordinated abuse.",
            "Violence & threats — content that promotes, glorifies, or threatens violence, including self-harm.",
            "Illegal activity — content that facilitates or encourages illegal activity.",
            "Sexually explicit content — strictly prohibited; content involving minors is reported to authorities.",
            "Plagiarism & impersonation — publish only content you have the right to share.",
            "Misinformation — deceptive or manipulative content, including AI-generated content presented as fact.",
            "Spam & manipulation — repeated self-promotion or artificially inflating engagement.",
          ],
        },
        {
          title: "AI & Authenticity",
          paragraphs: [
            "Lifebookz supports AI-assisted writing tools, but authenticity is central to personal storytelling. Clearly indicate when content is substantially generated or edited by AI, and never use AI to misrepresent yourself, your experiences, or other people.",
          ],
        },
        {
          title: "Reporting Violations",
          paragraphs: [
            "If you see content that violates this policy, please report it through the report option on the content or by contacting us at support@lifebookz.com. Include the reason and, where possible, a link to the content. We review reports as quickly as we can.",
          ],
        },
        {
          title: "Moderation & Appeals",
          paragraphs: [
            "We review reported content and may also use automated tools to detect violations. Depending on severity, enforcement may include content removal, warnings, or account suspension. If you believe your content was removed in error, you may appeal by contacting us at support@lifebookz.com.",
          ],
        },
      ]}
    />
  );
}
