export type PaymentRecipient = {
  id: string;
  name: string;
  phone: string;
  lastUsed: string;
  avatarTone: string;
};

export type PaymentMerchant = {
  id: string;
  name: string;
  identifier: string;
  avatarTone: string;
  category: string;
};

export type PaymentMethod = {
  id: 'mobile-money' | 'bank' | 'card';
  name: string;
  description: string;
  icon: 'wallet' | 'payments' | 'phone';
};

export const PAYMENT_RECIPIENTS: readonly PaymentRecipient[] = [
  { id: 'amanda', name: 'Amanda K.', phone: '+255 712 345 678', lastUsed: 'Today', avatarTone: '#7C9CF5' },
  { id: 'david', name: 'David M.', phone: '+255 655 991 204', lastUsed: 'Yesterday', avatarTone: '#34A596' },
  { id: 'faith', name: 'Faith A.', phone: '+255 764 903 221', lastUsed: '3 days ago', avatarTone: '#F0AA5C' },
  { id: 'maria', name: 'Maria S.', phone: '+255 788 210 334', lastUsed: 'A week ago', avatarTone: '#F07A6A' },
] as const;

export const PAYMENT_MERCHANTS: readonly PaymentMerchant[] = [
  { id: 'agrey', name: 'Agrey Pharmacy', identifier: 'AGR-2401', avatarTone: '#34A596', category: 'Pharmacy' },
  { id: 'mash', name: 'Mashujaa Market', identifier: 'MKT-1049', avatarTone: '#F0AA5C', category: 'Retail' },
  { id: 'jenga', name: 'Jenga Fuel', identifier: 'FUEL-562', avatarTone: '#7C9CF5', category: 'Fuel' },
] as const;

export const SAMPLE_REFERENCE = 'LNA-482910';
export const SAMPLE_RECEIPT_REFERENCE = 'TXN-2026-482910';
