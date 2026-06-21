import { Suspense } from 'react';
import UpgradeContent from './UpgradeContent';

export default function UpgradePage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>}><UpgradeContent /></Suspense>;
}

// Made with Bob
