const express = require("express");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const cors = require("cors");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const PORT = process.env.PORT || 5000; // ✅ Corrected here

app.use(cors());
app.use(express.json());

app.get("/api/memo", async (req, res) => {
  try {
    const itemsParam = req.query.items;
    if (!itemsParam) {
      return res.status(400).json({ error: "No items provided" });
    }

    const items = itemsParam.split(",").map((itemStr) => {
      const [name, qty, price] = itemStr.split(":");
      return { name, quantity: parseInt(qty), price: parseFloat(price) };
    });

    const doc = new PDFDocument();
    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(buffers);

      const form = new FormData();
      form.append("file", pdfBuffer, {
        filename: `memo_${Date.now()}.pdf`,
        contentType: "application/pdf",
      });

      const uploadRes = await axios.post("https://api.gofile.io/uploadFile", form, {
        headers: form.getHeaders(),
      });

      if (uploadRes.data.status !== "ok") {
        return res.status(500).json({ error: "Failed to upload PDF to GoFile" });
      }

      const pdfUrl = uploadRes.data.data.downloadPage;
      res.json({ pdfUrl });
    });

    doc.fontSize(18).text("Invoice", { align: "center" });
    const formattedDate = new Date().toLocaleString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });
    doc.fontSize(12).text(`Date: ${formattedDate}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text("Product           Qty    Price    Total");
    doc.text("----------------------------------------");

    let grandTotal = 0;
    items.forEach(({ name, quantity, price }) => {
      const total = quantity * price;
      grandTotal += total;

      const namePad = name.padEnd(16);
      const qtyPad = String(quantity).padEnd(6);
      const pricePad = price.toFixed(2).padEnd(8);
      doc.text(`${namePad} ${qtyPad} ${pricePad} ${total.toFixed(2)}`);
    });

    doc.text("----------------------------------------");
    doc.text(`Total: ${grandTotal.toFixed(2)}`, { align: "right" });
    doc.moveDown();
    doc.fontSize(14).text("Thanks for shopping!", { align: "center" });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
