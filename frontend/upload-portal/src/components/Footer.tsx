import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface FooterProps {
  onBookDemo: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onBookDemo }) => {
  return (
    <footer className="bg-[#f7f7f7] border-t border-black/5 pt-16 pb-12 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-16">
          
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <a href="#" className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-[#000000] rounded-[6px] flex items-center justify-center relative overflow-hidden">
                <div className="w-3.5 h-3.5 border-t-2 border-r-2 border-[#f69251] transform rotate-45 translate-y-[1px] -translate-x-[1px]"></div>
              </div>
              <span className="font-display-light text-xl font-normal text-[#000000] flex items-center gap-1">
                VasudhaMithra
                <ArrowUpRight className="w-4 h-4 text-[#636363]" />
              </span>
            </a>
            <p className="font-inter text-[14px] text-[#636363] leading-relaxed max-w-[340px]">
              Intelligent Land Record Digitization & Validation System (SIH26018). OCR legacy scanned records and validate cadastral maps instantly.
            </p>
            {/* System Status & CTA */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="inline-flex items-center gap-2 bg-[#ffffff] border border-black/5 rounded-full px-3 py-1 text-[12px] font-inter text-[#484758] shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                FastAPI & PostGIS Services Operational
              </div>
              <button
                onClick={onBookDemo}
                className="text-[12px] font-inter font-medium text-[#f69251] hover:underline cursor-pointer"
              >
                Request Demo →
              </button>
            </div>
          </div>

          {/* Column 1: Services */}
          <div className="space-y-3 font-inter">
            <h4 className="text-[13px] font-medium uppercase tracking-wider text-[#000000]">Pipeline</h4>
            <ul className="space-y-2 text-[14px] text-[#636363]">
              <li><a href="#ocr-pipeline" className="hover:text-[#000000] transition-colors">OCR Engine</a></li>
              <li><a href="#gis-validation" className="hover:text-[#000000] transition-colors">PostGIS Overlay</a></li>
              <li><a href="#review-queue" className="hover:text-[#000000] transition-colors">Review Queue</a></li>
              <li><a href="#impact" className="hover:text-[#000000] transition-colors">Impact Calculator</a></li>
            </ul>
          </div>

          {/* Column 2: Architecture */}
          <div className="space-y-3 font-inter">
            <h4 className="text-[13px] font-medium uppercase tracking-wider text-[#000000]">Architecture</h4>
            <ul className="space-y-2 text-[14px] text-[#636363]">
              <li><a href="#" className="hover:text-[#000000] transition-colors">FastAPI Gateway</a></li>
              <li><a href="#" className="hover:text-[#000000] transition-colors">PostgreSQL + PostGIS</a></li>
              <li><a href="#" className="hover:text-[#000000] transition-colors">Extraction Engine</a></li>
              <li><a href="#" className="hover:text-[#000000] transition-colors">GIS Cadastral Layer</a></li>
            </ul>
          </div>

          {/* Column 3: SIH Project */}
          <div className="space-y-3 font-inter">
            <h4 className="text-[13px] font-medium uppercase tracking-wider text-[#000000]">SIH26018</h4>
            <ul className="space-y-2 text-[14px] text-[#636363]">
              <li><a href="#" className="hover:text-[#000000] transition-colors">API Contracts</a></li>
              <li><a href="#" className="hover:text-[#000000] transition-colors">Docker Setup</a></li>
              <li><a href="#" className="hover:text-[#000000] transition-colors">Synthetic Data</a></li>
              <li><a href="#" className="hover:text-[#000000] transition-colors">Audit Trail Logs</a></li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="pt-8 border-t border-black/5 flex flex-col sm:flex-row items-center justify-between gap-4 font-inter text-[13px] text-[#949494]">
          <p>© {new Date().getFullYear()} VasudhaMithra Project (SIH26018). Built with Dialog design tokens.</p>
          <div className="flex items-center gap-6">
            <a href="https://github.com/HalfwavePlatforms/VasudhaMithra" target="_blank" rel="noreferrer" className="hover:text-[#636363] transition-colors">GitHub Repo</a>
            <a href="#" className="hover:text-[#636363] transition-colors">API Specs</a>
            <a href="#" className="hover:text-[#636363] transition-colors">Architecture</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
