import type { MerchantApplication } from '../types';
import { formatDate } from '../utils/format';

const statusDetails = {
  pending_payment: {
    title: 'Application received',
    detail:
      'Your application has been received. If a registration-fee step is required, complete it in the Mori Pay mobile app.',
    step: 1,
  },
  awaiting_review: {
    title: 'Application under review',
    detail:
      'Mori Pay has received your application and it is waiting for a review decision. You can return here to check for an update.',
    step: 2,
  },
  approved: {
    title: 'Application approved',
    detail:
      'Your application is approved. Merchant management tools will appear here when the active merchant account is available.',
    step: 3,
  },
  rejected: {
    title: 'Application needs attention',
    detail:
      'The latest review did not approve this application. Read any review note below, then contact Mori Pay support about next steps.',
    step: 0,
  },
} satisfies Record<MerchantApplication['status'], { title: string; detail: string; step: number }>;

export function ApplicationStatusPage({
  application,
}: {
  application: MerchantApplication | null;
}) {
  if (!application) {
    return (
      <section className="application-card">
        <span className="application-icon" aria-hidden="true">⌂</span>
        <span className="eyebrow">MERCHANT APPLICATION</span>
        <h2>No merchant application found</h2>
        <p className="muted">
          Your Mori Pay account is connected, but there is no merchant
          application linked to it yet. Start an application in the Mori Pay
          mobile app. Once submitted, sign in here again to follow the review
          status.
        </p>
        <div className="application-steps">
          <span><i>1</i><b>Apply</b><small>Submit your business details in the app.</small></span>
          <span><i>2</i><b>Review</b><small>Mori Pay checks the application.</small></span>
          <span><i>3</i><b>Manage</b><small>Use this website after approval.</small></span>
        </div>
        <p className="app-cta">No extra website account is required; use your existing Mori Pay login.</p>
      </section>
    );
  }

  const detail = statusDetails[application.status];
  return (
    <section className="application-card application-tracker">
      <span className="eyebrow">MERCHANT APPLICATION TRACKER</span>
      <div className="application-business">
        <span className="application-icon" aria-hidden="true">⌂</span>
        <div>
          <h2>{application.businessName}</h2>
          <p className="muted">{application.category} · Submitted {formatDate(application.createdAt)}</p>
        </div>
      </div>
      {application.tin || application.businessLicenceNumber || application.region || application.district || application.physicalAddress || application.phone ? (
        <dl className="application-details">
          {application.tin ? (<><dt>TIN</dt><dd>{application.tin}</dd></>) : null}
          {application.businessLicenceNumber ? (<><dt>Business licence</dt><dd>{application.businessLicenceNumber}</dd></>) : null}
          {application.region || application.district ? (<><dt>Location</dt><dd>{[application.region, application.district].filter(Boolean).join(' · ')}</dd></>) : null}
          {application.physicalAddress ? (<><dt>Physical address</dt><dd>{application.physicalAddress}</dd></>) : null}
          {application.phone ? (<><dt>Business phone</dt><dd>{application.phone}</dd></>) : null}
        </dl>
      ) : null}
      <span className={`application-status status-${application.status}`}>
        {detail.title}
      </span>
      <p className="muted application-description">{detail.detail}</p>
      {application.status !== 'rejected' ? (
        <ol className="application-timeline">
          {[
            ['Application submitted', 'Your merchant details are on file.'],
            ['Registration requirements', 'Complete the configured registration step in the Mori Pay app.'],
            ['Mori Pay review', 'We verify the information and review the application.'],
            ['Merchant tools', 'Management opens after approval and account activation.'],
          ].map(([title, message], index) => {
            const complete = index < detail.step;
            const current = index === detail.step;
            return (
              <li className={`${complete ? 'complete' : ''} ${current ? 'current' : ''}`} key={title}>
                <span className="timeline-dot">{complete ? '✓' : index + 1}</span>
                <span><strong>{title}</strong><small>{message}</small></span>
              </li>
            );
          })}
        </ol>
      ) : null}
      {application.reviewNote ? (
        <div className="review-note">
          <span className="eyebrow">REVIEW NOTE</span>
          <p>{application.reviewNote}</p>
        </div>
      ) : null}
      {application.paidAt ? (
        <p className="application-meta">
          Registration payment confirmed · {new Date(application.paidAt).toLocaleDateString()}
        </p>
      ) : null}
      <p className="application-meta">
        Application reference: <code>{application.id}</code>
      </p>
    </section>
  );
}
