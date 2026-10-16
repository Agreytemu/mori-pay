import type { ReactNode } from 'react';

const features = [
  {
    number: '01',
    title: 'Know what is happening',
    description:
      'See confirmed merchant payments and your internal ledger balance together, with the reporting period in your control.',
  },
  {
    number: '02',
    title: 'Keep payment activity close',
    description:
      'Find transactions, open their details, and export the available payment records when you need to review them.',
  },
  {
    number: '03',
    title: 'Manage your business QR',
    description:
      'Active merchants can create, save, print, and manage the Mori Pay QR codes available to their account.',
  },
];

export function LandingPage({
  onSignIn,
  feedback,
}: {
  onSignIn: () => void;
  feedback?: ReactNode;
}) {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="#home" aria-label="Mori Pay Merchant home">
          <img src="/brand/mori-pay-official-logo.png" alt="" />
          <span>Merchant</span>
        </a>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#features">What you can do</a>
          <a href="#how-it-works">Getting started</a>
        </nav>
        <button className="button button-primary landing-sign-in" onClick={onSignIn}>
          Sign in
        </button>
      </header>
      {feedback ? <div className="landing-feedback">{feedback}</div> : null}

      <section className="landing-hero" id="home">
        <div className="landing-hero-copy">
          <span className="eyebrow">MORI PAY · FOR YOUR BUSINESS</span>
          <h1>Run your merchant business with a clearer view.</h1>
          <p>
            A dedicated workspace for your Mori Pay merchant account. Review
            confirmed payments, follow your application, and manage available
            merchant tools—all connected to your Mori Pay account.
          </p>
          <div className="landing-actions">
            <button className="button button-primary" onClick={onSignIn}>
              Continue with Mori Pay <span aria-hidden="true">→</span>
            </button>
            <span>Already have a Mori Pay account? Sign in to get started.</span>
          </div>
          <div className="landing-trust">
            <span><i aria-hidden="true">✓</i> Existing Mori Pay account</span>
            <span><i aria-hidden="true">✓</i> Access checked by Mori Pay</span>
          </div>
        </div>
        <div className="landing-preview" aria-label="Merchant workspace features">
          <div className="preview-top">
            <span className="preview-indicator" />
            <span>MERCHANT WORKSPACE</span>
            <span className="preview-account">MORI PAY</span>
          </div>
          <div className="preview-welcome">
            <span className="eyebrow">YOUR BUSINESS AT A GLANCE</span>
            <strong>Welcome to your workspace</strong>
            <span>Payments and tools in one place.</span>
          </div>
          <div className="preview-balance">
            <span>Merchant ledger balance</span>
            <strong>Confirmed activity</strong>
            <i>Account information from Mori Pay</i>
          </div>
          <div className="preview-activity">
            <div><span className="preview-icon">↗</span><span><b>Transactions</b><small>Review recorded payments</small></span></div>
            <div><span className="preview-icon">▦</span><span><b>QR management</b><small>Tools for active merchants</small></span></div>
            <div><span className="preview-icon">▤</span><span><b>Reports</b><small>Explore available activity</small></span></div>
          </div>
          <p className="preview-footnote">Your merchant access is verified securely by Mori Pay.</p>
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="landing-section-heading">
          <span className="eyebrow">MADE FOR DAY-TO-DAY MANAGEMENT</span>
          <h2>The essentials for managing your Mori Pay business.</h2>
          <p>Sign in with the same account you already use in the Mori Pay app.</p>
        </div>
        <div className="landing-feature-grid">
          {features.map((feature) => (
            <article className="landing-feature" key={feature.number}>
              <span>{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-how" id="how-it-works">
        <div>
          <span className="eyebrow">GETTING STARTED</span>
          <h2>Your account, your application, your workspace.</h2>
          <p>
            No separate merchant website account is needed. Your application
            status and management access come from the Mori Pay server.
          </p>
        </div>
        <ol>
          <li><i>1</i><span><b>Sign in</b><small>Use your Mori Pay email and password or PIN.</small></span></li>
          <li><i>2</i><span><b>Check your status</b><small>Applicants can see the latest status linked to their account.</small></span></li>
          <li><i>3</i><span><b>Manage when approved</b><small>Merchant tools appear when your account is active.</small></span></li>
        </ol>
      </section>

      <section className="landing-cta">
        <div>
          <span className="eyebrow">MORI PAY MERCHANT</span>
          <h2>Ready to open your workspace?</h2>
          <p>Sign in securely with the Mori Pay account you already have.</p>
        </div>
        <button className="button button-primary" onClick={onSignIn}>
          Sign in to Mori Pay <span aria-hidden="true">→</span>
        </button>
      </section>

      <footer className="landing-footer">
        <img src="/brand/mori-pay-mark.png" alt="" />
        <span>Mori Pay Merchant</span>
        <span>Account status and merchant access are verified by Mori Pay.</span>
      </footer>
    </main>
  );
}
