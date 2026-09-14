import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Building2,
  Languages,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const SUPPORTED_LANGUAGES = [
  { code: "kn", label: "ಕನ್ನಡ", englishName: "Kannada", bcp47: "kn-IN" },
  { code: "hi", label: "हिन्दी", englishName: "Hindi", bcp47: "hi-IN" },
  { code: "ta", label: "தமிழ்", englishName: "Tamil", bcp47: "ta-IN" },
  { code: "te", label: "తెలుగు", englishName: "Telugu", bcp47: "te-IN" },
  { code: "mr", label: "मराठी", englishName: "Marathi", bcp47: "mr-IN" },
  { code: "bn", label: "বাংলা", englishName: "Bengali", bcp47: "bn-IN" },
  { code: "en", label: "English", englishName: "English", bcp47: "en-IN" },
];

const PROMPT_HINTS = {
  kn: {
    title: "ನಿಮ್ಮ ಭೂಮಿಯ ಬಗ್ಗೆ ಮಾತನಾಡಿ ಕೇಳಿ",
    subtitle: "ಸರ್ವೆ ನಂಬರ್, ಮಾಲೀಕರು, ಅಥವಾ ಪರಿಶೀಲನಾ ಸ್ಥಿತಿಯ ಬಗ್ಗೆ ಪ್ರಶ್ನೆ ಕೇಳಿ.",
    pressToSpeak: "ಮಾತನಾಡಲು ಮೈಕ್ ಒತ್ತಿರಿ",
    listening: "ಕೇಳಿಸಿಕೊಳ್ಳಲಾಗುತ್ತಿದೆ... ಮಾತನಾಡಿ",
    placeholder: "ಅಥವಾ ಸರ್ವೆ ನಂಬರ್ ಟೈಪ್ ಮಾಡಿ (ಉದಾ: 145/2)",
    askBtn: "ಕೇಳಿ",
    samples: [
      "ಸರ್ವೆ ನಂಬರ್ 145/2 ಮಾಲೀಕ ಯಾರು?",
      "ಸರ್ವೆ ನಂಬರ್ 145/2 ಸ್ಥಿತಿ ಏನು?",
      "ಸರ್ವೆ ನಂಬರ್ 152 ಗೆ ಯಾವುದೇ ವಿವಾದವಿದೆಯೇ?",
    ],
  },
  hi: {
    title: "अपनी जमीन के बारे में बोलकर पूछें",
    subtitle: "सर्वे नंबर, मालिक का नाम, या सत्यापन स्थिति के बारे में सवाल पूछें।",
    pressToSpeak: "बोलने के लिए माइक दबाएं",
    listening: "सुन रहे हैं... बोलिए",
    placeholder: "या सर्वे नंबर टाइप करें (उदा: 45/A)",
    askBtn: "पूछें",
    samples: [
      "सर्वे नंबर 45/A का मालिक कौन है?",
      "सर्वे नंबर 45/A का स्टेटस क्या है?",
      "सर्वे नंबर 45/A का वर्गीकरण क्या है?",
    ],
  },
  en: {
    title: "Ask About Your Land by Voice",
    subtitle: "Speak a question about survey number, ownership, status, or disputes.",
    pressToSpeak: "Tap to Speak",
    listening: "Listening... Speak now",
    placeholder: "Or type a survey number (e.g. 145/2)",
    askBtn: "Ask",
    samples: [
      "Who is the owner of survey number 145/2?",
      "What is the status of survey number 145/2?",
      "Is there any dispute on survey number 152?",
    ],
  },
  ta: {
    title: "உங்கள் நில விவரங்களை குரல் மூலம் கேளுங்கள்",
    subtitle: "சர்வே எண், உரிமையாளர் பெயர் அல்லது நிலத்தின் நிலை குறித்து கேளுங்கள்.",
    pressToSpeak: "பேச மைக் பட்டனை அழுத்தவும்",
    listening: "கேட்கிறது... பேசுங்கள்",
    placeholder: "அல்லது சர்வே எண்ணை உள்ளிடவும் (எ.கா: 88/2)",
    askBtn: "கேள்",
    samples: [
      "சர்வே எண் 88/2 உரிமையாளர் யார்?",
      "சர்வே எண் 88/2 நிலை என்ன?",
    ],
  },
  te: {
    title: "మీ భూమి వివరాలను మాట్లాడి తెలుసుకోండి",
    subtitle: "సర్వే నంబర్, యజమాని పేరు లేదా ధృవీకరణ స్థితి గురించి అడగండి.",
    pressToSpeak: "మాట్లాడటానికి మైక్ నొక్కండి",
    listening: "వింటున్నాము... మాట్లాడండి",
    placeholder: "లేదా సర్వే నంబర్ టైప్ చేయండి (ఉదా: 145/2)",
    askBtn: "అడగండి",
    samples: [
      "సర్వే నంబర్ 145/2 యజమాని ఎవరు?",
      "సర్వే నంబರ್ 145/2 స్థితి ఏమిటి?",
    ],
  },
  mr: {
    title: "आपल्या जमिनीबद्दल बोलून माहिती मिळवा",
    subtitle: "सर्व्हे क्रमांक, मालकाचे नाव किंवा स्थितीबद्दल प्रश्न विचारा.",
    pressToSpeak: "बोलण्यासाठी माईक दाबा",
    listening: "ऐकत आहे... बोला",
    placeholder: "किंवा सर्व्हे क्रमांक टाईप करा",
    askBtn: "विचारा",
    samples: [
      "सर्व्हे क्रमांक 145/2 चा मालक कोण आहे?",
      "सर्व्हे क्रमांक 145/2 ची स्थिती काय आहे?",
    ],
  },
  bn: {
    title: "জমির তথ্য জানতে মুখে বলুন",
    subtitle: "সার্ভে নম্বর, মালিকের নাম বা অবস্থা সম্পর্কে জিজ্ঞাসা করুন।",
    pressToSpeak: "বলতে মাইক টিপুন",
    listening: "শুনছি... বলুন",
    placeholder: "অথবা সার্ভে নম্বর লিখুন",
    askBtn: "জিজ্ঞাসা",
    samples: [
      "সার্ভে নম্বর 145/2 এর মালিক কে?",
      "সার্ভে নম্বর 145/2 এর অবস্থা কি?",
    ],
  },
};

