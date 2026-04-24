import React from "react";
import {Link} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {ArrowLeft} from "lucide-react";
import OpsyHeader from "../../images/OpsyHeader.png";
import MountRainier from "../../images/MountRainier.webp";
import "../../i18n";

function TermsOfService() {
  const {t} = useTranslation();

  return (
    <main className="min-h-[100dvh] flex flex-col relative">
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
              Terms of Service
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
              Last updated: April 24, 2026
            </p>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                1. Agreement
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                These Terms of Service (&ldquo;Terms&rdquo;) govern your access
                to and use of Opsy, part of HomeOps (collectively,
                &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
                and our websites, applications, and related services
                (collectively, the &ldquo;Services&rdquo;). By creating an
                account, purchasing a paid plan, or using the Services, you
                agree to these Terms. If you do not agree, do not use the
                Services.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Our{" "}
                <Link
                  to="/privacy-policy"
                  className="text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Privacy Policy
                </Link>{" "}
                explains how we handle personal data and is incorporated by
                reference.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                2. Accounts and eligibility
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                You must provide accurate registration information and keep your
                login credentials secure. You are responsible for activity under
                your account. We may suspend or terminate accounts that violate
                these Terms or that present risk to the Services or other users.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                3. Subscriptions, fees, and billing
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                Paid plans are offered for recurring subscription periods (for
                example, monthly or annual) or as otherwise described at
                checkout. Fees are quoted in the currency shown before you
                complete payment. You authorize us and our payment processor
                (for example, Stripe) to charge your selected payment method for
                the fees applicable to your plan, including applicable taxes.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                Unless we state otherwise, subscriptions renew automatically at
                the end of each billing period at the then-current price until
                you cancel. You can cancel or change your plan through the
                billing or account tools we make available, subject to any
                notice periods described in the product.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                4. No refunds; access through the paid period
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                <strong className="text-gray-800 dark:text-gray-200">
                  All fees are non-refundable,
                </strong>{" "}
                except where refund or withdrawal rights are required by
                applicable law. If a mandatory cooling-off or cancellation right
                applies in your jurisdiction, you may exercise it only to the
                extent and in the manner required by that law.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                If you cancel a paid subscription or we terminate for breach, you
                will{" "}
                <strong className="text-gray-800 dark:text-gray-200">
                  continue to have access to the Services through the end of the
                  billing period you have already paid for
                </strong>{" "}
                (subject to your compliance with these Terms for that period),
                unless we state otherwise for your specific product or a
                particular promotion. Thereafter, your paid features may be
                downgraded or suspended according to your then-current plan
                entitlements.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                5. License and acceptable use
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                We grant you a limited, non-exclusive, non-transferable license
                to use the Services in accordance with these Terms and your
                plan. You will not misuse the Services, including by attempting to
                gain unauthorized access, interfere with the Services, or use
                them in violation of law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                6. Disclaimers and limitation of liability
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                The Services are provided &ldquo;as is&rdquo; to the maximum
                extent permitted by law. We disclaim warranties not expressly
                stated in these Terms. To the fullest extent permitted by
                applicable law, we are not liable for any indirect, incidental,
                special, consequential, or punitive damages, or for loss of
                profits, data, or goodwill, arising from your use of the
                Services. Our total liability for any claim arising from these
                Terms or the Services is limited to the amount you paid us for
                the Services in the twelve (12) months before the event giving
                rise to the claim, except where such limitations are not
                permitted by law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                7. Changes
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                We may update these Terms from time to time. We will post the
                updated Terms and revise the &ldquo;Last updated&rdquo; date. If
                a change is material, we will provide notice as required by law
                or as we otherwise deem appropriate. Continued use of the
                Services after the effective date constitutes acceptance of the
                updated Terms, except where a stricter process is required.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                8. Governing law
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                These Terms are governed by the laws of the State of
                Washington, USA, without regard to conflict-of-law rules,
                subject to any mandatory rights in your place of residence.
                Courts in Washington shall have exclusive jurisdiction, except
                where you have non-waivable rights to bring a claim in your home
                courts.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                9. Contact
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                For questions about these Terms, contact us through the support
                options provided in the Services or on our website.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

export default TermsOfService;
