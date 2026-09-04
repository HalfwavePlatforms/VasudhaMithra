import React, { useState } from 'react';
import { X, Check, ArrowRight, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export const DemoModal: React.FC<DemoModalProps> = ({ isOpen, onClose, initialEmail = '' }) => {
  const [email, setEmail] = useState(initialEmail);
  const [district, setDistrict] = useState('');
  const [docFormat, setDocFormat] = useState('RTC / Adangal Pahani');
  const [slot, setSlot] = useState('Tomorrow, 11:00 AM IST');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f69251', '#181825', '#c97b84']
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#ffffff] rounded-[32px] p-6 sm:p-8 max-w-[540px] w-full shadow-[rgba(24,24,37,0.25)_0px_20px_50px] border border-black/5 relative overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-[#636363] hover:text-[#000000] rounded-full bg-[#f7f7f7] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!submitted ? (
          <div>
            <div className="badge-neutral mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#f69251]" />
              SIH26018 Platform Walkthrough
            </div>

            <h3 className="heading-md text-[#000000] mb-2">
              Request VasudhaMithra Demo
            </h3>
            <p className="font-inter text-[14px] text-[#636363] mb-6">
              Experience automated land record OCR parsing, field extraction, and PostGIS cadastral spatial validation in real time.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[12px] font-inter font-medium text-[#484758] mb-1">
                  Official / Department Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@revenue.gov.in"
                  className="w-full bg-[#f7f7f7] border border-black/10 rounded-[12px] px-4 py-2.5 text-[14px] font-inter text-[#000000] outline-none focus:border-[#f69251]"
                />
              </div>

              {/* District / Region */}
              <div>
                <label className="block text-[12px] font-inter font-medium text-[#484758] mb-1">
                  District / Survey Region
                </label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Medak District / Survey Circle 4"
                  className="w-full bg-[#f7f7f7] border border-black/10 rounded-[12px] px-4 py-2.5 text-[14px] font-inter text-[#000000] outline-none focus:border-[#f69251]"
                />
              </div>

              {/* Document Format */}
              <div>
                <label className="block text-[12px] font-inter font-medium text-[#484758] mb-1">
                  Primary Record Format
                </label>
                <select
                  value={docFormat}
                  onChange={(e) => setDocFormat(e.target.value)}
                  className="w-full bg-[#f7f7f7] border border-black/10 rounded-[12px] px-4 py-2.5 text-[14px] font-inter text-[#000000] outline-none focus:border-[#f69251]"
                >
                  <option value="RTC / Adangal Pahani">RTC / Adangal Pahani</option>
                  <option value="Patta Title Deed">Patta Title Deed</option>
                  <option value="7/12 Extract">Village Form 7/12 Extract</option>
                  <option value="FMB Cadastral Map">FMB Cadastral Survey Map</option>
                </select>
              </div>

              {/* Time Slot */}
              <div>
                <label className="block text-[12px] font-inter font-medium text-[#484758] mb-1">
                  Preferred Time Slot
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Tomorrow, 11:00 AM',
                    'Tomorrow, 3:00 PM',
                    'Thursday, 10:00 AM',
                    'Thursday, 4:00 PM'
                  ].map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setSlot(t)}
                      className={`text-[12px] font-inter py-2 px-3 rounded-[10px] border transition-all text-left ${
                        slot === t
                          ? 'border-[#f69251] bg-[#f69251]/10 text-[#000000] font-medium'
                          : 'border-black/10 bg-[#f7f7f7] text-[#636363]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" className="btn-primary-pill w-full py-3">
                  <span>Confirm Demo Schedule</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#f69251]/20 text-[#f69251] flex items-center justify-center mx-auto">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="heading-md text-[#000000]">
              Demo Request Confirmed!
            </h3>
            <p className="font-inter text-[14px] text-[#636363] max-w-[360px] mx-auto">
              We've scheduled your VasudhaMithra walkthrough for <strong className="text-[#000000]">{slot}</strong>. Details sent to <strong className="text-[#000000]">{email}</strong>.
            </p>
            <button
              onClick={onClose}
              className="btn-ghost-pill mt-4 px-8"
            >
              Back to VasudhaMithra
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
