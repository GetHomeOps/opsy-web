import React from "react";
import {Link} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {ArrowLeft} from "lucide-react";
import OpsyHeader from "../../images/OpsyHeader.png";
import MountRainier from "../../images/MountRainier.png";
import "../../i18n";

function PrivacyPolicy() {
  const {t} = useTranslation();

  return (
    <main className="min-h-[100dvh] flex flex-col relative">
      {/* Fixed background - does not scroll or stretch */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat bg-fixed"
        style={{backgroundImage: `url(${MountRainier})`}}
        aria-hidden
      />
      <div className="fixed inset-0 bg-white/30 dark:bg-gray-900/30" aria-hidden />

      <div className="relative flex-1 flex flex-col min-h-[100dvh]">
        <div className="flex justify-between items-center px-4 py-4 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shrink-0">
          <Link
            to="/signin"
            className="flex items-center gap-2 text-sm text-[#6E8276] hover:text-[#456564] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7]"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("back") || "Back"}
          </Link>
          <img
            src={OpsyHeader}
            alt="Opsy"
            className="h-8 w-auto opacity-90"
          />
        </div>

        <div className="flex-1 min-h-0 px-4 py-8 flex justify-center overflow-hidden">
          <div className="w-full max-w-3xl max-h-[calc(100dvh-8rem)] overflow-y-auto overflow-x-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6 md:p-8 prose prose-gray dark:prose-invert">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Privacy Policy
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
              Last updated: March 9, 2026
            </p>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                1. Introduction
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                Welcome to Opsy, part of HomeOps.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit heyopsy.com or use our services.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                By using our website or services, you agree to the practices described in this Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                2. Information We Collect
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                We may collect the following types of information:
              </p>
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2">
                Personal Information
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-2">
                Information you voluntarily provide to us, such as:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-600 dark:text-gray-400 text-sm mb-4">
                <li>Name</li>
                <li>Email address</li>
                <li>Account login information</li>
                <li>Billing information</li>
                <li>Payment details (processed through third-party payment providers)</li>
              </ul>
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2">
                Account Data
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-2">
                If you create an account, we may store:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-600 dark:text-gray-400 text-sm mb-4">
                <li>Profile information</li>
                <li>Uploaded documents or files</li>
                <li>Preferences and settings</li>
                <li>Usage history within the platform</li>
              </ul>
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2">
                Automatically Collected Information
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-2">
                When you use our website, we may automatically collect:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-600 dark:text-gray-400 text-sm">
                <li>IP address</li>
                <li>Browser type</li>
                <li>Device information</li>
                <li>Operating system</li>
                <li>Pages visited</li>
                <li>Time spent on pages</li>
                <li>Referring URLs</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-3">
                This information helps us improve the service and understand how users interact with the platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                3. How We Use Your Information
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-2">
                We may use the information we collect to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                <li>Provide, operate, and maintain our services</li>
                <li>Create and manage user accounts</li>
                <li>Process payments and subscriptions</li>
                <li>Improve and personalize user experience</li>
                <li>Communicate with you regarding updates or support</li>
                <li>Monitor usage and detect fraud or abuse</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                4. AI Processing
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                Some features of our platform may use artificial intelligence systems to process information submitted by users.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                For example, uploaded content or input data may be analyzed to generate suggestions, summaries, or other outputs.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                We take reasonable steps to ensure that data processed by AI systems is handled securely and only used for providing the requested functionality.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                5. Third-Party Services
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-2">
                We may use third-party providers to support our services, including:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-600 dark:text-gray-400 text-sm mb-4">
                <li>Payment processors</li>
                <li>Cloud hosting providers</li>
                <li>Analytics services</li>
                <li>Authentication providers</li>
                <li>Email delivery services</li>
                <li>AI service providers</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                These third parties may process certain data on our behalf and are expected to protect it in accordance with applicable privacy standards.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Examples may include providers such as Stripe, Supabase, AWS, Google, or OpenAI depending on the services used.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                6. Cookies and Tracking Technologies
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-2">
                We may use cookies and similar technologies to:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-600 dark:text-gray-400 text-sm mb-4">
                <li>Maintain user sessions</li>
                <li>Remember preferences</li>
                <li>Analyze site usage</li>
                <li>Improve performance</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                You may choose to disable cookies through your browser settings, though this may affect certain functionality of the website.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                7. Data Security
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                We implement reasonable administrative, technical, and organizational measures to protect your information from unauthorized access, disclosure, alteration, or destruction.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                However, no internet-based system can be guaranteed to be completely secure.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                8. Data Retention
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-2">
                We retain personal information only as long as necessary to:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-600 dark:text-gray-400 text-sm mb-4">
                <li>Provide our services</li>
                <li>Comply with legal obligations</li>
                <li>Resolve disputes</li>
                <li>Enforce our agreements</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Users may request deletion of their account and associated data at any time.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                9. Your Rights
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-2">
                Depending on your location, you may have rights regarding your personal data, including:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400 text-sm mb-4">
                <li>Access to your personal information</li>
                <li>Correction of inaccurate information</li>
                <li>Deletion of your data</li>
                <li>Restriction or objection to certain processing</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                To exercise these rights, please contact us using the information below.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                10. Children's Privacy
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                Our services are not intended for individuals under the age of 13 (or the minimum legal age in your jurisdiction). We do not knowingly collect personal information from children.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                If we learn that we have collected such information, we will take steps to delete it.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                11. Changes to This Privacy Policy
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Continued use of the service after changes indicates acceptance of the updated policy.
              </p>
            </section>

            <section className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                12. Contact Us
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                If you have any questions about this Privacy Policy, you may contact us at:
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed space-y-1">
                <span className="block">
                  <strong>Email:</strong>{" "}
                  <a
                    href="mailto:dev@heyopsy.com"
                    className="text-[#6E8276] hover:text-[#456564] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7] underline"
                  >
                    dev@heyopsy.com
                  </a>
                </span>
                <span className="block">
                  <strong>Website:</strong>{" "}
                  <a
                    href="https://heyopsy.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#6E8276] hover:text-[#456564] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7] underline"
                  >
                    heyopsy.com
                  </a>
                </span>
                <span className="block">
                  <strong>Company:</strong> HomeOps
                </span>
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

export default PrivacyPolicy;
