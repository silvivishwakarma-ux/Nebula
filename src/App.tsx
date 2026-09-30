/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SniperGame } from './components/SniperGame';

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-body selection:bg-red-500 selection:text-white">
      {/* Subtle ambient surveillance background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/6 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-red-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-2 sm:p-4">
        <SniperGame />
      </div>

      {/* Discreet military surveillance footer */}
      <footer className="relative z-10 py-2.5 text-center text-[11px] font-tactical text-slate-600 border-t border-slate-900">
        <div className="flex items-center justify-center gap-2">
          <span>ROOK TACTICAL SYSTEMS</span>
          <span aria-hidden="true">·</span>
          <span>BALLISTIC WIND & SCOPE SIMULATION</span>
          <span aria-hidden="true">·</span>
          <span>HTML5 CANVAS & WEB AUDIO SYNTHESIS</span>
        </div>
      </footer>
    </main>
  );
}
