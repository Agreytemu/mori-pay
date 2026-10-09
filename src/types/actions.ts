export type PaymentActionId = 'send' | 'receive' | 'pay' | 'request';

export type PaymentAction = {
  id: PaymentActionId;
  title: string;
  description: string;
  icon: 'send' | 'receive' | 'pay' | 'request';
  /** Route to open when the action is tapped. */
  route: string;
  /** Ordered list of bullet points shown on the Payments screen. */
  steps: readonly string[];
};

export type ProfileMenuSection = {
  id: string;
  title: string;
  rows: ProfileMenuRow[];
};

export type ProfileMenuRow = {
  id: string;
  label: string;
  icon: string;
  /** Right-hand text, e.g. a masked phone number. */
  value?: string;
  /** Renders a switch instead of a chevron. */
  toggle?: 'notifications' | 'biometrics';
  /** Renders a three-option segmented control instead of a chevron. */
  appearance?: true;
  /** Renders a chevron when no value/toggle/appearance is set. */
  navigate?: boolean;
  destructive?: boolean;
};