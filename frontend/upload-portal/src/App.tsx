import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { BrowserMockupFrame } from './components/BrowserMockupFrame';
import { MetricsBanner } from './components/MetricsBanner';
import { FeatureSections } from './components/FeatureSections';
import { TestimonialCarousel } from './components/TestimonialCarousel';
import { Footer } from './components/Footer';
import { DemoModal } from './components/DemoModal';

export function App() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const handleOpenDemo = (email?: string) => {
    if (email) {
      setUserEmail(email);
    }
    setIsDemoModalOpen(true);
  };

  const handleCloseDemo = () => {
    setIsDemoModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#181825] font-inter selection:bg-[#f69251] selection:text-black">
      {/* Floating Navbar */}
      <Navbar onBookDemo={() => handleOpenDemo()} />

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <HeroSection onBookDemo={handleOpenDemo} />

        {/* Product Browser Mockup Frame */}
        <BrowserMockupFrame />

        {/* Metrics Banner */}
        <MetricsBanner />

        {/* Alternating Feature Sections & ROI Calculator */}
        <FeatureSections onBookDemo={() => handleOpenDemo()} />

        {/* Testimonial Carousel */}
        <TestimonialCarousel />
      </main>

      {/* Footer */}
      <Footer onBookDemo={() => handleOpenDemo()} />

      {/* Interactive Demo Booking Modal */}
      <DemoModal
        isOpen={isDemoModalOpen}
        onClose={handleCloseDemo}
        initialEmail={userEmail}
      />
    </div>
  );
}

export default App;
