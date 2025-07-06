const express = require("express");
const PDFDocument = require("pdfkit");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

app.get("/api/memo", async (req, res) => {
  try {
    const itemsParam = req.query.items;
    if (!itemsParam) {
      return res.status(400).json({ error: "No items provided" });
    }

    // Parse items from query string
    const items = itemsParam.split(",").map((itemStr) => {
      const [name, qty, price] = itemStr.split(":");
      return {
        name,
        quantity: parseInt(qty),
        price: parseFloat(price),
      };
    });

    // Create PDF document in memory
    const doc = new PDFDocument();
    let buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(buffers);

      try {
        // Upload PDF to transfer.sh using PUT request
        const filename = `memo_${Date.now()}.pdf`;
        const uploadResponse = await axios.put(
          `https://transfer.sh/${filename}`,
          pdfBuffer,
          {
            headers: {
              "Content-Type": "application/pdf",
            },
            maxBodyLength: Infinity, // large file support
          }
        );

        // Return uploaded file URL to client
        res.json({ pdfUrl: uploadResponse.data });
      } catch (uploadError) {
        console.error("Upload failed:", uploadError.response?.data || uploadError.message);
        res.status(500).json({ error: "Upload failed" });
      }
    });

    // Build PDF content
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
