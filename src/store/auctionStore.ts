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
    const minBid = auction.currentBid > 0
      ? auction.currentBid + 20
      : auction.basePrice;
    if (amount < minBid) return false;

    const newBid: BidEntry = {
      bidder,
      amount,
      timestamp: new Date().toLocaleTimeString("es-BO", {
        hour: "2-digit",
        minute: "2-digit",
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
