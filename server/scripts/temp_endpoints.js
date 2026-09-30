router.post(
  "/direct-purchase/:id/cancel",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [rows] = await conn.execute(
        "SELECT * FROM pur_direct_purchase_hdr WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) FOR UPDATE",
        { id, companyId, branchId, branchIdsStr }
      );
      const dp = rows?.[0];
      if (!dp) throw httpError(404, "NOT_FOUND", "Direct purchase not found");
      if (dp.status === "CANCELLED") {
        return res.json({ message: "Already cancelled" });
      }

      await conn.beginTransaction();

      if (dp.bill_id) {
         await conn.execute("UPDATE pur_bills SET status = 'CANCELLED' WHERE id = :billId", { billId: dp.bill_id });
      }

      if (dp.grn_id) {
         await conn.execute("UPDATE inv_goods_receipt_notes SET status = 'CANCELLED' WHERE id = :grnId", { grnId: dp.grn_id });
      }

      await conn.execute(
        "UPDATE pur_direct_purchase_hdr SET status = 'CANCELLED' WHERE id = :id",
        { id }
      );

      await conn.commit();
      res.json({ message: "Cancelled successfully" });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  }
);

router.post("/bills/fix-voucher/:id", async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
        const id = Number(req.params.id);
        const [rows] = await conn.execute("SELECT id, company_id, branch_id FROM pur_bills WHERE id = :id OR bill_no = :id", { id: req.params.id });
        if (rows.length) {
            const bill = rows[0];
            await conn.beginTransaction();
            const vRes = await postPurchaseBillVoucherTx(conn, { billId: bill.id, companyId: bill.company_id, branchId: bill.branch_id, branchIdsStr: '' });
            if (vRes?.voucherId) {
                await conn.execute("UPDATE pur_bills SET voucher_id = :vid WHERE id = :bid", { vid: vRes.voucherId, bid: bill.id });
                await conn.commit();
                return res.json({ success: true, voucherNo: vRes.voucherNo });
            }
            await conn.commit();
            res.json({ success: true, message: "No voucher returned" });
        } else {
            res.status(404).json({ error: "Not found" });
        }
    } catch(e) {
        if (conn) await conn.rollback();
        next(e);
    } finally {
        if (conn) conn.release();
    }
});
