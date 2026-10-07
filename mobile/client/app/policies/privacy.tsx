import { PolicyScreen } from "../../src/components/PolicyScreen";

export default function PrivacyPolicyPage() {
  return (
    <PolicyScreen
      title="Privacy Policy"
      description="How Lifebookz collects, uses, and protects your personal information."
      updated="August 5, 2026"
      sections={[
        {
          title: "Introduction",
          paragraphs: [
            'Lifebookz ("we", "us", or "our") operates a digital storytelling platform that lets you preserve, publish, and share your life stories. This Privacy Policy explains what personal information we collect, how we use it, and the choices you have over your data. By using Lifebookz, you agree to the practices described in this policy.',
          ],
        },
        {
          title: "Information We Collect",
          paragraphs: [
            "We collect information you provide directly, information generated as you use the platform, and limited information from third parties:",
          ],
          bullets: [
            "Account information — your name, email address, profile photo, and other profile details.",
            "Content you create — stories, comments, testimonials, and their metadata.",
            "Usage information — pages you visit, features you use, and how you interact with stories.",
            "Device and technical information — device type, operating system, and identifiers collected automatically.",
            "Communications — messages you send us through support, forms, or email.",
          ],
        },
        {
          title: "How We Use Your Information",
          paragraphs: ["We use the information we collect to operate and improve Lifebookz, including to:"],
          bullets: [
            "Provide, personalize, and maintain the platform and its features.",
            "Process your registration and manage your account.",
            "Power features like writing assistance, story suggestions, search, and recommendations.",
            "Send you service updates or communications you have opted into.",
            "Detect, prevent, and address fraud, abuse, security, or technical issues.",
            "Comply with legal obligations and enforce our Terms and Content Policy.",
          ],
        },
        {
          title: "How We Share Information",
          paragraphs: ["We do not sell your personal information. We share data only in limited circumstances:"],
          bullets: [
            "Service providers — trusted companies that help us host, store, secure, or deliver the platform.",
            "Public content — stories and comments you publish are visible to other users.",
            "Legal requirements — when required by law or to protect rights, safety, and property.",
            "Business transfers — in connection with a merger, acquisition, or sale of assets.",
            "With your consent — when you ask us to share information for a specific purpose.",
          ],
        },
        {
          title: "Data Security",
          paragraphs: [
            "We take reasonable technical and organizational measures to protect your information — including encryption in transit, hashed credentials, and access controls. No method of transmission or storage is completely secure, so while we work hard to safeguard your data, we cannot guarantee absolute security.",
          ],
        },
        {
          title: "Data Retention",
          paragraphs: [
            "We keep your personal information for as long as your account is active or as needed to provide the service, comply with legal obligations, resolve disputes, and enforce our agreements. When you delete content or close your account, we remove or anonymize your data where possible.",
          ],
        },
        {
          title: "Your Rights & Choices",
          paragraphs: ["Depending on where you live, you may have rights over your personal information, including:"],
          bullets: [
            "Access and obtain a copy of the personal data we hold about you.",
            "Correct inaccurate or incomplete information.",
            "Delete your account and associated data.",
            "Data portability — receive your data in a structured, machine-readable format.",
            "Withdraw consent at any time where processing is based on consent.",
          ],
        },
        {
          title: "Children's Privacy",
          paragraphs: [
            "Lifebookz is not directed to children under the age of 13 (or 16 in the European Economic Area). We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us and we will delete it.",
          ],
        },
        {
          title: "Changes to This Policy",
          paragraphs: [
            "We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email or through the platform before the changes take effect. Continued use of Lifebookz after the updated policy is posted constitutes acceptance of the revised terms.",
          ],
        },
      ]}
    />
  );
}
