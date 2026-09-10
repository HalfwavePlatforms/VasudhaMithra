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
      "సర్వే నంబర్ 145/2 స్థితి ఏమిటి?",
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

export default function CitizenVoiceQueryPage({ apiBase }) {
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
    <div className="min-h-screen bg-[#0E1525] text-[#F3F4F6] flex flex-col font-sans">
      {/* Top Banner */}
      <header className="border-b border-[#1F293D] bg-[#0E1525]/90 backdrop-blur sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">
              VasudhaMithra
            </h1>
            <p className="text-xs text-emerald-400 font-medium tracking-wider">
              CITIZEN VOICE ASSISTANT • ನಾಗರಿಕ ಧ್ವನಿ ಸಹಾಯಕ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/"
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-[#2B354C] hover:bg-[#1A2234] transition-colors"
          >
            Officer Portal
          </a>
        </div>
      </header>

      {/* Main Interactive Stage */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center">
        {/* Step 1: Language Picker */}
        <div className="w-full mb-6">
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mb-2.5">
            <Languages className="w-4 h-4 text-emerald-400" />
            <span>Select Language / ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ:</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
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
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    active
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105"
                      : "bg-[#182234] text-gray-300 border border-[#2B354C] hover:border-emerald-500/50"
                  }`}
                >
                  {lang.label} ({lang.englishName})
                </button>
              );
            })}
          </div>
        </div>

        {/* Title & Guidance */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-1.5">
            {currentHints.title}
          </h2>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            {currentHints.subtitle}
          </p>
        </div>

        {/* Browser Warning if Web Speech API unsupported */}
        {!speechSupported && (
          <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2.5 mb-6">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-semibold">Microphone input not supported on this browser</p>
              <p className="text-amber-300/80 mt-0.5">
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
              <div className="absolute w-36 h-36 rounded-full bg-emerald-500/20 animate-ping pointer-events-none" />
              <div className="absolute w-44 h-44 rounded-full bg-emerald-500/10 animate-pulse pointer-events-none" />
            </>
          )}

          <button
            type="button"
            onClick={toggleListening}
            disabled={loading}
            className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 active:scale-95 ${
              isListening
                ? "bg-red-500 text-white shadow-red-500/50 scale-110 animate-pulse"
                : "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white hover:from-emerald-500 hover:to-teal-400 shadow-emerald-500/30 hover:scale-105"
            }`}
            title={isListening ? "Tap to stop" : "Tap to speak"}
          >
            {isListening ? (
              <MicOff className="w-12 h-12 mb-1" />
            ) : (
              <Mic className="w-12 h-12 mb-1" />
            )}
            <span className="text-[11px] font-semibold tracking-wide">
              {isListening ? "Listening" : "Speak"}
            </span>
          </button>

          <p className="text-xs font-medium text-gray-400 mt-4 h-5">
            {isListening ? (
              <span className="text-emerald-400 font-semibold animate-pulse">
                ● {currentHints.listening}
              </span>
            ) : loading ? (
              <span className="text-emerald-400 animate-pulse">
                Looking up official land records...
              </span>
            ) : (
              currentHints.pressToSpeak
            )}
          </p>
        </div>

        {/* Live Heard Transcript Badge */}
        {transcript && (
          <div className="mt-2 mb-4 px-4 py-2 rounded-xl bg-[#1A2333] border border-[#2B354C] text-xs text-gray-300 flex items-center gap-2 max-w-md text-center">
            <span className="text-gray-500 font-medium">Heard:</span>
            <span className="font-semibold text-white italic">"{transcript}"</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="w-full bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Result Card */}
        {result && (
          <div className="w-full bg-[#141C2E] border border-[#27344D] rounded-2xl p-5 mb-6 shadow-xl animate-fade-in">
            {/* Spoken Answer Banner */}
            <div className="bg-gradient-to-r from-emerald-950/60 to-teal-950/40 border border-emerald-500/30 rounded-xl p-4 mb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                    Spoken Answer • ಉತ್ತರ
                  </span>
                  <p className="text-base sm:text-lg font-semibold text-white leading-relaxed">
                    {result.spoken_response}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => speakAnswer(result.spoken_response, result.language)}
                  className={`p-2.5 rounded-xl border transition-colors shrink-0 ${
                    isSpeaking
                      ? "bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/30 animate-pulse"
                      : "bg-[#1E293B] text-emerald-400 border-[#334155] hover:bg-[#2A374D]"
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
              <div className="border-t border-[#232F46] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Verified Land Record Facts
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      result.data.status === "validated"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {result.data.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#0F1626] p-3 rounded-lg border border-[#1E293D]">
                    <span className="text-gray-500 block mb-0.5">Survey Number</span>
                    <span className="font-bold text-white text-sm">
                      {result.data.survey_number}
                    </span>
                  </div>

                  <div className="bg-[#0F1626] p-3 rounded-lg border border-[#1E293D]">
                    <span className="text-gray-500 block mb-0.5">Registered Owner</span>
                    <span className="font-bold text-white text-sm truncate block">
                      {result.data.owner_name || "Not Specified"}
                    </span>
                  </div>

                  <div className="bg-[#0F1626] p-3 rounded-lg border border-[#1E293D]">
                    <span className="text-gray-500 block mb-0.5">Land Classification</span>
                    <span className="font-semibold text-gray-300">
                      {result.data.land_classification || "Standard"}
                    </span>
                  </div>

                  <div className="bg-[#0F1626] p-3 rounded-lg border border-[#1E293D]">
                    <span className="text-gray-500 block mb-0.5">Dispute / Conflict Status</span>
                    <span
                      className={`font-semibold ${
                        result.data.has_dispute ? "text-amber-400" : "text-emerald-400"
                      }`}
                    >
                      {result.data.dispute_status}
                    </span>
                  </div>
                </div>

                {result.data.village && (
                  <div className="mt-2 text-[11px] text-gray-500">
                    Location: {result.data.village}, {result.data.district}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Text-Based Fallback Input (Step 6) */}
        <div className="w-full bg-[#121927] border border-[#202B3E] rounded-xl p-4 mt-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
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
              className="flex-1 bg-[#0A0F1A] border border-[#26334A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loading || !typedQuery.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{currentHints.askBtn}</span>
            </button>
          </form>

          {/* Quick sample chips */}
          <div className="mt-3 flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-gray-500 mr-1">Examples:</span>
            {currentHints.samples.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTypedQuery(sample);
                  handleExecuteQuery(sample);
                }}
                className="text-[11px] bg-[#1A2436] hover:bg-[#23314A] text-gray-300 px-2.5 py-1 rounded-lg border border-[#2B3A54] transition-colors"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Safety & Integrity Footer */}
      <footer className="border-t border-[#1F293D] py-4 px-4 text-center text-[11px] text-gray-500 bg-[#0E1525]">
        <p>
          Digitization Platform Verification Query • Generated from verified land record database.
        </p>
        <p className="text-gray-600 mt-0.5">
          Answers are strictly retrieved from official digitized records. The AI parser only translates questions into database lookups.
        </p>
      </footer>
    </div>
  );
}
