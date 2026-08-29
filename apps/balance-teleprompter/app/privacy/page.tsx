import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Balance Teleprompter',
  description: 'Privacy policy for Balance Teleprompter.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F8F5EE] px-5 py-10 text-[#151515] sm:py-16">
      <article className="mx-auto max-w-3xl rounded-[28px] border border-[#DED7C9] bg-white p-6 shadow-[0_20px_60px_rgba(21,21,21,.08)] sm:p-10">
        <Link href="/" className="text-sm font-medium text-[#6F6A61] hover:text-[#151515]">← Back to Balance Teleprompter</Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[#6F6A61]">Effective 29 August 2026</p>

        <div className="mt-8 space-y-7 text-[15px] leading-7 text-[#3D3933]">
          <section>
            <h2 className="text-lg font-semibold text-[#151515]">Your recordings and scripts</h2>
            <p className="mt-2">Balance Teleprompter processes your camera, microphone, script and recording on your device. We do not upload, view or store your scripts, photos, audio or videos on our servers. Recordings are saved or shared only when you choose to do so.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#151515]">Camera and microphone access</h2>
            <p className="mt-2">Camera access is used to show and record your video. Microphone access is used to record audio. You can deny or revoke either permission in your device settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#151515]">Purchases</h2>
            <p className="mt-2">The app offers three free recordings, followed by an optional one-time lifetime purchase. Apple or Google processes the payment and provides the app with purchase status so access can be unlocked or restored. Balance does not receive your full payment-card details.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#151515]">Local storage</h2>
            <p className="mt-2">Your script, preferences and free-use count may be saved locally on your device so they are available the next time you open the app. Clearing the app or browser data may remove this local information.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#151515]">Children and sensitive content</h2>
            <p className="mt-2">The app is a general-purpose recording tool and is not directed to children under 13. Please avoid including sensitive personal information in support requests.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#151515]">Contact</h2>
            <p className="mt-2">For privacy or support questions, contact Balance through <a className="font-medium underline decoration-[#D8B25E] underline-offset-4" href="https://plantbased-balance.org/contact.html">plantbased-balance.org/contact.html</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#151515]">Changes</h2>
            <p className="mt-2">We may update this policy as the app changes. The effective date above will be updated when material changes are made.</p>
          </section>
        </div>
      </article>
    </main>
  );
}