export default function CitizenVoiceQueryPage({ apiBase, isEmbedded = false }) {
  const resolvedApiBase = apiBase || import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const [selectedLang, setSelectedLang] = useState("kn");
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [typedQuery, setTypedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef(null);

  // Check browser Web Speech API support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  const currentHints = PROMPT_HINTS[selectedLang] || PROMPT_HINTS.en;
  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang) || SUPPORTED_LANGUAGES[0];

  // Stop any active text-to-speech synthesis
  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Speak response back using browser SpeechSynthesis
  const speakAnswer = (text, langCode) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
    if (targetLang) {
      utterance.lang = targetLang.bcp47;
    }
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Query Backend
  const handleExecuteQuery = async (queryText, overrideSurvey = null) => {
    if (!queryText && !overrideSurvey) return;
    stopSpeaking();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${resolvedApiBase}/public/voice-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_text: queryText || `Survey ${overrideSurvey}`,
          language: selectedLang,
          survey_number_override: overrideSurvey || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned error (${res.status})`);
      }

      const data = await res.json();
      setResult(data);

      // Speak answer automatically
      if (data.spoken_response) {
        speakAnswer(data.spoken_response, data.language || selectedLang);
      }
    } catch (err) {
      setError(err.message || "Failed to process question. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle Microphone
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Please use the text input below.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    stopSpeaking();
    setError(null);
    setResult(null);
    setTranscript("");

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = currentLangObj.bcp47;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const spokenText = event.results[0][0].transcript;
        setTranscript(spokenText);
        setIsListening(false);
        handleExecuteQuery(spokenText);
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error !== "no-speech") {
          setError(`Microphone error (${event.error}). Please type your query or try again.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      setIsListening(false);
      setError("Could not access microphone. Please check permissions.");
    }
  };

  return (
    <div className={isEmbedded ? "w-full max-w-4xl mx-auto space-y-6 pb-16 font-sans text-[var(--color-text-primary)]" : "min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col font-sans"}>
      {/* Top Banner (Standalone mode) */}
      {!isEmbedded && (
        <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-xs border border-[var(--color-border)]">
              <img src="/logo-transparent.png" alt="VasudhaMithra" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-base font-serif font-bold text-[var(--color-text-primary)] tracking-tight">
                VasudhaMithra
              </h1>
              <p className="text-[11px] text-[var(--color-success)] font-bold tracking-wider uppercase">
                CITIZEN VOICE ASSISTANT • ನಾಗರಿಕ ಧ್ವನಿ ಸಹಾಯಕ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              className="text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-3.5 py-2 rounded-xl border border-[var(--color-border-strong)] bg-white hover:bg-[var(--color-bg-tertiary)] transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <span>Officer Portal</span>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            </a>
          </div>
        </header>
      )}

      {/* Main Interactive Stage */}
      <main className={isEmbedded ? "w-full space-y-6" : "flex-1 max-w-3xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center"}>
        {/* Title & Guidance */}
        {isEmbedded ? (
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-label-muted)]">
              PUBLIC SERVICES & ASSISTANCE • ನಾಗರಿಕ ಸೇವೆಗಳು
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--color-text-primary)] tracking-tight mt-1">
              {currentHints.title}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {currentHints.subtitle}
            </p>
          </div>
        ) : (
          <div className="text-center mb-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-label-muted)] block mb-1">
              VOICE-ENABLED CITIZEN RECORD INTAKE
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--color-text-primary)] mb-2 tracking-tight">
              {currentHints.title}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-lg mx-auto">
              {currentHints.subtitle}
            </p>
          </div>
        )}

        {/* Central Interactive Card */}
        <div className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col items-center">
          {/* Step 1: Language Picker */}
          <div className="w-full mb-6">
            <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-2.5 font-medium">
              <Languages className="w-4 h-4 text-[var(--color-success)]" />
              <span>Select Language / ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ:</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const active = selectedLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setSelectedLang(lang.code);
                      stopSpeaking();
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      active
                        ? "bg-[var(--color-success)] text-white shadow-xs scale-105"
                        : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-primary)] hover:text-[var(--color-text-primary)] shadow-2xs"
                    }`}
                  >
                    {lang.label} ({lang.englishName})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Browser Warning if Web Speech API unsupported */}
          {!speechSupported && (
            <div className="w-full max-w-xl bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-xl p-3.5 text-xs text-[var(--color-warning)] flex items-start gap-2.5 mb-6 shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-warning)]" />
              <div>
                <p className="font-bold">Microphone input not supported on this browser</p>
                <p className="text-[var(--color-warning)]/90 mt-0.5">
                  Safari and Firefox have limited Web Speech API support. Please use the text input below to ask your question.
                </p>
              </div>
            </div>
          )}

          {/* Giant Microphone Button */}
          <div className="relative my-4 flex flex-col items-center">
            {/* Animated Glow Rings when listening */}
            {isListening && (
              <>
                <div className="absolute w-36 h-36 rounded-full bg-[var(--color-success)]/20 animate-ping pointer-events-none" />
                <div className="absolute w-44 h-44 rounded-full bg-[var(--color-success)]/10 animate-pulse pointer-events-none" />
              </>
            )}

            <button
              type="button"
              onClick={toggleListening}
              disabled={loading}
              className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-300 active:scale-95 ${
                isListening
                  ? "bg-[var(--color-error)] text-white shadow-red-500/40 scale-105 animate-pulse"
                  : "bg-gradient-to-tr from-[#1D8374] to-[#259B8B] hover:from-[#166E61] hover:to-[#1D8374] text-white shadow-[#1D8374]/30 hover:scale-105"
              }`}
              title={isListening ? "Tap to stop" : "Tap to speak"}
            >
              {isListening ? (
                <MicOff className="w-11 h-11 mb-1" />
              ) : (
                <Mic className="w-11 h-11 mb-1" />
              )}
              <span className="text-[11px] font-bold tracking-wide uppercase">
                {isListening ? "Listening" : "Speak"}
              </span>
            </button>

            <p className="text-xs font-medium text-[var(--color-text-muted)] mt-4 h-5">
              {isListening ? (
                <span className="text-[var(--color-success)] font-bold animate-pulse">
                  ● {currentHints.listening}
                </span>
              ) : loading ? (
                <span className="text-[var(--color-success)] font-semibold animate-pulse">
                  Looking up official land records...
                </span>
              ) : (
                currentHints.pressToSpeak
              )}
            </p>
          </div>

          {/* Live Heard Transcript Badge */}
          {transcript && (
            <div className="mt-1 mb-4 px-4 py-2 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-2xs flex items-center gap-2 max-w-md text-center">
              <span className="text-[var(--color-text-muted)] font-medium">Heard:</span>
              <span className="font-semibold text-[var(--color-text-primary)] italic">"{transcript}"</span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="w-full max-w-xl bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-xl p-3.5 text-xs text-[var(--color-error)] flex items-center gap-2.5 mb-4 shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-error)]" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Result Card */}
          {result && (
            <div className="w-full max-w-2xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 mb-6 shadow-xs animate-fade-in">
              {/* Spoken Answer Banner */}
              <div className="bg-gradient-to-r from-[var(--color-success-bg)] to-[#E6F4F1] border border-[var(--color-success-border)] rounded-xl p-4 sm:p-5 mb-4 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-success)] block mb-1">
                      Spoken Answer • ಅಧಿಕೃತ ಉತ್ತರ
                    </span>
                    <p className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] leading-relaxed">
                      {result.spoken_response}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakAnswer(result.spoken_response, result.language)}
                    className={`p-2.5 rounded-xl border transition-all shrink-0 ${
                      isSpeaking
                        ? "bg-[var(--color-success)] text-white border-[var(--color-success)] shadow-md shadow-[#1D8374]/30 animate-pulse"
                        : "bg-white text-[var(--color-success)] border-[var(--color-border-strong)] hover:bg-[var(--color-success-bg)] shadow-2xs"
                    }`}
                    title="Listen again"
                  >
                    {isSpeaking ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Fact Sheet from Real Database */}
              {result.record_found && result.data && (
                <div className="border-t border-[var(--color-border)] pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[var(--color-label-muted)] uppercase tracking-wider">
                      Verified Land Record Facts
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        result.data.status === "validated"
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]"
                          : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]"
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {result.data.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[var(--color-bg-secondary)] p-3.5 rounded-xl border border-[var(--color-border)]">
                      <span className="text-[var(--color-text-muted)] text-[11px] font-medium block mb-0.5">Survey Number</span>
                      <span className="font-bold text-[var(--color-text-primary)] text-sm">
                        {result.data.survey_number}
                      </span>
                    </div>

                    <div className="bg-[var(--color-bg-secondary)] p-3.5 rounded-xl border border-[var(--color-border)]">
                      <span className="text-[var(--color-text-muted)] text-[11px] font-medium block mb-0.5">Registered Owner</span>
                      <span className="font-bold text-[var(--color-text-primary)] text-sm truncate block">
                        {result.data.owner_name || "Not Specified"}
                      </span>
                    </div>

                    <div className="bg-[var(--color-bg-secondary)] p-3.5 rounded-xl border border-[var(--color-border)]">
                      <span className="text-[var(--color-text-muted)] text-[11px] font-medium block mb-0.5">Land Classification</span>
                      <span className="font-semibold text-[var(--color-text-secondary)]">
                        {result.data.land_classification || "Standard"}
                      </span>
                    </div>

                    <div className="bg-[var(--color-bg-secondary)] p-3.5 rounded-xl border border-[var(--color-border)]">
                      <span className="text-[var(--color-text-muted)] text-[11px] font-medium block mb-0.5">Dispute / Conflict Status</span>
                      <span
                        className={`font-semibold ${
                          result.data.has_dispute ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"
                        }`}
                      >
                        {result.data.dispute_status}
                      </span>
                    </div>
                  </div>

                  {result.data.village && (
                    <div className="mt-2.5 text-[11px] text-[var(--color-text-muted)]">
                      Location: {result.data.village}, {result.data.district}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Text-Based Fallback Input */}
          <div className="w-full max-w-2xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
            <span className="text-[11px] font-bold text-[var(--color-label-muted)] uppercase tracking-wider block mb-2.5">
              Text Fallback • ಕೈಬರಹದ ಪರ್ಯಾಯ
            </span>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecuteQuery(typedQuery);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={typedQuery}
                onChange={(e) => setTypedQuery(e.target.value)}
                placeholder={currentHints.placeholder}
                className="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border-strong)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-success)] focus:border-[var(--color-success)]"
              />
              <button
                type="submit"
                disabled={loading || !typedQuery.trim()}
                className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{currentHints.askBtn}</span>
              </button>
            </form>

            {/* Quick sample chips */}
            <div className="mt-3 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-[var(--color-text-muted)] mr-1 font-semibold">Examples:</span>
              {currentHints.samples.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTypedQuery(sample);
                    handleExecuteQuery(sample);
                  }}
                  className="text-[11px] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors shadow-2xs font-medium"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Safety & Integrity Footer (Standalone mode) */}
      {!isEmbedded && (
        <footer className="border-t border-[var(--color-border)] py-4 px-4 text-center text-[11px] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] mt-auto">
          <p className="font-medium">
            Digitization Platform Verification Query • Generated from verified land record database.
          </p>
          <p className="text-[var(--color-text-muted)]/80 mt-0.5">
            Answers are strictly retrieved from official digitized records. The AI parser only translates questions into database lookups.
          </p>
        </footer>
      )}
    </div>
  );
}
