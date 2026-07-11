// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import AuthModal from './AuthModal';

export default function App() {
  return (
    <>
      {/* 
        This React shell mounts and displays our floating, secure Supabase 
        authentication portal dynamically over your static CAD workspace.
      */}
      <AuthModal />
    </>
  );
}