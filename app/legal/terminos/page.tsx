import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Terms of Use — GoTraderz',
};

export default function TermsOfUsePage() {
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
          <h1 className="text-base font-extrabold tracking-tight">Terms of Use</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-[#8792A0]">
        <p className="mb-6 text-xs text-[#5C6773]">Last updated: August 2026.</p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">1. What GoTraderz is</h2>
        <p className="mb-4">
          GoTraderz is a fan-made tool for Pokémon GO players to post which Pokémon they&apos;re offering
          and which they&apos;re looking for in return, and to coordinate trades with each other via chat. It is an
          independent project, not affiliated with Niantic, Inc., The Pokémon Company, Nintendo, or Game Freak.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">2. No guarantee that trades will happen</h2>
        <p className="mb-4">
          GoTraderz is only a listing board and a contact channel between users. We do not guarantee that a
          posted trade will actually happen, nor do we verify the identity, real location, or good faith of
          other users. Coordinating and carrying out the trade within Pokémon GO is the sole responsibility of
          the people involved.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">3. Responsibility for posted content</h2>
        <p className="mb-4">
          Each user is solely responsible for the content they post: their trade posts, notes, username, friend
          code (if added), and chat messages. GoTraderz does not review that content before it is published.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">4. What is not allowed</h2>
        <p className="mb-2">You may not use GoTraderz to post or send:</p>
        <ul className="mb-4 ml-4 list-disc space-y-1">
          <li>Offensive, discriminatory, harassing, or threatening content.</li>
          <li>Spam, unrelated advertising, or abusively repeated posts.</li>
          <li>Illegal content, or content that promotes illegal activity (for example, location spoofing for scam purposes).</li>
          <li>Attempts to scam other users, or identity impersonation.</li>
        </ul>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">5. Moderation</h2>
        <p className="mb-4">
          We may remove posts, messages, or accounts that violate these rules, without prior notice and at our
          discretion, to keep the community usable for everyone.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">6. The service is provided &ldquo;as is&rdquo;</h2>
        <p className="mb-4">
          GoTraderz is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind, either
          express or implied, including (but not limited to) warranties of uninterrupted availability,
          error-free operation, or fitness for a particular purpose. You use the service at your own risk.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">7. Changes to these terms</h2>
        <p className="mb-4">
          We may update these terms occasionally. If we make significant changes, we&apos;ll indicate this by
          updating the date at the top of this page.
        </p>

        <h2 className="mb-2 mt-6 text-sm font-bold text-[#F4F6F8]">8. Contact</h2>
        <p className="mb-4">
          For questions about these terms, write to us at{' '}
          <a href="mailto:contact@gotraderz.com" className="text-[#2E9BF5] hover:underline">
            contact@gotraderz.com
          </a>.
        </p>
      </div>
    </main>
  );
}
