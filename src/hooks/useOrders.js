/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { hasFirebaseConfig } from "../firebase/config";
import {
  cancelOrder,
  createOrder,
  generateDeliveryOtp,
  rateOrder,
  releaseHeldPayment,
  subscribeToBuyerOrderOtps,
  subscribeToUserOrders,
  updateOrderById,
  updateOrderStatus,
  upsertNegotiatedOrder,
  verifyDeliveryOtp,
} from "../services/ordersService";

export function useOrders(userId) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    if (!hasFirebaseConfig) {
      setError("Missing Firebase environment variables. Firestore orders are disabled.");
      setLoading(false);
      return;
    }

    setLoading(true);
    let latestOrders = [];
    let latestOtpMap = new Map();

    const publish = () => {
      setOrders(
        latestOrders.map((order) => {
          if (order.buyerId !== userId) {
            return {
              ...order,
              buyerOtp: "",
            };
          }

          const otpInfo = latestOtpMap.get(order.id);
          return {
            ...order,
            buyerOtp: otpInfo?.buyerOtp || "",
            otpCreatedAt: otpInfo?.otpCreatedAt || order.otpCreatedAt,
            otpExpiresAt: otpInfo?.otpExpiresAt || order.otpExpiresAt,
          };
        })
      );
    };

    const unsubscribe = subscribeToUserOrders(
      userId,
      (items) => {
        latestOrders = items;
        publish();
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message || "Failed to sync orders in real time.");
        setLoading(false);
      }
    );

    const unsubscribeOtps = subscribeToBuyerOrderOtps(
      userId,
      (otpMap) => {
        latestOtpMap = otpMap;
        publish();
      },
      (otpError) => {
        setError(otpError.message || "Failed to sync delivery OTP in real time.");
      }
    );

    return () => {
      unsubscribe();
      unsubscribeOtps();
    };
  }, [userId]);

  const addOrder = useCallback(async (payload) => {
    return createOrder(payload);
  }, []);

  const setOrderStatus = useCallback(async (orderId, status, txId) => {
    await updateOrderStatus(orderId, status, txId);
  }, []);

  const submitOrderRating = useCallback(async (orderId, rating) => {
    await rateOrder(orderId, rating);
  }, []);

  const saveNegotiatedOrder = useCallback(async (payload) => {
    return upsertNegotiatedOrder(payload);
  }, []);

  const updateOrder = useCallback(async (orderId, updates) => {
    await updateOrderById(orderId, updates);
  }, []);

  const generateOrderOtp = useCallback(async (orderId, buyerId, otpLength) => {
    return generateDeliveryOtp(orderId, buyerId, otpLength);
  }, []);

  const verifyOrderOtp = useCallback(async (orderId, sellerId, otp) => {
    return verifyDeliveryOtp(orderId, sellerId, otp);
  }, []);

  const releaseOrderPayment = useCallback(async (orderId, buyerId, txId) => {
    return releaseHeldPayment(orderId, buyerId, txId);
  }, []);

  const cancelUserOrder = useCallback(async (orderId, actorId) => {
    return cancelOrder(orderId, actorId);
  }, []);

  return {
    orders,
    loading,
    error,
    addOrder,
    setOrderStatus,
    submitOrderRating,
    saveNegotiatedOrder,
    updateOrder,
    generateOrderOtp,
    verifyOrderOtp,
    releaseOrderPayment,
    cancelUserOrder,
  };
}
