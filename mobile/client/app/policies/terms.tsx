import { PolicyScreen } from "../../src/components/PolicyScreen";

export default function TermsOfServicePage() {
  return (
    <PolicyScreen
      title="Terms of Service"
      description="The rules that govern your use of the Lifebookz platform."
      updated="August 5, 2026"
      sections={[
        {
          title: "Acceptance of Terms",
          paragraphs: [
            'Welcome to Lifebookz. These Terms of Service ("Terms") govern your access to and use of the Lifebookz platform, including our websites, applications, and services. By creating an account or using the platform, you agree to be bound by these Terms and our Privacy Policy and Content Policy. If you do not agree, please do not use the platform.',
          ],
        },
        {
          title: "Eligibility",
          paragraphs: [
            "You must be at least 13 years old (or 16 in the European Economic Area) to use Lifebookz. By using the platform, you represent that you meet this requirement and that your use complies with the laws of your jurisdiction.",
          ],
        },
        {
          title: "Use of the Service",
          paragraphs: [
            "We grant you a limited, non-exclusive, non-transferable, revocable license to use the platform for personal, non-commercial purposes, subject to these Terms. You agree not to misuse the platform, including by attempting to access it through unauthorized means, interfering with its operation, or circumventing any security or rate-limiting measures.",
          ],
        },
        {
          title: "Your Content",
          paragraphs: [
            "You retain ownership of the stories and other content you submit to Lifebookz. By publishing content, you grant us a worldwide, royalty-free license to host, store, display, reproduce, and distribute that content to operate and promote the platform.",
            "You are solely responsible for the content you publish and for ensuring it does not violate these Terms, our Content Policy, or any applicable law.",
          ],
        },
        {
          title: "Intellectual Property",
          paragraphs: [
            "The Lifebookz name, logo, design, and all platform software and materials are owned by Lifebookz or its licensors and are protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works from them without our prior written permission.",
          ],
        },
        {
          title: "AI-Assisted Features",
          paragraphs: [
            "Lifebookz may offer writing assistance and other features powered by artificial intelligence. AI-generated suggestions are provided to help you write and are not a substitute for your own judgment. You are responsible for reviewing and taking ownership of the final content you publish.",
          ],
        },
        {
          title: "Termination",
          paragraphs: [
            "You may stop using Lifebookz and delete your account at any time. We may suspend or terminate your access, remove content, or close your account if we reasonably believe you have violated these Terms or our Content Policy. Upon termination, your right to use the platform ceases.",
          ],
        },
        {
          title: "Disclaimers & Liability",
          paragraphs: [
            'Lifebookz is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied. To the maximum extent permitted by law, Lifebookz shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the platform.',
          ],
        },
        {
          title: "Changes to These Terms",
          paragraphs: [
            "We may revise these Terms from time to time. Material changes will be announced on the platform or by email. Continued use of Lifebookz after changes take effect means you accept the updated Terms.",
          ],
        },
      ]}
    />
  );
}
