import React from 'react';
import { FileText, ShieldCheck, Zap, Layers } from 'lucide-react';

export const MetricsBanner: React.FC = () => {
  const metrics = [
    {
      value: '7 Scripts',
      label: 'Multilingual Indic OCR',
      description: 'Hindi, Kannada, Telugu, Tamil, Marathi, Bengali & English',
      icon: FileText,
    },
    {
      value: 'Δ% ≤ 5.0%',
      label: 'Spatial Auto-Match',
      description: 'Stated document area vs. PostGIS polygon geometry rule',
      icon: Layers,
    },
    {
      value: '< 0.8s',
      label: 'PostGIS Latency',
      description: 'Real-time spatial query & boundary overlap check',
      icon: Zap,
    },
    {
      value: '100%',
      label: 'Explainable Triage',
      description: 'Optical stroke analysis routes handwriting to review queue',
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="py-16 px-4 sm:px-6 bg-[#f7f7f7]">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div
                key={idx}
                className="bg-[#ffffff] rounded-[24px] p-6 shadow-[rgba(24,24,37,0.12)_0px_2px_3px_-2px] border border-black/5 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="badge-neutral">
                      <Icon className="w-3.5 h-3.5 text-[#f69251]" />
                      SIH Benchmark
                    </span>
                  </div>
                  <h3 className="heading-lg text-[#000000] tracking-tight mb-1">
                    {m.value}
                  </h3>
                  <p className="font-inter font-medium text-[15px] text-[#181825] mb-2">
                    {m.label}
                  </p>
                </div>
                <p className="font-inter text-[13px] text-[#636363] leading-relaxed">
                  {m.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
