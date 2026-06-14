import { SignIn } from "@clerk/nextjs";
import { Brain } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0a0612] flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Background gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/5 rounded-full blur-3xl pointer-events-none" />

      {/* Back to landing */}
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </Link>

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="relative mb-4">
          <Brain className="h-10 w-10 text-purple-400" />
          <div className="absolute inset-0 bg-purple-500/30 blur-xl rounded-full" />
        </div>
        <span className="text-white text-2xl font-bold tracking-tight">CORTEX</span>
        <span className="text-white/40 text-sm mt-1">Engineering Intelligence Hub</span>
      </div>

      {/* Clerk SignIn — appearance customised to match CORTEX dark theme */}
      <SignIn
        routing="hash"
        afterSignInUrl="/dashboard"
        afterSignUpUrl="/dashboard"
        appearance={{
          variables: {
            colorPrimary: "#7c3aed",
            colorBackground: "#0f0a1a",
            colorInputBackground: "#1a1025",
            colorInputText: "#ffffff",
            colorText: "#e2d9f3",
            colorTextSecondary: "#9ca3af",
            colorNeutral: "#6b7280",
            borderRadius: "0.75rem",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          },
          elements: {
            // Root card
            card: "bg-white/[0.04] border border-white/10 shadow-2xl shadow-purple-950/30 backdrop-blur-sm",
            // Header
            headerTitle: "text-white font-bold text-xl",
            headerSubtitle: "text-white/50 text-sm",
            // Social buttons
            socialButtonsBlockButton:
              "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all",
            socialButtonsBlockButtonText: "text-white/80 font-medium text-sm",
            // Divider
            dividerLine: "bg-white/10",
            dividerText: "text-white/30 text-xs",
            // Form labels
            formFieldLabel: "text-white/60 text-xs font-medium",
            // Form inputs
            formFieldInput:
              "bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 rounded-xl text-sm transition-all",
            // Primary button
            formButtonPrimary:
              "bg-white text-[#0a0612] hover:bg-white/90 font-semibold rounded-xl transition-all shadow-none",
            // Footer links
            footerActionLink: "text-purple-400 hover:text-purple-300 font-medium",
            footerActionText: "text-white/40",
            // Internal links
            identityPreviewEditButton: "text-purple-400 hover:text-purple-300",
            // Error messages
            formFieldErrorText: "text-red-400 text-xs",
            alertText: "text-red-400 text-sm",
            // Alternate methods
            alternativeMethodsBlockButton:
              "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 rounded-xl transition-all",
          },
        }}
      />
    </div>
  );
}
