import React, { useState } from 'react';
import { Star, CheckCircle2, Sparkles, Search } from 'lucide-react';
import confetti from 'canvas-confetti';

interface HeroSectionProps {
  onBookDemo: (email?: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onBookDemo }) => {
  const [recordInput, setRecordInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [heroSearchQuery, setHeroSearchQuery] = useState('Survey No. 142/3B - Khata No. 891 (Bhoomi / Bhulekh)');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordInput) return;
    setSubmitted(true);
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.65 },
      colors: ['#f69251', '#181825', '#c97b84']
    });
    setTimeout(() => {
      onBookDemo(recordInput);
    }, 600);
  };

  return (
    <section className="pt-36 pb-12 px-4 sm:px-6 bg-[#f7f7f7] relative overflow-hidden text-center">
      <div className="max-w-[1100px] mx-auto flex flex-col items-center">

        {/* Feature Badge */}
        <div className="mb-6 inline-flex items-center gap-2 bg-[#ffffff] border border-black/5 rounded-full px-3.5 py-1.5 shadow-[rgba(0,0,0,0.02)_0px_2px_4px]">
          <span className="w-2 h-2 rounded-full bg-[#f69251] animate-pulse"></span>
          <span className="font-inter font-medium text-[12px] tracking-wide uppercase text-[#484758]">
            SIH26018 · Multilingual OCR & Spatial Consistency Engine
          </span>
        </div>

        {/* Hero Headline — PP Radio Grotesk Light 70px */}
        <h1 className="heading-display max-w-[960px] tracking-[-0.7px] text-[#000000] mb-6 leading-[1.12]">
          Intelligent land record digitization <br className="hidden sm:inline" />
          and automated PostGIS spatial validation
        </h1>

        {/* Subheading — Inter 400 18px */}
        <p className="font-inter font-normal text-[17px] sm:text-[19px] text-[#636363] leading-[1.50] max-w-[680px] mb-10">
          Parse legacy scanned Pattas, RTCs, and Khatas across 7 Indian scripts, <span className="underline underline-offset-4 decoration-black/30">and flag cadastral area discrepancies (Δ% &gt; 5.0%) instantly</span>.
        </p>

        {/* Record Input + Orange Pill CTA Inline Form */}
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[500px] mb-8 flex items-center justify-between bg-[#ffffff] p-2 rounded-full shadow-[rgba(24,24,37,0.06)_0px_4px_16px] border border-black/5"
        >
          <input
            type="text"
            value={recordInput}
            onChange={(e) => setRecordInput(e.target.value)}
            placeholder="Enter Survey No., Khata No., or Record ID..."
            className="w-full bg-transparent px-5 text-[15px] font-inter text-[#000000] placeholder-[#949494] outline-none"
            required
          />
          <button
            type="submit"
            className="btn-primary-pill whitespace-nowrap text-[14px] px-6 py-2.5 flex-shrink-0"
          >
            {submitted ? (
              <span className="flex items-center gap-1 text-black">
                <CheckCircle2 className="w-4 h-4" /> Validated!
              </span>
            ) : (
              <span>Digitize Record</span>
            )}
          </button>
        </form>

        {/* Star Rating Micro Trust Rows */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-[#636363] font-inter text-[12px] mb-14">
          {/* Indic Script Support */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#181825] text-white rounded flex items-center justify-center font-bold text-[10px]">
              7
            </div>
            <div className="flex text-[#f69251]">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-[#f69251]" />
              ))}
            </div>
            <span className="text-[#636363]">Hindi, Kannada, Telugu, Tamil, Marathi + 2</span>
          </div>

          <div className="hidden sm:block w-1 h-1 rounded-full bg-[#8b8b8b]"></div>

          {/* Spatial Match Validation */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#181825] text-white rounded-full flex items-center justify-center font-bold text-[10px]">
              GIS
            </div>
            <div className="flex text-[#f69251]">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-[#f69251]" />
              ))}
            </div>
            <span className="text-[#636363]">PostGIS Δ% ≤ 5.0% Spatial Auto-Match</span>
          </div>
        </div>

        {/* Floating Search / AI Prompt Widget */}
        <div className="w-full max-w-[580px] bg-[#ffffff] rounded-full p-2.5 shadow-[rgba(24,24,37,0.08)_0px_6px_24px] border border-black/5 flex items-center justify-between text-[14px] font-inter">
          <div className="flex items-center gap-3 px-3 text-[#636363] w-full">
            <Search className="w-4 h-4 text-[#949494]" />
            <input
              type="text"
              value={heroSearchQuery}
              onChange={(e) => setHeroSearchQuery(e.target.value)}
              className="bg-transparent text-[#181825] w-full outline-none"
            />
          </div>
          <button className="flex items-center gap-1.5 text-[13px] font-medium text-[#181825] bg-[#f7f7f7] hover:bg-[#181825] hover:text-[#ffffff] px-4 py-1.5 rounded-full transition-all cursor-pointer flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#f69251]" />
            <span>Run OCR &amp; Spatial Check</span>
          </button>
        </div>

      </div>
    </section>
  );
};
