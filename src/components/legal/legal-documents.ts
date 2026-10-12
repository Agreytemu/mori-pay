import type { LegalDocument } from './LegalDocumentScreen';

import { APP } from '@/constants/app';

const LAST_UPDATED = '12 October 2026';

export const TERMS_OF_SERVICE: LegalDocument = {
  title: 'Terms of Service',
  updated: LAST_UPDATED,
  sections: [
    {
      heading: '1. About these terms',
      paragraphs: [
        'These Terms of Service apply when you access or use the Mori Pay mobile application and related payment services (the “Service”). By creating an account or using the Service, you agree to these terms. If you do not agree, do not create an account or use the Service.',
        'The Privacy Policy explains how personal information is handled and forms part of the information provided to you when you use Mori Pay.',
      ],
    },
    {
      heading: '2. Your account',
      paragraphs: [
        'Provide accurate, current information when registering and keep it up to date. You are responsible for protecting your password, PIN, device, and any other sign-in credentials. Do not share credentials or let another person use your account.',
        'Tell Mori Pay promptly if you suspect that someone has accessed your account or device without permission. You are responsible for activity authorised using your credentials, except where applicable law provides otherwise.',
      ],
    },
    {
      heading: '3. Payments and instructions',
      paragraphs: [
        'Review the recipient, amount, applicable fee, and other displayed details before confirming a payment. A confirmed instruction may be processed promptly and may not be reversible or cancellable. Contact support as soon as possible if you believe a payment is incorrect or unauthorised; a report does not guarantee that it can be reversed.',
        'The app displays the status and details available to Mori Pay. A payment may remain pending while it is processed by a payment provider. Do not treat a pending payment as completed.',
      ],
    },
    {
      heading: '4. Acceptable use',
      paragraphs: [
        'Use the Service only for lawful purposes and in accordance with applicable requirements. Do not use it for fraud, money laundering, sanctions evasion, or any other unlawful activity; do not interfere with its security or operation; and do not provide false or misleading account information.',
      ],
    },
    {
      heading: '5. Fees and service availability',
      paragraphs: [
        'Any fee applicable to a transaction will be shown in the app before you confirm it. Service features, transaction limits, and processing times may depend on your account status, payment method, and payment provider.',
        'We work to keep the Service available and secure, but maintenance, connectivity problems, or provider outages may interrupt or delay it. We may update or suspend a feature where reasonably necessary for security, legal, or operational reasons.',
      ],
    },
    {
      heading: '6. Account restrictions and closure',
      paragraphs: [
        'We may restrict or suspend access where necessary to protect an account, investigate suspected misuse, comply with legal requirements, or address a security or operational issue. Where appropriate and permitted, we will provide information about the restriction and how to contact support.',
        'You may ask for help closing your account by contacting support. Closure does not cancel pending transactions or obligations that arose before closure, and some records may need to be retained as described in the Privacy Policy or as required by law.',
      ],
    },
    {
      heading: '7. Changes and applicable law',
      paragraphs: [
        'We may revise these terms when the Service or applicable requirements change. We will publish the current version in the app and update the date above. Continued use after a change takes effect means you accept the revised terms, to the extent permitted by applicable law.',
        'These terms are intended to operate subject to applicable laws and consumer protections. Nothing in them limits a right that cannot lawfully be excluded.',
      ],
    },
    {
      heading: '8. Contact',
      paragraphs: [
        `For questions, payment concerns, or account support, contact ${APP.supportEmail}. Include enough information for us to identify your request, but do not send your password or PIN.`,
      ],
    },
  ],
};

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  updated: LAST_UPDATED,
  sections: [
    {
      heading: '1. Information covered',
      paragraphs: [
        'This policy describes how Mori Pay handles information when you use the app and related services. The information processed depends on the features you use and the information you choose to provide.',
      ],
    },
    {
      heading: '2. Information we use',
      paragraphs: [
        'Account information may include your name, email address, password credential, and email-verification status. Date of birth is optional during registration. If you choose to link a phone number or provide account-verification details, we use the information you submit for those features.',
        'To provide payments and account features, the service may process account identifiers, saved payment-method details, recipient or counterparty information, transaction amounts, fees, status, references, notes, and related support or security records.',
        'The service may also process device and session information needed to authenticate and protect your account, such as device platform, installation identifier, session tokens, and activity timestamps. Information stored in your device’s secure storage is used for the app’s local sign-in and app-lock features.',
      ],
    },
    {
      heading: '3. How information is used',
      paragraphs: [
        'We use information to create and manage accounts; authenticate users; verify email addresses; process and display payments; provide receipts, alerts, and support; prevent fraud and protect the Service; troubleshoot and maintain the system; and meet applicable legal, regulatory, accounting, and record-keeping obligations.',
      ],
    },
    {
      heading: '4. When information is shared',
      paragraphs: [
        'Information is shared only as needed to provide or protect the Service, respond to your instructions, or meet legal requirements. This may include payment and banking partners involved in a transaction; email, SMS, hosting, database, and other technical providers; and competent authorities where disclosure is required or legally permitted.',
        'A payment recipient may receive the information needed to identify and complete the payment. Third-party providers process information under their own applicable terms and privacy practices.',
      ],
    },
    {
      heading: '5. Storage and retention',
      paragraphs: [
        'Account and transaction information is processed by the service systems and providers used to operate Mori Pay. Some information is also stored securely on your device to support sign-in and app locking.',
        'Information is kept for as long as needed to provide the Service and for legitimate security, dispute-resolution, accounting, and legal purposes. Retention periods may differ by record type and applicable requirements.',
      ],
    },
    {
      heading: '6. Security',
      paragraphs: [
        'Mori Pay uses technical and organisational measures intended to protect information, including authenticated access and secure handling of credentials. No internet transmission, device, or storage system can be guaranteed completely secure. Keep your device and credentials protected and report suspected account access promptly.',
      ],
    },
    {
      heading: '7. Your choices and requests',
      paragraphs: [
        'You can review and update supported profile information in the app. You may contact support to ask about access to, correction of, or deletion of your personal information, or to raise a privacy concern. We may need to verify your identity and may retain information where required or permitted by law.',
        'You can manage device permissions and notification preferences through the relevant device or app settings. Disabling a permission or notification may affect the related feature.',
      ],
    },
    {
      heading: '8. Changes and contact',
      paragraphs: [
        'We may update this policy when our practices or applicable requirements change. The current version and its effective date will be available in the app.',
        `For privacy questions or requests, contact ${APP.supportEmail}. Do not include your password, PIN, or full payment credentials in your message.`,
      ],
    },
  ],
};
