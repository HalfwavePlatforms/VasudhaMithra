import React, { useState, useEffect } from 'react';
import { Menu, X, Globe } from 'lucide-react';

interface NavbarProps {
  onBookDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onBookDemo }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pt-4 px-4 sm:px-8 transition-all duration-300">
      <div
        className={`max-w-[1240px] mx-auto h-16 bg-[#ffffff] transition-all duration-300 flex items-center justify-between px-6 border border-black/5 ${
          isScrolled
            ? 'rounded-[32px] shadow-[rgba(24,24,37,0.08)_0px_4px_20px]'
            : 'rounded-[32px] shadow-[rgba(24,24,37,0.03)_0px_2px_8px]'
        }`}
      >
        {/* VasudhaMithra Brand Logo */}
        <a href="#" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 bg-[#000000] rounded-[6px] flex items-center justify-center relative overflow-hidden">
            <div className="w-3.5 h-3.5 border-t-2 border-r-2 border-[#f69251] transform rotate-45 translate-y-[1px] -translate-x-[1px]"></div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display-light text-[22px] font-normal tracking-tight text-[#000000]">
              VasudhaMithra
            </span>
            <span className="text-[10px] font-inter font-medium text-[#636363] bg-[#f7f7f7] px-1.5 py-0.5 rounded border border-black/5 hidden sm:inline">
              SIH26018
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7 text-[14px] font-inter text-[#484758]">
          <a href="#ocr-pipeline" className="hover:text-[#000000] transition-colors">
            Multilingual OCR
          </a>
          <a href="#gis-validation" className="hover:text-[#000000] transition-colors flex items-center gap-1">
            Spatial Engine
            <span className="w-1.5 h-1.5 rounded-full bg-[#f69251]"></span>
          </a>
          <a href="#smart-triage" className="hover:text-[#000000] transition-colors">
            Smart Triage
          </a>
          <a href="#review-queue" className="hover:text-[#000000] transition-colors">
            Review Queue
          </a>
          <a href="#impact" className="hover:text-[#000000] transition-colors">
            Impact Calculator
          </a>
        </nav>

        {/* Right Action CTA & Indic Script Badge */}
        <div className="flex items-center gap-3">
          <div className="hidden xl:flex items-center gap-1 text-[11px] font-inter text-[#636363] bg-[#f7f7f7] px-2.5 py-1 rounded-full border border-black/5">
            <Globe className="w-3 h-3 text-[#f69251]" /> 7 Indic Scripts
          </div>

          <button
            onClick={onBookDemo}
            className="btn-primary-pill text-[14px] px-5 py-2.5 shadow-sm"
          >
            <span>Digitize Record</span>
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-[#484758] hover:text-[#000000]"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 max-w-[1240px] mx-auto bg-[#ffffff] rounded-[24px] p-6 shadow-xl border border-black/5 flex flex-col gap-4 font-inter text-[15px]">
          <a href="#ocr-pipeline" onClick={() => setMobileMenuOpen(false)} className="py-2 border-b border-[#f7f7f7]">Multilingual OCR</a>
          <a href="#gis-validation" onClick={() => setMobileMenuOpen(false)} className="py-2 border-b border-[#f7f7f7]">Spatial Engine</a>
          <a href="#smart-triage" onClick={() => setMobileMenuOpen(false)} className="py-2 border-b border-[#f7f7f7]">Smart Triage</a>
          <a href="#review-queue" onClick={() => setMobileMenuOpen(false)} className="py-2 border-b border-[#f7f7f7]">Review Queue</a>
          <a href="#impact" onClick={() => setMobileMenuOpen(false)} className="py-2">Impact Calculator</a>
        </div>
      )}
    </header>
  );
};
