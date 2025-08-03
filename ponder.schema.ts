import { onchainTable } from "ponder";

export const srcEscrow = onchainTable("src_escrow", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  escrowAddress: t.text().notNull(),
}));