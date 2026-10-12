import { LegalDocumentScreen } from '@/components/legal/LegalDocumentScreen';
import { TERMS_OF_SERVICE } from '@/components/legal/legal-documents';

export default function TermsOfServiceScreen() {
  return (
    <LegalDocumentScreen
      document={TERMS_OF_SERVICE}
      relatedPath="/privacy-policy"
      relatedLabel="Privacy Policy"
    />
  );
}
