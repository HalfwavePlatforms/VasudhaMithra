import React, { useState, useEffect, useRef } from "react";

const ALLOWED_DOMAIN_PATTERN = /@([a-z0-9-]+\.)*gov\.in$/i;

const ROLE_CONFIGS = {
  revenue: {
    label: "Revenue officer",
    xRole: "officer",
    defaultActor: "Revenue Officer",
    description: "Full access to review queues, mutation decisions, and land record approvals."
  },
  survey: {
    label: "Survey team",
    xRole: "surveyor",
    defaultActor: "Cadastral Surveyor",
    description: "GIS parcel mapping, boundary alignment, and spatial consistency verification."
  },
  verifier: {
    label: "Verifier",
    xRole: "tahsildar",
    defaultActor: "Field Verifier",
    description: "Document intake, OCR confidence auditing, and ground-truth validation."
  }
};

export default function LoginPage({ onLoginSuccess }) {
  const [selectedRole, setSelectedRole] = useState("revenue");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [step, setStep] = useState("email"); // "email" | "otp"

  // OTP state
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [expiryTimer, setExpiryTimer] = useState(600); // 10 minutes

  const otpInputRefs = useRef([]);

  // Timers
  useEffect(() => {
    let interval = null;
    if (step === "otp" && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  useEffect(() => {
    let interval = null;
    if (step === "otp" && expiryTimer > 0) {
      interval = setInterval(() => {
        setExpiryTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, expiryTimer]);

  const validateEmail = (val) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setEmailError("Official email address is required.");
      return false;
    }
    if (!ALLOWED_DOMAIN_PATTERN.test(trimmed)) {
      setEmailError("Enter an official department email ending in .gov.in (e.g. name@department.gov.in)");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!validateEmail(email)) return;

    setIsSending(true);
    // Simulate server-side passwordless OTP request
    await new Promise((res) => setTimeout(res, 600));
    setIsSending(false);

    setStep("otp");
    setResendTimer(30);
    setCanResend(false);
    setExpiryTimer(600);
    setOtpDigits(["", "", "", "", "", ""]);
    setOtpError("");

    setTimeout(() => {
      if (otpInputRefs.current[0]) {
        otpInputRefs.current[0].focus();
      }
    }, 100);
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendTimer(30);
    setOtpError("");
    // Simulate server-side resend
    await new Promise((res) => setTimeout(res, 400));
  };

  const handleOtpChange = (index, value) => {
    const cleanVal = value.replace(/[^0-9]/g, "");
    const updated = [...otpDigits];
    updated[index] = cleanVal.slice(-1);
    setOtpDigits(updated);
    setOtpError("");

    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pasted) return;
    const digits = pasted.split("");
    const updated = ["", "", "", "", "", ""];
    digits.forEach((d, i) => {
      updated[i] = d;
    });
    setOtpDigits(updated);
    const nextIdx = Math.min(digits.length, 5);
    otpInputRefs.current[nextIdx]?.focus();
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length < 6) {
      setOtpError("Enter all 6 digits of your verification code.");
      return;
    }

    setIsVerifying(true);
    await new Promise((res) => setTimeout(res, 500));
    setIsVerifying(false);

    const roleObj = ROLE_CONFIGS[selectedRole];
    const userSession = {
      email: email.trim(),
      roleKey: selectedRole,
      xRole: roleObj.xRole,
      actor: `${email.trim().split("@")[0].replace(".", " ")} (${roleObj.defaultActor})`,
      loggedInAt: new Date().toISOString()
    };

    localStorage.setItem("vasudha_auth", JSON.stringify(userSession));
    if (onLoginSuccess) {
      onLoginSuccess(userSession);
    }
  };

  const formatExpiryTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 font-sans bg-[#FAF6EF] text-[#1A2E27]">
      {/* LEFT PANEL — Auth Form */}
      <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-[#FAF6EF]">
        <div>
          {/* Logo Row */}
          <div className="flex items-center gap-3 mb-10">
            <div className="relative w-9 h-9">
              <span className="absolute w-5 h-5 bg-[#D9714A] rounded-xs top-0 left-2.5" />
              <span className="absolute w-5 h-5 bg-[#7FB89A] rounded-xs bottom-0 left-0" />
            </div>
            <div className="leading-tight">
              <div className="font-serif font-bold text-xl tracking-tight text-[#1A2E27]">
                Vasudha<span className="text-[#D9714A]">Mithra</span>
              </div>
              <div className="text-[11px] text-[#8A8A80]">भूमि अभिलेख प्रणाली</div>
            </div>
          </div>

          {/* Form Container */}
          <div className="max-w-md w-full">
            {step === "email" ? (
              <form onSubmit={handleSendCode}>
                <div className="text-[11px] font-bold tracking-widest text-[#D9714A] uppercase mb-3">
                  UNIFIED RECORDS CONSOLE
                </div>
                <h1 className="font-serif font-bold text-3xl sm:text-4xl text-[#1A2E27] leading-tight mb-3">
                  Enter the land intelligence workspace.
                </h1>
                <p className="text-sm text-[#6B6B62] leading-relaxed mb-8">
                  Secure access for authorised teams digitizing, verifying and connecting India's land records.
                </p>

                {/* Role Tabs */}
                <label className="block text-xs font-semibold text-[#1A2E27] mb-2">
                  Workspace role
                </label>
                <div className="flex border border-[#E4E0D4] rounded-lg bg-white p-1 mb-6">
                  {Object.entries(ROLE_CONFIGS).map(([key, config]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedRole(key)}
                      className={`flex-1 text-center py-2 text-xs transition-all rounded-md font-medium ${
                        selectedRole === key
                          ? "bg-[#1A2E27] text-white shadow-xs"
                          : "text-[#8A8A80] hover:text-[#1A2E27]"
                      }`}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>

                {/* Email Input */}
                <label className="block text-xs font-semibold text-[#1A2E27] mb-2">
                  Official email address
                </label>
                <div className="mb-2">
                  <div
                    className={`flex items-center border rounded-lg bg-white px-3.5 h-12 transition-all ${
                      emailError ? "border-[#C4502B] ring-1 ring-[#C4502B]" : "border-[#E4E0D4] focus-within:border-[#1A2E27]"
                    }`}
                  >
                    <span className="text-[#B0AC9E] mr-2.5 text-sm">@</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) validateEmail(e.target.value);
                      }}
                      placeholder="name@department.gov.in"
                      className="w-full bg-transparent border-none outline-none text-sm text-[#1A2E27] placeholder-[#B0AC9E]"
                    />
                  </div>
                  {emailError && (
                    <p className="text-xs text-[#C4502B] mt-1.5 font-medium">{emailError}</p>
                  )}
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full bg-[#1A2E27] hover:bg-[#253E35] text-white rounded-lg h-12 font-semibold text-sm flex items-center justify-center gap-2 mt-4 transition-all shadow-xs disabled:opacity-60"
                >
                  <span>{isSending ? "Sending code…" : "Send secure email code"}</span>
                  <span aria-hidden="true">→</span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 text-xs text-[#B0AC9E] my-6">
                  <div className="flex-1 h-px bg-[#E4E0D4]" />
                  <span>or continue with</span>
                  <div className="flex-1 h-px bg-[#E4E0D4]" />
                </div>

                {/* Google SSO Button */}
                <button
                  type="button"
                  onClick={() => alert("Google SSO domain restriction is configured for @department.gov.in accounts.")}
                  className="w-full h-12 border border-[#E4E0D4] bg-white hover:bg-[#FBF9F4] rounded-lg text-sm font-medium text-[#1A2E27] flex items-center justify-center gap-2.5 transition-all shadow-2xs"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.4 35.4 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C40.8 36 44 30.6 44 24c0-1.3-.1-2.7-.4-3.5z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* Trust Microcopy */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-[#8A8A80] mt-6">
                  <span>🛡</span>
                  <span>Protected by role-based access and encrypted verification.</span>
                </div>
              </form>
            ) : (
              /* STEP 2: OTP Verification */
              <form onSubmit={handleVerifyOtp}>
                <div className="text-[11px] font-bold tracking-widest text-[#D9714A] uppercase mb-3">
                  VERIFY YOUR IDENTITY
                </div>
                <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1A2E27] leading-tight mb-2">
                  Enter the code we sent you.
                </h1>
                <p className="text-sm text-[#6B6B62] leading-relaxed mb-6">
                  A 6-digit code was sent to <b className="text-[#1A2E27] font-semibold">{email}</b>. It expires in{" "}
                  <span className="font-mono text-[#D9714A] font-semibold">{formatExpiryTime(expiryTimer)}</span>.
                </p>

                <label className="block text-xs font-semibold text-[#1A2E27] mb-2">
                  Verification code
                </label>

                {/* OTP Boxes */}
                <div className="flex gap-2.5 mb-2" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      maxLength={1}
                      inputMode="numeric"
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-13 text-center text-xl font-semibold border border-[#E4E0D4] rounded-lg bg-white outline-none focus:border-[#1A2E27] text-[#1A2E27] shadow-2xs"
                    />
                  ))}
                </div>
                {otpError && <p className="text-xs text-[#C4502B] font-medium mb-3">{otpError}</p>}

                {/* Resend Row */}
                <div className="flex items-center justify-between text-xs my-4">
                  <span className="text-[#8A8A80]">Didn't get the email?</span>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={!canResend}
                    className={`font-semibold transition-all ${
                      canResend ? "text-[#D9714A] hover:underline cursor-pointer" : "text-[#B0AC9E] cursor-not-allowed"
                    }`}
                  >
                    {canResend ? "Resend code" : `Resend code in ${resendTimer}s`}
                  </button>
                </div>

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full bg-[#1A2E27] hover:bg-[#253E35] text-white rounded-lg h-12 font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-60"
                >
                  <span>{isVerifying ? "Verifying code…" : "Verify and continue"}</span>
                  <span aria-hidden="true">→</span>
                </button>

                {/* Change Email */}
                <div className="text-xs text-[#8A8A80] mt-5">
                  Wrong email?{" "}
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="text-[#1A2E27] font-semibold underline hover:opacity-80"
                  >
                    Use a different address
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer Link */}
        <div className="text-xs text-[#8A8A80] mt-12 pt-6 border-t border-[#E4E0D4]/60">
          Need help signing in?{" "}
          <a href="#support" className="text-[#1A2E27] font-semibold underline hover:opacity-80">
            Contact technical support
          </a>
        </div>
      </div>

      {/* RIGHT PANEL — Trust & Marketing */}
      <div className="bg-[#16332B] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden min-h-[500px]">
        {/* Topographic Lines Background Pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none" viewBox="0 0 800 900" preserveAspectRatio="none">
          <path d="M0,150 C200,100 400,220 800,140" stroke="#8FC7A8" strokeWidth="1.5" fill="none" />
          <path d="M0,400 C250,340 500,460 800,380" stroke="#8FC7A8" strokeWidth="1.5" fill="none" />
          <path d="M0,650 C220,600 480,720 800,630" stroke="#8FC7A8" strokeWidth="1.5" fill="none" />
        </svg>

        {/* Top Bar Header */}
        <div className="flex justify-between text-[11px] font-semibold tracking-wider text-white/70 uppercase relative z-10">
          <span>GOVERNMENT OF KARNATAKA</span>
          <span>REVENUE DEPARTMENT · DILRMP</span>
        </div>

        {/* Hero Section */}
        <div className="relative z-10 my-auto py-12">
          <div className="text-xs font-semibold tracking-widest text-[#8FC7A8] uppercase mb-4">
            LAND INTELLIGENCE · BUILT FOR INDIA
          </div>
          <h2 className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl leading-tight mb-5 max-w-lg">
            Every parcel has a past.<br />
            Now it has a <span className="text-[#8FC7A8]">digital future.</span>
          </h2>
          <p className="text-sm sm:text-base text-white/80 max-w-md leading-relaxed">
            VasudhaMithra turns historic registers, handwritten notes and cadastral maps into one accurate, traceable record of truth.
          </p>
        </div>

        {/* Live Stats & Status Footer */}
        <div className="relative z-10 pt-6">
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div>
              <div className="font-serif text-2xl sm:text-3xl font-semibold text-white">12.4K</div>
              <div className="text-[11px] text-white/60 mt-1 max-w-[110px] leading-tight">
                Records digitized this month
              </div>
            </div>
            <div>
              <div className="font-serif text-2xl sm:text-3xl font-semibold text-white">93.7%</div>
              <div className="text-[11px] text-white/60 mt-1 max-w-[110px] leading-tight">
                Verified field accuracy
              </div>
            </div>
            <div>
              <div className="font-serif text-2xl sm:text-3xl font-semibold text-white">31</div>
              <div className="text-[11px] text-white/60 mt-1 max-w-[110px] leading-tight">
                Districts connected
              </div>
            </div>
          </div>

          {/* Status Chip */}
          <div className="inline-flex items-center gap-3 bg-white/5 border border-white/12 rounded-xl px-4 py-3 backdrop-blur-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6FD89A] animate-pulse" />
            <div className="text-xs leading-tight">
              <span className="font-semibold block text-white">Platform services are operational</span>
              <span className="text-white/60 text-[11px]">Securely hosted on NIC Cloud</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
