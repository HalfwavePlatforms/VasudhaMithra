import React, { useState } from 'react';
import { Send, ChevronRight, User, FileText, CheckCircle2 } from 'lucide-react';

interface LogMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  recordDetails?: {
    surveyNo: string;
    khataNo: string;
    owner: string;
    docArea: string;
    gisArea: string;
    deltaPercent: string;
    scriptName: string;
    triageRouting: string;
    status: string;
    confidence: string;
    image: string;
  };
}

export const BrowserMockupFrame: React.FC = () => {
  const [messages, setMessages] = useState<LogMessage[]>([
    {
      id: '1',
      sender: 'user',
      text: "OCR scanned Devanagari Pahani RTC document #RTC-2026-9921, run handwriting triage, and calculate spatial consistency Δ% against PostGIS cadastral polygon."
    },
    {
      id: '2',
      sender: 'ai',
      text: "Pipeline Execution Complete: Image enhanced via Bilateral Filtering & MinAreaRect Deskew (0.0°). Printed Devanagari script detected. Spatial validation results below:",
      recordDetails: {
        surveyNo: "142/3B",
        khataNo: "891-A",
        owner: "Ramesh Kumar S/o Shankaran",
        docArea: "2.45 Acres",
        gisArea: "2.42 Acres",
        deltaPercent: "1.23%",
        scriptName: "Devanagari (Hindi / Devanagari)",
        triageRouting: "Automated Pipeline (Printed Text)",
        status: "✓ SPATIAL MATCH (Δ% ≤ 5.0%)",
        confidence: "99.2%",
        image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80"
      }
    }
  ]);

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const samplePrompts = [
    "Test spatial discrepancy Δ% > 5% on Survey 88/B",
    "Test handwritten cursive Indic register routing",
    "Run Bilateral noise filter on faded low-contrast Patta"
  ];

  const handleSend = (userText: string) => {
    const textToSend = userText || input;
    if (!textToSend.trim()) return;

    const userMsg: LogMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    setTimeout(() => {
      let responseMsg: LogMessage;
      if (textToSend.toLowerCase().includes('handwritten') || textToSend.toLowerCase().includes('cursive')) {
        responseMsg = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: 'Optical Stroke Variance Triage Gate: High cursive stroke variance detected on historical register. Flagged is_handwritten: true. Routed to Revenue Officer Review Queue with explainable notes.',
          recordDetails: {
            surveyNo: "77/4C",
            khataNo: "109-B",
            owner: "Historical Village Register",
            docArea: "3.10 Acres",
            gisArea: "3.12 Acres",
            deltaPercent: "0.64%",
            scriptName: "Kannada Cursive Script",
            triageRouting: "⚠ Routed to Review Queue (Handwritten)",
            status: "REQUIRES HUMAN REVIEW",
            confidence: "82.4%",
            image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=80"
          }
        };
      } else if (textToSend.toLowerCase().includes('discrepancy') || textToSend.toLowerCase().includes('88/b')) {
        responseMsg = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: 'Spatial Consistency Engine Triggered: Stated Doc Area = 4.80 Acres, PostGIS Geometry Polygon = 3.90 Acres. Calculated Δ% = 23.07% (> 5.0%). Tagged ⚠ SPATIAL DISCREPANCY (HIGH RISK). Flagged for field survey verification.',
          recordDetails: {
            surveyNo: "88/B",
            khataNo: "502-F",
            owner: "Vikram Singh",
            docArea: "4.80 Acres",
            gisArea: "3.90 Acres",
            deltaPercent: "23.07%",
            scriptName: "Devanagari (Hindi)",
            triageRouting: "High Risk Review Backlog",
            status: "⚠ SPATIAL DISCREPANCY (Δ% > 5.0%)",
            confidence: "98.9%",
            image: "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=400&q=80"
          }
        };
      } else {
        responseMsg = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: `VasudhaMithra Pipeline Result for "${textToSend}": Extracted 12 structured fields. Bilateral deskew angle 0.0°. Spatial Match Δ% = 0.85%.`,
          recordDetails: {
            surveyNo: "112/1A",
            khataNo: "312-C",
            owner: "Sunita Devi",
            docArea: "1.80 Acres",
            gisArea: "1.79 Acres",
            deltaPercent: "0.55%",
            scriptName: "Telugu Script",
            triageRouting: "Automated Pipeline (Printed Text)",
            status: "✓ SPATIAL MATCH (Δ% ≤ 5.0%)",
            confidence: "99.0%",
            image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80"
          }
        };
      }
      setMessages((prev) => [...prev, responseMsg]);
      setIsProcessing(false);
    }, 800);
  };

  return (
    <section className="px-4 sm:px-6 bg-[#f7f7f7] pb-16" id="ocr-pipeline">
      <div className="max-w-[1200px] mx-auto">
        {/* Browser Card Frame */}
        <div className="bg-[#ffffff] rounded-[24px] overflow-hidden border border-black/5 shadow-[rgba(24,24,37,0.06)_0px_8px_30px] relative">
          
          {/* Browser Header Chrome */}
          <div className="bg-[#f7f7f7] px-6 py-4 border-b border-black/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#c97b84]"></div>
              <div className="w-3 h-3 rounded-full bg-[#f69251]"></div>
              <div className="w-3 h-3 rounded-full bg-[#8b8b8b]"></div>
            </div>

            {/* Address Bar */}
            <div className="bg-[#ffffff] border border-black/5 rounded-full px-4 py-1 flex items-center gap-2 text-[12px] font-inter text-[#636363] max-w-[420px] w-full justify-center shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[#000000] font-medium">vasudhamithra.gov.in/pipeline/ocr-spatial-engine</span>
            </div>

            {/* Live Pipeline Status */}
            <div className="flex items-center gap-2 text-[12px] font-inter text-[#484758]">
              <span className="hidden sm:inline">FastAPI &amp; PostGIS Active</span>
              <div className="w-2 h-2 rounded-full bg-[#f69251] animate-ping"></div>
            </div>
          </div>

          {/* Interior AI Pipeline Interface */}
          <div className="p-4 sm:p-8 bg-[#ffffff] min-h-[480px] flex flex-col justify-between">
            
            {/* Pipeline Messages */}
            <div className="space-y-6 max-w-[860px] mx-auto w-full mb-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-[#181825] text-[#f69251] flex items-center justify-center font-display-light text-sm font-semibold flex-shrink-0 mt-1">
                      V
                    </div>
                  )}

                  <div
                    className={`max-w-[640px] rounded-[20px] p-4 text-[14px] leading-relaxed font-inter ${
                      msg.sender === 'user'
                        ? 'bg-[#181825] text-[#ffffff] rounded-tr-none'
                        : 'bg-[#f7f7f7] text-[#181825] border border-black/5 rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>

                    {/* Extracted Record Card */}
                    {msg.recordDetails && (
                      <div className="bg-[#ffffff] rounded-[16px] p-4 border border-black/5 shadow-[rgba(0,0,0,0.03)_0px_2px_4px] mt-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-[#f7f7f7] pb-2">
                          <span className="text-[12px] font-medium text-[#181825] flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-[#f69251]" /> Scanned Land Record #{msg.recordDetails.surveyNo}
                          </span>
                          <span className="bg-emerald-50 text-emerald-700 font-medium text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-200">
                            Confidence: {msg.recordDetails.confidence}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12px]">
                          <div>
                            <span className="text-[#949494] text-[10px] uppercase block">Survey No</span>
                            <strong className="text-[#000000]">{msg.recordDetails.surveyNo}</strong>
                          </div>
                          <div>
                            <span className="text-[#949494] text-[10px] uppercase block">Khata No</span>
                            <strong className="text-[#000000]">{msg.recordDetails.khataNo}</strong>
                          </div>
                          <div>
                            <span className="text-[#949494] text-[10px] uppercase block">Script</span>
                            <strong className="text-[#000000] truncate block">{msg.recordDetails.scriptName}</strong>
                          </div>
                          <div>
                            <span className="text-[#949494] text-[10px] uppercase block">Doc Extent</span>
                            <strong className="text-[#000000]">{msg.recordDetails.docArea}</strong>
                          </div>
                          <div>
                            <span className="text-[#949494] text-[10px] uppercase block">GIS Polygon</span>
                            <strong className="text-[#000000]">{msg.recordDetails.gisArea}</strong>
                          </div>
                          <div>
                            <span className="text-[#949494] text-[10px] uppercase block">Spatial Δ%</span>
                            <strong className={parseFloat(msg.recordDetails.deltaPercent) > 5 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                              {msg.recordDetails.deltaPercent}
                            </strong>
                          </div>
                        </div>

                        <div className="bg-[#f7f7f7] p-2.5 rounded-[12px] text-[12px] text-[#484758] flex items-center justify-between border border-black/5">
                          <span className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            {msg.recordDetails.status}
                          </span>
                          <span className="text-[11px] text-[#636363]">
                            {msg.recordDetails.triageRouting}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-[#f7f7f7] border border-black/10 text-[#484758] flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {isProcessing && (
                <div className="flex gap-3 justify-start items-center">
                  <div className="w-8 h-8 rounded-full bg-[#181825] text-[#f69251] flex items-center justify-center font-display-light text-sm">
                    V
                  </div>
                  <div className="bg-[#f7f7f7] px-4 py-2.5 rounded-[20px] rounded-tl-none border border-black/5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#949494] animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-[#949494] animate-bounce delay-100"></span>
                    <span className="w-2 h-2 rounded-full bg-[#949494] animate-bounce delay-200"></span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prompts + Input Bar */}
            <div className="max-w-[860px] mx-auto w-full">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-[11px] font-inter text-[#949494] self-center mr-1">
                  Try asking:
                </span>
                {samplePrompts.map((promptText, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(promptText)}
                    className="text-[12px] font-inter bg-[#f7f7f7] hover:bg-[#181825] hover:text-[#ffffff] text-[#484758] px-3 py-1 rounded-full border border-black/5 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {promptText}
                    <ChevronRight className="w-3 h-3 text-[#949494]" />
                  </button>
                ))}
              </div>

              {/* Input Row */}
              <div className="flex items-center bg-[#f7f7f7] border border-black/10 rounded-[28px] p-1.5 focus-within:border-[#f69251] transition-colors shadow-sm">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                  placeholder="Enter land record ID, survey number, or test script query..."
                  className="w-full bg-transparent px-4 text-[14px] font-inter text-[#000000] placeholder-[#949494] outline-none"
                />
                <button
                  onClick={() => handleSend(input)}
                  className="bg-[#f69251] hover:bg-[#f69251]/90 text-[#000000] w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

          <div className="h-10 bg-gradient-to-t from-[#f7f7f7] to-transparent w-full pointer-events-none"></div>
        </div>
      </div>
    </section>
  );
};
