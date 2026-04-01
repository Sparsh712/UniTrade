import React from "react";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const goldIcon = new L.DivIcon({
    html: '<div></div>',
    className: 'gold-dot-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

const PICKUP_SPOTS = [
    { name: "🚪 IEC Main Gate", lat: 28.47595, lng: 77.50155, desc: "SECURITY MONITORING" },
    { name: "🏢 Admin Block", lat: 28.47578, lng: 77.50130, desc: "HIGH VISIBILITY" },
    { name: "📚 Library Entrance", lat: 28.47562, lng: 77.50105, desc: "DAYTIME LOCATION" },
    { name: "🍽️ Cafeteria", lat: 28.47545, lng: 77.50122, desc: "BUSY COMMON AREA" },
    { name: "🅿️ Parking Zone A", lat: 28.47588, lng: 77.50102, desc: "SPACIOUS MEETUP" },
    { name: "🏨 Hostel Gate", lat: 28.47530, lng: 77.50088, desc: "MONITORED ENTRY" },
];

export default function MapModal({ onClose }) {
    return (
        <motion.div
          className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
            <motion.div
              className="modal-panel"
              style={{ maxWidth: 720, padding: 32 }}
              initial={{ scale: 0.85, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 22, stiffness: 280 }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                    <div>
                        <h2 className="serif" style={{ color: "var(--text)", fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>CAMPUS NODES.</h2>
                        <div style={{ color: "var(--text-dim)", fontSize: 11, fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em" }}>
                            VERIFIED MEETUP SPOTS · IEC COLLEGE OF ENGINEERING & TECHNOLOGY
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: 10, fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em", marginTop: 6 }}>
                            PLOT NO. 4, SURAJPUR-KASNA RD, KNOWLEDGE PARK I, GREATER NOIDA · FGG2+9F
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-text-gold" style={{ fontSize: 24 }}>✕</button>
                </div>

                <div
                    style={{
                        border: "1px solid rgba(255, 255, 255, 0.14)",
                        borderRadius: 16,
                        overflow: "hidden",
                        height: 400,
                        background: "rgba(2, 6, 23, 0.35)",
                        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.45)",
                    }}
                >
                    <MapContainer center={[28.47570, 77.50120]} zoom={18} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {PICKUP_SPOTS.map((spot, i) => (
                            <Marker key={i} position={[spot.lat, spot.lng]} icon={goldIcon}>
                                <Popup>
                                    <div style={{ padding: "4px 0" }}>
                                        <div style={{ color: "var(--gold)", fontWeight: 800, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.1em", marginBottom: 4 }}>
                                            {spot.name}
                                        </div>
                                        <div style={{ color: "var(--text-muted)", fontSize: 10, lineHeight: 1.4 }}>
                                            {spot.desc}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>

                {/* Spot List */}
                <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {PICKUP_SPOTS.map((spot, i) => (
                        <div
                            key={i}
                            style={{
                                background: "rgba(15, 23, 42, 0.42)",
                                border: "1px solid rgba(255, 255, 255, 0.14)",
                                borderRadius: 12,
                                padding: "12px 16px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                                backdropFilter: "blur(14px) saturate(170%)",
                                WebkitBackdropFilter: "blur(14px) saturate(170%)",
                                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.28)",
                            }}
                        >
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{spot.name.toUpperCase()}</div>
                            <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>{spot.desc}</div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: 24, textAlign: "center" }}>
                    <button onClick={onClose} className="btn-gold" style={{ padding: "12px 32px", fontSize: 11 }}>CLOSE MAP VIEW</button>
                </div>
            </motion.div>
        </motion.div>
    );
}
