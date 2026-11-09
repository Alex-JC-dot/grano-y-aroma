import { create } from "zustand";
import { Auction, BidEntry } from "@/lib/types";
import { auctions as initialAuctions } from "@/lib/data";

interface AuctionStore {
  auctions: Auction[];
  placeBid: (auctionId: string, bidder: string, amount: number) => boolean;
  tickTimers: () => void;
}

export const useAuctionStore = create<AuctionStore>((set, get) => ({
  auctions: initialAuctions,
  placeBid: (auctionId, bidder, amount) => {
    const auction = get().auctions.find((a) => a.id === auctionId);
    if (!auction) return false;
    // Sin pujas, basta el precio de salida; con pujas, hay que superar la actual en Bs. 20.
    // (Antes se miraba currentBid > 0, y un lote sin pujas cuyo currentBid ya era el precio
    // base exigía base + 20 aunque la pantalla dijera que el mínimo era el precio base.)
    const minBid = auction.bids.length > 0
      ? auction.currentBid + 20
      : auction.basePrice;
    if (amount < minBid) return false;

    const newBid: BidEntry = {
      bidder,
      amount,
      timestamp: new Date().toLocaleTimeString("es-BO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false, // "22:30", igual que las demás pujas (no "10:30 p. m.")
      }),
    };

    set((s) => ({
      auctions: s.auctions.map((a) =>
        a.id === auctionId
          ? {
              ...a,
              currentBid: amount,
              currentBidder: bidder,
              bids: [newBid, ...a.bids],
            }
          : a
      ),
    }));
    return true;
  },
  tickTimers: () => {
    set((s) => ({
      auctions: s.auctions.map((a) => ({
        ...a,
        timeLeftSeconds: Math.max(0, a.timeLeftSeconds - 1),
      })),
    }));
  },
}));
