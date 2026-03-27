import React, { useState } from "react";
import { inputStyle } from "./Shared";

const VALID_DOMAINS = ["@iec.ac.in"];

export default function VerifyModal({ onClose, onVerify }) {
    const [email, setEmail] = useState("");
    const [step, setStep] = useState("input"); // input | code | done
    const [code, setCode] = useState("");
    const [error, setError] = useState("");

    const handleSendCode = () => {
        setError("");
        const domain = email.substring(email.indexOf("@"));
        if (!VALID_DOMAINS.some(d => domain.toLowerCase() === d)) {
            setError(`Only IEC email is accepted: ${VALID_DOMAINS[0]}`);
            return;
        }
        setStep("code");
    };

    const handleVerify = () => {
        // Demo: any 4+ digit code works
        if (code.length >= 4) {
            setStep("done");
            setTimeout(() => {
                onVerify(email);
                onClose();
            }, 1500);
        } else {
            setError("Enter the 4-digit code (demo: any 4 digits)");
        }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 20, padding: 32, width: "100%", maxWidth: 420, textAlign: "center", animation: "scaleIn .25s ease" }}>
                {step === "done" ? (
                    <>
                        <div style={{ fontSize: 64, marginBottom: 16, animation: "float 2s ease infinite" }}>✅</div>
                        <h2 style={{ color: "#10b981", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Verified!</h2>
                        <p style={{ color: "#6b7280", fontSize: 14 }}>Your student identity has been confirmed.</p>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: 52, marginBottom: 16 }}>🎓</div>
                        <h2 style={{ color: "#f9fafb", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Student Verification</h2>
                        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
                            {step === "input" ? "Enter your university email to get verified." : "Enter the verification code sent to your email."}
                        </p>

                        {step === "input" ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="you@iec.ac.in" onKeyDown={e => e.key === "Enter" && handleSendCode()} />
                                {error && <div style={{ color: "#ef4444", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{error}</div>}
                                <div style={{ fontSize: 11, color: "#4b5563", fontFamily: "'DM Mono', monospace", textAlign: "left" }}>
                                    Supported: {VALID_DOMAINS.join(", ")}
                                </div>
                                <button onClick={handleSendCode}
                                    style={{ padding: "12px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
                                    Send Verification Code
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ background: "#111827", borderRadius: 10, padding: 12, fontSize: 13, color: "#a5b4fc", fontFamily: "'DM Mono', monospace" }}>
                                    📧 Code sent to {email}
                                </div>
                                <input style={{ ...inputStyle, textAlign: "center", letterSpacing: 8, fontSize: 24, fontFamily: "'DM Mono', monospace" }}
                                    value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    placeholder="0000" maxLength={6} onKeyDown={e => e.key === "Enter" && handleVerify()} />
                                {error && <div style={{ color: "#ef4444", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{error}</div>}
                                <button onClick={handleVerify}
                                    style={{ padding: "12px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
                                    Verify
                                </button>
                            </div>
                        )}
                        <button onClick={onClose} style={{ marginTop: 12, background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                    </>
                )}
            </div>
        </div>
    );
}
