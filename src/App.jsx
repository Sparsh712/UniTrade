import React, { useEffect, useMemo, useState } from "react";
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
import { useAuthUser } from "./hooks/useAuthUser";
import { useListings } from "./hooks/useListings";
import { useOrders } from "./hooks/useOrders";
import { useWishlist } from "./hooks/useWishlist";
import { orderStatus, paymentStatus } from "./services/ordersService";

const peraWallet = new PeraWalletConnect();
const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");

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
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [showSell, setShowSell] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [chatListing, setChatListing] = useState(null);
  const [toast, setToast] = useState(null);
  const [verified, setVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [greenTrades, setGreenTrades] = useState(0);
  const [orderActionId, setOrderActionId] = useState("");

  const showToast = (message, type = "info") => setToast({ message, type });

  useEffect(() => {
    peraWallet.reconnectSession().then((accounts) => {
      if (accounts.length) setAccountAddress(accounts[0]);
    }).catch(() => { });
    peraWallet.connector?.on("disconnect", () => setAccountAddress(null));
  }, []);

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

  const disconnectWallet = () => {
    peraWallet.disconnect();
    setAccountAddress(null);
    setBalance(null);
    showToast("Wallet disconnected");
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
    () => listings.filter((listing) => listing.isActive !== false && wishlistIds.includes(listing.id)),
    [listings, wishlistIds]
  );

  const myOrders = useMemo(
    () => orders.filter((order) => order.buyerId === userId),
    [orders, userId]
  );

  const listedOfferOrders = useMemo(
    () => orders.filter((order) => order.sellerId === userId),
    [orders, userId]
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
    if (!userId || listing.ownerId !== userId) {
      showToast("You can only delete your own listings.", "error");
      return;
    }

    try {
      await deleteListing(listing.id);
      showToast("Listing deleted.", "success");
    } catch (error) {
      showToast(error.message || "Could not delete listing.", "error");
    }
  };

  const handlePayment = async (pickupLocation) => {
    const listing = checkoutItem;
    if (!listing || !userId || !accountAddress) return;

    const receiverAddress = listing.sellerAddress || listing.seller?.walletAddress || listing.seller;
    const sellerId = listing.ownerId || listing.seller?.userId || "";
    const payablePrice = Number(listing.negotiatedPrice || listing.price || 0);

    try {
      let orderId = listing.negotiatedOrderId || "";
      if (orderId) {
        await updateOrder(orderId, {
          status: orderStatus.PENDING,
          paymentStatus: paymentStatus.HELD,
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
      showToast(`Could not create held order: ${error.message || "Unknown error"}`, "error");
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
      if (!accountAddress) {
        throw new Error("Connect your wallet to release payment.");
      }

      const verifiedOrder = orders.find((item) => item.id === orderId);
      if (!verifiedOrder) {
        throw new Error("Order not found in local state.");
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

  const tabStyle = (targetTab) => ({
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    background: tab === targetTab ? "#6366f1" : "none",
    color: tab === targetTab ? "#fff" : "#6b7280",
    fontFamily: "'DM Mono', monospace",
    transition: "all .2s",
  });

  return (
    <>
      <header style={{ background: "#0a0f1edd", backdropFilter: "blur(12px)", borderBottom: "1px solid #1f2937", padding: "0 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, height: 64, flexWrap: "wrap" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f9fafb", letterSpacing: -0.5, flexShrink: 0, cursor: "pointer" }} onClick={() => setTab("browse")}>
            <span style={{ color: "#6366f1" }}>⬡</span> UniTrade
          </div>

          {greenTrades > 0 && (
            <div style={{ background: "#064e3b33", border: "1px solid #06543555", borderRadius: 20, padding: "4px 12px", fontSize: 11, color: "#10b981", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: 4 }}>
              🌿 {co2Saved} kg CO2 saved
            </div>
          )}

          <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
            {["browse", "my-orders", "listed-offers", "wishlist"].map((targetTab) => (
              <button key={targetTab} onClick={() => setTab(targetTab)} style={tabStyle(targetTab)}>
                {targetTab === "browse"
                  ? "Browse"
                  : targetTab === "my-orders"
                    ? `My Orders ${myOrders.length ? `(${myOrders.length})` : ""}`
                    : targetTab === "listed-offers"
                      ? `Listed Offers ${listedOfferOrders.length ? `(${listedOfferOrders.length})` : ""}`
                      : `♡ ${wishlistCount || ""}`}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {userId && (
              <div style={{ background: "#1f2937", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#9ca3af", fontFamily: "'DM Mono', monospace" }}>
                user {truncate(userId)}
              </div>
            )}

            {accountAddress && (
              <button
                onClick={() => setShowMap(true)}
                title="IEC Ghaziabad Meetup Map"
                style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 14, transition: "border-color .2s" }}
                onMouseEnter={(event) => { event.currentTarget.style.borderColor = "#6366f1"; }}
                onMouseLeave={(event) => { event.currentTarget.style.borderColor = "#374151"; }}
              >
                📍
              </button>
            )}

            {accountAddress && !verified && (
              <button
                onClick={() => setShowVerify(true)}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #f59e0b55", background: "#f59e0b15", color: "#f59e0b", cursor: "pointer", fontWeight: 600, fontSize: 12, fontFamily: "'DM Mono', monospace" }}
              >
                🎓 Verify
              </button>
            )}

            {verified && (
              <div style={{ background: "#10b98122", border: "1px solid #10b98155", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#10b981", fontFamily: "'DM Mono', monospace" }}>
                ✓ Verified
              </div>
            )}

            {accountAddress && userId && (
              <button
                onClick={() => {
                  if (!verified) {
                    showToast("Please verify your student email first!", "error");
                    setShowVerify(true);
                    return;
                  }
                  setShowSell(true);
                }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #6366f1", background: "none", color: "#6366f1", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "'DM Mono', monospace", transition: "all .2s" }}
                onMouseEnter={(event) => { event.currentTarget.style.background = "#6366f122"; }}
                onMouseLeave={(event) => { event.currentTarget.style.background = "none"; }}
              >
                + Sell
              </button>
            )}

            {!accountAddress ? (
              <button onClick={connectWallet} style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "'DM Mono', monospace" }}>
                Connect Pera
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {balance !== null && (
                  <div style={{ background: "linear-gradient(135deg, #064e3b44, #065f4644)", border: "1px solid #10b98155", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontFamily: "'DM Mono', monospace", color: "#10b981", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                    💰 {balance.toFixed(3)} ALGO
                  </div>
                )}
                <div style={{ background: "#1f2937", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontFamily: "'DM Mono', monospace", color: "#a5b4fc", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                  {truncate(accountAddress)}
                </div>
                <button onClick={disconnectWallet} style={{ background: "none", border: "1px solid #374151", borderRadius: 8, padding: "6px 12px", color: "#6b7280", cursor: "pointer", fontSize: 13 }}>↩</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {tab === "browse" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{ display: "inline-block", background: "#6366f122", border: "1px solid #6366f144", borderRadius: 20, padding: "4px 14px", fontSize: 12, color: "#a5b4fc", fontFamily: "'DM Mono', monospace", marginBottom: 16 }}>
                ⚡ Powered by Algorand TestNet · Carbon-Negative Blockchain
              </div>
              <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 16, background: "linear-gradient(135deg,#f9fafb 40%,#a5b4fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Buy &amp; Sell on Campus<br />with Crypto
              </h1>
              <p style={{ color: "#6b7280", fontSize: 16, maxWidth: 520, margin: "0 auto" }}>
                Peer-to-peer marketplace for students. Low fees ({"<"}₹0.10), instant settlement, full transparency on Algorand.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 28, flexWrap: "wrap" }}>
                {[["📦", listings.length, "Listings"], ["⚡", "<0.001 ALGO", "Txn Fee"], ["🌿", "Carbon-Negative", "Network"], ["🎓", verified ? "Verified" : "Open", "Status"]].map(([icon, value, label]) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#a5b4fc", fontFamily: "'DM Mono', monospace" }}>{value}</div>
                    <div style={{ fontSize: 11, color: "#4b5563" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {(authError || listingsError || wishlistError) && (
              <div style={{ marginBottom: 14, background: "#7f1d1d33", border: "1px solid #ef444466", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#fca5a5" }}>
                {[authError, listingsError, wishlistError].filter(Boolean).join(" | ")}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <input style={{ ...inputStyle, flex: "1 1 240px", background: "#111827" }} placeholder="🔍 Search listings..." value={search} onChange={(event) => setSearch(event.target.value)} />
              <select style={{ ...inputStyle, width: "auto", background: "#111827" }} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="newest">Newest</option>
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
                <option value="rating">Top Rated</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#6b7280", fontFamily: "'DM Mono', monospace" }}>Price:</span>
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={priceRange[1]}
                onChange={(event) => setPriceRange([priceRange[0], parseFloat(event.target.value)])}
                style={{ flex: "0 1 200px", accentColor: "#6366f1" }}
              />
              <span style={{ fontSize: 12, color: "#a5b4fc", fontFamily: "'DM Mono', monospace" }}>0 - {priceRange[1]} ALGO</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {CATEGORIES.map((item) => (
                <button key={item} onClick={() => setCategory(item)}
                  style={{ padding: "6px 16px", borderRadius: 20, border: `1px solid ${category === item ? "#6366f1" : "#1f2937"}`, background: category === item ? "#6366f122" : "none", color: category === item ? "#a5b4fc" : "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all .15s" }}>
                  {item}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 32, flexWrap: "wrap" }}>
              {CONDITIONS.map((item) => (
                <button key={item} onClick={() => setCondFilter(item)}
                  style={{ padding: "4px 12px", borderRadius: 14, border: `1px solid ${condFilter === item ? "#8b5cf6" : "#1f2937"}`, background: condFilter === item ? "#8b5cf622" : "none", color: condFilter === item ? "#c4b5fd" : "#4b5563", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all .15s" }}>
                  {item}
                </button>
              ))}
            </div>

            {(authLoading || listingsLoading) ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Syncing marketplace...</div>
              </div>
            ) : filteredListings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>No listings found</div>
                <div style={{ fontSize: 14, marginTop: 8 }}>Try a different search or category</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                {filteredListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    accountAddress={accountAddress}
                    currentUserId={userId}
                    onBuy={setCheckoutItem}
                    wishlist={wishlistIds}
                    onToggleWishlist={handleWishlistToggle}
                    onChat={setChatListing}
                    onDelete={handleDeleteListing}
                  />
                ))}
              </div>
            )}

            {!accountAddress && (
              <div style={{ textAlign: "center", marginTop: 40, padding: 24, background: "#111827", borderRadius: 16, border: "1px dashed #374151" }}>
                <p style={{ color: "#6b7280", marginBottom: 12 }}>Connect your Pera Wallet to buy or sell items</p>
                <button onClick={connectWallet} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                  Connect Pera Wallet
                </button>
              </div>
            )}
          </>
        )}

        {tab === "my-orders" && (
          <>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>My Orders</h2>
            <p style={{ color: "#6b7280", marginBottom: 32, fontSize: 14 }}>Orders where you are the buyer</p>

            {ordersError && (
              <div style={{ marginBottom: 14, background: "#7f1d1d33", border: "1px solid #ef444466", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#fca5a5" }}>
                Firestore order sync issue: {ordersError}
              </div>
            )}

            {ordersLoading ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Loading your purchases...</div>
              </div>
            ) : myOrders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>No buyer orders yet</div>
                <div style={{ fontSize: 14, marginTop: 8 }}>Orders you place will appear here</div>
                <button onClick={() => setTab("browse")} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontWeight: 700 }}>Browse Listings</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {myOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    currentUserId={userId}
                    onRate={handleRate}
                    onVerifyOtp={handleVerifyOtp}
                    onRegenerateOtp={handleRegenerateOtp}
                    onReleasePayment={handleReleasePayment}
                    onCancelOrder={handleCancelOrder}
                    actionLoading={orderActionId === order.id}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "listed-offers" && (
          <>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Listed Offers</h2>
            <p style={{ color: "#6b7280", marginBottom: 32, fontSize: 14 }}>Orders where you are the seller</p>

            {ordersError && (
              <div style={{ marginBottom: 14, background: "#7f1d1d33", border: "1px solid #ef444466", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#fca5a5" }}>
                Firestore order sync issue: {ordersError}
              </div>
            )}

            {ordersLoading ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Loading your listed-offer orders...</div>
              </div>
            ) : listedOfferOrders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🛍️</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>No listed offers yet</div>
                <div style={{ fontSize: 14, marginTop: 8 }}>Orders on your listings will appear here</div>
                <button onClick={() => setShowSell(true)} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontWeight: 700 }}>List an Item</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {listedOfferOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    currentUserId={userId}
                    onRate={handleRate}
                    onVerifyOtp={handleVerifyOtp}
                    onRegenerateOtp={handleRegenerateOtp}
                    onReleasePayment={handleReleasePayment}
                    onCancelOrder={handleCancelOrder}
                    actionLoading={orderActionId === order.id}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "wishlist" && (
          <>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>♡ Wishlist</h2>
            <p style={{ color: "#6b7280", marginBottom: 32, fontSize: 14 }}>Items you've saved for later</p>

            {wishlistLoading ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Syncing wishlist...</div>
              </div>
            ) : wishlistListings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💭</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Your wishlist is empty</div>
                <div style={{ fontSize: 14, marginTop: 8 }}>Tap the heart icon on any listing to save it</div>
                <button onClick={() => setTab("browse")} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontWeight: 700 }}>Browse Listings</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                {wishlistListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    accountAddress={accountAddress}
                    currentUserId={userId}
                    onBuy={setCheckoutItem}
                    wishlist={wishlistIds}
                    onToggleWishlist={handleWishlistToggle}
                    onChat={setChatListing}
                    onDelete={handleDeleteListing}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {checkoutItem && (
        <CheckoutModal
          listing={checkoutItem}
          accountAddress={accountAddress}
          balance={balance}
          onClose={() => setCheckoutItem(null)}
          onConfirm={handlePayment}
        />
      )}
      {showSell && (
        <SellModal
          accountAddress={accountAddress}
          onClose={() => setShowSell(false)}
          onList={handleListItem}
        />
      )}
      {showVerify && (
        <VerifyModal
          onClose={() => setShowVerify(false)}
          onVerify={(email) => {
            setVerified(true);
            setVerifiedEmail(email);
            showToast("Student verified! You can now sell items.", "success");
          }}
        />
      )}
      {showMap && <MapModal onClose={() => setShowMap(false)} />}
      {chatListing && (
        <ChatDrawer
          listing={chatListing}
          currentUserId={userId}
          onClose={() => setChatListing(null)}
          onBuy={setCheckoutItem}
          onOfferAccepted={handleOfferAccepted}
          showToast={showToast}
        />
      )}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </>
  );
}
