import React, { useEffect, useState } from "react";
import algosdk from "algosdk";
import { PeraWalletConnect } from "@perawallet/connect";

const peraWallet = new PeraWalletConnect();

const algodClient = new algosdk.Algodv2(
    "",
    "https://testnet-api.algonode.cloud",
    ""
);

const listings = [
    { id: 1, title: "Calculator", cost: 0.1, seller: "SZJEXURXMHK3BNE7EEDHNEOXKTF7HD6QLJAUXCWRI44APPGI65ZXYFGQMY" },
    { id: 2, title: "Draftor", cost: 0.1, seller: "SZJEXURXMHK3BNE7EEDHNEOXKTF7HD6QLJAUXCWRI44APPGI65ZXYFGQMY" },
    { id: 3, title: "Sheets", cost: 0.1, seller: "SZJEXURXMHK3BNE7EEDHNEOXKTF7HD6QLJAUXCWRI44APPGI65ZXYFGQMY" }
]

function App() {
    const [accountAddress, setAccountAddress] = useState(null);

    useEffect(() => {
        peraWallet.reconnectSession().then((accounts) => {
            if (accounts.length) {
                setAccountAddress(accounts[0]);
            }
        });
    }, []);

    const connectWallet = async () => {
        const accounts = await peraWallet.connect();
        setAccountAddress(accounts[0]);
    };

    const disconnectWallet = async () => {
        peraWallet.disconnect();
        setAccountAddress(null);
    };

    const sendPayment = async (listing) => {
        try {
            if (!accountAddress) {
                alert("Wallet not connected");
                return;
            }

            const receiver = listing.seller

            if (!receiver) {
                alert("Receiver address missing");
                return;
            }

            if (!accountAddress || typeof accountAddress !== "string" || accountAddress.length === 0) {
                alert("Invalid account address");
                return;
            }

            if (!receiver || typeof receiver !== "string" || receiver.length === 0) {
                alert("Invalid receiver address");
                return;
            }

            const suggestedParams = await algodClient.getTransactionParams().do();

            const amount = algosdk.algosToMicroalgos(listing.cost);

            const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                sender: accountAddress,
                receiver: receiver,
                amount: amount,
                suggestedParams
            });

            const signedTxn = await peraWallet.signTransaction([
                [{ txn, signers: [accountAddress] }]
            ]);

            const { txid } = await algodClient
                .sendRawTransaction(signedTxn)
                .do();

            console.log("Transaction sent with ID:", txid);

            await algosdk.waitForConfirmation(algodClient, txid, 4);

            alert("Payment successful!");
        } catch (error) {
            console.error(error);
            alert("Payment failed");
        }
    };

    return (
        <div style={{ padding: "40px" }}>
            <h1>Campus Marketplace</h1>

            {!accountAddress ? (
                <button onClick={connectWallet}>Connect Pera Wallet</button>
            ) : (
                <>
                    <p>Connected: {accountAddress}</p>
                    {listings.map((listing) => (
                        <div key={listing.id}>
                            <p>{listing.title}</p>
                            <button onClick={() => sendPayment(listing)} disabled={!accountAddress}>Pay {listing.cost} ALGO</button>
                        </div>
                    ))}
                    <br /><br />
                    <button onClick={disconnectWallet}>Disconnect</button>
                </>
            )}
        </div>
    );
}

export default App;
