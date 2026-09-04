import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const TestimonialCarousel: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const testimonials = [
    {
      id: 1,
      type: 'quote',
      quote: "VasudhaMithra processed 45,000 legacy handwritten land records in 3 days. The automated PostGIS spatial check eliminated 6 months of manual verification backlog.",
      author: "Rajeshwar Rao",
      role: "District Revenue Officer, Survey & Settlement",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
    },
    {
      id: 2,
      type: 'photo',
      title: "CADASTRAL GIS OVERLAY",
      photo: "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=600&q=80",
      tag: "PostGIS Spatial Layer"
    },
    {
      id: 3,
      type: 'quote',
      quote: "The OCR Extraction Engine accurately parsed complex survey numbers and owner mutation details with over 99% accuracy. The human-in-the-loop queue makes auditing effortless.",
      author: "Dr. Anita Sharma",
      role: "Senior GIS & Land Records Analyst",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
    },
    {
      id: 4,
      type: 'photo',
      title: "DIGITIZED LAND ARCHIVES",
      photo: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
      tag: "SIH26018 Platform"
    }
  ];

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section id="review-queue" className="py-20 bg-[#f7f7f7] overflow-hidden">
      
      {/* Testimonials Carousel Header */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 mb-8 flex items-end justify-between">
        <div className="space-y-2">
          <span className="text-[13px] font-inter text-[#636363] tracking-wide">
            SIH Case Studies & Field Proof
          </span>
          <h2 className="heading-lg text-[#000000] tracking-[-0.5px]">
            Trusted for large-scale <br className="hidden sm:inline" />
            land record digitization
          </h2>
        </div>

        {/* Carousel Navigation Arrows */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleScroll('left')}
            className="w-10 h-10 rounded-full bg-[#ffffff] border border-black/5 flex items-center justify-center text-[#181825] hover:bg-[#181825] hover:text-[#ffffff] transition-colors shadow-sm cursor-pointer"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="w-10 h-10 rounded-full bg-[#ffffff] border border-black/5 flex items-center justify-center text-[#181825] hover:bg-[#181825] hover:text-[#ffffff] transition-colors shadow-sm cursor-pointer"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrolling Card Track */}
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto no-scrollbar max-w-[1240px] mx-auto px-4 sm:px-8 pb-6 snap-x snap-mandatory"
      >
        {testimonials.map((item) => (
          <div
            key={item.id}
            className="w-[320px] sm:w-[360px] h-[340px] flex-shrink-0 bg-[#ffffff] rounded-[24px] p-6 shadow-[rgba(24,24,37,0.08)_0px_2px_4px] border border-black/5 flex flex-col justify-between snap-start relative overflow-hidden transition-transform duration-300 hover:-translate-y-1"
          >
            {item.type === 'quote' ? (
              <>
                <p className="font-inter text-[13px] sm:text-[14px] text-[#181825] leading-relaxed">
                  "{item.quote}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-[#f7f7f7]">
                  <img
                    src={item.avatar}
                    alt={item.author}
                    className="w-8 h-8 rounded-full object-cover border border-black/10"
                  />
                  <div>
                    <h4 className="font-inter font-medium text-[13px] text-[#000000]">
                      {item.author}
                    </h4>
                    <p className="font-inter text-[11px] text-[#636363]">
                      {item.role}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 bg-[#181825]">
                <img
                  src={item.photo}
                  alt={item.title}
                  className="w-full h-full object-cover filter brightness-[0.9] contrast-[1.05]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6">
                  <h3 className="font-display-light text-[22px] font-bold text-[#ffffff] tracking-wider uppercase">
                    {item.title}
                  </h3>
                  <span className="text-[12px] font-inter text-[#fad7c1]">
                    {item.tag}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

    </section>
  );
};
