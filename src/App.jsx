import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import algosdk from "algosdk";
import { PeraWalletConnect } from "@perawallet/connect";
import { Toast, truncate, inputStyle } from "./components/Shared";
import ListingCard from "./components/ListingCard";
import OrderRow from "./components/OrderRow";
import SellModal from "./components/SellModal";
import CheckoutModal from "./components/CheckoutModal";
import ChatDrawer from "./components/ChatDrawer";
import VerifyModal from "./components/VerifyModal";
import MapModal from "./components/MapModal";
import ReceiptModal from "./components/ReceiptModal";
import ListingDetailModal from "./components/ListingDetailModal";
import { useAuthUser } from "./hooks/useAuthUser";
import { useListings } from "./hooks/useListings";
import { useOrders } from "./hooks/useOrders";
import { useWishlist } from "./hooks/useWishlist";
import { useUserProfile } from "./hooks/useUserProfile";
import { orderStatus, paymentStatus } from "./services/ordersService";

const peraWallet = new PeraWalletConnect();
const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");

function isPhoto(value) {
  return typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/") || value.startsWith("blob:"));
}

const CATEGORIES = ["All", "Books", "Electronics", "Clothing", "Furniture", "Cycles", "Lab Equipment", "Notes", "Misc"];

export default function App() {
  const { user, loading: authLoading, error: authError } = useAuthUser();
  const userId = user?.uid || "";

  const [accountAddress, setAccountAddress] = useState(null);
  const [balance, setBalance] = useState(null);

  const {
    listings,
    loading: listingsLoading,
    error: listingsError,
    addListing,
    deleteListing,
    setListingSold,
  } = useListings(userId);

  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
    addOrder,
    submitOrderRating,
    saveNegotiatedOrder,
    updateOrder,
    generateOrderOtp,
    verifyOrderOtp,
    releaseOrderPayment,
    cancelUserOrder,
  } = useOrders(userId);

  const {
    wishlistIds,
    loading: wishlistLoading,
    error: wishlistError,
    count: wishlistCount,
    toggleWishlist,
  } = useWishlist(userId);

  const [tab, setTab] = useState("browse");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [condFilter, setCondFilter] = useState("All");
  const [priceRange, setPriceRange] = useState([0, 50]);
  
  // Dynamic Max Price calculation
  const absoluteMaxPrice = useMemo(() => {
    if (!listings || listings.length === 0) return 50;
    const prices = listings.map(l => Number(l.price) || 0);
    return Math.ceil(Math.max(...prices, 10)); // At least 10
  }, [listings]);

  // Auto-adjust upper bound if price range was at default or if new listings exceed it
  useEffect(() => {
    setPriceRange(curr => [curr[0], Math.max(curr[1], absoluteMaxPrice)]);
  }, [absoluteMaxPrice]);
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [showSell, setShowSell] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [chatListing, setChatListing] = useState(null);
  const [toast, setToast] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [viewListing, setViewListing] = useState(null);
  
  // User Profile persistence
  const { profile, updateProfile } = useUserProfile(userId);
  const verified = profile?.verified || false;
  const verifiedEmail = profile?.email || "";
  
  const [greenTrades, setGreenTrades] = useState(0);
  const [orderActionId, setOrderActionId] = useState("");

  const showToast = (message, type = "info") => setToast({ message, type });

  useEffect(() => {
    peraWallet.reconnectSession().then((accounts) => {
      if (accounts.length) setAccountAddress(accounts[0]);
    }).catch(() => { });
    const handleAutoDisconnect = async () => {
      setAccountAddress(null);
      if (userId) {
        try { await updateProfile({ verified: false, email: "" }); } catch (e) { console.error(e); }
      }
    };

    peraWallet.connector?.on("disconnect", handleAutoDisconnect);
  }, [userId, updateProfile]);

  const fetchBalance = async (addr) => {
    if (!addr) {
      setBalance(null);
      return;
    }

    try {
      const accountInfo = await algodClient.accountInformation(addr).do();
      const microAlgos = accountInfo.amount ?? accountInfo["amount"];
      setBalance(Number(microAlgos) / 1e6);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      setBalance(null);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBalance(accountAddress);
    if (accountAddress) {
      const interval = setInterval(() => fetchBalance(accountAddress), 15000);
      return () => clearInterval(interval);
    }

    return undefined;
  }, [accountAddress]);

  const connectWallet = async () => {
    try {
      const accounts = await peraWallet.connect();
      setAccountAddress(accounts[0]);
      showToast("Wallet connected!", "success");
      fetchBalance(accounts[0]);
    } catch {
      showToast("Connection cancelled", "error");
    }
  };

  const disconnectWallet = async () => {
    try {
      await peraWallet.disconnect();
      setAccountAddress(null);
      setBalance(null);
      if (userId) {
        await updateProfile({ verified: false, email: "" });
        showToast("Logged out. Verification cleared.", "info");
      }
    } catch (err) {
      console.error("[UniTrade] Disconnect error:", err);
      // Fallback UI reset
      setAccountAddress(null);
      setBalance(null);
    }
  };

  const handleWishlistToggle = async (listingId) => {
    if (!userId) {
      showToast("Signing in... please try again.", "info");
      return;
    }

    try {
      await toggleWishlist(listingId);
    } catch (error) {
      showToast(error.message || "Could not update wishlist.", "error");
    }
  };

  const CONDITIONS = ["All", "Like New", "Excellent", "Good", "Fair"];

  const getListingTimestamp = (listing) => {
    if (listing?.timestamp?.toDate) return listing.timestamp.toDate().getTime();
    const parsed = Date.parse(listing?.date || "");
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const filteredListings = useMemo(() => {
    let result = listings.filter((listing) => {
      if (listing.isActive === false) return false;

      const matchCat = category === "All" || listing.category === category;
      const matchCond = condFilter === "All" || listing.condition === condFilter;
      const matchSearch =
        listing.title.toLowerCase().includes(search.toLowerCase()) ||
        listing.description.toLowerCase().includes(search.toLowerCase());
      const matchPrice = listing.price >= priceRange[0] && listing.price <= priceRange[1];

      return matchCat && matchCond && matchSearch && matchPrice;
    });

    if (sortBy === "newest") result = [...result].sort((a, b) => getListingTimestamp(b) - getListingTimestamp(a));
    if (sortBy === "price-asc") result = [...result].sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") result = [...result].sort((a, b) => b.price - a.price);
    if (sortBy === "rating") result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return result;
  }, [listings, category, condFilter, search, sortBy, priceRange]);

  const wishlistListings = useMemo(
    () => (accountAddress && userId) ? listings.filter((listing) => listing.isActive !== false && wishlistIds.includes(listing.id)) : [],
    [listings, wishlistIds, accountAddress, userId]
  );

  const myOrders = useMemo(
    () => accountAddress ? orders.filter((order) => order.buyerAddress === accountAddress) : [],
    [orders, accountAddress]
  );

  const listedOfferOrders = useMemo(
    () => accountAddress ? orders.filter((order) => order.sellerAddress === accountAddress) : [],
    [orders, accountAddress]
  );

  const myActiveListings = useMemo(
    () => accountAddress ? listings.filter((listing) => listing.sellerAddress === accountAddress && listing.isActive !== false && !listing.sold) : [],
    [listings, accountAddress]
  );

  const handleListItem = async (listingInput) => {
    if (!accountAddress) throw new Error("Connect your wallet first.");
    if (!userId) throw new Error("Sign-in in progress. Please try again.");

    await addListing({
      ...listingInput,
      ownerId: userId,
      seller: {
        userId,
        walletAddress: accountAddress,
        displayName: verifiedEmail ? verifiedEmail.split("@")[0] : "Campus Seller",
        verifiedEmail: verifiedEmail || "",
        profileType: "wallet",
      },
      sellerAddress: accountAddress,
      rating: 0,
      ratingCount: 0,
      isActive: true,
    });

    showToast("Item listed successfully!", "success");
  };

  const handleDeleteListing = async (listing) => {
    const sellerAddr = listing.sellerAddress || listing.seller?.walletAddress || listing.seller;
    if (!accountAddress || sellerAddr !== accountAddress) {
      showToast("You can only delete your own listings.", "error");
      return;
    }

    try {
      await deleteListing(listing.id, accountAddress);
      showToast("Listing deleted.", "success");
    } catch (error) {
      showToast(error.message || "Could not delete listing.", "error");
    }
  };

  const handlePayment = async (pickupLocation) => {
    const listing = checkoutItem;
    if (!listing || !userId) return;
    if (!accountAddress) return;

    const receiverAddress = listing.sellerAddress || listing.seller?.walletAddress || listing.seller;
    const sellerId = listing.ownerId || listing.seller?.userId || "";
    const payablePrice = Number(listing.negotiatedPrice || listing.price || 0);

    try {
      let orderId = listing.negotiatedOrderId || "";
      if (orderId) {
        await updateOrder(orderId, {
          status: orderStatus.PENDING,
          paymentStatus: paymentStatus.HELD,
          paymentMethod: "algo",
          txId: null,
          amount: payablePrice,
          price: payablePrice,
          finalPrice: payablePrice,
          negotiatedPrice: Number(listing.negotiatedPrice || 0),
          pickupLocation,
        });
      } else {
        orderId = await addOrder({
          listingId: listing.id,
          chatId: listing.chatId || "",
          offerMessageId: listing.offerMessageId || "",
          buyerId: userId,
          sellerId,
          buyerAddress: accountAddress,
          sellerAddress: receiverAddress,
          title: listing.title,
          image: listing.image,
          price: payablePrice,
          amount: payablePrice,
          negotiatedPrice: Number(listing.negotiatedPrice || 0),
          finalPrice: payablePrice,
          paymentMethod: "algo",
          txId: null,
          status: orderStatus.PENDING,
          paymentStatus: paymentStatus.HELD,
          rated: false,
          rating: 0,
          pickupLocation,
        });
      }

      await generateOrderOtp(orderId, userId, 6);

      setCheckoutItem(null);
      setTab("my-orders");
      showToast("Order created. Payment is held until seller verifies OTP and you release it.", "success");
    } catch (error) {
      console.error("[UniTrade] Order placement error:", error);
      setCheckoutItem(null);
      showToast(`Could not create order: ${error.message || "Unknown error"}`, "error");
    }
  };

  const handleRate = async (orderId, rating) => {
    try {
      await submitOrderRating(orderId, rating);
      showToast(`Rated ${rating} stars! Thanks for your feedback.`, "success");
    } catch (error) {
      showToast(error.message || "Could not submit rating.", "error");
    }
  };

  const withOrderAction = async (orderId, callback) => {
    setOrderActionId(orderId);
    try {
      await callback();
    } finally {
      setOrderActionId("");
    }
  };

  const handleRegenerateOtp = async (orderId) => {
    await withOrderAction(orderId, async () => {
      await generateOrderOtp(orderId, userId, 6);
      showToast("Delivery OTP regenerated for this order.", "success");
    });
  };

  const handleVerifyOtp = async (orderId, otp) => {
    await withOrderAction(orderId, async () => {
      await verifyOrderOtp(orderId, userId, otp);
      showToast("OTP verified by seller. Buyer can now release payment.", "success");
    });
  };

  const handleReleasePayment = async (orderId) => {
    await withOrderAction(orderId, async () => {
      const verifiedOrder = orders.find((item) => item.id === orderId);
      if (!verifiedOrder) {
        throw new Error("Order not found in local state.");
      }

      if (!accountAddress) {
        throw new Error("Connect your wallet to release payment.");
      }

      if (verifiedOrder.buyerId !== userId) {
        throw new Error("Only buyer can release payment.");
      }

      if (!verifiedOrder.otpVerified) {
        throw new Error("Seller must verify OTP before releasing payment.");
      }

      if (!verifiedOrder.sellerAddress) {
        throw new Error("Missing seller wallet address for this order.");
      }

      const suggestedParams = await algodClient.getTransactionParams().do();
      const amount = algosdk.algosToMicroalgos(Number(verifiedOrder.price || verifiedOrder.finalPrice || verifiedOrder.amount || 0));
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: accountAddress,
        receiver: verifiedOrder.sellerAddress,
        amount,
        suggestedParams,
        note: new TextEncoder().encode(`UniTrade release: ${verifiedOrder.title}`),
      });

      const signedTxn = await peraWallet.signTransaction([[{ txn, signers: [accountAddress] }]]);
      const sendResponse = await algodClient.sendRawTransaction(signedTxn).do();
      const txid = sendResponse.txid || sendResponse.txId || sendResponse["txId"];

      await algosdk.waitForConfirmation(algodClient, txid, 10);

      await releaseOrderPayment(orderId, userId, txid);

      if (verifiedOrder.listingId && verifiedOrder.buyerId) {
        await setListingSold(verifiedOrder.listingId, verifiedOrder.buyerId);
      }

      fetchBalance(accountAddress);
      setGreenTrades((prev) => prev + 1);
      showToast("Payment released to seller after OTP verification.", "success");
      setReceiptOrder(verifiedOrder);
    });
  };

  const handleCancelOrder = async (orderId) => {
    await withOrderAction(orderId, async () => {
      await cancelUserOrder(orderId, userId);
      showToast("Order cancelled.", "info");
    });
  };

  const handleOfferAccepted = async ({ chatId, offerMessageId, offeredPrice, listingId, buyerId, sellerId }) => {
    if (buyerId !== userId) {
      showToast("Only the target buyer can accept this offer.", "error");
      return;
    }

    const listing = listings.find((item) => item.id === listingId);
    if (!listing) {
      showToast("Listing not found for this offer.", "error");
      return;
    }

    const sellerAddress = listing.sellerAddress || listing.seller?.walletAddress || "";

    const negotiatedOrderId = await saveNegotiatedOrder({
      listingId,
      chatId,
      offerMessageId,
      buyerId,
      sellerId,
      buyerAddress: accountAddress || "",
      sellerAddress,
      title: listing.title,
      image: listing.image,
      negotiatedPrice: Number(offeredPrice),
      finalPrice: Number(offeredPrice),
      amount: Number(offeredPrice),
      price: Number(offeredPrice),
      status: orderStatus.PENDING,
      paymentStatus: paymentStatus.HELD,
      rated: false,
      rating: 0,
    });

    setCheckoutItem({
      ...listing,
      price: Number(offeredPrice),
      negotiatedPrice: Number(offeredPrice),
      chatId,
      offerMessageId,
      negotiatedOrderId,
    });

    showToast(`Offer accepted at ${Number(offeredPrice).toFixed(3)} ALGO. Create held order to generate OTP.`, "success");
  };

  const co2Saved = (greenTrades * 0.0002).toFixed(4);

  // Featured listing for hero (first active listing)
  const featuredListing = listings.find(l => l.isActive !== false);

  // Tab label map
  const TAB_LABELS = {
    "browse": "BROWSE",
    "my-orders": `ORDERS${myOrders.length ? ` (${myOrders.length})` : ""}`,
    "listed-offers": `OFFERS${(listedOfferOrders.length || myActiveListings.length) ? ` (${listedOfferOrders.length + myActiveListings.length})` : ""}`,
    "wishlist": `SAVED${wishlistListings.length ? ` (${wishlistListings.length})` : ""}`,
  };

  // Ticker content
  const TICKER_ITEMS = [
    { text: "ALGORAND TESTNET", gold: false },
    { text: "TXN FEE  0.001 ALGO", gold: false },
    { text: "CARBON-NEUTRAL BLOCKCHAIN", gold: false },
    { text: `${listings.length} ACTIVE LISTINGS`, gold: true },
    { text: "BLOCK FINALITY  ~3.6s", gold: false },
    { text: "POWERED BY ALGORAND", gold: false },
    { text: "UNITRADE P2P MARKETPLACE", gold: true },
  ];

  return (
    <>
      {/* ── TICKER TAPE ── */}
      <motion.div
        className="ticker-bar"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div key={i} className={`ticker-item${item.gold ? " gold" : ""}`}>
              {i === 0 || i === TICKER_ITEMS.length ? <span className="live-dot" style={{ backgroundColor: "var(--pulse)", width: 6, height: 6, borderRadius: "50%" }} /> : null}
              {item.text}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── NAVBAR ── */}
      <motion.header
        className="navbar"
        initial={{ opacity: 0, y: -64 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
      >
        <motion.div
          className="nav-logo"
          onClick={() => setTab("browse")}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          style={{ cursor: "pointer" }}
        >
          ⬡ UNITRADE
        </motion.div>

        <nav className="nav-links">
          {["browse", "my-orders", "listed-offers", "wishlist"].map((t, i) => (
            <motion.button
              key={t}
              className={`nav-link${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
              whileTap={{ scale: 0.96 }}
            >
              {TAB_LABELS[t]}
            </motion.button>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {greenTrades > 0 && (
            <div className="co2-chip">🌿 +{co2Saved} kg CO₂</div>
          )}

          {verified && (
            <div className="verified-chip">✓ VERIFIED STUDENT</div>
          )}

          {accountAddress && !verified && (
            <button
              onClick={() => setShowVerify(true)}
              className="btn-outline"
              style={{ padding: "6px 14px", fontSize: 10, letterSpacing: "0.14em" }}
            >
              VERIFY
            </button>
          )}

          {accountAddress && userId && (
            <button
              className="btn-outline"
              onClick={() => {
                if (!verified) { showToast("Verify your student email first.", "error"); setShowVerify(true); return; }
                setShowSell(true);
              }}
              style={{ padding: "6px 14px", fontSize: 10, letterSpacing: "0.14em" }}
            >
              + LIST
            </button>
          )}

          {accountAddress && (
            <button
              onClick={() => setShowMap(true)}
              className="btn-outline"
              style={{ padding: "6px 12px", fontSize: 13, letterSpacing: 0 }}
              title="Campus meetup map"
            >📍</button>
          )}

          {!accountAddress ? (
            <button className="btn-gold" onClick={connectWallet} style={{ padding: "8px 20px", fontSize: 11 }}>
              CONNECT PERA
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {balance !== null && (
                <div className="wallet-balance">
                  <span className="live-indicator" />
                  {balance.toFixed(3)} ALGO
                </div>
              )}
              <div className="wallet-address">
                {truncate(accountAddress)}
              </div>
              <button
                onClick={disconnectWallet}
                className="btn-outline"
                style={{ padding: "6px 12px", fontSize: 12 }}
                title="Disconnect"
              >↩</button>
            </div>
          )}
        </div>
      </motion.header>

      {/* ── MAIN ── */}
      <div className="content-wrapper">

        {/* ══ BROWSE TAB ══ */}
        <AnimatePresence mode="wait">
        {tab === "browse" && (
          <motion.div
            className="main-layout"
            key="browse"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
          >

            {/* Hero */}
            <section className="hero-section">
              <motion.div
                className="hero-left"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.19, 1, 0.22, 1] }}
              >
                <motion.div
                  className="hero-label"
                  initial={{ opacity: 0, letterSpacing: "0.8em" }}
                  animate={{ opacity: 1, letterSpacing: "0.45em" }}
                  transition={{ duration: 1, delay: 0.3 }}
                >Campus P2P · Powered by Algorand</motion.div>
                <motion.h1
                  className="serif"
                  style={{ fontSize: "clamp(48px, 8vw, 80px)", lineHeight: 1, fontWeight: 700, margin: "24px 0" }}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  The Campus <br />
                  <span style={{ color: "var(--pulse)", fontStyle: "italic" }}>Marketplace</span> <br />
                  <span style={{ opacity: 0.9 }}>Reimagined.</span>
                </motion.h1>
                <motion.p 
                  className="hero-body"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 1 }}
                >
                  Experience the next generation of peer-to-peer trading. Fast, secure, and powered by high-performance blockchain technology.
                </motion.p>
                {/* Stats */}
                <motion.div
                  className="hero-stats"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  {[
                    { num: listings.length, lbl: "Active Listings" },
                    { num: "<0.001", lbl: "ALGO Fee" },
                    { num: "100%", lbl: "Carbon-Neutral" }
                  ].map((s, i) => (
                    <motion.div
                      key={s.lbl}
                      className="stat-box"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + i * 0.1, duration: 0.4 }}
                    >
                      <span className="stat-num">{s.num}</span>
                      <span className="stat-lbl">{s.lbl}</span>
                    </motion.div>
                  ))}
                </motion.div>

                {!accountAddress && (
                  <div style={{ marginTop: 8 }}>
                    <button className="btn-gold" onClick={connectWallet} style={{ padding: "14px 32px", fontSize: 12 }}>
                      CONNECT PERA WALLET →
                    </button>
                  </div>
                )}
              </motion.div>

              <div className="hero-right">
                {featuredListing ? (
                  <div className="featured-card">
                    <div className="featured-thumb">
                      {isPhoto(featuredListing.image) ? (
                        <img src={featuredListing.image} alt={featuredListing.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        featuredListing.image
                      )}
                    </div>
                    <div className="featured-body">
                      <div className="featured-label">Featured Listing</div>
                      <div className="featured-title">{featuredListing.title}</div>
                      <span className="featured-price">{featuredListing.price} <span style={{ fontSize: 16, color: "var(--gold-muted)" }}>ALGO</span></span>
                      <hr className="featured-hr" />
                      <div className="featured-tag">≈ ₹{(featuredListing.price * 15).toLocaleString("en-IN")} INR · {featuredListing.condition}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", color: "var(--text-dim)", fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: "0.12em" }}>
                    NO LISTINGS YET
                  </div>
                )}
              </div>
            </section>

            {/* Error */}
            {(authError || listingsError || wishlistError) && (
              <div className="error-banner">
                {[authError, listingsError, wishlistError].filter(Boolean).join(" · ")}
              </div>
            )}

            {/* Price Range */}
            <div className="price-row" style={{ height: "auto", minHeight: 48, padding: "12px 48px", background: "rgba(15, 23, 42, 0.3)", borderRadius: "16px 16px 0 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="price-label" style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600 }}>Price Range</span>
              <input
                type="range" min="0" max={absoluteMaxPrice} step="0.1"
                value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], parseFloat(e.target.value)])}
                style={{ accentColor: "var(--pulse)" }}
              />
              <span className="price-val" style={{ color: "var(--pulse)", fontWeight: 700 }}>0 – {priceRange[1]} ALGO</span>
            </div>

            {/* Condition filter */}
            <div className="cond-row" style={{ height: "auto", minHeight: 48, padding: "12px 48px", background: "rgba(15, 23, 42, 0.3)", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <span className="cond-label" style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600 }}>Condition:</span>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                {CONDITIONS.map(item => (
                  <motion.button
                    key={item}
                    className={`cat-link${condFilter === item ? " active" : ""}`}
                    onClick={() => setCondFilter(item)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ 
                        height: 36, padding: "0 16px", borderRadius: 18, 
                        background: condFilter === item ? "var(--pulse)" : "rgba(255,255,255,0.05)",
                        color: condFilter === item ? "#000" : "var(--text-muted)",
                        fontSize: 11, fontWeight: 600, border: "none"
                    }}
                  >
                    {item.toUpperCase()}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Filter + Categories */}
            <div className="filter-bar" style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(20px)", borderRadius: "0 0 16px 16px", padding: "12px 24px", minHeight: 64, display: "flex", alignItems: "center", gap: 16 }}>
              <div className="filter-search" style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", padding: "0 16px", display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <span className="filter-search-icon" style={{ fontSize: 18, color: "var(--pulse-dim)" }}>⌕</span>
                <input
                  placeholder="Search listings…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ background: "none", border: "none", padding: "10px 0", color: "var(--text)", width: "100%", fontSize: 14 }}
                />
              </div>

              <div className="filter-cats" style={{ display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none" }}>
                {CATEGORIES.map(item => (
                  <motion.button
                    key={item}
                    className={`cat-link${category === item ? " active" : ""}`}
                    onClick={() => setCategory(item)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ 
                        height: 36, padding: "0 16px", borderRadius: 18, 
                        background: category === item ? "rgba(0, 242, 254, 0.15)" : "transparent",
                        color: category === item ? "var(--pulse)" : "var(--text-muted)",
                        fontSize: 12, fontWeight: 600, border: "none"
                    }}
                  >
                    {item.toUpperCase()}
                  </motion.button>
                ))}
              </div>

              <div className="filter-right">
                <select
                  className="select-obsidian"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ height: 38, minWidth: 120, fontSize: 11, background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "0 12px", color: "var(--text-muted)" }}
                >
                  <option value="newest">NEWEST</option>
                  <option value="price-asc">PRICE ↑</option>
                  <option value="price-desc">PRICE ↓</option>
                  <option value="rating">TOP RATED</option>
                </select>
              </div>
            </div>

            {/* Listings grid */}
            {(authLoading || listingsLoading) ? (
              <div className="loading-state">
                <div className="spinner" />
                <div className="loading-text">Syncing Marketplace…</div>
              </div>
            ) : filteredListings.length === 0 ? (
              <div className="empty-state" style={{ padding: 80, textAlign: "center", color: "var(--text-dim)" }}>
                <div className="empty-icon" style={{ fontSize: 64, marginBottom: 16, animation: "float 4s ease-in-out infinite" }}>📡</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>SIGNAL LOST.</div>
                <div style={{ fontSize: 13 }}>NO LISTINGS FOUND IN THIS SECTOR.</div>
                <button 
                    className="btn-gold" 
                    onClick={() => { setSearch(""); setCategory("All"); setCondFilter("All"); }}
                    style={{ marginTop: 24, padding: "12px 32px", fontSize: 11 }}
                >
                  RESET FILTERS
                </button>
              </div>
            ) : (
              <motion.div
                className="card-grid"
                variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
                layout
                initial="hidden"
                animate="visible"
                style={{ padding: "48px 40px", gap: 32 }}
              >
                {filteredListings.map((listing) => (
                  <div key={listing.id} className="card-grid-item">
                    <ListingCard
                      listing={listing}
                      accountAddress={accountAddress}
                      currentUserId={userId}
                      onBuy={setCheckoutItem}
                      wishlist={wishlistIds}
                      onToggleWishlist={handleWishlistToggle}
                      onChat={setChatListing}
                      onDelete={handleDeleteListing}
                      onView={setViewListing}
                    />
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ══ MY ORDERS ══ */}
        {tab === "my-orders" && (
          <motion.div
            className="main-layout"
            key="my-orders"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
          >
            <div className="section-header">
              <div>
                <h2 className="section-title">My Orders.</h2>
                <div className="section-sub">Orders where you are the buyer</div>
              </div>
            </div>

            {ordersError && <div className="error-banner">{ordersError}</div>}

            {ordersLoading ? (
              <div className="loading-state"><div className="spinner" /><div className="loading-text">Loading Orders…</div></div>
            ) : myOrders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◌</div>
                <div className="empty-title">No Orders Yet.</div>
                <div className="empty-sub">Orders you place will appear here</div>
                <button className="btn-gold" onClick={() => setTab("browse")} style={{ fontSize: 11 }}>BROWSE LISTINGS</button>
              </div>
            ) : (
              <div style={{ padding: "24px 48px", display: "flex", flexDirection: "column", gap: 2 }}>
                {myOrders.map(order => (
                  <OrderRow key={order.id} order={order} currentUserId={userId}
                    onRate={handleRate} onVerifyOtp={handleVerifyOtp}
                    onRegenerateOtp={handleRegenerateOtp} onReleasePayment={handleReleasePayment}
                    onCancelOrder={handleCancelOrder} actionLoading={orderActionId === order.id}
                    onViewReceipt={setReceiptOrder}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ══ LISTED OFFERS ══ */}
        {tab === "listed-offers" && (
          <motion.div
            className="main-layout"
            key="listed-offers"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
          >
            <div className="section-header" style={{ borderBottom: "none" }}>
              <div>
                <h2 className="section-title">Seller Hub.</h2>
                <div className="section-sub">Manage your items for sale and incoming orders</div>
              </div>
            </div>

            {/* My Active Listings Section */}
            {myActiveListings.length > 0 && (
              <div style={{ padding: "0 48px 48px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <h3 style={{ 
                    fontFamily: "'Space Mono', monospace", 
                    fontSize: 14, 
                    letterSpacing: "0.1em", 
                    color: "var(--gold)", 
                    textTransform: "uppercase" 
                  }}>Active Listings ({myActiveListings.length})</h3>
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                </div>
                
                <div className="card-grid" style={{ borderTop: "1px solid var(--border)" }}>
                  {myActiveListings.map(listing => (
                    <div key={listing.id} className="card-grid-item">
                      <ListingCard
                        listing={listing}
                        accountAddress={accountAddress}
                        currentUserId={userId}
                        onBuy={() => {}}
                        wishlist={wishlistIds}
                        onToggleWishlist={handleWishlistToggle}
                        onChat={setChatListing}
                        onDelete={handleDeleteListing}
                        onView={setViewListing}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: "0 48px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 0 }}>
                <h3 style={{ 
                  fontFamily: "'Space Mono', monospace", 
                  fontSize: 14, 
                  letterSpacing: "0.1em", 
                  color: "var(--gold)", 
                  textTransform: "uppercase" 
                }}>Incoming Orders ({listedOfferOrders.length})</h3>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>
            </div>

            {ordersError && <div className="error-banner">{ordersError}</div>}

            {ordersLoading ? (
              <div className="loading-state"><div className="spinner" /><div className="loading-text">Loading Hub…</div></div>
            ) : listedOfferOrders.length === 0 ? (
              <div className="empty-state" style={{ padding: "60px 48px" }}>
                <div className="empty-icon">◌</div>
                <div className="empty-title">No Active Orders.</div>
                <div className="empty-sub">When students buy your items, orders will appear here</div>
                {myActiveListings.length === 0 && (
                  <button className="btn-gold" onClick={() => setShowSell(true)} style={{ fontSize: 11 }}>LIST AN ITEM</button>
                )}
              </div>
            ) : (
              <div style={{ padding: "0 48px 48px", display: "flex", flexDirection: "column", gap: 2 }}>
                {listedOfferOrders.map(order => (
                  <OrderRow key={order.id} order={order} currentUserId={userId}
                    onRate={handleRate} onVerifyOtp={handleVerifyOtp}
                    onRegenerateOtp={handleRegenerateOtp} onReleasePayment={handleReleasePayment}
                    onCancelOrder={handleCancelOrder} actionLoading={orderActionId === order.id}
                    onViewReceipt={setReceiptOrder}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ══ WISHLIST ══ */}
        {tab === "wishlist" && (
          <motion.div
            className="main-layout"
            key="wishlist"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
          >
            <div className="section-header">
              <div>
                <h2 className="section-title">Saved.</h2>
                <div className="section-sub">Items you've saved for later</div>
              </div>
            </div>

            {wishlistLoading ? (
              <div className="loading-state"><div className="spinner" /><div className="loading-text">Syncing Wishlist…</div></div>
            ) : wishlistListings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◌</div>
                <div className="empty-title">Nothing Saved.</div>
                <div className="empty-sub">Tap ♡ on any listing to save it</div>
                <button className="btn-gold" onClick={() => setTab("browse")} style={{ fontSize: 11 }}>BROWSE LISTINGS</button>
              </div>
            ) : (
              <div className="card-grid">
                {wishlistListings.map(listing => (
                  <div key={listing.id} className="card-grid-item">
                    <ListingCard listing={listing} accountAddress={accountAddress}
                      currentUserId={userId} onBuy={setCheckoutItem} wishlist={wishlistIds}
                      onToggleWishlist={handleWishlistToggle} onChat={setChatListing}
                      onDelete={handleDeleteListing} onView={setViewListing}
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* ── MODALS ── */}
      <AnimatePresence>
        {checkoutItem && (
          <CheckoutModal listing={checkoutItem} accountAddress={accountAddress} balance={balance}
            onClose={() => setCheckoutItem(null)} onConfirm={handlePayment}
          />
        )}
        {showSell && (
          <SellModal accountAddress={accountAddress} onClose={() => setShowSell(false)} onList={handleListItem} />
        )}
        {showVerify && (
          <VerifyModal
            onClose={() => setShowVerify(false)}
            onVerify={async (email) => { 
              try {
                await updateProfile({ verified: true, email });
                showToast("STUDENT VERIFIED. YOU MAY NOW LIST ITEMS.", "success"); 
              } catch (err) {
                showToast("SYNC FAILED. TRY AGAIN.", "error");
              }
            }}
          />
        )}
        {showMap && <MapModal onClose={() => setShowMap(false)} />}
        {chatListing && (
          <ChatDrawer listing={chatListing} currentUserId={userId}
            onClose={() => setChatListing(null)} onBuy={setCheckoutItem}
            onOfferAccepted={handleOfferAccepted} showToast={showToast}
          />
        )}
        {receiptOrder && (
          <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
        )}
        {viewListing && (
          <ListingDetailModal
            listing={viewListing}
            accountAddress={accountAddress}
            currentUserId={userId}
            onClose={() => setViewListing(null)}
            onBuy={setCheckoutItem}
            onChat={setChatListing}
            onDelete={handleDeleteListing}
            wishlist={wishlistIds}
            onToggleWishlist={handleWishlistToggle}
          />
        )}
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </>
  );
}
