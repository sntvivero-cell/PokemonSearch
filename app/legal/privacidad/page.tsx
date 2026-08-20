import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy — GoTraderz',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-[#F4F6F8]">
      <header className="border-b border-[#232D38] bg-[#0B0F14]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#232D38]
                       text-[#8792A0] transition hover:border-[#3A4C63] hover:text-[#F4F6F8]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-base font-extrabold tracking-tight">Privacy Policy</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-[#8792A0]">
        <p className="mb-6 text-xs text-[#5C6773]">Last updated: August 2026.</p>

        <p className="mb-4">
          This policy explains what personal data <strong className="text-[#F4F6F8]">GoTraderz</strong>{' '}
          (hereinafter, &ldquo;the app&rdquo;, &ldquo;the site&rdquo;, or &ldquo;we&rdquo;) collects, what we use it for, and what rights you have
          over it under the European Union&apos;s General Data Protection Regulation (GDPR), if you reside in the EU,
          or under the data protection regulations applicable to your country.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">1. Data controller</h2>
        <p className="mb-4">
          GoTraderz is an independent fan project, run by its own team. For any questions about this
          policy or your personal data, you can write to{' '}
          <a href="mailto:contact@gotraderz.com" className="text-[#2E9BF5] hover:underline">
            contact@gotraderz.com
          </a>.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">2. What data we collect</h2>
        <p className="mb-2">To use GoTraderz, we collect:</p>
        <ul className="mb-4 ml-4 list-disc space-y-1">
          <li>Your email address, when you create an account.</li>
          <li>The username you choose when signing up.</li>
          <li>Your Pokémon GO friend code, only if you choose to add it (it&apos;s an optional field).</li>
          <li>The content of the trade posts you create (Pokémon offered/wanted, notes, etc.).</li>
          <li>The content of the messages you send other users through the internal chat.</li>
        </ul>
        <p className="mb-4">
          We do not collect payment data (GoTraderz does not process payments) or precise location data beyond
          what you write yourself in your posts or messages.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">3. Where data is stored</h2>
        <p className="mb-4">
          Data is stored on <strong className="text-[#F4F6F8]">Supabase</strong>&apos;s infrastructure,
          our database and authentication provider (Supabase, Inc.). Supabase runs on AWS infrastructure
          and lets you choose, when creating a project, the AWS region where it&apos;s hosted: it can be a region
          within the European Union (e.g. Frankfurt or Ireland) or outside it, depending on how this particular
          project has been configured.
        </p>
        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">4. Cookies</h2>
        <p className="mb-4">
          We only use technical cookies and local storage, strictly necessary for the site to function:
          keeping you signed in via Supabase Auth, and remembering your choice on the cookie notice. We don&apos;t
          use analytics, tracking, or advertising cookies. If we add any in the future, we&apos;ll update this
          policy and ask for your explicit consent before enabling them.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">5. What we use your data for</h2>
        <p className="mb-4">
          We use your data exclusively to operate the service: showing your posts and username to other
          community members, letting them contact you via chat, and keeping you signed in.{' '}
          <strong className="text-[#F4F6F8]">
            We do not sell or share your data with third parties, and we do not use it for advertising purposes.
          </strong>
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">6. Your rights</h2>
        <p className="mb-2">If your data is protected by the GDPR (or an equivalent regulation), you have the right to:</p>
        <ul className="mb-4 ml-4 list-disc space-y-1">
          <li><strong className="text-[#F4F6F8]">Access</strong>: know what data of yours we have.</li>
          <li><strong className="text-[#F4F6F8]">Rectification</strong>: correct inaccurate data (you can edit your username and friend code yourself from Settings).</li>
          <li><strong className="text-[#F4F6F8]">Erasure</strong> (&ldquo;right to be forgotten&rdquo;): ask us to delete your account and your data.</li>
          <li><strong className="text-[#F4F6F8]">Objection and restriction</strong> of the processing of your data.</li>
          <li><strong className="text-[#F4F6F8]">Portability</strong>: request a copy of your data in a reusable format.</li>
        </ul>
        <p className="mb-4">
          To exercise any of these rights, including full deletion of your account, write to us at{' '}
          <a href="mailto:contact@gotraderz.com" className="text-[#2E9BF5] hover:underline">
            contact@gotraderz.com
          </a>{' '}
          stating your username or registered email.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">7. How long we keep your data</h2>
        <p className="mb-4">
          We keep your data while your account is active. If you request account deletion, we remove your
          personal data and associated posts, unless the law requires us to keep some record for longer.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">8. Changes to this policy</h2>
        <p className="mb-4">
          We may update this policy occasionally. If we make significant changes, we&apos;ll indicate this by
          updating the date at the top of this page.
        </p>
      </div>
    </main>
  );
}
