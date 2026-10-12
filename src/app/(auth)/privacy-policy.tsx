import { LegalDocumentScreen } from '@/components/legal/LegalDocumentScreen';
import { PRIVACY_POLICY } from '@/components/legal/legal-documents';

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocumentScreen
      document={PRIVACY_POLICY}
      relatedPath="/terms-of-service"
      relatedLabel="Terms of Service"
    />
  );
}
