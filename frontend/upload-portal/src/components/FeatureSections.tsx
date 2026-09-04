import React, { useState } from 'react';
import { Sparkles, CheckCircle, Code2, Zap, ArrowUpRight, ArrowRight, Layers, FileText } from 'lucide-react';

interface FeatureSectionsProps {
  onBookDemo: () => void;
}

export const FeatureSections: React.FC<FeatureSectionsProps> = ({ onBookDemo }) => {
  // Feature 1 interactive document selector state
  const [selectedDocType, setSelectedDocType] = useState<string>('RTC / Pahani (Indic)');
  const docExamples: Record<string, { prompt: string; reasoning: string; topMatch: string; confidence: string }> = {
    'RTC / Pahani (Indic)': {
      prompt: "Parse scanned Devanagari RTC Pahani Document #2026-9921",
      reasoning: "Bilateral denoised + MinAreaRect Deskew (0.0°). Extracted Survey 142/3B, Khata 891-A, Owner: Ramesh Kumar, Area: 2.45 Acres.",
      topMatch: "Survey No. 142/3B",
      confidence: "99.2%"
    },
    'Mutation (Form XII)': {
      prompt: "Parse handwritten Mutation Extract Form XII #M-8812",
      reasoning: "Optical stroke variance detected. Flagged is_handwritten: true. Routed to Revenue Officer Review Queue.",
      topMatch: "Mutation Form XII #M-8812",
      confidence: "84.5%"
    },
    'Khata Certificate': {
      prompt: "Extract holding certificate details from Khatauni ledger",
      reasoning: "Parsed joint holding details, tax assessment status, and sub-registrar seal verification.",
      topMatch: "Khatauni Certificate #KC-412",
      confidence: "99.0%"
    },
    'Title / Sale Deed': {
      prompt: "Parse registered conveyance sale deed deed_2024.pdf",
      reasoning: "PyMuPDF 300 DPI rasterized. Validated grantor, grantee, and boundary schedule.",
      topMatch: "Registered Sale Deed #SD-901",
      confidence: "99.6%"
    }
  };

  // Feature 3 Impact Calculator state
  const [monthlyRecords, setMonthlyRecords] = useState<number>(25000);
  const hoursSavedPerMonth = Math.round((monthlyRecords * 0.45));
  const errorReductionPercent = 94;

  return (
    <div className="space-y-28 py-16 bg-[#f7f7f7]">

      {/* FEATURE 1: AI OCR & Multilingual Extraction Engine */}
      <section id="ocr-pipeline" className="px-4 sm:px-8 max-w-[1240px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Column: Title + Copy */}
          <div className="space-y-5">
            <div className="badge-neutral">
              <FileText className="w-3.5 h-3.5 text-[#f69251]" />
              Multilingual Indic OCR &amp; Document Classifier
            </div>
            <h2 className="heading-lg text-[#000000] tracking-[-0.5px]">
              Trained on legacy land records across 7 Indian scripts.
            </h2>
            <p className="font-inter text-[15px] sm:text-[17px] text-[#636363] leading-relaxed max-w-[500px]">
              VasudhaMithra ingests scanned or photographed Pattas, RTCs, and Khatas in Hindi, Kannada, Telugu, Tamil, Marathi, Bengali, and English — executing bilateral noise removal and deskewing before parsing.
            </p>
            <div className="pt-2">
              <button onClick={onBookDemo} className="btn-primary-pill text-[14px] px-6 py-2.5">
                <span>Explore OCR Pipeline</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Column: Interactive White Card Mockup */}
          <div className="bg-[#ffffff] rounded-[24px] p-6 sm:p-8 shadow-[rgba(24,24,37,0.08)_0px_2px_4px] border border-black/5 flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-[#f7f7f7] pb-4">
              <span className="font-inter font-medium text-[13px] text-[#181825] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#f69251]" /> Document Classification &amp; Routing
              </span>
              <span className="text-[11px] font-inter text-[#949494]">Live Pipeline Simulator</span>
            </div>

            {/* Document Type Selector Chips */}
            <div className="flex flex-wrap gap-2">
              {Object.keys(docExamples).map((docType) => (
                <button
                  key={docType}
                  onClick={() => setSelectedDocType(docType)}
                  className={`text-[13px] font-inter px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    selectedDocType === docType
                      ? 'bg-[#181825] text-[#ffffff] font-medium'
                      : 'bg-[#f7f7f7] text-[#636363] hover:text-[#000000]'
                  }`}
                >
                  {docType}
                </button>
              ))}
            </div>

            {/* Simulated OCR Extraction Output */}
            <div className="bg-[#f7f7f7] rounded-[16px] p-5 border border-black/5 space-y-4">
              <div>
                <span className="text-[11px] font-inter uppercase tracking-wider text-[#949494]">
                  Input Ingestion Token
                </span>
                <p className="text-[14px] font-inter font-medium text-[#181825] mt-1">
                  "{docExamples[selectedDocType].prompt}"
                </p>
              </div>

              <div className="border-t border-black/5 pt-3">
                <span className="text-[11px] font-inter uppercase tracking-wider text-[#f69251] flex items-center gap-1 font-medium">
                  <Sparkles className="w-3 h-3" /> VasudhaMithra Preprocessing &amp; OCR
                </span>
                <p className="text-[12px] font-inter text-[#484758] mt-1 leading-relaxed">
                  {docExamples[selectedDocType].reasoning}
                </p>
              </div>

              <div className="bg-[#ffffff] rounded-[12px] p-3.5 border border-black/5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-inter text-[#949494]">Parsed Record ID</span>
                  <h4 className="font-inter font-medium text-[14px] text-[#000000]">
                    {docExamples[selectedDocType].topMatch}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="font-inter font-semibold text-[14px] text-emerald-600">
                    {docExamples[selectedDocType].confidence}
                  </span>
                  <div className="text-[10px] font-inter text-[#949494]">Extraction Confidence</div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>


      {/* FEATURE 2: Dark Panel (Deep Slate #242433) for The Winning Feature — Spatial Consistency Engine */}
      <section id="gis-validation" className="px-4 sm:px-8 max-w-[1240px] mx-auto">
        <div className="bg-[#242433] rounded-[32px] p-8 sm:p-14 text-[#ffffff] relative overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
            
            {/* Left Column: PostGIS Spatial Code View */}
            <div className="bg-[#181825] rounded-[24px] p-6 border border-white/10 space-y-4 font-mono text-[13px]">
              <div className="flex items-center justify-between text-[#8b8b8b] border-b border-white/10 pb-3">
                <span className="flex items-center gap-2 text-[12px] text-[#fad7c1]">
                  <Code2 className="w-4 h-4 text-[#f69251]" /> spatial_consistency_engine.py
                </span>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  Rule: Δ% ≤ 5.0%
                </span>
              </div>
              
              <div className="space-y-2.5 text-[#949494]">
                <div><span className="text-[#f69251]"># Formula:</span> Δ% = |Area_doc - Area_gis| / Area_gis * 100</div>
                <div><span className="text-[#f69251]">area_gis</span> = ST_Area&#40;ST_Transform&#40;parcel_polygon, 3857&#41;&#41; / 4046.86</div>
                <div><span className="text-[#f69251]">delta_percent</span> = abs&#40;area_doc - area_gis&#41; / area_gis * 100.0</div>
                <div className="bg-[#242433] p-3 rounded-lg border border-white/5 text-white/90">
                  <span className="text-[#f69251]">validation:</span> &#123; "delta_percent": 1.23, "status": "✓ SPATIAL MATCH", "auto_advance": true &#125;
                </div>
              </div>
            </div>

            {/* Right Column: Copy + White Ghost Pill CTA */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3.5 py-1.5 text-[12px] font-inter text-[#fad7c1]">
                <Layers className="w-3.5 h-3.5 text-[#f69251]" />
                The Winning Feature — Spatial Consistency Engine
              </div>
              <h2 className="heading-lg text-[#ffffff] tracking-[-0.5px]">
                Detect Cadastral Overlaps &amp; Area Discrepancies Instantly.
              </h2>
              <p className="font-inter text-[15px] sm:text-[17px] text-[#949494] leading-relaxed">
                VasudhaMithra canonicalizes document text areas to Acres, queries PostGIS parcel geometry, and computes spatial variance Δ%. If Δ% ≤ 5.0%, records auto-approve; if Δ% &gt; 5.0%, they route to the high-risk review queue.
              </p>
              
              <div className="pt-2">
                <button onClick={onBookDemo} className="btn-ghost-pill">
                  <span>View GIS API Documentation</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* FEATURE 3: Smart Triage & Impact Calculator */}
      <section id="smart-triage" className="px-4 sm:px-8 max-w-[1240px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Column: Copy */}
          <div className="space-y-6">
            <div className="badge-neutral">
              <Zap className="w-3.5 h-3.5 text-[#f69251]" />
              Smart Handwriting Triage &amp; Edge-Case Benchmarks
            </div>
            <h2 className="heading-lg text-[#000000] tracking-[-0.5px]">
              Honest AI routing for cursive Indic handwriting.
            </h2>
            <p className="font-inter text-[15px] sm:text-[17px] text-[#636363] leading-relaxed">
              No fake AI: High-volume cursive Indic handwriting is an open research area. VasudhaMithra uses optical stroke variance analysis to route historical handwritten ledgers directly to Revenue Officers with explainable evidence notes.
            </p>
            <ul className="space-y-3 font-inter text-[15px] text-[#181825]">
              <li className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-[#f69251]" /> Automated MinAreaRect deskewing (±45°) &amp; noise filtering
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-[#f69251]" /> Robust edge-case benchmark suite (faded ink, duplicate survey IDs)
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-[#f69251]" /> Human-in-the-loop review queue with PATCH audit trails
              </li>
            </ul>
          </div>

          {/* Right Column: Calculator Card */}
          <div className="bg-[#ffffff] rounded-[24px] p-6 sm:p-8 shadow-[rgba(24,24,37,0.12)_0px_2px_3px_-2px] border border-black/5 flex flex-col gap-6">
            <h3 className="font-display-light text-[22px] text-[#000000]">
              Estimate Monthly Hours Saved
            </h3>

            {/* Slider 1: Monthly Records */}
            <div className="space-y-2">
              <div className="flex justify-between font-inter text-[14px]">
                <span className="text-[#636363]">Monthly Land Records:</span>
                <span className="font-semibold text-[#000000]">{monthlyRecords.toLocaleString()} documents</span>
              </div>
              <input
                type="range"
                min="5000"
                max="200000"
                step="2500"
                value={monthlyRecords}
                onChange={(e) => setMonthlyRecords(Number(e.target.value))}
                className="w-full accent-[#f69251] cursor-pointer"
              />
            </div>

            {/* Calculated Output Box */}
            <div className="bg-[#f7f7f7] rounded-[20px] p-5 border border-black/5 text-center space-y-1">
              <span className="text-[12px] font-inter uppercase tracking-wider text-[#636363]">
                Estimated Staff Hours Saved / Month
              </span>
              <div className="heading-display text-[#f69251] text-[40px] font-light">
                +{hoursSavedPerMonth.toLocaleString()} hrs / mo
              </div>
              <p className="text-[12px] font-inter text-[#484758]">
                With {errorReductionPercent}% reduction in manual verification errors
              </p>
            </div>

            <button onClick={onBookDemo} className="btn-primary-pill w-full py-3.5">
              Request Platform Demo
            </button>
          </div>

        </div>
      </section>


      {/* BANNER SECTION: Paper ledgers live in archives. VasudhaMithra digitizes the future. */}
      <section className="px-4 sm:px-8 max-w-[1240px] mx-auto text-center">
        <div className="bg-[#ffffff] rounded-[32px] p-8 sm:p-16 border border-black/5 shadow-[rgba(24,24,37,0.06)_0px_8px_30px] space-y-8">
          
          {/* Banner Headlines */}
          <div className="space-y-3 max-w-[840px] mx-auto">
            <h2 className="heading-display text-[#000000] tracking-[-0.7px]">
              Paper ledgers live in archives. <br />
              VasudhaMithra digitizes the future.
            </h2>
            <p className="font-inter text-[16px] sm:text-[18px] text-[#636363] leading-relaxed max-w-[640px] mx-auto">
              Replace manual land document verification with an end-to-end AI pipeline that OCRs, validates, and flags spatial discrepancies instantly.
            </p>
          </div>

          {/* Contextual UI Grid */}
          <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-left font-inter">
            
            {/* Widget 1 */}
            <div className="bg-[#f7f7f7] rounded-[20px] p-5 border border-black/5 space-y-3">
              <span className="text-[11px] font-medium text-[#949494] uppercase tracking-wider">AI OCR Extraction</span>
              <p className="text-[13px] font-medium text-[#000000]">Have a scanned survey document?</p>
              <div className="space-y-2">
                <button className="w-full text-left text-[12px] bg-[#ffffff] hover:bg-[#181825] hover:text-[#ffffff] px-3.5 py-2 rounded-full border border-black/5 transition-all flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#f69251]" /> Parse handwritten Patta record
                </button>
                <button className="w-full text-left text-[12px] bg-[#ffffff] hover:bg-[#181825] hover:text-[#ffffff] px-3.5 py-2 rounded-full border border-black/5 transition-all flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#f69251]" /> Extract 7/12 Khata details
                </button>
              </div>
            </div>

            {/* Widget 2 */}
            <div className="bg-[#f7f7f7] rounded-[20px] p-5 border border-black/5 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-[#949494] uppercase tracking-wider">Spatial Validation</span>
              <div className="bg-[#ffffff] rounded-[14px] p-3.5 border border-black/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-[8px] bg-[#181825] text-[#f69251] flex items-center justify-center flex-shrink-0 font-bold text-xs">
                  GIS
                </div>
                <div>
                  <h4 className="font-medium text-[13px] text-[#000000]">PostGIS Cadastral Layer</h4>
                  <p className="text-[11px] text-[#636363]">Spatial Δ% ≤ 5.0% Match</p>
                </div>
              </div>
            </div>

            {/* Widget 3 */}
            <div className="bg-[#f7f7f7] rounded-[20px] p-5 border border-black/5 space-y-3">
              <span className="text-[11px] font-medium text-[#949494] uppercase tracking-wider">Review Queue</span>
              <div className="bg-[#ffffff] rounded-[14px] p-3.5 border border-black/5 space-y-1">
                <span className="text-[11px] font-semibold text-[#181825] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Human Review Portal
                </span>
                <p className="text-[12px] text-[#484758]">
                  Survey 142/3B passed spatial rule with 99.2% auto-approval status.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

    </div>
  );
};
