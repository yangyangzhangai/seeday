import React from 'react';
import { MembershipPurchaseModal } from '../../components/membership/MembershipPurchaseModal';

interface UpgradeModalProps {
  onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ onClose }) => {
  return <MembershipPurchaseModal onClose={onClose} />;
};
